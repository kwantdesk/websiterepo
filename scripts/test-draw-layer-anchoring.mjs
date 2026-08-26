import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Drawings must stay welded to the chart while it is thrown around.
 *
 * Volume profiles, TPO and Big Contracts are rock solid under a fast pan
 * because they are canvas primitives painted inside the chart's own pass — they
 * cannot fall out of step with it. Every drawing on the left rail lives in an
 * SVG layer instead, and SVG is the browser's to paint: a React render lands a
 * frame or more later. The layer closes that gap by translating and scaling
 * itself to the live viewport between renders, which works only if the basis it
 * measures from is the projection the render ACTUALLY drew.
 *
 * It was captured in a plain effect with no dependency array, so it ran after
 * every render — on a live chart, constantly — and effects run AFTER paint. By
 * then the chart could already have moved past the coordinates that render
 * drew. The moved projection was stored as the basis and the compensating
 * transform stripped, so the drawings sat at stale coordinates while the next
 * viewport event measured its delta from an origin that never matched them. The
 * error went into the basis instead of being corrected, which is why a thrown
 * chart left drawings somewhere they should not be.
 */

const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the basis is captured before paint, not after", () => {
  const capture = layer.slice(
    layer.indexOf("// BEFORE paint, not after."),
    layer.indexOf("// BEFORE paint, not after.") + 1_800,
  );
  assert.match(capture, /useLayoutEffect\(\(\) => \{\s*\n\s*\/\/ Fresh coordinates[\s\S]*?projectionBasisRef\.current = readProjection\(\);/,
    "capturing the basis must run synchronously after the DOM update");
  assert.match(capture, /drawingsGroupRef\.current\?\.removeAttribute\("transform"\);/);
  assert.match(layer, /useLayoutEffect/, "and it has to be imported");
});

check("nothing else re-reads the basis after paint", () => {
  // A second, post-paint writer would reintroduce exactly the same drift.
  const writes = layer.match(/projectionBasisRef\.current = /g) ?? [];
  assert.equal(writes.length, 1, `the basis must have one writer, found ${writes.length}`);
});

check("pan and zoom are both handled by the transform", () => {
  // Giving up on a rescale hands the frame to a React redraw that lands after
  // the candles have moved — one wheel notch is enough to see it.
  const viewport = layer.slice(layer.indexOf("const onViewport = () => {"), layer.indexOf("const unsubscribe = subscribeViewport"));
  assert.match(viewport, /const scaleX = \(xB - xA\) \/ \(basis\.xB - basis\.xA\);/);
  assert.match(viewport, /const scaleY = \(yB - yA\) \/ \(basis\.yB - basis\.yA\);/);
  assert.match(viewport, /group\.setAttribute\("transform", `translate\(\$\{dx\} \$\{dy\}\) scale\(\$\{scaleX\} \$\{scaleY\}\)`\)/);
  // Only a genuinely impossible projection falls back to a redraw.
  assert.match(viewport, /scaleX <= 0\.001 \|\| scaleY <= 0\.001/);
});

check("a pure pan holds its transform, only a rescale settles", () => {
  // Text inside a scaled group scales with it, so a zoom has to be redrawn at
  // the real projection once movement stops. A pan does not distort anything
  // and can hold indefinitely — settling it too would be a needless re-render
  // of every drawing on every pan.
  const viewport = layer.slice(layer.indexOf("const onViewport = () => {"), layer.indexOf("const unsubscribe = subscribeViewport"));
  assert.match(viewport, /if \(scaleX !== 1 \|\| scaleY !== 1\) settle\(\);/);
});

check("strokes do not thicken while the group is scaled", () => {
  assert.match(layer, /<g ref=\{drawingsGroupRef\} vectorEffect="non-scaling-stroke"/);
});

check("the viewport subscription does not churn on live ticks", () => {
  // Chart.tsx passes the projectors as inline callbacks, so their identity
  // changes every live render. Depending on them would unsubscribe and
  // resubscribe continuously and leak listener closures during a session.
  assert.match(layer, /\}, \[subscribeViewport, chartReady\]\);/);
  assert.match(layer, /viewportProjectionRef\.current = \{ toX, toY \};/);
});

check("drawings are clipped to the PRICE pane, not the whole chart", () => {
  // A drawing is price-pane content. Clipping only the right edge let a
  // position calculator's target and stop boxes wash straight down over the
  // Volume, CVD and Kwant Stats panes - lines painted across other indicators'
  // content. Above the candles, behind everything that is not the price pane.
  const clip = layer.slice(layer.indexOf("<clipPath id={plotClipId}>"), layer.indexOf("</clipPath>"));
  assert.match(clip, /y=\{plotTopInset\}/, "start below any pane docked above");
  assert.match(clip, /height=\{Math\.max\(1, height - plotTopInset - plotBottomInset\)\}/,
    "and stop at the first pane docked below");
  // The right edge still stops at the price scale: drawings slide UNDER the
  // axis rather than painting across it.
  assert.match(clip, /width=\{Math\.max\(0, width - priceScaleWidth\) \+ EDGE_OVERSCAN\}/);

  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /plotTopInset=\{topIndicatorPaneHeight\}/);
  assert.match(chart, /plotBottomInset=\{indicatorPaneHeight \+ CHART_TIME_AXIS_HEIGHT\}/,
    "the time axis is part of the bottom inset, or drawings paint over it");
});

console.log(`\ndraw layer anchoring: ${passed}/${passed} checks passed`);
