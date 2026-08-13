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
    /type WorkspacePanelKind = "charts" \| "zyon" \| "gameplan" \| "gamma" \| "gexmap" \| "liqmap" \| "news" \| "socials" \| "journal";/,
  );
  assert.doesNotMatch(workspaceSource, /type WorkspacePanelKind[^;]*(?:backtesting|levelz)/);
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
  assert.match(workspaceSource, /content !== "charts"/);
  assert.match(workspaceSource, /onInitialSettled/);
  assert.match(workspaceSource, /nodePane\?\.content === "charts" && workspacePanelPickerPaneId === node\.paneId/);
  assert.match(workspaceSource, /if \(!loading\) onInitialSettled\?\.\(\)/);
});

test("mixed panel selection is saved in the existing pane and preset models", () => {
  assert.match(workspaceSource, /content: WorkspacePanelKind \| null;/);
  assert.match(workspaceSource, /content: pane\.content === null \|\| isWorkspacePanelKind\(pane\.content\) \? pane\.content : "charts"/);
  assert.match(workspaceSource, /panes: workspacePanes,/);
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
