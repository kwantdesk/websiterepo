import assert from 'node:assert/strict';
import test from 'node:test';
import {createPriceController} from '../public/kwanty-app/price-runtime.js';
import {createStateSources} from '../public/kwanty-app/state-sources.js';
import {createOrderflowSources} from '../public/kwanty-app/orderflow-sources.js';

const minute=60000;
const start=Date.parse('2026-11-05T16:41:00Z');
const sessionDate='2026-11-05';
const candle=(time,close=7464)=>({time,open:7463,high:7465,low:7462,close});
const observation=(timestamp,spot=7466,ticker='SPX')=>({ticker,timestamp:timestamp/1000,spot});
const step=()=>new Promise(resolve=>setImmediate(resolve));

function controllerFixture({ticker='SPX',now=()=>start+30000,bars=[candle(start-minute),candle(start)]}={}){
 let emit,historyReads=0,changes=0;
 const price=createPriceController({now,history:async()=>{historyReads++;return bars;},
  subscribe(_ticker,listener){emit=listener;return()=>{};},onChange(){changes++;}});
 price.select(ticker);
 return {price,send:frame=>emit(frame),reads:()=>historyReads,changes:()=>changes};
}

test('positioning moves live spot at the provider clock without touching either candle or repairing history',async()=>{
 let now=start+30000;
 const {price,send,reads,changes}=controllerFixture({now:()=>now});
 await step();
 const before=price.snapshot(),beforeReads=reads(),beforeChanges=changes();
 assert.equal(price.observePositioningQuote(observation(start+12000,7467)),true);
 assert.deepEqual(price.snapshot().latest,{time:start+12000,spot:7467,provenance:'observed-quote'});
 assert.deepEqual(price.snapshot().candles,before.candles);
 assert.equal(price.snapshot().points.at(-1).spot,7467);
 assert.equal(changes(),beforeChanges+1);
 assert.equal(price.observePositioningQuote(observation(start+12000,7467)),false);
 assert.equal(price.observePositioningQuote(observation(start+11000,7000)),false);
 assert.equal(changes(),beforeChanges+1);

 // An older canonical candle/quote can still publish authoritative OHLC while
 // the fresher positioning observation remains the current displayed spot.
 send({symbol:'SPX',timestamp:start,lastPrice:7461,candle:{...candle(start,7461),low:7461}});
 assert.equal(price.snapshot().candles.at(-1).close,7461);
 assert.equal(price.snapshot().latest.spot,7467);
 assert.equal(price.snapshot().candles[0].close,before.candles[0].close);

 now=start+minute+2000;
 assert.equal(price.observePositioningQuote(observation(start+minute+1000,7468)),true);
 assert.deepEqual(price.snapshot().candles.map(bar=>bar.time),[start-minute,start]);
 assert.equal(price.snapshot().points.at(-1).time,start+minute+1000);
 assert.equal(reads(),beforeReads);
 await price.refresh();
 assert.equal(price.snapshot().candles.at(-1).close,7464);
 assert.equal(price.snapshot().latest.spot,7468);
 assert.equal(price.snapshot(minute,{cutoffTime:start+10000}).points.some(point=>point.spot===7467),false);
 assert.equal(price.snapshot(minute,{cutoffTime:start+10000}).latest,null);
 price.dispose();
});

test('positioning rejects malformed, compact, mismatched, projected, inactive and replay inputs',async()=>{
 const {price}=controllerFixture();
 await step();
 for(const row of [
  observation(start+1000,100,'NDX'),
  observation(start+1000,0),
  observation(start+1000,'7466'),
  {...observation(start+1000),timestamp:start+1000},
  observation(start+32000),
  {...observation(start+1000),profilePage:0},
 ])assert.equal(price.observePositioningQuote(row),false);
 assert.equal(price.snapshot().latest,null);
 price.setActive(false);
 assert.equal(price.observePositioningQuote(observation(start+1000)),false);
 price.setActive(true);
 price.select('SPX',{live:false});
 assert.equal(price.observePositioningQuote(observation(start+1000)),false);
 price.select('SPX',{sessionDate,live:true});
 assert.equal(price.observePositioningQuote(observation(start+1000)),false);
 price.dispose();
 for(const ticker of ['ES_SPX','NQ_NDX','SPXW']){
  const {price:projection}=controllerFixture({ticker});
  assert.equal(projection.observePositioningQuote(observation(start+1000,7466,ticker)),false);
  projection.dispose();
 }
});

for(const mode of ['classic','state','orderflow']){
 test(mode+' feeds only the live snapshot into its existing shared price owner',async()=>{
  const category=mode==='orderflow'?'orderflow':'gex_full';
  const fresh={...observation(start+12000),category};
  const recorded={...observation(start+18000,7500),category};
  let clock=start+30000,snapshot=fresh;
  const archive={data:[recorded],ticker:'SPX',package:mode,category,sessionDate,recordedOnly:true,source:'VPS-owned recorded live positioning responses'};
  const options={packageName:mode,now:()=>clock,api:async route=>route.startsWith('history?')?archive:{data:snapshot},
   history:async()=>[candle(start-minute)],subscribe:()=>()=>{},onChange(){},
   sessionHistory:{read:async()=>archive.data},createPrices:args=>createPriceController({...args,now:()=>clock})};
  const source=mode==='orderflow'?createOrderflowSources(options):createStateSources(options);
  const panels=mode==='orderflow'?['SPX']:[{ticker:'SPX',gexCategory:'gex_full'}];
  const price=()=>mode==='orderflow'?source.get('SPX').prices:source.prices('SPX');
  source.reconcile(panels,{active:true,live:true});
  await source.refresh({force:true});
  await step();
  assert.equal(price().snapshot().latest.time,start+12000);
  assert.equal(price().snapshot().latest.spot,7466);
  assert.deepEqual(price().snapshot().candles.map(bar=>bar.time),[start-minute]);
  snapshot={...observation(start+20000,7600),category};
  source.reconcile(panels,{active:true,live:false});
  await source.refresh({force:true});
  assert.equal(price().snapshot().latest.spot,7466);
  source.reconcile(panels,{active:true,date:sessionDate,live:false});
  await source.refresh({force:true});
  assert.equal(price().snapshot().latest,null);
  source.dispose();
 });
}
