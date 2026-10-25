import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHART_INDICATOR_CATALOG } from '../src/lib/chartIndicatorCatalog.ts';
import { defaultIndicatorSettings } from '../src/lib/chartIndicatorConfig.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import { replaySafeIndicators, replayCausalCandles, replayCausalTrades, replayRetentionMustReset, REPLAY_UNAVAILABLE_INDICATORS } from '../src/lib/replayIndicatorSafety.ts';
import { replayProfileWithinClock } from '../src/lib/replayVolumeProfiles.ts';
import { buildVixEnvironmentSnapshot } from '../src/lib/vixEnvironment.ts';
import { paintZeroGammaLineOnBars } from '../src/lib/zeroGammaLine.ts';
import { causalArrayView } from '../src/lib/causalArrayView.ts';
import { runStrategyCode } from '../src/lib/backtester.ts';
import ts from 'typescript';
import { buildFootprintBars, buildFootprintBarsCached } from '../src/lib/footprint.ts';
import { replayFrameIsVisible } from '../src/lib/useReplayFrameState.ts';
import { buildGexIntervalMapSnapshot } from '../src/lib/gexIntervalMap.ts';
import { buildOptionsSurfaceNetSeries } from '../src/lib/optionsDelta.ts';
import vm from 'node:vm';

const theme = { primary:'#fff',secondary:'#aaa',positive:'#0f0',negative:'#f00',muted:'#888' };
const start = Date.parse('2026-10-23T09:00Z');
const candles = Array.from({length:360},(_,i)=>({timestamp:start+i*60_000,open:20000+i,high:20005+i,low:19995+i,close:20001+i,volume:100+i,bidVolume:40,askVolume:60+i,delta:20+i,trades:10}));
const count=300, prefix=candles.slice(0,count), clock=prefix.at(-1).timestamp;
const poisoned=[...prefix,...candles.slice(count).map(c=>({...c,close:1e9,high:1e10,volume:1e12,askVolume:1e12,delta:1e12}))];

test('catalogue inventory is explicit; new indicators require another causality audit',()=>assert.equal(CHART_INDICATOR_CATALOG.length,127));
for(const definition of CHART_INDICATOR_CATALOG){
  test(`${definition.id}: future-tail poisoning and rewind prefix are isolated`,()=>{
    const instance={instanceId:definition.id,indicatorId:definition.id,enabled:true,settings:{...defaultIndicatorSettings(definition.id),...(definition.id==='source-code-indicator'?{source:'//@version=6\nindicator("Causal source",overlay=true)\nplot(ta.sma(close,5))',sourceLanguage:'pine'}:{})}};
    const safe=replaySafeIndicators([instance],clock)[0];
    if(REPLAY_UNAVAILABLE_INDICATORS.has(definition.id)){
      assert.equal(safe.enabled,false);
      assert.deepEqual(calculateIndicatorSeries(instance,poisoned,theme,{instrument:'NQ',tickSize:.25,replayTimestampMs:clock}),[]);
    } else {
      assert.equal(safe.enabled,true);
      const context={instrument:'NQ',tickSize:.25,replayTimestampMs:clock};
      const expected=calculateIndicatorSeries(instance,prefix,theme,context);
      const actual=calculateIndicatorSeries(instance,poisoned,theme,context);
      assert.deepEqual(actual,expected);
      for(const series of actual){
        assert.ok(series.data.every(p=>p.time<=clock/1000));
        assert.ok((series.ichimokuCloud?.points??[]).every(p=>p.time<=clock/1000));
      }
      const earlier=prefix.slice(0,200),earlierClock=earlier.at(-1).timestamp;
      assert.deepEqual(calculateIndicatorSeries(instance,poisoned,theme,{...context,replayTimestampMs:earlierClock}),calculateIndicatorSeries(instance,earlier,theme,{...context,replayTimestampMs:earlierClock}));
    }
    assert.equal(replaySafeIndicators([instance],null)[0],instance,'live setting is unchanged');
  });
}

test('same timestamp future samplers cannot override current replay props; aggregate reductions are excluded',()=>{
  assert.deepEqual(replayCausalCandles(poisoned,clock),prefix);
  const exact={timestamp:clock,close:100};
  assert.deepEqual(replayCausalTrades([exact,{...exact,timestamp:clock+1},{...exact,flowOnly:true},{...exact,footprintSummary:{}}],clock),[exact]);
  const source=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
  assert.match(source,/replayTimestampMs == null \? storedIndicatorCandles : replayCausalCandles\(candles, replayTimestampMs\)/);
  assert.match(source,/replayTimestampMs != null && requiresFullScan \? \[\] : retainedBigTradePrintsRef.current/);
  assert.match(source,/replayTimestampMs != null && requiresFullScan \? \[\] : retainedDeepContractsRef.current/);
  assert.doesNotMatch(source,/Math.ceil\(replayTimestampMs \/ intervalMs\)/);
  assert.match(source,/bucket.timestamp \+ \(timeframeToMs\(gexIntervalSurface.aggregationPeriod\)/);
});

test('block-trade retention resets on entering replay or rewinding, not every forward tick',()=>{
  assert.equal(replayRetentionMustReset(null,1000),true);
  assert.equal(replayRetentionMustReset(2000,1000),true);
  assert.equal(replayRetentionMustReset(1000,2000),false);
  assert.equal(replayRetentionMustReset(1000,1000),false);
  assert.equal(replayRetentionMustReset(2000,null),false);
});

test('volume profiles have zero future tolerance, including a one millisecond leak',()=>{
  assert.equal(replayProfileWithinClock({coverageEndMs:clock},clock),true);
  for(const future of [1,1000,60_000,3_600_000])assert.equal(replayProfileWithinClock({coverageEndMs:clock+future},clock),false);
  assert.equal(replayProfileWithinClock(null,clock),false);
});

test('VIX replay ignores same-day final OHLC and retained live state',()=>{
  const day=Date.parse('2026-10-23T00:00Z'),asOfMs=day+15*3_600_000;
  const row={timestamp:day-86_400_000,open:19,high:22,low:18,close:20};
  const baseline=buildVixEnvironmentSnapshot({symbol:'VIX',history:[row],live:null,asOfMs,replay:true});
  const actual=buildVixEnvironmentSnapshot({symbol:'VIX',history:[row,{...row,timestamp:day,high:999,close:999}],live:{timestamp:asOfMs,lastPrice:999,openPrice:999,change:999},asOfMs,replay:true});
  assert.deepEqual(actual,baseline);assert.equal(actual.value,20);
});

test('Zero Gamma cannot interpolate toward a later observation, even within the forming bar',()=>{
  const time=Date.parse('2026-10-23T13:30Z');
  const point={timestampMs:time,sessionDate:'2026-10-23',value:100,status:'HISTORICAL'};
  const points=[point,{...point,timestampMs:time+4*60_000,value:999}];
  const before=paintZeroGammaLineOnBars(points,[time/1000],300,[time/1000],time+30_000);
  assert.deepEqual(before,[],'the first historical minute has not closed');
  assert.deepEqual(paintZeroGammaLineOnBars(points,[time/1000],300,[time/1000],time+90_000),[{time:time/1000,value:100}]);
});

test('strategy history and all array access forms stop at the simulated bar',()=>{
  let length=2;const input=[10,20,999];const view=causalArrayView(input,()=>length);
  assert.equal(view.length,2);assert.equal(view[2],undefined);assert.equal(view.at(-1),20);
  assert.deepEqual([...view],[10,20]);assert.deepEqual(view.slice(),[10,20]);
  assert.equal(2 in view,false);assert.deepEqual(Object.keys(view),['0','1']);
  assert.equal(Object.getOwnPropertyDescriptor(view,'2'),undefined);
  assert.throws(()=>view.push(100),/read-only/);
  length=1;assert.deepEqual([...view],[10]);length=3;assert.deepEqual([...view],input);
});

test('actual backtester never hands strategy code a future candle or indicator value',()=>{
  const result=runStrategyCode(candles,`function strategy(candles,index,indicators) {
    if(candles.length!==index+1 || candles[index+1]!==undefined || candles.at(-1)!==candles[index]) throw new Error("Future candle exposed");
    if(indicators.ema20.length!==index+1 || indicators.ema20[index+1]!==undefined) throw new Error("Future EMA exposed");
    return null;
  }`,{initialBalance:10000,maxPositions:1,broker:{spread:0,slippage:0,commission:0}});
  assert.equal(result.error,null);
});

test('actual Backtesting candle adapter waits for second close and never borrows an unopened bar',()=>{
  const source=fs.readFileSync(new URL('../src/components/backtesting/BacktestingWorkspace.tsx',import.meta.url),'utf8');
  const snippet=source.slice(source.indexOf('function firstCandleAtOrAfter('),source.indexOf('function replayExecutionTrades('));
  const adapter=new Function('replayIntervalMs',ts.transpileModule(snippet,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return historicalCandlesAtClock;')(timeframe=>timeframe==='1m'?60000:timeframe==='1D'?86400000:null);
  const at=Date.parse('2026-10-23T14:00Z');
  const minute={timestamp:at,open:100,high:999,low:1,close:999,volume:999};
  const seconds=[{timestamp:at,open:100,high:101,low:99,close:101,volume:1},{timestamp:at+1000,open:101,high:999,low:1,close:999,volume:999}];
  assert.deepEqual(adapter([minute],seconds,'1m',at),[]);
  const partial=adapter([minute],seconds,'1m',at+1000);
  assert.equal(partial[0].high,101);assert.equal(partial[0].volume,1);
  assert.deepEqual(adapter([minute],[],'1m',at+2000),[]);
  assert.deepEqual(adapter([{...minute,sourceEndTimestamp:at+5000}],[],'500v',at+1000),[]);
  assert.deepEqual(adapter([minute],[],'500v',at+1000),[]);
  const dailyOpen=Date.parse('2026-10-22T22:00Z');
  assert.deepEqual(adapter([{...minute,timestamp:dailyOpen}],[],'1D',at),[], 'CME daily OHLC is not completed merely because UTC midnight passed');
  const workspace=fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
  assert.match(workspace,/const bucketStart = last.timestamp;/);
});

test('Footprint/cache foundation used by order-flow studies rewinds to the same exact prefix',()=>{
  const at=Date.parse('2026-10-23T14:00Z');
  const candle={timestamp:at,open:100,high:100,low:100,close:100,volume:1,bidVolume:0,askVolume:1,delta:1};
  const trade={timestamp:at,open:100,high:100,low:100,close:100,volume:1,bidVolume:0,askVolume:1,delta:1,trades:1,aggressor:'BUY',recordIndex:1};
  const settings={tickSize:1,groupTicks:1,minimumTradeVolume:0,maximumTradeVolume:0,imbalanceMode:'diagonal',minimumImbalancePercent:300,minimumDelta:0,includeZero:true,instrument:'NQ'};
  const cache={current:null};
  buildFootprintBarsCached(cache,[{...candle,volume:101,askVolume:101,delta:101}],[trade,{...trade,timestamp:at+5000,volume:100,askVolume:100,recordIndex:2}],settings);
  const early=replayCausalTrades([trade,{...trade,timestamp:at+5000,volume:100,askVolume:100,recordIndex:2}],at+1000);
  assert.deepEqual(buildFootprintBarsCached(cache,[candle],early,settings),buildFootprintBars([candle],early,settings));
  const chart=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
  assert.match(chart,/replayRetentionMustReset\(pocAuctionReplayScopeRef.current.clock, replayTimestampMs\)\) pocAuctionEngineRef.current.reset\(\)/);
  assert.match(chart,/replayRetentionMustReset\(stackedImbalanceReplayScopeRef.current.clock, replayTimestampMs\)\) stackedImbalanceEngineRef.current.reset\(\)/);
  assert.match(chart,/const throttledHit = replayTimestampMs == null/);
  assert.match(chart,/replayTimestampMs == null && cached/);
});

test('all delayed indicator frame summaries fail closed across rewind, live transition and scope changes',()=>{
  assert.equal(replayFrameIsVisible(2000,1000,'NQ:1m','NQ:1m'),false);
  assert.equal(replayFrameIsVisible(null,1000,'NQ:1m','NQ:1m'),false);
  assert.equal(replayFrameIsVisible(1000,2000,'NQ:1m','NQ:1m'),true);
  assert.equal(replayFrameIsVisible(1000,1000,'NQ:1m','NQ:3m'),false);
  assert.equal(replayFrameIsVisible(null,null,'NQ:1m','NQ:1m'),true);
  const chart=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
  assert.equal((chart.match(/const \[\w+Frame, set\w+Frame\] = useReplayFrameState</g)??[]).length,19);
  assert.match(chart,/replayTimestampMs != null \? footprintRenderBars : retainLiveFootprintRows/);
  assert.match(chart,/if \(exactFootprintHistory.active\)/);
  const footprintHook=fs.readFileSync(new URL('../src/components/useExactFootprintHistory.ts',import.meta.url),'utf8');
  assert.match(footprintHook,/completedReplayFootprintCandles\(sourceCandles, intervalMs, replayTimestampMs\)/);
  assert.match(footprintHook,/replayTimestampMs == null \|\| state.scope === scope/);
});

test('actual Gamma Heatmap gate requires both observation and mapping to exist at the exact clock',()=>{
  const source=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
  const at=source.indexOf('const replayVisibleSnapshots = replayHeatBoundaryMs');
  const expression=source.slice(at,source.indexOf(';',at)+1);
  const select=new Function('gammaHeatmapPayload','replayHeatBoundaryMs',expression+'return replayVisibleSnapshots;');
  const known={timestamp:clock-60_000,mapping:{asOf:new Date(clock).toISOString()}};
  const rows=[known,{...known,timestamp:clock-59_999},{...known,timestamp:clock-60_000,mapping:{asOf:new Date(clock+1).toISOString()}}];
  assert.deepEqual(select({snapshots:rows},clock),[known]);
});

test('GEX Interval Map cannot interpolate a historical mapping toward a later display-price observation',()=>{
  const surface={schemaVersion:1,provider:'quantdata',representation:'provider-signed-exposure',sourceTicker:'QQQ',sessionDate:'2026-10-23',marketOpen:false,status:'HISTORICAL',checkedAt:new Date(clock).toISOString(),refreshAfterMs:60000,aggregationPeriod:'1m',limitations:[],buckets:[{timestamp:clock-30_000,sourcePrice:500,rows:[{expirationDate:'2026-10-23',sourceStrike:500,callExposure:100,putExposure:-40}]}]};
  const settings={causalMapping:true,mode:'raw',baseline:'previous-bucket',rollingBuckets:3,content:'net',expiration:{mode:'all-expirations',includeWeeklies:true,includeMonthlies:true,includeQuarterlies:true},aggregationMode:'exact-display-tick',customBinSizePoints:1,minimumAbsoluteExposure:0,maximumDistancePoints:0,maximumPoints:1000};
  const before={timestamp:clock-60_000,price:20000};
  const expected=buildGexIntervalMapSnapshot(surface,'NQ',[before],settings);
  const actual=buildGexIntervalMapSnapshot(surface,'NQ',[before,{timestamp:clock+30_000,price:1e9}],settings);
  assert.ok(expected.points.length>0);assert.deepEqual(actual,expected);
  assert.equal(buildGexIntervalMapSnapshot(surface,'NQ',[{timestamp:clock+30_000,price:1e9}],settings).points.length,0);
});

test('Options Delta and Zero Gamma Bars reduce recorded frames causally without future total normalization',()=>{
  const frames=[{timestamp:clock-1000,updates:[{strike:500,net:10}]},{timestamp:clock,updates:[{strike:501,net:20}]},{timestamp:clock+1000,updates:[{strike:500,net:1e12}]}];
  assert.deepEqual(buildOptionsSurfaceNetSeries({frames}).filter(point=>point.timestampMs<=clock),buildOptionsSurfaceNetSeries({frames:frames.slice(0,2)}));
});

test('Instant Tape and SuperTrend cannot reattach a live tail during historical replay',()=>{
  const chart=fs.readFileSync(new URL('../src/components/Chart.tsx',import.meta.url),'utf8');
  const instant=fs.readFileSync(new URL('../src/components/SpeedOfTapeInstantOverlay.tsx',import.meta.url),'utf8');
  assert.match(chart,/eventKey=\{replayTimestampMs == null \? liveCandleEventKey : undefined\}/);
  assert.match(instant,/const liveFrame = eventKey \? retainedLiveFrame : frame/);
  assert.match(chart,/const definition = replayTimestampMs != null \? baseDefinition : superTrendPlotBuffersRef/);
});

test('actual replay frame state hook rejects a late future setter after rewind',()=>{
  let stored;
  const react={useCallback:callback=>callback,useState:initial=>{
    stored??=initial;return[stored,action=>{stored=typeof action==='function'?action(stored):action;}];
  }};
  const context={exports:{},require:name=>{assert.equal(name,'react');return react;}};
  const source=fs.readFileSync(new URL('../src/lib/useReplayFrameState.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const hook=context.exports.useReplayFrameState;
  const [,futureSetter]=hook(2000,null,'NQ:1m');futureSetter({value:999});
  assert.equal(hook(1000,null,'NQ:1m')[0],null);
  futureSetter({value:1000});assert.equal(hook(1000,null,'NQ:1m')[0],null);
  const [,currentSetter]=hook(1000,null,'NQ:1m');currentSetter({value:100});
  assert.equal(hook(1000,null,'NQ:1m')[0].value,100);
});
