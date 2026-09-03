import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);
const client = readFileSync(
  new URL("../src/lib/institutionalMarketData.ts", import.meta.url),
  "utf8",
);
const proxy = readFileSync(
  new URL("../src/app/api/institutional-market-data/[...path]/route.ts", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  proxy,
  /buildDatabentoExecutionProfile|executionProfileResponse|vendorMarketDataConfigured\("databento"\)/,
  "the Rithmic profile route must not call the retired Databento provider",
);
assert.match(
  workspace,
  /if \(!includeCompletedProfiles && tradingDate !== currentDailyTradingDate\) return/,
  "recurring reconciliation must not reload every immutable historical session",
);
assert.match(
  workspace,
  /nextCompletedProfilesRefreshAt = Date\.now\(\) \+ 5 \* 60_000/,
  "completed profiles need a bounded recovery cadence",
);
assert.doesNotMatch(
  workspace,
  /currentDailyProfileLoaded \? 15_000 : 2_000/,
  "the two-second fleet-wide retry storm must stay removed",
);
assert.match(
  workspace,
  /currentDailyProfileLoaded \? 60_000 : failureDelay/,
  "successful profile reconciliation must remain low frequency",
);
assert.match(
  client,
  /VOLUME_PROFILE_FAILURE_BACKOFF_BASE_MS = 15_000/,
  "failed request keys need a local negative-cache floor",
);
assert.match(
  client,
  /VOLUME_PROFILE_FAILURE_BACKOFF_MAX_MS = 5 \* 60_000/,
  "failure backoff must be bounded",
);
assert.match(
  client,
  /if \(failed && Date\.now\(\) < failed\.retryAfter\) return null/,
  "duplicate callers must respect the negative cache",
);

console.log("volume profile cost containment: 8/8 checks passed");
