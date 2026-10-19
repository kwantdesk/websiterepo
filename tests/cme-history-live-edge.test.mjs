import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {cmeChartTailNeedsReconciliation} from '../src/lib/chartHistoryWindow.ts';

// The shared Node alias hook treats `.server` as an extension. Resolve those
// actual TS files locally; no application modules or provider calls are stubbed.
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith('@/')&&specifier.endsWith('.server'))
    return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`,import.meta.url).href,context);
  return nextResolve(specifier,context);
}});
const {getDatabentoBars,getDatabentoOrderFlowHistory}=await import('../src/lib/databento.ts');

test('actual candle and flow adapters request the gateway live edge, not a delayed vendor cutoff',async()=>{
  const originalFetch=globalThis.fetch;
  const keys=['KWANTDESK_MARKET_DATA_GATEWAY_URL','KWANTDESK_MARKET_DATA_GATEWAY_TOKEN'];
  const saved=keys.map(key=>process.env[key]);
  process.env[keys[0]]='http://history-live-edge.test';
  process.env[keys[1]]='fixture-token';
  const now=Date.parse('2026-10-19T23:36:20.000Z');
  const activeMinute=Math.floor(now/60000)*60000;
  const rows=Array.from({length:41},(_,i)=>({
    timestamp:activeMinute-(40-i)*60000,open:100,high:105,low:99,close:102,
    volume:10,askVolume:7,bidVolume:3,delta:4,deltaHigh:5,deltaLow:-1,
  }));
  const calls=[];
  globalThis.fetch=async (input)=>{
    const url=new URL(String(input));
    if(url.pathname==='/health') return Response.json({connected:true,authenticated:true});
    assert.equal(url.pathname,'/v1/market-data/history');
    calls.push(url);
    const from=Number(url.searchParams.get('fromMs')),to=Number(url.searchParams.get('toMs'));
    return Response.json({symbol:'NQZ6',candles:rows.filter(row=>row.timestamp>=from&&row.timestamp<to),executions:[]});
  };
  try{
    const start=new Date(activeMinute-40*60000).toISOString(),end=new Date(now).toISOString();
    for(const timeframe of ['1m','3m','5m','15m']){
      const bars=await getDatabentoBars('NQ.c.0',timeframe,start,end);
      assert.equal(Number(calls.at(-1).searchParams.get('toMs')),now);
      assert.equal(cmeChartTailNeedsReconciliation(bars,timeframe,now),false,timeframe);
      assert.equal(bars.at(-1).high,105);
      assert.equal(bars.at(-1).close,102);
    }
    const flow=await getDatabentoOrderFlowHistory('NQ.c.0','1m',start,end);
    assert.equal(Number(calls.at(-1).searchParams.get('toMs')),now);
    assert.equal(calls.at(-1).searchParams.get('orderFlow'),'1');
    assert.equal(flow.candles.at(-1).askVolume,7);
    assert.equal(flow.candles.at(-1).bidVolume,3);
    assert.equal(cmeChartTailNeedsReconciliation(flow.candles,'1m',now),false);

    // Immutable replay must keep its exact exclusive end, not be moved to now.
    const replayEnd=activeMinute-10*60000;
    const replay=await getDatabentoBars('NQ.c.0','1m',start,new Date(replayEnd).toISOString());
    assert.equal(Number(calls.at(-1).searchParams.get('toMs')),replayEnd);
    assert.ok(replay.every(bar=>bar.timestamp<replayEnd));

    // Reproduce the prior first-paint failure with the SAME authoritative data.
    const oldEnd=Math.floor((now-60000)/60000)*60000;
    const oldBars=rows.filter(row=>row.timestamp<oldEnd);
    assert.equal(cmeChartTailNeedsReconciliation(oldBars,'1m',now),true);
    assert.equal(cmeChartTailNeedsReconciliation(oldBars,'3m',now),true);
  }finally{
    globalThis.fetch=originalFetch;
    keys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];});
  }
});

test('history refresh revalidates privately and continuity safety gates remain intact',()=>{
  const workspace=readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
  const route=readFileSync(new URL('../src/app/api/databento/market/route.ts',import.meta.url),'utf8');
  assert.match(workspace,/cache: forceFresh \? "reload" : "no-cache"/);
  const early=workspace.slice(workspace.indexOf('const earlyBaseHistory ='),workspace.indexOf('let liveSeam: Candle[]'));
  assert.match(early,/!immediateHistoryIsHydrated/);
  assert.doesNotMatch(early,/!hasImmediateHistory/);
  const base=workspace.slice(workspace.indexOf('// Ordinary Volume is available from base OHLCV history'),workspace.indexOf('try {\n        const nextCandles ='));
  assert.match(base,/&& !cachedIsHydrated/);
  assert.doesNotMatch(base,/&& !cachedBase.length/);
  assert.match(workspace,/if \(cmeChartTailNeedsReconciliation\(repaired, pane.timeframe\)\) return/);
  assert.match(workspace,/if \(historyHydratedRef.current\) \{[\s\S]*?setSettledChartRequestKey/);
  assert.match(route,/cme-time-flow-v6/);
  assert.match(route,/hasMinimumChartHistory\(candles, timeframe\)/);
});
