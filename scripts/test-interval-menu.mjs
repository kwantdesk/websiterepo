import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * The chart interval menu.
 *
 * It stopped doing anything visible without anyone touching it: the command
 * deck gained `overflow-x-auto` for sideways scrolling and the header above it
 * `overflow-hidden`, and an absolutely positioned panel is still clipped by an
 * ancestor that scrolls. The panel opens 38px below a deck about 44px tall, so
 * the whole surface was cut away - the button toggled, the state changed, and
 * nothing appeared.
 *
 * These are source checks because the failure was never in the panel's own
 * markup. Every button inside it was wired correctly the entire time.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the deck still has the clips that made this necessary", () => {
  /*
   * If these ever go away the portal is merely unnecessary rather than wrong,
   * but while they are here nothing absolute can escape them - so this states
   * plainly what the portal is for.
   */
  assert.match(workspace, /kwant-chart-command-deck[^"]*overflow-hidden/, "the command deck header no longer clips");
  assert.match(workspace, /col-start-1 row-start-1 [^"]*overflow-x-auto/, "the deck row no longer scrolls sideways");
});

check("the interval panel is portaled out of the deck", () => {
  assert.match(
    workspace,
    /\{showAllTF && timeframeMenuAnchor && typeof document !== "undefined" \? createPortal\(/,
    "the interval panel is not portaled",
  );
  // An absolute panel inside the deck is exactly the bug. It must be fixed and
  // placed from a measured rect instead.
  assert.doesNotMatch(
    workspace,
    /className="absolute left-0 top-\[38px\] z-50 w-\[720px\]/,
    "the interval panel is still an absolutely positioned child of the deck",
  );
  assert.match(workspace, /style=\{\{ left: timeframeMenuAnchor\.left, top: timeframeMenuAnchor\.top \}\}/);
});

check("a press inside the panel does not dismiss it", () => {
  /*
   * The panel is no longer in the deck's subtree, so the outside-pointerdown
   * guard stops recognising it. Without its own check, pressing an interval
   * closes the menu before the click lands and the menu looks just as dead as
   * it did when it was clipped.
   */
  assert.match(workspace, /if \(timeframePanelRef\.current\?\.contains\(target\)\) return;/);
});

check("the panel follows its button", () => {
  // A fixed box does not follow a deck that scrolls sideways, or a resize.
  assert.match(workspace, /window\.addEventListener\("scroll", place, true\)/, "deck scrolling is not tracked");
  assert.match(workspace, /window\.addEventListener\("resize", place\)/, "resizing is not tracked");
  assert.match(workspace, /window\.removeEventListener\("scroll", place, true\)/, "the scroll listener leaks");
  assert.match(workspace, /window\.removeEventListener\("resize", place\)/, "the resize listener leaks");
  // And it must not run off the right edge of a narrow window.
  assert.match(workspace, /Math\.max\(12, Math\.min\(rect\.left, window\.innerWidth - width - 12\)\)/);
});

check("choosing an interval still applies it to the chart", () => {
  // The part that was never broken, asserted so the portal cannot break it.
  assert.match(workspace, /selectTimeframe\(option\.id\);\s*\n\s*setShowAllTF\(false\);/);
  assert.match(workspace, /updateWorkspacePane\(activePaneId, \{ timeframe \}\);/);
});

console.log(`\ninterval menu: ${passed}/${passed} checks passed`);
