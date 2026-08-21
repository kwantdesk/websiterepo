import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const precision = readFileSync("src/chart/precision-tools/PrecisionToolsLayer.tsx", "utf8");
const drawLayer = readFileSync("src/components/ChartDrawLayer.tsx", "utf8");
const notifier = readFileSync("src/lib/chartRepaintNotifier.ts", "utf8");

// THE RULE: anything anchored to price/time must reach the screen in the SAME
// frame as the candles. A deferral of even one frame is the wobble that shows
// when the chart is grabbed and thrown.

// 1. The repaint signal fires inside the chart's own paint pass.
assert.match(notifier, /draw: \(_target: CanvasRenderingTarget2D\) => \{/);
assert.match(notifier, /for \(const listener of this\.listeners\) listener\(\);/);

// 2. The precision canvas paints straight from that signal — no rAF hop, which
//    would push it into the next frame.
const subscription = precision.slice(
  precision.indexOf("const subscribe = adapter.subscribeViewport;"),
  precision.indexOf("}, [adapter.subscribeViewport]);"),
);
assert.ok(
  subscription.includes("subscribe(() => paintRef.current())"),
  "the precision layer must paint synchronously in the chart frame",
);
// Comments legitimately mention rAF, so only executable lines are inspected.
const subscriptionCode = subscription
  .split(String.fromCharCode(10))
  .filter((line) => !line.trim().startsWith("//"))
  .join(String.fromCharCode(10));
assert.ok(
  !subscriptionCode.includes("requestAnimationFrame"),
  "deferring to the next frame reintroduces a frame of lag",
);

// 3. SVG cannot paint inside the chart pass, so a PAN is compensated with a
//    transform in the same frame instead of waiting for React.
assert.match(drawLayer, /const projectionBasisRef = useRef</);
assert.match(drawLayer, /group\.setAttribute\("transform", `translate\(\$\{dx\} \$\{dy\}\)`\)/);

// 4. Only a pure translation may be compensated. Scaling the layer would
//    distort strokes and text rather than move them, so a real scale change
//    falls back to a redraw.
assert.match(drawLayer, /Math\.abs\(scaleX - 1\) < 0\.0005 && Math\.abs\(scaleY - 1\) < 0\.0005/);
assert.match(drawLayer, /if \(!translated\) \{/);
assert.match(drawLayer, /forceRedraw\(\(value\) => value \+ 1\);/);

// 5. A fresh render must clear the compensating transform, or the next pan
//    would translate coordinates that already moved.
assert.match(drawLayer, /drawingsGroupRef\.current\?\.removeAttribute\("transform"\);/);

// 6. The compensated content is wrapped in the group being transformed.
assert.match(drawLayer, /<g ref=\{drawingsGroupRef\}>/);

console.log("overlay in-frame painting: 6/6 checks passed");
