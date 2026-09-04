import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  candleSettingsUseThemeColors,
  resolveCandleSeriesColors,
} from "../src/lib/candleStyle.ts";
import {
  relinkStoredChartWorkspaceSettingsToActiveTheme,
} from "../src/lib/chartSettings.ts";

const candleTheme = (up, down) => ({
  up,
  down,
  borderUp: up,
  borderDown: down,
  wickUp: up,
  wickDown: down,
});

const chartTheme = (upColor, downColor, backgroundColor = "#000000") => ({
  themeLinked: true,
  upColor,
  downColor,
  borderUpColor: upColor,
  borderDownColor: downColor,
  wickUpColor: upColor,
  wickDownColor: downColor,
  backgroundColor,
  gridColor: "#222222",
});

const first = candleTheme("#00FF00", "#FF0000");
const second = candleTheme("#FF66CC", "#66CCFF");
const firstChart = chartTheme(first.up, first.down);
const secondChart = chartTheme(second.up, second.down);

assert.equal(resolveCandleSeriesColors({}, first).upColor, first.up);
assert.equal(resolveCandleSeriesColors({}, second).upColor, second.up,
  "untouched candles must repaint from the active theme");
assert.equal(candleSettingsUseThemeColors({ candleStyle: "hollow" }), true,
  "style is independent of palette ownership");

const custom = { useThemeColors: false, candleUpColor: "#ABCDEF", candleDownColor: "#123456" };
assert.equal(resolveCandleSeriesColors(custom, second).upColor, "#ABCDEF",
  "an explicit per-chart candle colour must survive a theme change");
assert.equal(resolveCandleSeriesColors({ ...custom, useThemeColors: true }, second).upColor, second.up,
  "turning theme colours back on must immediately release the custom palette");

const store = new Map([
  ["kwantdesk:chart-workspace-settings:v1", JSON.stringify({ ...firstChart, themeLinked: false, timezone: "UTC", precision: "2" })],
  ["kwantdesk:gamma-charting:kwantdesk:chart-workspace-settings:v1", JSON.stringify({ ...firstChart, themeLinked: false, timezone: "America/New_York", precision: "4" })],
]);
globalThis.window = {
  localStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  },
};

relinkStoredChartWorkspaceSettingsToActiveTheme(secondChart);
for (const key of [
  "kwantdesk:chart-workspace-settings:v1",
  "kwantdesk:gamma-charting:kwantdesk:chart-workspace-settings:v1",
]) {
  const linked = JSON.parse(store.get(key));
  assert.equal(linked.themeLinked, true);
  assert.equal(linked.upColor, secondChart.upColor);
  assert.equal(linked.downColor, secondChart.downColor);
}
assert.equal(JSON.parse(store.get("kwantdesk:chart-workspace-settings:v1")).precision, "2",
  "theme relinking must not replace unrelated chart preferences");

const indicatorConfig = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
assert.match(indicatorConfig, /kwantdesk:gamma-charting:kwantdesk-chart-indicators/,
  "GEX VUE indicator state must be included in the relink");

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
assert.match(workspace, /candleSettings: clonePaneCandleSettings\(candleSettingsByPane\)/,
  "Quick Save must capture per-pane candle appearance");
assert.match(workspace, /setCandleSettingsByPane\(clonePaneCandleSettings\(preset\.candleSettings \?\? \{\}\)\)/,
  "workspace restore must restore candle appearance");
assert.match(workspace, /const nextChartSettings = normalizeChartSettings\(preset\.chartSettings\)/,
  "workspace restore must use the saved palette exactly");

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
assert.match(chart, /if \(drawing\.style\?\.useThemeColor === false\) return;/,
  "custom drawing colours must not be repainted by a theme change");
assert.match(chart, /useThemeColor: false,[\s\S]*lineColor: hex/,
  "the professional drawing colour picker must claim a custom override");

console.log("Global theme/chart ownership regression checks passed.");
