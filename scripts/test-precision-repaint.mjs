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
assert.match(layer, /subscribe\(\(\) => paintRef\.current\(\)\)/);

// 4. The paint body lives in a ref so the subscription never re-binds.
assert.match(layer, /const paintRef = useRef<\(\) => void>/);
assert.match(layer, /paintRef\.current = \(\) => \{/);

// 5. Repaints run in the chart's own paint beat. Deferring this subscription
//    through another rAF leaves drawings one frame behind the bars.
const subscription = layer.slice(layer.indexOf("const subscribe = adapter.subscribeViewport;"));
assert.match(subscription, /const unsubscribe = subscribe\(\(\) => paintRef\.current\(\)\);/);

// 6. The viewport subscription is cleaned up.
assert.match(subscription, /unsubscribe\(\);/);

// 7. The global crosshair listener is installed once for the lifetime of the
//    layer. The chart adapter changes with live candles and viewport updates;
//    depending on it here produced thousands of retained listener closures in
//    a multi-chart workspace during an active session.
assert.match(layer, /const globalCrosshairStateRef = useRef\(/);
assert.match(layer, /const current = globalCrosshairStateRef\.current;/);
const globalCrosshairListenerIndex = layer.indexOf(
  'window.addEventListener("kwantdesk:precision-global-crosshair"',
);
assert.ok(globalCrosshairListenerIndex >= 0, "global crosshair listener must exist");
const globalCrosshairEffectStart = layer.lastIndexOf(
  "useEffect(() => {",
  globalCrosshairListenerIndex,
);
const globalCrosshairEffectEnd = layer.indexOf(
  "// Held in a ref",
  globalCrosshairListenerIndex,
);
const globalCrosshairEffect = layer.slice(globalCrosshairEffectStart, globalCrosshairEffectEnd);
assert.match(globalCrosshairEffect, /window\.addEventListener\("kwantdesk:precision-global-crosshair"/);
assert.match(globalCrosshairEffect, /window\.removeEventListener\("kwantdesk:precision-global-crosshair"/);
assert.match(
  globalCrosshairEffect,
  /\}, \[\]\);/,
  "global crosshair listener must not re-bind when the live chart adapter changes",
);

// 8. The resize observer is also lifetime-bound. Live adapter replacement must
//    not create and disconnect observers on every market tick.
assert.match(layer, /const liveAdapterRef = useRef\(adapter\);/);
const resizeObserverIndex = layer.indexOf("new ResizeObserver");
assert.ok(resizeObserverIndex >= 0, "precision resize observer must exist");
const resizeObserverEffectStart = layer.lastIndexOf("useEffect(() => {", resizeObserverIndex);
const resizeObserverEffectEnd = layer.indexOf("useEffect", resizeObserverIndex + 10);
const resizeObserverEffect = layer.slice(resizeObserverEffectStart, resizeObserverEffectEnd);
assert.match(resizeObserverEffect, /liveAdapterRef\.current\.requestChartRender\(\)/);
assert.match(
  resizeObserverEffect,
  /\}, \[\]\);/,
  "resize observer must not re-bind when the live chart adapter changes",
);

// 9. Dormant drawing hit-testing needs the latest objects and projections, but
//    the document listener itself must remain singular during live updates.
assert.match(layer, /const dormantGrabStateRef = useRef\(/);
const dormantListenerIndex = layer.indexOf('document.addEventListener("pointerdown", handleDormantGrab');
assert.ok(dormantListenerIndex >= 0, "dormant drawing grab listener must exist");
const dormantEffectStart = layer.lastIndexOf("useEffect(() => {", dormantListenerIndex);
const dormantEffectEnd = layer.indexOf("const onPointerDown", dormantListenerIndex);
const dormantEffect = layer.slice(dormantEffectStart, dormantEffectEnd);
assert.match(dormantEffect, /const current = dormantGrabStateRef\.current;/);
assert.match(dormantEffect, /current\.store\.getSnapshot\(\)/);
assert.match(dormantEffect, /document\.removeEventListener\("pointerdown", handleDormantGrab/);
assert.match(
  dormantEffect,
  /\}, \[\]\);/,
  "dormant drawing listener must not re-bind when the live chart adapter changes",
);

// 10. Live adapter replacement must not schedule another React-side frame.
//     Viewport/candle updates already arrive through subscribeViewport; adding
//     adapter here multiplied rAF callbacks across every open chart.
const reactRepaintIndex = layer.indexOf("const frame = requestAnimationFrame(() => paintRef.current())");
assert.ok(reactRepaintIndex >= 0, "React-driven precision repaint must exist");
const reactRepaintEffectStart = layer.lastIndexOf("useEffect(() => {", reactRepaintIndex);
const reactRepaintEffectEnd = layer.indexOf("// Repaint with the chart", reactRepaintIndex);
const reactRepaintEffect = layer.slice(reactRepaintEffectStart, reactRepaintEffectEnd);
assert.doesNotMatch(
  reactRepaintEffect,
  /\[[^\]]*\badapter\b[^\]]*\]/,
  "React-driven precision repaint must not run on every live adapter replacement",
);

console.log("precision repaint: 10/10 checks passed");
