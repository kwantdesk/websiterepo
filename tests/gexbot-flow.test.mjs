import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGexBotFlowPayload,
  detectRestrikes,
  isGexBotFlowRth,
  mergeOneFamilyPositioning,
  nextGexBotFlowBackoffMs,
  sponsorshipVerdict,
} from "../src/lib/gexBotFlow.ts";

function sample({
  timestamp = Date.parse("2026-08-06T14:00:00.000Z"),
  spot = 30_000,
  aggDex = 100_000_000,
  magnet = 30_000,
  accelerator = 29_900,
  majorCall = 30_100,
  majorPut = 29_800,
} = {}) {
  return {
    ticker: "NQ_NDX",
    timestamp,
    spot,
    zcvr: -25_000_000,
    zgr: 44_000_000,
    aggDex,
    aggCallDex: -20_000_000,
    aggPutDex: 12_000_000,
    zcharm: 8_000_000,
    zvanna: 2_000_000,
    magnet,
    accelerator,
    majorCall,
    majorPut,
  };
}

function pushWindow({ dexChange = 8_000_000, rows = 5 } = {}) {
  return Array.from({ length: rows }, (_, index) => sample({
    timestamp: Date.parse("2026-08-06T14:00:00.000Z") + index * 60_000,
    spot: 30_000 + index * 15.5,
    aggDex: 100_000_000 + dexChange * index / Math.max(1, rows - 1),
  }));
}

test("1. four-hour-old frames freeze, disclose freeze time, and never emit a verdict", () => {
  const now = Date.parse("2026-08-06T18:00:00.000Z");
  const old = sample({ timestamp: now - 4 * 60 * 60_000 });
  const payload = buildGexBotFlowPayload({ sample: old, window: pushWindow(), now, marketOpen: true });
  assert.equal(payload.status, "FROZEN");
  assert.equal(payload.sponsorship.active, null);
  assert.equal(payload.freezeTime, new Date(old.timestamp).toISOString());
});

test("2. RTH cadence follows New York time across both DST boundaries", () => {
  assert.equal(isGexBotFlowRth(Date.parse("2026-03-06T14:29:59.000Z")), false);
  assert.equal(isGexBotFlowRth(Date.parse("2026-03-06T14:30:00.000Z")), true);
  assert.equal(isGexBotFlowRth(Date.parse("2026-03-09T13:30:00.000Z")), true);
  assert.equal(isGexBotFlowRth(Date.parse("2026-03-09T20:00:00.000Z")), false);
  assert.equal(isGexBotFlowRth(Date.parse("2026-10-30T19:59:59.000Z")), true);
  assert.equal(isGexBotFlowRth(Date.parse("2026-10-30T20:00:00.000Z")), false);
  assert.equal(isGexBotFlowRth(Date.parse("2026-11-02T14:30:00.000Z")), true);
  assert.equal(isGexBotFlowRth(Date.parse("2026-11-02T21:00:00.000Z")), false);
});

test("3. a funded +0.2% push is sponsored, flat dex is hollow, and thin data warms up", () => {
  assert.equal(sponsorshipVerdict(pushWindow()).state, "SPONSORED");
  assert.equal(sponsorshipVerdict(pushWindow({ dexChange: 0 })).state, "HOLLOW");
  assert.deepEqual(sponsorshipVerdict(pushWindow({ rows: 4 })), { state: "WARMING_UP", active: null });
});

test("4. sponsorship verdict output is byte-deterministic", () => {
  const window = pushWindow();
  assert.equal(JSON.stringify(sponsorshipVerdict(window)), JSON.stringify(sponsorshipVerdict(structuredClone(window))));
});

test("5. a two-interval re-strike emits once and is not repeated", () => {
  const previous = sample({ magnet: 30_000 });
  const current = sample({ timestamp: previous.timestamp + 60_000, magnet: 30_050 });
  const first = detectRestrikes(previous, current, 25);
  assert.equal(first.length, 1);
  assert.match(first[0].label, /map being redrawn — magnet moved 30000 -> 30050/);
  const seen = new Set(first.map((notice) => notice.id));
  assert.deepEqual(detectRestrikes(previous, current, 25, seen), []);
});

test("6. one-family agreement cross-confirms without duplication and disagreement stays contested", () => {
  const base = [{ id: "kwant-magnet", kind: "GAMMA_MAGNET", price: 30_000, label: "Magnet" }];
  const agreeing = mergeOneFamilyPositioning(
    base,
    sample({ magnet: 30_006, accelerator: null, majorCall: null, majorPut: null }),
    10,
    (object, nearest) => ({ ...nearest, id: `gexbot-${object.kind}`, price: object.price, label: "contested" }),
  );
  assert.equal(agreeing.length, 1);
  assert.equal(agreeing[0].crossConfirmed, true);
  assert.equal(agreeing[0].confidenceBoost, 0.05);

  const contested = mergeOneFamilyPositioning(
    base,
    sample({ magnet: 30_025, accelerator: null, majorCall: null, majorPut: null }),
    10,
    (object, nearest) => ({ ...nearest, id: `gexbot-${object.kind}`, price: object.price, label: "GEX Bot magnet · contested" }),
  );
  assert.equal(contested.length, 2);
  assert.equal(contested[0].contested, true);
  assert.equal(contested[1].contested, true);
  assert.equal(contested[0].flowComparison.gexBotPrice, 30_025);
});

test("7. an API failure serves the last good sample as stale and backs off", () => {
  const now = Date.parse("2026-08-06T14:10:00.000Z");
  const lastGood = sample({ timestamp: now - 30_000 });
  const payload = buildGexBotFlowPayload({
    sample: lastGood,
    window: pushWindow(),
    now,
    marketOpen: true,
    requestFailed: true,
    error: "synthetic provider failure",
  });
  assert.equal(payload.status, "STALE");
  assert.equal(payload.sample.spot, lastGood.spot);
  assert.equal(payload.dataAgeMs, 30_000);
  assert.deepEqual([1, 2, 3, 4, 5].map(nextGexBotFlowBackoffMs), [60_000, 120_000, 240_000, 300_000, 300_000]);
});
