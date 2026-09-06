import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { calculateTextOnChart, normalizeTextOnChartSettings } from "../src/lib/textOnChart.ts";
import { LIVE_CHART_INDICATOR_IDS } from "../src/lib/chartIndicatorConfig.ts";

const candle = { timestamp: 1_700_000_000_000, open: 100, high: 101, low: 99, close: 100.5, volume: 10 };
const theme = { primary: "#ffffff", secondary: "#aaaaaa", positive: "#00ff00", negative: "#ff0000", muted: "#222222" };

test("DLL-backed defaults and limits are retained", () => {
  const value = normalizeTextOnChartSettings({ fontSize: 999, text: "x".repeat(3000) });
  assert.equal(value.fontSize, 50); assert.equal(value.text.length, 2000);
  assert.equal(normalizeTextOnChartSettings({}).fontSize, 30);
});

test("text is a fixed overlay that cannot alter chart autoscale", () => {
  const [series] = calculateTextOnChart([candle], { text: "Risk first" }, theme);
  assert.equal(series.textOnChart.text, "Risk first");
  assert.equal(series.excludeFromAutoScale, true); assert.equal(series.lineVisible, false);
  assert.equal(series.data[0].time, candle.timestamp / 1000);
});

test("theme and custom colours reach the primitive", () => {
  const [themed] = calculateTextOnChart([candle], { text: "A" }, theme);
  assert.equal(themed.textOnChart.textColor, theme.primary); assert.equal(themed.textOnChart.backgroundColor, theme.muted);
  const [custom] = calculateTextOnChart([candle], { text: "A", useThemeColors: false, textColor: "#123456", backgroundColor: "#654321" }, theme);
  assert.equal(custom.textOnChart.textColor, "#123456"); assert.equal(custom.textOnChart.backgroundColor, "#654321");
});

test("empty history produces no phantom overlay", () => assert.deepEqual(calculateTextOnChart([], { text: "A" }, theme), []));

test("library, renderer, text editor and primitive are reachable", () => {
  assert.ok(LIVE_CHART_INDICATOR_IDS.has("text-on-chart"));
  const controls = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  assert.match(controls, /RENDERED_CHART_INDICATOR_IDS = new Set\(\[[\s\S]*?"text-on-chart"/);
  assert.match(controls, /Text on Chart message/);
  const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /new TextOnChartPrimitive/);
});
