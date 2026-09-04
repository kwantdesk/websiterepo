import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calculatePeriodVwap, calculateRollingVwap, vwapEnvelopeOffset, vwapSourcePrice } from "../src/lib/vwap.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";
import { createDrawing, normalizeDrawings } from "../src/lib/chartDrawTools.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";

const candle = (iso, close, volume = 1, extra = {}) => ({
  timestamp: Date.parse(iso), open: close, high: close, low: close, close, volume, trades: 1, ...extra,
});

test("VWAP source modes use their documented OHLC inputs", () => {
  const bar = { open: 8, high: 14, low: 6, close: 12 };
  assert.equal(vwapSourcePrice(bar, "close"), 12);
  assert.equal(vwapSourcePrice(bar, "hl2"), 10);
  assert.equal(vwapSourcePrice(bar, "hlc3"), 32 / 3);
  assert.equal(vwapSourcePrice(bar, "ohlc4"), 10);
});

test("period VWAP resets at the 17:00 Chicago trading-day boundary", () => {
  const rows = calculatePeriodVwap([
    candle("2026-01-05T22:59:00Z", 100, 2),
    candle("2026-01-05T23:00:00Z", 110, 1),
  ], { periodMode: "days", periodValue: 1, sessionStartHour: 17 });
  assert.equal(rows[0].value, 100);
  assert.equal(rows[1].value, 110);
  assert.equal(rows[1].breakBefore, true);
});

test("minute period VWAP resets on the exact bucket", () => {
  const rows = calculatePeriodVwap([
    candle("2026-01-05T12:00:10Z", 100),
    candle("2026-01-05T12:00:50Z", 110),
    candle("2026-01-05T12:01:00Z", 120),
  ], { periodMode: "minutes", periodValue: 1 });
  assert.equal(rows[1].value, 105);
  assert.equal(rows[2].value, 120);
  assert.equal(rows[2].breakBefore, true);
});

test("rolling VWAP remains continuous across the session boundary and evicts by window", () => {
  const rows = calculateRollingVwap([
    candle("2026-01-05T22:59:00Z", 100),
    candle("2026-01-05T23:00:00Z", 110),
    candle("2026-01-05T23:01:00Z", 130),
  ], { periodMode: "bars", periodValue: 2 });
  assert.equal(rows[1].value, 105);
  assert.equal(rows[1].breakBefore, false);
  assert.equal(rows[2].value, 120);
});

test("percentage and deviation envelopes are distinct and exact", () => {
  assert.equal(vwapEnvelopeOffset({ value: 200, deviation: 3 }, 2, "standard-deviation"), 6);
  assert.equal(vwapEnvelopeOffset({ value: 200, deviation: 3 }, 2, "price-percentage"), 4);
});

test("all VWAP studies persist their complete five-band contract", () => {
  for (const id of ["vwap", "vwap-envelopes", "rolling-vwap"]) {
    const defaults = defaultIndicatorSettings(id);
    assert.equal(defaults.vwapSettingsVersion, 2);
    assert.equal(defaults.source, "hlc3");
    for (let band = 1; band <= 5; band += 1) {
      assert.equal(typeof defaults[`band${band}Enabled`], "boolean", `${id} band ${band} enable`);
      assert.equal(typeof defaults[`band${band}`], "number", `${id} band ${band} value`);
    }
  }
});

test("legacy rolling VWAP window migrates without retaining the old session reset", () => {
  const migrated = normalizeStoredIndicator({ instanceId: "rv", indicatorId: "rolling-vwap", enabled: true, settings: { length: 144, sessionStartHour: 9 } });
  assert.equal(migrated.settings.periodValue, 144);
  assert.equal(migrated.settings.periodMode, "bars");
  assert.equal("length" in migrated.settings, false);
  assert.equal("sessionStartHour" in migrated.settings, false);
});

test("indicator engine wires five switchable bands, styles, colours and hidden price tabs", () => {
  const candles = [100, 105, 110].map((price, index) => candle(`2026-01-05T12:0${index}:00Z`, price, index + 1));
  const theme = { primary: "#11AA11", secondary: "#AA11AA", positive: "#00FF00", negative: "#FF0000", muted: "#777777" };
  const series = calculateIndicatorSeries({
    instanceId: "env", indicatorId: "vwap-envelopes", enabled: true,
    settings: {
      ...defaultIndicatorSettings("vwap-envelopes"),
      periodMode: "minutes", periodValue: 60, envelopeMode: "price-percentage",
      band4Enabled: true, band4: 1.5, band5Enabled: false,
      lineStyle: "dashed", bandLineStyle: "solid", useThemeColors: false,
      mainColor: "#123456", upper4Color: "#FEDCBA", lower4Color: "#ABCDEF",
    },
  }, candles, theme);
  assert.equal(series.length, 11, "main plus five upper/lower pairs remain configurable");
  assert.equal(series[0].color, "#123456");
  assert.equal(series[0].lineStyle, "dashed");
  assert.equal(series[0].lastValueVisible, false);
  const upper4 = series.find((entry) => entry.key === "vwap-envelopes-upper-4");
  assert.equal(upper4.color, "#FEDCBA");
  assert.equal(upper4.lineStyle, "solid");
  assert.equal(upper4.data.at(-1).value, series[0].data.at(-1).value * 1.015);
  assert.equal(series.find((entry) => entry.key === "vwap-envelopes-upper-5").data.length, 0);
});

test("draw-on VWAP keeps theme linkage, bands and template-compatible settings", () => {
  const drawing = createDrawing("anchoredVwap", [{ time: 1, price: 100 }]);
  const [restored] = normalizeDrawings([{ ...drawing, style: { ...drawing.style, vwapSource: "close", vwapBand3Enabled: true, vwapBand3: 2.5 } }]);
  assert.equal(restored.style.useThemeColor, true);
  assert.equal(restored.style.vwapSource, "close");
  assert.equal(restored.style.vwapBand3Enabled, true);
  assert.equal(restored.style.vwapBand3, 2.5);
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../src/components/ChartDrawSettings.tsx", import.meta.url), "utf8");
  assert.match(layer, /point\.deviation \* multiplier/);
  assert.match(layer, /vwapBandFillOpacity/);
  assert.match(settings, /Anchored VWAP upper band colour/);
  assert.match(settings, /saveDrawTemplate/);
});
