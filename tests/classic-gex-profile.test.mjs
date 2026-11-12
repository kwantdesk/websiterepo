import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
import {
  appendClassicGexHistory,
  classicGexBarWidth,
  classicGexLadderGeometry,
  classicGexLookbacks,
  classicGexMajor,
  classicGexNativeMajors,
  classicGexObservedVolumes,
  classicGexRefreshDelay,
  classicGexRequest,
  classicGexSupportsInstrument,
  isClassicGexResponse,
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

test("only the matching futures charts can activate Classic GEX", () => {
  for (const instrument of ["NQ", "NQZ6", "NQ.c.0", "MNQZ6"]) assert.equal(classicGexSupportsInstrument(instrument, "Databento"), true);
  for (const instrument of ["ES", "MES", "NDX", "QQQ", "M2K", "GC"]) assert.equal(classicGexSupportsInstrument(instrument, "Databento"), false);
  assert.equal(classicGexSupportsInstrument("NQ", "Market Index"), false);
});

test("Classic requests ignore style changes and dormant manual mapping settings", () => {
  const base = { mappingSource: "NDX", expiry: "NEXT_EXPIRY", profileSource: "OPEN_INTEREST", manualMultiplier: 44 };
  assert.equal(classicGexRequest(base), classicGexRequest({ ...base, contrast: 20, showLabels: false, manualMultiplier: 11, refreshIntervalMs: 5000 }));
  const automatic = new URLSearchParams(classicGexRequest(base));
  assert.equal(automatic.get("source"), "NDX");
  assert.equal(automatic.get("multiplier"), null);
  const manual = new URLSearchParams(classicGexRequest({ ...base, mappingMode: "MANUAL", premiumOffset: -5 }));
  assert.equal(manual.get("multiplier"), "44");
  assert.equal(manual.get("offset"), "-5");
  assert.equal(classicGexRefreshDelay(1000, 31_000), 31_000);
  assert.equal(classicGexRefreshDelay(9000, 5000), 9000);
  assert.equal(classicGexRefreshDelay(NaN, NaN), 1000);
});

test("a mismatched source, expiry, profile type or manual price map cannot paint", () => {
  const query = new URLSearchParams(classicGexRequest({
    mappingSource: "NDX", expiry: "NEXT_EXPIRY", profileSource: "OPEN_INTEREST", mappingMode: "MANUAL", manualMultiplier: 2, premiumOffset: 5,
  }));
  const payload = {
    instrument: "NQ", sourceSymbol: "NDX", expiry: "NEXT_EXPIRY", profileSource: "OPEN_INTEREST",
    mapping: { mode: "MANUAL", scale: 2, offset: 5 }, asOf: "2026-11-11T15:30:00Z", rows: [], majors: {},
  };
  assert.equal(isClassicGexResponse(payload, query), true);
  for (const override of [{ sourceSymbol: "QQQ" }, { expiry: "ALL" }, { profileSource: "VOLUME" }, { mapping: { ...payload.mapping, offset: 9 } }]) {
    assert.equal(isClassicGexResponse({ ...payload, ...override }, query), false);
  }
});

test("lookbacks include ten minutes, pick a causal snapshot and leave a gap when missing", () => {
  const history = [0, 10, 20, 24, 28, 29, 31].map(minute => ({ timestamp: minute * 60_000, rows: [] }));
  const lookbacks = classicGexLookbacks(history, 30 * 60_000 + 15_000);
  assert.deepEqual(lookbacks.map(({ minutes }) => minutes), [1, 5, 10, 30]);
  assert.deepEqual(lookbacks.map(({ snapshot }) => snapshot.timestamp / 60_000), [29, 24, 20, 0]);
  assert.equal(classicGexLookbacks(history, NaN).length, 0);
});

test("observed session counts deduplicate repeated snapshots and add distinct expiries", () => {
  const sample = (expirationDate, contractType, volume, strikePrice = 500) => ({ expirationDate, contractType, volume, strikePrice });
  const rows = [
    sample("2026-11-11", "CALL", 18), sample("2026-11-11", "CALL", 14), sample("2026-11-12", "CALL", 25),
    sample("2026-11-11", "PUT", 4), sample("2026-11-12", "PUT", 9), sample(null, "CALL", 50),
    sample("2026-11-11", "CALL", 3, 505),
  ];
  assert.deepEqual([...classicGexObservedVolumes(rows)], [[500, { call: 43, put: 13 }], [505, { call: 3 }]]);
});

test("native NQ/NDX 0DTE majors never replace a different expiry, instrument or price mapping", () => {
  const profile = { sourceSymbol: "NDX", expiry: "ZERO_DTE", mapping: { mode: "AUTO" }, status: "LIVE", sessionDate: "2026-11-11" };
  const flow = { ticker: "NQ_NDX", status: "LIVE", majors: { fetchedAtMs: Date.parse("2026-11-11T15:31:00Z"), volPositive: 28000 } };
  assert.equal(classicGexNativeMajors("NQZ6", profile, flow), flow.majors);
  assert.equal(classicGexNativeMajors("MNQZ6", profile, flow), null);
  for (const override of [{ sourceSymbol: "QQQ" }, { expiry: "NEXT_EXPIRY" }, { expiry: "ALL" }, { mapping: { mode: "MANUAL" } }, { status: "STALE" }, { sessionDate: "2026-11-10" }]) {
    assert.equal(classicGexNativeMajors("NQZ6", { ...profile, ...override }, flow), null);
  }
});

test("the workspace profile effect observes cadence and ignores an in-flight response after replay starts", async () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const start = workspace.indexOf("  useEffect(() => {" + "\n    setClassicGexState(null);");
  const end = workspace.indexOf("\n  useEffect(() => {", start + 1);
  assert.ok(start >= 0 && end > start);
  const effectSource = ts.transpileModule(workspace.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const request = classicGexRequest({ profileSource: "OPEN_INTEREST" });
  const scoped = "NQ|NQZ6|" + request;
  const payload = {
    instrument: "NQ", sourceSymbol: "QQQ", expiry: "ZERO_DTE", profileSource: "OPEN_INTEREST",
    mapping: { mode: "AUTO", scale: 40, offset: 0 }, asOf: "2026-11-11T15:30:00Z", refreshAfterMs: 31_000, rows: [], majors: {},
  };
  const timers = new Map();
  let timerId = 0, profile, cleanup, finish, requests = 0;
  const settings = {
    classicGexLive: true, classicGexScope: scoped, classicGexSettingsSignature: request, classicGexRefreshRef: { current: 1000 },
    classicGexHistoryRef: { current: [] }, latestFuturesRef: { current: { price: 28000 } },
    setClassicGexState: value => { profile = typeof value === "function" ? value(profile) : value; },
    setClassicGexHistory() {}, setClassicGexError() {}, setClassicGexLoading() {},
    window: {
      setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    document: { visibilityState: "visible" },
    useEffect(callback) { cleanup = callback(); },
    fetchWorkspaceData(key, url, options) {
      requests += 1;
      assert.ok(key.endsWith("futuresPrice=28000"));
      assert.equal(key.slice("classic-gex:".length), url.split("?")[1]);
      assert.equal(options.validate(payload), true);
      return new Promise(resolve => { finish = resolve; });
    },
    isClassicGexResponse, classicGexRefreshDelay, appendClassicGexHistory, shouldPublishClassicGex,
  };
  const render = () => new Function(...Object.keys(settings), effectSource)(...Object.values(settings));
  const runTimer = () => {
    const [id, timer] = timers.entries().next().value;
    timers.delete(id);
    timer.fn();
  };
  render();
  assert.equal(timers.values().next().value.ms, 20);
  runTimer();
  finish(payload);
  await new Promise(setImmediate);
  assert.equal(profile.scope, scoped);
  assert.equal(timers.values().next().value.ms, 31_000);
  runTimer();
  cleanup();
  settings.classicGexLive = false;
  render();
  finish(payload);
  await new Promise(setImmediate);
  assert.equal(profile, null);
  assert.equal(timers.size, 0);
  assert.equal(requests, 2);
});

test("the Classic width slider changes the ladder on a narrow pane and caps the minimum bar", () => {
  const tight = classicGexLadderGeometry(250, 8, true);
  const wide = classicGexLadderGeometry(250, 45, true);
  assert.deepEqual(tight, { halfWidth: 10, spineX: 235 });
  assert.deepEqual(wide, { halfWidth: 56.25, spineX: 188.75 });
  assert.deepEqual(classicGexLadderGeometry(250, 8, false), { halfWidth: 10, spineX: 15 });
  assert.equal(classicGexBarWidth(1, 100, tight.halfWidth, 20, false), 10);
  assert.ok(classicGexBarWidth(5, 100, wide.halfWidth, 1, true) > classicGexBarWidth(5, 100, wide.halfWidth, 1, false));
});
