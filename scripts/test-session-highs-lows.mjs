import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";
import { buildPreviousSessionHighLowLevels, resolveMarketSessions } from "../src/lib/marketSessions.ts";

const MINUTE = 60_000;
const settings = defaultIndicatorSettings("session-highs-lows");

// The public study contract is four named futures sessions, all expressed in
// Chicago exchange time so daylight-saving changes stay correct.
const sessions = resolveMarketSessions(settings);
assert.deepEqual(sessions.map(({ key, label, timezone, start, end }) => ({ key, label, timezone, start, end })), [
  { key: "globex", label: "Globex", timezone: "America/Chicago", start: "17:00", end: "16:00" },
  { key: "tokyo", label: "Asia", timezone: "America/Chicago", start: "17:00", end: "02:00" },
  { key: "london", label: "London", timezone: "America/Chicago", start: "02:00", end: "10:00" },
  { key: "newYork", label: "New York", timezone: "America/Chicago", start: "08:30", end: "15:00" },
]);

// Monday 17:00 through Wednesday 16:30 Chicago gives at least one completed
// occurrence of every session and a newer occurrence for each named subset.
const start = Date.parse("2026-01-05T23:00:00.000Z");
const end = Date.parse("2026-01-07T22:30:00.000Z");
const candles = [];
for (let timestamp = start, index = 0; timestamp <= end; timestamp += MINUTE, index += 1) {
  const price = 20_000 + index * 0.01;
  candles.push({ timestamp, open: price, high: price + 1, low: price - 1, close: price, volume: 10 });
}
const levels = buildPreviousSessionHighLowLevels(candles, settings, MINUTE);
assert.equal(levels.length, 8, "four sessions must each contribute one latest high and low");
assert.deepEqual(new Set(levels.map((level) => level.session.key)), new Set(["globex", "tokyo", "london", "newYork"]));
assert.deepEqual(new Set(levels.map((level) => level.label)), new Set([
  "Globex High", "Globex Low", "Asia High", "Asia Low",
  "London High", "London Low", "New York High", "New York Low",
]));
assert.ok(levels.every((level) => !/^P\d\b/.test(level.label)), "P1/P2/P3 prefixes are retired");

// Old saved studies are upgraded, not left carrying Tokyo, Sydney or random
// per-session colours after the code defaults change.
const migrated = normalizeStoredIndicator({
  instanceId: "legacy-session-levels",
  indicatorId: "session-highs-lows",
  enabled: true,
  settings: {
    tokyoLabel: "Tokyo",
    showSydney: true,
    tokyoColor: "#FF9900",
    londonColor: "#4CAF50",
    newYorkColor: "#2196F3",
    showPrevious1: true,
    showPrevious2: true,
    showPrevious3: true,
    sessionHighLowSettingsVersion: 1,
  },
});
assert.equal(migrated.settings.tokyoLabel, "Asia");
assert.equal(migrated.settings.showGlobex, true);
assert.equal(migrated.settings.showSydney, undefined);
assert.equal(migrated.settings.tokyoColor, undefined);
assert.equal(migrated.settings.showPrevious3, undefined);

// Renderer contract: exact name only, with high/low colours recalculated from
// the current visible chart theme rather than stored session swatches.
const chartSource = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
assert.ok(chartSource.includes("const sessionTheme = visibleIndicatorTheme(settings)"));
assert.ok(chartSource.includes('color: level.side === "high" ? sessionTheme.positive : sessionTheme.negative'));
assert.ok(chartSource.includes("showPriceInLabel: false"), "the numeric suffix must not be appended to session labels");

console.log("Session highs/lows contract tests passed.");
