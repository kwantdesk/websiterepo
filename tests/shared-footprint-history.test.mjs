import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSharedFootprintHistory} from '../src/lib/sharedFootprintHistory.ts';
const window = timestamp => ({records:[{timestamp}],missingTimestamps:[],totalBars:1});
test('identical panes share one load; one departing pane cannot cancel another',async()=>{
  let calls=0,finish,signal;
  const load=s=>{calls++;signal=s;return new Promise(resolve=>{finish=resolve;});};
  const a=new AbortController(),b=new AbortController();
  const first=loadSharedFootprintHistory('shared',load,a.signal);
  const second=loadSharedFootprintHistory('shared',load,b.signal);
  await Promise.resolve();assert.equal(calls,1);
  a.abort();await assert.rejects(first);assert.equal(signal.aborted,false);
  const records=window(1);finish(records);assert.equal(await second,records);
  const restored=await loadSharedFootprintHistory('shared',()=>{throw Error('should use cache')},new AbortController().signal);
  assert.equal(restored,records);
});
test('changing candle/filter identity never reuses another window; failures are retryable',async()=>{
  const a=await loadSharedFootprintHistory('different-ohlcv',async()=>window(2),new AbortController().signal);
  assert.equal(a.records[0].timestamp,2);
  await assert.rejects(loadSharedFootprintHistory('failed',async()=>{throw Error('missing tape')},new AbortController().signal));
  const retry=await loadSharedFootprintHistory('failed',async()=>window(3),new AbortController().signal);
  assert.equal(retry.records[0].timestamp,3);
});
test('last departing pane cancels upstream and cannot populate cache with a late result',async()=>{
  const owner=new AbortController();let signal,finish;
  const first=loadSharedFootprintHistory('abandoned',s=>{signal=s;return new Promise(resolve=>{finish=resolve})},owner.signal);
  await Promise.resolve();owner.abort();await assert.rejects(first);assert.equal(signal.aborted,true);
  finish(window(4));await new Promise(resolve=>setImmediate(resolve));
  const retry=await loadSharedFootprintHistory('abandoned',async()=>window(5),new AbortController().signal);
  assert.equal(retry.records[0].timestamp,5);
});

test('partial results never enter the completed warm cache',async()=>{
  const signal=new AbortController().signal;
  await loadSharedFootprintHistory('partial',async()=>({...window(6),missingTimestamps:[7]}),signal);
  const result=await loadSharedFootprintHistory('partial',async()=>window(8),signal);
  assert.equal(result.records[0].timestamp,8);
});
