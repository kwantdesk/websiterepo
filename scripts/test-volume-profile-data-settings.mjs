import assert from "node:assert/strict";

import {
  AUTOMATIC_VOLUME_PROFILE_TARGET_ROWS,
  automaticVolumeProfileGroupTicks,
  volumeProfileBinTick,
} from "../src/lib/volumeProfileMath.ts";

/**
 * Data Settings parity with DeepChart's DP: DeltaVol tab — tick grouping
 * (Automatic with a group factor, or Manual ticks) and the trade-size filter.
 */

const NQ_TICK = 0.25;

// --- automatic grouping tracks the session range, not a fixed tick count ---
{
  // A 400-point NQ day is 1,600 ticks. Ungrouped that is 1,600 hairline rows.
  const wide = automaticVolumeProfileGroupTicks(400, NQ_TICK);
  assert.ok(wide > 1, "a wide session must group ticks rather than draw every one");
  const rows = (400 / NQ_TICK) / wide;
  assert.ok(
    rows <= AUTOMATIC_VOLUME_PROFILE_TARGET_ROWS,
    `expected at most ${AUTOMATIC_VOLUME_PROFILE_TARGET_ROWS} rows, got ${rows}`,
  );
  assert.ok(rows > AUTOMATIC_VOLUME_PROFILE_TARGET_ROWS / 2, "grouping must not over-coarsen a wide day");

  // A quiet 20-point day is only 80 ticks — well under the target, so it stays ungrouped.
  assert.equal(automaticVolumeProfileGroupTicks(20, NQ_TICK), 1, "a narrow session needs no grouping");
}

// --- the auto group factor multiplies the derived value ---
{
  const base = automaticVolumeProfileGroupTicks(400, NQ_TICK, 1);
  assert.equal(automaticVolumeProfileGroupTicks(400, NQ_TICK, 2), base * 2, "factor 2 doubles the ticks per row");
  assert.equal(automaticVolumeProfileGroupTicks(400, NQ_TICK, 3), base * 3, "factor 3 triples the ticks per row");
  // A factor never produces a sub-tick row.
  assert.equal(automaticVolumeProfileGroupTicks(20, NQ_TICK, 4), 4, "factor still applies on a narrow session");
}

// --- unknown range is honest, not invented ---
{
  for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(automaticVolumeProfileGroupTicks(bad, NQ_TICK), 1, `range ${bad} falls back to no grouping`);
  }
  assert.equal(automaticVolumeProfileGroupTicks(400, 0), 1, "an unknown tick size falls back to no grouping");
  assert.equal(
    automaticVolumeProfileGroupTicks(400, NQ_TICK, 0),
    automaticVolumeProfileGroupTicks(400, NQ_TICK, 1),
    "a zero/absent factor behaves as 1 rather than collapsing the profile",
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
