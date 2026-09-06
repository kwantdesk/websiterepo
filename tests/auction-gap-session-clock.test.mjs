import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuctionGapSessionClock } from '../src/lib/auctionGapSessionClock.ts';
const calendar = { timeZone: 'America/Chicago', sessionOpenMinutes: 1020, rthStartMinutes: 510, rthEndMinutes: 900 };
const settings = { resetMode: 'eth-and-rth-open', filterTime: 'rth', customStartMinutes: 1320, customEndMinutes: 120 };
const clock = patch => new AuctionGapSessionClock(calendar, { ...settings, ...patch });
const at = (c, iso) => c.classify(Date.parse(iso));

test('RTH is half-open and its close does not create a false reset', () => {
  const c = clock();
  assert.equal(at(c, '2026-09-08T13:29:59Z').detect, false);
  assert.deepEqual(at(c, '2026-09-08T13:30:00Z'), { detect: true, resetKey: '2026-09-07:rth-open' });
  assert.equal(at(c, '2026-09-08T20:00:00Z').detect, false);
  assert.equal(at(c, '2026-09-08T20:00:00Z').resetKey, '2026-09-07:rth-open');
  assert.equal(at(c, '2026-09-08T22:00:00Z').resetKey, '2026-09-08:session-open');
});
test('Chicago RTH follows both DST offsets instead of fixed UTC hours', () => {
  const c = clock();
  assert.equal(at(c, '2026-03-06T14:30:00Z').detect, true);
  assert.equal(at(c, '2026-03-09T13:30:00Z').detect, true);
  assert.equal(at(c, '2026-10-30T13:30:00Z').detect, true);
  assert.equal(at(c, '2026-11-02T14:30:00Z').detect, true);
  assert.equal(at(c, '2026-11-02T13:30:00Z').detect, false);
});
test('fall-back repeated hour stays in same session; spring-forward does not shift its civil date', () => {
  const c = clock({ resetMode: 'session-open', filterTime: 'none' });
  assert.equal(at(c, '2026-11-01T06:30:00Z').resetKey, at(c, '2026-11-01T07:30:00Z').resetKey);
  assert.equal(at(c, '2026-03-08T08:00:00Z').resetKey, '2026-03-07');
});
test('custom overnight window includes start and excludes end; equal endpoints mean full day', () => {
  const c = clock({ filterTime: 'custom', resetMode: 'none' });
  assert.deepEqual(at(c, '2026-09-08T03:00:00Z'), { detect: true, resetKey: null });
  assert.equal(at(c, '2026-09-08T06:59:59Z').detect, true);
  assert.equal(at(c, '2026-09-08T07:00:00Z').detect, false);
  assert.equal(at(clock({ filterTime: 'custom', customStartMinutes: 0, customEndMinutes: 0 }), '2026-09-08T12:00:00Z').detect, true);
});
test('each execution is classified independently within a bar crossing a boundary', () => {
  const c = clock({ filterTime: 'eth' });
  assert.deepEqual(['2026-09-08T13:29:59Z', '2026-09-08T13:30:00Z'].map(t => at(c, t).detect), [true, false]);
});
test('calendar is supplied, immutable and invalid timestamps/settings fail clearly', () => {
  const config = { ...calendar, timeZone: 'America/New_York', sessionOpenMinutes: 0, rthStartMinutes: 570, rthEndMinutes: 960 };
  const c = new AuctionGapSessionClock(config, settings); config.rthStartMinutes = 0;
  assert.equal(at(c, '2026-09-08T13:29:00Z').detect, false);
  assert.equal(at(c, '2026-09-08T13:30:00Z').detect, true);
  const original = at(c, '2026-09-08T13:30:00Z'); original.detect = false;
  assert.equal(at(c, '2026-09-08T13:30:00Z').detect, true);
  assert.equal(c.classify(NaN), null); assert.equal(c.classify(Infinity), null);
  assert.throws(() => new AuctionGapSessionClock({ ...calendar, sessionOpenMinutes: 1440 }, settings));
  assert.throws(() => new AuctionGapSessionClock({ ...calendar, timeZone: 'bad/zone' }, settings));
});
