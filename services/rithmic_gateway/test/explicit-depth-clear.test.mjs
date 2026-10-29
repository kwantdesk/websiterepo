import test from 'node:test';
import assert from 'node:assert/strict';
import {RithmicBookStore} from '../src/book-store.mjs';
const base={exchange:'CME',symbol:'NQZ6'};
const second=1793246714;
const snapshot=(book,id,price,side=2,received=second*1000+83)=>book.applyDepthSnapshot({
  ...base,depthSide:side,depthPrice:price,depthSize:[1],exchangeOrderId:[id],
},received);
const update=(book,id,price,side,usecs=500000)=>book.applyDepthUpdate({
  ...base,updateType:[1],transactionType:[side],depthPrice:[price],depthSize:[1],
  exchangeOrderId:[id],ssboe:second,usecs,
});
const clear=(book,price,usecs=130143,options={})=>book.applyOrderBook({
  ...base,updateType:7,askPrice:[price],askSize:[0],askOrders:[0],ssboe:second,usecs,...options,
});
function ready(){const b=new RithmicBookStore();snapshot(b,'bid',29559.75,1);snapshot(b,'ask',29560);snapshot(b,'upper',29561.5);b.applyDepthSnapshot(base);return b;}

test('captured explicit zero level removes stale snapshot orders before the next bid crosses them',()=>{
  const b=ready();const event=clear(b,29560);
  update(b,'new-bid',29560.5,1,558820);
  const book=b.snapshot('CME','NQZ6',20,{includeOrders:true});
  assert.equal(book.crossedBook,false);
  assert.equal(book.fullDepth,true);
  assert.equal(book.orders.some(o=>o.orderId==='ask'),false);
  assert.equal(event.orderEvents[0].action,'REMOVE');
  assert.equal(event.orderEvents[0].reason,'explicit-price-level-clear');
  assert.equal(book.trades.length,0,'a level clear must never manufacture an execution');
});

test('a delayed empty-level message cannot erase a newer DBO order',()=>{
  const b=ready();update(b,'newer',29560,2,500000);clear(b,29560);
  assert.equal(b.ensure('CME','NQZ6').orders.has('ask'),false);
  assert.equal(b.ensure('CME','NQZ6').orders.has('newer'),true);
  assert.equal(b.snapshot('CME','NQZ6',20).asks.find(o=>o.price===29560).size,1);
});

test('a DBO update older than a known clear cannot resurrect the emptied level',()=>{
  const b=ready();clear(b,29560);update(b,'late-old',29560,2,100000);
  assert.equal(b.ensure('CME','NQZ6').orders.has('late-old'),false);
  update(b,'truly-new',29560,2,200000);
  assert.equal(b.ensure('CME','NQZ6').orders.has('truly-new'),true);
});

test('a zero arriving during a staged snapshot survives later stale rows and completion',()=>{
  const b=ready();snapshot(b,'first',29559.5,1,second*1000+100);
  clear(b,29560);
  snapshot(b,'late-row',29560,2,second*1000+200);
  snapshot(b,'upper',29561.5,2,second*1000+201);b.applyDepthSnapshot(base);
  assert.equal(b.ensure('CME','NQZ6').orders.has('late-row'),false);
});

test('a new baseline and new deltas after the clear may repopulate the price',()=>{
  const b=ready();clear(b,29560);
  snapshot(b,'fresh',29560,2,second*1000+200);snapshot(b,'bid',29559.75,1,second*1000+201);
  update(b,'interleaved',29560,2,300000);b.applyDepthSnapshot(base);
  assert.equal(b.ensure('CME','NQZ6').orders.has('fresh'),true);
  assert.equal(b.ensure('CME','NQZ6').orders.has('interleaved'),true);
});

test('positive, ambiguous and unclocked aggregate rows cannot rewrite L3 quantities',()=>{
  const b=ready();clear(b,29560,130143,{askSize:[15],askOrders:[4]});
  clear(b,29560,130143,{askSize:[0],askOrders:[1]});
  clear(b,29560,130143,{ssboe:undefined,usecs:undefined});
  assert.equal(b.ensure('CME','NQZ6').orders.has('ask'),true);
  assert.equal(b.snapshot('CME','NQZ6',20).asks.find(o=>o.price===29560).size,1);
});

test('side/price scope and reset keep indexes and zero clocks isolated',()=>{
  const b=ready();update(b,'bid-same-price',29560,1,500000);clear(b,29560);
  assert.equal(b.ensure('CME','NQZ6').orders.has('bid-same-price'),true);
  assert.equal(b.ensure('CME','NQZ6').orders.has('upper'),true);
  b.resetDepth('CME','NQZ6');update(b,'after-reset',29560,2,100000);
  assert.equal(b.ensure('CME','NQZ6').orders.has('after-reset'),true);
});

test('late packets preserve their real execution time without moving the live price backward',()=>{
  const b=ready();
  b.applyTrade({...base,tradePrice:29561,tradeSize:1,aggressor:1,ssboe:second+3});
  b.applyTrade({...base,tradePrice:29560,tradeSize:2,aggressor:2,ssboe:second+1});
  const state=b.ensure('CME','NQZ6');
  assert.equal(state.lastPrice,29561);
  assert.equal(state.asOfMs,(second+3)*1000);
  assert.equal(state.trades.at(-1).timestampMs,(second+1)*1000);
  b.applyBbo({...base,bidPrice:29560.75,askPrice:29561.25,ssboe:second+4});
  b.applyBbo({...base,bidPrice:29559.75,ssboe:second+2});
  assert.equal(state.bestBid.price,29560.75);
  assert.equal(state.asOfMs,(second+4)*1000);
  update(b,'late-but-real',29559,1,100000);
  assert.equal(state.asOfMs,(second+4)*1000);
});
