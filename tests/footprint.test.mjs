import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFootprintBars,
  formatFootprintValue,
  priceToTickIndex,
  tickIndexToPrice,
} from "../src/lib/footprint.ts";
import {
  applyFootprintPreset,
  DEFAULT_FOOTPRINT_SETTINGS,
  validateFootprintTemplates,
  validateFootprintSettings,
} from "../src/lib/footprintSettings.ts";

const candles = [
  { timestamp: 1_000, open: 100, high: 101, low: 99.75, close: 100.75, volume: 50 },
  { timestamp: 61_000, open: 100.75, high: 101.5, low: 100.5, close: 101.25, volume: 40 },
];

const trade = (overrides) => ({
  recordIndex: 0,
  timestamp: 2_000,
  open: 100,
  high: 100,
  low: 100,
  close: 100,
  trades: 1,
  volume: 1,
  bidVolume: 0,
  askVolume: 1,
  delta: 1,
  aggressor: "BUY",
  ...overrides,
});

const defaults = {
  tickSize: 0.25,
  groupTicks: 1,
  minimumTradeVolume: 0,
  maximumTradeVolume: 0,
  imbalanceMode: "diagonal",
  minimumImbalancePercent: 300,
  minimumDelta: 1,
  includeZero: false,
};

test("aggregates executed bid and ask volume into candle price rows", () => {
  const bars = buildFootprintBars(candles, [
    trade({ recordIndex: 0, close: 100, volume: 12, askVolume: 10, bidVolume: 2, trades: 3 }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100, volume: 8, askVolume: 1, bidVolume: 7, trades: 2 }),
    trade({ recordIndex: 2, timestamp: 62_000, close: 101.25, volume: 9, askVolume: 9, bidVolume: 0 }),
  ], defaults);

  assert.equal(bars.length, 2);
  assert.equal(bars[0].rows.length, 1);
  assert.equal(bars[0].rows[0].price, 100);
  assert.equal(bars[0].rows[0].askVolume, 11);
  assert.equal(bars[0].rows[0].bidVolume, 9);
  assert.equal(bars[0].delta, 2);
  assert.equal(bars[1].rows[0].price, 101.25);
  assert.equal(bars[1].askVolume, 9);
});

test("marks diagonal ask and bid imbalances against the adjacent price", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, close: 100, volume: 2, askVolume: 0, bidVolume: 2, aggressor: "SELL" }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100.25, volume: 12, askVolume: 12, bidVolume: 0 }),
    trade({ recordIndex: 2, timestamp: 4_000, close: 100.5, volume: 12, askVolume: 0, bidVolume: 12, aggressor: "SELL" }),
    trade({ recordIndex: 3, timestamp: 5_000, close: 100.75, volume: 2, askVolume: 2, bidVolume: 0 }),
  ], defaults);

  const byPrice = new Map(bars[0].rows.map((row) => [row.price, row]));
  assert.equal(byPrice.get(100.25).askImbalance, true);
  assert.equal(byPrice.get(100.5).bidImbalance, true);
});

test("calculates per-bar volume POC and fixed 70 percent value area", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, close: 100, volume: 20, askVolume: 10, bidVolume: 10 }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100.25, volume: 50, askVolume: 30, bidVolume: 20 }),
    trade({ recordIndex: 2, timestamp: 4_000, close: 100.5, volume: 20, askVolume: 10, bidVolume: 10 }),
    trade({ recordIndex: 3, timestamp: 5_000, close: 100.75, volume: 10, askVolume: 5, bidVolume: 5 }),
  ], defaults);

  assert.equal(bars[0].pocPrice, 100.25);
  assert.equal(bars[0].val, 100);
  assert.equal(bars[0].vah, 100.5);
});

test("honours trade-size filtering without inventing footprint volume", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, volume: 4, askVolume: 4 }),
    trade({ recordIndex: 1, timestamp: 3_000, volume: 10, askVolume: 10 }),
    trade({ recordIndex: 2, timestamp: 4_000, volume: 30, askVolume: 30 }),
  ], { ...defaults, minimumTradeVolume: 5, maximumTradeVolume: 20 });

  assert.equal(bars[0].volume, 10);
  assert.equal(bars[0].rows.length, 1);
});

test("preserves unclassified executions as between-market footprint volume", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({
      recordIndex: 0,
      close: 100.25,
      volume: 10,
      askVolume: 0,
      bidVolume: 0,
      trades: 2,
      aggressor: "UNKNOWN",
    }),
  ], defaults);

  assert.equal(bars[0].rows[0].betweenVolume, 10);
  assert.equal(bars[0].rows[0].betweenTrades, 2);
  assert.equal(bars[0].betweenVolume, 10);
  assert.equal(bars[0].volume, 10);
  assert.equal(bars[0].delta, 0);
  assert.equal(bars[0].vwap, 100.25);
});

test("calculates execution-weighted VWAP and the intrabar delta path", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({
      recordIndex: 0,
      close: 100,
      volume: 8,
      askVolume: 0,
      bidVolume: 8,
      aggressor: "SELL",
    }),
    trade({
      recordIndex: 1,
      timestamp: 3_000,
      close: 100.5,
      volume: 15,
      askVolume: 15,
      bidVolume: 0,
      aggressor: "BUY",
    }),
  ], defaults);

  assert.ok(Math.abs(bars[0].vwap - ((100 * 8 + 100.5 * 15) / 23)) < 1e-9);
  assert.equal(bars[0].deltaOpen, 0);
  assert.equal(bars[0].deltaHigh, 7);
  assert.equal(bars[0].deltaLow, -8);
  assert.equal(bars[0].deltaClose, 7);
});

test("groups prices by exchange ticks without rounding across bucket boundaries", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, close: 100, volume: 2, askVolume: 2 }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100.25, volume: 3, askVolume: 3 }),
    trade({ recordIndex: 2, timestamp: 4_000, close: 100.5, volume: 4, askVolume: 4 }),
  ], { ...defaults, groupTicks: 2 });

  assert.deepEqual(
    bars[0].rows.map((row) => [row.price, row.volume]),
    [[100, 5], [100.5, 4]],
  );
});

test("formats large footprint cells compactly", () => {
  assert.equal(formatFootprintValue(12_450, "automatic"), "12.4K");
  assert.equal(formatFootprintValue(1_250, "normal"), "1,250");
});

test("uses integer tick indexes for decimal instruments", () => {
  assert.equal(priceToTickIndex(18.675, 0.005), 3735);
  assert.ok(Math.abs(tickIndexToPrice(3735, 0.005) - 18.675) < 1e-12);
});

test("deduplicates repeated source sequences", () => {
  const duplicate = trade({ eventId: "same-print", recordIndex: 7, volume: 11, askVolume: 11 });
  const bars = buildFootprintBars(candles.slice(0, 1), [duplicate, { ...duplicate }], defaults);
  assert.equal(bars[0].askVolume, 11);
  assert.equal(bars[0].totalTrades, 1);
});

test("orders historical executions deterministically before building delta path", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 2, timestamp: 5_000, volume: 15, askVolume: 15 }),
    trade({ recordIndex: 1, timestamp: 2_000, volume: 8, askVolume: 0, bidVolume: 8, aggressor: "SELL" }),
  ], defaults);
  assert.equal(bars[0].deltaLow, -8);
  assert.equal(bars[0].deltaHigh, 7);
  assert.equal(bars[0].deltaClose, 7);
});

test("uses VWAP then close then lower tick for deterministic POC ties", () => {
  const bars = buildFootprintBars([
    { timestamp: 1_000, open: 100, high: 101, low: 100, close: 100.75, volume: 20 },
  ], [
    trade({ recordIndex: 0, close: 100, volume: 10, bidVolume: 10, askVolume: 0, aggressor: "SELL" }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 101, volume: 10, bidVolume: 0, askVolume: 10 }),
  ], defaults);
  assert.equal(bars[0].pocPrice, 101);
  assert.equal(bars[0].rows.find((row) => row.price === 101).isPoc, true);
});

test("unknown volume can become POC but never creates Delta or imbalance", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, close: 100, volume: 40, bidVolume: 0, askVolume: 0, aggressor: "UNKNOWN" }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100.25, volume: 12, bidVolume: 0, askVolume: 12 }),
  ], { ...defaults, includeZero: true });
  const unknown = bars[0].rows.find((row) => row.price === 100);
  assert.equal(bars[0].pocPrice, 100);
  assert.equal(unknown.delta, 0);
  assert.equal(unknown.isAskImbalance, false);
  assert.equal(unknown.isBidImbalance, false);
});

test("marks complete adjacent ask stacks and records combined volume", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, close: 99.75, volume: 2, bidVolume: 2, askVolume: 0, aggressor: "SELL" }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100, volume: 15, bidVolume: 0, askVolume: 15 }),
    trade({ recordIndex: 2, timestamp: 4_000, close: 100.25, volume: 18, bidVolume: 0, askVolume: 18 }),
    trade({ recordIndex: 3, timestamp: 5_000, close: 100.5, volume: 21, bidVolume: 0, askVolume: 21 }),
  ], { ...defaults, includeZero: true, stackedImbalanceLevels: 3 });
  const stack = bars[0].rows.filter((row) => row.isStackedAskImbalance);
  assert.equal(stack.length, 3);
  assert.equal(stack[0].stackedAskVolume, 54);
});

test("a missing price row breaks stacked imbalance", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, close: 100, volume: 15, askVolume: 15 }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100.5, volume: 18, askVolume: 18 }),
    trade({ recordIndex: 2, timestamp: 4_000, close: 100.75, volume: 21, askVolume: 21 }),
  ], { ...defaults, includeZero: true, stackedImbalanceLevels: 3 });
  assert.equal(bars[0].rows.some((row) => row.isStackedAskImbalance), false);
});

test("unfinished auctions require Bid and Ask at the candle extreme", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, close: 100, volume: 6, bidVolume: 3, askVolume: 3 }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100.5, volume: 8, bidVolume: 4, askVolume: 4 }),
  ], { ...defaults, unfinishedAuctionEnabled: true, unfinishedAuctionMinimumVolume: 2 });
  assert.equal(bars[0].rows[0].isUnfinishedAuctionLow, true);
  assert.equal(bars[0].rows.at(-1).isUnfinishedAuctionHigh, true);
});

test("settings validation migrates invalid values safely", () => {
  const settings = validateFootprintSettings({
    contentMode: "not-a-mode",
    barWidth: 1000,
    valueAreaPercent: 0.2,
    stackedImbalanceLevels: 99,
    groupingMode: "broken",
    colorMode: "invisible-ish",
    inputType: "quotes",
    maximumDetailedVisibleBars: 2,
    fpsLimit: 17,
    showImbalances: "yes",
    minimumOpacity: 80,
    maximumOpacity: 20,
    minimumRatio: 50,
    maximumRatio: 2,
    minimumTradeVolume: 500,
    maximumTradeVolume: 100,
  });
  assert.equal(settings.contentMode, "bid-ask");
  assert.equal(settings.barWidth, 180);
  assert.equal(settings.valueAreaPercent, 0.5);
  assert.equal(settings.stackedImbalanceLevels, 10);
  assert.equal(settings.groupingMode, "automatic");
  assert.equal(settings.colorMode, "fading");
  assert.equal(settings.inputType, "volume");
  assert.equal(settings.maximumDetailedVisibleBars, 20);
  assert.equal(settings.fpsLimit, 60);
  assert.equal(settings.showImbalances, true);
  assert.equal(settings.maximumOpacity, 80);
  assert.equal(settings.maximumRatio, 50);
  assert.equal(settings.maximumTradeVolume, 500);
});

test("presets reuse one versioned settings model", () => {
  const delta = applyFootprintPreset(DEFAULT_FOOTPRINT_SETTINGS, "delta-focus");
  assert.equal(delta.contentMode, "delta-histogram");
  assert.equal(delta.showMaxPositiveDelta, true);
  assert.equal(delta.footprintSettingsVersion, DEFAULT_FOOTPRINT_SETTINGS.footprintSettingsVersion);
});

test("visible preset aliases change the live footprint mode", () => {
  const orderFlow = applyFootprintPreset(DEFAULT_FOOTPRINT_SETTINGS, "order-flow");
  const delta = applyFootprintPreset(DEFAULT_FOOTPRINT_SETTINGS, "delta");
  const minimal = applyFootprintPreset(DEFAULT_FOOTPRINT_SETTINGS, "minimal");
  assert.equal(orderFlow.contentMode, "bid-ask-histogram");
  assert.equal(orderFlow.visualizationMode, "histogram");
  assert.equal(orderFlow.colorCalculation, "volume");
  assert.equal(orderFlow.showBetweenVolume, true);
  assert.equal(delta.contentMode, "delta-histogram");
  assert.equal(delta.showMaxNegativeDelta, true);
  assert.equal(minimal.contentMode, "ladder");
  assert.equal(minimal.visualizationMode, "text-only");
});

test("local footprint templates validate names, settings and invalid records", () => {
  const templates = validateFootprintTemplates([
    { id: "flow", name: "  NY Order Flow  ", settings: { contentMode: "delta", barWidth: 999 }, updatedAt: 12 },
    { id: "invalid", name: "", settings: {} },
    null,
  ]);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].name, "NY Order Flow");
  assert.equal(templates[0].settings.contentMode, "delta");
  assert.equal(templates[0].settings.barWidth, 180);
});

test("show empty price rows fills only valid exchange tick rows", () => {
  const bars = buildFootprintBars([
    { timestamp: 1_000, open: 100, high: 100.5, low: 100, close: 100.5, volume: 2 },
  ], [
    trade({ recordIndex: 0, close: 100, volume: 1, askVolume: 1 }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100.5, volume: 1, askVolume: 1 }),
  ], { ...defaults, showEmptyPriceRows: true });
  assert.deepEqual(bars[0].rows.map((row) => row.price), [100, 100.25, 100.5]);
  assert.equal(bars[0].rows[1].totalVolume, 0);
});
