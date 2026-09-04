import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  DEFAULT_DEEP_PROFILE_SWING_SETTINGS,
  buildDeepProfileSwingFrame,
  detectDeepProfileSwingRanges,
  normalizeDeepProfileSwingSettings,
} from "../src/lib/deepProfileSwing.ts";

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
const bar = (index, close, prices = [close]) => ({
  id: `b${index}`, instrument: "NQ", startTime: index * 60_000, endTime: (index + 1) * 60_000,
  timestamp: index * 60_000, open: close, high: close + 1, low: close - 1, close,
  openTick: close, highTick: close + 1, lowTick: close - 1, closeTick: close,
  bidVolume: 2 * prices.length, askVolume: 3 * prices.length, unknownVolume: 0,
  classifiedVolume: 5 * prices.length, totalVolume: 5 * prices.length, delta: prices.length,
  deltaPercent: 20, deltaOpen: 0, deltaHigh: prices.length, deltaLow: 0, deltaClose: prices.length,
  bidTrades: prices.length, askTrades: prices.length, unknownTrades: 0, totalTrades: 2 * prices.length,
  levels: new Map(), rows: prices.map((price) => row(price)), pocTick: prices[0], valueAreaHighTick: prices.at(-1),
  valueAreaLowTick: prices[0], maxBidTick: prices[0], maxAskTick: prices[0], maxVolumeTick: prices[0],
  maxPositiveDeltaTick: prices[0], maxNegativeDeltaTick: prices[0], maxTradesTick: prices[0],
  vwap: close, isClosed: index < 99, hasPriceLevelFlow: true, betweenVolume: 0, volume: 5 * prices.length,
  trades: 2 * prices.length, pocPrice: prices[0], deltaPocPrice: prices[0], vah: prices.at(-1), val: prices[0],
});

const normalized = normalizeDeepProfileSwingSettings({ profileMode: "bad", groupTicks: -4, valueAreaPercent: 130, swingMinTicks: 30, swingMaxTicks: 2 });
assert.equal(normalized.profileMode, "volume");
assert.equal(normalized.groupTicks, 1);
assert.equal(normalized.valueAreaPercent, 100);
assert.equal(normalized.swingMaxTicks, 30);

const turns = [100, 102, 105, 107, 104, 101, 98, 101, 105].map((close, index) => bar(index, close));
const ranges = detectDeepProfileSwingRanges(turns, normalizeDeepProfileSwingSettings({ reversalTicks: 3, includeReversalBar: true }), tickSize);
assert.ok(ranges.length >= 2, "tick reversal produces multiple confirmed swing ranges");
assert.equal(ranges[0].start, 0);
assert.equal(ranges.at(-1).end, turns.length - 1);

const pivots = detectDeepProfileSwingRanges(turns, normalizeDeepProfileSwingSettings({ swingType: "left-right-bars", leftBars: 1, rightBars: 1 }), tickSize);
assert.ok(pivots.length >= 2, "left/right bars confirms pivots");

const frame = buildDeepProfileSwingFrame(turns.map((item, index) => ({ ...item, isClosed: index < turns.length - 1 })), "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_SWING_SETTINGS, reversalTicks: 3, groupingMode: "manual", groupTicks: 1, maxProfiles: 20,
});
assert.equal(frame.status, "LIVE");
assert.ok(frame.profiles.length >= 2);
assert.equal(frame.profiles[0].provider, "Rithmic");
assert.equal(frame.profiles[0].contractSymbol, "NQZ6");
assert.ok(frame.profiles.every((profile) => profile.totalVolume === profile.levels.reduce((sum, level) => sum + level.volume, 0)));

const filtered = buildDeepProfileSwingFrame(turns, "NQ", "NQZ6", tickSize, {
  ...DEFAULT_DEEP_PROFILE_SWING_SETTINGS, reversalTicks: 3, filterMin: 10,
}, [
  { recordIndex: 1, timestamp: 1_000, open: 100, high: 100, low: 100, close: 100, trades: 1, volume: 4, bidVolume: 4, askVolume: 0, delta: -4, aggressor: "SELL" },
  { recordIndex: 2, timestamp: 2_000, open: 101, high: 101, low: 101, close: 101, trades: 1, volume: 15, bidVolume: 0, askVolume: 15, delta: 15, aggressor: "BUY" },
]);
assert.ok(filtered.profiles.length > 0);
assert.ok(filtered.profiles.every((profile) => profile.totalVolume === 15), "execution filters apply before price aggregation");

const openEnded = turns.map((item, index) => index === turns.length - 1 ? { ...item, endTime: Number.POSITIVE_INFINITY, isClosed: false } : item);
const openFrame = buildDeepProfileSwingFrame(openEnded, "NQ", "NQZ6", tickSize, { ...DEFAULT_DEEP_PROFILE_SWING_SETTINGS, reversalTicks: 3 });
assert.equal(openFrame.status, "LIVE");
assert.ok(openFrame.profiles.every((profile) => Number.isFinite(profile.endMs) && !Number.isNaN(Date.parse(profile.asOf))), "forming event bars never leak an infinite time into the renderer");

const noFlow = turns.map((item) => ({ ...item, rows: [], hasPriceLevelFlow: false }));
assert.deepEqual(buildDeepProfileSwingFrame(noFlow, "NQ", "NQZ6", tickSize), { status: "WAITING_FOR_VOLUME_AT_PRICE", profiles: [] });

const many = Array.from({ length: 20_000 }, (_, index) => bar(index, 10_000 + Math.sin(index / 15) * 20));
const started = performance.now();
detectDeepProfileSwingRanges(many, normalizeDeepProfileSwingSettings({ swingType: "highest-lowest", reversalTicks: 40 }), tickSize);
assert.ok(performance.now() - started < 1_500, "20k-bar highest/lowest scan stays interactive");

console.log("deep profile swing tests passed");
