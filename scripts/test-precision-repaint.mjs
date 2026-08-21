import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layer = readFileSync("src/chart/precision-tools/PrecisionToolsLayer.tsx", "utf8");
const types = readFileSync("src/chart/precision-tools/types.ts", "utf8");
const chart = readFileSync("src/components/Chart.tsx", "utf8");

// 1. The adapter exposes the chart's own paint signal.
assert.match(types, /subscribeViewport\?: \(listener: \(\) => void\) => \(\) => void;/);

// 2. Chart provides it from the repaint notifier, and the callback is STABLE —
//    an unstable one would re-subscribe on every render and defeat the point.
assert.match(chart, /const subscribePrecisionViewport = useCallback\(/);
assert.match(chart, /repaintNotifierRef\.current\?\.subscribe\(listener\)/);
assert.match(chart, /subscribeViewport: subscribePrecisionViewport,/);

// 3. The layer redraws on that signal, not only on React state. This is the
//    fix: a state-driven redraw sits behind a throttle, a transition and a very
//    large component, so the canvas was always behind the candles.
assert.match(layer, /const subscribe = adapter\.subscribeViewport;/);
assert.match(layer, /paintRef\.current\(\);/);

// 4. The paint body lives in a ref so the subscription never re-binds.
assert.match(layer, /const paintRef = useRef<\(\) => void>/);
assert.match(layer, /paintRef\.current = \(\) => \{/);

// 5. Repaints coalesce to one frame — the notifier fires on every chart paint.
const subscription = layer.slice(layer.indexOf("const subscribe = adapter.subscribeViewport;"));
assert.match(subscription, /if \(frame != null\) return;/);
assert.match(subscription, /requestAnimationFrame\(/);

// 6. It is cleaned up: no leaked frame, no leaked listener.
assert.match(subscription, /cancelAnimationFrame\(frame\);/);
assert.match(subscription, /unsubscribe\(\);/);

console.log("precision repaint: 6/6 checks passed");
