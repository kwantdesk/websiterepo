import assert from "node:assert/strict";
import { defaultTpoSettings, validateTpoSettings } from "../src/lib/tpo/settings.ts";
import { TPO_SETTINGS_SCHEMA_VERSION, TPO_V2_RESET_KEYS } from "../src/lib/tpo/types.ts";
import { readFileSync } from "node:fs";

/**
 * A freshly added TPO shows the letters, the value area and the point of
 * control. Nothing else.
 *
 * v1 shipped the developing POC on, which drew an orange staircase down from
 * the highs across every profile — a study a trader turns ON when they want
 * it, not the first thing they have to turn off.
 */
for (const variant of ["tpo-chart", "weekly-tpo"]) {
  const defaults = defaultTpoSettings(variant);

  // What a trader asked to see.
  assert.equal(defaults.showValueArea, true, `${variant}: value area`);
  assert.equal(defaults.valueAreaShowLines, true, `${variant}: VAH/VAL lines`);
  assert.equal(defaults.showPoc, true, `${variant}: point of control`);
  assert.notEqual(defaults.pocLineMode, "none", `${variant}: the POC line is drawn`);

  // What they did not.
  assert.equal(defaults.showDevelopingPoc, false, `${variant}: no developing-POC staircase`);
  assert.equal(defaults.showDevelopingValueArea, false, `${variant}: no developing value area`);
  assert.equal(defaults.showInitialBalance, false, `${variant}: no initial balance`);
  assert.equal(defaults.showSinglePrints, false, `${variant}: no single prints`);
  assert.equal(defaults.showPeaks, false, `${variant}: no peaks`);
  assert.equal(defaults.showValleys, false, `${variant}: no valleys`);
}

// --- the one-time v1 correction reaches TPOs already on a chart ---
{
  // A saved v1 TPO carrying the old defaults plus a real choice of its own.
  const v1 = {
    schemaVersion: 1,
    showDevelopingPoc: true,
    showInitialBalance: true,
    showSinglePrints: true,
    valueAreaPercent: 68,      // the trader's own choice
    pocLineColor: "#00FF00",   // and another
  };
  const migrated = validateTpoSettings(v1, "tpo-chart");
  for (const key of TPO_V2_RESET_KEYS) {
    assert.equal(migrated[key], false, `${key} must be reset on the v1 read`);
  }
  assert.equal(migrated.valueAreaPercent, 68, "an unrelated choice must survive");
  assert.equal(migrated.pocLineColor, "#00FF00", "an unrelated choice must survive");
  assert.equal(migrated.schemaVersion, TPO_SETTINGS_SCHEMA_VERSION);
}

// --- after the correction, the trader's choice is theirs ---
{
  // Turning the staircase back on at v2 must stick through every later read.
  let settings = validateTpoSettings({ schemaVersion: 2, showDevelopingPoc: true }, "tpo-chart");
  assert.equal(settings.showDevelopingPoc, true, "a v2 choice must be honoured");
  for (let i = 0; i < 5; i += 1) {
    settings = validateTpoSettings(settings, "tpo-chart");
    assert.equal(settings.showDevelopingPoc, true, "and must not be reset again");
  }
  // Same for the other two.
  const both = validateTpoSettings(
    { schemaVersion: 2, showInitialBalance: true, showSinglePrints: true },
    "weekly-tpo",
  );
  assert.equal(both.showInitialBalance, true);
  assert.equal(both.showSinglePrints, true);
}

// --- settings with no version at all are treated as v1 ---
{
  const legacy = validateTpoSettings({ showDevelopingPoc: true }, "tpo-chart");
  assert.equal(legacy.showDevelopingPoc, false, "an unversioned TPO is a v1 TPO");
}


// --- show-on-right must not stack every profile at the same edge ---
{
  const primitive = readFileSync(new URL("../src/lib/tpo/primitive.ts", import.meta.url), "utf8");
  // Where a profile is ANCHORED and which way it is DRAWN are two things.
  // Sending every show-on-right profile to the screen's right edge drew this
  // week and last week one on top of the other — the doubled profile.
  // Docking belongs to the newest of a kind; the ones behind it sit at their
  // own period and still face the same way.
  assert.match(primitive, /const facesLeft = settings\.showOnRight;/);
  assert.match(primitive, /const dockRight = facesLeft && latest;/,
    "only the newest profile may dock to the screen edge");
  assert.doesNotMatch(primitive, /const pinnedRight = settings\.showOnRight;/,
    "dock and direction must not be the same flag");
  // An older right-facing profile anchors at the end of its own period.
  assert.match(primitive, /clamp\(periodEndX - offset, 2, mediaSize\.width - 2\)/);
  // Direction still follows the setting for every profile, not just the newest.
  assert.match(primitive, /const direction = facesLeft \? -1/);
}

console.log("TPO default visual tests passed.");
