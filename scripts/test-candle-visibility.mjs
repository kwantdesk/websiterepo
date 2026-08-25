import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Candles are the chart, not a study. There is nothing to delete — but a
 * trader framing a session off profiles, levels and TPO wants them out of the
 * way, and hiding them has to leave everything else exactly where it was.
 *
 * The trap is the obvious implementation. Marking the series invisible drops
 * it out of autoscale, so the price scale reshapes and every study anchored
 * to it moves — which is the opposite of what hiding the candles is for.
 * Painting them transparent keeps the series, its scale and its primitives
 * untouched and simply stops drawing them.
 */

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("candles are the first row in the indicator list", () => {
  const candlesRow = control.indexOf('Candles\n');
  const firstStudy = control.indexOf("{indicators.map((instance) => {");
  assert.ok(candlesRow > 0, "there is no Candles row");
  assert.ok(candlesRow < firstStudy, "Candles must come before the studies");
});

check("they can be switched off but not removed", () => {
  const start = control.indexOf("onToggleCandles?.(!candlesVisible)");
  assert.ok(start > 0, "the Candles row has no toggle");
  // The studies' row carries a Remove button; the Candles row must not.
  const row = control.slice(start, control.indexOf("{indicators.map((instance) => {"));
  assert.doesNotMatch(row, /title="Remove"/, "candles must not be removable");
  assert.doesNotMatch(row, /Trash2/, "candles must not be removable");
});

check("hiding paints them transparent instead of hiding the series", () => {
  // The load-bearing decision. `visible: false` would drop the series out of
  // autoscale and move every study anchored to it.
  assert.match(
    chart,
    /const replaceCandles = Boolean\(footprintIndicator && footprintHasPriceLevelFlow\) \|\| !candlesVisible;/,
    "hiding must reuse the transparent-candle path",
  );
  const applied = chart.slice(chart.indexOf("const replaceCandles"), chart.indexOf("const replaceCandles") + 700);
  assert.match(applied, /upColor: "rgba\(0,0,0,0\)"/);
  assert.doesNotMatch(applied, /visible: false/, "the series itself must stay visible to the scale");
});

check("the setting reaches the chart and is remembered per chart", () => {
  assert.match(chart, /candlesVisible = true,/, "the chart must default to showing candles");
  assert.match(workspace, /candlesHiddenPaneIds/, "hiding is per chart, not global");
  assert.match(workspace, /olisa-chart-workspace-hidden-candles/, "the choice must survive a reload");
  assert.match(workspace, /candlesVisible=\{!candlesHiddenPaneIds\.has\(pane\.id\)\}/);
  assert.match(workspace, /candlesVisible=\{!candlesHiddenPaneIds\.has\(activePaneId\)\}/);
});

check("storing the HIDDEN set keeps existing charts showing price", () => {
  // Every saved workspace predates this. Storing which charts are hidden —
  // rather than which are shown — means an absent entry reads as visible.
  assert.match(workspace, /if \(visible\) next\.delete\(paneId\);\s*\n\s*else next\.add\(paneId\);/);
});

console.log(`\ncandle visibility: ${passed}/${passed} checks passed`);
