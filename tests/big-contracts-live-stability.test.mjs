import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import test from 'node:test';
import { admitLiveBigTradePrints, calculateBigTradePrintsWithContext, mergeBigTradeLiveMarkers, anchorBigTradePrintsToCandles } from '../src/lib/bigTrades.ts';
const now=Date.UTC(2026,9,27,3);
const trade=(id,timestamp,volume,extra={})=>({eventId:id,recordIndex:timestamp,timestamp,open:20000,high:20000,low:20000,close:20000,trades:1,volume,askVolume:volume,bidVolume:0,delta:volume,aggressor:'BUY',...extra});
const settings={filterMode:'manual',manualFilter:50,enableClustering:false,sessionFilterEnabled:false};
const context=()=>calculateBigTradePrintsWithContext([],[trade('seed',now,1)],settings,now).context;
test('50-contract live filter rejects flow summaries and unknown aggressors just like full refresh',()=>{
 const tape=[trade('small',now+1,49),trade('summary',now+2,1000,{flowOnly:true}),trade('unknown',now+3,500,{aggressor:'UNKNOWN'})];
 assert.deepEqual(calculateBigTradePrintsWithContext([],tape,settings,now+3).prints,[]);
 assert.deepEqual(admitLiveBigTradePrints(context(),tape,now),[]);
});
test('qualifying live executions retain the same identity when the full calculation replaces them',()=>{
 const tape=[trade('exactly-50',now+1,50),trade('above-50',now+2,60)];
 const live=admitLiveBigTradePrints(context(),tape,now);
 const full=calculateBigTradePrintsWithContext([],tape,settings,now+2).prints;
 assert.deepEqual(live.map(p=>p.id),full.map(p=>p.id));
 assert.deepEqual(live.map(p=>p.volume),[50,60]);
});

test('live refresh deduplicates exact prints and respects the sampled per-bar limit',()=>{
 const base=[{id:'old',time:100,volume:50},{id:'other',time:200,volume:80}];
 const fresh=[{id:'old',time:100,volume:50},{id:'new',time:100,volume:60}];
 const live=mergeBigTradeLiveMarkers(base,fresh,1);
 assert.deepEqual(live.map(p=>p.id),['new','other']);
 assert.deepEqual(mergeBigTradeLiveMarkers(live,fresh,1),live);
});
test('50-contract live marker stays on the same minute before and after sampling',()=>{
 const tape=[trade('large',now+45000,50)];
 const candle={timestamp:now,open:20000,high:20001,low:19999,close:20000,volume:50};
 const live=admitLiveBigTradePrints(context(),tape,now);
 const full=calculateBigTradePrintsWithContext([],tape,settings,now+45000).prints;
 assert.equal(anchorBigTradePrintsToCandles(live,[candle],60000)[0].chartTimestamp,now);
 assert.equal(anchorBigTradePrintsToCandles(full,[candle],60000)[0].chartTimestamp,now);
});

test('actual chart live handler preserves a 50-contract marker through sampled replacement',()=>{
 const source=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
 const start=source.indexOf('    const receive = (event: Event) => {',source.indexOf('const anchoredBigTradePrints ='));
 const end=source.indexOf('    window.addEventListener(LIVE_CHART_EXECUTION_EVENT',start);
 assert.ok(start>0&&end>start);
 const js=ts.transpileModule(source.slice(start,end)+';globalThis.receive=receive;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const tape=[trade('summary',now+1000,500,{flowOnly:true}),trade('real',now+2000,50),trade('unclassified',now+3000,500,{aggressor:'UNKNOWN'})];
 let drawn=[];
 const runtime={liveCandleEventKey:'pane',liveReplayActiveRef:{current:false},bigTradesPrimitiveRef:{current:{update:markers=>drawn=markers}},bigTradeLiveContextRef:{current:context()},bigTradePrimitiveOptionsRef:{current:{}},bigTradeCommittedRef:{current:{watermark:now,markers:[]}},admitLiveBigTradePrints,anchorBigTradePrintsToCandles,mergeBigTradeLiveMarkers,timeframe:'1m',candleIntervalMs:60000,isEventBasedChartInterval:()=>false,sampledIndicatorCandlesRef:{current:[{timestamp:now,open:20000,high:20001,low:19999,close:20000,volume:1}]},eventChartTimeBySourceTimeRef:{current:new Map()},bigTradesIndicator:{settings:{maxMarkersPerBar:50}}};
 vm.createContext(runtime);vm.runInContext(js,runtime);runtime.receive({detail:{key:'pane',tape}});
 assert.equal(drawn.length,1);assert.equal(drawn[0].id,'real');assert.equal(drawn[0].time,now/1000);assert.equal(drawn[0].volume,50);
 const full=calculateBigTradePrintsWithContext([],tape,settings,now+3000).prints;
 assert.deepEqual(drawn.map(p=>p.id),full.map(p=>p.id));
});
