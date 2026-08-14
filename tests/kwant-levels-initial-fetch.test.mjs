import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspacePath = new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url);
const cachePath = new URL("../src/lib/workspaceDataCache.ts", import.meta.url);

test("KWANT levels recover automatically from an initial cold request", async () => {
  const [workspace, cache] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(cachePath, "utf8"),
  ]);

  assert.match(workspace, /timeoutMs: 45_000/);
  assert.match(cache, /timeoutMs\?: number/);
  assert.match(cache, /fetchWorkspaceResponse\(url, options\.timeoutMs\)/);

  const intentBlock = workspace.match(/const enabledKwantRootKey = useMemo\(\(\) => \{[\s\S]*?\}, \[paneLevelVisibility, visibleWorkspacePaneIds, workspacePanes\]\);/)?.[0] ?? "";
  assert.match(intentBlock, /paneLevelVisibility\[paneId\]/);
  assert.doesNotMatch(intentBlock, /gameplanChartOverlays/);

  assert.match(workspace, /missingRequestedOverlay \? 1_000 : 20_000/);
  assert.match(workspace, /KWANT levels are still synchronising\. Retrying automatically/);
  assert.match(workspace, /kwantLevelsEnabled=\{Boolean\(paneLevelState\.kwant && gameplanRoot\)\}/);
  assert.match(workspace, /enabled: Boolean\(activePaneLevelVisibility\.kwant && activeGameplanRoot\)/);
});
