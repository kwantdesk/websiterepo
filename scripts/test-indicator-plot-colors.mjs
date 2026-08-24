import assert from "node:assert/strict";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { CHART_INDICATOR_BY_ID } from "../src/lib/chartIndicatorCatalog.ts";
import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";
import {
  INDICATOR_PLOT_COLOR_SLOTS,
  indicatorSeriesColorKey,
} from "../src/lib/indicatorPlotColors.ts";

/**
 * Every plotted series gets its own colour picker, and that picker controls
 * the series it names.
 *
 * The slot map is generated from the engine. If a study gains or loses a plot,
 * the generated map goes stale and the panel shows a picker that controls
 * nothing — or hides one for a line that is on screen. That is the failure
 * this catches, because neither shows up as a type error.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const THEME = {
  primary: "#111111",
  secondary: "#222222",
  positive: "#333333",
  negative: "#444444",
  muted: "#555555",
};
const candles = [];
let price = 20_000;
for (let i = 0; i < 300; i += 1) {
  price += Math.sin(i / 7) * 3;
  const open = price;
  const close = price + Math.cos(i / 5) * 2;
  candles.push({
    timestamp: 1_700_000_000_000 + i * 60_000,
    open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, close,
    volume: 500 + (i % 97), askVolume: 300, bidVolume: 200, delta: 100,
  });
}
const run = (id, settings) => calculateIndicatorSeries(
  { instanceId: id, indicatorId: id, enabled: true, settings },
  candles, THEME, { instrument: "NQ", tickSize: 0.25 },
);

const plotting = [];
for (const [id] of CHART_INDICATOR_BY_ID) {
  let series = [];
  try { series = run(id, defaultIndicatorSettings(id) ?? {}); } catch { continue; }
  if (series.length) plotting.push([id, series]);
}

check("the study list is not silently empty", () => {
  assert.ok(plotting.length >= 20, `expected the usual studies to plot, got ${plotting.length}`);
});

check("every plotted series has a slot, and every slot has a series", () => {
  const problems = [];
  for (const [id, series] of plotting) {
    const declared = new Set((INDICATOR_PLOT_COLOR_SLOTS[id] ?? []).map((slot) => slot.key));
    const produced = new Set(series.map((entry) => indicatorSeriesColorKey(id, entry.key)));
    for (const key of produced) {
      if (!declared.has(key)) problems.push(`${id}: plots "${key}" with no picker`);
    }
    for (const key of declared) {
      if (!produced.has(key)) problems.push(`${id}: offers a picker for "${key}" that nothing plots`);
    }
  }
  assert.deepEqual(problems, [], `slot map is stale — regenerate it:\n  ${problems.join("\n  ")}`);
});

check("an untouched indicator still follows the chart theme", () => {
  // The whole point of seeding from the theme: nothing changes for anyone who
  // has not opened the colour pickers.
  const [, series] = plotting.find(([id]) => id === "volume");
  assert.ok(series[0].color, "volume must carry a colour");
  const themed = run("volume", {});
  assert.equal(themed[0].color, THEME.muted, "with no settings it is the theme's muted colour");
});

check("a chosen colour reaches the series it names", () => {
  const series = run("macd-indicator", {
    ...defaultIndicatorSettings("macd-indicator"),
    signalColor: "#ABCDEF",
  });
  const signal = series.find((entry) => entry.key === "macd-indicator-signal");
  const macd = series.find((entry) => entry.key === "macd-indicator-macd");
  assert.equal(signal.color, "#ABCDEF", "the signal line takes the chosen colour");
  assert.notEqual(macd.color, "#ABCDEF", "and only that line — the others are untouched");
});

check("each band of a multi-plot study is independently colourable", () => {
  const series = run("bollinger-bands", {
    ...defaultIndicatorSettings("bollinger-bands"),
    upperColor: "#AA0000",
    lowerColor: "#00BB00",
  });
  const at = (suffix) => series.find((entry) => entry.key.endsWith(suffix)).color;
  assert.equal(at("-upper"), "#AA0000");
  assert.equal(at("-lower"), "#00BB00");
  assert.notEqual(at("-middle"), "#AA0000");
});

check("a blank or missing colour falls back rather than blanking the plot", () => {
  for (const value of ["", "   ", undefined, null, 42]) {
    const series = run("volume", { plotColor: value });
    assert.equal(series[0].color, THEME.muted, `"${String(value)}" must fall back to the theme`);
  }
});

check("the settings key reads as a label", () => {
  assert.equal(indicatorSeriesColorKey("volume", "volume"), "plotColor");
  assert.equal(indicatorSeriesColorKey("macd-indicator", "macd-indicator-signal"), "signalColor");
  assert.equal(indicatorSeriesColorKey("vwap-envelopes", "vwap-envelopes-upper-1"), "upper1Color");
  assert.equal(indicatorSeriesColorKey("aroon-up-down", "aroon-up-down-up"), "upColor");
});

check("every indicator that plots is colour-configurable", () => {
  const bare = plotting
    .filter(([id]) => !(INDICATOR_PLOT_COLOR_SLOTS[id]?.length))
    .map(([id]) => id);
  assert.deepEqual(bare, [], `these still have no colour settings: ${bare.join(", ")}`);
});

console.log(`\nindicator plot colours: ${passed}/${passed} checks passed (${plotting.length} studies)`);
