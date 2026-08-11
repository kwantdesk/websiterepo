import test from "node:test";
import assert from "node:assert/strict";
import {
  appendClassicGexHistory,
  classicGexMajor,
  classicGexStatus,
  interpolateScenarioZeroGamma,
  mapClassicGexPrice,
  normalizeClassicGexRow,
  selectClassicGexRows,
  shouldPublishClassicGex,
} from "../src/lib/classicGexProfile.ts";

const row = (strike, call, put) => normalizeClassicGexRow({
  strike,
  mappedPrice: strike,
  call,
  put,
});

test("preserves already-scaled magnitudes while enforcing call/put signs", () => {
  const normalized = row(500, -123.5, 456.25);
  assert.equal(normalized.call, 123.5);
  assert.equal(normalized.put, -456.25);
  assert.equal(normalized.net, -332.75);
});

test("switches Volume and Open Interest profiles without merging them", () => {
  const volume = [row(500, 10, 4)];
  const openInterest = [row(500, 40, 12)];
  assert.equal(selectClassicGexRows("VOLUME", volume, openInterest), volume);
  assert.equal(selectClassicGexRows("OPEN_INTEREST", volume, openInterest), openInterest);
});

test("selects the largest positive and most-negative major strikes", () => {
  const rows = [row(100, 12, 2), row(101, 30, 5), row(102, 2, 20)];
  assert.equal(classicGexMajor(rows, "POSITIVE")?.strike, 101);
  assert.equal(classicGexMajor(rows, "NEGATIVE")?.strike, 102);
});

test("interpolates the nearest scenario-profile zero crossing", () => {
  const zero = interpolateScenarioZeroGamma([
    { price: 98, netGex: -20 },
    { price: 100, netGex: -10 },
    { price: 102, netGex: 30 },
    { price: 104, netGex: 60 },
  ], 101);
  assert.equal(zero, 100.5);
});

test("manual price mapping changes price only", () => {
  assert.equal(mapClassicGexPrice(500, { mode: "MANUAL", scale: 41.2, offset: 8 }), 20_608);
});

test("coalesces publishing to no faster than one second", () => {
  assert.equal(shouldPublishClassicGex(null, 1_000, 250), true);
  assert.equal(shouldPublishClassicGex(1_000, 1_999, 250), false);
  assert.equal(shouldPublishClassicGex(1_000, 2_000, 250), true);
});

test("keeps lookback history bounded and monotonic", () => {
  const first = { timestamp: 0, rows: [row(100, 1, 0)] };
  const second = { timestamp: 60_000, rows: [row(100, 2, 0)] };
  const latest = { timestamp: 32 * 60_000, rows: [row(100, 3, 0)] };
  let history = appendClassicGexHistory([], first);
  history = appendClassicGexHistory(history, second);
  history = appendClassicGexHistory(history, latest);
  assert.deepEqual(history.map((snapshot) => snapshot.timestamp), [60_000, 32 * 60_000]);
  assert.equal(appendClassicGexHistory(history, second), history);
});

test("freezes stale data and recovers to live when freshness returns", () => {
  assert.equal(classicGexStatus({ marketOpen: true, providerStale: true, dataAgeMs: 1_000 }), "STALE");
  assert.equal(classicGexStatus({ marketOpen: true, providerStale: false, dataAgeMs: 1_000 }), "LIVE");
  assert.equal(classicGexStatus({ marketOpen: false, providerStale: true, dataAgeMs: 999_999 }), "STALE");
});
