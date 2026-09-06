import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyProfileRanges, visibleProfileRange, profileVariantJob, runProfileVariantJobs } from "../src/lib/profileVariantJobs.ts";
const ms = value => Date.parse(value);
const iso = value => new Date(value).toISOString();
const makeJob = (ownerId, settings = {}) => profileVariantJob({ ownerId, label: ownerId, range: { startMs: 100, endMs: 200 }, source: { symbol: "NQ", contractSymbol: "NQU6", ...settings } });

test("monthly windows use trading months, not loaded days or 30-day subtraction", () => {
  const ranges = monthlyProfileRanges(ms("2026-03-20T12:00:00Z"), 3);
  assert.deepEqual(ranges.map(r => r.label), ["2026-03", "2026-02", "2026-01"]);
  assert.equal(iso(ranges[0].startMs), "2026-03-01T23:00:00.000Z"); // Sunday before Monday March 2
  assert.equal(iso(ranges[0].endMs), "2026-03-20T12:00:00.000Z");
  assert.equal(ranges[1].endMs, ranges[0].startMs);
  assert.equal(iso(monthlyProfileRanges(ms("2026-04-10T12:00:00Z"))[0].startMs), "2026-03-31T22:00:00.000Z");
});

test("month roll, leap year, previous selection and replay clock cannot leak future periods", () => {
  const before = monthlyProfileRanges(ms("2026-03-01T22:59:59Z"));
  assert.equal(before[0].label, "2026-02");
  const after = monthlyProfileRanges(ms("2026-03-01T23:00:00.001Z"));
  assert.equal(after[0].label, "2026-03");
  assert.equal(after[0].endMs - after[0].startMs, 1);
  const prior = monthlyProfileRanges(ms("2024-03-08T12:00:00Z"), 1, true)[0];
  assert.equal(prior.label, "2024-02");
  assert.equal(iso(prior.endMs), "2024-02-29T23:00:00.000Z");
  assert.deepEqual(monthlyProfileRanges(NaN), []);
  assert.equal(monthlyProfileRanges(ms("2026-09-06"), 1e8).length, 120);
});

test("visible logical bounds preserve duplicate-second execution bars and inclusive execution tails", () => {
  const candles = [{ timestamp: 1000, sourceStartTimestamp: 1001, sourceEndTimestamp: 1020 }, { timestamp: 1001, sourceStartTimestamp: 1021, sourceEndTimestamp: 1050 }, { timestamp: 1002, sourceStartTimestamp: 1051, sourceEndTimestamp: 1090 }];
  const args = { candles, from: 1, to: 1, intervalMs: null, clockMs: 1080 };
  assert.deepEqual(visibleProfileRange(args), { startMs: 1021, endMs: 1051 });
  assert.deepEqual(visibleProfileRange({ ...args, to: 2 }), { startMs: 1021, endMs: 1080 });
  assert.equal(visibleProfileRange({ ...args, from: 8, to: 9 }), null);
  assert.equal(visibleProfileRange({ ...args, from: -3, to: -1 }), null);
  assert.equal(visibleProfileRange({ ...args, clockMs: 1000 }), null);
});

test("time bars use their duration but event bars never invent a minute", () => {
  const candles = [{ timestamp: 1000 }, { timestamp: 1100 }];
  assert.deepEqual(visibleProfileRange({ candles, from: 0, to: 0, intervalMs: 60, clockMs: 1200 }), { startMs: 1000, endMs: 1060 });
  assert.deepEqual(visibleProfileRange({ candles, from: 0, to: 0, intervalMs: null, clockMs: 1200 }), { startMs: 1000, endMs: 1100 });
});

test("timestamp-only requests refuse a trade shared across visible and invisible volume bars", () => {
  const candles = [{ timestamp: 1000, sourceStartTimestamp: 900, sourceEndTimestamp: 1000 }, { timestamp: 1001, sourceStartTimestamp: 1000, sourceEndTimestamp: 1100 }];
  const args = { candles, intervalMs: null, clockMs: 1200 };
  assert.equal(visibleProfileRange({ ...args, from: 0, to: 0 }), null);
  assert.equal(visibleProfileRange({ ...args, from: 1, to: 1 }), null);
  assert.deepEqual(visibleProfileRange({ ...args, from: 0, to: 1 }), { startMs: 900, endMs: 1101 });
});

test("same custom period cannot steal another instance's settings or request identity", () => {
  const monthly = makeJob("monthly", { valueAreaPercent: 68, groupTicks: 4 });
  const visible = makeJob("visible", { valueAreaPercent: 70, groupTicks: 1 });
  assert.notEqual(monthly.key, visible.key);
  assert.equal(monthly.request.valueAreaPercent, 68);
  assert.equal(monthly.request.period, "custom");
  assert.equal(makeJob("monthly", { groupTicks: 4, valueAreaPercent: 68 }).key, monthly.key);
  assert.notEqual(makeJob("monthly", { contractSymbol: "NQZ6" }).key, monthly.key);
  assert.throws(() => profileVariantJob({ ownerId: "a", range: { startMs: 2, endMs: 1 }, source: { symbol: "NQ" } }));
});

test("batch concurrency is bounded and changed view suppresses stale results and queued requests", async () => {
  let active = 0, peak = 0, current = true;
  const waiting = [], published = [];
  const jobs = Array.from({ length: 10 }, (_, i) => makeJob(String(i)));
  const running = runProfileVariantJobs({ jobs, isCurrent: () => current,
    read: () => { active++; peak = Math.max(peak, active); return new Promise(resolve => waiting.push(() => { active--; resolve("data"); })); },
    publish: (job, value) => published.push([job.ownerId, value]), failed: () => assert.fail("unexpected failure") });
  assert.equal(waiting.length, 2);
  current = false;
  waiting.forEach(resolve => resolve());
  await running;
  assert.equal(peak, 2);
  assert.equal(waiting.length, 2);
  assert.deepEqual(published, []);
});

test("one unavailable profile does not abort the other owned profiles", async () => {
  const published = [], failed = [];
  await runProfileVariantJobs({ jobs: [makeJob("a"), makeJob("b"), makeJob("c")], isCurrent: () => true,
    read: async job => { if (job.ownerId === "b") throw new Error("unavailable"); return job.ownerId; },
    publish: (job, value) => published.push([job.ownerId, value]), failed: job => failed.push(job.ownerId) });
  assert.deepEqual(published.sort(), [["a", "a"], ["c", "c"]]);
  assert.deepEqual(failed, ["b"]);
});
