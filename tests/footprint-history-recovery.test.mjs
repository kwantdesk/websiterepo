import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverFootprintHistory} from '../src/lib/footprintHistoryRecovery.ts';
const complete={records:[{timestamp:1}],missingTimestamps:[],totalBars:2};
test('same-window recovery paints valid partial bars before retry and clears the error on recovery',async()=>{
  const updates=[],delays=[];let attempts=0;
  await recoverFootprintHistory(async()=>++attempts===1?{...complete,missingTimestamps:[2]}:complete,
    update=>updates.push(update),new AbortController().signal,async ms=>{delays.push(ms);assert.equal(updates.length,1);});
  assert.equal(attempts,2);assert.deepEqual(delays,[1500]);
  assert.equal(updates[0].result.records,complete.records);assert.match(updates[0].error,/1 of 2/);
  assert.equal(updates[1].error,null);
});
test('temporary request failure recovers without a viewport change',async()=>{
  let attempts=0;const updates=[];
  await recoverFootprintHistory(async()=>{if(++attempts===1)throw Error('temporarily busy');return complete;},
    update=>updates.push(update),new AbortController().signal,async()=>{});
  assert.equal(attempts,2);assert.equal(updates[0].error,'temporarily busy');assert.equal(updates[1].error,null);
});
test('permanent gaps have a bounded request count; cancellation prevents further work',async()=>{
  let attempts=0;
  await recoverFootprintHistory(async()=>{attempts++;return {...complete,missingTimestamps:[2]};},()=>{},new AbortController().signal,async()=>{});
  assert.equal(attempts,4);
  const owner=new AbortController();attempts=0;
  await recoverFootprintHistory(async()=>{attempts++;return {...complete,missingTimestamps:[2]};},()=>{},owner.signal,async()=>{owner.abort();});
  assert.equal(attempts,1);
});
