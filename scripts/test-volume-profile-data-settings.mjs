import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { groupVolumeProfileLevels, volumeProfileBinTick } from "../src/lib/volumeProfileMath.ts";

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

  /*
   * BOTH modes now fetch at tick resolution, not just Automatic.
   *
   * Manual used to send its row size to the server, so the profile came back
   * pre-binned and the fine data was never fetched: those rows could not get
   * finer however far you zoomed, and the profile carried fewer levels.
   * DeepChart applies the same control as a display bin over full-resolution
   * data - which is why 4 ticks there barely changes anything at ordinary zoom
   * and only bites once you zoom past the legibility floor. The manual size is
   * applied in the renderer instead, as a floor on the row.
   */
  for (const scope of ["daily", "weekly"]) {
    const name = `requested${scope[0].toUpperCase()}${scope.slice(1)}GroupTicks`;
    const match = workspace.match(new RegExp(`const ${name} = ([^;]+);`));
    assert.ok(match, `${scope} group-ticks request not found — update this guard`);
    assert.equal(
      match[1].trim(),
      "1",
      `${scope} profiles must request tick resolution in BOTH modes, not a pre-grouped row size`,
    );
    assert.ok(
      !new RegExp(`const ${name}[^;]*groupingMode`).test(workspace),
      `${scope} profiles are choosing a request row size from the grouping mode again`,
    );
  }

  // And the renderer has to be the one honouring the manual size.
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(
    chart,
    /manualGroupTicks: clamp\(Number\(profileSettings\.groupTicks \?\? 4\), 1, 500\)/,
    "the manual row size no longer reaches the renderer",
  );

  assert.ok(
    !workspace.includes("automaticVolumeProfileGroupTicks"),
    "the request must not derive its own automatic row size",
  );

  /*
   * Manual is a FLOOR on the row, never a coarser fetch.
   *
   * Taking the larger of the arrived bin and the trader's own size means it
   * cannot draw finer than asked and cannot discard detail the pre-binned
   * request used to throw away.
   */
  {
    const primitiveSource = readFileSync(
      new URL("../src/lib/nativeVolumeProfilePrimitive.ts", import.meta.url), "utf8",
    );
    assert.match(
      primitiveSource,
      /: Math\.max\(profile\.groupTicks, Math\.max\(1, Math\.round\(style\.manualGroupTicks \?\? 1\)\)\)/,
      "the renderer no longer applies the manual row size",
    );
    assert.match(
      primitiveSource,
      /const groupedTicks = requestedTicks \* automaticMultiplier;/,
      "the legibility multiplier no longer applies on top of the manual size",
    );
  }

  // The renderer's adaptive multiplier is the one true automatic grouping.
  const primitive = readFileSync(
    new URL("../src/lib/nativeVolumeProfilePrimitive.ts", import.meta.url),
    "utf8",
  );
  /*
   * Matched on behaviour rather than on one expression.
   *
   * Both of these were pinned to the exact text of the multiplier and went
   * stale when the legibility floor was extended to manual profiles - failing
   * the suite over a refactor they were not testing, which is worse than not
   * testing it at all.
   *
   * What must stay true: the trader's coarsening factor applies ONLY in
   * automatic mode, and it scales a multiplier derived from how many pixels a
   * row actually gets.
   */
  assert.match(
    primitive,
    /style\.automaticGrouping \? style\.autoGroupFactor : 1/,
    "the coarsening factor is still exclusive to automatic grouping",
  );
  assert.match(
    primitive,
    /automaticMultiplier = Math\.max\([\s\S]{0,200}?\/ sourceRowPixels/,
    "and it still scales a multiplier derived from the pixels a row gets",
  );
  assert.match(
    primitive,
    /groupedTicks = requestedTicks \* automaticMultiplier/,
    "which is what actually coarsens the rows",
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

  // The actual renderer helper must combine the four rows, not merely enlarge
  // four overlapping single-tick rectangles to the same visual height.
  const rows = [0, 1, 2, 3, 4].map((tick) => ({
    price: 100 + tick * 0.25,
    volume: tick + 1,
    askVolume: tick + 1,
    bidVolume: 0,
    delta: tick + 1,
    trades: 1,
  }));
  const grouped = groupVolumeProfileLevels(rows, 0.25, 4);
  assert.equal(grouped.length, 2, "manual four-tick mode still paints single-tick rows");
  assert.deepEqual(grouped[0], {
    price: 100,
    volume: 10,
    askVolume: 10,
    bidVolume: 0,
    delta: 10,
    trades: 4,
  });
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

/**
 * A session's POC and value area stay live until the next session takes over,
 * so their lines must reach the START of the profile in front and stop there.
 * Drawing one underneath the next profile misreads which session owns the
 * level, and the rule has to survive split/RTH modes where several profiles
 * share a day.
 */
{
  const primitive = readFileSync(
    new URL("../src/lib/nativeVolumeProfilePrimitive.ts", import.meta.url),
    "utf8",
  );

  // Occlusion uses exact painted spans, not time projections. This covers
  // docked, overlapping, weekly/daily and split-session combinations alike.
  assert.match(
    primitive,
    /const drawnBodySpans = new Map<string, VolumeProfileBodySpan>\(\);/,
    "the renderer must record every painted profile body",
  );
  assert.match(
    primitive,
    /forwardVolumeProfileLevelSegment/,
    "the level must be clipped against those painted bodies",
  );
  // Every profile kind on the same instrument participates.
  assert.match(
    primitive,
    /body\.root !== root/,
    "profiles must be isolated by instrument, not profile period",
  );
  // A covered source draws nothing; it never reverses toward the left.
  assert.match(
    primitive,
    /return endX > sourceFrontX \+ 0\.5 \? \{ startX: sourceFrontX, endX \} : null/,
    "a level segment can only travel forward",
  );
  // Level lines start at the profile body's forward edge.
  assert.match(
    primitive,
    /context\.moveTo\(lineSegment\.startX, y\)/,
    "levels must not emerge backwards through their own profile",
  );
  // Candle touches must not produce arbitrary mid-session cutoffs. Structural
  // profile levels chain only to the next profile or the live pane edge.
  assert.doesNotMatch(
    primitive,
    /till-interaction|interactionBars|touchedX/,
    "VAH, VAL and POC must not stop at an intervening candle touch",
  );
  assert.ok(
    !primitive.includes('"till-end-window"'),
    "the retired extend-to-chart-edge mode must not linger in the renderer",
  );
}

console.log("Volume profile level chaining tests passed.");
