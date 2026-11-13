import assert from "node:assert/strict";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { CHART_INDICATOR_BY_ID } from "../src/lib/chartIndicatorCatalog.ts";
import { defaultIndicatorSettings, normalizeStoredIndicatorList } from "../src/lib/chartIndicatorConfig.ts";

const theme = {
  primary: "#00ff00",
  secondary: "#ff9900",
  positive: "#00ff00",
  negative: "#ff0000",
  muted: "#808080",
};
const candles = Array.from({ length: 300 }, (_, index) => {
  const open = 29_000 + Math.sin(index / 8) * 20;
  const close = open + Math.cos(index / 5) * 4;
  return {
    timestamp: 1_700_000_000_000 + index * 60_000,
    open,
    high: Math.max(open, close) + 2,
    low: Math.min(open, close) - 2,
    close,
    volume: 500 + (index % 80),
  };
});

let passed = 0;
for (const indicatorId of ["vwap-envelopes", "rolling-vwap"]) {
  const series = calculateIndicatorSeries(
    {
      instanceId: `test-${indicatorId}`,
      indicatorId,
      enabled: true,
      settings: defaultIndicatorSettings(indicatorId) ?? {},
    },
    candles,
    theme,
    { instrument: "NQ", tickSize: 0.25 },
  );
  assert.ok(series.length > 0, `${indicatorId} did not produce any plots`);
  assert.ok(
    series.every((entry) => entry.lastValueVisible === false),
    `${indicatorId} still exposes a right-axis price tab`,
  );
  passed += 1;
  console.log(`  ok  ${indicatorId} hides every right-axis price tab`);
}

console.log(`\nVWAP price tabs: ${passed}/${passed} indicator families passed`);

const envelopes = { instanceId: "envelopes", indicatorId: "vwap-envelopes", enabled: true, settings: {} };
const legacy = { ...envelopes, instanceId: "old-vwap", indicatorId: "vwap" };
assert.equal(CHART_INDICATOR_BY_ID.has("vwap"), false);
assert.deepEqual(normalizeStoredIndicatorList([legacy, envelopes]).map(instance => instance.instanceId), ["envelopes"]);
const draw = (settings) => calculateIndicatorSeries(
  normalizeStoredIndicatorList([{ ...envelopes, settings }])[0], candles, theme,
);
const all = draw({});
assert.equal(all.length, 7);
assert.deepEqual(draw({ showVwapLine: false }), all.slice(1), "hiding the center line leaves every band value intact");
assert.deepEqual(draw({ showVwapBands: false }), all.slice(0, 1), "hiding bands leaves the center line intact");
assert.deepEqual(draw({ showVwapLine: false, showVwapBands: false }), []);
assert.deepEqual(draw({ showVwapLine: false, band2Enabled: false }), all.slice(1).filter(series => !series.key.endsWith("-2")));
console.log("VWAP Envelopes visibility and legacy VWAP removal passed.");
