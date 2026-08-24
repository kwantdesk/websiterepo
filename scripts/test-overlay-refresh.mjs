import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chart = readFileSync("src/components/Chart.tsx", "utf8");

const mainViewportStart = chart.indexOf("const commitViewportRefresh = () =>");
const mainViewportEnd = chart.indexOf("const resizeObserver = new ResizeObserver(handleResize);", mainViewportStart);
assert.ok(mainViewportStart >= 0 && mainViewportEnd > mainViewportStart, "main viewport refresh block must exist");
const mainViewport = chart.slice(mainViewportStart, mainViewportEnd);

// 1. Deliberate horizontal viewport interactions still refresh React overlays.
assert.match(
  mainViewport,
  /subscribeVisibleLogicalRangeChange\(scheduleViewportRefresh\)/,
  "pan and zoom must refresh React coordinate overlays",
);

// 2. A chart repaint must never be connected to the React viewport refresh.
//    Live auto-scale repaints on almost every market tick; this bridge caused
//    full chart-tree React commits and unbounded listener churn.
assert.doesNotMatch(
  mainViewport,
  /repaintNotifierRef\.current\?\.subscribe\([^)]*(?:scheduleViewportRefresh|refreshOnRepaint)/s,
  "live repaints must not schedule a React chart rerender",
);
assert.doesNotMatch(mainViewport, /const refreshOnRepaint/, "the repaint-to-React bridge must stay removed");
assert.doesNotMatch(mainViewport, /overlayProbePrices/, "projection probes must not return to the live repaint loop");

// 3. The imperative drawing layer still receives both horizontal and vertical
//    viewport changes, so removing the React bridge does not reintroduce float.
const drawViewportStart = chart.indexOf("const subscribeDrawViewport = useCallback");
const drawViewportEnd = chart.indexOf("const commitDrawings = useCallback", drawViewportStart);
assert.ok(drawViewportStart >= 0 && drawViewportEnd > drawViewportStart, "drawing viewport subscription must exist");
const drawViewport = chart.slice(drawViewportStart, drawViewportEnd);
assert.match(drawViewport, /subscribeVisibleLogicalRangeChange\(callback\)/);
assert.match(drawViewport, /repaintNotifierRef\.current\?\.subscribe\(callback\)/);

// 4. Precision tools also repaint imperatively and must not require React state.
assert.match(
  chart,
  /const subscribePrecisionViewport = useCallback[\s\S]*?repaintNotifierRef\.current\?\.subscribe\(listener\)/,
);

console.log("overlay refresh boundary: 4/4 checks passed");
