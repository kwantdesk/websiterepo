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

// 1. A split day must produce three distinct windows, not one merged profile.
assert.equal(segments.length, 3, `expected Asia/London/New York, got ${segments.length}`);
assert.deepEqual(segments.map((s) => s.id), ["asia", "london", "newyork"]);
assert.deepEqual(segments.map((s) => s.label), ["Asia", "London", "New York"]);

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

// 4. Asia opens the trading day at the previous evening's Globex open, so it
//    must start BEFORE the date it is attributed to. This is the case that
//    silently put Asia on the wrong day.
const asia = segments[0];
assert.ok(
  asia.startMs < Date.parse(`${DATE}T00:00:00.000Z`),
  "Asia must open on the previous calendar evening",
);
assert.equal(sessionTradingDate(asia, true), DATE);

// 4b. The overnight window must land on this trading date under BOTH settings
//     of the end-session toggle. Attributing it by its own calendar date threw
//     it onto the next day, so the day being drawn silently lost its overnight
//     profile and only London and New York appeared.
for (const useEnd of [false, true]) {
  const both = segmentsForTradingDate(DATE, useEnd);
  assert.equal(both.length, 3, `toggle=${useEnd} produced ${both.length} windows`);
  assert.deepEqual(
    both.map((s) => s.id),
    ["asia", "london", "newyork"],
    `toggle=${useEnd} lost or reordered a session`,
  );
  assert.ok(
    both[0].startMs < Date.parse(`${DATE}T00:00:00.000Z`),
    `toggle=${useEnd} attributed the wrong overnight window`,
  );
}

// 5. Every trading date must resolve its own three windows — no date may
//    borrow another's, or profiles would stack on one day.
for (const date of ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"]) {
  const daily = segmentsForTradingDate(date, true);
  assert.equal(daily.length, 3, `${date} resolved ${daily.length} windows`);
  for (const segment of daily) {
    assert.equal(sessionTradingDate(segment, true), date, `${segment.label} escaped ${date}`);
  }
}

// 6. Consecutive days must not overlap each other either.
const monday = segmentsForTradingDate("2026-08-18", true);
const tuesday = segmentsForTradingDate("2026-08-19", true);
assert.ok(
  tuesday[0].startMs >= monday[2].endMs,
  "Tuesday's Asia window must open after Monday's New York close",
);

// 7. The renderer must name each profile, or the split is invisible.
const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
assert.match(primitive, /profile\.sessionLabel/);

// 8. Profiles sharing a trading date must be kept apart by session identity.
const workspace = readFileSync("src/components/KwantifyWorkspace.tsx", "utf8");
assert.match(workspace, /candidate\.sessionId \?\? ""\) !== \(replacement\.sessionId \?\? ""/);

rmSync(outDir, { recursive: true, force: true });
console.log("volume profile session split: 9/9 checks passed");
