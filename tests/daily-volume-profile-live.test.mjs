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
const marketDataSource = readFileSync(
  new URL("../src/lib/institutionalMarketData.ts", import.meta.url),
  "utf8",
);

test("all native profiles restore only execution-backed snapshots", () => {
  assert.match(workspace, /readCachedInstitutionalVolumeProfiles\(activeRoot, "daily"\)/);
  assert.match(workspace, /readCachedInstitutionalVolumeProfiles\(activeRoot, "weekly"\)/);
  assert.match(workspace, /!isExecutionBackedVolumeProfile\(profile\)/);
  assert.match(chart, /if \(!isExecutionBackedVolumeProfile\(profile\)\) return \[\];/);
  assert.match(marketDataSource, /profile\.provider !== "Databento" && profile\.provider !== "Rithmic"/);
  assert.match(marketDataSource, /OHLCV\|APPROX/);
});

test("cached profiles must match the active contract and exact profile configuration", () => {
  assert.match(workspace, /normalizedContractSymbol/);
  assert.match(workspace, /profile\.contractSymbol\.toUpperCase\(\)\.replace/);
  assert.match(workspace, /profile\.groupTicks !== expectedGroupTicks/);
  assert.match(workspace, /profile\.minTradeVolume !== expectedMinVolume/);
  assert.match(workspace, /profile\.maxTradeVolume !== expectedMaxVolume/);
  assert.match(workspace, /profileGroups\.flat\(\)\.filter\(matchesRequestedProfile\)/);
});

test("the deprecated candle proxy cannot enter profile state or canvas output", () => {
  assert.doesNotMatch(workspace, /const provisionalProfiles/);
  assert.doesNotMatch(workspace, /mergeInstitutionalVolumeProfiles/);
  assert.doesNotMatch(workspace, /buildChartVolumeProfile/);
  assert.doesNotMatch(
    readFileSync(new URL("../src/lib/nativeVolumeProfilePrimitive.ts", import.meta.url), "utf8"),
    /APPROX[^\n]*OHLCV/,
  );
});

test("the active daily profile develops from live executions without crossing sessions", () => {
  assert.match(workspace, /dates\.add\(currentDailyTradingDate\)/);
  assert.match(workspace, /\[candles, currentDailyTradingDate\]/);
  assert.match(workspace, /queueProfileUpdate\(records\);[\s\S]*if \(needsOrderFlowHistory\)/);
  assert.match(workspace, /currentDailyProfileLoaded \? 15_000 : 2_000/);
  assert.match(
    workspace,
    /current\.map\(\(profile\) => applyInstitutionalTradesToVolumeProfile\(profile, batch\)\)/,
  );
  assert.match(workspace, /queueProfileUpdate\(records\)/);
  assert.match(
    marketData,
    /cmeSessionDateKey\(record\.timestamp\) === dailyTradingDate/,
  );
  assert.match(
    marketData,
    /Math\.max\(profile\.endMs, latestTimestamp \+ 1\)/,
  );
});

test("the active weekly profile develops immediately instead of waiting for snapshot refresh", () => {
  assert.match(
    workspace,
    /cachedExact = profileGroups\.flat\(\)[\s\S]*?\.map\(\(profile\) => applyInstitutionalTradesToVolumeProfile\([\s\S]*?latestMarketTradesRef\.current/,
  );
  assert.match(marketData, /const weeklyTradingWeek = profile\.period === "weekly"/);
  assert.match(
    marketData,
    /profile\.period === "weekly"[\s\S]*?cmeTradingWeekKey\(record\.timestamp\) === weeklyTradingWeek/,
  );
  assert.match(
    marketData,
    /profile\.period === "daily" \|\| profile\.period === "weekly"[\s\S]*?Math\.max\(profile\.endMs, latestTimestamp \+ 1\)/,
  );
});
