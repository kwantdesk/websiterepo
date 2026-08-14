import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);

test("workspace dividers resize only their directly adjacent panes", () => {
  assert.match(workspace, /function preserveWorkspaceSubtreeWalls\(/);
  assert.match(workspace, /function resizeOnlyAdjacentWorkspacePanes\(/);
  assert.match(
    workspace,
    /first:\s*preserveWorkspaceSubtreeWalls\([\s\S]*?"start"[\s\S]*?second:\s*preserveWorkspaceSubtreeWalls\([\s\S]*?"end"/,
  );
  assert.match(workspace, /const splitElements = collectWorkspaceSplitElements\(workspaceRoot\)/);
  assert.match(workspace, /paintWorkspaceSplitGeometry\(paintedTree, splitElements\)/);
  assert.match(workspace, /setWorkspaceTree\(paintedTree\)/);
  assert.doesNotMatch(workspace, /setWorkspaceTree\(\(current\) => updateWorkspaceSplitRatio/);
});
