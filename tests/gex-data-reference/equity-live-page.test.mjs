import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeEquityLivePage,mergeLiveTapePage} from '../../public/gex-data-app/equity-live-page.js';
test('new live prints keep every loaded older page and updated IDs take the acquired value',()=>{
 const old=[{id:'a',tradeTime:30,size:1},{id:'b',tradeTime:20},{id:'c',tradeTime:10}];
 const latest=[{id:'d',tradeTime:40},{id:'a',tradeTime:30,size:2}];
 const rows=mergeEquityLivePage(old,latest);
 assert.deepEqual(rows.map(r=>r.id),['d','a','b','c']);assert.equal(rows[1].size,2);assert.equal(old[0].size,1);
});
test('notification merge orders real createdTime timestamps and keeps separate same-time IDs',()=>{
 const old=[{id:'a',createdTime:1000,type:'REG_SHO'},{id:'b',createdTime:1000,type:'LUDP'}];
 const rows=mergeLiveTapePage(old,[{id:'c',createdTime:2000,type:'REG_SHO'},{id:'a',createdTime:1000,type:'LUDP'}],{timeField:'createdTime'});
 assert.deepEqual(rows.map(r=>r.id),['c','a','b']);assert.equal(rows[1].type,'LUDP');assert.equal(old[0].type,'REG_SHO');
 assert.throws(()=>mergeLiveTapePage(old,[{id:'d'}],{timeField:'createdTime'}),/timestamp/);
});
test('different trades at identical time/price are retained, missing identity and capacity fail without truncation',()=>{
 const rows=[{id:'a',tradeTime:1,price:3},{id:'b',tradeTime:1,price:3}];
 assert.equal(mergeEquityLivePage(rows,[]).length,2);
 assert.throws(()=>mergeEquityLivePage(rows,[{tradeTime:2}]),/identity/);
 assert.throws(()=>mergeEquityLivePage(rows,[{id:'c',tradeTime:2}],2),/full/);
 assert.equal(rows.length,2);
});
