import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { calculateMarketStatistics, normalizeMarketStatisticsSettings } from "../src/lib/marketStatistics.ts";

const base = Date.UTC(2026, 8, 1, 15, 0);
const candle = (timestamp, volume = 100) => ({ timestamp, open: 100, high: 101, low: 99, close: 100, volume });
const trade = (timestamp, volume, close = 100, recordIndex = 0) => ({ timestamp, volume, close, open: close, high: close, low: close, recordIndex, trades: 1, bidVolume: 0, askVolume: volume, delta: volume, aggressor: "BUY" });

const normalized = normalizeMarketStatisticsSettings({ initialRange: 100, endRange: 50, stepRange: 0, standardDeviationPercent: 999 });
assert.equal(normalized.endRange, 101);
assert.equal(normalized.stepRange, 1);
assert.equal(normalized.standardDeviationPercent, 5);

const volumeFrame = calculateMarketStatistics({
  candles: [candle(base), candle(base + 86_400_000)],
  trades: [trade(base, 25), trade(base + 1, 75, 100, 1), trade(base + 86_400_000, 25)],
  footprintBars: [],
  settings: { statMode: "trades", dataType: "volume", initialRange: 0, endRange: 100, stepRange: 50, standardDeviationPercent: 3 },
});
assert.equal(volumeFrame.status, "LIVE");
assert.equal(volumeFrame.sampleDays, 2);
assert.equal(volumeFrame.eventCount, 3);
assert.equal(volumeFrame.ranges[0].average, 1);
assert.equal(volumeFrame.ranges[1].average, 0.5);
assert.equal(volumeFrame.ranges[0].deviation, 1);

const aggregateFrame = calculateMarketStatistics({
  candles: [candle(base)],
  trades: [trade(base, 30, 100), trade(base, 40, 100, 1), trade(base, 20, 101, 2)],
  footprintBars: [],
  settings: { statMode: "trades", dataType: "aggregate-trades", initialRange: 0, endRange: 100, stepRange: 50, standardDeviationPercent: 3 },
});
assert.equal(aggregateFrame.eventCount, 2);
assert.equal(aggregateFrame.ranges[0].average, 1);
assert.equal(aggregateFrame.ranges[1].average, 1);

assert.equal(calculateMarketStatistics({ candles: [], trades: [], footprintBars: [], settings: { statMode: "trades", dataType: "order" } }).status, "WAITING_FOR_ORDER_HISTORY");
assert.equal(calculateMarketStatistics({ candles: [], trades: [], footprintBars: [], settings: { statMode: "trades" } }).status, "WAITING_FOR_EXECUTIONS");
assert.equal(calculateMarketStatistics({ candles: [candle(base)], trades: [], footprintBars: [], settings: { statMode: "bars", barInput: "poc" } }).status, "WAITING_FOR_VOLUME_AT_PRICE");

const bars = [{ startTime: base, totalVolume: 600, hasPriceLevelFlow: true, pocTick: 400, deltaPocPrice: 101, rows: [{ tickIndex: 400, price: 100, totalVolume: 125, delta: 25 }, { tickIndex: 404, price: 101, totalVolume: 75, delta: -60 }] }];
const pocFrame = calculateMarketStatistics({ candles: [candle(base)], trades: [], footprintBars: bars, settings: { statMode: "bars", barInput: "poc", initialRange: 100, endRange: 200, stepRange: 50 } });
assert.equal(pocFrame.eventCount, 1);
assert.equal(pocFrame.ranges[0].average, 1);
const deltaFrame = calculateMarketStatistics({ candles: [candle(base)], trades: [], footprintBars: bars, settings: { statMode: "bars", barInput: "delta-poc", initialRange: 50, endRange: 100, stepRange: 25 } });
assert.equal(deltaFrame.eventCount, 1);

const broad = calculateMarketStatistics({ candles: [candle(base)], trades: [trade(base, 10), trade(base + 1, 11, 100, 1), trade(base + 2, 100, 100, 2)], footprintBars: [], settings: { statMode: "trades", initialRange: 0, endRange: 150, stepRange: 50, standardDeviationPercent: 3 } });
const narrow = calculateMarketStatistics({ candles: [candle(base)], trades: [trade(base, 10), trade(base + 1, 11, 100, 1), trade(base + 2, 100, 100, 2)], footprintBars: [], settings: { statMode: "trades", initialRange: 0, endRange: 150, stepRange: 50, standardDeviationPercent: 0.5 } });
assert.ok(narrow.eventCount < broad.eventCount, "% Dev. Std. must be a functioning breadth control");

const many = Array.from({ length: 50_000 }, (_, index) => trade(base + index, 1 + (index % 500), 100 + (index % 4), index));
const started = performance.now();
calculateMarketStatistics({ candles: [candle(base)], trades: many, footprintBars: [], settings: { statMode: "trades", initialRange: 0, endRange: 1_000, stepRange: 10 } });
assert.ok(performance.now() - started < 1_000, "50k executions must remain comfortably inside the chart interaction budget");

console.log("market statistics tests passed");
