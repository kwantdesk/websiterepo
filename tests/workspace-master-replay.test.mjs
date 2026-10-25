import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectWorkspaceReplaySession, workspaceReplaySessionBounds, replayObservationCount, WORKSPACE_REPLAY_LIVE_ONLY_INDICATORS } from '../src/lib/workspaceReplay.ts';
import { replayFormingCandle } from '../src/lib/replayFormingCandle.ts';
import { createGexVueReplayState, clampGexVueReplayTimestamp } from '../src/lib/gexVueReplay.ts';
const base = createGexVueReplayState(Date.parse('2026-10-25T03:00Z'));
test('Charts session spans Globex previous evening to venue close, not only RTH', () => {
  const state = workspaceReplaySessionBounds(base, '2026-10-23', 'charts');
  assert.equal(new Date(state.startMs).toISOString(), '2026-10-22T22:00:00.000Z');
  assert.equal(new Date(state.endMs).toISOString(), '2026-10-23T21:00:00.000Z');
  const selected = selectWorkspaceReplaySession(base, '2026-10-23', 'charts');
  assert.equal(new Date(selected.timestampMs).toISOString(), '2026-10-23T13:30:00.000Z');
  assert.equal(selected.active, true); assert.equal(selected.playing, false);
});
test('Evening selection is previous calendar evening and winter offset is accurate', () => {
  const summer = selectWorkspaceReplaySession(base, '2026-10-23', 'charts', '20:15');
  assert.equal(new Date(summer.timestampMs).toISOString(), '2026-10-23T00:15:00.000Z');
  const winter = selectWorkspaceReplaySession(base, '2026-01-12', 'charts', '18:00');
  assert.equal(new Date(winter.startMs).toISOString(), '2026-01-11T23:00:00.000Z');
  assert.equal(winter.startMs, winter.timestampMs);
});
test('GEX Vue preserves RTH bounds and invalid choices fail explicitly', () => {
  const state = selectWorkspaceReplaySession(base, '2026-10-23', 'gamma', '10:15');
  assert.equal(new Date(workspaceReplaySessionBounds(base, '2026-10-23', 'gamma').startMs).toISOString(), '2026-10-23T13:30:00.000Z');
  assert.equal(state.startMs, state.timestampMs);
  assert.throws(() => selectWorkspaceReplaySession(base, '2026-10-23', 'gamma', '18:00'));
  assert.throws(() => selectWorkspaceReplaySession(base, '2026-02-31', 'charts'));
  assert.throws(() => selectWorkspaceReplaySession(base, '2026-10-23', 'charts', '17:30'));
  assert.throws(() => selectWorkspaceReplaySession(base, '2026-10-23', 'charts', '24:00'));
});

test('selected replay time is the left edge, rewind floor and step/scrub floor; close stays the right edge', () => {
  for (const [scope, time, close] of [['charts', '11:45', '21:00'], ['gamma', '11:45', '20:00']]) {
    const selected = selectWorkspaceReplaySession(base, '2026-10-23', scope, time);
    assert.equal(selected.startMs, Date.parse('2026-10-23T15:45Z'));
    assert.equal(selected.timestampMs, selected.startMs);
    assert.equal(selected.endMs, Date.parse(`2026-10-23T${close}Z`));
    assert.equal(clampGexVueReplayTimestamp(selected, selected.startMs - 60_000), selected.startMs);
    assert.equal(clampGexVueReplayTimestamp(selected, selected.endMs + 60_000), selected.endMs);
    const midpoint = selected.startMs + (selected.endMs - selected.startMs) / 2;
    assert.equal(clampGexVueReplayTimestamp(selected, midpoint), midpoint);
    const reselected = selectWorkspaceReplaySession(selected, '2026-10-23', scope, '10:00');
    assert.equal(reselected.startMs, Date.parse('2026-10-23T14:00Z'), 'new selection can start earlier');
  }
  const closed = selectWorkspaceReplaySession(base, '2026-10-23', 'charts', '17:00');
  assert.equal(closed.startMs, closed.endMs);
  assert.equal(clampGexVueReplayTimestamp(closed, 0), closed.endMs);
  const source = fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /min=\{gexVueReplay.startMs\}\s+max=\{gexVueReplay.endMs\}/);
  assert.match(source, /timestampMs: current.startMs, playing: false/);
  assert.match(source, /aria-label="Jump to replay start"/);
});
test('Observation lookup handles empty, before-first, duplicates and backwards without future selection', () => {
  const rows = [10, 20, 20, 30].map(timestamp => ({ timestamp }));
  assert.equal(replayObservationCount([], 15), 0);
  for (const [clock, expected] of [[9, 0], [10, 1], [20, 3], [40, 4], [15, 1]]) assert.equal(replayObservationCount(rows, clock), expected);
});
test('Forming candle never borrows a final candle wick or future trade', () => {
  const prints = [{ timestamp: 900, close: 500, volume: 100 }, { timestamp: 1001, close: 100, volume: 2, askVolume: 2 }, { timestamp: 1002, close: 102, volume: 3, bidVolume: 3 }, { timestamp: 1003, close: 90, volume: 9, askVolume: 9 }];
  const candle = replayFormingCandle(1000, 1002, prints);
  assert.deepEqual(candle, { timestamp: 1000, open: 100, high: 102, low: 100, close: 102, volume: 5, trades: 2, bidVolume: 3, askVolume: 2, delta: -1, deltaOpen: 0, deltaHigh: 2, deltaLow: -1, deltaClose: -1 });
  assert.equal(replayFormingCandle(1000, 1000, prints), null);
  assert.equal(replayFormingCandle(1000, 1001, prints).close, 100);
  assert.equal(prints.length, 4);
});
test('Flow-only buckets cannot fabricate an execution price', () => {
  assert.equal(replayFormingCandle(1000, 2000, [{ timestamp: 1001, close: 200, volume: 100, flowOnly: true }]), null);
});
test('Master clock wiring, non-live tool controls and ledger isolation remain connected', () => {
  const source = fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /<WorkspaceReplayDialog state=\{gexVueReplay\}/);
  assert.match(source, /replayTimestampMs=\{gexVueReplay.active/);
  assert.match(source, /externalReplay=\{gexVueReplay.active/);
  assert.match(source, /replay=\{gexVueReplay.active/);
  assert.match(source, /const handleActiveChartExecutionQuote[\s\S]*?if \(gexVueReplay.active\) return/);
  assert.match(source, /paperPositions=\{gexVueReplay.active \? \[\]/);
  assert.match(source, /replayHistoryRange \? null : window.setInterval/);
  assert.match(source, /workspaceReplayCandles.size > 12 \|\| count > 80_000/);
  assert.ok(WORKSPACE_REPLAY_LIVE_ONLY_INDICATORS.has('mini-dom'));
  assert.ok(!WORKSPACE_REPLAY_LIVE_ONLY_INDICATORS.has('cumulative-volume-delta'));
});
test('Embedded source replay is authenticated, causal and snapshot cadence is completed-minute', () => {
  const kwanty = fs.readFileSync(new URL('../public/kwanty-app/app.js', import.meta.url), 'utf8');
  const data = fs.readFileSync(new URL('../public/gex-data-app/app.js', import.meta.url), 'utf8');
  assert.match(kwanty, /replayPrefix\(rows,masterReplay.timestampMs\)/);
  assert.match(kwanty, /cutoffTime=masterReplay\?\.timestampMs/);
  assert.match(kwanty, /masterReplaySerial/);
  assert.match(kwanty, /event.origin!==location.origin\|\|event.source!==parent/);
  assert.match(data, /Math.floor\(masterReplay.timestampMs\/60000\)\*60000-60000/);
  assert.match(data, /if\(masterReplay\)\{clearTimeout\(pollTimer\)/);
});
