import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  buildInitialBalanceLevels,
  nextInitialBalanceSessionStart,
  requestedInitialBalanceDurations,
  INITIAL_BALANCE_DURATIONS,
} =
  await import("../src/lib/marketSessions.ts");
const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

/**
 * A session can carry several opening ranges at once.
 *
 * There was room for exactly one duration, so reading the 15 against the 30
 * against the 60 of the same session meant changing the setting and losing the
 * other two. Each duration is now its own toggle.
 *
 * The fib set is also anchored differently: it used to start at whichever
 * extreme was made LAST, so a balance that printed its low at 09:47 drew a fib
 * beginning there - floating mid-session instead of lining up with the open -
 * The current session reaches the live edge; historical ranges hand over at
 * the next enabled session so they do not cross the profile in front.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// One minute bars across a New York session open (09:30 ET = 13:30Z in summer).
const OPEN = Date.parse("2026-09-01T13:30:00Z");
const candles = Array.from({ length: 200 }, (_, index) => {
  const timestamp = OPEN + index * 60_000;
  // A high early in the first 15, a lower low later in the hour, so the three
  // durations genuinely disagree.
  const high = index === 5 ? 100 : index === 40 ? 120 : 90;
  const low = index === 50 ? 40 : index === 3 ? 70 : 80;
  return { timestamp, open: 85, high, low, close: 85, volume: 10 };
});

const base = {
  showGlobex: false, showTokyo: false, showLondon: false, showNewYork: true,
  newYorkStart: "09:30", newYorkEnd: "16:00", newYorkLabel: "New York",
  hideWeekends: true, showHighs: true, showLows: true,
};

check("with nothing chosen it draws the single duration it always drew", () => {
  // A saved workspace has none of the new toggles and must look unchanged.
  assert.deepEqual(requestedInitialBalanceDurations({ durationMinutes: 60 }), [60]);
  assert.deepEqual(requestedInitialBalanceDurations({ durationMinutes: 30 }), [30]);
  // An unknown value falls back rather than drawing nothing.
  assert.deepEqual(requestedInitialBalanceDurations({ durationMinutes: 7 }), [60]);
});

check("each duration is its own toggle", () => {
  assert.deepEqual(
    requestedInitialBalanceDurations({ durationMinutes: 60, ibDuration15: true, ibDuration30: true }),
    [15, 30],
  );
  assert.deepEqual(
    requestedInitialBalanceDurations({ ibDuration15: true, ibDuration30: true, ibDuration45: true, ibDuration60: true }),
    [...INITIAL_BALANCE_DURATIONS],
  );
});

check("15, 30 and 60 draw together and disagree", () => {
  /*
   * The whole point: where the 15 sits inside the 60 is the information. If
   * they all returned the same prices the study would be telling us nothing.
   */
  const levels = buildInitialBalanceLevels(candles, {
    ...base, ibDuration15: true, ibDuration30: true, ibDuration60: true,
  }, 60_000);
  const durations = [...new Set(levels.map((level) => level.durationMinutes))].sort((a, b) => a - b);
  assert.deepEqual(durations, [15, 30, 60], `got ${durations.join(",")}`);

  const highs = new Map(levels.filter((l) => l.side === "high").map((l) => [l.durationMinutes, l.price]));
  const lows = new Map(levels.filter((l) => l.side === "low").map((l) => [l.durationMinutes, l.price]));
  // The 120 high lands at minute 40, so only the 60 sees it.
  assert.equal(highs.get(15), 100);
  assert.equal(highs.get(60), 120);
  // The 40 low lands at minute 50, so again only the 60 sees it.
  assert.equal(lows.get(15), 70);
  assert.equal(lows.get(60), 40);
});

check("every level is uniquely identified per duration", () => {
  // Two sets sharing an id would collide in the renderer's map and one would
  // silently replace the other.
  const levels = buildInitialBalanceLevels(candles, {
    ...base, ibDuration15: true, ibDuration30: true, ibDuration60: true,
  }, 60_000);
  const ids = levels.map((level) => level.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate level ids across durations");
  for (const level of levels) {
    assert.match(level.label, new RegExp(`${level.durationMinutes}m`), "the label does not name its duration");
  }
});

check("the defaults keep every workspace looking as it was left", () => {
  const defaults = defaultIndicatorSettings("ib-levels");
  for (const duration of INITIAL_BALANCE_DURATIONS) {
    assert.equal(defaults[`ibDuration${duration}`], false, `ibDuration${duration} defaults on`);
  }
  assert.equal(defaults.durationMinutes, 60);
});

check("session selection still gates which sessions draw at all", () => {
  const off = buildInitialBalanceLevels(candles, { ...base, showNewYork: false }, 60_000);
  assert.equal(off.length, 0, "a disabled session still drew its opening range");
});

check("the fib starts at the session open, not at the last extreme", () => {
  /*
   * The reported bug. The high was made at minute 5 and the low at minute 50,
   * so the old anchor put the fib 50 minutes into the session.
   */
  assert.match(
    chart,
    /const fibStart = pair\.high\.session\.startTimestamp;/,
    "the fib is anchored to the completing extreme again",
  );
  assert.ok(
    !/const fibStart = Math\.max\(pair\.high\.startTimestamp, pair\.low\.startTimestamp\);/.test(chart),
    "the old completing-extreme anchor is back",
  );
});

check("historical IB sets stop at the next distinct session", () => {
  const levels = [
    { session: { startTimestamp: 100 } },
    { session: { startTimestamp: 100 } },
    { session: { startTimestamp: 200 } },
    { session: { startTimestamp: 300 } },
  ];
  assert.equal(nextInitialBalanceSessionStart(levels, 100), 200);
  assert.equal(nextInitialBalanceSessionStart(levels, 200), 300);
  assert.equal(
    nextInitialBalanceSessionStart(levels, 300),
    undefined,
    "the current session must remain open to the live edge",
  );
  assert.match(
    chart,
    /endTime: ibEndTimeFor\(level\.session\.startTimestamp\)/,
    "IBH/IBL do not consume the session-chain boundary",
  );
  assert.match(
    chart,
    /const fibEnd = ibEndTimeFor\(fibStart\)/,
    "IB fibs do not share the IBH/IBL boundary",
  );
});

console.log(`\nib durations: ${passed}/${passed} checks passed`);
