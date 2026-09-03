import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  firstVolumeProfileLevelInteraction,
  forwardVolumeProfileLevelSegment,
  volumeProfileLevelFrontX,
} from "../src/lib/nativeVolumeProfilePrimitive.ts";

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
  firstVolumeProfileLevelInteraction(100, [
    { timestamp: 1, low: 101, high: 103 },
    { timestamp: 2, low: 100, high: 102 },
    { timestamp: 3, low: 99, high: 101 },
  ]),
  { timestamp: 2, low: 100, high: 102 },
  "Till interaction must stop on the first wick touch, including an exact boundary touch",
);
assert.equal(
  firstVolumeProfileLevelInteraction(100, [{ timestamp: 1, low: 100.25, high: 101 }]),
  null,
  "Till interaction must not stop before price actually trades through the level",
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

assert.equal(
  volumeProfileLevelFrontX({
    anchorX: 200,
    facesLeft: false,
    pinned: false,
    splitPinnedDaily: false,
    visualStyle: "solid",
    mode: "volume",
    deltaOnRight: false,
    volumeWidth: 42,
    deltaWidth: 0,
    askWidth: 0,
    bidWidth: 0,
  }),
  242,
  "a level must begin at its own histogram row edge, not the profile's maximum width",
);

assert.equal(
  volumeProfileLevelFrontX({
    anchorX: 900,
    facesLeft: true,
    pinned: true,
    splitPinnedDaily: false,
    visualStyle: "solid",
    mode: "volume",
    deltaOnRight: false,
    volumeWidth: 42,
    deltaWidth: 0,
    askWidth: 0,
    bidWidth: 0,
  }),
  900,
  "a left-facing row must emit its forward level from the profile spine",
);

const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
assert.match(primitive, /const drawnBodySpans = new Map<string, VolumeProfileBodySpan>\(\);/);
assert.match(primitive, /const sourceFrontX = levelFrontRows\.reduce/);
assert.match(primitive, /frontX: volumeProfileLevelFrontX/);
assert.match(primitive, /body\.startMs <= source\.startMs/);
assert.match(primitive, /if \(!profileVerticallyVisible\) continue;/);
assert.match(primitive, /context\.moveTo\(lineSegment\.startX, y\)/);
assert.match(primitive, /firstVolumeProfileLevelInteraction/,
  "Till interaction must be driven by real later candle ranges");
assert.doesNotMatch(primitive, /Math\.max\(endX, stopX\)/,
  "the old rule forced rear lines through an overlapping profile");
assert.ok(
  primitive.indexOf("for (const drawDeferredLevel of deferredLevelDraws)")
    > primitive.indexOf("deferredLevelDraws.push"),
  "occlusion must be resolved after every visible body has recorded its span",
);

console.log("volume profile level occlusion: chronological chaining verified");
