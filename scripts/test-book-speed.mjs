import assert from "node:assert/strict";
import { BookSpeedEngine, normalizeBookSpeedSettings } from "../src/lib/bookSpeed.ts";

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

console.log("Book Speed tests passed");
