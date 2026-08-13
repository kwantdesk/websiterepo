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

test("daily profiles begin at the true CME session open and remain visible while exact data loads", () => {
  assert.match(workspace, /const sessionWindow = cmeSessionWindowForDate\(tradingDate\)/);
  assert.match(workspace, /startMs: sessionWindow\?\.startMs \?\? sessionCandles\[0\]\.timestamp/);
  assert.match(workspace, /const fallback = provisionalProfiles\.filter[\s\S]*?!exactSessions\.has/);
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

