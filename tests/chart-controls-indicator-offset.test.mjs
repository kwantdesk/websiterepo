import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const chart = await fs.readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const workspace = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("Chart reports the combined stacked indicator height to its owner", () => {
  assert.match(chart, /onIndicatorPaneHeightChange\?: \(height: number\) => void/);
  assert.match(chart, /onIndicatorPaneHeightChange\?\.\(indicatorPaneHeight\)/);
  assert.match(chart, /\(\) => \(\) => onIndicatorPaneHeightChange\?\.\(0\)/);
});

test("range and loading controls follow the indicator stack", () => {
  assert.match(workspace, /onIndicatorPaneHeightChange=\{setLowerIndicatorHeight\}/);
  const sharedBaseline = workspace.match(/style=\{\{ bottom: 56 \+ lowerIndicatorHeight \}\}/g) ?? [];
  assert.equal(sharedBaseline.length, 1, "the chart range control should follow the candle-timer baseline");
  assert.match(workspace, /style=\{\{ bottom: 86 \+ lowerIndicatorHeight \}\}/);
});
