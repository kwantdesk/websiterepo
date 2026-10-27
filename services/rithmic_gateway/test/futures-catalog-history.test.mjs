import test from 'node:test';import assert from 'node:assert/strict';
import {missingOnlyBars,configuredHistoryRoots,hydrateFuturesCatalogHistory} from '../scripts/hydrate-futures-catalog-history.mjs';
test('catalog hydration never rewrites published OHLC and orders missing rows',()=>{
 const old=[120000,100,110,90,105,10],correction=[120000,200,220,190,210,20],extra=[60000,101,102,100,101,5];
 assert.deepEqual(missingOnlyBars([old],[correction,extra]),[extra,old]);assert.deepEqual(old,[120000,100,110,90,105,10]);
});
test('provider reference failure retries only the exact resolved product on the same connection',async()=>{
 const calls=[],now=Date.parse('2026-10-27T09:00:00Z');let closed=0;
 const client={bytesReceived:0,close(){closed++},async replayMinuteBars(request){calls.push(request.symbol);if(request.symbol==='UB')throw Error('History replay failed: 7, reference data not available');request.onBar({marker:now/1000-60,openPrice:100,highPrice:102,lowPrice:99,closePrice:101,volume:8})}};
 const receipt=await hydrateFuturesCatalogHistory({now,config:{allowedRoots:[{exchange:'CBOT',symbol:'UB'}],subscriptions:[]},client,resolveContract:async row=>({...row,symbol:'UBZ6'})});
 assert.deepEqual(calls,['UB','UBZ6']);assert.equal(closed,1);assert.equal(receipt.instruments[0].status,'verified');assert.equal(receipt.instruments[0].contract,'UBZ6');
});
test('a rejected licensed login stops the entire catalog run without retrying credentials',async()=>{
 let requests=0,closed=0;const client={bytesReceived:0,close(){closed++},async replayMinuteBars(){requests++;throw Error('History login rejected: permission denied')}};
 const receipt=await hydrateFuturesCatalogHistory({config:{allowedRoots:[{exchange:'CME',symbol:'ES'},{exchange:'COMEX',symbol:'GC'}],subscriptions:[]},client});
 assert.equal(requests,1);assert.equal(closed,1);assert.equal(receipt.instruments.length,1);assert.equal(receipt.instruments[0].status,'failed');
});
test('each micro and parent has its own bounded history root and exchange',()=>{
 const roots=configuredHistoryRoots({allowedRoots:[{exchange:'COMEX',symbol:'MGC'},{exchange:'COMEX',symbol:'GC'},{exchange:'CME',symbol:'10Y'}],subscriptions:[{exchange:'COMEX',symbol:'GCZ6'}]});
 assert.equal(roots.length,3);assert.ok(roots.some(r=>r.symbol==='GC'));assert.ok(roots.some(r=>r.symbol==='MGC'));assert.ok(roots.some(r=>r.symbol==='10Y'&&r.exchange==='CME'));
 assert.throws(()=>configuredHistoryRoots({allowedRoots:Array.from({length:65},(_,i)=>({exchange:'CME',symbol:'A'+i})),subscriptions:[]}),/64/);
});
