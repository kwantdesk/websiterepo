import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const workspaceSource = await fs.readFile(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
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

test("mixed panel selection is saved in the existing pane and preset models", () => {
  assert.match(workspaceSource, /content: WorkspacePanelKind \| null;/);
  assert.match(workspaceSource, /content: pane\.content === null \|\| isWorkspacePanelKind\(pane\.content\) \? pane\.content : "charts"/);
  assert.match(workspaceSource, /panes: workspacePanes,/);
});

test("embedded pages use the real workspace components inside a scrollable panel", () => {
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
  assert.match(workspaceSource, /min-h-0 flex-1 overflow-auto/);
});
