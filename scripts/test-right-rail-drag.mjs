import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The right icon rail must be draggable off the screen and back.
 *
 * On a phone those 44 pixels are a real share of the width, and the rail's tab
 * could only ever REOPEN a panel — there was no way to get the rail itself out
 * of the way. The same handle now drags: push it right and the rail leaves,
 * pull it left and it comes back.
 */

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the width is a constant, shared by the maths and the transform", () => {
  // Two copies of 44 would drift, and the rail would come to rest just off its
  // own edge — a sliver of panel left behind, or a gap in the chart.
  assert.match(workspace, /const RAIL_WIDTH_PX = 44;/);
  assert.match(workspace, /const RAIL_HIDDEN_STORAGE_KEY = "kwantdesk:right-rail-hidden:v1";/);
});

check("the rail follows the finger, then settles", () => {
  const style = workspace.slice(workspace.indexOf("transform: `translateX(${railDragPx"), workspace.indexOf("transform: `translateX(${railDragPx") + 620);
  assert.match(style, /translateX\(\$\{railDragPx \?\? \(railHidden \? RAIL_WIDTH_PX : 0\)\}px\)/,
    "during a drag it tracks the pointer; otherwise it rests at one end");
  // Transitions must be OFF while dragging or the rail lags behind the finger.
  assert.match(style, /transition: railDragPx == null \? "transform 180ms ease, margin-right 180ms ease" : "none"/);
  // Sliding alone would leave a 44px gutter of empty panel; the negative margin
  // is what gives the space back to the chart.
  assert.match(style, /marginRight: `-\$\{railDragPx \?\? \(railHidden \? RAIL_WIDTH_PX : 0\)\}px`/);
});

check("the tab survives being hidden", () => {
  // If it only rendered while the rail was out, hiding the rail would take the
  // handle with it and there would be no way back.
  assert.match(workspace, /\{\(railHidden \|\| !rightPanel\) && \(/);
  assert.match(workspace, /onPointerDown=\{beginRailDrag\}/);
  assert.match(workspace, /aria-label=\{railHidden \? "Show the side rail" : "Hide the side rail"\}/);
  // The chevron has to point the way it will travel.
  assert.match(workspace, /railHidden \? "rotate-180" : ""/);
});

check("it is big enough to hit with a thumb, and does not scroll the page", () => {
  const tab = workspace.slice(workspace.indexOf("onPointerDown={beginRailDrag}"), workspace.indexOf("onPointerDown={beginRailDrag}") + 700);
  assert.match(tab, /h-20 w-3\.5/, "a 3px strip is not a touch target");
  // Without touch-none the browser claims the gesture as a scroll and the drag
  // never reaches the handler.
  assert.match(tab, /touch-none/);
  assert.match(tab, /select-none/);
});

check("a tap still toggles, a drag decides from where it ended", () => {
  const drag = workspace.slice(workspace.indexOf("const beginRailDrag ="), workspace.indexOf("const reopenRightPanel ="));
  assert.match(drag, /if \(Math\.abs\(delta\) < 4\)/, "a press that barely travels is a tap, not a drag");
  assert.match(drag, /const next = travelled > RAIL_DRAG_COMMIT_PX;/,
    "a half-hearted pull must settle back rather than strand the rail mid-screen");
  // Clamped to its own width: fully out, fully hidden, nothing in between.
  assert.match(drag, /Math\.min\(RAIL_WIDTH_PX, Math\.max\(0, travelled\)\)/);
});

check("the drag is driven from the window, and cleans up", () => {
  const drag = workspace.slice(workspace.indexOf("const beginRailDrag ="), workspace.indexOf("const reopenRightPanel ="));
  // Window listeners so the finger can leave the 14px tab without dropping the
  // gesture — which on a phone it certainly will.
  assert.match(drag, /window\.addEventListener\("pointermove", onMove\)/);
  assert.match(drag, /window\.addEventListener\("pointercancel", onEnd\)/);
  for (const event of ["pointermove", "pointerup", "pointercancel"]) {
    assert.ok(drag.includes(`window.removeEventListener("${event}", onEnd)`)
      || drag.includes(`window.removeEventListener("${event}", onMove)`),
      `${event} must be removed on release`);
  }
});

check("the choice is remembered", () => {
  assert.match(workspace, /window\.localStorage\.getItem\(RAIL_HIDDEN_STORAGE_KEY\) === "1"/);
  const drag = workspace.slice(workspace.indexOf("const beginRailDrag ="), workspace.indexOf("const reopenRightPanel ="));
  assert.match(drag, /window\.localStorage\.setItem\(RAIL_HIDDEN_STORAGE_KEY, next \? "1" : "0"\)/);
  // Storage is a convenience here; a browser that refuses it must not take the
  // rail down with it.
  assert.match(drag, /catch \{ \/\* preference only \*\/ \}/);
});

console.log(`\nright rail drag: ${passed}/${passed} checks passed`);
