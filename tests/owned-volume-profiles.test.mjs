import { test } from "node:test";
import assert from "node:assert/strict";
import { validateOwnedVolumeProfile, loadOwnedVolumeProfiles, developOwnedVolumeProfile } from "../src/lib/ownedVolumeProfiles.ts";
import { profileVariantJob } from "../src/lib/profileVariantJobs.ts";
const start = 1700000000000;
const makeJob = (source = {}, ownerId = "monthly-1") => profileVariantJob({ ownerId, label: "2023-11", range: { startMs: start, endMs: start + 1000 }, source: { symbol: "NQ", contractSymbol: "NQZ3", groupTicks: 1, valueAreaPercent: 68, ...source } });
const snapshot = (overrides = {}) => ({ schemaVersion: "kwantify-volume-profile-v1", provider: "Rithmic", source: "Rithmic Ticker Plant trades", root: "NQ", contractSymbol: "NQZ3", period: "custom", startMs: start, endMs: start + 1000, coverageStartMs: start, coverageEndMs: start + 900, complete: true, tickSize: 0.25, groupTicks: 1, valueAreaPercent: 68, minTradeVolume: 0, maxTradeVolume: 0, totalVolume: 10, askVolume: 7, bidVolume: 3, delta: 4, trades: 2, vwap: 100, standardDeviation: 0, poc: 100, vah: 100, val: 100, developingPoc: [], levels: [{ price: 100, volume: 10, askVolume: 7, bidVolume: 3, delta: 4, trades: 2 }], asOf: new Date(start + 900).toISOString(), ...overrides });
const trade = (offset, volume = 2) => ({ eventId: `t-${offset}`, recordIndex: offset, timestamp: start + offset, open: 100.25, high: 100.25, low: 100.25, close: 100.25, volume, trades: 1, askVolume: volume, bidVolume: 0, delta: volume, aggressor: "BUY" });

test("a validated exact snapshot gets only its requested local owner", () => {
  const incoming = snapshot({ ownerInstanceId: "someone-else" });
  const result = validateOwnedVolumeProfile(makeJob(), incoming);
  assert.equal(result.status, "ready");
  assert.equal(result.profile.ownerInstanceId, "monthly-1");
  assert.equal(incoming.ownerInstanceId, "someone-else");
});

test("incorrect source, contract, settings, coverage and partial data are unavailable", () => {
  for (const change of [
    { root: "ES" }, { contractSymbol: "NQH4" }, { provider: "Chart" }, { source: "OHLCV approximation" },
    { complete: false }, { complete: null }, { complete: undefined }, { groupTicks: 4 }, { valueAreaPercent: 70 },
    { minTradeVolume: 2 }, { startMs: start + 1 }, { endMs: start + 2000 }, { coverageEndMs: start + 1000 },
    { coverageStartMs: start + 999, coverageEndMs: start + 900 }, { coverageEndMs: NaN },
    { totalVolume: 9 }, { delta: 0 }, { trades: 100 }, { poc: NaN }, { tickSize: 0 },
  ]) assert.equal(validateOwnedVolumeProfile(makeJob(), snapshot(change)).status, "unavailable", JSON.stringify(change));
});

test("invalid row totals are rejected without inventing aggressor classifications", () => {
  const original = snapshot();
  for (const change of [{ volume: -1 }, { price: NaN }, { delta: 0 }, { askVolume: 99 }, { trades: -1 }]) {
    assert.equal(validateOwnedVolumeProfile(makeJob(), { ...original, levels: [{ ...original.levels[0], ...change }] }).status, "unavailable");
  }
  // Unclassified genuine volume is valid; bid + ask need not equal total.
  assert.equal(validateOwnedVolumeProfile(makeJob(), snapshot({ totalVolume: 11, levels: [{ ...original.levels[0], volume: 11 }] })).status, "ready");
});

test("unsupported multi-session flags cause no cache or network request", async () => {
  const results = [];
  await loadOwnedVolumeProfiles({ jobs: [makeJob({ filterMode: "filter", filterTime: "rth" })], isCurrent: () => true,
    readCached: async () => assert.fail("must not request wrong window"), readExact: async () => assert.fail("must not request wrong window"), publish: value => results.push(value) });
  assert.equal(results.length, 1);
  assert.equal(results[0].status, "unavailable");
  assert.match(results[0].reason, /disjoint/);
});

test("complete cache publishes immediately; refresh failure is explicit and never removes it", async () => {
  const results = [];
  await loadOwnedVolumeProfiles({ jobs: [makeJob()], isCurrent: () => true, readCached: async () => snapshot(), readExact: async () => { throw new Error("offline"); }, publish: value => results.push(value) });
  assert.deepEqual(results.map(r => r.status), ["ready", "unavailable"]);
  assert.equal(results[0].profile.totalVolume, 10);
});

test("cache exception falls through to exact reader; settings change discards late response", async () => {
  const results = [];
  await loadOwnedVolumeProfiles({ jobs: [makeJob()], isCurrent: () => true, readCached: async () => { throw new Error("storage unavailable"); }, readExact: async () => snapshot(), publish: value => results.push(value) });
  assert.equal(results[0].status, "ready");
  let current = true, finish;
  const late = [];
  const running = loadOwnedVolumeProfiles({ jobs: [makeJob()], isCurrent: () => current, readCached: async () => null, readExact: () => new Promise(resolve => { finish = resolve; }), publish: value => late.push(value) });
  await new Promise(resolve => setImmediate(resolve));
  current = false;
  finish(snapshot());
  await running;
  assert.deepEqual(late, []);
});

test("monthly live fold grows exact data but excludes following month and future replay trades", () => {
  const profile = validateOwnedVolumeProfile(makeJob(), snapshot()).profile;
  const result = developOwnedVolumeProfile({ profile, records: [trade(900), trade(1100), trade(1200), trade(2000)], endBoundaryMs: start + 2000, clockMs: start + 1150 });
  assert.equal(result.totalVolume, 12); // only the real 1100 print
  assert.equal(result.askVolume, 9);
  assert.equal(result.bidVolume, 3);
  assert.equal(result.endMs, start + 1101);
  assert.equal(result.coverageEndMs, start + 1100);
  assert.equal(result.valueAreaPercent, 68);
  assert.equal(profile.totalVolume, 10);
  assert.equal(developOwnedVolumeProfile({ profile: result, records: [trade(1100)], endBoundaryMs: start + 2000, clockMs: start + 1150 }), result);
  assert.equal(developOwnedVolumeProfile({ profile, records: [trade(2000)], endBoundaryMs: start + 2000, clockMs: start + 3000 }), profile);
});
