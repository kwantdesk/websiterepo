import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const start = source.indexOf("    const refreshExactProfiles = async");
const end = source.indexOf("\n    void refreshExactProfiles(true);", start);
const refreshCode = ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2022 });

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture(clock = "2026-11-12T00:30:00Z") {
  const dates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"];
  const windows = new Map(dates.map((date) => [date, {
    id: "newyork", label: "New York",
    startMs: Date.parse(date + "T14:30:00Z"), endMs: Date.parse(date + "T21:00:00Z"),
  }]));
  const fetches = [], cached = new Map(), pending = new Map(), paints = [], timers = [];
  const refresh = runInNewContext(
    refreshCode + "\nrefreshExactProfiles",
    {
      tradingDates: dates, currentDailyTradingDate: dates.at(-1),
      sessionFilterModeFor: () => "triple", dailySessionSplitsFor: () => true,
      sessionSegmentsForTradingDate: (date) => [windows.get(date)],
      dailyProfileInstance: { instanceId: "daily" }, dailyProfileSettings: {},
      weeklyProfileInstance: null, compositeProfileInstance: null,
      activeRoot: "NQ", resolvedContractSymbol: "NQZ6", requestedDailyGroupTicks: 1,
      requestedDailyMinVolume: 0, requestedDailyMaxVolume: 0,
      RTH_START_MINUTES: 510, RTH_END_MINUTES: 915, STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT: 68,
      sessionFilterTimeFor: () => "rth", replayProfileClockMs: null,
      cancelled: false, consecutiveCurrentProfileFailures: 0, nextCompletedProfilesRefreshAt: Infinity,
      readyCompletedDailyProfiles: new Set(),
      Date: { now: () => Date.parse(clock) },
      setVolumeProfiles() {}, setDailyProfileFailure() {},
      window: { setTimeout: (callback, delay) => timers.push({callback, delay}) },
      replaceExactProfile: (profile) => { if (profile) paints.push(profile); return Boolean(profile); },
      readCachedInstitutionalVolumeProfile: ({startMs}) => {
        if (!cached.has(startMs)) cached.set(startMs, deferred());
        return cached.get(startMs).promise;
      },
      fetchInstitutionalVolumeProfile: ({startMs}) => {
        fetches.push(startMs);
        if (!pending.has(startMs)) pending.set(startMs, deferred());
        return pending.get(startMs).promise;
      },
    },
  );
  return {refresh, fetches, cached, pending, paints, timers, windows};
}

test("before today's New York open, yesterday's profile starts before older dates or browser storage", async () => {
  const f = fixture();
  const recent = f.windows.get("2026-11-11").startMs;
  const refresh = f.refresh(true);
  assert.deepEqual(f.fetches, [recent]);
  f.pending.get(recent).resolve({version:"network"});
  await refresh;
  assert.deepEqual(f.fetches, [recent, f.windows.get("2026-11-10").startMs, f.windows.get("2026-11-09").startMs]);
  f.cached.get(recent).resolve({version:"cache"});
  await Promise.resolve();
  assert.deepEqual(f.paints.map((profile) => [profile.tradingDate,profile.sessionId,profile.version]), [
    ["2026-11-11","newyork","network"],
  ]);
});

test("a missing latest New York profile retries before the older requests settle", async () => {
  const f = fixture();
  const recent = f.windows.get("2026-11-11").startMs;
  const refresh = f.refresh(true);
  f.cached.get(recent).resolve({version:"cache"});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.paints[0].version, "cache");
  f.pending.get(recent).resolve(null);
  await refresh;
  assert.equal(f.timers[0].delay, 15_000);
  f.timers[0].callback();
  assert.equal(f.fetches.length, 4);
  assert.equal(f.fetches.at(-1), recent);
});

test("after the New York open, today's profile gets the first request", async () => {
  const f = fixture("2026-11-12T14:31:00Z");
  const today = f.windows.get("2026-11-12").startMs;
  const refresh = f.refresh(true);
  assert.deepEqual(f.fetches, [today]);
  f.pending.get(today).resolve({version:"network"});
  await refresh;
  assert.equal(f.paints[0].tradingDate, "2026-11-12");
  assert.equal(f.timers[0].delay, 60_000);
});
