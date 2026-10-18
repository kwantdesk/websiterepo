import test from 'node:test';
import assert from 'node:assert/strict';
import {newYorkSessionDate,sessionMinuteTimestamp,sessionTimeline,snapshotRequest,snapshotKey,selectedSnapshotSpot} from '../../public/gex-data-app/snapshot-model.js';

test('snapshot selectors replace stale fields and never submit sessionDate plus snapshotTime',()=>{
  assert.deepEqual(snapshotRequest({sessionDate:'2026-10-16',filter:{ticker:'SPY'}},{snapshotTime:'2026-10-16T14:30Z'}),{filter:{ticker:'SPY'},snapshotTime:'2026-10-16T14:30:00.000Z'});
  assert.deepEqual(snapshotRequest({snapshotTime:'old'},{sessionDate:'2026-10-16'}),{sessionDate:'2026-10-16'});
  assert.throws(()=>snapshotRequest({},{sessionDate:'2026-10-16',snapshotTime:'2026-10-16T14:30Z'}),/mutually exclusive/);
  assert.throws(()=>snapshotRequest({},{sessionDate:'2026-02-30'}));
});

test('New York session open honors summer and winter DST offsets',()=>{
  assert.equal(new Date(sessionMinuteTimestamp('2026-03-06')).toISOString(),'2026-03-06T14:30:00.000Z');
  assert.equal(new Date(sessionMinuteTimestamp('2026-03-09')).toISOString(),'2026-03-09T13:30:00.000Z');
  assert.equal(new Date(sessionMinuteTimestamp('2026-10-30')).toISOString(),'2026-10-30T13:30:00.000Z');
  assert.equal(new Date(sessionMinuteTimestamp('2026-11-02')).toISOString(),'2026-11-02T14:30:00.000Z');
  assert.equal(newYorkSessionDate('2026-10-17T01:00:00Z'),'2026-10-16');
});

test('session timeline is one-minute instants with configurable observed close',()=>{
  const full=sessionTimeline('2026-10-16');assert.equal(full.length,391);assert.equal(full[0].minute,0);assert.equal(full.at(-1).minute,390);assert.equal(full.at(-1).snapshotTime,'2026-10-16T20:00:00.000Z');
  assert.equal(sessionTimeline('2026-11-27',{closeMinute:780}).length,211);
});

test('snapshot spot is exact or bounded same-session carry, never future or invented',()=>{
  const time=Date.parse('2026-10-16T14:30Z'),rows=[{time:time-60000,spot:770},{time:time+60000,spot:999}];
  assert.deepEqual(selectedSnapshotSpot(rows,time),{available:true,selectedTime:time,sessionDate:'2026-10-16',sourceTime:time-60000,spot:770,match:'bounded-carry',ageMs:60000});
  assert.equal(selectedSnapshotSpot([...rows,{time,spot:770.95}],time).match,'exact');
  assert.equal(selectedSnapshotSpot([{time:time-60001,spot:4}],time).available,false);
  assert.equal(selectedSnapshotSpot([{time,spot:null}],time).available,false);
  assert.equal(selectedSnapshotSpot([{time:time-86400000,spot:4}],time,{maxCarryMs:86400000}).available,false);
});

test('snapshot keys include selector and filters while remaining stable under key order',()=>{
  assert.equal(snapshotKey('heat-map',{dataMode:'NET_GAMMA_EXPOSURE',filter:{ticker:'SPY'},sessionDate:'2026-10-16'}),snapshotKey('heat-map',{sessionDate:'2026-10-16',filter:{ticker:'SPY'},dataMode:'NET_GAMMA_EXPOSURE'}));
  assert.notEqual(snapshotKey('heat-map',{sessionDate:'2026-10-16'}),snapshotKey('heat-map',{snapshotTime:'2026-10-16T14:30Z'}));
});
