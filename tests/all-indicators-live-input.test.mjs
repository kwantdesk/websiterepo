import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { mergeLiveIndicatorTail } from '../src/lib/chartLiveEvents.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
const start=Date.UTC(2026,10,5,9),ref=current=>({current});
const candle=(i,close)=>({timestamp:start+i*60000,open:100,high:close,low:99,close,volume:10,askVolume:7,bidVolume:3,delta:4});
const chart=ts.createSourceFile('Chart.tsx',fs.readFileSync('src/components/Chart.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let sampler;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(chart)==='useEffect'&&node.arguments[0]?.getText(chart).includes('const historyShapeChanged ='))sampler=node.arguments[0];ts.forEachChild(node,visit);}visit(chart);assert.ok(sampler);
function sample(indicatorId){
 const history=[candle(0,100),candle(1,100)],live=candle(1,110);let scheduled;
 const context=vm.createContext({candles:history,pendingIndicatorCandlesRef:ref(history),isLiveIndicatorBoundaryAppend:()=>false,indicatorCandleSnapshotChanged:()=>false,
 orderFlowHistoryReady:false,sampledOrderFlowHistoryReadyRef:ref(false),sampledIndicatorMarketTradesRef:ref([]),marketTrades:[],marketTradesVersion:0,
 orderFlowIndicatorEnabled:false,sampledIndicatorCandlesRef:ref(history),replayTimestampMs:null,footprintSamplingEnabled:false,nonFootprintIndicatorSamplingEnabled:true,
 pendingIndicatorMarketTradesRef:ref([]),pendingIndicatorMarketTradesVersionRef:ref(0),indicatorSamplingEnabled:true,indicatorSampleTimerRef:ref(null),
 queueChartFrameWork:(_key,fn)=>fn(),chartFrameWorkKey:'pane',liveReplayActiveRef:ref(false),pendingLiveVolumeCandleRef:ref([live]),mergeLiveIndicatorTail,
 volumeIndicatorEnabled:false,nonFootprintOrderFlowIndicatorEnabled:false,latestCandleRef:ref(live),keyboardActive:true,ORDER_FLOW_DATA_REFRESH_INTERVAL_MS:500,
 startTransition:fn=>fn(),window:{setTimeout:fn=>{scheduled=fn;return 1;}},setSampledIndicatorCandles:value=>{context.result=typeof value==='function'?value(history):value;},
 setSampledIndicatorMarketTrades(){},setSampledIndicatorMarketTradesVersion(){}});
 vm.runInContext(ts.transpileModule('('+sampler.getText(chart)+')();',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);assert.ok(scheduled);scheduled();
 const rows=Array.from(context.result);
 const series=calculateIndicatorSeries({indicatorId,instanceId:indicatorId,enabled:true,settings:{length:2,period:2}},rows,{primary:'#fff',secondary:'#ccc',positive:'#0f0',negative:'#f00',muted:'#888'});
 return {rows,series};
}
test('normal candle studies receive the forming candle even without Volume, CVD or tape consumers',()=>{
 const {rows,series}=sample('moving-average');assert.equal(rows.at(-1).close,110);assert.ok(series.length);assert.equal(series[0].data.at(-1).value,105);
});
test('canonical execution event publishes for CVD/Delta-only panes without Footprint or Big Contracts',()=>{
 const source=ts.createSourceFile('Workspace.tsx',fs.readFileSync('src/components/KwantifyWorkspace.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let publish;
 function find(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='publishExecutions')publish=node.initializer;ts.forEachChild(node,find);}find(source);assert.ok(publish);
 const events=[],bars=[candle(0,100)],records=[{timestamp:start+1000,volume:4,askVolume:4,bidVolume:0}],tape=records;
 const context={needsOrderFlowHistory:true,footprintLiveActive:false,instantTapeLiveActive:false,auctionGapLiveActive:false,bigContractsLiveActive:false,
 window:{dispatchEvent:e=>events.push(e)},CustomEvent, LIVE_CHART_EXECUTION_EVENT:'executions',pane:{id:'nq'},records,latestMarketTradesRef:ref(tape),latestCandlesRef:ref(bars),executionContinuityRef:ref('continuous')};
 vm.runInNewContext(ts.transpileModule('('+publish.getText(source)+')();',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 assert.equal(events.length,1);assert.equal(events[0].detail.records,records);assert.equal(events[0].detail.candles,bars);assert.equal(events[0].detail.tape,tape);
 context.needsOrderFlowHistory=false;vm.runInNewContext(ts.transpileModule('('+publish.getText(source)+')();',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);assert.equal(events.length,1);
});
