import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../src/lib/professionalDrawingEngine.ts", import.meta.url), "utf8");
const registry = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/registry/tool-registry.ts", import.meta.url), "utf8");
const kwantTools = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/kwant/kwant-tool-drawing.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const drawingGeometry = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/core/geometry.ts", import.meta.url), "utf8");
const drawingPaneView = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/rendering/drawing-pane-view.ts", import.meta.url), "utf8");
const drawingManager = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/core/drawing-manager.ts", import.meta.url), "utf8");
const horizontalLine = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/lines/horizontal-line.ts", import.meta.url), "utf8");
const horizontalLinePane = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/lines/horizontal-line-pane-view.ts", import.meta.url), "utf8");
const verticalLine = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/lines/vertical-line.ts", import.meta.url), "utf8");
const verticalLinePane = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/lines/vertical-line-pane-view.ts", import.meta.url), "utf8");

const expectedTools = [
  "Trend Line", "Angle", "Vertical Line", "Horizontal Line", "Horizontal Ray", "Cross Line", "Pencil",
  "Triangle", "Rectangle", "Ellipse", "Price Channel", "Highlight Y", "Highlight X",
  "Market Profile", "Fixed Market Profile", "Anchored Market Profile", "ZigZag TPO & Profile", "Anchored VWAP", "Dynamic POC", "CVD Correlation",
  "Fibonacci Retracements", "Fibonacci Extensions", "Fibo Fan",
  "Impulse (12345)", "Correction (ABC)", "Triangle (ABCDE)", "Double Combo (WXY)", "Triple Combo (WXYXZ)",
  "Ruler", "Measure", "Buy Calculator", "Sell Calculator", "Volume Profile", "Text", "Label", "Right Price Label", "Left Price Label",
  "Dot", "Diamond", "Square", "Up Arrow", "Down Arrow",
];

test("the live chart rail exposes the requested drawing actions", () => {
  const activeSection = chart.slice(
    chart.indexOf("const ACTIVE_DRAWING_TOOLBAR_GROUPS"),
    chart.indexOf("const ALL_DRAWING_TOOLS"),
  );
  assert.equal(expectedTools.length, 42);
  for (const label of expectedTools) assert.match(activeSection, new RegExp(`"${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.equal((activeSection.match(/activeDrawingTool\(/g) ?? []).length, 42);
  assert.doesNotMatch(activeSection, /Soon/);
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
