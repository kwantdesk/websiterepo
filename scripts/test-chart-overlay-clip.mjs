import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

/**
 * Price-pane overlays — drawings, the position calculators, TPO zones and the
 * Expected Move rails — must stay inside the price pane. The clip used to
 * bound only the right edge, so a calculator's target and stop boxes painted
 * straight down over the Volume and CVD panes.
 */
const clip = chart.slice(chart.indexOf("<clipPath id={chartPaneClipId}>"));
const rect = clip.slice(0, clip.indexOf("</clipPath>"));

assert.match(rect, /y=\{topIndicatorPaneHeight\}/, "the clip starts below any pane docked above");
assert.match(rect, /overlaySize\.width - nativePriceScaleWidth/, "the right edge still slides under the price scale");
assert.match(rect, /- topIndicatorPaneHeight/);
assert.match(rect, /- indicatorPaneHeight/, "the clip stops at the pane stack docked below");
assert.match(rect, /- CHART_TIME_AXIS_HEIGHT/, "and above the time axis");
assert.ok(
  !/height=\{Math\.max\(1, overlaySize\.height\)\}/.test(rect),
  "the clip must not span the whole container again",
);

// The pane model is shared with the precision-tools adapter rather than
// re-guessed, so the two layers cannot disagree about where the pane ends.
assert.match(chart, /const CHART_TIME_AXIS_HEIGHT = 24;/);
assert.match(chart, /timeScaleHeight: CHART_TIME_AXIS_HEIGHT \+ indicatorPaneHeight/);

// Every price-pane overlay group shares this one clip.
const groups = chart.match(/clipPath=\{`url\(#\$\{chartPaneClipId\}\)`\}/g) ?? [];
assert.ok(groups.length >= 3, `expected every price-pane overlay group to be clipped, found ${groups.length}`);

console.log("Chart overlay clip tests passed.");
