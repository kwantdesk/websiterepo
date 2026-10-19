import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotControlTimeline,sessionMinuteTimestamp} from '../../public/gex-data-app/snapshot-model.js';

const schedule=(sessionDate,openMinute=570,closeMinute=975)=>({verified:true,sessionDate,timeZone:'America/New_York',openMinute,closeMinute});
const rowsFor=(date,minutes)=>minutes.map(minute=>({time:sessionMinuteTimestamp(date,minute),close:100+minute}));
const clock=(date,hour=23)=>Date.parse(`${date}T${String(hour).padStart(2,'0')}:00:00Z`);

test('SPY-proven9:30–16:15 schedule adds a separate close/latest sentinel, not a synthetic price bucket',()=>{
  const date='2026-10-16',source=rowsFor(date,[0,1,403,404]);
  const entries=snapshotControlTimeline(source,{sessionDate:date,schedule:schedule(date),now:clock(date)});
  assert.deepEqual(entries.map(row=>row.time),[...source.map(row=>row.time),Date.parse('2026-10-16T20:15Z')]);
  assert.equal(entries.at(-2).snapshotTime,'2026-10-16T20:15:00.000Z');
  assert.deepEqual(entries.at(-1),{time:Date.parse('2026-10-16T20:15Z'),sourceTime:null,kind:'latest'});
  assert.ok(!Object.hasOwn(entries.at(-1),'snapshotTime'));assert.ok(!Object.hasOwn(entries.at(-1),'close'));
  const zone=new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Brisbane',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  assert.equal(zone.format(entries[0].time),'23:30');assert.equal(zone.format(entries.at(-1).time),'06:15');
});

test('source gaps remain gaps and no closing value is invented from incomplete history',()=>{
  const date='2026-10-16',entries=snapshotControlTimeline(rowsFor(date,[0,5,390]),{sessionDate:date,schedule:schedule(date),now:clock(date)});
  assert.equal(entries.length,4);assert.equal(entries[1].time-entries[0].time,300000);
  assert.equal(entries.at(-1).sourceTime,null);assert.equal(entries.at(-1).kind,'latest');
  assert.deepEqual(snapshotControlTimeline([],{sessionDate:date,schedule:schedule(date),now:clock(date)}),[]);
});

test('live/current sessions do not expose a future close; newest actual row remains latest/unpin',()=>{
  const date='2026-10-19',source=rowsFor(date,[0,1,60]);
  const entries=snapshotControlTimeline(source,{sessionDate:date,schedule:schedule(date),now:Date.parse('2026-10-19T14:30:30Z')});
  assert.equal(entries.length,3);assert.equal(entries.at(-1).kind,'latest');assert.ok(!entries.at(-1).snapshotTime);
  assert.equal(entries[0].snapshotTime,'2026-10-19T13:31:00.000Z');
});

test('DST uses the selected date, and an explicit verified early close is honored',()=>{
  const date='2026-11-27',source=rowsFor(date,[0,223,224]);
  const entries=snapshotControlTimeline(source,{sessionDate:date,schedule:schedule(date,570,795),now:clock(date)});
  assert.equal(entries[0].time,Date.parse('2026-11-27T14:30Z'));
  assert.equal(entries.at(-2).snapshotTime,'2026-11-27T18:15:00.000Z');
  assert.equal(entries.at(-1).time,Date.parse('2026-11-27T18:15Z'));
  const zone=new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Brisbane',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  assert.equal(zone.format(entries.at(-1).time),'04:15');
});

test('absent/unverified/wrong-date/wrong-zone schedules cannot invent a terminal minute',()=>{
  const date='2026-10-16',source=rowsFor(date,[0,404]);
  for(const unproven of [null,{...schedule(date),verified:false},schedule('2026-10-19'),{...schedule(date),timeZone:'UTC'}]){
    const entries=snapshotControlTimeline(source,{sessionDate:date,schedule:unproven,now:clock(date)});
    assert.equal(entries.length,2);assert.equal(entries.at(-1).time,source.at(-1).time);assert.equal(entries.at(-1).kind,'latest');
  }
});

test('explicit equity/index ranges are honored without assuming all options close16:15',()=>{
  const date='2026-10-16',source=[{time:Date.parse('2026-10-16T07:59Z')},{time:Date.parse('2026-10-16T08:00Z')},{time:Date.parse('2026-10-16T23:59Z')}];
  const equity=snapshotControlTimeline(source,{sessionDate:date,schedule:schedule(date,240,1200),now:Date.parse('2026-10-17T02:00Z')});
  assert.equal(equity[0].time,Date.parse('2026-10-16T08:00Z'));assert.equal(equity.at(-1).time,Date.parse('2026-10-17T00:00Z'));
  const index=snapshotControlTimeline([{time:Date.parse('2026-10-16T04:00Z')},{time:Date.parse('2026-10-17T03:59Z')}],{sessionDate:date,schedule:schedule(date,0,1440),now:Date.parse('2026-10-17T05:00Z')});
  assert.equal(index.at(-2).snapshotTime,'2026-10-17T04:00:00.000Z');assert.equal(index.at(-1).time,Date.parse('2026-10-17T04:00Z'));
});

test('invalid bounds fail closed; duplicates, other sessions, future and non-minute source rows are excluded',()=>{
  const date='2026-10-16',time=Date.parse('2026-10-16T13:30Z');
  for(const bounds of [{openMinute:-1,closeMinute:975},{openMinute:975,closeMinute:570},{openMinute:570,closeMinute:1441},{openMinute:570.5,closeMinute:975}])assert.throws(()=>snapshotControlTimeline([time],{sessionDate:date,schedule:{...schedule(date),...bounds},now:clock(date)}),/bounds/);
  const entries=snapshotControlTimeline([time,time,time+1,NaN,Date.parse('2026-10-15T13:30Z'),Date.parse('2026-10-16T23:30Z')],{sessionDate:date,schedule:schedule(date),now:Date.parse('2026-10-16T14:30Z')});
  assert.deepEqual(entries,[{time,sourceTime:time,kind:'latest'}]);
  assert.throws(()=>snapshotControlTimeline([time],{sessionDate:date,now:NaN}));
});
