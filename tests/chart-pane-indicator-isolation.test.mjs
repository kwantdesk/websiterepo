import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("standard chart workspaces do not restore or paint cached legacy level overlays", () => {
  assert.doesNotMatch(workspace, /setPaneLevelVisibility|buildGameplanChartDecorations|backgroundLevels=|backgroundZones=|chartLevels\}/);
});

test("removing all indicators clears the owning pane indicator list", () => {
  assert.match(workspace, /setPaneIndicators\(\(current\) => \(\{ \.\.\.current, \[paneId\]: \[\] \}\), true\)/);
  assert.match(workspace, /onRemoveAllIndicators=\{\(\) => removeAllIndicatorsFromPane\(pane\.id\)\}/);
});
