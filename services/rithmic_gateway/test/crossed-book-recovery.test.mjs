import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {RithmicBookStore} from '../src/book-store.mjs';
import {RithmicMarketDataClient} from '../src/rithmic-client.mjs';
function book(store,bid=30172.75,ask=29484.5){
 const row=store.ensure('CME','NQZ6');
 row.bids=new Map([[bid,{price:bid,size:20,orders:2}]]);row.asks=new Map([[ask,{price:ask,size:12,orders:2}]]);
 row.depthMode='L3';row.individualOrders=true;row.bookValid=true;row.asOfMs=Date.now();return row;
}
function fixture(){
 const client=new RithmicMarketDataClient({protoDir:fileURLToPath(new URL('../vendor/proto',import.meta.url)),maxTrades:20,subscriptions:[{exchange:'CME',symbol:'NQZ6'}],enableDepthByOrder:true,depthResyncMinMs:30000});
 client.socket={readyState:1};client.status.authenticated=true;
 const sent=[];client.send=(name,payload)=>sent.push({name,payload});const row=book(client.book);
 return {client,sent,row,event:{type:'depth',instrument:'CME:NQZ6'}};
}
test('a crossed depth book is not advertised as valid full depth; exact rows remain available for diagnosis',()=>{
 const store=new RithmicBookStore();book(store);
 const snapshot=store.snapshot('CME','NQZ6',400);
 assert.equal(snapshot.bookValid,false);assert.equal(snapshot.fullDepth,false);assert.equal(snapshot.crossedBook,true);
 assert.equal(snapshot.bids[0].price,30172.75);assert.equal(snapshot.asks[0].price,29484.5);
});
test('sustained crossed L3 requests one atomic snapshot without unsubscribing trades or clearing orders',()=>{
 const h=fixture();h.row.orders.set('keep',{id:'keep',side:'BUY',price:29537,size:2});
 assert.equal(h.client.checkDepthIntegrity(h.event,100000),false);
 assert.equal(h.client.checkDepthIntegrity(h.event,100500),false);
 assert.equal(h.client.checkDepthIntegrity(h.event,101000),true);
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].name,'RequestDepthByOrderSnapshot');
 assert.deepEqual(h.sent[0].payload.userMsg,['dbo-resync:CME:NQZ6']);
 assert.equal(h.row.orders.size,1);assert.equal(h.client.subscriptions.size,1);
 for(let t=102000;t<131000;t+=1000)h.client.checkDepthIntegrity(h.event,t);
 assert.equal(h.sent.length,1);assert.equal(h.client.checkDepthIntegrity(h.event,131000),true);assert.equal(h.sent.length,2);
});
test('an uncrossed next sample clears confirmation; quote sequence regression does not force resync',()=>{
 const h=fixture();h.client.checkDepthIntegrity(h.event,100000);
 h.row.asks=new Map([[30173,{price:30173,size:12}]]);h.client.checkDepthIntegrity({...h.event,sequenceRegression:true},101000);
 assert.equal(h.sent.length,0);h.row.asks=new Map([[29484.5,{price:29484.5,size:12}]]);
 assert.equal(h.client.checkDepthIntegrity(h.event,102000),false);assert.equal(h.client.checkDepthIntegrity(h.event,103000),true);
});
test('disconnected, unauthenticated, unsubscribed and pending snapshot books never transmit recovery',()=>{
 for(const mode of ['socket','auth','subscription','pending']){
  const h=fixture();if(mode==='socket')h.client.socket=null;if(mode==='auth')h.client.status.authenticated=false;if(mode==='subscription')h.client.subscriptions.clear();if(mode==='pending')h.row.pendingDepthSnapshot={orders:new Map()};
  h.client.checkDepthIntegrity(h.event,100000);h.client.checkDepthIntegrity(h.event,102000);assert.equal(h.sent.length,0,mode);
 }
});
test('an actual provider snapshot atomically replaces the crossed book and restores validity',()=>{
 const store=new RithmicBookStore();book(store);
 for(const [side,price,id] of [[1,29537,'new-bid'],[2,29537.25,'new-ask']])store.applyDepthSnapshot({exchange:'CME',symbol:'NQZ6',sequenceNumber:'500',depthSide:side,depthPrice:price,depthSize:[10],exchangeOrderId:[id],depthOrderPriority:['1']});
 assert.equal(store.snapshot('CME','NQZ6').bookValid,false);
 store.applyDepthSnapshot({exchange:'CME',symbol:'NQZ6',rpCode:['0']});
 const snapshot=store.snapshot('CME','NQZ6');assert.equal(snapshot.bookValid,true);assert.equal(snapshot.fullDepth,true);assert.equal(snapshot.crossedBook,false);
 assert.equal(snapshot.bids[0].price,29537);assert.equal(snapshot.asks[0].price,29537.25);
});
