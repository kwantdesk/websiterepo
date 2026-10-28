import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {mergeLiveIndicatorTail, mergeLiveIndicatorCandle} from '../src/lib/chartLiveEvents.ts';
import {calculateIndicatorSeries} from '../src/lib/chartIndicatorEngine.ts';

const ref=current=>({current});
const start=Date.UTC(2026,9,28,0);
const candle=(offset,ask,bid)=>({timestamp:start+offset*60000,open:100,high:100,low:100,close:100,volume:ask+bid,askVolume:ask,bidVolume:bid,delta:ask-bid,deltaClose:ask-bid});
const source=ts.createSourceFile('Chart.tsx',fs.readFileSync('src/components/Chart.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect;
const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('const historyShapeChanged ='))effect=node.arguments[0];ts.forEachChild(node,visit);};visit(source);assert.ok(effect);
function hydrate(replay=false){
 const stale=[candle(0,10,5),candle(1,1,0)],live=[candle(0,30,5),candle(1,5,9)];
 const context=vm.createContext({candles:stale,pendingIndicatorCandlesRef:ref(stale),isLiveIndicatorBoundaryAppend:()=>false,indicatorCandleSnapshotChanged:()=>false,
 orderFlowHistoryReady:true,sampledOrderFlowHistoryReadyRef:ref(true),sampledIndicatorMarketTradesRef:ref([]),marketTrades:[{timestamp:start}],marketTradesVersion:1,
 orderFlowIndicatorEnabled:true,sampledIndicatorCandlesRef:ref(live),replayTimestampMs:replay?start:null,footprintSamplingEnabled:false,
 pendingIndicatorMarketTradesRef:ref([]),pendingIndicatorMarketTradesVersionRef:ref(0),indicatorSamplingEnabled:true,indicatorSampleTimerRef:ref(null),
 queueChartFrameWork:(_key,fn)=>fn(),chartFrameWorkKey:'pane',liveReplayActiveRef:ref(replay),pendingLiveVolumeCandleRef:ref(live),mergeLiveIndicatorTail,
 setSampledIndicatorCandles:value=>{context.result=value;},setSampledIndicatorMarketTrades:()=>{},setSampledIndicatorMarketTradesVersion:()=>{},});
 vm.runInContext(ts.transpileModule(`(${effect.getText(source)})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return context.result;
}
test('actual tape-hydration effect cannot rewind live CVD while price props await a bar boundary',()=>{
 const result=hydrate();assert.deepEqual(Array.from(result,c=>c.askVolume-c.bidVolume),[25,-4]);
 const [series]=calculateIndicatorSeries({indicatorId:'cumulative-volume-delta',instanceId:'cvd',enabled:true,settings:{}},result,{primary:'#fff',secondary:'#aaa',positive:'#0f0',negative:'#f00',muted:'#888'},{instrument:'NQ',tickSize:.25});
 assert.deepEqual(series.data.map(p=>p.close),[25,21]);
});
test('actual replay hydration never imports the retained live tail',()=>{
 assert.deepEqual(Array.from(hydrate(true),c=>c.askVolume-c.bidVolume),[5,1]);
});
test('tail reconciliation retains older history, updates exact closing buckets and does not invent gaps',()=>{
 const history=[candle(0,10,5),candle(2,1,0)];
 const result=mergeLiveIndicatorTail(history,[candle(0,20,5),candle(1,5,1),candle(2,5,2),candle(3,2,4)]);
 assert.deepEqual(result.map(c=>[c.timestamp,c.askVolume-c.bidVolume]),[[start,15],[start+120000,3],[start+180000,-2]]);
 assert.equal(history[0].askVolume,10);
});
test('a changed delta excursion paints even if final price and side totals match',()=>{
 const before={...candle(0,10,5),deltaHigh:5,deltaLow:0};
 const result=mergeLiveIndicatorCandle([before],{...before,deltaHigh:9,deltaLow:-3});
 assert.equal(result[0].deltaHigh,9);assert.equal(result[0].deltaLow,-3);
});
