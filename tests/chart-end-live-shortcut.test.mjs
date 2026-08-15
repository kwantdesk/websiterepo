import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const chart = await readFile(path.join(root, "src/components/Chart.tsx"), "utf8");
const workspace = await readFile(path.join(root, "src/components/KwantifyWorkspace.tsx"), "utf8");

test("End returns only the clicked active chart to its live viewport", () => {
  assert.match(chart, /onPointerDownCapture=\{\(\) => \{\s*activeChartKeyboardTargetId = chartInstanceId;/);
  assert.match(chart, /event\.key === "End"[\s\S]*activeChartKeyboardTargetId === chartInstanceId/);
  assert.match(chart, /returnToLiveViewport\(\)/);
  assert.match(chart, /resetChartViewport\([\s\S]*drawingCandlesRef\.current\.length/);
  assert.match(workspace, /keyboardActive=\{active\}/);
});

test("End does not hijack text and select controls", () => {
  assert.match(chart, /tagName === "input"/);
  assert.match(chart, /tagName === "textarea"/);
  assert.match(chart, /tagName === "select"/);
  assert.match(chart, /!isTypingContext[\s\S]*event\.key === "End"/);
});
