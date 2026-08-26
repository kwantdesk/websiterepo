import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Reproduces the renderer's left-dock ownership rule: the dock belongs to the
 * most recent profile that has actually scrolled past the left edge.
 */
function leftDockOwner(models, leftEdge) {
  const byKind = new Map();
  for (const model of models) {
    if (model.snapMode !== "left") continue;
    if (model.anchorX == null || model.anchorX >= leftEdge + 2) continue;
    const current = byKind.get(model.kind);
    if (!current || model.endMs > current.endMs) byKind.set(model.kind, model);
  }
  return byKind;
}

const DAY = 86_400_000;
const T0 = Date.parse("2026-08-17T22:00:00.000Z");
const daily = (i, anchorX) => ({
  id: `d${i}`, kind: "daily:NQ", snapMode: "left",
  endMs: T0 + (i + 1) * DAY, anchorX,
});

// 1. With one profile scrolled past, it takes the dock.
{
  const owner = leftDockOwner([daily(0, -300), daily(1, 400)], 0);
  assert.equal(owner.get("daily:NQ").id, "d0");
}

// 2. Once a NEWER profile also scrolls past, it takes the dock from the older
//    one — the reported behaviour: the old one should go, the recent one sits.
{
  const owner = leftDockOwner([daily(0, -900), daily(1, -300), daily(2, 400)], 0);
  assert.equal(owner.get("daily:NQ").id, "d1", "the newest scrolled-past profile owns the dock");
}

// 3. Exactly one profile per kind may ever hold the dock.
{
  const owner = leftDockOwner([daily(0, -900), daily(1, -600), daily(2, -300)], 0);
  assert.equal(owner.size, 1);
  assert.equal(owner.get("daily:NQ").id, "d2");
}

// 4. Scrolled back through history, the dock belongs to the most recent
//    profile BEHIND the view — not to the newest profile in the pane, which is
//    off to the right and has not scrolled past anything.
{
  const owner = leftDockOwner([daily(0, -400), daily(1, 600), daily(2, 1200)], 0);
  assert.equal(owner.get("daily:NQ").id, "d0", "a profile ahead of the view must not hold the dock");
}

// 5. Nothing scrolled past means nothing docks.
{
  assert.equal(leftDockOwner([daily(0, 100), daily(1, 400)], 0).size, 0);
}

// 6. Kinds dock independently, and a profile not set to left snap never docks.
{
  const models = [
    daily(0, -300),
    { id: "w0", kind: "weekly:NQ", snapMode: "left", endMs: T0 + 5 * DAY, anchorX: -500 },
    { id: "x0", kind: "daily:ES", snapMode: "off", endMs: T0 + DAY, anchorX: -500 },
  ];
  const owner = leftDockOwner(models, 0);
  assert.equal(owner.size, 2);
  assert.equal(owner.get("daily:NQ").id, "d0");
  assert.equal(owner.get("weekly:NQ").id, "w0");
  assert.equal(owner.get("daily:ES"), undefined);
}

// 7. The renderer must use scrolled-past ownership, not "newest in the pane".
const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
assert.match(primitive, /const leftDockByKind = new Map/);
assert.match(primitive, /const ownsLeftDock = \(model: NativeVolumeProfileModel\)/);
assert.match(primitive, /&& ownsLeftDock\(model\)/);
assert.doesNotMatch(
  primitive,
  /sessionAnchorX < leftEdge \+ 2\s*\r?\n\s*&& profile\.endMs === latestDailyEndMs;/,
  "left docking must not fall back to the newest profile in the pane",
);

// A left-facing profile must open back across ITS OWN session.
//
// An undocked profile anchored at its session START and drawn leftward opens
// across the session BEFORE it - the histogram sitting over bars it was not
// built from, which reads as the profile being backwards. Only some profiles
// looked wrong because the DOCKED one re-anchors to the screen edge, and the
// TPO renderer already handled this ("an older right-facing profile hangs off
// the end of its own period and opens back across it").
assert.match(
  primitive,
  /: facesLeft \? sessionEndX : sessionAnchorX;/,
  "facing left must anchor at the session END so the profile covers what it measured",
);
// Docking is unchanged: a pinned profile still goes to the screen edge.
assert.match(primitive, /\? pinnedRight \? rightEdge - 2 : leftEdge \+ 2/);
// And direction still follows the setting, which is what it is for.
assert.match(primitive, /const facesLeft = style\.snapMode === "right";/);

console.log("volume profile left dock: 8/8 checks passed");
