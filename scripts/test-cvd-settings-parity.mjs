import assert from "node:assert/strict";

const { calculateIndicatorSeries } = await import("../src/lib/chartIndicatorEngine.ts");
const { defaultIndicatorSettings, normalizeStoredIndicator } = await import("../src/lib/chartIndicatorConfig.ts");

const theme = {
  primary: "#38BDF8",
  secondary: "#F59E0B",
  positive: "#22C55E",
  negative: "#EF4444",
  muted: "#64748B",
};

const candle = (timestamp, askVolume, bidVolume, askTrades = askVolume, bidTrades = bidVolume) => ({
  timestamp,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: askVolume + bidVolume,
  askVolume,
  bidVolume,
  askTrades,
  bidTrades,
  delta: askVolume - bidVolume,
  deltaOpen: 0,
  deltaHigh: Math.max(0, askVolume - bidVolume),
  deltaLow: Math.min(0, askVolume - bidVolume),
  deltaClose: askVolume - bidVolume,
});

const calculate = (indicatorId, settings, candles) => calculateIndicatorSeries(
  { instanceId: "cvd-settings", indicatorId, enabled: true, settings },
  candles,
  theme,
  { instrument: "NQ", tickSize: 0.25 },
);

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

const beforeSession = Date.parse("2026-09-02T21:59:00Z"); // 16:59 Chicago (CDT)
const afterSession = Date.parse("2026-09-02T22:00:00Z"); // 17:00 Chicago (CDT)

check("new and saved CVD settings receive deterministic period defaults", () => {
  const defaults = defaultIndicatorSettings("cumulative-volume-delta");
  assert.equal(defaults.periodMode, "days");
  assert.equal(defaults.periodValue, 1);
  assert.equal(defaults.cvdSettingsVersion, 5);
  const migrated = normalizeStoredIndicator({
    instanceId: "saved-cvd",
    indicatorId: "cumulative-volume-delta",
    enabled: true,
    settings: { cvdSettingsVersion: 4, displayStyle: "line" },
  });
  assert.equal(migrated.settings.periodMode, "days");
  assert.equal(migrated.settings.periodValue, 1);
  assert.equal(migrated.settings.displayStyle, "line");
});

check("session reset is a real calculation control", () => {
  const bars = [candle(beforeSession, 15, 5), candle(afterSession, 17, 7)];
  const reset = calculate("delta-cumulative-candlestick", { resetToSession: true }, bars)[0];
  const continuous = calculate("delta-cumulative-candlestick", { resetToSession: false }, bars)[0];
  assert.equal(reset.data[1].close, 10);
  assert.equal(reset.data[1].breakBefore, true);
  assert.equal(continuous.data[1].close, 20);
  assert.equal(continuous.data[1].breakBefore, false);
});

check("volume and aggregate-trade databases produce their own CVD", () => {
  const bars = [candle(afterSession, 15, 5, 2, 8)];
  assert.equal(calculate("delta-cumulative-candlestick", { inputData: "Volumes" }, bars)[0].data[0].close, 10);
  assert.equal(calculate("delta-cumulative-candlestick", { inputData: "Aggregate Trades" }, bars)[0].data[0].close, -6);
});

check("minimum and maximum filters affect the dedicated CVD", () => {
  const bars = [candle(afterSession, 15, 5), candle(afterSession + 60_000, 60, 40)];
  const series = calculate("delta-cumulative-candlestick", {
    filterMinVolume: 50,
    filterMaxVolume: 120,
  }, bars)[0];
  assert.deepEqual(series.data.map((point) => point.close), [0, 20]);
});

check("simple and exponential averages are selectable and session-safe", () => {
  const bars = [
    candle(afterSession, 10, 0),
    candle(afterSession + 60_000, 20, 0),
    candle(afterSession + 120_000, 30, 0),
  ];
  const simple = calculate("delta-cumulative-candlestick", {
    showAverage: true,
    averageLength: 2,
    averageType: "simple",
  }, bars).find((series) => series.key.endsWith("-average"));
  const exponential = calculate("delta-cumulative-candlestick", {
    showAverage: true,
    averageLength: 2,
    averageType: "exponential",
  }, bars).find((series) => series.key.endsWith("-average"));
  assert.ok(simple);
  assert.ok(exponential);
  assert.equal(simple.data.at(-1).value, 45);
  assert.ok(Math.abs(exponential.data.at(-1).value - 47.7777777778) < 1e-8);
});

check("candlestick plot, zero line, name and value settings reach the renderer contract", () => {
  const [series] = calculate("delta-cumulative-candlestick", {
    candleStyle: "ohlc",
    showZeroLine: false,
    showValue: false,
    customName: "Desk CVD",
  }, [candle(afterSession, 15, 5)]);
  assert.equal(series.candleStyle, "ohlc");
  assert.equal(series.showZeroLine, false);
  assert.equal(series.lastValueVisible, false);
  assert.equal(series.label, "Desk CVD");
});

check("general CVD period modes reset on deterministic boundaries", () => {
  const bars = [
    candle(afterSession, 15, 5),
    candle(afterSession + 30_000, 15, 5),
    candle(afterSession + 60_000, 15, 5),
  ];
  const [series] = calculate("cumulative-volume-delta", {
    periodMode: "seconds",
    periodValue: 60,
  }, bars);
  assert.deepEqual(series.data.map((point) => point.close), [10, 20, 10]);
  assert.deepEqual(series.data.map((point) => point.breakBefore), [true, false, true]);
});

check("supplementary ask, bid and filtered lines do not bridge period resets", () => {
  const bars = [candle(beforeSession, 15, 5), candle(afterSession, 17, 7)];
  const series = calculate("cumulative-volume-delta", {
    showBidAskVolumes: true,
    filteredEnabled: true,
    periodMode: "days",
    periodValue: 1,
  }, bars);
  for (const supplementary of series.slice(1)) {
    assert.equal(supplementary.data[1].breakBefore, true, `${supplementary.key} bridged the session`);
  }
});

check("missing aggressor history creates a new honest CVD segment", () => {
  const missingFlow = {
    ...candle(afterSession + 60_000, 15, 5),
    askVolume: undefined,
    bidVolume: undefined,
  };
  const series = calculate("cumulative-volume-delta", {
    periodMode: "days",
    periodValue: 1,
  }, [
    candle(afterSession, 15, 5),
    missingFlow,
    candle(afterSession + 120_000, 17, 7),
  ]);
  assert.equal(series[0].data.length, 2);
  assert.equal(series[0].data[1].breakBefore, true);
  assert.equal(series[0].data[1].close, 10);
});

console.log(`\nCVD settings parity: ${passed}/${passed} checks passed`);
