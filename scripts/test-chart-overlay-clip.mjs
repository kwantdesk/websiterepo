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

/**
 * Drawings are laid out by React, which commits viewport changes at most once
 * per VIEWPORT_REACT_REFRESH_INTERVAL_MS and does it inside a low-priority
 * transition, while the candles move on the canvas every frame. Between
 * commits the position calculators sat where the chart used to be — floating
 * away from their own bars during a pan.
 */
{
  // Re-projection runs in the per-frame rAF, not on the throttled commit.
  const raf = chart.slice(chart.indexOf("viewportFrameRef.current = window.requestAnimationFrame"));
  const frameBody = raf.slice(0, raf.indexOf("const scheduleViewportRefresh"));
  assert.match(frameBody, /reprojectDrawingLayer\(\)/, "the overlay re-projects every frame of the pan");

  // Both axes are linear, so two reference points per axis describe the move
  // exactly — the same reasoning the gamma heatmap re-projection uses.
  assert.match(chart, /const scaleX = \(Number\(toX\) - Number\(fromX\)\) \/ spanX;/);
  assert.match(chart, /const scaleY = \(Number\(bottomY\) - Number\(topY\)\) \/ spanY;/);
  assert.match(chart, /const translateX = Number\(fromX\) - scaleX \* basis\.fromX;/);
  assert.match(chart, /const translateY = Number\(topY\) - scaleY \* basis\.topY;/);

  // The basis is retaken after the DOM is updated, so it always describes the
  // viewport the drawings were actually laid out for.
  assert.ok(
    /useLayoutEffect\(\(\) => \{[^}]*captureDrawingProjection\(\);/.test(chart),
    "the basis is retaken after the DOM is updated",
  );
  assert.match(chart, /if \(drawingLayerRef\.current\) drawingLayerRef\.current\.removeAttribute\("transform"\);/);
  // The layer the transform is applied to is the clipped drawing group.
  assert.match(chart, /<g ref=\{drawingLayerRef\} clipPath=/);
  // A degenerate or inverted basis must never produce a transform.
  assert.match(chart, /if \(!Number\.isFinite\(scaleX\) \|\| !Number\.isFinite\(scaleY\) \|\| scaleX <= 0 \|\| scaleY <= 0\) return;/);
}

console.log("Chart overlay clip and re-projection tests passed.");
