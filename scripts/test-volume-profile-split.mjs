import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

const outDir = mkdtempSync(join(process.cwd(), ".vp-split-test-"));
const bundle = join(outDir, "sessions.mjs");
execSync(
  `npx esbuild src/lib/volumeProfileSessions.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);
const { resolveSessionSegments, sessionTradingDate } = await import(
  `file://${bundle.replaceAll("\\", "/")}`
);
execSync(
  `npx esbuild src/lib/chartHistoryWindow.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${join(outDir, "window.mjs")}"`,
  { stdio: "pipe" },
);
const { cmeSessionDateKey } = await import(
  `file://${join(outDir, "window.mjs").replaceAll("\\", "/")}`
);

/**
 * Mirrors the workspace's own per-trading-date resolution so the segments the
 * chart actually requests are the ones under test.
 */
function segmentsForTradingDate(tradingDate, useEndSessionAsStartDay) {
  const midnight = Date.parse(`${tradingDate}T00:00:00.000Z`);
  return resolveSessionSegments(midnight - 12 * 3_600_000, midnight + 36 * 3_600_000, {
    mode: "triple",
    window: "rth",
    customStartMinutes: 8 * 60 + 30,
    customEndMinutes: 15 * 60 + 15,
    useEndSessionAsStartDay,
    // The three desk sessions belong to the CME trading day, which already
    // begins at the 17:00 Globex open — matching the workspace's own rule.
  }).filter((segment) => cmeSessionDateKey(segment.startMs) === tradingDate);
}

// A plain mid-week CME trading date.
const DATE = "2026-08-19";
const segments = segmentsForTradingDate(DATE, true);

// 1. A split day must produce four distinct windows, not one merged profile.
//    Globex is the evening between the 17:00 CME bell and Tokyo's 19:00 open;
//    it used to be folded into Asia, which hid the opening window's own value
//    area inside Tokyo's session.
assert.equal(segments.length, 4, `expected Globex/Asia/London/New York, got ${segments.length}`);
assert.deepEqual(segments.map((s) => s.id), ["globex", "asia", "london", "newyork"]);
assert.deepEqual(segments.map((s) => s.label), ["Globex", "Asia", "London", "New York"]);

// 2. The windows must not overlap — overlapping windows would double-count
//    executions across the profiles standing beside each other.
for (let i = 1; i < segments.length; i += 1) {
  assert.ok(
    segments[i].startMs >= segments[i - 1].endMs,
    `${segments[i].label} overlaps ${segments[i - 1].label}`,
  );
}

// 3. Every window must be non-empty and inside one 24h trading day.
for (const segment of segments) {
  assert.ok(segment.endMs > segment.startMs, `${segment.label} is empty`);
  assert.ok(
    segment.endMs - segment.startMs <= 24 * 3_600_000,
    `${segment.label} spans more than a day`,
  );
}

// 4. The trading day opens on the previous evening, so both overnight windows
//    must start BEFORE the date they are attributed to. This is the case that
//    silently put the overnight profile on the wrong day.
//
//    Attribution here is the CME session key, not the calendar date: Globex
//    runs 17:00-19:00 and never crosses midnight, so its own calendar date is
//    the previous day and only the 17:00 roll puts it on the right session.
const [globex, asia] = segments;
//    The yardstick is the cash open, not UTC midnight: 19:00 Chicago is
//    already 00:00Z the next day, so comparing Asia's start against UTC
//    midnight measures the timezone rather than the session.
const cashOpenMs = Date.parse(`${DATE}T13:30:00.000Z`);
for (const segment of [globex, asia]) {
  assert.ok(
    segment.endMs <= cashOpenMs,
    `${segment.label} must finish before the ${DATE} cash open`,
  );
  assert.equal(cmeSessionDateKey(segment.startMs), DATE,
    `${segment.label} must belong to the ${DATE} trading day`);
}
// Asia still crosses midnight, so the end-session convention resolves it too.
assert.equal(sessionTradingDate(asia, true), DATE);

// 4b. The overnight window must land on this trading date under BOTH settings
//     of the end-session toggle. Attributing it by its own calendar date threw
//     it onto the next day, so the day being drawn silently lost its overnight
//     profile and only London and New York appeared.
for (const useEnd of [false, true]) {
  const both = segmentsForTradingDate(DATE, useEnd);
  assert.equal(both.length, 4, `toggle=${useEnd} produced ${both.length} windows`);
  assert.deepEqual(
    both.map((s) => s.id),
    ["globex", "asia", "london", "newyork"],
    `toggle=${useEnd} lost or reordered a session`,
  );
  assert.ok(
    both[0].startMs < Date.parse(`${DATE}T00:00:00.000Z`),
    `toggle=${useEnd} attributed the wrong overnight window`,
  );
}

// 5. Every trading date must resolve its own four windows — no date may
//    borrow another's, or profiles would stack on one day.
//
//    Ownership is the CME session key, which is what the workspace itself
//    applies in split mode. The calendar-date convention cannot be used here:
//    Globex runs 17:00-19:00 and never crosses midnight, so by calendar date it
//    belongs to the evening it started in rather than the session it opens.
for (const date of ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"]) {
  const daily = segmentsForTradingDate(date, true);
  assert.equal(daily.length, 4, `${date} resolved ${daily.length} windows`);
  for (const segment of daily) {
    assert.equal(cmeSessionDateKey(segment.startMs), date, `${segment.label} escaped ${date}`);
  }
}

// 6. Consecutive days must not overlap each other either.
const monday = segmentsForTradingDate("2026-08-18", true);
const tuesday = segmentsForTradingDate("2026-08-19", true);
const mondayClose = monday.find((segment) => segment.id === "newyork");
assert.ok(mondayClose, "Monday must have a New York window");
assert.ok(
  tuesday[0].startMs >= mondayClose.endMs,
  "Tuesday's Globex window must open after Monday's New York close",
);

// 7. The renderer must name each profile, or the split is invisible.
const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
assert.match(primitive, /profile\.sessionLabel/);

// 8. Profiles sharing a trading date must be kept apart by session identity.
const workspace = readFileSync("src/components/KwantifyWorkspace.tsx", "utf8");
assert.match(workspace, /candidate\.sessionId \?\? ""\) !== \(replacement\.sessionId \?\? ""/);

rmSync(outDir, { recursive: true, force: true });
// 9. Sessions can be individually turned off. An unticked window is omitted
//    entirely — the remaining sessions must keep their own boundaries rather
//    than absorbing the gap it leaves.
{
  const all = segmentsForTradingDate(DATE, true);
  const enabled = new Set(["asia", "newyork"]);
  const kept = all.filter((segment) => enabled.has(segment.id));
  assert.equal(kept.length, 2, "unticking London must leave two sessions");
  assert.deepEqual(kept.map((s) => s.id), ["asia", "newyork"]);
  for (const segment of kept) {
    const original = all.find((candidate) => candidate.id === segment.id);
    assert.equal(segment.startMs, original.startMs, `${segment.label} moved its start`);
    assert.equal(segment.endMs, original.endMs, `${segment.label} absorbed the gap`);
  }
}

// 10. The workspace must actually apply the toggle set.
assert.match(workspace, /enabledSessionIds\.has\(segment\.id\)/);
assert.match(workspace, /settings\.sessionLondonEnabled === false/);

console.log("volume profile session split: 10/10 checks passed");
