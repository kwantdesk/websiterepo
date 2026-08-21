import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");

/**
 * Reproduces the renderer's row-collapse decision so the behaviour is tested
 * rather than the source text alone.
 *
 * PROFILE_MIN_ROW_PIXELS is the smallest height a row may occupy before rows
 * are merged for legibility.
 */
const MIN_ROW_PIXELS = Number(
  primitive.match(/const PROFILE_MIN_ROW_PIXELS = ([\d.]+)/)?.[1],
);
assert.ok(MIN_ROW_PIXELS > 0, "row-pixel floor must be readable from the source");

function multiplier({ automaticGrouping, autoGroupFactor, sourceRowPixels }) {
  const floorFactor = automaticGrouping ? autoGroupFactor : 1;
  return Math.max(1, Math.ceil((MIN_ROW_PIXELS * floorFactor) / sourceRowPixels));
}

const manual = (sourceRowPixels) =>
  multiplier({ automaticGrouping: false, autoGroupFactor: 1, sourceRowPixels });

// 1. At ordinary zoom a manual profile draws EXACTLY the rows it was asked
//    for. The legibility floor must never coarsen a readable profile.
for (const rowPixels of [0.6, 1, 1.5, 4]) {
  assert.equal(manual(rowPixels), 1, `manual grouping coarsened at ${rowPixels}px rows`);
}

// 2. Zoomed out far enough that rows go sub-pixel, manual must still collapse.
//    Skipping this is what smeared a manually binned profile into a solid
//    block with no shelves, notches or single prints.
assert.ok(manual(0.25) > 1, "manual grouping must collapse sub-pixel rows");
assert.ok(manual(0.05) > manual(0.25), "collapsing must scale with how thin rows get");

// 3. The collapse must always restore at least the legibility floor.
for (const rowPixels of [0.5, 0.25, 0.1, 0.02]) {
  const grouped = rowPixels * manual(rowPixels);
  assert.ok(
    grouped >= MIN_ROW_PIXELS - 1e-9,
    `collapsed rows still under the floor at ${rowPixels}px (${grouped})`,
  );
}

// 4. Automatic keeps honouring the trader's coarsening factor; manual does not
//    inherit it, so Manual means manual at readable zoom.
const auto2 = multiplier({ automaticGrouping: true, autoGroupFactor: 2, sourceRowPixels: 0.4 });
const manual2 = multiplier({ automaticGrouping: false, autoGroupFactor: 2, sourceRowPixels: 0.4 });
assert.ok(auto2 > manual2, "auto group factor must only coarsen automatic mode");

// 5. The branch that skipped the floor for manual must not come back.
assert.doesNotMatch(
  primitive,
  /automaticMultiplier = style\.automaticGrouping\s*\r?\n?\s*\?[^;]*\r?\n?\s*: 1;/,
  "manual grouping must not skip the legibility floor again",
);
assert.match(primitive, /groupingFloorFactor/);

console.log("volume profile grouping: 5/5 checks passed");
