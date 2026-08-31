import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  resolveDailyVolumeProfileCount,
  DEFAULT_DAILY_VOLUME_PROFILE_COUNT,
  MAXIMUM_DAILY_VOLUME_PROFILES,
  defaultIndicatorSettings,
} = await import("../src/lib/chartIndicatorConfig.ts");

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
);
const control = readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8",
);

/**
 * "Number of profile" moves the chart.
 *
 * It had been stored, migrated across two settings versions and read by
 * nothing: the trading-date list was sliced to a hard six. The value persisted
 * across reloads and the chart drew six profiles whatever it said - a control
 * that remembers what you asked for and ignores it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("zero means the standing default, not none", () => {
  /*
   * Every saved chart carries 0, because that has been the stored default
   * since the setting appeared. Reading it as "draw nothing" would have
   * emptied every existing workspace the moment this shipped.
   */
  assert.equal(resolveDailyVolumeProfileCount(0), DEFAULT_DAILY_VOLUME_PROFILE_COUNT);
  assert.equal(resolveDailyVolumeProfileCount(undefined), DEFAULT_DAILY_VOLUME_PROFILE_COUNT);
  assert.equal(resolveDailyVolumeProfileCount(null), DEFAULT_DAILY_VOLUME_PROFILE_COUNT);
  assert.equal(resolveDailyVolumeProfileCount("nonsense"), DEFAULT_DAILY_VOLUME_PROFILE_COUNT);
  assert.equal(resolveDailyVolumeProfileCount(-3), DEFAULT_DAILY_VOLUME_PROFILE_COUNT);
});

check("a chosen count is honoured", () => {
  assert.equal(resolveDailyVolumeProfileCount(1), 1);
  assert.equal(resolveDailyVolumeProfileCount(3), 3);
  assert.equal(resolveDailyVolumeProfileCount("4"), 4);
  assert.equal(resolveDailyVolumeProfileCount(2.6), 3);
});

check("the ceiling holds", () => {
  // Each profile is its own request per session window, so an unbounded number
  // is an unbounded fan-out.
  assert.equal(resolveDailyVolumeProfileCount(999), MAXIMUM_DAILY_VOLUME_PROFILES);
  // Not a number a spinner can produce; treated as no answer rather than as
  // the largest one, so a corrupt saved value falls back instead of maximising
  // the fan-out.
  assert.equal(resolveDailyVolumeProfileCount(Infinity), DEFAULT_DAILY_VOLUME_PROFILE_COUNT);
  assert.equal(resolveDailyVolumeProfileCount(NaN), DEFAULT_DAILY_VOLUME_PROFILE_COUNT);
});

check("the default is unchanged from the hard-coded six", () => {
  // Shipping this must not move anyone's chart on its own.
  assert.equal(DEFAULT_DAILY_VOLUME_PROFILE_COUNT, 6);
});

check("the trading-date slice is what asks", () => {
  /*
   * The slice is the single place that decided how many days of profiles
   * exist, so it is the single place that has to read the setting. A source
   * check because the alternative is re-implementing the workspace here.
   */
  assert.match(
    workspace,
    /const dailyProfileCount = resolveDailyVolumeProfileCount\(dailyProfileSettings\.numberOfProfiles\);/,
    "the workspace no longer resolves the count",
  );
  assert.match(
    workspace,
    /return \[\.\.\.dates\]\.sort\(\)\.slice\(-dailyProfileCount\);/,
    "the slice is hard-coded again",
  );
  assert.ok(
    !/\.sort\(\)\.slice\(-6\)/.test(workspace),
    "the old hard six is still in the workspace",
  );
});

check("recomputing when the count changes", () => {
  // Without it in the dependency list the setting would move nothing until
  // some unrelated candle arrived - the same class of bug all over again.
  assert.match(
    workspace,
    /\}, \[candles, currentDailyTradingDate, dailyProfileCount\]\);/,
    "dailyProfileCount is missing from the memo dependencies",
  );
});

check("the setting is reachable in the dialog", () => {
  // It was stored and migrated but had no control anywhere, so the only way to
  // change it was to hand-edit saved workspace state.
  assert.ok(control.includes("<span>Number of profiles</span>"), "there is no control for it");
  assert.ok(
    control.includes("numberOfProfiles: next"),
    "the control does not write the setting",
  );
});

check("the profiles still default to it", () => {
  for (const id of ["kwant-profile", "weekly-volume-profile", "delta-profile"]) {
    assert.equal(
      defaultIndicatorSettings(id)?.numberOfProfiles, 0,
      `${id} no longer stores the setting`,
    );
  }
});

console.log(`\nvolume profile count: ${passed}/${passed} checks passed`);
