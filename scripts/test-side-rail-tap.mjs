import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * Opening a panel from the side rail does not take the rail away with it.
 *
 * The tab beside the rail is both a button and a drag handle. Its tap handler
 * toggled `railHidden` unconditionally and THEN decided whether to reopen a
 * panel - reading the pre-toggle value to make that decision. So one tap did
 * both things at once: the watchlist opened and the rail it was opened from
 * slid off screen.
 *
 * The tab's own wording is the specification, and the code now matches it.
 * Hidden: "tap to bring the rail back". Showing: "drag right to hide the rail,
 * or reopen X" - a tap asks for the panel, and only a DRAG hides.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const tapHandler = (() => {
  const start = workspace.indexOf("      if (Math.abs(delta) < 4) {");
  assert.ok(start > 0, "the rail tap handler is gone");
  return workspace.slice(start, workspace.indexOf("\n      }", start));
})();

check("a tap never toggles the rail blindly", () => {
  /*
   * The single line that caused it. A toggle cannot know which of the two
   * meanings the tap had.
   */
  assert.ok(
    !/setRailHidden\(\(current\) => \{/.test(tapHandler),
    "the tap toggles railHidden again instead of deciding first",
  );
});

check("a tap on a hidden rail brings it back and stops there", () => {
  assert.match(
    tapHandler,
    /if \(railHidden\) \{\s*\n\s*setRailHidden\(false\);/,
    "a hidden rail is no longer restored by a tap",
  );
  // It must not fall through into reopening a panel as well.
  const hiddenBranch = tapHandler.slice(tapHandler.indexOf("if (railHidden) {"));
  assert.match(hiddenBranch.slice(0, 260), /return;/, "the hidden branch does not stop");
});

check("a tap with the rail showing asks for the panel, not for the rail to go", () => {
  assert.match(tapHandler, /if \(rightPanel\) return;\s*\n\s*reopenRightPanel\(\);/);
  // And nothing in the tap path hides a rail that is already showing.
  const afterHiddenBranch = tapHandler.slice(tapHandler.indexOf("if (rightPanel) return;"));
  assert.ok(
    !/setRailHidden\(true\)/.test(afterHiddenBranch),
    "a tap can still hide a rail that was showing",
  );
});

check("the preference is still written when it changes", () => {
  // The rail has to come back hidden or showing the way it was left.
  assert.match(tapHandler, /window\.localStorage\.setItem\(RAIL_HIDDEN_STORAGE_KEY, "0"\)/);
});

check("dragging still hides it", () => {
  /*
   * The tap is not the only gesture. A drag past the commit distance is what
   * hides the rail, and that path must survive the split.
   */
  assert.match(
    workspace,
    /const travelled = origin\.startHidden \? RAIL_WIDTH_PX \+ delta : delta;\s*\n\s*const next = travelled > RAIL_DRAG_COMMIT_PX;\s*\n\s*setRailHidden\(next\);/,
    "the drag-to-hide path is gone",
  );
});

check("the tab is reachable in both states", () => {
  /*
   * It renders when the rail is hidden, or when nothing is open. If it only
   * rendered in one of those, a rail could be hidden with no way back.
   */
  assert.match(workspace, /\{\(railHidden \|\| !rightPanel\) && \(/, "the rail tab's visibility rule changed");
});

console.log(`\nside rail tap: ${passed}/${passed} checks passed`);
