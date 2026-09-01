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

check("a tap with the rail showing and nothing open reopens the last panel", () => {
  assert.match(tapHandler, /reopenRightPanel\(\);/, "the tap no longer reopens the last panel");
  /*
   * And nothing in the tap path hides a rail that is already showing. Hiding
   * is a DRAG - a tap that hid the rail is what took it away when the
   * watchlist was opened.
   */
  assert.ok(
    !/setRailHidden\(true\)/.test(tapHandler),
    "a tap can still hide a rail that was showing",
  );
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

check("the tab is there in EVERY state", () => {
  /*
   * It used to be hidden whenever a panel was open - which is exactly when it
   * is most wanted, because that is the state you need to get out of. With the
   * watchlist open there was no control to put it away and no rail visible to
   * put it away from.
   */
  assert.ok(
    !/\{\(railHidden \|\| !rightPanel\) && \(/.test(workspace),
    "the rail tab is conditional on no panel being open again",
  );
});

check("a tap with a panel open closes the panel", () => {
  assert.match(
    tapHandler,
    /if \(rightPanel\) \{[\s\S]{0,80}?setRightPanel\(null\);/,
    "the tab no longer closes an open panel",
  );
});

check("the grab tab stays on screen when the rail slides away", () => {
  /*
   * The rail carries its offset as a transform and the tab is a child of it, so
   * the tab inherited the same transform and slid off with it. A hidden rail
   * took its own handle away and there was nothing left to bring it back with -
   * which is a rail that disappears for good.
   */
  assert.match(
    workspace,
    /const railOffsetPx = railDragPx \?\? \(railHidden \? RAIL_WIDTH_PX : 0\);/,
    "the rail offset is no longer shared with the tab",
  );
  assert.match(
    workspace,
    /transform: `translate\(\$\{-railOffsetPx\}px, -50%\)`/,
    "the tab no longer cancels the rail's transform",
  );
  // The vertical centring has to live in the same transform or it is lost.
  assert.ok(
    !/w-3\.5 -translate-y-1\/2 touch-none/.test(workspace),
    "the class-based vertical centring is back and will be overridden",
  );
});

check("a state updater is not used to fire another setState", () => {
  // React may run an updater twice; it has to be pure.
  const toggle = workspace.slice(workspace.indexOf("const toggleRightPanel ="));
  assert.ok(
    !/setRightPanel\(\(current\) => \{[\s\S]{0,400}?setRailHidden/.test(toggle.slice(0, 1200)),
    "setRailHidden is being called from inside the setRightPanel updater again",
  );
});

check("opening a panel brings its own rail back", () => {
  /*
   * A panel cannot be open with the rail it was opened from stranded off
   * screen - that is the state with no way out.
   */
  const toggle = workspace.slice(workspace.indexOf("const toggleRightPanel ="));
  assert.match(
    toggle.slice(0, 900),
    /const opening = rightPanel !== panel;[\s\S]{0,220}?setRailHidden\(false\);/,
    "opening a panel no longer restores the rail",
  );
});

check("the rail always starts visible", () => {
  /*
   * The failure mode that outlived three fixes: hidden persisted, so every
   * reload restored a rail that was off screen, and every route back to it was
   * part of the thing that had disappeared. A control whose hidden state cannot
   * be recovered is worse than one that forgets.
   */
  assert.match(
    workspace,
    /useEffect\(\(\) => \{[\s\S]{0,40}?setRailHidden\(false\);/,
    "the rail no longer forces itself visible on mount",
  );
  assert.match(
    workspace,
    /window\.localStorage\.removeItem\(RAIL_HIDDEN_STORAGE_KEY\)/,
    "a browser still carrying the old hidden preference is not cleared",
  );
  assert.ok(
    !/getItem\(RAIL_HIDDEN_STORAGE_KEY\) === "1"/.test(workspace),
    "the hidden state is being restored from storage again",
  );
});

check("hiding is still possible within a session", () => {
  // The gesture stays; only its persistence is gone.
  assert.match(workspace, /setRailHidden\(next\);/, "drag-to-hide was removed rather than made non-persistent");
});

check("the tab says what it will do", () => {
  // "Close optionstape" is not what anybody calls that panel.
  assert.match(workspace, /function railPanelLabel\(panel: string\): string/);
  assert.match(workspace, /\? `Close \$\{railPanelLabel\(rightPanel\)\}`/, "the tab still claims to hide the rail while a panel is open");
});

console.log(`\nside rail tap: ${passed}/${passed} checks passed`);
