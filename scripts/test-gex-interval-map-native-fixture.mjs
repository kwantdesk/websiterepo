import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildGexIntervalMapSnapshot } from "../src/lib/gexIntervalMap.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../native/parity/fixtures/charts/gex-interval-map-authoritative.json",
  import.meta.url,
), "utf8"));

const snapshot = buildGexIntervalMapSnapshot(
  fixture.receipt,
  fixture.receipt.displayInstrument,
  fixture.displayPrices,
  fixture.browserSettings,
);
assert.equal(snapshot.netExposure, fixture.expected.netExposure);
assert.equal(snapshot.grossExposure, fixture.expected.grossExposure);
assert.equal(snapshot.skippedMappingBuckets, fixture.expected.skippedMappingBuckets);
assert.equal(snapshot.points.length, fixture.expected.points.length);
for (let index = 0; index < fixture.expected.points.length; index += 1) {
  const actual = snapshot.points[index];
  const expected = fixture.expected.points[index];
  for (const key of [
    "timestamp", "sourceStrike", "mappedPrice", "call", "put", "net", "gross",
    "previousNet", "netChange", "value",
  ]) assert.equal(actual[key], expected[key], `point ${index} ${key}`);
  assert.ok(Math.abs(actual.percentageOfBucketMagnitude - expected.bucketShare) < 1e-12);
  assert.ok(Math.abs(actual.percentageOfVisibleMagnitude - expected.visibleShare) < 1e-12);
  assert.equal(actual.mapping.method, "live-ratio");
  assert.equal(actual.mapping.mappingConfidence, 88);
}
assert.deepEqual(snapshot.levels, fixture.expected.levels);
assert.deepEqual(snapshot.tracks, fixture.expected.tracks);
assert.ok(snapshot.limitations.includes("Local sign changes are not labelled as a Gamma Flip."));

const defaults = defaultIndicatorSettings("gex-interval-map");
assert.equal(Object.keys(defaults).length, 79);
assert.equal(defaults.gexIntervalMapSettingsVersion, 3);
const normalized = normalizeStoredIndicator({
  id: "authority-gex-interval-map",
  indicatorId: "gex-interval-map",
  settings: {
    aggregationPeriod: "4h",
    provider: "invalid",
    positiveColor: "invalid",
    apiKey: "must-not-survive",
    points: [{ mustNot: "survive" }],
  },
});
assert.equal(normalized.settings.aggregationPeriod, "4h");
assert.equal(normalized.settings.provider, "quantdata");
assert.equal(normalized.settings.positiveColor, "#22C55E");
assert.equal("apiKey" in normalized.settings, false);
assert.equal("points" in normalized.settings, false);

console.log("GEX Interval Map browser/native authority fixture passed.");
