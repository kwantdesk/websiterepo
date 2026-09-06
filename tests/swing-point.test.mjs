import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { calculateSwingPoints, normalizeSwingPointSettings } from "../src/lib/swingPointLevels.ts";
import { LIVE_CHART_INDICATOR_IDS } from "../src/lib/chartIndicatorConfig.ts";

const theme = { primary: "#ffffff", secondary: "#999999", positive: "#00ff00", negative: "#ff0000", muted: "#555555" };
const from = values => values.map((value, index) => ({ timestamp: (index + 1) * 1000, open: value, high: value, low: value, close: value, volume: 1 }));

test("public defaults and DLL enum contract are retained", () => {
  const value = normalizeSwingPointSettings({});
  assert.deepEqual([value.leftBars, value.rightBars, value.filterSwing, value.lineWidth, value.lineStyle], [2, 2, false, 2, "dashed"]);
  assert.deepEqual([value.textTickOffset, value.textSize, value.displayMode], [1, 11, "line"]);
});

test("left/right bars confirm highs and lows without future leakage", () => {
  const series = calculateSwingPoints(from([1, 2, 5, 2, 0, 3, 1]), { leftBars: 2, rightBars: 2 }, theme, 0.25);
  const high = series.find(item => item.key.endsWith("-high"));
  const low = series.find(item => item.key.endsWith("-low"));
  assert.equal(high.data[0].time, 3);
  assert.equal(low.data[0].time, 5);
  assert.ok(!high.data.some(point => point.time === 6), "the recent high lacks two right-side bars");
});

test("segments end at the next confirmed swing and the latest reaches the live edge", () => {
  const series = calculateSwingPoints(from([1, 2, 5, 2, 1, 3, 1]), { leftBars: 1, rightBars: 1 }, theme, 0.25);
  const high = series.find(item => item.key.endsWith("-high"));
  assert.deepEqual(high.data.slice(0, 2).map(point => point.time), [3, 5]);
  assert.equal(high.data.at(-1).time, 7);
});

test("filter swing removes weaker consecutive pivots", () => {
  const input = from([1, 5, 3, 4, 2, 6, 1]);
  const raw = calculateSwingPoints(input, { leftBars: 1, rightBars: 1, filterSwing: false }, theme, 0.25);
  const filtered = calculateSwingPoints(input, { leftBars: 1, rightBars: 1, filterSwing: true }, theme, 0.25);
  assert.ok(filtered.reduce((sum, item) => sum + item.data.filter(point => point.breakBefore).length, 0)
    <= raw.reduce((sum, item) => sum + item.data.filter(point => point.breakBefore).length, 0));
});

test("invalid and out-of-order candles form hard continuity boundaries", () => {
  const gap = from([1, 3, 1, 2, 1, 4, 1]);
  gap[3] = { ...gap[3], high: Number.NaN, low: Number.NaN };
  const series = calculateSwingPoints(gap, { leftBars: 1, rightBars: 1 }, theme, 0.25);
  const high = series.find(item => item.key.endsWith("-high"));
  assert.ok(high);
  assert.deepEqual(high.data.map(point => point.time), [2, 3, 6, 7]);
  assert.ok(high.data[2].breakBefore, "the post-gap segment must begin a new path");
});

test("all display and dash styles survive normalization", () => {
  for (const displayMode of ["line", "text", "line-and-text"])
    assert.equal(normalizeSwingPointSettings({ displayMode }).displayMode, displayMode);
  for (const lineStyle of ["solid", "dashed", "dotted", "dash-dot", "dash-dot-dot"])
    assert.equal(normalizeSwingPointSettings({ lineStyle }).lineStyle, lineStyle);
});

test("theme colours and custom text/line colours reach the primitive", () => {
  const themed = calculateSwingPoints(from([1, 3, 1, 3, 1]), { leftBars: 1, rightBars: 1 }, theme, 0.25);
  assert.equal(themed[0].swingPointLevels.lineColor, theme.positive);
  const custom = calculateSwingPoints(from([1, 3, 1, 3, 1]), { leftBars: 1, rightBars: 1, useThemeColors: false, highColor: "#123456", highTextColor: "#abcdef" }, theme, 0.25);
  assert.equal(custom[0].swingPointLevels.lineColor, "#123456");
  assert.equal(custom[0].swingPointLevels.textColor, "#abcdef");
});

test("library, renderer and five-style primitive are release reachable", () => {
  assert.ok(LIVE_CHART_INDICATOR_IDS.has("swing-point"));
  const controls = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  assert.match(controls, /RENDERED_CHART_INDICATOR_IDS = new Set\(\[[\s\S]*?"swing-point"/);
  const source = fs.readFileSync(new URL("../src/lib/swingPointLevelPrimitive.ts", import.meta.url), "utf8");
  assert.match(source, /dash-dot-dot/);
});

test("20,000 bars remain bounded", () => {
  const input = Array.from({ length: 20_000 }, (_, index) => ({ timestamp: index * 1000, open: index, high: Math.sin(index / 4) + index / 100, low: Math.sin(index / 4) + index / 100 - 1, close: index / 100, volume: 1 }));
  const started = performance.now(); calculateSwingPoints(input, { leftBars: 2, rightBars: 2 }, theme, 0.25);
  assert.ok(performance.now() - started < 250);
});
