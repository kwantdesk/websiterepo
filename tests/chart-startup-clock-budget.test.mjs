import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";

// Count native ICU allocations, not source-text patterns or a flaky FPS limit.
// Imports may create clocks; processing candles must reuse those same clocks.
const OriginalFormatter = Intl.DateTimeFormat;
let constructions = 0;
Intl.DateTimeFormat = new Proxy(OriginalFormatter, {
  construct(target, args) {
    constructions++;
    return Reflect.construct(target, args);
  },
});
const gamma = await import("../src/lib/chartGammaConversion.ts");
const sweep = await import("../src/lib/liquidityStopSweepDetector.ts");
const sessions = await import("../src/lib/volumeProfileSessions.ts");
const profileValues = await import("../src/lib/deepProfileValues.ts");

test("five-session gamma calibration reuses native clocks across chart panes", () => {
  const bars = Array.from({ length: 6900 }, (_, index) => ({
    timestamp: Date.parse("2026-10-12T00:00:00Z") + index * 60_000,
    open: 100, high: 102, low: 99, close: 101,
  }));
  const before = constructions;
  const start = performance.now();
  for (let pane = 0; pane < 6; pane++) {
    assert.equal(gamma.findCashCloseFuturesCandle(bars, "2026-10-15")?.timestamp,
      Date.parse("2026-10-15T19:59:00Z"));
    assert.equal(gamma.findGammaSessionAnchor(bars, "2026-10-15"),
      Date.parse("2026-10-15T13:30:00Z"));
  }
  assert.equal(constructions - before, 0, "No per-candle ICU allocation");
  console.log(`Six gamma panes / 6,900 bars: ${Math.round(performance.now() - start)}ms`);
});

test("session clocks retain exact DST, date and overnight-end semantics", () => {
  const before = constructions;
  for (const [close, date] of [
    ["2026-10-30T19:59:00Z", "2026-10-30"],
    ["2026-11-02T20:59:00Z", "2026-11-02"],
  ]) {
    const candle = { timestamp: Date.parse(close), open: 100, high: 102, low: 99, close: 101 };
    assert.equal(gamma.findCashCloseFuturesCandle([candle], date), candle);
    assert.equal(gamma.findCashCloseFuturesCandle([candle], "2026-10-01"), null);
  }
  const segment = { startMs: Date.parse("2026-10-12T22:00:00Z"), endMs: Date.parse("2026-10-13T07:00:00Z") };
  for (let pass = 0; pass < 1000; pass++) {
    assert.equal(sessions.sessionTradingDate(segment, false), "2026-10-12");
    assert.equal(sessions.sessionTradingDate(segment, true), "2026-10-13");
  }
  assert.equal(constructions, before);
});

test("sweep reference restoration never constructs a formatter per candle", () => {
  const candles = Array.from({ length: 4000 }, (_, index) => ({
    timestamp: Date.parse("2026-10-12T00:00:00Z") + index * 60_000,
    open: 100, high: 102, low: 99, close: 101,
  }));
  const before = constructions;
  const first = sweep.buildSweepReferencesFromCandles(candles, 0.25);
  assert.ok(first.length > 0);
  assert.deepEqual(sweep.buildSweepReferencesFromCandles(candles, 0.25), first);
  assert.equal(constructions, before);
});

test("weekly and monthly Profile Values reuse clocks and preserve exact volume", () => {
  const bars = Array.from({ length: 3000 }, (_, index) => {
    const timestamp = Date.parse("2026-10-12T00:00:00Z") + index * 60_000;
    return { timestamp, startTime: timestamp, endTime: timestamp + 60_000,
      open: 100, high: 100, low: 100, close: 100, totalVolume: 5,
      hasPriceLevelFlow: true, isClosed: true,
      rows: [{ tickIndex: 100, price: 100, bidVolume: 2, askVolume: 3,
        unknownVolume: 0, bidTrades: 1, askTrades: 1, unknownTrades: 0 }] };
  });
  const before = constructions;
  for (const lengthType of ["weeks", "months"]) {
    const result = profileValues.buildDeepProfileValuesFrame(bars, "NQ", "NQZ6", 1, {
      periodMode: "multiples", lengthType, lengthValue: 1,
      groupingMode: "manual", groupTicks: 1,
    });
    assert.equal(result.status, "HISTORICAL");
    assert.equal(result.profiles.reduce((sum, profile) => sum + profile.totalVolume, 0), 15000);
  }
  assert.equal(constructions, before);
});

test("existing Profile Values math and settings regressions still pass", async () => {
  const before = constructions;
  await import("../scripts/test-deep-profile-values.mjs");
  // The fixture imports configuration modules that own a few additional shared
  // clocks. Neither fixture processing nor settings normalization may create
  // a formatter per historical bar.
  assert.ok(constructions - before < 20, `Unexpected clock allocations: ${constructions - before}`);
});

test.after(() => { Intl.DateTimeFormat = OriginalFormatter; });
