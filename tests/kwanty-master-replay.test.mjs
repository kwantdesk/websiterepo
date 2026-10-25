import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createReplayPrefixReader} from '../public/kwanty-app/replay-cursor.js';
import {createPriceSeries} from '../public/kwanty-app/price-series.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const app=read('public/kwanty-app/app.js');
const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));

test('whole-session replay prefix is causal, reversible, stable and logarithmic',()=>{
 let reads=0;const rows=Array.from({length:23400},(_,i)=>({get timestamp(){reads++;return 1000+i;}}));
 const prefix=createReplayPrefixReader();
 assert.equal(prefix(rows,999000).length,0);
 reads=0;const first=prefix(rows,1100250);assert.equal(first.length,101);assert.ok(reads<=16);
 assert.equal(prefix(rows,1100999),first,'100ms frames reuse the unchanged observation prefix');
 assert.equal(prefix(rows,1101000).length,102);assert.equal(prefix(rows,1000000).length,1);
 assert.equal(prefix(rows,Infinity).length,0);assert.equal(prefix(rows,24400000),rows);
});

for(const pkg of ['classic','state','orderflow'])test(`${pkg}: actual selectors never leak later observations or another panel's ticker`,()=>{
 const a={id:'a',ticker:'SPX'},b={id:'b',ticker:'QQQ'};
 const rows=ticker=>[100,102,104].map(timestamp=>({ticker,timestamp}));
 const sources=new Map([[a,{records:rows('SPX'),envelope:{}}],[b,{records:rows('QQQ'),envelope:{}}]]);
 let ready=true,error=false;const prefix=createReplayPrefixReader();
 const context={masterReplay:{timestampMs:102000},state:{package:pkg,records:sources.get(a).records,replayIndex:null,envelope:{},payload:{timestamp:999,ticker:'WRONG'}},
  activeStatePanel:()=>a,beforeMaster:rows=>prefix(rows,context.masterReplay.timestampMs),panelTicker:p=>p.ticker,
  stateSources:{get:p=>sources.get(p)},orderSources:{get:ticker=>sources.get(ticker==='SPX'?a:b)},
  profileReplay:{select:(_,row)=>row,ready:()=>ready,error:()=>error}};
 vm.runInNewContext(extract('function stateRecords(','function syncStatePanel(')+extract('function currentRecords(','async function restoreOrderflowSession('),context);
 assert.equal(context.selectedPayload(pkg==='classic'?null:b).timestamp,102);
 if(pkg!=='classic')assert.equal(context.selectedPayload(b).ticker,'QQQ');
 context.masterReplay.timestampMs=99000;assert.equal(context.selectedPayload(b),null,'no future first snapshot');
 context.masterReplay.timestampMs=104000;assert.equal(context.selectedPayload(b).timestamp,104);
 context.masterReplay.timestampMs=100000;assert.equal(context.selectedPayload(b).timestamp,100,'rewind clears future');
 if(pkg!=='orderflow'){ready=false;assert.equal(context.selectedPayload(b),null,'manifest placeholder cannot masquerade as a loaded profile');ready=true;error=true;assert.equal(context.selectedPayload(b),null);}
});

for(const pkg of ['classic','state','orderflow'])test(`${pkg}: shared playback buffers all panels and rejects page failures`,()=>{
 const panels=[{id:'a',ticker:'SPX'},{id:'b',ticker:'QQQ'}],posted=[],rows=[{timestamp:100}];
 const sources=new Map(panels.map(panel=>[panel,{records:rows,envelope:{},error:null}]));
 let pageReady=true,pageError=false,overlayPending=false,overlayError=null,loading=false;
 const context={masterReplay:{sessionDate:'2026-10-23',timestampMs:100000},masterReplayLoading:false,masterBootReady:true,masterReplayError:null,
  state:{package:pkg,statePanels:panels,panels,records:rows,envelope:{},historyError:null,sourceError:null},
  stateSources:{get:p=>sources.get(p)},orderSources:{get:ticker=>sources.get(panels.find(p=>p.ticker===ticker))},panelTicker:p=>p.ticker,
  priceState:()=>({loading}),beforeMaster:rows=>rows.filter(r=>r.timestamp*1000<=context.masterReplay.timestampMs),
  profileReplay:{select(){},ready:()=>pageReady,error:()=>pageError},overlays:{frameReady:()=>({pending:overlayPending,error:overlayError})},
  $:()=>({}),parent:{postMessage:value=>posted.push(value)},location:{origin:'https://fixture.invalid'},candleIntervalFor:()=>180000,activePanel:()=>panels[0],settings:()=>({})};
 vm.runInNewContext(extract('function reportMasterReplayStatus(','async function applyMasterReplay('),context);
 const report=()=>{context.reportMasterReplayStatus();return posted.at(-1);};
 assert.equal(report().ready,true);assert.equal(report().stepMs,180000);
 loading=true;assert.equal(report().ready,false);loading=false;
 if(pkg==='orderflow'){overlayPending=true;assert.equal(report().ready,false);overlayPending=false;overlayError='EXACT_PAGE_MISSING';assert.equal(report().ready,false);overlayError=null;}
 else{pageReady=false;assert.equal(report().ready,false);pageReady=true;pageError=true;assert.equal(report().ready,false);pageError=false;}
 if(pkg!=='classic'){sources.get(panels[1]).error='OTHER_TICKER_UNAVAILABLE';assert.equal(report().ready,false);sources.get(panels[1]).error=null;}
 context.masterReplay.timestampMs=99000;assert.equal(report().ready,true,'real pre-observation gap does not borrow a future row');
 context.state.historyError='WRONG_SESSION';assert.equal(report().ready,false);
});

test('Classic stale date responses cannot overwrite a newer master selection or exit-to-live',async()=>{
 const jobs=[],nodes=new Map(),context={masterReplay:{sessionDate:'2026-10-22',timestampMs:100000},masterBootReady:true,masterReplayKey:null,masterReplaySerial:0,
  masterReplayLoading:false,masterReplayError:null,state:{package:'classic',ticker:'SPX'},views:new Map(),AbortController,
  masterSelectionKey:()=>context.masterReplay?.sessionDate,query:()=>new URLSearchParams(),category:()=> 'gex_full',
  api:()=>new Promise(resolve=>jobs.push(resolve)),profileHistoryRecords:e=>e.data,
  $:key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);}};
 for(const key of ['invalidateRequests','stopReplay','syncPrices','renderChartEmpty','drawAll','reportMasterReplayStatus','syncShell','renderSummary','syncTimeline'])context[key]=()=>{};
 vm.runInNewContext(extract('async function applyMasterReplay(',"window.addEventListener('message',event=>"),context);
 const first=context.applyMasterReplay();context.masterReplay={sessionDate:'2026-10-23',timestampMs:100000};const second=context.applyMasterReplay();
 jobs[1]({data:[{timestamp:200,ticker:'SPX'}]});await second;
 jobs[0]({data:[{timestamp:999,ticker:'SPX'}]});await first;assert.equal(context.state.records[0].timestamp,200);assert.equal(context.state.historyMode,'2026-10-23');
 context.masterReplay={sessionDate:'2026-10-21',timestampMs:100000};const third=context.applyMasterReplay();
 context.masterReplay=null;context.masterReplaySerial++;context.state.records=[{timestamp:300}];context.state.historyMode=false;
 jobs[2]({data:[{timestamp:888}]});await third;assert.equal(context.state.records[0].timestamp,300);assert.equal(context.state.historyMode,false);
});

test('price cache changes only at revealed authoritative observations, without final-minute OHLC lookahead',()=>{
 const series=createPriceSeries(),time=Date.UTC(2026,9,23,14);
 series.reset({symbol:'SPX'});series.seed([{time,open:100,high:110,low:90,close:105},{time:time+60000,open:105,high:120,low:95,close:115}],{symbol:'SPX',asOf:time+120000});
 assert.equal(series.candles(60000,{cutoffTime:time+59999}).length,0);
 assert.equal(series.candles(60000,{cutoffTime:time+60000}).length,1);
 assert.equal(series.replayCacheKey(time+60100),series.replayCacheKey(time+60900));
 assert.notEqual(series.replayCacheKey(time+59999),series.replayCacheKey(time+60000));
});

test('standalone replay uses Charts dialog/transport and has no visible right-panel playback controls',()=>{
 const html=read('public/kwanty-app/index.html'),workspace=read('src/components/KwantifyWorkspace.tsx'),host=read('src/components/kwanty/KwantyWorkspace.tsx');
 const aside=html.slice(html.indexOf('<aside'),html.indexOf('</aside>'));
 assert.doesNotMatch(aside,/loadHistory|playbar|historyDate|replaySpeed/);
 assert.match(html,/<nav[^>]*>[\s\S]*id="workspaceReplay"/);assert.match(html,/id="legacyReplayControls" hidden inert aria-hidden="true"/);
 assert.match(workspace,/bottomWorkspaceSection === "kwanty" \? <WorkspaceReplayDialog/);
 assert.match(workspace,/bottomWorkspaceSection === "kwanty" \? renderReplayTransport\(\)/);
 assert.match(host,/event\.origin !== location\.origin \|\| event\.source !== frame\.current\?\.contentWindow/);
 assert.match(host,/event\.data\.timestampMs === replayRef\.current\.timestampMs/);
 assert.doesNotMatch(host,/AbortSignal\.any/,'one stale caller cannot abort another coalesced consumer');
 assert.match(app,/masterReplaySerial\+\+;masterReplayKey=null/);
});
