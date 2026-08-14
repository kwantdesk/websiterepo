import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);

test("Kwant-zone cache is rendered only when the individual pane enables it", () => {
  assert.match(
    workspaceSource,
    /buildGameplanChartDecorations\(kwantLevelsEnabled \? gameplanOverlay : null, settings\)/,
  );
  assert.match(
    workspaceSource,
    /gameplanOverlay=\{paneLevelState\.kwant && gameplanRoot/,
  );
  assert.doesNotMatch(
    workspaceSource,
    /gameplanOverlay=\{gameplanRoot \? gameplanChartOverlays/,
  );
});

test("pane controls mutate and clear only the chart pane they belong to", () => {
  assert.match(
    workspaceSource,
    /setPaneIndicators\(\(current\) => \(\{ \.\.\.current, \[paneId\]: \[\] \}\)\)/,
  );
  assert.match(
    workspaceSource,
    /onRemoveAllIndicators=\{\(\) => removeAllIndicatorsFromPane\(pane\.id\)\}/,
  );
  assert.match(
    workspaceSource,
    /setPaneLevelVisible\(pane\.id, "kwant", false\)/,
  );
});
