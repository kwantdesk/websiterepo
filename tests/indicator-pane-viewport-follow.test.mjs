import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import * as sampling from '../src/lib/chartIndicatorPaneSampling.ts';
import * as barWidth from '../src/lib/chartBarWidth.ts';
import * as histogramWidth from '../src/lib/indicatorHistogramWidth.ts';
import * as coordinates from '../src/lib/paneCoordinateContinuity.ts';
import * as continuity from '../src/lib/cvdRenderContinuity.ts';
import { subscribeIndicatorPaneFrames } from '../src/lib/indicatorPaneViewport.ts';

function frames() {
  let id=0;const queue=new Map();
  return {queue,requestAnimationFrame(fn){queue.set(++id,fn);return id;},cancelAnimationFrame(i){queue.delete(i);},paint(){const batch=[...queue.values()];queue.clear();for(const fn of batch)fn();}};
}
function harness() {
  const window=frames(),instances=new Map(),listeners=new Set();let active=null,dirty=false;
  const hook=init=>{const index=active.cursor++;if(!(index in active.slots))active.slots[index]=init();return active.slots[index];};
  const effects=[];
  const react={memo:fn=>fn,useMemo:fn=>fn(),useCallback:fn=>fn,
    useRef:value=>hook(()=>({current:value})),
    useState:value=>{const slot=hook(()=>({value:typeof value==='function'?value():value}));return [slot.value,next=>{slot.value=typeof next==='function'?next(slot.value):next;dirty=true;}];},
    useEffect:(fn,deps)=>{const slot=hook(()=>({deps:null,dispose:null}));if(!slot.deps||deps.some((d,i)=>!Object.is(d,slot.deps[i]))){effects.push(()=>{slot.dispose?.();slot.deps=deps;slot.dispose=fn();});}},
  };
  const jsx=(type,props,key)=>({type,key,props:props??{}});
  const mocks={'react':react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'lucide-react':new Proxy({},{get:()=>()=>null}),
    '@/components/useSuperTrendLivePanes':{useSuperTrendLivePanes:groups=>groups},
    '@/components/SuperTrendPaneLabels':{default:()=>null},'@/components/KstPanePlot':{default:()=>null},
    '@/lib/superTrendPaneScale':{SuperTrendPaneScale:class {retain(){}resolve(_key,series,domain){return domain(series);}}},
    '@/lib/chartIndicatorPaneSampling':sampling,'@/lib/chartBarWidth':barWidth,'@/lib/indicatorHistogramWidth':histogramWidth,'@/lib/paneCoordinateContinuity':coordinates,
    '@/lib/cvdRenderContinuity':continuity,'@/lib/indicatorPaneViewport':{subscribeIndicatorPaneFrames}};
  const module={exports:{}};
  const baseline=process.env.KWANT_PANE_VIEWPORT_BASELINE;
  const paneSource=baseline
    ? execFileSync('git',['show',`${baseline==='1'?'3966b6769b415de4e25405188cd97395b21e2668':baseline}:src/components/ChartIndicatorPanes.tsx`],{encoding:'utf8'})
    : fs.readFileSync('src/components/ChartIndicatorPanes.tsx','utf8');
  vm.runInNewContext(ts.transpileModule(paneSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
    {module,exports:module.exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];},window,document:{addEventListener(){},removeEventListener(){}},console});
  // Exercise the actual Chart subscription callback, not a test-only substitute.
  const sf=ts.createSourceFile('Chart.tsx',fs.readFileSync('src/components/Chart.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
  function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='subscribeIndicatorViewport')callback=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(sf);assert.ok(callback,'Chart must pass a direct native viewport subscription');
  const scale={subscribeVisibleLogicalRangeChange:fn=>listeners.add(fn),unsubscribeVisibleLogicalRangeChange:fn=>listeners.delete(fn)};
  const chartRef={current:{timeScale:()=>scale}};
  const subscribe=vm.runInNewContext(ts.transpileModule('('+callback.getText(sf)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{chartRef});
  const times=[1,2,3];let spacing=50,offset=100;
  const groups=[{key:'cvd',title:'CVD',indicatorId:'cumulative-volume-delta',series:[{key:'cvd-values',label:'CVD',placement:'pane',kind:'candlestick',color:'#00ff00',data:times.map(time=>({time,value:time*5,open:time*5-2,high:time*5+1,low:time*5-3,close:time*5}))}]},
    {key:'stats',title:'KWANT Stats',indicatorId:'kwant-stats',series:[],stats:{showHeader:false,autoFormat:true,coloringDeviation:1,positiveColor:'#00ff00',negativeColor:'#ff0000',neutralColor:'#aaaaaa',textColor:'#ffffff',headerColor:'#000000',metrics:[{key:'totalVolume',label:'VOL',format:'number',tone:'neutral',threshold:0}],bars:times.map(time=>({time,values:{totalVolume:time*100}}))}}];
  const props={groups,coordinateScope:'NQ:1m',width:800,leftInset:36,priceScaleWidth:64,height:240,chartHeight:600,bottom:24,viewportVersion:0,subscribeViewport:subscribe,paneHeights:{cvd:120,stats:120},collapsedPanes:{},paneLayout:{},timeToX:time=>offset+spacing*time,onResizePane(){},onTogglePane(){},onMovePane(){}};
  function render(fn,p,key){const old=active;active=instances.get(key)??{slots:[]};active.cursor=0;instances.set(key,active);const element=fn(p);active=old;return expand(element,key);}
  function expand(element,key){if(element==null||typeof element!=='object')return element;if(Array.isArray(element))return element.map((e,i)=>expand(e,key+'/'+(e?.key??i)));if(typeof element.type==='function')return render(element.type,element.props,key+'/'+(element.key??element.type.name));return {...element,props:{...element.props,children:expand(element.props.children,key+'/children')}};}
  function tree(){dirty=false;const result=render(module.exports.default,props,'root');while(effects.length)effects.shift()();return result;}
  const descendants=(node,fn,result=[])=>{if(Array.isArray(node)){node.forEach(n=>descendants(n,fn,result));return result;}if(node&&typeof node==='object'){if(fn(node))result.push(node);descendants(node.props?.children,fn,result);}return result;};
  return {window,listeners,props,groups,tree,descendants,get dirty(){return dirty;},move(nextOffset,nextSpacing){offset=nextOffset;spacing=nextSpacing;for(const fn of listeners)fn();},dispose(){for(const instance of instances.values())for(const slot of instance.slots)slot?.dispose?.();},nativeCoordinates:()=>times.map(t=>offset+spacing*t-36)};
}

test('actual CVD candles and KWANT Stats cells follow every pan/zoom frame while parent Chart props remain unchanged',()=>{
  const h=harness();h.tree();h.window.paint();
  const source=JSON.stringify(h.groups);
  for(const [offset,spacing]of [[100,50],[130,70],[90,100],[170,110],[60,150]]){
    h.move(offset,spacing);h.move(offset,spacing);assert.equal(h.window.queue.size,1,'coalesce native events per frame');
    h.window.paint();assert.equal(h.dirty,true,'pane updates before a gesture-settle timer');
    const result=h.tree();
    const cvd=h.descendants(result,n=>n.type==='line'&&n.props.stroke==='#00ff00'&&n.props.y1!==n.props.y2);
    assert.deepEqual(Array.from(cvd,n=>n.props.x1),h.nativeCoordinates(),'CVD wick centers align under the current price candles');
    const cells=h.descendants(result,n=>n.type==='text'&&['100','200','300'].includes(String(n.props.children)));
    assert.deepEqual(Array.from(cells,n=>n.props.x),h.nativeCoordinates(),'QuantStats columns align to those same candles');
    assert.equal(h.props.viewportVersion,0,'no parent Chart viewport render is needed');
  }
  assert.equal(JSON.stringify(h.groups),source,'navigation does not mutate CVD or stats values');h.dispose();assert.equal(h.listeners.size,0);
});

test('removing all panes cancels queued viewport work; re-adding binds again and unmount detaches',()=>{
  const h=harness();h.tree();h.move(150,60);assert.equal(h.window.queue.size,1);
  h.props.groups=[];h.tree();assert.equal(h.listeners.size,0);assert.equal(h.window.queue.size,0);
  h.props.groups=h.groups;h.tree();assert.equal(h.listeners.size,1);h.dispose();assert.equal(h.listeners.size,0);assert.equal(h.window.queue.size,0);
});

test('chart recreation rebinds the pane viewport listener instead of retaining a disposed chart',()=>{
  const h=harness();h.tree();assert.equal(h.listeners.size,1);const next=new Set();
  h.props.subscribeViewport=listener=>{next.add(listener);return()=>next.delete(listener);};h.tree();assert.equal(h.listeners.size,0);assert.equal(next.size,1);h.dispose();assert.equal(next.size,0);
});
