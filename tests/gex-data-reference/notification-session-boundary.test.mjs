import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationReferenceSession,notificationRequest} from '../../public/gex-data-app/exchange-notification-interaction-model.js';
import {validateGexDataRequest} from '../../src/lib/gexDataPolicy.ts';

test('notification UI single sessions start09:30 New York across DST without changing explicit ranges',()=>{
  for(const [date,start,end] of [['2026-10-30','2026-10-30T13:30:00.000Z','2026-10-31T04:00:00.000Z'],['2026-11-09','2026-11-09T14:30:00.000Z','2026-11-10T05:00:00.000Z']]){
    const input={sessionDate:date,filter:{types:['LUDP']},searchAfter:['original']},copy=structuredClone(input);
    const result=notificationRequest(notificationReferenceSession(input));assert.deepEqual(result.timeRange,{startTime:start,endTime:end});assert.equal(result.sessionDate,undefined);assert.deepEqual(result.searchAfter,['original']);assert.deepEqual(input,copy);assert.doesNotThrow(()=>validateGexDataRequest('exchange-notifications',result));
  }
  const explicit={timeRange:{startTime:'2026-11-09T05:00:00Z',endTime:'2026-11-10T05:00:00Z'},filter:{tickers:['ZWZZT']}};
  assert.deepEqual(notificationReferenceSession(explicit),explicit);
  assert.deepEqual(notificationRequest({sessionDate:'2026-11-09'}).sessionDate,'2026-11-09','generic public contract remains unchanged');
  assert.throws(()=>notificationReferenceSession({sessionDate:'2026-02-30'}),/session date/);
});
