import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  calculateGammaExposure,
  expirationMatchesFilter,
  resolveMappedBinTicks,
  roundMappedPriceToTick,
} from "../src/lib/netGammaExposureMath.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../native/parity/fixtures/charts/net-gamma-exposure-by-strike-authoritative.json",
  import.meta.url,
), "utf8"));

const exposure = calculateGammaExposure(fixture.exposureInput.call, fixture.exposureInput.put);
assert.deepEqual({
  call: exposure.callExposure,
  put: exposure.putExposure,
  net: exposure.netExposure,
  absoluteCall: exposure.absoluteCallExposure,
  absolutePut: exposure.absolutePutExposure,
  absoluteTotal: exposure.absoluteTotalExposure,
}, fixture.expectedExposure);

for (const item of fixture.roundingCases) {
  const result = roundMappedPriceToTick(item.price, item.tickSize);
  assert.equal(result.mappedDisplayTick, item.expectedTick);
  assert.equal(result.mappedDisplayPrice, item.expectedPrice);
}
for (const item of fixture.binningCases) {
  assert.equal(resolveMappedBinTicks({
    mode: item.mode,
    tickSize: item.tickSize,
    mappedSpacings: item.spacings,
    customBinSizePoints: item.customSize,
  }), item.expectedTicks);
}
for (const item of fixture.expirationCases) {
  assert.equal(expirationMatchesFilter(item.expiration, item.sessionDate, {
    mode: item.mode,
    includeWeeklies: true,
    includeMonthlies: true,
    includeQuarterlies: true,
  }, null), item.expected);
}

const defaults = defaultIndicatorSettings("net-gamma-exposure-by-strike");
assert.equal(Object.keys(defaults).length, 68);
assert.equal(defaults.provider, "quantdata");
assert.equal(defaults.sourceTicker, "AUTO");
assert.equal(defaults.expirationMode, "zero-to-one-dte");
assert.equal(defaults.placement, "floating");
assert.equal(defaults.contentMode, "net");
assert.equal(defaults.netGammaSettingsVersion, 3);

const normalized = normalizeStoredIndicator({
  id: "fixture-net-gamma",
  indicatorId: "net-gamma-exposure-by-strike",
  settings: {
    refreshSeconds: 999,
    maximumDisplayedRows: 999,
    laneWidthPercent: 1,
    provider: "gexbot",
    positiveColor: "invalid",
    apiKey: "must-not-survive",
    liveSnapshot: { mustNot: "survive" },
  },
});
assert.equal(normalized.settings.refreshSeconds, 60);
assert.equal(normalized.settings.maximumDisplayedRows, 250);
assert.equal(normalized.settings.laneWidthPercent, 8);
assert.equal(normalized.settings.provider, "quantdata");
assert.equal(normalized.settings.positiveColor, "#22C55E");
assert.equal("apiKey" in normalized.settings, false);
assert.equal("liveSnapshot" in normalized.settings, false);

console.log("Net Gamma Exposure browser/native authority fixture passed.");
