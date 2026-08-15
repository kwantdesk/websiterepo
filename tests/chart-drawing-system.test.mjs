import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../src/lib/professionalDrawingEngine.ts", import.meta.url), "utf8");
const registry = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/registry/tool-registry.ts", import.meta.url), "utf8");
const kwantTools = readFileSync(new URL("../src/vendor/lightweight-charts-drawing/tools/kwant/kwant-tool-drawing.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

const expectedTools = [
  "Trend Line", "Angle", "Vertical Line", "Horizontal Line", "Horizontal Ray", "Cross Line", "Brush",
  "Triangle", "Rectangle", "Ellipse", "Price Channel", "Highlight Y", "Highlight X",
  "Market Profile", "Fixed Market Profile", "Anchored Market Profile", "ZigZag TPO & Profile", "Anchored VWAP", "Dynamic POC", "CVD Correlation",
  "Fibonacci Retracements", "Fibonacci Extensions", "Fibo Fan",
  "Impulse (12345)", "Correction (ABC)", "Triangle (ABCDE)", "Double Combo (WXY)", "Triple Combo (WXYXZ)",
  "Ruler", "Measure", "Long Position", "Short Position", "Text", "Label", "Right Price Label", "Left Price Label",
  "Dot", "Diamond", "Square", "Up Arrow", "Down Arrow",
];

test("the live chart rail exposes the exact 41 requested drawing actions", () => {
  const activeSection = chart.slice(
    chart.indexOf("const ACTIVE_DRAWING_TOOLBAR_GROUPS"),
    chart.indexOf("const ALL_DRAWING_TOOLS"),
  );
  assert.equal(expectedTools.length, 41);
  for (const label of expectedTools) assert.match(activeSection, new RegExp(`"${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.equal((activeSection.match(/activeDrawingTool\(/g) ?? []).length, 41);
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
