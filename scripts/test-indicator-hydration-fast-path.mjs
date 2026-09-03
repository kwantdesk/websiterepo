import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let keysCalls = 0;
let matchCalls = 0;
const profile = {
  schemaVersion: "kwantify-volume-profile-v1",
  provider: "Rithmic",
  complete: true,
  source: "Rithmic executions",
  root: "NQ",
  contractSymbol: "NQU6",
  period: "daily",
  tradingDate: "2026-09-03",
  startMs: 1_000,
  endMs: 2_000,
  coverageEndMs: 1_999,
  tickSize: 0.25,
  groupTicks: 1,
  minTradeVolume: 0,
  maxTradeVolume: 0,
  valueAreaPercent: 68,
  levels: [{ price: 29_000, volume: 1, bidVolume: 0, askVolume: 1, delta: 1 }],
  poc: 29_000,
  vah: 29_000,
  val: 29_000,
  vwap: 29_000,
  standardDeviation: 0,
  developingPoc: [],
};

globalThis.window = {
  location: { origin: "https://www.kwantdesk.com" },
  caches: {
    open: async () => ({
      keys: async () => { keysCalls += 1; return []; },
      match: async () => {
        matchCalls += 1;
        return new Response(JSON.stringify({ storedAt: Date.now(), value: profile }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      delete: async () => true,
    }),
  },
  setTimeout,
  clearTimeout,
};

const { readCachedInstitutionalVolumeProfile } = await import("../src/lib/institutionalMarketData.ts");

const restored = await readCachedInstitutionalVolumeProfile({
  symbol: "NQ",
  contractSymbol: "NQU6",
  period: "daily",
  tradingDate: "2026-09-03",
  groupTicks: 1,
  valueAreaPercent: 68,
  minTradeVolume: 0,
  maxTradeVolume: 0,
  filterMode: "none",
  filterTime: "rth",
  sessionStartMinutes: 510,
  sessionEndMinutes: 915,
});

assert.equal(restored?.contractSymbol, "NQU6");
assert.equal(matchCalls, 1, "the exact profile should require one keyed cache match");
assert.equal(keysCalls, 0, "chart hydration must never enumerate the whole indicator cache");

const workspace = readFileSync("src/components/KwantifyWorkspace.tsx", "utf8");
assert.match(
  workspace,
  /\[\.\.\.tradingDates\]\.reverse\(\)\.forEach/,
  "the current trading date must be scheduled before historical dates",
);
assert.ok(
  workspace.indexOf("await readCachedInstitutionalVolumeProfile(requestArgs)")
    < workspace.indexOf("await fetchInstitutionalVolumeProfile(requestArgs)"),
  "the exact cached profile must paint before authoritative network reconciliation",
);
assert.doesNotMatch(
  workspace,
  /readCachedInstitutionalVolumeProfiles/,
  "the chart startup path must not return to all-profile cache enumeration",
);

console.log("indicator hydration fast path: 6/6 checks passed");
