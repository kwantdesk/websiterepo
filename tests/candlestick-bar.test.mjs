import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { buildCandlestickBarCandles, normalizeCandlestickBarSettings } from "../src/lib/candlestickBar.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { applyMarketTradesToEventBars } from "../src/lib/eventBars.ts";

const trade = (timestamp, price, volume = 1, flowOnly = false) => ({
  timestamp, close: price, open: price, high: price, low: price,
  volume, trades: 1, bidVolume: 0, askVolume: volume, delta: volume,
  aggressor: "BUY", recordIndex: timestamp, flowOnly,
});

test("DeepCharts Vol Bars are target/reversal price bars, not fixed-volume bars", () => {
  const tape = [100, 100.5, 101, 101.5, 101, 100.5, 99.5, 100].map((price, index) => ({
    timestamp: (index + 1) * 1_000, price, size: 1, trades: 1, delta: 1,
  }));
  const bars = applyMarketTradesToEventBars([], tape, "4/2VB", "NQ");
  assert.equal(bars.length, 3);
  assert.deepEqual([bars[0].open, bars[0].high, bars[0].close], [100, 101.5, 101.5]);
  assert.deepEqual([bars[1].open, bars[1].low, bars[1].close], [101.5, 99.5, 99.5]);
  assert.deepEqual([bars[2].open, bars[2].close], [99.5, 100]);
  assert.equal(bars.reduce((sum, bar) => sum + Number(bar.volume ?? 0), 0), tape.length);
});

test("minute overlay aggregates loaded OHLC while range overlay requires exact executions", () => {
  const candles = [
    { timestamp: 0, open: 100, high: 102, low: 99, close: 101, volume: 10 },
    { timestamp: 60_000, open: 101, high: 104, low: 100, close: 103, volume: 20 },
    { timestamp: 120_000, open: 103, high: 105, low: 102, close: 104, volume: 30 },
  ];
  const minutes = buildCandlestickBarCandles({ candles, trades: [], symbol: "NQ", settings: { parameterType: "minutes", parameter1: 2 } });
  assert.equal(minutes.length, 2);
  assert.deepEqual([minutes[0].open, minutes[0].high, minutes[0].low, minutes[0].close, minutes[0].volume], [100, 104, 99, 103, 30]);
  assert.deepEqual(buildCandlestickBarCandles({ candles, trades: [trade(1_000, 100, 1, true)], symbol: "NQ", settings: { parameterType: "range", parameter1: 4 } }), []);
  const range = buildCandlestickBarCandles({ candles, trades: [trade(1_000, 100), trade(2_000, 101.25)], symbol: "NQ", settings: { parameterType: "range", parameter1: 4 } });
  assert.ok(range.length >= 2);
});

test("settings are bounded, persisted, theme-aware and catalogue gate is live", () => {
  const settings = normalizeCandlestickBarSettings({ parameterType: "vol-bars", parameter1: 0, parameter2: 999999, candleWidth: 2, borderWidth: 9, opacity: 0, useThemeColors: true }, { upColor: "#11aa22", downColor: "#cc2233" });
  assert.deepEqual([settings.parameterType, settings.parameter1, settings.parameter2, settings.candleWidth, settings.borderWidth, settings.opacity], ["vol-bars", 1, 100000, 10, 4, 5]);
  assert.deepEqual([settings.positiveColor, settings.negativeColor], ["#11aa22", "#cc2233"]);
  const defaults = defaultIndicatorSettings("candlestick-bar");
  const restored = normalizePaneIndicatorState({ pane: [{ instanceId: "c", indicatorId: "candlestick-bar", enabled: true, settings: { ...defaults, parameterType: "range", parameter1: 40, filled: false } }] }).pane[0];
  assert.deepEqual([restored.settings.parameterType, restored.settings.parameter1, restored.settings.filled], ["range", 40, false]);
  assert.ok(!auditIndicatorLibrary().pending.some((row) => row.id === "candlestick-bar"));
});

test("all documented controls and independent overlay runtime are wired", () => {
  const control = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  for (const label of ["Parameter type", "Vol Bars · target / reversal", "Show filled bar", "Vertical line on close", "Candle width", "Border width", "Body opacity"]) assert.match(`${control}\n${fs.readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8")}`, new RegExp(label, "i"));
  assert.match(chart, /buildCandlestickBarCandles/);
  assert.match(chart, /candlestickBarOverlays/);
});
