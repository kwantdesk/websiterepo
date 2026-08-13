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

test("all native profiles restore only execution-backed snapshots", () => {
  assert.match(workspace, /readCachedInstitutionalVolumeProfiles\(activeRoot, "daily"\)/);
  assert.match(workspace, /readCachedInstitutionalVolumeProfiles\(activeRoot, "weekly"\)/);
  assert.match(workspace, /\|\| profile\.provider === "Chart"/);
  assert.match(chart, /if \(profile\.provider === "Chart"\) return \[\];/);
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
  assert.match(
    workspace,
    /current\.map\(\(profile\) => applyInstitutionalTradesToVolumeProfile\(profile, records\)\)/,
  );
  assert.match(
    marketData,
    /cmeSessionDateKey\(record\.timestamp\) === dailyTradingDate/,
  );
  assert.match(
    marketData,
    /Math\.max\(profile\.endMs, latestTimestamp \+ 1\)/,
  );
});
