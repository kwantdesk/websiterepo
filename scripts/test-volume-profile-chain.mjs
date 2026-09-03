import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { forwardVolumeProfileLevelSegment } from "../src/lib/nativeVolumeProfilePrimitive.ts";

/**
 * Regression coverage for profile-level occlusion in actual screen space.
 * POC, VAH and VAL may only travel forward from the source body's front and
 * must stop at the first visible profile body belonging to the instrument.
 */
const segment = (bodies, sourceFrontX = 200, rightEdge = 1_000) =>
  forwardVolumeProfileLevelSegment("source", "NQ", sourceFrontX, rightEdge, [
    { id: "source", root: "NQ", startMs: 100, leftX: 100, rightX: sourceFrontX },
    ...bodies,
  ]);

assert.deepEqual(
  segment([{ id: "ahead", root: "NQ", startMs: 200, leftX: 400, rightX: 520 }]),
  { startX: 200, endX: 400 },
  "a level must stop at the back edge of the profile in front",
);

assert.deepEqual(
  segment([
    { id: "far", root: "NQ", startMs: 300, leftX: 700, rightX: 800 },
    { id: "near", root: "NQ", startMs: 200, leftX: 350, rightX: 500 },
  ]),
  { startX: 200, endX: 350 },
  "the nearest of any combination of profiles must win",
);

assert.equal(
  segment([{ id: "covering", root: "NQ", startMs: 200, leftX: 150, rightX: 300 }]),
  null,
  "a covered source must not reverse a line out of its back",
);

assert.deepEqual(
  segment([{ id: "behind", root: "NQ", startMs: 200, leftX: 20, rightX: 180 }]),
  { startX: 200, endX: 1_000 },
  "a body wholly behind the source must not truncate it",
);

assert.deepEqual(
  segment([{ id: "other-instrument", root: "ES", startMs: 200, leftX: 300, rightX: 500 }]),
  { startX: 200, endX: 1_000 },
  "another instrument must not block the line",
);

assert.equal(segment([], 500, 500), null, "a segment can never run backwards");

assert.deepEqual(
  segment([{ id: "older-docked-right", root: "NQ", startMs: 50, leftX: 300, rightX: 480 }]),
  { startX: 200, endX: 1_000 },
  "the newest profile must reach the pane edge even when an older docked body sits to its right",
);

assert.deepEqual(
  segment([{ id: "same-session", root: "NQ", startMs: 100, leftX: 300, rightX: 480 }]),
  { startX: 200, endX: 1_000 },
  "another study at the same session anchor is not the next chronological profile",
);

const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
assert.match(primitive, /const drawnBodySpans = new Map<string, VolumeProfileBodySpan>\(\);/);
assert.match(primitive, /sourceBody\.rightX/);
assert.match(primitive, /body\.startMs <= source\.startMs/);
assert.match(primitive, /if \(!profileVerticallyVisible\) continue;/);
assert.match(primitive, /context\.moveTo\(lineSegment\.startX, y\)/);
assert.doesNotMatch(primitive, /till-interaction/,
  "VAH, VAL and POC must not be shortened by a later candle touch");
assert.doesNotMatch(primitive, /Math\.max\(endX, stopX\)/,
  "the old rule forced rear lines through an overlapping profile");
assert.ok(
  primitive.indexOf("for (const drawDeferredLevel of deferredLevelDraws)")
    > primitive.indexOf("deferredLevelDraws.push"),
  "occlusion must be resolved after every visible body has recorded its span",
);

console.log("volume profile level occlusion: chronological chaining verified");
