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

// 6. The value area must be measured at the PROFILE's grouping, never at the
//    display-collapsed grouping. Row size genuinely changes the answer, so
//    deriving it from the zoom-collapsed rows made VAH/VAL/POC move by points
//    as the chart was zoomed and disagree with the server's own profile.
const { execSync } = await import("node:child_process");
const { mkdtempSync, rmSync } = await import("node:fs");
const { join } = await import("node:path");
const outDir = mkdtempSync(join(process.cwd(), ".vp-va-test-"));
const bundle = join(outDir, "math.mjs");
execSync(
  `npx esbuild src/lib/volumeProfileMath.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);
const { calculateVolumeProfileValueArea } = await import(`file://${bundle.replaceAll("\\", "/")}`);

const TICK = 0.25;
const levels = Array.from({ length: 120 }, (_, i) => ({
  price: Number((20_000 + i * TICK).toFixed(2)),
  volume: 100 + Math.round(900 * Math.exp(-((i - 61) ** 2) / 240)),
}));
const atProfileGrouping = calculateVolumeProfileValueArea(levels, TICK * 4, 68);
const atCollapsedGrouping = calculateVolumeProfileValueArea(levels, TICK * 8, 68);
assert.ok(atProfileGrouping.vah != null && atCollapsedGrouping.vah != null);
assert.notEqual(
  `${atProfileGrouping.vah}:${atProfileGrouping.val}`,
  `${atCollapsedGrouping.vah}:${atCollapsedGrouping.val}`,
  "fixture must actually be sensitive to row size, or check 6 proves nothing",
);
const vaCall = primitive.slice(
  primitive.indexOf("const valueArea = calculateVolumeProfileValueArea("),
  primitive.indexOf("const groupedPoc"),
);
assert.ok(
  vaCall.includes("sourceLevels") && vaCall.includes("profile.tickSize * profile.groupTicks"),
  "the value area must be measured at the profile's own grouping",
);
assert.ok(
  !vaCall.includes("groupedTicks,"),
  "the value area must not follow the display-collapsed grouping",
);
rmSync(outDir, { recursive: true, force: true });

console.log("volume profile grouping: 6/6 checks passed");
