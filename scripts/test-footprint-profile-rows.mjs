import assert from "node:assert/strict";
import {
  DEFAULT_FOOTPRINT_SETTINGS,
  FOOTPRINT_PROFILE_MAX_TICKS_PER_ROW,
  FOOTPRINT_SETTINGS_SCHEMA_VERSION,
  footprintProfileGranularityTicks,
  validateFootprintSettings,
} from "../src/lib/footprintSettings.ts";

/**
 * The footprint's side profile is read as a SHAPE — the wave, the shelves, the
 * thin spots. At one tick per row on a liquid contract that shape is a comb of
 * hairlines.
 *
 * The old control inverted a 1-10 "detail" score into 11 - detail, so the
 * coarsest it could ever be was ten ticks and its DEFAULT, detail 10, was one
 * tick: the finest of all.
 */

// --- the control says what it does ---
{
  assert.equal(footprintProfileGranularityTicks(1), 1);
  assert.equal(footprintProfileGranularityTicks(10), 10, "the value IS the ticks per row");
  assert.equal(footprintProfileGranularityTicks(25), 25);
  assert.equal(
    footprintProfileGranularityTicks(FOOTPRINT_PROFILE_MAX_TICKS_PER_ROW + 40),
    FOOTPRINT_PROFILE_MAX_TICKS_PER_ROW,
    "clamped at the coarsest offered",
  );
  assert.equal(footprintProfileGranularityTicks(0), 1, "never finer than one tick");
  assert.equal(footprintProfileGranularityTicks(-5), 1);
  assert.equal(footprintProfileGranularityTicks(undefined), 10, "absent falls to the default");
  assert.equal(footprintProfileGranularityTicks("nonsense"), 10);
  assert.ok(FOOTPRINT_PROFILE_MAX_TICKS_PER_ROW >= 50, "coarse enough to read a wave on a liquid contract");
}

// --- a fresh footprint groups ten ticks to a row ---
{
  assert.equal(DEFAULT_FOOTPRINT_SETTINGS.perBarProfileTicksPerRow, 10);
  const fresh = validateFootprintSettings({});
  assert.equal(fresh.perBarProfileTicksPerRow, 10, "ten times coarser than the old default");
  assert.equal(footprintProfileGranularityTicks(fresh.perBarProfileTicksPerRow), 10);
}

// --- the old default was nobody's choice, so it does not survive ---
{
  const legacyDefault = validateFootprintSettings({
    footprintSettingsVersion: 7,
    perBarProfileGranularity: 10, // the old default: one tick per row
  });
  assert.equal(legacyDefault.perBarProfileTicksPerRow, 10,
    "a footprint still on the old default gets the new one");
}

// --- but a deliberate coarse choice is carried over ---
{
  // detail 1 was the coarsest the old scale offered: ten ticks per row.
  assert.equal(
    validateFootprintSettings({ footprintSettingsVersion: 7, perBarProfileGranularity: 1 })
      .perBarProfileTicksPerRow,
    10,
  );
  // detail 6 meant five ticks per row — a real choice, kept.
  assert.equal(
    validateFootprintSettings({ footprintSettingsVersion: 7, perBarProfileGranularity: 6 })
      .perBarProfileTicksPerRow,
    5,
  );
  assert.equal(
    validateFootprintSettings({ footprintSettingsVersion: 7, perBarProfileGranularity: 9 })
      .perBarProfileTicksPerRow,
    2,
  );
}

// --- a v8 choice is the trader's and is never rewritten ---
{
  let settings = validateFootprintSettings({
    footprintSettingsVersion: FOOTPRINT_SETTINGS_SCHEMA_VERSION,
    perBarProfileTicksPerRow: 32,
  });
  assert.equal(settings.perBarProfileTicksPerRow, 32);
  for (let i = 0; i < 5; i += 1) {
    settings = validateFootprintSettings(settings);
    assert.equal(settings.perBarProfileTicksPerRow, 32, "a saved choice must survive re-reads");
  }
  // Even one tick, if that is genuinely wanted.
  assert.equal(
    validateFootprintSettings({
      footprintSettingsVersion: FOOTPRINT_SETTINGS_SCHEMA_VERSION,
      perBarProfileTicksPerRow: 1,
    }).perBarProfileTicksPerRow,
    1,
  );
}

console.log("Footprint profile row-size tests passed.");
