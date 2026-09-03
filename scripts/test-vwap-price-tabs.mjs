import assert from "node:assert/strict";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";

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
for (const indicatorId of ["vwap", "vwap-envelopes", "rolling-vwap"]) {
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
