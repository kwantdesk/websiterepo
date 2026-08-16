import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adapter = readFileSync(
  new URL("../src/lib/quantData.server.ts", import.meta.url),
  "utf8",
);
const marketIndices = readFileSync(
  new URL("../src/lib/marketIndices.server.ts", import.meta.url),
  "utf8",
);
const chartIntervals = readFileSync(
  new URL("../src/lib/chartIntervals.ts", import.meta.url),
  "utf8",
);

test("every options-underlying minute interval uses bounded market-session requests", () => {
  assert.match(
    adapter,
    /const minuteMatch = timeframe\.match\(\/\^\(\\d\+\)m\$\/\)/,
  );
  assert.match(adapter, /sessionScoped: true/);
  assert.match(adapter, /\[30, 15, 5, 1\]\.find/);
  assert.match(adapter, /sessionDate,\s*aggregationPeriod,\s*filter: \{ ticker: symbol \}/s);
  assert.match(adapter, /weekdaySessionDates\(from, to\)\.map/);
  assert.match(adapter, /Promise\.allSettled/);
  assert.match(adapter, /options-underlying-session-history-v1/);
  assert.match(adapter, /new Map\(candles\.map\(\(candle\) => \[candle\.timestamp, candle\]\)\)/);
});

test("Gamma underlyings expose the complete standard minute menu", () => {
  for (const timeframe of ["1m", "2m", "3m", "5m", "10m", "15m", "30m", "45m"]) {
    assert.match(chartIntervals, new RegExp(`timeOption\\("${timeframe}"`));
  }
  assert.match(chartIntervals, /broker === "Market Index"[\s\S]*value\.match\(\/\^\(\\d\+\)m\$\/\)/);
});

test("options underlyings prefer the shared KwantData history adapter before Massive", () => {
  const preference = marketIndices.indexOf("if (canUseKwantDataHistory)");
  const massiveProbe = marketIndices.indexOf("const { multiplier, timespan }");
  assert.ok(preference >= 0, "KwantData preference branch is missing");
  assert.ok(massiveProbe > preference, "Massive is still queried before KwantData");
});
