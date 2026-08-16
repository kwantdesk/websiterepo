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

test("1m and 5m underlying history is restored in bounded market-session requests", () => {
  assert.match(
    adapter,
    /UNDERLYING_SESSION_HISTORY_PERIODS = new Set\(\["1m", "5m"\]\)/,
  );
  assert.match(adapter, /sessionDate,\s*aggregationPeriod,\s*filter: \{ ticker: symbol \}/s);
  assert.match(adapter, /weekdaySessionDates\(from, to\)\.map/);
  assert.match(adapter, /Promise\.allSettled/);
  assert.match(adapter, /options-underlying-session-history-v1/);
  assert.match(adapter, /new Map\(candles\.map\(\(candle\) => \[candle\.timestamp, candle\]\)\)/);
});

test("options underlyings prefer the shared KwantData history adapter before Massive", () => {
  const preference = marketIndices.indexOf("if (canUseKwantDataHistory)");
  const massiveProbe = marketIndices.indexOf("const { multiplier, timespan }");
  assert.ok(preference >= 0, "KwantData preference branch is missing");
  assert.ok(massiveProbe > preference, "Massive is still queried before KwantData");
});
