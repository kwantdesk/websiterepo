import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  defaultIndicatorSettings,
  normalizeStoredIndicator,
} from "../src/lib/chartIndicatorConfig.ts";
import {
  buildOptionsSurfaceNetSeries,
  optionsDeltaSourceForInstrument,
} from "../src/lib/optionsDelta.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../native/parity/fixtures/charts/zero-gamma-bars-authoritative.json",
  import.meta.url,
), "utf8"));

const defaults = defaultIndicatorSettings("zero-gamma-bars");
assert.equal(defaults.refreshSeconds, 60);
assert.equal(defaults.useThemeColors, true);
assert.equal(typeof defaults.positiveColor, "string");
assert.equal(typeof defaults.negativeColor, "string");

const normalized = normalizeStoredIndicator({
  id: "fixture-zero-gamma-bars",
  indicatorId: "zero-gamma-bars",
  settings: {
    refreshSeconds: 1,
    useThemeColors: false,
    positiveColor: "#123456",
    negativeColor: "#654321",
    apiKey: "must-not-survive",
    history: ["must-not-survive"],
  },
});
assert.equal(normalized.settings.refreshSeconds, 15);
assert.equal(normalized.settings.useThemeColors, false);
assert.equal("apiKey" in normalized.settings, false);
assert.equal("history" in normalized.settings, false);

for (const [instrument, source] of [
  ["QQQ", "QQQ"], ["I:SPX", "SPX"], ["SPXW", "SPXW"],
  ["NQU6", "NDX"], ["MNQ.v.0", "NDX"], ["ESU6", "SPX"],
]) {
  assert.equal(optionsDeltaSourceForInstrument(instrument), source);
}
assert.equal(optionsDeltaSourceForInstrument("CL"), null);

const points = buildOptionsSurfaceNetSeries({
  frames: fixture.rawFrames.map((frame) => ({
    timestamp: frame.timestampMs,
    updates: frame.updates,
  })),
});
assert.deepEqual(points, fixture.expectedPoints);
assert.equal(fixture.snapshots[0].status, "LIVE");
assert.equal(fixture.snapshots[1].replayAsOfMs, fixture.snapshots[1].asOfMs);

console.log("Zero Gamma Bars browser/native authority fixture passed.");
