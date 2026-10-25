import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGexVueReplayState } from '../src/lib/gexVueReplay.ts';
import { selectWorkspaceReplaySession, workspaceReplayClockParts } from '../src/lib/workspaceReplay.ts';
import { compactTimeZoneLabel } from '../src/lib/timeZones.ts';

const state = createGexVueReplayState(Date.parse('2026-10-25T03:00Z'));
const at = (date, scope, time, zone) => selectWorkspaceReplaySession(state, date, scope, time, zone);

test('New York and selected local clocks resolve to the identical replay instant', () => {
  const expected = at('2026-10-23','charts','09:30','America/New_York');
  for (const [zone,time] of [['UTC','13:30'],['Australia/Brisbane','23:30'],['Asia/Kolkata','19:00'],['Australia/Adelaide','00:00'],['Pacific/Chatham','03:15'],['America/Los_Angeles','06:30']]) {
    const actual = at('2026-10-23','charts',time,zone);
    assert.equal(actual.timestampMs,expected.timestampMs,zone);
    assert.equal(actual.sessionDate,'2026-10-23');
    assert.equal(actual.startMs,expected.startMs); assert.equal(actual.endMs,expected.endMs);
  }
});

test('local calendar rollover selects the recording session, not a different date', () => {
  const nextMorning = at('2026-10-23','charts','06:00','Australia/Brisbane');
  assert.equal(new Date(nextMorning.timestampMs).toISOString(),'2026-10-23T20:00:00.000Z');
  assert.deepEqual(workspaceReplayClockParts(nextMorning.timestampMs,'Australia/Brisbane'),{date:'2026-10-24',hour:'06',minute:'00'});
  const previousEvening = at('2026-10-23','charts','08:00','Australia/Brisbane');
  assert.equal(previousEvening.timestampMs,previousEvening.startMs);
  assert.deepEqual(workspaceReplayClockParts(previousEvening.timestampMs,'Australia/Brisbane'),{date:'2026-10-23',hour:'08',minute:'00'});
});

test('winter New York offset and half-hour/quarter-hour zones are date accurate', () => {
  const winter = at('2026-01-12','charts','00:30','Australia/Brisbane');
  assert.equal(winter.timestampMs,at('2026-01-12','charts','09:30','America/New_York').timestampMs);
  assert.equal(new Date(winter.timestampMs).toISOString(),'2026-01-12T14:30:00.000Z');
  assert.match(compactTimeZoneLabel('America/New_York',new Date(winter.timestampMs)),/UTC−5/);
  assert.match(compactTimeZoneLabel('America/New_York',new Date('2026-10-23T13:30Z')),/UTC−4/);
});

test('every hourly session observation round-trips across supported representative zones', () => {
  const session = at('2026-10-23','charts','09:30','America/New_York');
  for(const zone of ['UTC','America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Dubai','Asia/Kolkata','Asia/Kathmandu','Asia/Tokyo','Australia/Brisbane','Australia/Adelaide','Pacific/Auckland','Pacific/Chatham']) {
    for(let timestamp=session.startMs;timestamp<=session.endMs;timestamp+=3_600_000){
      const local=workspaceReplayClockParts(timestamp,zone);
      assert.equal(at(session.sessionDate,'charts',`${local.hour}:${local.minute}`,zone).timestampMs,timestamp,`${zone} ${local.hour}:${local.minute}`);
    }
  }
});

test('DST changes do not alter the selected instant or exchange-session range', () => {
  for(const date of ['2026-03-06','2026-03-09','2026-10-30','2026-11-02']){
    const expected=at(date,'charts','09:30','America/New_York');
    const london=workspaceReplayClockParts(expected.timestampMs,'Europe/London');
    assert.equal(at(date,'charts',`${london.hour}:${london.minute}`,'Europe/London').timestampMs,expected.timestampMs);
  }
});

test('options sessions retain cash-market bounds in any selected display zone', () => {
  const actual=at('2026-10-23','gamma','01:00','Australia/Brisbane');
  assert.equal(actual.timestampMs,at('2026-10-23','gamma','11:00','America/New_York').timestampMs);
  assert.equal(actual.timestampMs,Date.parse('2026-10-23T15:00Z'));
  assert.throws(()=>at('2026-10-23','gamma','09:30','Australia/Brisbane'),/session range/);
});

test('invalid timezone, impossible dates and maintenance clocks never silently fall back', () => {
  assert.throws(()=>at('2026-10-23','charts','09:30','Not/A_Zone'),/valid time zone/);
  assert.throws(()=>at('2026-10-23','charts','07:30','Australia/Brisbane'),/session range/);
  assert.throws(()=>at('2026-01-12','charts','08:30','Australia/Brisbane'),/session range/);
  assert.throws(()=>at('2026-02-31','charts','09:30','UTC'),/valid session date/);
  assert.throws(()=>at('2026-99-99','charts','09:30','UTC'),/valid session date/);
  assert.throws(()=>at('2026-10-23','charts','24:00','UTC'),/valid start time/);
});

test('picker, shared dropdown and replay transport use the selected zone consistently', () => {
  const dialog=fs.readFileSync(new URL('../src/components/WorkspaceReplayDialog.tsx',import.meta.url),'utf8');
  const workspace=fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
  const dropdown=fs.readFileSync(new URL('../src/components/ui/TimeZoneSelect.tsx',import.meta.url),'utf8');
  assert.match(dialog,/menuLabel="Replay timezone" referenceTimestampMs=\{selection\?\.timestampMs \?\? bounds.startMs\}/);
  assert.match(dialog,/workspaceReplayClockParts\(selection.timestampMs, nextZone\)/);
  assert.match(dialog,/clockFormat.format\(selection.timestampMs\)/);
  assert.doesNotMatch(dialog,/Start time · New York|trading date and New York time/);
  assert.match(workspace,/initialTimeZone=\{chartSettings.timezone\}/);
  assert.match(workspace,/changeChartTimeZone\(timeZone\); setGexVueReplay\(next\)/);
  const transport=workspace.slice(workspace.indexOf('aria-label="Replay timeline"'),workspace.indexOf('aria-label="Replay timeline"')+1000);
  assert.match(transport,/timeZone: chartSettings.timezone/);
  assert.doesNotMatch(transport,/America\/New_York|\} ET/);
  assert.match(dropdown,/timeZoneOptions\(referenceDate\)/);
  assert.match(dropdown,/compactTimeZoneLabel\(normalizedValue, referenceDate\)/);
});

test('scrolling hour/minute choices keeps the picker open; Escape belongs to nested popup first', () => {
  const select=fs.readFileSync(new URL('../src/components/ui/KwantSelect.tsx',import.meta.url),'utf8');
  const dialog=fs.readFileSync(new URL('../src/components/WorkspaceReplayDialog.tsx',import.meta.url),'utf8');
  assert.match(select,/event.type === "scroll" && event.target instanceof Node && menuRef.current\?\.contains\(event.target\)/);
  assert.match(dialog,/if \(event.key === "Escape" && popup\) return/);
  assert.match(dialog,/const focusRoot = popup \?\? dialog.current/);
});
