import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveVolumeProfileLeftDockOwners } from "../src/lib/nativeVolumeProfilePrimitive.ts";

/**
 * Reproduces the renderer's left-dock ownership rule: the dock belongs to the
 * most recent profile that has actually scrolled past the left edge.
 */
const leftDockOwner = (models, leftEdge) => resolveVolumeProfileLeftDockOwners(
  models.map((model) => ({ ...model, root: model.root ?? model.kind.split(":").at(-1) })),
  leftEdge,
);

const DAY = 86_400_000;
const T0 = Date.parse("2026-08-17T22:00:00.000Z");
const daily = (i, anchorX) => ({
  id: `d${i}`, kind: "daily:NQ", root: "NQ", snapMode: "left",
  anchorMs: T0 + i * DAY,
  endMs: T0 + (i + 1) * DAY, anchorX,
});

// 1. With one profile scrolled past, it takes the dock.
{
  const owner = leftDockOwner([daily(0, -300), daily(1, 400)], 0);
  assert.equal(owner.get("NQ"), "d0");
}

// 2. Once a NEWER profile also scrolls past, it takes the dock from the older
//    one — the reported behaviour: the old one should go, the recent one sits.
{
  const owner = leftDockOwner([daily(0, -900), daily(1, -300), daily(2, 400)], 0);
  assert.equal(owner.get("NQ"), "d1", "the newest scrolled-past profile owns the dock");
}

// 3. Exactly one profile per kind may ever hold the dock.
{
  const owner = leftDockOwner([daily(0, -900), daily(1, -600), daily(2, -300)], 0);
  assert.equal(owner.size, 1);
  assert.equal(owner.get("NQ"), "d2");
}

// 4. Scrolled back through history, the dock belongs to the most recent
//    profile BEHIND the view — not to the newest profile in the pane, which is
//    off to the right and has not scrolled past anything.
{
  const owner = leftDockOwner([daily(0, -400), daily(1, 600), daily(2, 1200)], 0);
  assert.equal(owner.get("NQ"), "d0", "a profile ahead of the view must not hold the dock");
}

// 5. Nothing scrolled past means nothing docks.
{
  assert.equal(leftDockOwner([daily(0, 100), daily(1, 400)], 0).size, 0);
}

// 6. Instruments dock independently, and a profile not set to left snap never docks.
{
  const models = [
    daily(0, -300),
    { id: "w0", kind: "weekly:ES", root: "ES", snapMode: "left", anchorMs: T0, endMs: T0 + 5 * DAY, anchorX: -500 },
    { id: "x0", kind: "daily:YM", root: "YM", snapMode: "off", anchorMs: T0, endMs: T0 + DAY, anchorX: -500 },
  ];
  const owner = leftDockOwner(models, 0);
  assert.equal(owner.size, 2);
  assert.equal(owner.get("NQ"), "d0");
  assert.equal(owner.get("ES"), "w0");
  assert.equal(owner.get("YM"), undefined);
}

// 7. The exact reported transition: a later session crossing the left edge
//    immediately takes the one physical dock, even if an older cached profile
//    carries a much later/inflated end time.
{
  const older = { ...daily(0, -800), endMs: T0 + 30 * DAY };
  const newer = daily(1, -20);
  assert.equal(leftDockOwner([older, newer], 0).get("NQ"), "d1");
  assert.equal(leftDockOwner([newer, older], 0).get("NQ"), "d1",
    "ownership must not depend on model order");
}

// 8. Daily and weekly profiles cannot both occupy the same left pixels. The
//    latest one to cross wins regardless of period.
{
  const weekly = { id: "w0", kind: "weekly:NQ", root: "NQ", snapMode: "left", anchorMs: T0, endMs: T0 + 7 * DAY, anchorX: -900 };
  const nextDaily = daily(1, -10);
  assert.equal(leftDockOwner([weekly, nextDaily], 0).get("NQ"), "d1");
}

// 9. The renderer must use the shared deterministic ownership resolver.
const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
assert.match(primitive, /resolveVolumeProfileLeftDockOwners\(/);
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
  /: facesLeft \? sessionEndX : sessionAnchorX\) \+ profileOffsetPx;/,
  "facing left must anchor at the session END so the profile covers what it measured",
);
// Docking is unchanged: a pinned profile still goes to the screen edge.
assert.match(primitive, /\? pinnedRight \? rightEdge - 2 : leftEdge \+ 2/);
// And direction still follows the setting, which is what it is for.
assert.match(primitive, /const facesLeft = style\.snapMode === "right";/);

console.log("volume profile left dock: 10/10 checks passed");
