import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  DEFAULT_DEEP_PROFILE_VALUES_SETTINGS,
  buildDeepProfileValuesFrame,
  normalizeDeepProfileValuesSettings,
} from "../src/lib/deepProfileValues.ts";

const tickSize = 1;
const row = (price, bid = 2, ask = 3, unknown = 0) => ({
  tickIndex: price, price, bidVolume: bid, askVolume: ask, unknownVolume: unknown,
  bidTrades: bid ? 1 : 0, askTrades: ask ? 1 : 0, unknownTrades: unknown ? 1 : 0,
  classifiedVolume: bid + ask, totalVolume: bid + ask + unknown, delta: ask - bid,
  deltaPercent: (ask - bid) / Math.max(1, bid + ask + unknown) * 100,
  isPoc: false, isValueArea: false, isBidImbalance: false, isAskImbalance: false,
  isStackedBidImbalance: false, isStackedAskImbalance: false, stackedBidVolume: 0, stackedAskVolume: 0,
  isUnfinishedAuctionHigh: false, isUnfinishedAuctionLow: false, isMaxBid: false, isMaxAsk: false,
  isMaxVolume: false, isMaxPositiveDelta: false, isMaxNegativeDelta: false, isMaxTrades: false,
  betweenVolume: unknown, betweenTrades: unknown ? 1 : 0, volume: bid + ask + unknown,
  bidImbalance: false, askImbalance: false,
});
const bar = (index, timestamp = index * 60_000, prices = [100 + index % 4]) => ({
  id: `b${index}`, instrument: "NQ", startTime: timestamp, endTime: timestamp + 60_000,
  timestamp, open: prices[0], high: Math.max(...prices), low: Math.min(...prices), close: prices.at(-1),
  openTick: prices[0], highTick: Math.max(...prices), lowTick: Math.min(...prices), closeTick: prices.at(-1),
  bidVolume: 2 * prices.length, askVolume: 3 * prices.length, unknownVolume: 0,
  classifiedVolume: 5 * prices.length, totalVolume: 5 * prices.length, delta: prices.length,
  deltaPercent: 20, deltaOpen: 0, deltaHigh: prices.length, deltaLow: 0, deltaClose: prices.length,
  bidTrades: prices.length, askTrades: prices.length, unknownTrades: 0, totalTrades: 2 * prices.length,
  levels: new Map(), rows: prices.map((price) => row(price)), pocTick: prices[0], valueAreaHighTick: prices.at(-1),
  valueAreaLowTick: prices[0], maxBidTick: prices[0], maxAskTick: prices[0], maxVolumeTick: prices[0],
  maxPositiveDeltaTick: prices[0], maxNegativeDeltaTick: prices[0], maxTradesTick: prices[0],
  vwap: prices[0], isClosed: index < 99, hasPriceLevelFlow: true, betweenVolume: 0,
  volume: 5 * prices.length, trades: 2 * prices.length, pocPrice: prices[0], deltaPocPrice: prices[0],
  vah: prices.at(-1), val: prices[0],
});

const normalized = normalizeDeepProfileValuesSettings({ periodMode: "bad", groupTicks: -2, valueAreaPercent: 120, numberOfProfiles: 0 });
assert.equal(normalized.periodMode, "multiples");
assert.equal(normalized.groupTicks, 1);
assert.equal(normalized.valueAreaPercent, 100);
assert.equal(normalized.numberOfProfiles, 1);

const bars = Array.from({ length: 12 }, (_, index) => ({ ...bar(index), isClosed: index < 11 }));
const composite = buildDeepProfileValuesFrame(bars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "composite", groupingMode: "manual", groupTicks: 1,
  pocLineMode: "developing", showDevelopingValueArea: true, showDevelopingVwap: true,
});
assert.equal(composite.status, "LIVE");
assert.equal(composite.profiles.length, 1);
assert.equal(composite.profiles[0].contractSymbol, "NQZ6");
assert.equal(composite.profiles[0].totalVolume, 60);
assert.equal(composite.profiles[0].developingPoc.length, bars.length);
assert.equal(composite.profiles[0].developingValueArea.length, bars.length);
assert.equal(composite.profiles[0].developingVwap.length, bars.length);
assert.ok(composite.profiles[0].poc !== null && composite.profiles[0].vah !== null && composite.profiles[0].val !== null);

const visible = buildDeepProfileValuesFrame(bars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "visible", groupingMode: "manual", groupTicks: 1,
}, undefined, { startMs: 3 * 60_000, endMs: 7 * 60_000 });
assert.equal(visible.profiles.length, 1);
assert.equal(visible.profiles[0].startMs, 3 * 60_000);
assert.equal(visible.profiles[0].endMs, 7 * 60_000);

const volumePeriods = buildDeepProfileValuesFrame(bars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "multiples", lengthType: "volume", lengthValue: 20,
  numberOfProfiles: 20, groupingMode: "manual", groupTicks: 1,
});
assert.equal(volumePeriods.profiles.length, 3);
assert.ok(volumePeriods.profiles.every((profile) => profile.totalVolume === 20));

const sessionStart = Date.UTC(2026, 8, 4, 13, 0);
const sessionBars = Array.from({ length: 8 }, (_, index) => bar(index, sessionStart + index * 60 * 60_000));
const split = buildDeepProfileValuesFrame(sessionBars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "composite", filterMode: "split",
  sessionStartMinutes: 8 * 60 + 30, sessionEndMinutes: 15 * 60 + 15, numberOfProfiles: 20,
});
assert.ok(split.profiles.length >= 2, "split time produces separate inside/outside session value sets");
assert.ok(new Set(split.profiles.map((profile) => profile.sessionLabel)).size >= 2);

assert.deepEqual(buildDeepProfileValuesFrame(bars, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, inputData: "order",
}), { status: "WAITING_FOR_ORDER_HISTORY", profiles: [] });
const noFlow = bars.map((item) => ({ ...item, rows: [], hasPriceLevelFlow: false }));
assert.deepEqual(buildDeepProfileValuesFrame(noFlow, "NQ", "NQZ6", tickSize), { status: "WAITING_FOR_VOLUME_AT_PRICE", profiles: [] });

const filteredTrades = [
  { recordIndex: 1, timestamp: 30_000, open: 110, high: 110, low: 110, close: 110, trades: 1, volume: 12, bidVolume: 0, askVolume: 12, delta: 12, aggressor: "BUY" },
  { recordIndex: 2, timestamp: 90_000, open: 90, high: 90, low: 90, close: 90, trades: 1, volume: 5, bidVolume: 5, askVolume: 0, delta: -5, aggressor: "SELL" },
];
const filteredDeveloping = buildDeepProfileValuesFrame(bars.slice(0, 2), "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "composite", filterMin: 10,
  pocLineMode: "developing", showDevelopingValueArea: true, showDevelopingVwap: true,
}, filteredTrades);
assert.equal(filteredDeveloping.profiles[0].totalVolume, 12);
assert.deepEqual(filteredDeveloping.profiles[0].developingPoc.map((point) => point.price), [110, 110]);
assert.deepEqual(filteredDeveloping.profiles[0].developingVwap.map((point) => point.price), [110, 110]);

const many = Array.from({ length: 20_000 }, (_, index) => bar(index));
const started = performance.now();
const performanceFrame = buildDeepProfileValuesFrame(many, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, periodMode: "multiples", lengthType: "minutes", lengthValue: 60,
  numberOfProfiles: 6, groupingMode: "manual", groupTicks: 1,
});
assert.equal(performanceFrame.profiles.length, 6);
assert.ok(performance.now() - started < 1_500, "20k exact rows remain interactive");

console.log("deep profile values tests passed");
