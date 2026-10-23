import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {profileHistoryRecords} from '../public/kwanty-app/models.js';
import {createStateSources} from '../public/kwanty-app/state-sources.js';

const app=readFileSync(new URL('../public/kwanty-app/app.js',import.meta.url),'utf8');
const date='2026-10-21',timestamp=Date.parse(date+'T15:00:00Z')/1000;
const selection={ticker:'SPX',package:'classic',category:'gex_full',date};
const row={ticker:'SPX',category:'gex_full',timestamp,spot:7750};
test('Classic history rejects wrong metadata, categories and every wrong-day row before latest-session pruning',()=>{
 assert.deepEqual(profileHistoryRecords({data:[row]},selection),[row]);
 for(const [key,value]of Object.entries({ticker:'QQQ',package:'state',category:'gex_zero',sessionDate:'2026-10-22'}))assert.throws(()=>profileHistoryRecords({[key]:value,data:[row]},selection),/MISMATCH/);
 assert.throws(()=>profileHistoryRecords({data:[{...row,ticker:'QQQ'}]},selection),/INSTRUMENT_MISMATCH/);
 assert.throws(()=>profileHistoryRecords({data:[{...row,category:'gamma_zero'}]},selection),/PROFILE_DATA_MISMATCH/);
 // mergeSnapshots alone would hide the first row, making this look valid.
 assert.throws(()=>profileHistoryRecords({data:[{...row,timestamp:timestamp-86400},row]},selection),/HISTORY_SESSION_MISMATCH/);
 assert.throws(()=>profileHistoryRecords({data:[{...row,timestamp:null}]},selection),/HISTORY_SESSION_MISMATCH/);
 assert.throws(()=>profileHistoryRecords({data:[]},selection),/NO_HISTORY_SNAPSHOTS/);
});
test('State source uses the same pre-merge session guard and never publishes mixed-day profiles',async()=>{
 const panel={ticker:'SPX',greek:'gamma',greekExpiry:'zero'},rows=[{...row,category:'gamma_zero',timestamp:timestamp-86400},{...row,category:'gamma_zero'}];
 const source=createStateSources({api:async()=>({data:rows}),onChange(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
 source.reconcile([panel],{active:true,date,live:false});await source.refresh();
 assert.equal(source.get(panel).error,'HISTORY_SESSION_MISMATCH');assert.deepEqual(source.get(panel).records,[]);source.dispose();
});
test('actual priceState uses each target panel payload, not active-panel price cutoff in replay',()=>{
 for(const pkg of ['state','orderflow'])for(const activeTime of [100,150]){
  const a={id:'a',ticker:'SPX',timestamp:activeTime},b={id:'b',ticker:'QQQ',timestamp:250-activeTime};let cutoff;
  const owner={snapshot:(interval,options)=>(cutoff=options.cutoffTime,{candles:[],points:[]})};
  const context={state:{package:pkg,historyMode:date,replayIndex:1},activePanel:()=>a,selectedPayload:panel=>panel||a,panelTicker:panel=>panel.ticker,stateSources:{prices:()=>owner},orderSources:{get:()=>({prices:owner})},candleIntervalFor:()=>60000,settings:()=>({})};
  vm.runInNewContext(app.slice(app.indexOf('function priceState('),app.indexOf('function syncActiveChartControls(')),context);
  context.priceState(b);assert.equal(cutoff,b.timestamp*1000,`${pkg} target owns its observation cutoff`);
 }
});
test('actual Classic load handler admits only the validated requested selection',()=>{
 const handler=app.slice(app.indexOf("$('#loadHistory').addEventListener('click',async"),app.indexOf('mountSettingsEditor('));
 assert.match(handler,/profileHistoryRecords\(envelope,\{ticker:state.ticker,package:'classic',category:category\(\),date\}\)/);
});
test('Orderflow playback waits for enabled exact profile pages and stops on a real page error',()=>{
 let status={pending:true,error:null},stops=0,messages=0,calls=0;
 const state={package:'orderflow',records:[{timestamp:123}]},chart={panel:{id:'one'}};
 const context={state,charts:[chart],overlays:{frameReady:(panel,time)=>{calls++;assert.equal(panel,chart.panel);assert.equal(time,123);return status;}},stopReplay:()=>stops++,message:()=>messages++};
 vm.runInNewContext(app.slice(app.indexOf('function replayFrameReady('),app.indexOf("$('#loadHistory').addEventListener('click',()=>profileReplay.retry()")),context);
 assert.equal(context.replayFrameReady(0),false);assert.equal(stops,0);
 status={pending:false,error:null};assert.equal(context.replayFrameReady(0),true);
 status={pending:false,error:'PROFILE_REPLAY_UNAVAILABLE'};assert.equal(context.replayFrameReady(0),false);assert.equal(stops,1);assert.equal(messages,1);assert.equal(calls,3);
});
test('profile history arrays retain identity across pointer paints, but invalidate at replay/source changes',()=>{
 const chart={panel:{}},rows=[{timestamp:100,zero_gamma:5,major_pos_vol:6,major_neg_vol:4}],state={package:'classic',replayIndex:null,records:rows};
 const context={state};vm.runInNewContext(app.slice(app.indexOf('function majorHistoryFor('),app.indexOf('function paintStateChart(')),context);
 const initial=context.majorHistoryFor(chart,rows);assert.equal(context.majorHistoryFor(chart,rows.slice()),initial);
 state.replayIndex=0;const replay=context.majorHistoryFor(chart,rows);assert.notEqual(replay,initial);assert.equal(context.majorHistoryFor(chart,rows.slice()),replay);
 state.records=rows.slice();assert.notEqual(context.majorHistoryFor(chart,rows),replay);
});
