import assert from "node:assert/strict";
import { buildInitialBalanceLevels, buildMarketSessionWindows } from "../src/lib/marketSessions.ts";

/**
 * Globex reopens on SUNDAY evening.
 *
 * "Hide weekends" dropped every Sunday candle by calendar day, so the session
 * that opens Sunday 18:00 New York had no window at all - and with no window
 * there is no initial balance, and with no initial balance there is no fib
 * retracement either, because the fib is built from the IB high and low. The
 * study went blank every Sunday night through Monday, which is exactly when
 * the week's opening range is being set.
 */
const MIN = 60_000;
// Sunday 23 August 2026, 18:00 New York == 22:00 UTC.
const REOPEN = Date.UTC(2026, 7, 23, 22, 0);

function candlesFrom(startMs, minutes, base = 24_000) {
  return Array.from({ length: minutes }, (_, m) => {
    const price = base + m * 0.25;
    return { timestamp: startMs + m * MIN, open: price, high: price + 2, low: price - 2, close: price, volume: 10 };
  });
}

const globexOnly = {
  showGlobex: true, showTokyo: false, showLondon: false, showNewYork: false, showSydney: false,
  globexStart: "18:00", globexEnd: "17:00",
  lookbackDays: 7, durationMinutes: 60,
};

// --- the reopen produces an initial balance, weekends hidden or not ---
{
  const candles = candlesFrom(REOPEN, 300);
  for (const hideWeekends of [true, false]) {
    const levels = buildInitialBalanceLevels(candles, { ...globexOnly, hideWeekends }, MIN);
    assert.equal(levels.length, 2, `hideWeekends=${hideWeekends} must still give IBH and IBL`);
    const high = levels.find((level) => level.side === "high");
    const low = levels.find((level) => level.side === "low");
    assert.equal(high.session.key, "globex");
    assert.equal(high.session.startTimestamp, REOPEN, "the session opens at the reopen, not at midnight");
    // The fib is built from this range; without a positive range it draws
    // nothing, so this is the precondition the retracement depends on.
    assert.ok(high.price - low.price > 0, "the IB range must be positive for the fib to exist");
  }
}

// --- every IB duration measures from the reopen ---
{
  const candles = candlesFrom(REOPEN, 300);
  for (const durationMinutes of [15, 30, 45, 60]) {
    const levels = buildInitialBalanceLevels(
      candles, { ...globexOnly, hideWeekends: true, durationMinutes }, MIN,
    );
    const high = levels.find((level) => level.side === "high");
    const low = levels.find((level) => level.side === "low");
    const window = candles.slice(0, durationMinutes);
    assert.equal(high.price, Math.max(...window.map((c) => c.high)), `${durationMinutes}m IBH`);
    assert.equal(low.price, Math.min(...window.map((c) => c.low)), `${durationMinutes}m IBL`);
    assert.equal(high.durationMinutes, durationMinutes);
  }
}

// --- what must STAY excluded ---
{
  // Sunday BEFORE the reopen is genuinely closed.
  const sundayMorning = Date.UTC(2026, 7, 23, 14, 0);   // 10:00 New York, Sunday
  const early = buildMarketSessionWindows(
    candlesFrom(sundayMorning, 120), { ...globexOnly, hideWeekends: true }, MIN,
  );
  assert.equal(early.length, 0, "Sunday morning is not a Globex session");

  // Saturday is closed all day.
  const saturday = Date.UTC(2026, 7, 22, 22, 0);        // Saturday 18:00 New York
  const sat = buildMarketSessionWindows(
    candlesFrom(saturday, 120), { ...globexOnly, hideWeekends: true }, MIN,
  );
  assert.equal(sat.length, 0, "Saturday must remain excluded");

  // A session that does NOT wrap midnight cannot open on a Sunday evening, so
  // Tokyo, London and New York are untouched by this.
  const nyOnly = {
    showGlobex: false, showTokyo: false, showLondon: false, showNewYork: true, showSydney: false,
    newYorkStart: "09:30", newYorkEnd: "16:00", lookbackDays: 7, durationMinutes: 60,
  };
  const sundayNy = Date.UTC(2026, 7, 23, 13, 30);       // Sunday 09:30 New York
  assert.equal(
    buildMarketSessionWindows(candlesFrom(sundayNy, 120), { ...nyOnly, hideWeekends: true }, MIN).length,
    0,
    "a non-wrapping session must still hide the weekend",
  );
  // And with weekends shown it does appear, proving the flag still works.
  assert.ok(
    buildMarketSessionWindows(candlesFrom(sundayNy, 120), { ...nyOnly, hideWeekends: false }, MIN).length > 0,
    "hideWeekends: false must still include it",
  );
}

// --- the session carries across midnight into Monday as one window ---
{
  // Six hours from the reopen crosses into Monday New York time.
  const candles = candlesFrom(REOPEN, 8 * 60);
  const windows = buildMarketSessionWindows(candles, { ...globexOnly, hideWeekends: true }, MIN);
  assert.equal(windows.length, 1, "Sunday evening and Monday morning are ONE Globex session");
  assert.equal(windows[0].startTimestamp, REOPEN);
  // The IB therefore still anchors to the reopen, not to Monday 00:00.
  const [high] = buildInitialBalanceLevels(candles, { ...globexOnly, hideWeekends: true }, MIN);
  assert.equal(high.session.startTimestamp, REOPEN);
}

console.log("Globex initial balance tests passed.");
