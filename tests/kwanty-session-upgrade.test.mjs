import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionHistory} from '../public/kwanty-app/session-history.js';
import {createOrderflowSources} from '../public/kwanty-app/orderflow-sources.js';

const date='2026-10-21',start=Date.parse(date+'T13:30:00Z')/1000;
const row=(seconds=0,ticker='QQQ')=>({ticker,timestamp:start+seconds,spot:725,zcvr:seconds});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('nonempty observation fallback upgrades to exact EOD only after bounded demand expiry',async()=>{
 let time=0,calls=0;
 const sparse=[row(59)],exact=[row(1),row(2),row(59)];
 const history=createSessionHistory(async(ticker,sessionDate)=>++calls===1?{data:sparse,availability:'recorded'}:{data:exact,source:'provider-eod-archive',ticker,sessionDate},{now:()=>time});
 const first=await Promise.all(Array.from({length:8},()=>history.read('QQQ',date)));
 assert.equal(calls,1);assert.ok(first.every(rows=>rows===sparse));
 time=299999;assert.equal(await history.read('QQQ',date),sparse);assert.equal(calls,1);
 time=300000;assert.equal(await history.read('QQQ',date),exact);assert.equal(calls,2);
 time=864000000;assert.equal(await history.read('QQQ',date),exact);assert.equal(calls,2,'verified EOD is immutable within bounded cache');
});

test('expired partial rows survive failed or empty refresh and concurrent retries remain single flight',async()=>{
 let time=0,calls=0,resolve;
 const sparse=[row(59)];
 const history=createSessionHistory(async()=>{
  calls++;if(calls===1)return {data:sparse};
  if(calls===2)return new Promise(done=>resolve=done);
  if(calls===3)throw Error('offline');
  return {data:[...sparse,row(60)]};
 },{now:()=>time});
 await history.read('QQQ',date);time=300000;
 const a=history.read('QQQ',date),b=history.read('QQQ',date);await Promise.resolve();assert.equal(calls,2);resolve({data:[]});
 assert.equal(await a,sparse);assert.equal(await b,sparse);
 time=329999;await history.read('QQQ',date);assert.equal(calls,2);
 time=330000;assert.equal(await history.read('QQQ',date),sparse);assert.equal(calls,3);
 time=360000;assert.deepEqual(await history.read('QQQ',date),[...sparse,row(60)]);assert.equal(calls,4);
});

test('source name alone cannot permanently pin a partial or mismatched session',async()=>{
 for(const meta of [{},{ticker:'SPX',sessionDate:date},{ticker:'QQQ',sessionDate:'2026-10-20'}]){
  let time=0,calls=0;const history=createSessionHistory(async()=>({data:[row()],source:'provider-eod-archive',...meta,count:++calls}),{now:()=>time});
  await history.read('QQQ',date);time=300000;await history.read('QQQ',date);assert.equal(calls,2);
 }
});

test('three-session bound remains enforced without a recurring retry timer',async()=>{
 let calls=0;const history=createSessionHistory(async(ticker,sessionDate)=>({source:'provider-eod-archive',ticker,sessionDate,data:[row(0,ticker)],count:++calls}));
 for(const ticker of ['QQQ','SPX','SPY','NDX'])await history.read(ticker,date);
 await history.read('NDX',date);assert.equal(calls,4);await history.read('QQQ',date);assert.equal(calls,5);
});

test('existing live coordinator upgrades sparse restoration without extra snapshot calls or lost live rows',async()=>{
 let time=0,snapshots=0,archives=0,changes=0;
 const sparse=[row(1)],exact=[row(1),row(2),row(4)];
 const sessionHistory=createSessionHistory(async(ticker,sessionDate)=>++archives===1?{data:sparse}:{data:exact,source:'provider-eod-archive',ticker,sessionDate},{now:()=>time});
 const pool=createOrderflowSources({now:()=>time,api:async()=>({data:row(10+snapshots++)}),sessionHistory,onChange:()=>changes++,history(){},subscribe(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
 pool.reconcile(['QQQ','QQQ'],{active:true,date:null,live:true});await pool.refresh();await settle();
 assert.deepEqual(pool.get('QQQ').records.map(r=>r.timestamp-start),[1,10]);assert.equal(snapshots,1);assert.equal(archives,1);
 const restorationChanges=changes;await pool.refresh();await settle();assert.equal(changes,restorationChanges,'ordinary focus does not poll');
 for(time=30000;time<300000;time+=30000){await pool.refresh();await settle();}
 assert.equal(archives,1);assert.equal(snapshots,10);
 time=300000;await pool.refresh();await settle();
 assert.equal(archives,2);assert.equal(snapshots,11);
 assert.deepEqual(pool.get('QQQ').records.slice(0,3),exact);
 assert.equal(pool.get('QQQ').records.at(-1).timestamp,start+20);
 time=600000;await pool.refresh();await settle();assert.equal(archives,2);
 pool.dispose();time=900000;await pool.refresh();await settle();assert.equal(archives,2);
});

test('pending restoration never publishes into removed or rolled-over source',async()=>{
 let resolve,changes=0;
 const pool=createOrderflowSources({api:async()=>({data:row(10)}),sessionHistory:{read:()=>new Promise(done=>resolve=done)},onChange:()=>changes++,history(){},subscribe(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
 pool.reconcile(['QQQ'],{active:true});await pool.refresh();await settle();
 const before=changes;pool.reconcile([],{active:false});resolve([row(1)]);await settle();
 assert.equal(changes,before);assert.equal(pool.get('QQQ'),undefined);pool.dispose();
});

test('historical source rejects wrong or mixed raw dates and mismatched metadata before merging, preserving prior records',async()=>{
 const valid={ticker:'QQQ',package:'orderflow',category:'orderflow',sessionDate:date,data:[row(1)]};
 for(const invalid of [
  {...valid,data:[row(1),row(86401)]},
  {...valid,data:[row(-86400),row(2)]},
  {...valid,data:[row(86401)]},
  {...valid,ticker:'SPX'},
  {...valid,sessionDate:'2026-10-20'},
  {...valid,category:'gamma_zero'},
  {...valid,package:'state'},
  {...valid,data:[{...row(2),category:'gamma_zero'}]},
 ]){
  let response=valid;
  const pool=createOrderflowSources({api:async()=>response,sessionHistory:{read:async()=>[]},onChange(){},history(){},subscribe(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
  pool.reconcile(['QQQ'],{active:true,date,live:false});await pool.refresh();
  const prior=pool.get('QQQ').records;response=invalid;await pool.refresh({force:true});
  assert.equal(pool.get('QQQ').records,prior);assert.equal(pool.get('QQQ').envelope,valid);assert.ok(pool.get('QQQ').error);
  pool.dispose();
 }
});

test('denied-history fallback rejects mixed sessions before latest-date truncation can conceal them',async()=>{
 for(const rows of [[row(1),row(-86400)],[row(1),row(86401)],[row(-86400)]]){
  const pool=createOrderflowSources({api:async()=>{throw Object.assign(Error('denied'),{status:403});},sessionHistory:{read:async()=>rows},onChange(){},history(){},subscribe(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
  pool.reconcile(['QQQ'],{active:true,date,live:false});await pool.refresh();
  assert.equal(pool.get('QQQ').records.length,0);assert.equal(pool.get('QQQ').error,'HISTORY_SESSION_MISMATCH');pool.dispose();
 }
});

test('live restoration cannot displace genuine current observations with another session',async()=>{
 for(const rows of [[row(1),row(-86400)],[row(1),row(86401)]]){
  const pool=createOrderflowSources({api:async()=>({data:row(10)}),sessionHistory:{read:async()=>rows},onChange(){},history(){},subscribe(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
  pool.reconcile(['QQQ'],{active:true,date:null,live:true});await pool.refresh();await settle();
  assert.deepEqual(pool.get('QQQ').records,[row(10)]);assert.equal(pool.get('QQQ').error,null);pool.dispose();
 }
});
