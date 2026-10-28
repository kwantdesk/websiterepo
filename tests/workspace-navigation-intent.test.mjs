import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import * as archive from '../src/lib/archivedWorkspaceFeatures.ts';

const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const jsx=(type,props)=>({type,props:props??{}});
const readSource=file=>process.env.KWANT_NAVIGATION_BASELINE==='1'
  ?execFileSync('git',['show',`8d20b6d1e131280b28925a6eea52eebd0962737c:${file}`],{encoding:'utf8'})
  :fs.readFileSync(file,'utf8');
function warmer(){
  let now=100,fail=false;const loaded=[],routes=[],module={exports:{}};
  vm.runInNewContext(compile(fs.readFileSync('src/lib/workspaceNavigationWarmup.ts','utf8')),{module,exports:module.exports,Date:{now:()=>now},require:name=>{loaded.push(name);if(fail)throw Error('chunk expired');return {};}});
  return {warm:href=>module.exports.warmWorkspaceNavigation(href,route=>routes.push(route)),fn:module.exports.warmWorkspaceNavigation,loaded,routes,set now(value){now=value},set fail(value){fail=value}};
}
const drain=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const flatten=node=>node==null||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(flatten):[node,...flatten(node.props?.children)];

test('a home Charts intent prepares route, shell and chart code without awaiting a click or starting market data',async()=>{
  const w=warmer();w.warm('/charts');assert.deepEqual(w.routes,['/charts'],'route preparation is immediate');await drain();
  assert.deepEqual(w.loaded.sort(),['@/components/Chart','@/components/KwantifyWorkspace'].sort());
  assert.ok(!w.loaded.some(x=>/Cache|Data|Stream|Gateway/.test(x)),'no vendor/data preload on intent');
});
test('pointer/focus/touch deduplicate for thirty seconds and GEX Vue prepares the exact chart implementation',async()=>{
  const w=warmer();w.warm('/gamvue');w.warm('/gamvue');w.warm('/gamvue');await drain();assert.deepEqual(w.routes,['/gamvue']);assert.equal(w.loaded.length,2);
  w.now=30100;w.warm('/gamvue');await drain();assert.equal(w.routes.length,2);
});
test('failed chunks can retry, external URLs are not prepared, and non-workspace routes do not download the trading engine',async()=>{
  const w=warmer();w.warm('https://example.com');w.warm('//example.com');assert.equal(w.routes.length,0);
  w.warm('/accounts');await drain();assert.equal(w.loaded.length,0);
  w.fail=true;w.warm('/charts');await drain();w.fail=false;w.warm('/charts');await drain();assert.equal(w.routes.filter(x=>x==='/charts').length,2);
});

function sidebar(mode='native'){
  const events=[],prefetch=[],w=warmer(),module={exports:{}},Link=()=>null;
  const react={memo:f=>f,useEffect(){},useLayoutEffect(){},useRef:value=>({current:value})};
  const mocks={'react':react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'next/link':{__esModule:true,default:Link},'next/navigation':{useRouter:()=>({prefetch:href=>prefetch.push(href)})},'lucide-react':new Proxy({},{get:()=>()=>null}),
    '@/lib/archivedWorkspaceFeatures':archive,'@/lib/cockpitTypography':{},'@/lib/workspaceNavigationWarmup':{warmWorkspaceNavigation:w.fn},'@/lib/rendererHealth':{},'@/components/HighImpactNewsChip':{default:()=>null},'@/lib/browserStorageQuota':{}};
  vm.runInNewContext(compile(readSource('src/components/AppSidebar.tsx')),{module,exports:module.exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];},window:{location:{pathname:'/charts',search:''},history:{pushState(_a,_b,href){events.push('url:'+href)}}}});
  const tree=module.exports.default({activeItem:mode==='native'?'home':'charts',orientation:'horizontal',navigationMode:mode,onNavigateIntent:key=>events.push('intent:'+key),onNavigateStart:key=>events.push('start:'+key)});
  return {events,prefetch,w,links:flatten(tree).filter(n=>n.type===Link)};
}
test('actual homepage navigation rail warms Charts on pointer/focus and does not consume modifier clicks',async()=>{
  const h=sidebar();const charts=h.links.find(n=>n.props.href==='/charts');assert.ok(charts);charts.props.onPointerEnter();charts.props.onFocus();await drain();assert.deepEqual(h.prefetch,['/charts']);
  const before=h.events.length;charts.props.onPointerDown({button:0,ctrlKey:true});assert.equal(h.events.length,before);
});
test('actual persistent GEX Vue rail retains immediate local switching without an RSC prefetch or data warmup',()=>{
  const h=sidebar('persistent'),gex=h.links.find(n=>n.props.href==='/gamvue');let prevented=false;
  gex.props.onPointerDown({button:0});gex.props.onClick({button:0,preventDefault(){prevented=true;}});
  assert.ok(h.events.includes('start:gamvue'));assert.ok(h.events.includes('url:/gamvue'));assert.equal(prevented,true);assert.equal(h.prefetch.length,0);
});

test('actual home launch card attaches code preparation to pointer, keyboard focus and touch',()=>{
  const source=ts.createSourceFile('WorkspaceHome.tsx',readSource('src/components/WorkspaceHome.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let component;
  function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='LaunchCard')component=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(source);assert.ok(component);
  const calls=[],Link=()=>null;
  const render=vm.runInNewContext(compile('('+component.getText(source)+')'),{exports:{},require:name=>{assert.equal(name,'react/jsx-runtime');return{jsx,jsxs:jsx};},useRouter:()=>({prefetch(){}}),warmWorkspaceNavigation:href=>calls.push(href),Link,HomeWorkspacePreview:()=>null,LiveIndexTape:()=>null,ArrowUpRight:()=>null});
  const tree=render({destination:{href:'/charts',title:'Charts',icon:()=>null,preview:'chart'},live:{}});
  for(const event of ['onPointerEnter','onFocus','onTouchStart'])tree.props[event]();assert.deepEqual(calls,['/charts','/charts','/charts']);
});
test('actual cold workspace layout shows usable navigation without importing the trading engine synchronously',()=>{
  const module={exports:{}},loaded=[],AppSidebar=()=>null;let options;
  const mocks={'react':{useEffect(){},useMemo:f=>f()},'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{usePathname:()=>'/gamvue',useRouter:()=>({replace(){}})},'next/dynamic':{__esModule:true,default:(_load,config)=>{options=config;return()=>null;}},
    '@/lib/archivedWorkspaceFeatures':archive,'@/components/AppSidebar':{__esModule:true,default:AppSidebar},'@/components/WorkspaceFailureBoundary':{default:()=>null}};
  vm.runInNewContext(compile(readSource('src/app/(workspace)/layout.tsx')),{module,exports:module.exports,require:name=>{loaded.push(name);assert.ok(name in mocks,name);return mocks[name];}});
  assert.equal(loaded.includes('@/components/KwantifyWorkspace'),false);const tree=options.loading();assert.equal(flatten(tree).find(n=>n.type===AppSidebar).props.activeItem,'gamvue');
});
test('workspace pointer intent does not fan out provider data requests',()=>{
  const source=ts.createSourceFile('KwantifyWorkspace.tsx',readSource('src/components/KwantifyWorkspace.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
  function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='warmWorkspaceSection')callback=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(source);assert.ok(callback);
  const modules=[],data=[];const warm=vm.runInNewContext(compile('('+callback.getText(source)+')'),{isWorkspaceFeatureArchived:archive.isWorkspaceFeatureArchived,preloadWorkspaceModule:key=>{modules.push(key);return Promise.resolve();},preloadWorkspaceData:key=>{data.push(key);return Promise.resolve();}});
  warm('gamma');warm('gexdesk');warm('zyon');assert.deepEqual(modules,['gamma','gexdesk']);assert.deepEqual(data,[]);
});
test('every active home launcher destination resolves to an actual route rather than the removed GEX calendar/flow paths',()=>{
  const source=readSource('src/components/WorkspaceHome.tsx');
  for(const match of source.matchAll(/href: "([^"]+)"/g)){
    const href=match[1];if(href==='/'||archive.isWorkspaceFeatureArchived(href.slice(1)))continue;
    assert.ok(fs.existsSync(`src/app/(workspace)${href}/page.tsx`)||fs.existsSync(`src/app${href}/page.tsx`),href);
  }
  assert.ok(!source.includes('href: "/gex-cal"'));assert.ok(!source.includes('href: "/gex-flow"'));
});
