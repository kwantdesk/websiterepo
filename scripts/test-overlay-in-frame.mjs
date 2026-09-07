import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const precision = readFileSync("src/chart/precision-tools/PrecisionToolsLayer.tsx", "utf8");
const drawLayer = readFileSync("src/components/ChartDrawLayer.tsx", "utf8");
const notifier = readFileSync("src/lib/chartRepaintNotifier.ts", "utf8");

// THE RULE: chart overlays may schedule at most one projection per browser
// frame. They must never lengthen the native chart's paint pass repeatedly.

// 1. The repaint signal fires inside the chart's own paint pass.
assert.match(notifier, /draw: \(_target: CanvasRenderingTarget2D\) => \{/);
assert.match(notifier, /for \(const listener of this\.listeners\) listener\(\);/);

// 2. The precision canvas coalesces native notifications and stays completely
//    detached when it has no visible drawing content.
const subscription = precision.slice(
  precision.indexOf("const subscribe = adapter.subscribeViewport;"),
  precision.indexOf("}, [adapter.subscribeViewport, snapshot.draft"),
);
assert.match(subscription, /if \(!subscribe \|\| !hasViewportContent\) return;/);
assert.match(subscription, /if \(viewportPaintFrameRef\.current != null\) return;/);
assert.match(subscription, /requestAnimationFrame\(\(\) => \{/);

// 3. The SVG layer also coalesces duplicate time-scale/repaint notifications.
assert.match(drawLayer, /const projectionBasisRef = useRef</);
assert.match(drawLayer, /if \(viewportFrame !== null\) return;/);
assert.match(drawLayer, /group\.setAttribute\("transform", `translate\(\$\{dx\} \$\{dy\}\) scale\(\$\{scaleX\} \$\{scaleY\}\)`\)/);

// 4. Pan and zoom remain affine until a short settle redraw restores true text size.
assert.match(drawLayer, /scaleX <= 0\.001 \|\| scaleY <= 0\.001/);
assert.match(drawLayer, /if \(scaleX !== 1 \|\| scaleY !== 1\) settle\(\);/);

// 5. A fresh render must clear the compensating transform, or the next pan
//    would translate coordinates that already moved.
assert.match(drawLayer, /drawingsGroupRef\.current\?\.removeAttribute\("transform"\);/);

// 6. The compensated content is wrapped in the group being transformed.
assert.match(drawLayer, /<g ref=\{drawingsGroupRef\} vectorEffect="non-scaling-stroke" clipPath=/);

console.log("overlay in-frame painting: 6/6 checks passed");
