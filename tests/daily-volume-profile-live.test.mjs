import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);
const marketData = readFileSync(
  new URL("../src/lib/institutionalMarketData.ts", import.meta.url),
  "utf8",
);
const chart = readFileSync(
  new URL("../src/components/Chart.tsx", import.meta.url),
  "utf8",
);

test("daily profiles begin at the true CME session open", () => {
  assert.match(workspace, /const sessionWindow = cmeSessionWindowForDate\(tradingDate\)/);
  assert.match(workspace, /startMs: sessionWindow\?\.startMs \?\? sessionCandles\[0\]\.timestamp/);
});

test("delta and ask-bid profiles never render the deprecated OHLCV fallback", () => {
  assert.match(workspace, /const dailyProfileRequiresExactTape = Boolean/);
  assert.match(workspace, /\(!dailyProfileRequiresExactTape \|\| profile\.period !== "daily"\)/);
  assert.match(workspace, /readCachedInstitutionalVolumeProfiles\(activeRoot, "daily"\)/);
  assert.match(workspace, /&& !dailyProfileRequiresExactTape[\s\S]*&& Number\.isFinite\(coverageStartMs\)/);
  assert.match(chart, /if \(exactTapeRequired && profile\.provider === "Chart"\) return \[\];/);
});

test("ordinary structural profiles may retain a temporary candle fallback", () => {
  assert.match(workspace, /const fallback = provisionalProfiles\.filter/);
  assert.match(workspace, /return \[\.\.\.exact, \.\.\.fallback\]\.sort/);
});

test("the active daily profile develops from live executions without crossing sessions", () => {
  assert.match(
    workspace,
    /current\.map\(\(profile\) => applyInstitutionalTradesToVolumeProfile\(profile, records\)\)/,
  );
  assert.match(workspace, /coverageEndMs: Math\.min\(Date\.now\(\), profile\.endMs - 1\)/);
  assert.match(
    marketData,
    /cmeSessionDateKey\(record\.timestamp\) === dailyTradingDate/,
  );
  assert.match(
    marketData,
    /Math\.max\(profile\.endMs, latestTimestamp \+ 1\)/,
  );
});
