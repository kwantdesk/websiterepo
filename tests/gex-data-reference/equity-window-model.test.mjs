import test from 'node:test';
import assert from 'node:assert/strict';
import {darkFlowInitialWindow} from '../../public/gex-data-app/equity-window-model.js';
const rows=times=>times.map((time,index)=>({time:Date.parse(time),notional:100+index,spot:700+index}));

test('Dark Flow current regime begins its initial viewport at 04:00 New York and retains all earlier buckets',()=>{
  const source=rows(['2026-10-16T06:00:00Z','2026-10-16T07:59:00Z','2026-10-16T08:00:00Z','2026-10-16T20:00:00Z']),original=structuredClone(source);
  assert.deepEqual(darkFlowInitialWindow(source),{start:2,end:3});assert.deepEqual(source,original);assert.equal(source.length,4);assert.equal(source[0].notional,100);
});

test('04:00 remains exchange-local across DST rather than using a fixed UTC offset',()=>{
  const daylight=rows(['2026-10-30T07:59:00Z','2026-10-30T08:00:00Z']),standard=rows(['2026-11-02T08:00:00Z','2026-11-02T08:59:00Z','2026-11-02T09:00:00Z']);
  assert.deepEqual(darkFlowInitialWindow(daylight),{start:1,end:1});assert.deepEqual(darkFlowInitialWindow(standard),{start:2,end:2});
});

test('before March 30 the 08:00 exchange-local regime also follows DST',()=>{
  assert.deepEqual(darkFlowInitialWindow(rows(['2026-03-06T12:59:00Z','2026-03-06T13:00:00Z'])),{start:1,end:1});
  assert.deepEqual(darkFlowInitialWindow(rows(['2026-03-13T11:59:00Z','2026-03-13T12:00:00Z'])),{start:1,end:1});
});

test('regime switch is inclusive at New York March 30 midnight, determined by first recorded timestamp',()=>{
  const current=rows(['2026-03-30T04:00:00Z','2026-03-30T07:59:00Z','2026-03-30T08:00:00Z']);assert.deepEqual(darkFlowInitialWindow(current),{start:2,end:2});
  // UTC March 30 still falls in New York March 29 here. The source's old
  // >=08:00 predicate accepts that first 23:59 observation, not a guessed day.
  const previous=rows(['2026-03-30T03:59:00Z','2026-03-30T08:00:00Z','2026-03-30T12:00:00Z']);assert.deepEqual(darkFlowInitialWindow(previous),{start:0,end:2});
});

test('empty, malformed, or exclusively pre-cutoff data never fabricates a later bucket',()=>{
  for(const input of [[],null,[{time:null}],[{time:false}],[{time:''}],[{time:Infinity}],[{time:1e30}]])assert.equal(darkFlowInitialWindow(input),null);
  assert.equal(darkFlowInitialWindow(rows(['2026-10-16T06:00:00Z','2026-10-16T07:59:00Z'])),null);
});
