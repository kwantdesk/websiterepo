import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planVolumeProfileVariantJobs } from "../src/lib/volumeProfileVariants.ts";
import { mergeOwnedVolumeProfile } from "../src/lib/ownedVolumeProfiles.ts";

const clockMs = Date.parse("2026-10-19T03:00:00Z");
const instance = settings => ({ instanceId: "sessions", indicatorId: "session-volume-profile", enabled: true,
  settings: { filterMode: "triple", numberOfProfiles: 1, ...settings } });
const plan = (settings = {}, overrides = {}) => planVolumeProfileVariantJobs({
  candles: [], clockMs, symbol: "NQ", contractSymbol: "NQZ6", intervalMs: 60_000,
  visibleLogicalRange: null, instances: [instance(settings)], ...overrides,
});

test("Globex-open Asia plans without waiting for candle backfill", () => {
  const jobs = plan();
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].label, /2026-10-19 · Asia/);
  assert.equal(jobs[0].startMs, Date.parse("2026-10-18T22:00:00Z"));
  assert.equal(jobs[0].endMs, Date.parse("2026-10-19T07:00:00Z"));
  assert.equal(jobs[0].request.filterMode, "none");
});

test("enabled London appears only after its open; disabled Asia/NY do not leak", () => {
  const settings = { sessionAsiaEnabled: false, sessionLondonEnabled: true, sessionNewYorkEnabled: false };
  assert.equal(plan(settings).length, 0);
  const jobs = plan(settings, { clockMs: Date.parse("2026-10-19T08:00:00Z") });
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].label, /London/);
  assert.equal(jobs[0].startMs, Date.parse("2026-10-19T07:00:00Z"));
});

test("developing session cache identity remains stable across live clock updates", () => {
  assert.equal(plan()[0].key, plan({}, { clockMs: clockMs + 60_000 })[0].key);
});

test("unfiltered session study does not silently revert to RTH", () => {
  const jobs = plan({ filterMode: "none" });
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].label, /Whole session/);
  assert.equal(jobs[0].startMs, Date.parse("2026-10-18T22:00:00Z"));
});

test("Asia session boundaries follow Chicago daylight and standard time", () => {
  const jobs = plan({}, { clockMs: Date.parse("2026-11-09T03:00:00Z") });
  assert.equal(jobs[0].startMs, Date.parse("2026-11-08T23:00:00Z"));
  assert.equal(jobs[0].endMs, Date.parse("2026-11-09T08:00:00Z"));
});

const ready = job => ({ status: "ready", job, profile: {
  ownerInstanceId: job.ownerId, startMs: job.startMs, endMs: job.endMs, root: "NQ", contractSymbol: "NQZ6",
} });

test("all three sibling profiles survive cache/network arrivals in any order", () => {
  const jobs = plan({}, { clockMs: Date.parse("2026-10-19T15:00:00Z") });
  assert.equal(jobs.length, 3);
  for (const order of [jobs, [...jobs].reverse(), [jobs[1], jobs[2], jobs[0]]]) {
    let profiles = {};
    for (const job of order) profiles = mergeOwnedVolumeProfile(profiles, ready(job), jobs);
    assert.equal(Object.keys(profiles).length, 3);
    profiles = mergeOwnedVolumeProfile(profiles, ready(order[0]), jobs);
    assert.equal(Object.keys(profiles).length, 3);
  }
});

test("same-window replacements replace only themselves; retired windows and owners stay isolated", () => {
  const jobs = plan({}, { clockMs: Date.parse("2026-10-19T15:00:00Z") });
  const other = { ...ready(jobs[0]).profile, ownerInstanceId: "other" };
  const current = { other, old: ready(jobs[0]).profile, sibling: ready(jobs[1]).profile };
  const changed = { ...jobs[0], key: "changed-settings" };
  const next = mergeOwnedVolumeProfile(current, ready(changed), jobs);
  assert.equal(next.old, undefined);
  assert.equal(next.other, other);
  assert.ok(next.sibling);
  assert.equal(Object.keys(mergeOwnedVolumeProfile(next, ready(changed), [changed])).length, 2);
});

test("chart uses sibling-aware publication and standard daily requests skip unopened sessions", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /setOwnedVariantProfiles\(\(profiles\) => mergeOwnedVolumeProfile\(profiles, result, jobs\)\)/);
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /if \(job.startMs !== undefined && job.startMs >= Date.now\(\)\) return;/);
});
