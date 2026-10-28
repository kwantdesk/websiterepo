import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {ObservedCandleHistory} from '../src/lib/observedCandleHistory.ts';
import {enqueueLiveCandleSnapshot, mergeLiveIndicatorTail} from '../src/lib/chartLiveEvents.ts';
import {retainFormingCandleExtrema} from '../src/lib/liveCandleAuthority.ts';

const source=ts.createSourceFile('Chart.tsx',fs.readFileSync('src/components/Chart.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect;const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('let pendingCandles: Candle[]'))effect=node.arguments[0];ts.forEachChild(node,visit);};visit(source);assert.ok(effect);
const ref=current=>({current});
const bar=(timestamp,close=100)=>({timestamp,open:100,high:Math.max(100,close),low:Math.min(100,close),close,sourceEndTimestamp:timestamp+100});
function fixture(eventBased=false, studies=false){
  const listeners=new Map(),frames=new Map(),calls=[],timers=new Map();let sequence=0;
  const context=vm.createContext({liveCandleEventKey:'pane',instrument:'NQ',timeframe:eventBased?'500v':'1m',LIVE_CHART_CANDLE_EVENT:'candle',
    liveReplayActiveRef:ref(false),latestDirectLiveCandleRef:ref(null),latestCandleRef:ref(null),
    timeframeToMs:()=>eventBased?null:60000,retainFormingCandleExtrema,enqueueLiveCandleSnapshot,
    observedCandleHistoryRef:ref(new ObservedCandleHistory()),observedCandleScope:'test',
    candleSeriesRef:ref({update:data=>calls.push(data)}),lastRenderedCandleTimeRef:ref(null),lastRenderedSourceTimestampRef:ref(null),
    heikinAshiActiveRef:ref(false),liveFootprintEnabledRef:ref(false),recordChartTickPaint:()=>{},
    eventSourceTimeByChartTimeRef:ref(new Map()),eventChartTimeBySourceTimeRef:ref(new Map()),
    volumeIndicatorEnabled:studies,nonFootprintOrderFlowIndicatorEnabled:studies,liveVolumeSampleTimerRef:ref(null),pendingLiveVolumeCandleRef:ref([]),
    keyboardActive:true,mergeLiveIndicatorTail,startTransition:fn=>fn(),sample:[],setSampledIndicatorCandles:fn=>{context.sample=typeof fn==='function'?fn(context.sample):fn;},
    window:{setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)},
  });
  vm.runInContext(ts.transpileModule(`var cleanup=(${effect.getText(source)})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {context,calls,frames,sample:()=>{const queued=[...timers.values()];timers.clear();for(const fn of queued)fn();return context.sample;},send:(candle,paintInCurrentFrame=false)=>listeners.get('candle')({detail:{key:'pane',candle,paintInCurrentFrame,sourceTimestampMs:candle.sourceEndTimestamp}}),nextFrame:()=>{const queued=[...frames.values()];frames.clear();for(const fn of queued)fn();}};
}
test('a candle prepared in the visible frame updates the actual series without a second frame wait',()=>{
  const f=fixture();f.send(bar(60000,100.25),true);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].close,100.25);assert.equal(f.frames.size,0);
});
test('latest prepared price cancels the queued older paint without shrinking its real high/low',()=>{
  const f=fixture();f.send(bar(60000,101));f.send(bar(60000,99));
  assert.equal(f.calls.length,0);assert.equal(f.frames.size,1);
  f.send(bar(60000,100.25),true);
  assert.equal(f.frames.size,0);assert.equal(f.calls.length,1);
  assert.deepEqual([f.calls[0].open,f.calls[0].high,f.calls[0].low,f.calls[0].close],[100,101,99,100.25]);
  f.nextFrame();assert.equal(f.calls.length,1,'no stale replay remains scheduled');
});
test('a pending real rollover finalizes both bars in the same prepared frame',()=>{
  const f=fixture();f.send(bar(60000,100.5));f.send(bar(120000,100.75),true);
  assert.deepEqual(f.calls.map(c=>[c.time,c.close]),[[60,100.5],[120,100.75]]);
  assert.equal(f.frames.size,0);assert.ok(f.calls.every(c=>c.close/.25===Math.round(c.close/.25)));
});
test('event charts retain their distinct frame queue and replay ignores live prints',()=>{
  const f=fixture(true);f.send(bar(60000),true);assert.equal(f.calls.length,0);assert.equal(f.frames.size,1);
  f.nextFrame();assert.equal(f.calls.length,1);
  f.context.liveReplayActiveRef.current=true;f.send(bar(120000,101),true);assert.equal(f.calls.length,1);assert.equal(f.frames.size,0);
});

const flow=(timestamp,ask,bid)=>({...bar(timestamp),volume:ask+bid,askVolume:ask,bidVolume:bid,delta:ask-bid,deltaClose:ask-bid});
test('actual live CVD sampler retains final closing flow and updates the next candle before any prop commit',()=>{
 const f=fixture(false,true);f.context.sample=[flow(60000,10,5)];
 f.send(flow(60000,30,5),true);f.send(flow(120000,1,4),true);
 assert.deepEqual(Array.from(f.sample(),c=>[c.timestamp,c.askVolume-c.bidVolume]),[[60000,25],[120000,-3]]);
 f.send(flow(120000,9,4),true);
 assert.equal(f.sample().at(-1).deltaClose,5);
 assert.equal(f.context.pendingLiveVolumeCandleRef.current.length,2,'tail survives until hydration uses it');
});
