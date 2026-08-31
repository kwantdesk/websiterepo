import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildGammaHeatmapBins,
  buildGammaHeatmapMapping,
  deriveGammaHeatmapLevels,
} from "../src/lib/gammaHeatmap.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../native/parity/fixtures/charts/gamma-heatmap-authoritative.json",
  import.meta.url,
), "utf8"));

const mapping = buildGammaHeatmapMapping(fixture.mappingInput);
assert.deepEqual(mapping, fixture.expectedMapping);
const bins = buildGammaHeatmapBins(fixture.rows, mapping, fixture.binSize);
assert.deepEqual(bins, fixture.expectedBins);
assert.deepEqual(deriveGammaHeatmapLevels(bins, mapping.confidence, "GAMMA"), fixture.expectedLevels);
assert.equal(fixture.expectedLevels.find((level) => level.kind === "LOCAL_SIGN_TRANSITION").isTrueGammaFlip, false);

const defaults = defaultIndicatorSettings("gamma-heatmap");
assert.equal(defaults.historyHours, 24);
assert.equal(defaults.binSize, 5);
assert.equal(defaults.opacity, 68);
assert.equal(defaults.intensity, 1);
assert.equal(defaults.refreshSeconds, 30);
assert.equal(defaults.metric, "GAMMA");
assert.equal(defaults.sourceMode, "hybrid");
assert.equal(defaults.optionsSource, "AUTO");
assert.equal(defaults.showHistorical, true);
assert.equal(defaults.showLevels, true);
assert.equal(defaults.carryForwardFade, true);

const normalized = normalizeStoredIndicator({
  id: "fixture-gamma-heatmap",
  indicatorId: "gamma-heatmap",
  settings: {
    historyHours: 999,
    binSize: 0,
    refreshSeconds: 1,
    sourceMode: "hybrid",
    apiKey: "must-not-survive",
    snapshots: ["must-not-survive"],
  },
});
assert.equal(normalized.settings.historyHours, 120);
assert.equal(normalized.settings.binSize, 0.25);
assert.equal(normalized.settings.refreshSeconds, 15);
assert.equal("apiKey" in normalized.settings, false);
assert.equal("snapshots" in normalized.settings, false);

console.log("Gamma Heatmap browser/native authority fixture passed.");
