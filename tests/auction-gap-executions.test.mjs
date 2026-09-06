import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareAuctionGapExecutions } from '../src/lib/auctionGapExecutions.ts';
import { AuctionGapSessionClock } from '../src/lib/auctionGapSessionClock.ts';
const clock = new AuctionGapSessionClock({ timeZone: 'America/Chicago', sessionOpenMinutes: 1020, rthStartMinutes: 510, rthEndMinutes: 900 },
  { resetMode: 'session-open', filterTime: 'rth', customStartMinutes: 0, customEndMinutes: 0 });
const now = Date.parse('2026-09-08T13:30:00Z');
const trade = (recordIndex, extra = {}) => ({ recordIndex, timestamp: now, open: 100, high: 100, low: 100, close: 100,
  volume: 10, bidVolume: 0, askVolume: 0, aggressor: 'BUY', ...extra });
const run = (records, extra = {}) => prepareAuctionGapExecutions({ contractSymbol: 'NQU6', expectedContract: 'NQU6',
  tickSize: .25, asOfMs: now, coverage: 'complete', records, ...extra }, clock);
test('real executions retain individual identity, exact volume and exchange clock classification', () => {
  const out = run([trade(1, { timestamp: now - 1 }), trade(2)]);
  assert.equal(out.status, 'ready'); assert.equal(out.executions.length, 2);
  assert.deepEqual(out.executions.map(t => [t.tickIndex, t.askVolume, t.detect]), [[400, 10, false], [400, 10, true]]);
});
test('replay cut excludes future prints without creating future zones', () => {
  assert.equal(run([trade(1), trade(2, { timestamp: now + 1 })]).executions.length, 1);
});
test('deduplicate exact identities but reject conflicting replay/correction duplicates', () => {
  assert.equal(run([trade(1), trade(1)]).executions.length, 1);
  assert.equal(run([trade(1), trade(1, { volume: 20 })]).status, 'invalid-data');
  assert.equal(run([trade(1), trade(2)]).executions.length, 2);
});
test('partial, aggregate, mixed-contract and out-of-order sources are never marked ready', () => {
  assert.equal(run([], { coverage: 'partial' }).status, 'partial-history');
  assert.equal(run([trade(1, { flowOnly: true })]).status, 'requires-executions');
  assert.equal(run([trade(1, { high: 101 })]).status, 'requires-executions');
  assert.equal(run([trade(1)], { contractSymbol: 'NQZ6' }).status, 'invalid-data');
  assert.equal(run([trade(1), trade(2, { timestamp: now - 1 })]).status, 'invalid-data');
});
test('off-tick/corrupt volumes rejected; valid negative futures prices supported', () => {
  assert.equal(run([trade(1, { close: 100.1, open: 100.1, high: 100.1, low: 100.1 })]).status, 'invalid-data');
  assert.equal(run([trade(1, { bidVolume: 11 })]).status, 'invalid-data');
  assert.equal(run([trade(1, { bidVolume: -1 })]).status, 'invalid-data');
  assert.equal(run([trade(1, { open: -.25, high: -.25, low: -.25, close: -.25 })]).executions[0].tickIndex, -1);
});
test('partial side classification preserves unknown volume rather than inventing an absent side', () => {
  const record = trade(1, { bidVolume: 2, askVolume: 3 }); const before = structuredClone(record);
  assert.equal(run([record]).executions[0].unknownVolume, 5); assert.deepEqual(record, before);
  assert.equal(run([trade(2, { aggressor: 'UNKNOWN' })]).executions[0].unknownVolume, 10);
});
