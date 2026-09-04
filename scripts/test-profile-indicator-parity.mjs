import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INDICATOR_NUMERIC_SETTINGS } from "../src/lib/chartIndicatorConfig.ts";
import { defaultTpoSettings, validateTpoSettings } from "../src/lib/tpo/settings.ts";

const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const primitive = readFileSync(new URL("../src/lib/tpo/primitive.ts", import.meta.url), "utf8");

// Weekly VP exposes the same engineering controls as Daily VP. Only the
// week-selection setting and renderer variant are allowed to differ.
const dailyVp = INDICATOR_NUMERIC_SETTINGS["kwant-profile"];
const weeklyVp = INDICATOR_NUMERIC_SETTINGS["weekly-volume-profile"];
assert.deepEqual(weeklyVp.map(({ key }) => key), dailyVp.map(({ key }) => key));
for (const dailySetting of dailyVp) {
  const weeklySetting = weeklyVp.find(({ key }) => key === dailySetting.key);
  assert.deepEqual(weeklySetting, dailySetting, `weekly VP ${dailySetting.key} must match daily VP`);
}
assert.match(chart, /const instance = profile\.period === "weekly" \? weeklyInstance : dailyInstance/);

// Daily and Weekly TPO share every calculation/presentation default except
// the intended period boundary and visible profile count.
const daily = defaultTpoSettings("daily-tpo");
const weekly = defaultTpoSettings("weekly-tpo");
const allowedDifferences = new Set(["indicatorVariant", "scheduleKind", "lengthUnit", "profileCount"]);
for (const key of Object.keys(daily)) {
  if (!allowedDifferences.has(key)) assert.deepEqual(weekly[key], daily[key], `TPO parity: ${key}`);
}

const migratedLetters = validateTpoSettings({ displayType: "letters" }, "daily-tpo");
assert.equal(migratedLetters.showText, true, "legacy Letter profiles keep their text");
assert.equal(validateTpoSettings({ tpoType: "profile" }, "weekly-tpo").tpoType, "profile");
assert.match(primitive, /const paintAsProfile = settings\.tpoType === "profile"/);

// The indicator shell has a fixed responsive size, the navigation does not
// move, and fragments are flattened so all TPO pages appear in that one rail.
assert.match(control, /h-\[min\(760px,calc\(100vh-2rem\)\)\]/);
assert.match(control, /if \(child\.type === Fragment\)/);
assert.match(control, /<IndicatorSettingsSections key=\{settingsDefinition\.id\}>/);

// Developing TPOs may not sit stale for the old five-second window.
assert.match(chart, /const rebuildThrottleMs = 250;/);
assert.doesNotMatch(chart, /const rebuildThrottleMs = 5_000;/);
assert.match(chart, /canRefreshDevelopingOnly/);
assert.match(chart, /cached!\.profiles\.slice\(0, -1\)/);

console.log("Weekly VP and Daily/Weekly TPO parity checks passed.");
