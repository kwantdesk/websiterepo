import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuctionGapStudySession } from '../src/lib/auctionGapStudySession.ts';
import { calculateAuctionGapStudy } from '../src/lib/auctionGapStudy.ts';
import { runAuctionGapWorkerJob } from '../src/lib/auctionGap.worker.ts';
const start = Date.parse('2026-09-08T13:30:00Z');
function fixture(index = 0, prices = [100.25, 100.5, 100.75], isClosed = false) {
  const timestamp = start + index * 60000;
  return { contractSymbol: 'NQU6', expectedContract: 'NQU6', tickSize: .25,
    asOfMs: timestamp + 59999, coverage: 'complete', chart: { kind: 'time' },
    records: prices.map((price, i) => ({ recordIndex: index * 100 + i, timestamp: timestamp + i,
      open: price, high: price, low: price, close: price, volume: 10, trades: 1, bidVolume: 0, askVolume: 10 })),
    candles: [{ timestamp, open: prices[0], high: Math.max(...prices), low: Math.min(...prices), close: prices.at(-1), volume: prices.length * 10 }],
    geometry: [{ id: `bar${index}`, timestamp, endTime: timestamp + 60000, openTick: prices[0] * 4,
      highTick: Math.max(...prices) * 4, lowTick: Math.min(...prices) * 4, closeTick: prices.at(-1) * 4, isClosed }],
    calendar: { timeZone: 'America/Chicago', sessionOpenMinutes: 1020, rthStartMinutes: 510, rthEndMinutes: 900 },
    timeSettings: { resetMode: 'none', filterTime: 'none', customStartMinutes: 0, customEndMinutes: 0 },
    detectionSettings: { includeMode: 'all' }, lifecycleSettings: { extendedBars: 200, retestMode: 'touch', showTriggered: true, onlyTriggered: false } };
}
const combine = (a, b) => ({ ...b, records: [...a.records, ...b.records], candles: [...a.candles, ...b.candles], geometry: [...a.geometry, ...b.geometry] });

test('validated seed, forming correction, finalization and next bar match full source reconstruction', () => {
  const session = new AuctionGapStudySession(), seed = fixture();
  assert.deepEqual(session.reset('nq:1m', seed), calculateAuctionGapStudy(seed));
  const replacement = fixture(0, [100.25, 100.5]);
  assert.deepEqual(session.updateTimeTail('nq:1m', 0, replacement), calculateAuctionGapStudy(replacement));
  const closed = fixture(0, undefined, true);
  assert.deepEqual(session.updateTimeTail('nq:1m', 0, closed), calculateAuctionGapStudy(closed));
  const next = fixture(1, [100.5]);
  assert.deepEqual(session.updateTimeTail('nq:1m', 1, next), calculateAuctionGapStudy(combine(closed, next)));
  const corrected = fixture(1, [102]);
  assert.deepEqual(session.updateTimeTail('nq:1m', 1, corrected), calculateAuctionGapStudy(combine(closed, corrected)));
});

test('missing finalization, skipped bars, changed scope/settings and replay rewind require reconstruction', () => {
  const session = new AuctionGapStudySession(); session.reset('a', fixture());
  assert.equal(session.updateTimeTail('a', 1, fixture(1)).reason, 'requires-rebuild');
  session.updateTimeTail('a', 0, fixture(0, undefined, true));
  assert.equal(session.updateTimeTail('a', 2, fixture(2)).reason, 'requires-rebuild');
  assert.equal(session.updateTimeTail('b', 0, fixture()).reason, 'requires-rebuild');
  const changed = fixture(); changed.detectionSettings.minimumConsecutiveLevels = 4;
  assert.equal(session.updateTimeTail('a', 0, changed).reason, 'requires-rebuild');
  const rewind = fixture(); rewind.asOfMs--;
  assert.equal(session.updateTimeTail('a', 0, rewind).reason, 'requires-rebuild');
});

test('tail source errors retain valid seed; failed replacement history invalidates it', () => {
  const session = new AuctionGapStudySession(), seed = fixture(); session.reset('a', seed);
  const missing = fixture(); missing.records.pop();
  assert.equal(session.updateTimeTail('a', 0, missing).reason, 'source-chart-mismatch');
  assert.deepEqual(session.updateTimeTail('a', 0, seed), calculateAuctionGapStudy(seed));
  assert.equal(session.reset('a', missing).status, 'unavailable');
  assert.equal(session.updateTimeTail('a', 0, seed).reason, 'requires-rebuild');
});

test('actual worker dispatcher preserves session between history and tail messages', () => {
  const session = new AuctionGapStudySession();
  const history = runAuctionGapWorkerJob({ scope: 'a', revision: 1, input: fixture() }, session);
  assert.equal(history.result.zones.length, 1);
  const updated = runAuctionGapWorkerJob({ scope: 'a', revision: 2, operation: 'time-tail', chartIndex: 0,
    input: fixture(0, [100.5]) }, session);
  assert.equal(updated.result.status, 'ready'); assert.equal(updated.result.zones.length, 0);
  assert.equal(updated.revision, 2);
});
