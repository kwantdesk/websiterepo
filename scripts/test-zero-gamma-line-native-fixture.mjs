import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  defaultIndicatorSettings,
  normalizeStoredIndicator,
} from "../src/lib/chartIndicatorConfig.ts";
import {
  paintZeroGammaLineOnBars,
  zeroGammaRootForInstrument,
  zeroGammaSourceChoices,
  zeroGammaSourceForInstrument,
} from "../src/lib/zeroGammaLine.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../native/parity/fixtures/charts/zero-gamma-line-authoritative.json",
  import.meta.url,
), "utf8"));

const defaults = defaultIndicatorSettings(fixture.indicatorId);
for (const [key, expected] of Object.entries(fixture.defaultSettings)) {
  assert.deepEqual(defaults[key], expected, `browser default mismatch for ${key}`);
}
for (const row of fixture.sourceCases) {
  assert.equal(zeroGammaRootForInstrument(row.instrument), row.root);
  assert.equal(zeroGammaSourceForInstrument(row.instrument), row.automatic);
  assert.deepEqual(zeroGammaSourceChoices(row.instrument), row.choices);
}

const normalized = normalizeStoredIndicator({
  id: "fixture-zero-gamma",
  indicatorId: fixture.indicatorId,
  settings: {
    sourceTicker: "BAD",
    historySessions: 99,
    refreshSeconds: 1,
    opacity: 0,
    lineWidth: 9,
    lineStyle: "bad",
    apiKey: "must-not-survive",
  },
});
assert.equal(normalized.settings.historySessions, 5);
assert.equal(normalized.settings.refreshSeconds, 15);
assert.equal(normalized.settings.opacity, 5);
assert.equal(normalized.settings.lineWidth, 4);
assert.equal(normalized.settings.lineStyle, "solid");
assert.equal("apiKey" in normalized.settings, false);

const fixtureSessionStart = Date.parse("2026-08-20T13:30:00.000Z");
const fixtureFirstPoint = fixture.paintCase.points[0].timestampMs;
const fixturePoints = fixture.paintCase.points.map((point) => ({
  ...point,
  timestampMs: fixtureSessionStart + point.timestampMs - fixtureFirstPoint,
}));
const sourceBarTimes = fixture.paintCase.barTimesMs.map((value) =>
  (fixtureSessionStart + value - fixture.paintCase.barTimesMs[0]) / 1000);
const painted = paintZeroGammaLineOnBars(
  fixturePoints,
  fixture.paintCase.barTimesMs.map((value) => value / 1000),
  fixture.paintCase.barIntervalMs / 1000,
  sourceBarTimes,
);
assert.deepEqual(painted.map((point) => point.value), fixture.paintCase.expectedValues);
assert.equal(fixture.snapshots[0].points.at(-1).status, "LIVE");
assert.equal(fixture.snapshots[1].method, "OPTIONS_GAMMA_CROSSING");
console.log("Zero Gamma Line browser/native authority fixture passed.");
