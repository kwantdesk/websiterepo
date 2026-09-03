import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placeVolumeProfileLabelBoxes } from "../src/lib/nativeVolumeProfilePrimitive.ts";

const bounds = { left: 40, top: 2, right: 640, bottom: 300 };

// A profile extending above or below the viewport still owns a visible label.
{
  const [above, below] = placeVolumeProfileLabelBoxes([
    { id: "above", preferredLeft: 80, preferredTop: -120, width: 90, height: 11 },
    { id: "below", preferredLeft: 320, preferredTop: 900, width: 90, height: 11 },
  ], bounds);
  assert.equal(above.top, bounds.top);
  assert.equal(below.top, bounds.bottom - below.height);
}

// Split sessions and summaries can share an anchor/high. They must be placed
// in separate stable lanes instead of later text replacing earlier text.
{
  const placed = placeVolumeProfileLabelBoxes([
    { id: "asia", preferredLeft: 120, preferredTop: 4, width: 110, height: 11 },
    { id: "london", preferredLeft: 120, preferredTop: 4, width: 110, height: 11 },
    { id: "new-york", preferredLeft: 120, preferredTop: 4, width: 110, height: 11 },
  ], bounds);
  assert.deepEqual(placed.map((label) => label.id), ["asia", "london", "new-york"]);
  for (let left = 0; left < placed.length; left += 1) {
    assert.ok(placed[left].top >= bounds.top);
    assert.ok(placed[left].top + placed[left].height <= bounds.bottom);
    for (let right = left + 1; right < placed.length; right += 1) {
      assert.ok(
        placed[left].top + placed[left].height + 2 <= placed[right].top
          || placed[right].top + placed[right].height + 2 <= placed[left].top,
        `${placed[left].id} overlaps ${placed[right].id}`,
      );
    }
  }
}

const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
assert.match(primitive, /profileBottom > 0\s*&& profileTop < mediaSize\.height/,
  "partly visible profiles are still being rejected");
assert.doesNotMatch(primitive, /Math\.min\(top, bottom\) > 0\s*&& Math\.max\(top, bottom\) < mediaSize\.height/,
  "labels still require the whole profile to fit vertically");
assert.match(primitive, /Text is the final paint layer/);
assert.ok(
  primitive.lastIndexOf("placeVolumeProfileLabelBoxes(")
    > primitive.lastIndexOf("for (const drawDeferredLevel of deferredLevelDraws)"),
  "profile text is not the final layer",
);
assert.match(primitive, /const lineEndX = lineSegment\?\.endX \?\? sourceBody\.rightX/,
  "an occluded level still drops its enabled label with its line");
assert.match(primitive, /sessionLabelVisible = style\.showLevelLabels !== false/,
  "the visible Labels setting does not govern the profile heading");
assert.match(primitive, /id: `\$\{model\.id\}:\$\{label\}:\$\{price\}`/,
  "level names bypass the shared collision-aware text pass");

console.log("volume profile labels: 4/4 checks passed");
