import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/**
 * GEX FLOW is a tool now, not a page.
 *
 * It was a top-level nav button leading to a route that rendered one workspace.
 * That workspace is self-contained - it owns its screens, filters, columns and
 * refresh, and it fills whatever container it is given - so it can be hosted
 * wherever a panel lives. Hosting the REAL workspace rather than a reduced pane
 * version is what makes it identical in GEX BOX, identical in a GEX VUE pane,
 * and identical again when that pane is expanded to the whole page.
 */

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/components/gexbot/GexBoxDashboard.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/AppSidebar.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/app/(workspace)/layout.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the page is gone, and so is its button", () => {
  assert.ok(!existsSync(new URL("../src/app/(workspace)/gex-flow", import.meta.url)), "the route directory must be deleted");
  assert.doesNotMatch(sidebar, /gexflow/, "no nav entry, no sidebar key");
  assert.doesNotMatch(sidebar, /href: "\/gex-flow"/);
  assert.doesNotMatch(layout, /gex-flow/, "the path must no longer map to a section");
  assert.doesNotMatch(workspace, /"gexflow"/, "the section itself must be gone, not just unreachable");
});

check("GEX BOX offers it in the tool catalogue", () => {
  assert.match(dashboard, /\{ id: "gex-flow", label: "GEX Flow", category: "Options"/);
  assert.match(dashboard, /if \(panel\.toolId === "gex-flow"\) return <GexFlowWorkspace \/>;/,
    "the panel renders the whole workspace, not a reduced version");
});

check("a tool may own its own data", () => {
  // The shared feed fetches `endpoint`; GEX FLOW has none because it fetches
  // for itself. Without this the type would force a URL that nothing reads.
  assert.match(dashboard, /endpoint\?: \(\(settings: PanelSettings\) => string\) \| null/);
  assert.match(dashboard, /id: "gex-flow"[^}]*endpoint: null/);
});

check("GEX BOX does not carry it unless a panel asks", () => {
  assert.match(dashboard, /const GexFlowWorkspace = dynamic\(\(\) => import\("@\/components\/gex-flow\/GexFlowWorkspace"\), \{ ssr: false \}\)/);
});

check("it can be added as a workspace pane too", () => {
  // This is the GEX VUE half: the same workspace in a pane, so expanding that
  // pane to full width reproduces the old page exactly.
  assert.match(workspace, /\| "tool-gex-flow"/, "it needs to be a pane kind");
  assert.match(workspace, /\{ id: "tool-gex-flow", label: "GEX FLOW"/, "and appear in the tool picker");
  assert.match(workspace, /case "tool-gex-flow":/);
  const pane = workspace.slice(workspace.indexOf('case "tool-gex-flow":'), workspace.indexOf('case "tool-gex-flow":') + 400);
  assert.match(pane, /<GexFlowWorkspace \/>/, "the pane renders the whole workspace unchanged");
  assert.match(pane, /WorkspaceFailureBoundary/, "and stays isolated like every other pane");
  assert.match(workspace, /"tool-gex-flow": loadGexFlowWorkspace,/, "and preloads with the rest");
});

console.log(`\ngex flow as a tool: ${passed}/${passed} checks passed`);
