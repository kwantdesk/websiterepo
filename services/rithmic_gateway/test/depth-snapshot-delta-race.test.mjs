import test from 'node:test';
import assert from 'node:assert/strict';
import {RithmicBookStore} from '../src/book-store.mjs';
const base={exchange:'CME',symbol:'NQZ6'};
function row(book,id,price,side=1){book.applyDepthSnapshot({...base,depthPrice:price,depthSide:side,depthSize:[1],exchangeOrderId:[id]});}
function update(book,id,type,price){book.applyDepthUpdate({...base,updateType:[type],transactionType:[1],depthPrice:[price],depthSize:[1],exchangeOrderId:[id]});}
for(const type of [2,3])test('snapshot completion preserves an interleaved '+(type===3?'cancel':'price move'),()=>{
 const book=new RithmicBookStore();row(book,'bid',100);row(book,'ask',101,2);book.applyDepthSnapshot(base);
 row(book,'bid',100);update(book,'bid',type,99);row(book,'ask',101,2);book.applyDepthSnapshot(base);
 const result=book.snapshot('CME','NQZ6',10,{includeOrders:true});
 assert.equal(result.bids.some(x=>x.price===100),false);
 assert.equal(result.bids.some(x=>x.price===99),type===2);
});
test('a snapshot row arriving after a live cancel cannot resurrect that order',()=>{
 const book=new RithmicBookStore();row(book,'other',98);update(book,'deleted',3,100);row(book,'deleted',100);row(book,'ask',101,2);book.applyDepthSnapshot(base);
 assert.equal(book.ensure('CME','NQZ6').orders.has('deleted'),false);
});
test('new live orders survive a staged baseline that does not contain them',()=>{
 const book=new RithmicBookStore();row(book,'old',98);update(book,'new',1,100);row(book,'ask',101,2);book.applyDepthSnapshot(base);
 assert.equal(book.ensure('CME','NQZ6').orders.get('new')?.price,100);
});
