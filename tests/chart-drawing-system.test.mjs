import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const toolbarCatalog = readFileSync(new URL("../src/lib/tradingViewToolbarCatalog.ts", import.meta.url), "utf8");
const engine = readFileSync(new URL("../src/lib/professionalDrawingEngine.ts", import.meta.url), "utf8");
const registry = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/registry/tool-registry.ts", import.meta.url), "utf8");
const kwantTools = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/kwant/kwant-tool-drawing.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const drawingGeometry = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/core/geometry.ts", import.meta.url), "utf8");
const drawingPaneView = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/rendering/drawing-pane-view.ts", import.meta.url), "utf8");
const drawingManager = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/core/drawing-manager.ts", import.meta.url), "utf8");
const drawingCoordinates = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/core/coordinate-utils.ts", import.meta.url), "utf8");
const horizontalLine = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/lines/horizontal-line.ts", import.meta.url), "utf8");
const horizontalLinePane = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/lines/horizontal-line-pane-view.ts", import.meta.url), "utf8");
const verticalLine = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/lines/vertical-line.ts", import.meta.url), "utf8");
const verticalLinePane = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/lines/vertical-line-pane-view.ts", import.meta.url), "utf8");
const coordinateUtils = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/core/coordinate-utils.ts", import.meta.url), "utf8");
const fibRetracement = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/channels/fib-retracement.ts", import.meta.url), "utf8");
const fibRetracementPane = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/channels/fib-retracement-pane-view.ts", import.meta.url), "utf8");

const expectedTools = [
  "Trend Line", "Angle", "Vertical Line", "Horizontal Line", "Horizontal Ray", "Cross Line", "Pencil",
  "Triangle", "Rectangle", "Ellipse", "Price Channel", "Highlight Y", "Highlight X",
  "Market Profile", "Fixed Market Profile", "Anchored Market Profile", "ZigZag TPO & Profile", "Anchored VWAP", "Dynamic POC", "CVD Correlation",
  "Fibonacci Retracements", "Fibonacci Extensions", "Fibo Fan",
  "Impulse (12345)", "Correction (ABC)", "Triangle (ABCDE)", "Double Combo (WXY)", "Triple Combo (WXYXZ)",
  "Ruler", "Measure", "Buy Calculator", "Sell Calculator", "Volume Profile", "Text", "Label", "Right Price Label", "Left Price Label",
  "Dot", "Diamond", "Square", "Up Arrow", "Down Arrow",
];

test("the live chart rail preserves the legacy actions inside the reconstructed 93-tool catalog", () => {
  assert.equal(expectedTools.length, 42);
  for (const label of expectedTools) assert.match(chart, new RegExp(`"${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(toolbarCatalog, /TRADINGVIEW_TOOLBAR_TOOL_COUNT = 93/);
  assert.match(chart, /const ACTIVE_DRAWING_TOOLBAR_GROUPS: ToolbarGroup\[\] = RECONSTRUCTED_GROUP_ORDER\.flatMap/);
  assert.match(chart, /TRADINGVIEW_TOOLBAR_TOOL_IDS\.has\(tool\.id\)/);
  assert.match(chart, /TRADINGVIEW_TOOLBAR_BY_APP_TOOL\.get\(tool\.id\)/);
  assert.doesNotMatch(toolbarCatalog, /Soon/);
});

test("all 41 actions resolve through the authoritative canvas registry", () => {
  for (const tool of [
    "priceChannel", "highlightX", "highlightY", "fibFan", "elliottImpulseWave", "ruler", "measure",
    "dot", "diamond", "square", "upArrow", "downArrow", "anchoredVwap", "dynamicPoc", "cvdCorrelation",
    "marketProfile", "fixedRangeVolumeProfile", "anchoredVolumeProfile", "zigzagTpoProfile",
  ]) assert.match(engine, new RegExp(`\\b${tool}:`));
  assert.match(registry, /new KwantToolDrawing\(type, requiredAnchors/);
  assert.match(chart, /new DrawingManager\(\)/);
});

test("drawings are isolated by chart pane and migrated from the legacy key", () => {
  assert.match(workspace, /chartInstanceId=\{pane\.id\}/);
  assert.match(chart, /kwantdesk:chart-drawings:v1:\$\{chartInstanceId\}:\$\{instrument\}/);
  assert.match(chart, /kwantify-chart-drawings:\$\{instrument\}/);
  assert.match(chart, /drawingPersistenceInstrument/);
});

test("drawing controls include history, clipboard, templates, magnet and keep mode", () => {
  assert.match(chart, /professionalUndoStackRef/);
  assert.match(chart, /professionalRedoStackRef/);
  assert.match(chart, /professionalClipboardRef/);
  assert.match(chart, /kwantdesk:drawing-templates:v1/);
  assert.match(chart, /kwantdesk:drawing-favourites:v1/);
  assert.match(chart, /"off" \| "weak" \| "medium" \| "strong"/);
  assert.match(chart, /keepDrawingModeRef/);
  assert.match(chart, /professionalPendingAnchorsRef\.current\.pop\(\)/);
});

test("a drawing menu row activates its tool on the first click", () => {
  assert.match(chart, /function activateToolbarTool\(toolId: DrawingToolId\)/);
  assert.match(chart, /selectedToolRef\.current = toolId;[\s\S]*?claimChartInteraction\("legacy-tools"\);[\s\S]*?setSelectedTool\(toolId\)/);
  assert.match(chart, /onClick=\{\(\) => \{\s*if \(implemented\) activateToolbarTool\(tool\.id\);\s*\}\}/);
});

test("completed line tools open their style and template editor on double-click", () => {
  assert.match(drawingManager, /addEventListener\('dblclick', this\.handleDoubleClick, true\)/);
  assert.match(drawingManager, /this\.emit\('drawing:double-clicked'/);
  assert.match(chart, /DOUBLE_CLICK_STYLE_DRAWING_TYPES/);
  assert.match(chart, /drawingManager\.on\("drawing:double-clicked"/);
  assert.match(chart, /setShowDrawingSettings\(true\)/);
  assert.match(chart, /Line colour/);
  assert.match(chart, /Templates/);
  assert.match(chart, /saveSelectedDrawingTemplate/);
});

test("fib retracement honours the magnet and has persistent Kwant Fib settings", () => {
  assert.match(chart, /const KWANT_FIB_LEVELS = \[1, 0\.786, 0\.618, 0\.5, 0\.382\]/);
  assert.match(chart, /name: "Kwant Fib"/);
  assert.match(chart, /name: "Kwant Fib"[\s\S]*?reverseDirection: true/);
  assert.match(chart, /template\.id === KWANT_FIB_TEMPLATE_ID[\s\S]*?reverseDirection: true/);
  // The fib magnet exclusion WAS the bug; it must use the shared resolver.
  assert.doesNotMatch(chart, /=== "fibRetracement" \|\| event\.altKey/);
  assert.match(chart, /magnetResolverRef\.current\.resolve/);
  assert.match(chart, /setAnchorSnapResolver/);
  assert.match(chart, /"fib-retracement",[\s\S]*?"fixed-market-profile"/);
  assert.match(chart, /Fib levels/);
  assert.match(chart, /Magnet locks anchors to candle highs and lows/);
  assert.match(chart, /updateSelectedFibLevel/);
  assert.match(chart, /updateSelectedFibLevelStyle/);
  assert.match(chart, /addSelectedFibLevel/);
  assert.match(chart, /removeSelectedFibLevel/);
  assert.match(chart, /fibLabelPosition/);
  assert.match(chart, /fibBackgroundVisible/);
  assert.match(fibRetracement, /FIBONACCI_LEVELS = \[1, 0\.786, 0\.618, 0\.5, 0\.382\]/);
  assert.doesNotMatch(fibRetracement, /private _fibOptions/);
  assert.match(fibRetracementPane, /fibLevelStyles/);
  assert.match(fibRetracementPane, /showRatios/);
  assert.match(fibRetracementPane, /const bottomAnchorY = Math\.max\(p1\.y, p2\.y\)/);
  assert.match(fibRetracementPane, /\{ x: 0, y: bottomAnchorY \}/);
  assert.match(fibRetracementPane, /\{ x: viewport\.width, y: bottomAnchorY \}/);
  assert.match(fibRetracementPane, /\[2, 4\]/);
});

test("the full visible body of every drawing is selectable, movable and deletable", () => {
  assert.match(drawingManager, /hitTestGeometries\(point, drawing\.computeGeometry\(viewport\), 8\)/);
  assert.match(drawingGeometry, /export function hitTestGeometry/);
  assert.match(drawingGeometry, /geometry\.type === 'rectangle'/);
  assert.match(drawingGeometry, /geometry\.type === 'polygon'/);
  // Only the level lines select a Fib. Treating the shaded band as a handle
  // made the whole rectangle answer the hit test, so a Fib drawn over price
  // hijacked every hover inside it.
  assert.doesNotMatch(
    fibRetracement,
    /point\.y >= minY && point\.y <= maxY/,
    "the shaded band must not be selectable",
  );
  assert.match(
    fibRetracement,
    /Math\.abs\(point\.y - y\) <= FibRetracement\.HIT_THRESHOLD/,
    "a level line is still selectable within its threshold",
  );
  // Anchors must not drift when the chart is panned: the extrapolation
  // reference cannot be derived from the current viewport edge.
  assert.doesNotMatch(
    coordinateUtils,
    /coordinateToLogical\(Math\.max\(0, viewport\.width - 1\)\)/,
    "extrapolation must not reference the viewport edge",
  );
});

test("control-drag marquee selects, moves and deletes drawing groups without chart panning", () => {
  assert.match(drawingManager, /event\.ctrlKey && event\.button === 0/);
  assert.match(drawingManager, /updateMarqueeElement\(point, point\)/);
  assert.match(drawingManager, /selectDrawingsInRectangle/);
  assert.match(drawingManager, /getSelectedDrawings\(\): IDrawing\[\]/);
  assert.match(drawingManager, /_dragOriginalAnchorsByDrawing/);
  assert.match(drawingManager, /event\.preventDefault\(\)/);
  assert.match(drawingManager, /event\.stopPropagation\(\)/);
  assert.match(chart, /const selected = manager\?\.getSelectedDrawings\(\) \?\? \[\]/);
  assert.match(chart, /selected\.forEach\(\(drawing\) => manager\?\.removeDrawing\(drawing\.id\)\)/);
});

test("horizontal and vertical lines use exact native axis labels", () => {
  assert.match(horizontalLine, /priceAxisViews\(\): readonly ISeriesPrimitiveAxisView\[\]/);
  assert.match(horizontalLine, /fixedCoordinate: \(\) => this\.priceAxisCoordinate\(\)/);
  assert.match(verticalLine, /timeAxisViews\(\): readonly ISeriesPrimitiveAxisView\[\]/);
  assert.match(verticalLine, /fixedCoordinate: \(\) => this\.timeAxisCoordinate\(\)/);
  assert.doesNotMatch(horizontalLinePane, /drawLabel/);
  assert.doesNotMatch(verticalLinePane, /drawLabel/);
});

test("clear all drawings removes every chart-scoped drawing layer and persisted state", () => {
  const clearAction = chart.slice(
    chart.indexOf("function clearAllChartDrawings()"),
    chart.indexOf("useEffect(() => {", chart.indexOf("function clearAllChartDrawings()")),
  );
  assert.match(clearAction, /professionalDrawingsLoadGenerationRef\.current \+= 1/);
  assert.match(clearAction, /professionalDrawingManagerRef\.current\?\.clearAll\(\)/);
  assert.match(clearAction, /setProfessionalDrawings\(\[\]\)/);
  assert.match(clearAction, /setDrawings\(\[\]\)/);
  assert.match(clearAction, /professionalUndoStackRef\.current = \[\]/);
  assert.match(clearAction, /professionalRedoStackRef\.current = \[\]/);
  assert.match(clearAction, /setSelectedProfessionalDrawingId\(null\)/);
  assert.match(clearAction, /setPrecisionClearRevision\(\(revision\) => revision \+ 1\)/);
  assert.match(clearAction, /drawingsStorageKey\(instrument, chartInstanceId\)/);
  assert.match(clearAction, /drawingPersistenceInstrument, drawings: \[\]/);
  assert.match(chart, /Clear all drawings/);
  assert.match(chart, /clearAllChartDrawings\(\)/);
});

test("drawing drags stay pointer-locked and can enter future chart whitespace", () => {
  assert.match(drawingManager, /window\.addEventListener\('mousemove', this\.handleMouseMove, true\)/);
  assert.match(drawingManager, /requestAnimationFrame/);
  assert.match(drawingManager, /coordinateToNumericTime\(viewport, point\.x\)/);
  assert.match(drawingCoordinates, /coordinateToLogical/);
  assert.match(drawingCoordinates, /numericTimeToCoordinate/);
});

test("analytical drawings consume real volume and classified bid-ask data", () => {
  assert.match(chart, /configureProfessionalDrawingMarketData/);
  assert.match(kwantTools, /typical \* volume/);
  assert.match(kwantTools, /Number\(bar\.askVolume\) - Number\(bar\.bidVolume\)/);
  assert.match(kwantTools, /rows\.get\(tick\)/);
  assert.match(kwantTools, /Price-level executions unavailable/);
  assert.doesNotMatch(kwantTools, /Math\.random/);
});

test("fixed market profile uses native value-area math and faces forward", () => {
  const fixedProfile = kwantTools.match(
    /if \(this\.type === "fixed-market-profile"\) \{[\s\S]*?\n      return geometry;\n    \}/,
  )?.[0] ?? "";
  assert.match(kwantTools, /calculateVolumeProfileValueArea/);
  assert.match(kwantTools, /STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT/);
  assert.match(kwantTools, /const rangeStartMs = anchored \? startMs : Math\.min\(startMs, lastAnchorMs\)/);
  assert.match(fixedProfile, /topLeft: \{ x: profileLeft/);
  assert.match(fixedProfile, /width,/);
  assert.doesNotMatch(fixedProfile, /profileRight - width/);
  assert.match(fixedProfile, /this\.id === "__kwantdesk_drawing_preview__"/);
  assert.match(fixedProfile, /this\._state === "selected"/);
  assert.match(fixedProfile, /this\._state === "editing"/);
  assert.match(fixedProfile, /x: 0, y: p\[1\]\.y/);
  assert.match(fixedProfile, /x: viewport\.width, y: p\[1\]\.y/);
  assert.match(drawingGeometry, /fillColor\?: string/);
  assert.match(drawingPaneView, /if \(rect\.fillColor\) ctx\.fillRect/);
});

test("dragging a drawing translates it in pixels, not in time", () => {
  // A drag moves a drawing across the SCREEN, so it has to translate in
  // screen space. Applying a time delta to every point assumes an equal step
  // in time is an equal step in pixels, and it is not: bar times on a volume,
  // range or tick chart are irregular, a session gap folds hours into one
  // boundary, and past the last bar the mapping extrapolates. The same
  // drawing therefore stretched, sheared and threw points at the edge of the
  // pane while it was moved — worst on a pencil stroke, where every sample
  // carries its own time and each distorted by a different amount.
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(
    layer,
    /const dt = point\.time - (start|drag\.start)\.time/,
    "a whole-drawing move must not be a time delta",
  );
  assert.doesNotMatch(
    layer,
    /origin\.map\(\(p\) => \(\{ time: p\.time \+ dt, price: p\.price \+ dp \}\)\)/,
    "a whole-drawing move must not be a time delta",
  );
  // Both move paths — the handle-bar grab and the select-and-drag on the
  // capture rect — hold where each point sat on screen and re-project from
  // there, so the shape that lands is the shape that was drawn.
  const pixelOrigins = layer.match(/originPixels|startPixels/g) ?? [];
  assert.ok(
    pixelOrigins.length >= 4,
    `both drag paths must capture screen positions (found ${pixelOrigins.length} references)`,
  );
  assert.match(layer, /fromXY\(pixel\.x \+ dx, pixel\.y \+ dy\)/);
});

test("drawings track a zoom in the same frame, not a frame behind it", () => {
  // Panning and zooming a linear time and price scale are both AFFINE, so a
  // translate-and-scale reproduces the new projection EXACTLY, however far the
  // chart has moved. The layer used to give up past a five-percent rescale and
  // hand the frame to a React redraw — and one wheel notch is more than five
  // percent, so every zoom left the drawings behind the chart and then snapped
  // them into place when the movement stopped. That snap is what reads as a
  // drawing bugging around and resetting.
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(
    layer,
    /Math\.abs\(scaleX - 1\) > 0\.05 \|\| Math\.abs\(scaleY - 1\) > 0\.05/,
    "a zoom must be matched by the transform, not deferred to a redraw",
  );
  assert.match(layer, /translate\(\$\{dx\} \$\{dy\}\) scale\(\$\{scaleX\} \$\{scaleY\}\)/);
  // Only a degenerate projection falls back to a redraw.
  assert.match(layer, /scaleX <= 0\.001 \|\| scaleY <= 0\.001/);

  // Text inside a scaled group scales with it, so the layer re-renders at the
  // true projection once movement stops. The transform has been holding the
  // correct position throughout, so nothing moves in the swap.
  assert.match(layer, /const settle = \(\) => \{/);
  assert.match(layer, /if \(scaleX !== 1 \|\| scaleY !== 1\) settle\(\);/,
    "a pure pan needs no settle — it translates text without distorting it");

  // Stroke weight must not ride the scale.
  assert.match(layer, /ref=\{drawingsGroupRef\}/);
  assert.match(layer, /vectorEffect="non-scaling-stroke"/);
});

test("a freehand stroke offers two handles, not one per sample", () => {
  // A pencil or highlighter stroke is hundreds of sampled points, and a grab
  // dot on every one of them buries the stroke under its own handles. The two
  // that mean anything are where it started and where it ended.
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  assert.match(
    layer,
    /DRAW_TOOL_SPECS\[drawing\.tool\]\.points === "freehand" && valid\.length > 2/,
    "freehand must be handled apart from anchored tools",
  );
  assert.match(layer, /\{ point: valid\[0\], index: 0 \}/, "the first sample keeps a handle");
  assert.match(layer, /index: drawing\.points\.length - 1/, "so does the last");
  // The index handed to the drag must be the index in the DRAWING, not in the
  // filtered on-screen list, or dragging the end handle would move the wrong
  // sample.
  assert.match(layer, /beginDrag\(drawing, index, event\)/);
});

test("drawings end where the candles end, not over the price scale", () => {
  // The overlay spans the whole chart element, so without a clip every
  // drawing paints across the price scale — a trend line or a rectangle
  // sitting over the chart's own axis instead of sliding under it the way
  // candles do.
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  assert.match(layer, /priceScaleWidth\?: number;/, "the layer must know where the scale starts");
  assert.match(layer, /width=\{Math\.max\(0, width - priceScaleWidth\) \+ EDGE_OVERSCAN\}/);
  assert.match(layer, /clipPath=\{`url\(#\$\{plotClipId\}\)`\}/, "the drawing group must be clipped");
  // Unique per layer, or two charts on screen share one clip.
  assert.match(layer, /const plotClipId = useId\(\)/);
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /priceScaleWidth=\{nativePriceScaleWidth\}/, "the chart must pass its measured scale width");
});
