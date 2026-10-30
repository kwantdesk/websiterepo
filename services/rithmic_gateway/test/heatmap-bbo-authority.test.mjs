import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
const start=source.indexOf('function heatmapInsideMarket('),end=source.indexOf('function gatewayInstrumentCatalog()',start);
assert.ok(start>=0&&end>start);
const context={tickSize:()=>.25,client:{status:{connected:true}},config:{systemName:'fixture'}};
const {heatmapInsideMarket,heatmapPayload}=vm.runInNewContext('(()=>{'+source.slice(start,end)+';return {heatmapInsideMarket,heatmapPayload};})()',context);
test('exchange BBO remains authoritative when L3 top rows are wider at the same source timestamp',()=>{
  const snapshot={bestBid:{price:28910,size:2},bestAsk:{price:28910.75,size:3}};
  const rows={bids:[[115632,10,1]],asks:[[115643,11,1]]};
  const result=heatmapInsideMarket(snapshot,.25,rows.bids,rows.asks);
  assert.equal(result.bestBid,115640);assert.equal(result.bestAsk,115643);assert.equal(result.insideMarketSource,'BBO');
  assert.equal(rows.bids[0][0],115632,'actual recorded depth is not pruned or replaced');
});
test('missing, crossed and invalid quotes retain explicit genuine-depth fallback',()=>{
  for(const snapshot of [{},{bestBid:{price:0},bestAsk:{price:100}},{bestBid:{price:101},bestAsk:{price:100}}]){
    const result=heatmapInsideMarket(snapshot,.25,[[399,4]],[[401,5]]);
    assert.equal(result.insideMarketSource,'DEPTH');assert.equal(result.bestBid,399);assert.equal(result.bestAsk,401);
  }
});
test('NQ, ES and gold inside quotes use each instrument tick size',()=>{
  for(const [bid,ask,tick]of [[28910,28910.75,.25],[6800,6800.25,.25],[3990.1,3990.3,.1]]){
    const result=heatmapInsideMarket({bestBid:{price:bid,size:2},bestAsk:{price:ask,size:3}},tick,[],[]);
    assert.equal(result.bestBid,Math.round(bid/tick));assert.equal(result.bestAsk,Math.round(ask/tick));
  }
});
test('the actual public heatmap envelope carries true quotes and untouched depth/executions',()=>{
  const snapshot={symbol:'NQZ6',sequence:10,asOfMs:1000,ageMs:0,bestBid:{price:28910,size:2},bestAsk:{price:28910.75,size:3},lastPrice:28910.25,
    bids:[{price:28908,size:10,orders:1}],asks:[{price:28910.75,size:11,orders:1}],trades:[{sequence:9,timestampMs:990,price:28910.25,size:7,aggressor:'BUY'}],flowTotals:{askVolume:7,bidVolume:0},fullDepth:true,individualOrders:true,bookValid:true,depthMode:'L3',orders:[]};
  const payload=heatmapPayload(snapshot,8).snapshot;
  assert.equal(payload.bestBid,115640);assert.equal(payload.bestAsk,115643);assert.equal(payload.insideMarketSource,'BBO');
  assert.equal(payload.bids[0][0],115632);assert.equal(payload.trades[0].tick,115641);assert.equal(payload.trades[0].timestamp,990);assert.equal(payload.trades[0].size,7);
  const zeroSizes=heatmapPayload({...snapshot,bestBid:{price:28910,size:0},bestAsk:{price:28910.75,size:0}},8).snapshot;
  assert.equal(zeroSizes.microTick,(115640+115643)/2,'quotes without sizes retain the defined midpoint');
});
