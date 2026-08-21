import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { volumeProfileBinTick } from "../src/lib/volumeProfileMath.ts";

/**
 * Data Settings parity with DeepChart's DP: DeltaVol tab — tick grouping
 * (Automatic, or Manual ticks) and the trade-size filter.
 */

/**
 * Automatic grouping belongs to the RENDERER, which knows how many pixels a
 * tick row occupies and collapses rows only as far as the zoom requires — so
 * zooming in recovers per-tick detail. Pre-grouping the REQUEST destroys that:
 * the renderer multiplies an already-coarsened row and the fine data was never
 * fetched, which shows up as permanently fat bars. This guard exists because
 * that regression shipped once.
 */
{
  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
    "utf8",
  );

  for (const scope of ["daily", "weekly"]) {
    const pattern = new RegExp(
      `const requested${scope[0].toUpperCase()}${scope.slice(1)}GroupTicks = ${scope}ProfileSettings\\.groupingMode === "manual"\\s*\\?[^:]+:\\s*([^;]+);`,
    );
    const match = workspace.match(pattern);
    assert.ok(match, `${scope} group-ticks request not found — update this guard`);
    assert.equal(
      match[1].trim(),
      "1",
      `${scope} profiles must request tick resolution in Automatic mode, not a pre-grouped row size`,
    );
  }

  assert.ok(
    !workspace.includes("automaticVolumeProfileGroupTicks"),
    "the request must not derive its own automatic row size",
  );

  // The renderer's adaptive multiplier is the one true automatic grouping.
  const primitive = readFileSync(
    new URL("../src/lib/nativeVolumeProfilePrimitive.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    primitive,
    /automaticMultiplier = style\.automaticGrouping/,
    "the renderer still owns automatic grouping",
  );
  assert.match(
    primitive,
    /style\.autoGroupFactor\) \/ sourceRowPixels/,
    "Auto group factory scales the renderer's pixel-derived multiplier",
  );
}

// --- manual grouping bins deterministically and never loses a trade ---
{
  // ManualTicks = 4 (DeepChart's default): ticks 0-3 collapse to 0, 4-7 to 4.
  assert.equal(volumeProfileBinTick(0, 4), 0);
  assert.equal(volumeProfileBinTick(3, 4), 0);
  assert.equal(volumeProfileBinTick(4, 4), 4);
  assert.equal(volumeProfileBinTick(7, 4), 4);
  // Negative ticks (prices below the scale origin) must floor, not truncate
  // toward zero, or two adjacent rows would merge across the boundary.
  assert.equal(volumeProfileBinTick(-1, 4), -4);
  assert.equal(volumeProfileBinTick(-4, 4), -4);
  // A grouping of 1 is the identity, which is what Automatic requests.
  for (let tick = -5; tick <= 5; tick += 1) {
    assert.equal(volumeProfileBinTick(tick, 1), tick, "tick resolution is preserved exactly");
  }

  // Every tick in a run lands in exactly one bucket, so no volume is dropped.
  const seen = new Map();
  for (let tick = -20; tick <= 20; tick += 1) {
    const bucket = volumeProfileBinTick(tick, 4);
    seen.set(bucket, (seen.get(bucket) ?? 0) + 1);
  }
  const total = [...seen.values()].reduce((sum, n) => sum + n, 0);
  assert.equal(total, 41, "every tick is assigned to exactly one row");
  for (const [bucket, count] of seen) {
    assert.ok(count <= 4, `bucket ${bucket} holds ${count} ticks, expected at most 4`);
  }
}

// --- the trade-size filter mirrors the server's row handler ---
{
  // Server semantics (databentoExecutionProfile.server.ts): a trade is skipped
  // when size <= 0, size < filterMin, or (filterMax > 0 and size > filterMax).
  // filterMax of 0 means "no upper bound", which is DeepChart's default.
  const accepts = (size, filterMin, filterMax) =>
    size > 0 && size >= filterMin && !(filterMax > 0 && size > filterMax);

  assert.equal(accepts(1, 0, 0), true, "defaults accept every real trade");
  assert.equal(accepts(0, 0, 0), false, "a zero-size print is never counted");
  assert.equal(accepts(4, 5, 0), false, "below Filter min is excluded");
  assert.equal(accepts(5, 5, 0), true, "Filter min is inclusive");
  assert.equal(accepts(50, 0, 10), false, "above Filter max is excluded");
  assert.equal(accepts(10, 0, 10), true, "Filter max is inclusive");
  assert.equal(accepts(9999, 0, 0), true, "Filter max 0 imposes no upper bound");
  assert.equal(accepts(7, 5, 10), true, "a trade inside the band is counted");
}

console.log("Volume profile Data Settings (grouping + filters) tests passed.");
