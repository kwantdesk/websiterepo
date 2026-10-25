import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("GEX VUE and GEX DATA use identical compact trigger sizing and menu heading",() => {
  const shell=read("src/components/KwantifyWorkspace.tsx"),host=read("src/components/gex-data/GexDataWorkspace.tsx");
  for(const source of [shell,host]){
    assert.match(source,/TimeZoneSelect, \{ CHART_TIME_ZONE_TRIGGER_CLASS_NAME \}/);
    assert.match(source,/menuLabel="Chart timezone"\s+compact\s+className=\{CHART_TIME_ZONE_TRIGGER_CLASS_NAME\}/);
  }
  assert.doesNotMatch(host,/w-\[172px\]|menuLabel="GEX Data timezone"|compact className="w-full/);
  const component=read("src/components/ui/TimeZoneSelect.tsx");
  assert.match(component,/CHART_TIME_ZONE_TRIGGER_CLASS_NAME = "w-auto min-w-\[118px\] max-w-\[164px\] shrink-0 px-2.5"/);
  assert.match(component,/kwant-chart-timezone-control kwant-chart-row-control/);
  const css=read("src/app/globals.css");
  const styles=css.match(/body\.kwant-cockpit-ui \.kwant-chart-command-deck \.kwant-chart-row-control,\s*body\.kwant-cockpit-ui \.kwant-chart-timezone-control,\s*body\.kwant-cockpit-ui \.kwant-workspace-toolbar-control \{([^}]+)\}/)?.[1];
  assert.ok(styles);
  for(const token of ['height: 28px','font-family: "Aleph", sans-serif','font-size: 10px','font-weight: 600','letter-spacing: .075em'])assert.ok(styles.includes(token),token);
});

test("scrolling choices keeps the time menu open, while external viewport changes reanchor it",() => {
  class FakeNode {}
  const inside=new FakeNode(),outside=new FakeNode(),listeners=new Map(),changes=[],selected=[],cleanup=[];
  const refs=[{focus(){},getBoundingClientRect:()=>({right:400,bottom:100,top:70})},{contains:node=>node===inside},{focus(){}}];let refIndex=0,stateIndex=0;
  const frames=[];
  const jsx=(type,props)=>({type,props});
  const context={exports:{},Node:FakeNode,document:{addEventListener(){},removeEventListener(){}},window:{
    innerWidth:1000,innerHeight:800,
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},
  },require:name=>{
    if(name==="react")return {useCallback:fn=>fn,useRef:()=>({current:refs[refIndex++]}),useMemo:fn=>fn(),useEffect:fn=>cleanup.push(fn()),useState:initial=>{
      const index=stateIndex++;return [index===0?true:initial,value=>changes.push([index,value])];
    }};
    if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
    if(name==="react-dom")return {createPortal:value=>value};
    if(name==="lucide-react")return {};
    if(name.includes("timeZones"))return {normalizeTimeZone:value=>value,compactTimeZoneLabel:value=>value,browserTimeZone:()=>"UTC",timeZoneOptions:()=>[{value:"UTC",label:"UTC",searchText:"utc"}]};
    throw Error(name);
  }};
  vm.runInNewContext(ts.transpileModule(read("src/components/ui/TimeZoneSelect.tsx"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
  const tree=context.exports.default({value:"UTC",onChange:value=>selected.push(value),compact:true});
  listeners.get("scroll")({type:"scroll",target:inside});assert.equal(changes.length,0);
  listeners.get("scroll")({type:"scroll",target:outside});frames.shift()();
  assert.equal(changes.length,1);assert.equal(changes[0][0],2);assert.equal(changes[0][1].top,107);
  changes.length=0;listeners.get("resize")({type:"resize",target:{}});frames.shift()();assert.equal(changes[0][0],2);
  const walk=node=>{
    if(!node||typeof node!=="object")return;
    if(node.props?.role==="option")node.props.onClick();
    const children=node.props?.children;
    for(const child of Array.isArray(children)?children:[children])Array.isArray(child)?child.forEach(walk):walk(child);
  };
  walk(tree);assert.deepEqual(selected,["UTC"]);
  cleanup.forEach(fn=>fn?.());assert.equal(listeners.size,0);
});
