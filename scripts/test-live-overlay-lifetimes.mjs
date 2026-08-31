import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const precision = readFileSync("src/chart/precision-tools/PrecisionToolsLayer.tsx", "utf8");
const drawings = readFileSync("src/components/ChartDrawLayer.tsx", "utf8");
const chart = readFileSync("src/components/Chart.tsx", "utf8");
const repaintNotifier = readFileSync("src/lib/chartRepaintNotifier.ts", "utf8");

function between(source, start, end, label) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `${label}: start marker was not found`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `${label}: end marker was not found`);
  return source.slice(from, to);
}

const globalCrosshair = between(
  precision,
  'window.addEventListener("kwantdesk:precision-global-crosshair"',
  "// Held in a ref so the repaint subscription below never has to re-bind.",
  "precision global crosshair lifecycle",
);
assert.match(globalCrosshair, /window\.removeEventListener\("kwantdesk:precision-global-crosshair"/);
assert.match(globalCrosshair, /\}, \[\]\);\s*$/,
  "the global crosshair listener must be installed once per overlay lifetime");
assert.doesNotMatch(globalCrosshair, /\}, \[[^\]]*\badapter\b[^\]]*\]\);/,
  "live adapter updates must never rebind the global crosshair listener");

const resizeObserver = between(
  precision,
  "const observer = new ResizeObserver",
  "useEffect(() => { setConfigs",
  "precision ResizeObserver lifecycle",
);
assert.match(resizeObserver, /observer\.disconnect\(\)/);
assert.match(resizeObserver, /\}, \[\]\);\s*$/,
  "the precision ResizeObserver must be installed once per overlay lifetime");

const dormantGrab = between(
  precision,
  'document.addEventListener("pointerdown", handleDormantGrab, true)',
  "const onPointerDown =",
  "dormant drawing grab lifecycle",
);
assert.match(dormantGrab, /document\.removeEventListener\("pointerdown", handleDormantGrab, true\)/);
assert.match(dormantGrab, /\}, \[\]\);\s*$/,
  "the document pointer listener must be installed once per overlay lifetime");

const drawingViewport = between(
  drawings,
  "const unsubscribe = subscribeViewport(onViewport);",
  "// Volume-profile histograms",
  "drawing viewport lifecycle",
);
assert.match(drawingViewport, /unsubscribe\(\)/);
const viewportDependencies = drawingViewport.match(/\}, \[([^\]]*)\]\);\s*$/)?.[1] ?? "";
assert.equal(viewportDependencies.replaceAll(/\s/g, ""), "subscribeViewport,chartReady",
  "drawing viewport subscription must not rebind for live projector callback identities");
assert.doesNotMatch(viewportDependencies, /\b(toX|toY|candles|adapter|viewportVersion)\b/,
  "live chart projection changes must be read through refs, not effect dependencies");

assert.match(drawings, /const viewportProjectionRef = useRef\(\{ toX, toY \}\)/);
assert.match(drawings, /viewportProjectionRef\.current = \{ toX, toY \}/);

const chartViewportSubscription = between(
  chart,
  "const subscribeDrawViewport = useCallback",
  "const commitDrawings = useCallback",
  "chart drawing viewport subscription",
);
assert.match(chartViewportSubscription, /subscribeVisibleLogicalRangeChange\(callback\)/);
assert.match(chartViewportSubscription, /unsubscribeVisibleLogicalRangeChange\(callback\)/);
assert.match(chartViewportSubscription, /unsubscribeRepaint\?\.\(\)/);
assert.match(chartViewportSubscription, /\}, \[\]\);\s*$/,
  "the chart viewport source must remain stable across live candle renders");

const precisionViewportSubscription = between(
  chart,
  "const subscribePrecisionViewport = useCallback",
  "const precisionAdapter = useMemo",
  "precision repaint subscription",
);
assert.match(precisionViewportSubscription, /repaintNotifierRef\.current\?\.subscribe\(listener\)/);
assert.match(precisionViewportSubscription, /\), \[\]\);\s*$/,
  "the precision repaint source must remain stable across live candle renders");

const chartConstructionStart = chart.indexOf("const chart = createChart(chartContainerRef.current");
assert.ok(chartConstructionStart >= 0, "chart constructor lifetime: constructor was not found");
const chartConstructionDeps = chart.indexOf("}, [chartConstructionSettingsKey", chartConstructionStart);
assert.ok(chartConstructionDeps > chartConstructionStart, "chart constructor lifetime: dependencies were not found");
const chartConstructionEnd = chart.indexOf("]);", chartConstructionDeps);
assert.ok(chartConstructionEnd > chartConstructionDeps, "chart constructor lifetime: dependency list did not close");
const chartConstruction = chart.slice(chartConstructionStart, chartConstructionEnd + 3);
const constructorDependencies = chartConstruction.match(/\}, \[([^\]]*)\]\);\s*$/)?.[1] ?? "";
assert.match(constructorDependencies, /chartConstructionSettingsKey/);
assert.doesNotMatch(constructorDependencies, /\b(candles|viewportVersion|overlaySize|lastPrice|livePrice)\b/,
  "live market values must never reconstruct the Lightweight Chart instance");
assert.match(chartConstruction, /try \{ chart\.remove\(\); \}/,
  "every constructed chart instance must release its canvases during cleanup");

assert.match(repaintNotifier, /subscribe\(listener: \(\) => void\)[\s\S]*this\.listeners\.delete\(listener\)/,
  "repaint subscriptions must return an exact listener cleanup");
assert.match(repaintNotifier, /detached\(\) \{\s*this\.listeners\.clear\(\);\s*\}/,
  "detaching the chart primitive must drop all retained overlay listeners");

console.log("live overlay lifetimes: 28/28 checks passed");
