import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { orderPanesForLayout } from "../src/lib/workspaceLayoutPanes.ts";

/**
 * A layout button moves the walls of the desk. It does not decide what is
 * behind them.
 *
 * Both ways that went wrong destroyed work the trader had done: the focused
 * pane was hoisted to the front, so choosing a layout while working on the
 * right-hand chart moved that chart to the left and shuffled the others past
 * it, and any pane missing from the current tree had its content blanked, so
 * a chart set up earlier and then hidden behind a smaller layout came back
 * empty.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const pane = (id, content) => ({ id, content });

check("the on-screen order is kept exactly", () => {
  const panes = [pane("a", "charts"), pane("b", "charts"), pane("c", "charts")];
  const ordered = orderPanesForLayout(["a", "b", "c"], panes, new Set(), null);
  assert.deepEqual(ordered.map((p) => p.id), ["a", "b", "c"]);
});

check("focusing the right-hand chart does not drag it to the left", () => {
  // THE REPORTED BUG. Picking three-across while the right chart was active
  // put that chart in the left slot and pushed the others along, so it read
  // as the right chart being taken away.
  const panes = [pane("left", "charts"), pane("middle", "charts"), pane("right", "charts")];
  const ordered = orderPanesForLayout(["left", "middle", "right"], panes, new Set(), null);
  assert.deepEqual(
    ordered.map((p) => p.id), ["left", "middle", "right"],
    "the layout must not reorder the desk around whichever pane has focus",
  );
});

check("a pane that was off screen keeps what was in it", () => {
  // Hidden behind a smaller layout, then brought back by a wider one. It is
  // not new, so it is not empty.
  const panes = [pane("a", "charts"), pane("hidden", "gexmap")];
  const ordered = orderPanesForLayout(["a"], panes, new Set(), null);
  assert.deepEqual(ordered.map((p) => p.id), ["a", "hidden"], "it comes back behind what is on screen");
  assert.equal(ordered[1].content, "gexmap", "and keeps its content");
});

check("only a pane created for this layout starts empty", () => {
  const panes = [pane("a", "charts"), pane("brand-new", "charts")];
  const ordered = orderPanesForLayout(["a"], panes, new Set(["brand-new"]), null);
  assert.equal(ordered[0].content, "charts", "an existing pane is untouched");
  assert.equal(ordered[1].content, null, "a fresh slot is for the trader to fill");
});

check("no pane is dropped or duplicated", () => {
  const panes = [pane("a", "charts"), pane("b", "charts"), pane("c", "charts"), pane("d", "charts")];
  // A tree naming a pane twice, and one it does not know about at all.
  const ordered = orderPanesForLayout(["c", "a", "c"], panes, new Set(), null);
  assert.deepEqual(ordered.map((p) => p.id), ["c", "a", "b", "d"]);
  assert.equal(new Set(ordered.map((p) => p.id)).size, ordered.length, "no duplicates");
});

check("a tree naming a pane the desk no longer holds is ignored", () => {
  const panes = [pane("a", "charts")];
  const ordered = orderPanesForLayout(["ghost", "a"], panes, new Set(), null);
  assert.deepEqual(ordered.map((p) => p.id), ["a"]);
});

check("the workspace uses the helper rather than its own ordering", () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /orderPanesForLayout<WorkspacePane, WorkspacePanelKind \| null>\(/);
  assert.doesNotMatch(
    workspace,
    /let orderedPanes = \[\s*activeWorkspacePane,/,
    "the focused pane must not be hoisted to the front of the layout",
  );
});

console.log(`\nworkspace layout panes: ${passed}/${passed} checks passed`);
