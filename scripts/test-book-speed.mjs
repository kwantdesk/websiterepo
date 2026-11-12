import assert from "node:assert/strict";
import { BookSpeedEngine, bookSpeedSource, matchesBookSpeedContract, normalizeBookSpeedSettings, projectBookSpeedBuckets } from "../src/lib/bookSpeed.ts";

const level = (side, price, size) => ({ side, price, size, orders: 1, emaSize: size, peakSize: size, observations: 1, stableObservations: 1, persistenceMs: 1_000, addedSize: 0, removedSize: 0 });
const snapshot = (timestamp, levels, trades = [], extra = {}) => ({
  asOf: new Date(timestamp).toISOString(), contractSymbol: "NQU6", tickSize: 0.25,
  fullDepth: true, bookValid: true, individualOrders: false, ageMs: 0,
  bestBid: 99.75, bestAsk: 100, lastPrice: 100, levels, trades, orderEvents: [], ...extra,
});

const settings = normalizeBookSpeedSettings({ parameterMode: "seconds", parameterValue: 10, averageLength: 2 });
assert.equal(settings.parameterValue, 10);
assert.equal(normalizeBookSpeedSettings({ parameterMode: "tick-reversal", parameterValue: -5 }).parameterValue, 1);

const engine = new BookSpeedEngine();
engine.apply(snapshot(10_000, [level("BID", 99.75, 5), level("ASK", 100, 5)]), settings);
let frame = engine.apply(snapshot(11_000, [level("BID", 99.75, 5)], [{ id: 1, timestamp: 11_000, price: 100, size: 5, side: "BUY" }]), settings);
assert.equal(frame.currentAsk, 1, "an exhausted Ask with an aggressive Buy counts once");
frame = engine.apply(snapshot(12_000, [level("BID", 99.75, 5)], [{ id: 1, timestamp: 11_000, price: 100, size: 5, side: "BUY" }]), settings);
assert.equal(frame.currentAsk, 1, "the same execution batch cannot be counted twice");
frame = engine.apply(snapshot(20_000, [level("BID", 99.75, 5)]), settings);
assert.equal(frame.buckets[0].askLevels, 1, "seconds mode closes the completed measurement window");
assert.equal(frame.buckets[0].averageAsk, -1, "Ask averages remain below the zero baseline");

const pullEngine = new BookSpeedEngine();
pullEngine.apply(snapshot(10_000, [level("ASK", 100, 5)]), settings);
frame = pullEngine.apply(snapshot(11_000, []), settings);
assert.equal(frame.currentAsk, 0, "a cancellation or pull without execution does not count");

const partialEngine = new BookSpeedEngine();
partialEngine.apply(snapshot(10_000, [level("ASK", 100, 5)]), settings);
frame = partialEngine.apply(snapshot(11_000, [level("ASK", 100, 2)], [{ id: 2, timestamp: 11_000, price: 100, size: 3, side: "BUY" }]), settings);
assert.equal(frame.currentAsk, 0, "a partially consumed level is not a fully consumed book level");

const bidEngine = new BookSpeedEngine();
bidEngine.apply(snapshot(10_000, [level("BID", 99.75, 4)]), settings);
frame = bidEngine.apply(snapshot(11_000, [], [{ id: 3, timestamp: 11_000, price: 99.75, size: 4, side: "SELL" }]), settings);
assert.equal(frame.currentBid, 1, "an exhausted Bid with an aggressive Sell counts once");

const reversal = new BookSpeedEngine();
const reversalSettings = normalizeBookSpeedSettings({ parameterMode: "tick-reversal", parameterValue: 4 });
reversal.apply(snapshot(1_000, [], [], { lastPrice: 100 }), reversalSettings);
reversal.apply(snapshot(2_000, [], [], { lastPrice: 101 }), reversalSettings);
frame = reversal.apply(snapshot(3_000, [], [], { lastPrice: 100 }), reversalSettings);
assert.equal(frame.buckets.filter((bucket) => !bucket.provisional).length, 1, "a four-tick reversal closes the active measurement");

const bounded = new BookSpeedEngine();
const boundedSettings = normalizeBookSpeedSettings({ parameterMode: "seconds", parameterValue: 1, historyBuckets: 100 });
const started = performance.now();
for (let index = 0; index < 5_000; index += 1) {
  frame = bounded.apply(snapshot(100_000 + index * 1_000, [level("BID", 99.75, 10), level("ASK", 100, 10)]), boundedSettings);
}
assert.ok(frame.buckets.length <= 100, "live history remains bounded");
assert.ok(performance.now() - started < 5_000, "five thousand order-book frames stay inside the calculation budget");

const continuity = new BookSpeedEngine();
const ask = level("ASK", 100, 100);
continuity.apply(snapshot(20_000, [ask]), settings);
frame = continuity.apply(snapshot(19_000, [], [{ id: 4, timestamp: 19_000, price: 100, size: 100, side: "BUY" }]), settings);
assert.equal(frame.generatedAt, 20_000, "older snapshots cannot move the frame backwards");
frame = continuity.apply(snapshot(21_000, [], [{ id: 5, timestamp: 21_000, price: 100, size: 1, side: "BUY" }]), settings);
assert.equal(frame.currentAsk, 0, "a one-lot buy does not confirm depletion of a hundred-lot level");
continuity.apply(snapshot(22_000, [ask], [], { bookValid: false }), settings);
frame = continuity.apply(snapshot(23_000, [], [{ id: 6, timestamp: 23_000, price: 100, size: 100, side: "BUY" }]), settings);
assert.equal(frame.currentAsk, 0, "the first healthy frame only seeds depth after an invalid book");
frame = continuity.apply(snapshot(180_000, [], [], { ageMs: 157_000 }), settings);
assert.equal(frame.status, "STALE");
assert.equal(frame.buckets.length, 0, "a stale feed does not add completed zero buckets");
const skipped = new BookSpeedEngine();
skipped.apply(snapshot(10_000, [ask]), settings);
frame = skipped.apply(snapshot(40_000, [], [{ id: 7, timestamp: 40_000, price: 100, size: 100, side: "BUY" }]), settings);
assert.equal(frame.currentAsk, 0, "missing windows must not supply a comparison depth baseline");
assert.equal(frame.buckets.length, 1, "only the newly observed window is present after a gap");

const source = bookSpeedSource("MNQ.v.0", "NQZ6");
assert.deepEqual(source, { root: "MNQ", contract: null });
assert.deepEqual(bookSpeedSource("MESZ6", "MESU6"), { root: "MES", contract: "MESZ6" });
assert.equal(matchesBookSpeedContract("MNQ", null, "NQZ6"), false);
assert.equal(matchesBookSpeedContract("MNQ", "MNQZ26", "MNQZ6"), true);
assert.equal(matchesBookSpeedContract("MNQ", "MNQZ26", "MNQU6"), false);

const timestamps = new BookSpeedEngine();
frame = timestamps.apply(snapshot(20_000, [ask], [], { depthAsOf: new Date(10_000).toISOString() }), settings);
assert.equal(frame.generatedAt, 10_000, "presentation time cannot advance depth time");
frame = timestamps.apply(snapshot(30_000, [], [], { depthUpdated: false }), settings);
assert.equal(frame.generatedAt, 10_000, "quote-only frames cannot create measurement windows");
frame = timestamps.apply(snapshot(11_000, [], [
  { id: 8, timestamp: 11_000, price: 100, size: 40, side: "BUY" },
  { id: 9, timestamp: 11_000, price: 100, size: 60, side: "BUY" },
]), settings);
assert.equal(frame.currentAsk, 1, "same-price execution quantities add up");
timestamps.interrupt();
frame = timestamps.apply(snapshot(13_000, [ask]), settings);
assert.equal(frame.currentAsk, 0, "reconnect cannot carry an old provisional count");

const window = (startMs, endMs, bidLevels, askLevels, provisional = false) =>
  ({ startMs, endMs, bidLevels, askLevels, provisional, averageBid: bidLevels, averageAsk: -askLevels });
const windows = [window(10_000, 20_000, 1, 2), window(20_000, 30_000, 3, 4),
  window(30_000, 60_000, 2, 5), window(60_000, 65_000, 1, 0, true)];
const projected = projectBookSpeedBuckets(windows, [{ timestamp: 0 }, { timestamp: 60_000 }], time => time / 1000, 60_000);
assert.deepEqual(projected.map(({ time, bidLevels, askLevels, windows }) => [time, bidLevels, askLevels, windows]),
  [[0, 6, 11, 3], [60, 1, 0, 1]], "counts in every seconds window appear on the same host candle");
const event = projectBookSpeedBuckets([window(10_000, 10_480, 1, 2), window(10_480, 10_810, 3, 4)],
  [{ timestamp: 10_010 }, { timestamp: 10_500 }], time => time === 10_010 ? 10 : 11, null);
assert.deepEqual(event.map(({ time, bidLevels, askLevels }) => [time, bidLevels, askLevels]),
  [[10, 1, 2], [11, 3, 4]], "event bars in one wall-clock second retain distinct chart times");

console.log("Book Speed tests passed");
