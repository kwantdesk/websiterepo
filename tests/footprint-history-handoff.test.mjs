import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFootprintBarsCached} from '../src/lib/footprint.ts';
import {mergeFootprintHistoryRecords} from '../src/lib/footprintHistoryMerge.ts';
const step=60000,start=1793070000000;
const candle=n=>({timestamp:start+n*step});
const row=(id,n,summary=false)=>({eventId:id,timestamp:start+n*step+100,close:20000,volume:10,flowOnly:summary,...(summary?{footprintSummary:{minimumTradeVolume:0,maximumTradeVolume:0}}:{})});
test('initial footprint keeps available execution rows while exact history is loading',()=>{
 const tape=[row('a',0),row('b',1)];
 assert.deepEqual(mergeFootprintHistoryRecords([],tape,[candle(0),candle(1)],step),tape);
});
test('new candle cannot drop the just-closed footprint before exact history returns',()=>{
 const exact=[row('exact0',0,true)],tape=[row('raw0',0),row('just-closed',1),row('forming',2)];
 const next=mergeFootprintHistoryRecords(exact,tape,[candle(0),candle(1),candle(2)],step);
 assert.deepEqual(next.map(r=>r.eventId),['exact0','just-closed','forming']);
});
test('exact closed rows survive every live update without being replaced by compacted tape',()=>{
 const exact=[row('exact-price-a',0,true),{...row('exact-price-b',0,true),timestamp:start+200,close:20001}];
 for(let i=0;i<30;i++){
 const merged=mergeFootprintHistoryRecords(exact,[row('compacted',0),row('forming',1)],[candle(0),candle(1)],step);
 assert.deepEqual(merged.slice(0,2),exact);assert.equal(merged.length,3);
 }
});
test('late exact rows replace only their own bucket once, with no double counting',()=>{
 const tape=[row('raw0',0),row('raw1',1),row('raw2',2)];
 const merged=mergeFootprintHistoryRecords([row('exact1',1,true)],tape,[candle(0),candle(1),candle(2)],step);
 assert.deepEqual(merged.map(r=>r.eventId),['raw0','exact1','raw2']);
 assert.deepEqual(mergeFootprintHistoryRecords([],tape,[candle(1)],step).map(r=>r.eventId),['raw1']);
});

test('actual footprint cache preserves exact price rows across repeated live/history paints and candle rollover',()=>{
 const clock=Date.now;let now=start+step;Date.now=()=>now;
 try {
 const candles=[0,1,2].map(n=>({timestamp:start+n*step,open:20000,high:20002,low:19999,close:20000,volume:20}));
 const exact=[{...row('a',0,true),bidVolume:10,askVolume:0,trades:1},{...row('b',0,true),close:20001,bidVolume:0,askVolume:10,trades:1,timestamp:start+200}];
 const tape=[{...row('compacted',0),bidVolume:10,askVolume:0,trades:1},{...row('closing',1),askVolume:10,trades:1},{...row('active',2),askVolume:10,trades:1}];
 const settings={tickSize:0.25,groupTicks:1,minimumTradeVolume:0,maximumTradeVolume:0,imbalanceMode:'diagonal',minimumImbalancePercent:300,minimumDelta:0,includeZero:false};
 const cache={current:null};
 const initial=buildFootprintBarsCached(cache,candles.slice(0,2),mergeFootprintHistoryRecords(exact,tape,candles.slice(0,2),step),settings);
 assert.equal(initial[0].rows.length,2);
 for(let i=0;i<20;i++){
 now+=2000;
 const bars=buildFootprintBarsCached(cache,candles,mergeFootprintHistoryRecords(exact,tape,candles,step),settings);
 assert.deepEqual(bars[0].rows,initial[0].rows);assert.equal(bars[1].rows.length,1,'just-closed tape remains while exact request is pending');
 }
 }finally{Date.now=clock;}
});

test('actual cold-open loading gate runs once and stays off at later candle boundaries',()=>{
 const chart=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
 const begin=chart.indexOf('  const footprintInitialHistoryScope =');
 const end=chart.indexOf('  const exactFootprintHistoryRef',begin);
 assert.ok(begin>0&&end>begin);
 const body=ts.transpileModule(chart.slice(begin,end)+';globalThis.waiting=footprintAwaitInitialHistory;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const ref={current:null};
 const render=(history,contract='NQZ6')=>{
 const effects=[];const runtime={instrument:'NQ',timeframe:'3m',contractSymbol:contract,footprintIndicator:{},exactFootprintHistory:history,useRef:()=>ref,useEffect:fn=>effects.push(fn)};
 vm.runInNewContext(body,runtime);effects.forEach(fn=>fn());return runtime.waiting;
 };
 assert.equal(render({active:false,pending:false}),false);
 assert.equal(render({active:true,pending:true}),true);
 assert.equal(render({active:true,pending:false}),false);
 for(let i=0;i<10;i++)assert.equal(render({active:true,pending:true}),false,'new-bar history requests must not reopen the loader');
 assert.equal(render({active:true,pending:true},'NQH7'),true,'a new contract requires its own initial history');
});
