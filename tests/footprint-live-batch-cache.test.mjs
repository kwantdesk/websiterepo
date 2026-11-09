import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFootprintBarsCached,buildFootprintBars} from '../src/lib/footprint.ts';
const settings={tickSize:.25,groupTicks:1,instrument:'NQ',minimumTradeVolume:0,maximumTradeVolume:0};
const candle=timestamp=>({timestamp,open:100,high:101,low:99,close:100,volume:100});
const trade=(id,timestamp,volume)=>({eventId:String(id),recordIndex:id,timestamp,open:100,high:100,low:100,close:100,volume,trades:1,bidVolume:0,askVolume:volume,delta:volume,aggressor:'BUY'});

test('closed footprint cells reflect a delivered burst immediately without waiting for the repair timer',()=>{
 const candles=Array.from({length:500},(_,i)=>candle(1000+i*60000));
 const tape=candles.map((c,i)=>trade(i,c.timestamp+10,1)),cache={current:null};
 const before=buildFootprintBarsCached(cache,candles,tape,settings);
 cache.current.nextReconcileAt=Date.now()+600000;
 const burst=[trade(501,candles[73].timestamp+20,7),trade(502,candles[498].timestamp+20,13)];
 const nextTape=[...tape,...burst].sort((a,b)=>a.timestamp-b.timestamp);
 const oldPath={current:{...cache.current}};
 assert.equal(buildFootprintBarsCached(oldPath,candles,nextTape,settings)[73].totalVolume,1,'negative control reproduces stale closed cells without batch invalidation');
 const after=buildFootprintBarsCached(cache,candles,nextTape,settings,burst.map(t=>t.timestamp));
 assert.equal(after[73].totalVolume,8);assert.equal(after[498].totalVolume,14);
 assert.equal(after[74],before[74],'unaffected closed bars are not rebuilt');
 assert.deepEqual(after[73].rows,buildFootprintBars(candles,nextTape,settings)[73].rows);
});

test('coalesced bursts across several event bars update both main cells and separate profile grouping',()=>{
 const candles=[1000,1005,1009,1012,1050].map(candle),initial=[trade(1,1001,1)];
 const main={current:null},profile={current:null},profileSettings={...settings,groupTicks:4};
 buildFootprintBarsCached(main,candles,initial,settings);buildFootprintBarsCached(profile,candles,initial,profileSettings);
 main.current.nextReconcileAt=profile.current.nextReconcileAt=Date.now()+600000;
 const burst=[trade(2,1002,3),trade(3,1007,4),trade(4,1010,5)],tape=[...initial,...burst];
 const touched=new Set(burst.map(t=>t.timestamp));
 for(const [cache,config] of [[main,settings],[profile,profileSettings]]){
  const bars=buildFootprintBarsCached(cache,candles,tape,config,touched);
  assert.deepEqual(bars.map(b=>b.totalVolume),[4,4,5,0,0]);
  assert.deepEqual(bars.map(b=>b.rows),buildFootprintBars(candles,tape,config).map(b=>b.rows));
 }
});

test('a later React cache refresh cannot replace delivered closed-bar numbers with stale cells',()=>{
 const candles=[1000,2000,3000].map(candle),cache={current:null};
 const first=[trade(1,1100,2)];buildFootprintBarsCached(cache,candles,first,settings);
 cache.current.nextReconcileAt=Date.now()+600000;
 cache.current.pendingExecutionTimes=new Set([1000]);
 const next=buildFootprintBarsCached(cache,candles,[...first,trade(2,1200,9)],settings);
 assert.equal(next[0].totalVolume,11);assert.equal(cache.current.pendingExecutionTimes,undefined);
 const unchanged=buildFootprintBarsCached(cache,candles,[...first,trade(2,1200,9)],settings);
 assert.equal(unchanged[0],next[0],'dirty markers are consumed once, not rebuilt on every render');
});
