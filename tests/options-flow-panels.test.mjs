import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {OPTIONS_FLOW_TOOLS,optionsFlowTool,normalizeOptionsFlowState,optionsFlowInitialSymbol} from '../src/lib/optionsFlowTools.ts';
import {createOptionsFlowRequestPool,acquireOptionsFlowRequests} from '../src/lib/optionsFlowRequests.ts';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('picker catalogue contains every source tool exactly once, under separate source identities',()=>{
  const data=read('public/gex-data-app/app.js').split('const TOOL_DEFINITIONS = [')[1].split('\n  ];')[0];
  const box=read('src/components/gexbot/GexBoxDashboard.tsx').split('const TOOLS: Tool[] = [')[1].split('\n];')[0];
  for(const [source,code] of [['gex-data',data],['gex-box',box]]){
    const expected=[...code.matchAll(/\{ id: "([a-z-]+)"/g)].map(m=>m[1]).sort();
    assert.deepEqual(OPTIONS_FLOW_TOOLS.filter(t=>t.source===source).map(t=>t.toolId).sort(),expected);
  }
  assert.equal(OPTIONS_FLOW_TOOLS.length,51);
  assert.equal(new Set(OPTIONS_FLOW_TOOLS.map(t=>t.id)).size,51);
  assert.ok(optionsFlowTool('options-flow:kwanty:classic'));
  assert.ok(optionsFlowTool('options-flow:kwanty:state'));
  assert.ok(optionsFlowTool('options-flow:kwanty:orderflow'));
  assert.equal(optionsFlowTool('options-flow:kwanty:invented'),undefined);
});

test('initial options symbols use exact futures families, not stock ticker prefixes',()=>{
  const allowed=['SPX','NDX','DIA','IWM','SPY','ESTC','META'];
  for(const symbol of ['NQ','MNQ','NQZ6','MNQ.v.0'])assert.equal(optionsFlowInitialSymbol(symbol,allowed),'NDX');
  for(const symbol of ['ES','MESZ6','ES.c.0','SPXW'])assert.equal(optionsFlowInitialSymbol(symbol,allowed),'SPX');
  assert.equal(optionsFlowInitialSymbol('ESTC',allowed),'ESTC');
  assert.equal(optionsFlowInitialSymbol('META',allowed),'META');
  assert.equal(optionsFlowInitialSymbol('GC',allowed),'SPY');
});

test('pane snapshots survive workspace normalisation and duplicates diverge',()=>{
  const shell=read('src/components/KwantifyWorkspace.tsx');
  const raw=shell.slice(shell.indexOf('function normalizeWorkspacePane('),shell.indexOf('\ntype ChartWorkspaceRuntime'));
  const exports={};vm.runInNewContext(ts.transpileModule(raw+'\nexports.normalize=normalizeWorkspacePane;',{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,normalizeOptionsFlowState,isWorkspacePanelKind:value=>!!optionsFlowTool(value),parseChartInterval:()=>({}),
      normalizeBrokerLabel:x=>x,parseTimeframe:()=>null,normalizeWorkspaceChartSymbol:x=>x,
      makeWatchlistKey:()=>'',isMarketIndexSymbol:()=>false,supportsChartInterval:()=>true});
  const original={id:'pane-a',content:'options-flow:kwanty:state',symbol:'NDX',broker:'Market Index',timeframe:'5m',period:'5D',watchlistKey:'a',locked:false,
    optionsFlowState:{'kwanty:v1':JSON.stringify({ticker:'NDX',settings:{state:{show_volume:false}}})}};
  // Some instrument normalisers are imported by the actual helper. Supply its
  // existing dependencies; execute the actual function, not a rewritten clone.
  const normalized=exports.normalize(original,original);
  assert.equal(normalized.content,original.content);
  assert.equal(normalized.optionsFlowState['kwanty:v1'],original.optionsFlowState['kwanty:v1']);
  const duplicate=structuredClone(normalized);duplicate.id='pane-b';
  duplicate.optionsFlowState['kwanty:v1']='different';
  assert.notEqual(duplicate.optionsFlowState['kwanty:v1'],normalized.optionsFlowState['kwanty:v1']);
  assert.deepEqual(normalizeOptionsFlowState({bad:2}),{});
  assert.deepEqual(normalizeOptionsFlowState({'x':'a'.repeat(1_500_001)}),{});
});

test('identical panels share one request but receive independent response bodies',async()=>{
  let calls=0;
  const pool=createOptionsFlowRequestPool(async()=>{calls++;await new Promise(r=>setTimeout(r,5));return new Response('{"actual":true}',{headers:{'Cache-Control':'private, max-age=30'}});});
  try{
    const responses=await Promise.all(Array.from({length:12},()=>pool.request('/api/gex-data/iv-rank',{method:'POST',body:'{"ticker":"QQQ"}'})));
    assert.equal(calls,1);
    for(const response of responses)assert.equal((await response.json()).actual,true);
    await pool.request('/api/gex-data/iv-rank',{method:'POST',body:'{"ticker":"NDX"}'});assert.equal(calls,2);
    await assert.rejects(pool.request('https://vendor.test/api/key'));
  }finally{pool.dispose();}
});

test('request concurrency and pending queue are bounded; disposal stops new work',async()=>{
  let running=0,max=0;
  const pool=createOptionsFlowRequestPool(async()=>{
    running++;max=Math.max(max,running);await new Promise(r=>setTimeout(r,8));running--;
    return new Response('{}');
  });
  const results=await Promise.allSettled(Array.from({length:40},(_,i)=>pool.request('/api/kwanty/snapshot?ticker=SPX&x='+i)));
  assert.ok(max<=4);assert.equal(results.filter(r=>r.status==='fulfilled').length,32);
  assert.equal(results.filter(r=>r.status==='rejected').length,8);
  pool.dispose();await assert.rejects(pool.request('/api/kwanty/status'));
});

test('account pools do not share responses and reference release does not kill another panel',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('{}',{headers:{'Cache-Control':'private, max-age=30'}});};
  const a=acquireOptionsFlowRequests('account-a'),b=acquireOptionsFlowRequests('account-a'),c=acquireOptionsFlowRequests('account-b');
  try{
    await Promise.all([a.request('/api/kwanty/status'),b.request('/api/kwanty/status'),c.request('/api/kwanty/status')]);
    assert.equal(calls,2);a.release();await b.request('/api/kwanty/status');assert.equal(calls,2);
  }finally{a.release();b.release();c.release();globalThis.fetch=original;}
});

test('tool panels reuse real source surfaces and chart Indicators are natively disabled',()=>{
  const shell=read('src/components/KwantifyWorkspace.tsx'),frame=read('src/components/options-flow/OptionsFlowToolPanel.tsx');
  assert.ok(shell.indexOf('Options Flow Tools')>shell.indexOf('Market &amp; Order Flow'));
  assert.match(shell,/activePaneIsChart \? <ChartIndicatorsControl/);
  assert.match(shell,/<button type="button" disabled aria-label="Indicators unavailable/);
  assert.match(shell,/optionsFlowState: normalizeOptionsFlowState/);
  assert.match(frame,/gex-data-app\/index.html/);assert.match(frame,/kwanty-app\/index.html/);
  assert.match(frame,/module.GexBoxToolPanel/);assert.match(frame,/requests.release\(\)/);
  assert.match(frame,/setGeneration\(value => value \+ 1\)/);
  assert.match(frame,/<iframe key=\{generation\}/);
  assert.match(frame,/closed = true; host.active = false/);
  for(const source of ['gex-data','kwanty'])assert.match(read(`public/${source}-app/site-runtime.js`),/__kwantOptionsToolHosts/);
  const box=read('src/components/gexbot/GexBoxDashboard.tsx');
  assert.match(box,/workspaceState=\{state\?\.\["gex-box:flow"\]\}/);
  assert.match(box,/persistedState=\{saved\}/);
  assert.match(box,/"gex-box:calendar": JSON.stringify\(value\)/);
});

test('embedded GEX Flow hydrates before saving and never writes its source workspace settings',()=>{
  const source=read('src/components/gex-flow/GexFlowWorkspace.tsx');
  const start=source.indexOf('export default function GexFlowWorkspace('),end=source.indexOf('\n  const load =',start);
  const code=source.slice(start,end).replace('export default function','function')+'\nreturn {symbol,filters};}\nexports.render=GexFlowWorkspace;';
  const slots=[],queue=[],exports={};let index=0,writes=0;
  const saved=JSON.stringify({symbol:'QQQ',mode:'RAW',screens:[],columns:[],filters:{query:'specific'},activeScreen:'mine'}),changes=[];
  const context={exports,JSON,fetch:()=>{},DEFAULT_FILTERS:{query:''},DEFAULT_COLUMNS:[],BUILT_INS:[],STORAGE_KEY:'source-page',
    localStorage:{getItem(){throw Error('Embedded pane read source-page storage');}},writeProtectedItem(){writes++;},
    acquireOptionsFlowRequests:()=>({request:()=>{},release(){}}),
    useCallback:fn=>fn,
    useRef:initial=>{const i=index++;return slots[i]??= {current:initial};},
    useState:initial=>{const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},
    useEffect:(effect,deps)=>{const i=index++,previous=slots[i];if(!previous||deps.some((v,j)=>v!==previous[j]))queue.push(effect);slots[i]=deps;},
  };
  vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const props={accountKey:'owner',workspaceState:saved,onWorkspaceStateChange:value=>changes.push(JSON.parse(value))};
  exports.render(props);while(queue.length)queue.shift()();
  assert.equal(changes.length,0,'defaults must not overwrite saved state during hydration');
  index=0;exports.render(props);while(queue.length)queue.shift()();
  assert.equal(changes.length,1);assert.equal(changes[0].symbol,'QQQ');assert.equal(changes[0].filters.query,'specific');assert.equal(writes,0);
});
