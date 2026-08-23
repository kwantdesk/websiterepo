import assert from "node:assert/strict";
import { buildTpoProfiles } from "../src/lib/tpo/engine.ts";
import { defaultTpoSettings, tpoSessionFamilyFor, validateTpoSettings } from "../src/lib/tpo/settings.ts";

/**
 * TPO on an options underlying must be cut on the cash clock.
 *
 * The defaults are CME's: the day opens 17:00 Chicago, the week opens Sunday
 * 17:00, because that is when Globex opens. SPX, NDX, QQQ and SPY have no
 * overnight leg - they trade 09:30 to 16:00 New York and nothing else. Cut on
 * CME's clock, MONDAY's cash session is dated to SUNDAY and anchored to 17:00
 * the previous evening, hours before its first bar exists. The rows were
 * right; the day, the label and the position were not.
 */
const MIN = 60_000;

/** A cash session: 09:30 -> 16:00 New York, weekdays only, no overnight. */
function cashBars(instrumentId) {
  const bars = [];
  for (const day of [17, 18, 19, 20, 21]) {   // Mon 17 -> Fri 21 Aug 2026
    const open = Date.UTC(2026, 7, day, 13, 30);
    for (let m = 0; m < 390; m += 1) {
      const base = 6400 + Math.sin(m / 40) * 12 + day;
      bars.push({
        instrumentId, startTimeMs: open + m * MIN, endTimeMs: open + (m + 1) * MIN,
        open: base, high: base + 1.5, low: base - 1.5, close: base,
        volume: 1000, bidVolume: 500, askVolume: 500, tradeCount: 10, tickSize: 0.25,
      });
    }
  }
  return bars;
}

const profilesFor = (instrument, variant) => buildTpoProfiles({
  trades: [],
  bars: cashBars(instrument),
  settings: validateTpoSettings({}, variant, undefined, instrument),
});

// --- the four options underlyings are cut on the cash clock ---
{
  for (const symbol of ["SPX", "NDX", "QQQ", "SPY"]) {
    assert.equal(tpoSessionFamilyFor(symbol), "cash", `${symbol} has no Globex leg`);
    const defaults = defaultTpoSettings("daily-tpo", undefined, symbol);
    assert.equal(defaults.dailyStartTime, "08:30:00", `${symbol} day opens at the cash open`);
    assert.equal(defaults.weekStartDay, 1, `${symbol} week opens Monday, not Sunday`);
    assert.equal(defaults.weekStartTime, "08:30:00");
    // A cash session opens and closes on the same day, so Friday is a start
    // day. Under CME's Sunday-to-Thursday set Friday is not, and its bars are
    // swallowed by Thursday - four profiles for a five-day week.
    assert.deepEqual(defaults.enabledWeekdays, [1, 2, 3, 4, 5], `${symbol} trades Mon-Fri`);
  }
  // Futures keep CME's clock exactly as before.
  for (const symbol of ["NQ", "MNQ", "ES", "MES", "NQ.v.0"]) {
    assert.equal(tpoSessionFamilyFor(symbol), "cme", `${symbol} is a Globex product`);
    const defaults = defaultTpoSettings("daily-tpo", undefined, symbol);
    assert.equal(defaults.dailyStartTime, "17:00:00", `${symbol} must keep the Globex open`);
    assert.equal(defaults.weekStartDay, 0);
    assert.equal(defaults.weekStartTime, "17:00:00");
    assert.deepEqual(defaults.enabledWeekdays, [0, 1, 2, 3, 4], `${symbol} opens Sun-Thu`);
  }
  // No instrument at all is the historical behaviour: CME.
  assert.equal(tpoSessionFamilyFor(undefined), "cme");
  assert.equal(defaultTpoSettings("daily-tpo").dailyStartTime, "17:00:00");
}

// --- THE bug: a cash session is dated to its own day, not the evening before ---
{
  const cash = profilesFor("SPX", "daily-tpo");
  const cme = profilesFor("NQ", "daily-tpo");
  const ids = cash.map((profile) => profile.id);
  // Monday 17 August, dated Monday.
  assert.ok(ids.includes("daily:2026-08-17"), `expected Monday's own date, got ${ids.join(", ")}`);
  assert.ok(ids.includes("daily:2026-08-21"), "Friday is a cash session in its own right");
  // Sunday is not a cash trading day and must not name a profile.
  assert.ok(!ids.includes("daily:2026-08-16"), "a cash session dated to Sunday is the bug");
  assert.equal(cash.length, 5, "five weekday sessions");
  // On the identical bars the CME clock still dates them a day early, which is
  // what the futures chart genuinely wants and the cash chart does not.
  assert.ok(cme.map((p) => p.id).includes("daily:2026-08-16"),
    "if the CME clock agreed here the fix would be measuring nothing");
}

// --- and anchored to its own first bar, not to hours before it ---
{
  const [monday] = profilesFor("SPX", "daily-tpo");
  const firstBar = Date.UTC(2026, 7, 17, 13, 30);
  assert.equal(monday.startTimeMs, firstBar,
    "the profile must start where the session's first bar does");
  // Under the CME clock it began 17:00 Chicago the previous evening - a time
  // with no bars on a cash chart, which is what pushed the histogram away
  // from its own session.
  const [cmeMonday] = profilesFor("NQ", "daily-tpo");
  assert.ok(cmeMonday.startTimeMs < firstBar - 12 * 60 * MIN);
}

// --- the weekly profile opens Monday, not Sunday evening ---
{
  const weekly = profilesFor("SPX", "weekly-tpo");
  assert.equal(weekly.length, 1, "one trading week");
  assert.equal(weekly[0].id, "weekly:2026-08-17", "the cash week opens Monday");
  assert.equal(weekly[0].startTimeMs, Date.UTC(2026, 7, 17, 13, 30));
}

// --- everything else is the same study ---
{
  const cash = profilesFor("SPX", "daily-tpo")[0];
  for (const key of ["rows", "subperiods", "singlePrints", "peaksValleys"]) {
    assert.ok(Array.isArray(cash[key]), `${key} is still produced on cash`);
  }
  for (const key of ["pocTick", "vahTick", "valTick", "totalTpos", "totalVolume"]) {
    assert.ok(Number.isFinite(cash[key]), `${key} is still computed on cash`);
  }
  assert.ok(cash.rows.length > 0 && cash.totalTpos > 0, "the profile has real contents");

  // The ENGINE is venue-independent: the same bars under the same anchors give
  // the same answer whatever the instrument is called. Only the anchors differ
  // between families, which is the whole of this change.
  //
  // A CME-cut profile is deliberately NOT compared to a cash-cut one - CME's
  // "Monday" opens Sunday evening and runs into Tuesday, so it covers
  // different bars and SHOULD disagree.
  const cashSettings = validateTpoSettings({}, "daily-tpo", undefined, "SPX");
  const underFuturesName = buildTpoProfiles({
    trades: [], bars: cashBars("NQ"), settings: cashSettings,
  })[0];
  assert.equal(underFuturesName.pocTick, cash.pocTick, "the engine does not read the symbol");
  assert.equal(underFuturesName.vahTick, cash.vahTick);
  assert.equal(underFuturesName.valTick, cash.valTick);
  assert.equal(underFuturesName.id, cash.id);
}

// --- a study carried between venues re-derives its anchors ---
{
  // Saved on a futures chart, then the pane is switched to SPX.
  const onFutures = validateTpoSettings({}, "daily-tpo", undefined, "NQ");
  assert.equal(onFutures.dailyStartTime, "17:00:00");
  assert.equal(onFutures.tpoSessionFamily, "cme");
  const moved = validateTpoSettings(onFutures, "daily-tpo", undefined, "SPX");
  assert.equal(moved.dailyStartTime, "08:30:00", "the CME anchor must not follow it to cash");
  assert.equal(moved.tpoSessionFamily, "cash");
  // And back again.
  assert.equal(validateTpoSettings(moved, "daily-tpo", undefined, "NQ").dailyStartTime, "17:00:00");

  // Settings saved before the families existed carry no stamp and are all CME,
  // so a TPO already sitting on an options chart is corrected on first read.
  const legacy = { schemaVersion: 2, dailyStartTime: "17:00:00", weekStartDay: 0 };
  assert.equal(validateTpoSettings(legacy, "daily-tpo", undefined, "QQQ").dailyStartTime, "08:30:00");

  // A deliberate choice WITHIN a family survives, because the stamp matches.
  const custom = validateTpoSettings(
    { ...onFutures, dailyStartTime: "06:00:00" }, "daily-tpo", undefined, "NQ",
  );
  assert.equal(custom.dailyStartTime, "06:00:00", "a custom anchor must not be reset");
}

// --- volume profiles on the same tickers load the same way ---
{
  const { readFileSync } = await import("node:fs");
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const projection = workspace.slice(
    workspace.indexOf("const projectionRoot = valueAreaIndexSourceRoot"),
    workspace.indexOf("const results = await Promise.allSettled(requests)"),
  );
  assert.ok(projection.length > 400, "the projection block was not located");

  // Options underlyings have no execution tape of their own, so their volume
  // profiles are the REAL CME profiles of the futures that hedge them,
  // projected onto the cash scale. That much already worked - but it asked
  // only for TODAY, leaving the chart with one profile and nothing behind it
  // while the futures path loaded the prior sessions a profile trader reads.
  assert.ok(projection.includes("for (const tradingDate of dates)"),
    "the daily projection must cover several sessions, not just today");
  assert.ok(projection.includes("slice(-5)"), "five sessions, matching the futures path");
  assert.ok(!projection.includes("tradingDate: chicagoTradingDate(Date.now()),"),
    "requesting only the live day is the bug");

  // And it hardcoded the grouping and value area, so the trader's own settings
  // were silently dropped on exactly these tickers.
  assert.ok(projection.includes("projectedArgsFor"), "the study's settings must reach the request");
  for (const key of ["groupingMode", "valueAreaPercent", "minTradeVolume", "maxTradeVolume"]) {
    assert.ok(projection.includes(key), `${key} must be honoured on options tickers too`);
  }
  assert.ok(!projection.includes("groupTicks: 1,"), "grouping must not be pinned");
  assert.ok(!projection.includes("groupTicks: 4,"), "weekly grouping must not be pinned");

  // Several daily profiles can only coexist if each stops on its own session.
  const anchor = workspace.slice(workspace.indexOf("const anchorToCashSession"));
  assert.ok(anchor.slice(0, 3000).includes("const lastOfDate = profileDate === lastDate"),
    "a completed session must end on its own last bar, not at the live edge");
}

console.log("TPO and volume profile options-ticker tests passed.");
