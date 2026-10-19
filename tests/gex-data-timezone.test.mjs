import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {normalizeTimeZone} from '../src/lib/timeZones.ts';
import {formatTableValue} from '../public/gex-data-app/table-view.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const hostSource = read('../src/components/gex-data/GexDataWorkspace.tsx');
const app = read('../public/gex-data-app/app.js');
const storageKey = 'kwantdesk:gex-data:workspace:v1';
const zoneKey = 'gex-data-timezone';

function host({account='owner', savedAccount=account, savedZone, chartZone='America/New_York'}={}) {
  const values = savedZone ? {[zoneKey]: savedZone, 'gex-data-existing': 'keep'} : {'gex-data-existing': 'keep'};
  const store = new Map([[storageKey, JSON.stringify({accountKey:savedAccount, values})]]);
  const effects=[], cleanups=[], listeners=new Map(), messages=[], refs=[];
  const child = {frames:[], postMessage:data=>messages.push(['child',data.type])};
  const frame = {frames:[child],postMessage:data=>messages.push(['root',data.type])};
  const window = {
    location:{origin:'https://test.local',search:''},
    addEventListener:(name,handler)=>listeners.set(name,handler),
    removeEventListener:name=>listeners.delete(name),
  };
  const context = {exports:{}, window, document:{documentElement:{}}, URLSearchParams, Map, Set, AbortController,
    localStorage:{getItem:key=>store.get(key)??null},
    MutationObserver:class {observe(){} disconnect(){}},
    require:name=>{
      if(name==='react')return {useEffect:fn=>effects.push(fn),useRef:value=>{
        const ref={current:refs.length===0?{contentWindow:frame}:value};refs.push(ref);return ref;
      },useState:value=>[value,()=>{}]};
      if(name==='react/jsx-runtime')return {jsx:(_,props)=>props,jsxs:(_,props)=>props};
      if(name.includes('browserStorageQuota'))return {writeProtectedItem:(key,value)=>{store.set(key,value);return {ok:true};}};
      if(name.includes('userPreferences'))return {PREFERENCES_HYDRATED_EVENT:'hydrated'};
      if(name.includes('chartSettings'))return {
        defaultChartSettings:{timezone:'America/New_York'},loadStoredChartSettings:()=>({timezone:chartZone}),
        CHART_SETTINGS_CHANGE_EVENT:'chart-change',CHART_SETTINGS_STORAGE_KEY:'chart-settings',
      };
      if(name.includes('marketIndices'))return {MARKET_INDEX_DEFINITIONS:[]};
      if(name.includes('TimeZoneSelect'))return {default:()=>null};
      if(name.includes('KwantLoader'))return {default:()=>null};
      if(name.includes('timeZones'))return {normalizeTimeZone};
      throw Error(name);
    },
  };
  vm.runInNewContext(ts.transpileModule(hostSource,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  context.exports.default({accountKey:account,active:true});
  for(const effect of effects) {const cleanup=effect();if(cleanup)cleanups.push(cleanup);}
  messages.length=0;
  return {api:window.__kwantGexDataHost,store,messages,listeners,
    cleanup:()=>cleanups.forEach(fn=>fn())};
}

test('GEX Data uses the charts picker, top-right reserved toolbar space and current chart default',()=>{
  assert.match(hostSource,/import TimeZoneSelect from "@\/components\/ui\/TimeZoneSelect"/);
  assert.match(hostSource,/absolute right-2 top-\[5px\]/);
  assert.match(hostSource,/params\.set\("hostTimezone", "1"\)/);
  assert.match(read('../public/gex-data-app/site.css'),/\.host-timezone-control \.topbar\{padding-right:190px!important\}/);
  const h=host({chartZone:'Australia/Brisbane'});
  assert.equal(h.api.timezone(),'Australia/Brisbane');h.cleanup();
});

test('timezone writes preserve account data, immediately reach all child frames and survive reopening',()=>{
  const h=host();h.api.write(zoneKey,'Australia/Brisbane');
  assert.equal(h.api.timezone(),'Australia/Brisbane');
  const saved=JSON.parse(h.store.get(storageKey));
  assert.equal(saved.accountKey,'owner');assert.equal(saved.values['gex-data-existing'],'keep');
  assert.equal(saved.values[zoneKey],'Australia/Brisbane');
  assert.deepEqual(h.messages,[['root','gex-data-site-timezone'],['child','gex-data-site-timezone']]);
  h.messages.length=0;h.api.write(zoneKey,'Australia/Brisbane');
  h.listeners.get('storage')({key:storageKey});
  assert.deepEqual(h.messages,[], 'unchanged settings must not repaint every frame');
  const reopened=host({savedZone:saved.values[zoneKey]});
  assert.equal(reopened.api.timezone(),'Australia/Brisbane');h.cleanup();reopened.cleanup();
});

test('other accounts cannot inherit a previous owner timezone; imported workspaces update it too',()=>{
  const h=host({account:'other',savedAccount:'owner',savedZone:'Asia/Tokyo'});
  assert.equal(h.api.timezone(),'America/New_York');
  h.api.restore({[zoneKey]:'Europe/London','gex-data-existing':'restored'});
  assert.equal(h.api.timezone(),'Europe/London');
  h.cleanup();assert.equal(h.listeners.has('storage'),false);
  assert.equal(h.listeners.has('chart-change'),false);
});

test('timezone changes reformat cached data only and keep historical selections intact',()=>{
  const start=app.indexOf('  function refreshTimeZonePresentation()');
  const code=app.slice(start,app.indexOf('  function schedulePoll()',start));
  const calls=[],payload={data:'cached'};
  const context={activeTool:{id:'interval-map'},toolPayload:payload,
    renderToolPayload:(_,p)=>calls.push(p),renderSnapshotControl:p=>calls.push(p),
    updateToolTimestamp:(_,p)=>calls.push(p)};
  vm.runInNewContext(`${code}\nrefreshTimeZonePresentation();`,context);
  assert.deepEqual(calls,[payload,payload,payload]);
  assert.doesNotMatch(code,/loadActiveTool|fetch|snapshotSelections\.(?:delete|set)|setTimeout/);
  assert.match(app,/addEventListener\('gex-data-timezone',refreshTimeZonePresentation\)/);
});

test('axes, table times and retrieval timestamps honor zone changes, including NY DST',()=>{
  const time=Date.parse('2026-10-19T14:30:00Z');
  const start=app.indexOf('function displayChartTime('),end=app.indexOf('\n}',start)+2;
  let zone='America/New_York';const context={gexTimeZone:()=>zone};
  vm.runInNewContext(app.slice(start,end)+'\nglobalThis.format=displayChartTime;',context);
  assert.equal(context.format(time),'10:30 AM');
  zone='Australia/Brisbane';assert.equal(context.format(time),'12:30 AM');
  assert.equal(formatTableValue(time,{type:'time'},{},{timeZone:zone}),'12:30:00 AM');
  assert.equal(formatTableValue(time,{type:'date'},{},{timeZone:zone}),'Oct 20, 2026');
  zone='America/New_York';assert.equal(context.format(Date.parse('2026-11-02T14:30:00Z')),'9:30 AM');
  assert.match(app,/toLocaleTimeString\('en-US',\{timeZone:gexTimeZone\(\)\}\)/);
  const table=read('../public/gex-data-app/table-view.js');
  assert.match(table,/listen\(document\.defaultView, 'gex-data-timezone'/);
  assert.match(table,/listeners\.forEach\(/);
});

test('iframe runtime rejects foreign timezone notifications and refreshes existing tables in place',()=>{
  const runtime=read('../public/gex-data-app/site-runtime.js');
  const listener=runtime.split('\n').find(line=>line.includes("event.data?.type==='gex-data-site-timezone'"));
  let receive;const events=[];
  const context={location:{origin:'https://test.local'},CustomEvent:class {constructor(type){this.type=type;}},
    window:{addEventListener:(_,fn)=>{receive=fn;},dispatchEvent:event=>events.push(event.type)}};
  vm.runInNewContext(listener,context);
  receive({origin:'https://other.local',data:{type:'gex-data-site-timezone'}});
  assert.deepEqual(events,[]);
  receive({origin:'https://test.local',data:{type:'gex-data-site-timezone'}});
  assert.deepEqual(events,['gex-data-timezone']);
  const table=read('../public/gex-data-app/table-view.js');
  const start=table.indexOf('  if (document.defaultView) listen(');
  let update;const state={document:{defaultView:{}},timeZone:'America/New_York',
    gexTimeZone:()=> 'Australia/Brisbane',listen:(_,name,fn)=>{assert.equal(name,'gex-data-timezone');update=fn;},
    renders:0,render:()=>state.renders++};
  vm.runInNewContext(table.slice(start,table.indexOf('  return { setRows',start)),state);
  update();assert.equal(state.timeZone,'Australia/Brisbane');assert.equal(state.renders,1);
});

test('retrieval footer changes local clock without changing source time or exchange session date',()=>{
  const start=app.indexOf('  function updateToolTimestamp(');
  const code=app.slice(start,app.indexOf('  function refreshTimeZonePresentation()',start));
  let zone='America/New_York';const footer={textContent:''};
  const payload={_gexData:{gatewayFetchedAt:'2026-10-19T14:30:00Z',requestedSessionDate:'2026-10-19'}};
  const before=JSON.stringify(payload);
  const context={gexTimeZone:()=>zone,snapshotSelections:new Map(),snapshotKey:()=> 'current',
    getControl:()=> 'latest',apiStatus:{market:{open:true}},q:()=>footer};
  vm.runInNewContext(code+'\nglobalThis.update=updateToolTimestamp;',context);
  context.update({id:'interval-map'},payload);
  assert.equal(footer.textContent,'Retrieved 10:30:00 AM · 2026-10-19');
  zone='Australia/Brisbane';context.update({id:'interval-map'},payload);
  assert.equal(footer.textContent,'Retrieved 12:30:00 AM · 2026-10-19');
  assert.equal(JSON.stringify(payload),before);
});
