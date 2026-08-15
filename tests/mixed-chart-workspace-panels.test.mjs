import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const workspaceSource = await fs.readFile(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);
const gexMapSource = await fs.readFile(
  new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url),
  "utf8",
);

test("chart layouts expose only the governed mixed-workspace choices", () => {
  assert.match(
    workspaceSource,
    /type WorkspacePagePanelKind = "charts" \| "zyon" \| "gameplan" \| "gamma" \| "gexmap" \| "liqmap" \| "news" \| "socials" \| "journal";/,
  );
  assert.match(workspaceSource, /type WorkspacePanelKind = WorkspacePagePanelKind \| WorkspaceToolKind/);
  assert.doesNotMatch(workspaceSource, /type WorkspacePagePanelKind[^;]*(?:backtesting|levelz)/);
});

test("workspace picker separates pages from dedicated order-flow tools", () => {
  assert.match(workspaceSource, />Workspaces</);
  assert.match(workspaceSource, />Tools &amp; Indicators</);
  for (const label of [
    "FOOTPRINT",
    "VOLUME PROFILE",
    "DEPTH OF MARKET",
    "BIG CONTRACTS",
    "IMBALANCE DETECTOR",
    "ABSORPTION INDICATOR",
    "QUEUE POSITION TRACKING",
    "SIZE MODIFICATION TRACKING",
    "ORDER SIZE DISTRIBUTION",
    "ICEBERG DETECTION",
    "SPOOFING DETECTOR",
    "FRONT RUNNING",
    "PASSIVE MARKET MAKING",
    "HIGH FREQUENCY CANCELLATION",
    "ORDER ID",
    "AGE",
    "SKEW",
    "SAMAGING DETECTOR",
    "ORDER LIFETIME DECAY DIVERGENCE",
    "MULTI-BOOK SWEEP SYNCHRONIZATION",
    "GHOST LIQUIDITY",
  ]) {
    assert.match(workspaceSource, new RegExp(`label: "${label}"`));
  }
});

test("mature tool panels attach their real chart engine and remain normal saved chart panes", () => {
  for (const indicatorId of [
    "deep-print-footprint",
    "kwant-profile",
    "depth-of-market",
    "big-trades",
    "imbalance-tracker",
  ]) {
    assert.match(workspaceSource, new RegExp(`indicatorId: "${indicatorId}"`));
  }
  assert.match(workspaceSource, /defaultIndicatorSettings\(indicatorId, chartSettings\)/);
  assert.match(workspaceSource, /isWorkspaceChartKind\(activeWorkspacePane\.content\)/);
  assert.match(workspaceSource, /!isWorkspaceChartKind\(pane\.content\)/);
});

test("changing a workspace tool replaces its previous tool indicator", () => {
  assert.match(
    workspaceSource,
    /const previousToolIndicatorId = WORKSPACE_TOOL_OPTIONS\.find\([\s\S]*?option\.id === previousContent,[\s\S]*?\)\?\.indicatorId;/,
  );
  assert.match(
    workspaceSource,
    /previousToolIndicatorId !== indicatorId[\s\S]*?existing\.filter\(\(instance\) => instance\.indicatorId !== previousToolIndicatorId\)/,
  );
  assert.match(
    workspaceSource,
    /const installed = withoutPreviousTool\.find\(\(instance\) => instance\.indicatorId === indicatorId\)/,
  );
});

test("mixed-workspace picker and selected headers use uppercase product labels", () => {
  for (const [id, label] of [
    ["charts", "CHARTS"],
    ["zyon", "ZYON"],
    ["gameplan", "GAMEPLAN"],
    ["gamma", "GAMMA"],
    ["gexmap", "GEX MAP"],
    ["liqmap", "LIQ MAP"],
    ["news", "NEWS"],
    ["socials", "SOCIALS"],
    ["journal", "JOURNAL"],
  ]) {
    assert.match(workspaceSource, new RegExp(`id: "${id}", label: "${label}"`));
  }
});

test("new workspace slots start empty and present the centered panel picker", () => {
  assert.match(workspaceSource, /id: nextPaneId,[\s\S]*?content: null,/);
  assert.match(workspaceSource, /Add to workspace/);
  assert.match(workspaceSource, /Choose a live KwantDesk workspace for this panel/);
});

test("an empty added panel can be cancelled back to the previous workspace", () => {
  assert.match(workspaceSource, /aria-label=\{pane\.content === null \? "Cancel adding workspace panel"/);
  assert.match(workspaceSource, /cancelWorkspacePanelPicker[\s\S]*?pane\.content === null\) closeWorkspacePane\(pane\.id\)/);
  assert.match(workspaceSource, /title=\{pane\.content === null \? "Cancel and restore previous workspace"/);
});

test("a newly selected chart stays behind the picker until its first usable state settles", () => {
  assert.match(workspaceSource, /await preloadWorkspaceModule\(content\)/);
  assert.match(workspaceSource, /!isWorkspaceChartKind\(content\)/);
  assert.match(workspaceSource, /onInitialSettled/);
  assert.match(workspaceSource, /isWorkspaceChartKind\(nodePane\.content\) && workspacePanelPickerPaneId === node\.paneId/);
  assert.match(workspaceSource, /if \(!chartIsLoading\) onInitialSettled\?\.\(\)/);
});

test("mixed panel selection is saved in the existing pane and preset models", () => {
  assert.match(workspaceSource, /content: WorkspacePanelKind \| null;/);
  assert.match(workspaceSource, /content: pane\.content === null \|\| isWorkspacePanelKind\(pane\.content\) \? pane\.content : "charts"/);
  assert.match(workspaceSource, /panes: workspacePanes,/);
});

test("workspace windows duplicate their exact state into an independent adjacent pane", () => {
  assert.match(workspaceSource, /const duplicateWorkspacePane = \(paneId: string\) =>/);
  assert.match(workspaceSource, /const nextPane: WorkspacePane = \{[\s\S]*?\.\.\.sourcePane,[\s\S]*?id: nextPaneId,[\s\S]*?locked: false,/);
  assert.match(workspaceSource, /\[nextPaneId\]: \(current\[paneId\] \?\? \[\]\)\.map\(\(instance\) => \(\{[\s\S]*?instanceId: `\$\{instance\.indicatorId\}-\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(workspaceSource, /\[nextPaneId\]: \{ \.\.\.\(current\[paneId\] \?\? EMPTY_PANE_LEVEL_VISIBILITY\) \}/);
  assert.match(workspaceSource, /insertWorkspacePane\(current, paneId, nextPaneId, splitAxis/);
  assert.match(workspaceSource, /aria-label="Duplicate chart"/);
  assert.match(workspaceSource, /aria-label=\{`Duplicate \$\{option\?\.label \?\? "workspace"\} panel`\}/);
});

test("embedded pages use the real workspace components inside an isolated panel", () => {
  for (const component of [
    "ZyonWorkspace",
    "GameplanWorkspace",
    "GammaWorkspace",
    "GexMapWorkspace",
    "LiquidityMapWorkspace",
    "NewsWorkspace",
    "SocialsWorkspace",
    "JournalWorkspace",
  ]) {
    assert.match(workspaceSource, new RegExp(`<${component}\\b`));
  }
  assert.match(workspaceSource, /relative h-full min-h-0 min-w-0 overflow-hidden.*renderEmbeddedWorkspace\(pane\)/);
});

test("embedded GEX map follows the pane market and keeps last-good panel frames", () => {
  assert.match(workspaceSource, /<GexMapWorkspace[^>]*market=\{gexMarket\}/);
  assert.match(gexMapSource, /market\?: GexMapMarket \| null/);
  assert.match(gexMapSource, /if \(cached\) next\[panel\.id\] = cached/);
  assert.doesNotMatch(gexMapSource, /setPanelData\(\(current\) => \(\{ \.\.\.current, \.\.\.cachedPanels \}\)\)/);
});

test("GEX map polling reuses its shared cache and respects provider refresh timing", () => {
  assert.match(gexMapSource, /force: forceRefresh/);
  assert.match(gexMapSource, /maxAgeMs: replayMode \? 6 \* 60 \* 60_000 : 5_000/);
  assert.match(gexMapSource, /nextRefreshDelay = Math\.min\(nextRefreshDelay, refreshAfterMs\)/);
  assert.doesNotMatch(gexMapSource, /\{ force: true \}/);
});
