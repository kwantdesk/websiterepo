import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceCandleFromLivePrice, publishChartLivePrice, subscribeChartDisplayPrice, chartQuoteKey } from '../src/lib/liveChartPrice.ts';
import { chartTimeBucketStartMs } from '../src/lib/chartTimeBucket.ts';
import { retainFormingCandleExtrema } from '../src/lib/liveCandleAuthority.ts';

const instant = Date.UTC(2026,10,9,15,30,0,100);
const print = (overrides={}) => ({key:'coherence',symbol:'NQ',contractSymbol:'NQZ6',price:29001,sourceTimestampMs:instant,receivedAt:Date.now(),priceType:'trade',...overrides});
const bar = timeframe => ({timestamp:chartTimeBucketStartMs(instant,timeframe),open:29000,high:29000.5,low:28999.75,close:29000.25,volume:100,delta:10,sourceEndTimestamp:instant-50});

for (const timeframe of ['1s','5s','15s','30s','45s','1m','3m','5m','15m','30m','45m','1h','4h','1D','1W','1M']) {
  test(timeframe+' real print advances only the current candle without adding volume or changing open',()=>{
    const base=bar(timeframe), frozen={...base};const next=advanceCandleFromLivePrice(base,print(),timeframe);
    assert.equal(next.close,29001);assert.equal(next.high,29001);assert.equal(next.low,base.low);
    assert.equal(next.open,base.open);assert.equal(next.volume,100);assert.equal(next.delta,10);assert.deepEqual(base,frozen);
    const down=advanceCandleFromLivePrice(next,print({price:28999,sourceTimestampMs:instant+1}),timeframe);
    assert.equal(down.close,28999);assert.equal(down.high,29001);assert.equal(down.low,28999);
  });
}
test('quote midpoint, old print, another bucket, missing history and invalid prices never manufacture candle geometry',()=>{
  const base=bar('1m');
  for (const change of [{priceType:'quote'},{priceType:undefined},{sourceTimestampMs:instant-1000},
    {sourceTimestampMs:instant+60000},{sourceTimestampMs:instant-60000},{price:NaN},{price:0}])
    assert.equal(advanceCandleFromLivePrice(base,print(change),'1m'),null);
  assert.equal(advanceCandleFromLivePrice(null,print(),'1m'),null);
});
test('lossless late prints can add missing wick evidence without rewinding the fast display close or volume',()=>{
  const base=bar('1m'),fast=advanceCandleFromLivePrice(base,print(),'1m');
  const reconciled=retainFormingCandleExtrema(fast,{...base,close:29000.5,high:29002,low:28998,volume:150,sourceEndTimestamp:instant-1});
  assert.equal(reconciled.close,29001);assert.equal(reconciled.high,29002);assert.equal(reconciled.low,28998);assert.equal(reconciled.open,base.open);assert.equal(reconciled.volume,150);
});
test('a newer quote midpoint cannot suppress an earlier real trade on the shared display subscription',()=>{
  const key='coherence-filter',received=[];
  const stop=subscribeChartDisplayPrice(key,'NQ','NQZ6','Databento',quote=>received.push(quote));
  publishChartLivePrice(print({key:chartQuoteKey('Databento::NQ'),priceType:'quote',sourceTimestampMs:instant+100,price:29000.125}));
  publishChartLivePrice(print({key,sourceTimestampMs:instant+50}));stop();
  assert.equal(received.length,1);assert.equal(received[0].priceType,'trade');
});
