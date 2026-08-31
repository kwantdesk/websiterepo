import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  defaultIndicatorSettings,
  normalizeStoredIndicator,
} from "../src/lib/chartIndicatorConfig.ts";
import {
  buildVixEnvironmentSnapshot,
  classifyVixEnvironment,
  normalizeVixEnvironmentThresholds,
  resolveVixEnvironmentSymbol,
} from "../src/lib/vixEnvironment.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../native/parity/fixtures/charts/vix-environment-authoritative.json",
  import.meta.url,
), "utf8"));

const defaults = defaultIndicatorSettings(fixture.indicatorId);
for (const [key, expected] of Object.entries(fixture.defaultSettings)) {
  assert.deepEqual(defaults[key], expected, `browser default mismatch for ${key}`);
}
for (const row of fixture.classificationCases) {
  assert.equal(classifyVixEnvironment(row.value), row.expected);
}
assert.deepEqual(
  normalizeVixEnvironmentThresholds(fixture.thresholdNormalization.input),
  fixture.thresholdNormalization.expected,
);
assert.equal(resolveVixEnvironmentSymbol("NQ", "AUTO"), "VXN");
assert.equal(resolveVixEnvironmentSymbol("ES", "AUTO"), "VIX");

const normalized = normalizeStoredIndicator({
  id: "fixture-vix",
  indicatorId: fixture.indicatorId,
  settings: {
    position: "invalid",
    sourceSymbol: "bad",
    badgeScale: 9,
    normalThreshold: 50,
    elevatedThreshold: 10,
    highThreshold: 11,
    extremeThreshold: 12,
  },
});
assert.equal(normalized.settings.position, "top-left");
assert.equal(normalized.settings.sourceSymbol, "VIX");
assert.equal(normalized.settings.badgeScale, 2);
assert.deepEqual(
  {
    normal: normalized.settings.normalThreshold,
    elevated: normalized.settings.elevatedThreshold,
    high: normalized.settings.highThreshold,
    extreme: normalized.settings.extremeThreshold,
  },
  fixture.thresholdNormalization.expected,
);

const live = buildVixEnvironmentSnapshot({
  symbol: "VIX",
  live: {
    symbol: "VIX",
    lastPrice: 24,
    openPrice: 20,
    change: 4,
    changePercent: 20,
    timestamp: 1786672800000,
    marketOpen: true,
    delayed: false,
    provider: "Massive (VPS)",
  },
  history: fixture.history,
  asOfMs: 1786672800000,
});
const replay = buildVixEnvironmentSnapshot({
  symbol: "VIX",
  live: null,
  history: fixture.history,
  asOfMs: 1786672800000,
  replay: true,
});

for (const [actual, receipt] of [[live, fixture.snapshots[0]], [replay, fixture.snapshots[1]]]) {
  assert.ok(actual);
  for (const key of [
    "symbol", "value", "open", "change", "changePercent", "sessionHigh", "sessionLow",
    "sessionPositionPercent", "rank52Week", "percentile52Week", "regime", "stale",
    "delayed", "marketOpen",
  ]) assert.deepEqual(actual[key], receipt[key], `browser receipt mismatch for ${key}`);
  assert.equal(Date.parse(actual.checkedAt), receipt.checkedAtMs);
}
assert.equal(live.sourceLabel, fixture.snapshots[0].sourceLabel);
assert.equal(replay.sourceLabel, "VIX · official daily history");
assert.ok(fixture.positionChoices.includes(defaults.position));
console.log("VIX Environment browser/native authority fixture passed.");
