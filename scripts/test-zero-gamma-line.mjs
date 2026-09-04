import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  isZeroGammaLinePayload,
  paintZeroGammaLine,
  paintZeroGammaLineOnBars,
  isZeroGammaLineSource,
  zeroGammaRootForInstrument,
  zeroGammaSourceChoices,
  zeroGammaSourceForInstrument,
} from "../src/lib/zeroGammaLine.ts";

const [catalog, config, controls, chart, route, server, quantData] = await Promise.all([
  readFile(new URL("../src/lib/chartIndicatorCatalog.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/api/zero-gamma-line/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/zeroGammaLine.server.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8"),
]);

assert.match(catalog, /indicator\("Zero Gamma Line", "Options Flow"/);
assert.match(config, /LIVE_CHART_INDICATOR_IDS[\s\S]*?"zero-gamma-line"/);
assert.match(controls, /RENDERED_CHART_INDICATOR_IDS[\s\S]*?"zero-gamma-line"/);
assert.match(chart, /indicatorId === "zero-gamma-line"/);
assert.match(chart, /\/api\/zero-gamma-line\?instrument=/);
assert.match(route, /getZeroGammaLinePayload/);

// The cash-calibrated futures source must convert the cage's flip and
// crossings to futures scale exactly like every level. An unconverted cage
// once painted the NQ zero-gamma line at QQQ prices (~730 instead of ~30k).
assert.match(quantData, /cage: cashSource\.cage\s*\?\s*\{[\s\S]*?toFuturesPrice\(cashSource\.cage\.flip\)[\s\S]*?crossings: cashSource\.cage\.crossings\.map\(toFuturesPrice\)/);

// Broken or mis-scaled provider observations far outside the session's own
// range must be dropped, not painted.
assert.match(server, /Math\.abs\(candidate - spot\) \/ spot > 0\.25/);

// A cold multi-session request must survive on the deployment platform and
// not recompute immutable completed sessions on every call.
assert.match(route, /export const maxDuration/);
assert.match(server, /historicalPointCache/);

// Before the open, the newest completed session is the previous trading day;
// today's untraded date must never occupy a history slot.
assert.match(server, /newYorkSessionCompleted\(now\) \? sessionDate : previousTradingDay\(sessionDate\)/);

// The chart paints the newest sessions first and streams the rest of the
// history in behind them. The recurring refresh only re-requests the live
// session — completed sessions are immutable and re-fetching them multiplied
// provider quota fleet-wide.
assert.match(chart, /await load\(quickSessions, 45_000\)/);
// ...but only once something is actually on the chart. Polling the live
// session alone while the pane is still blank leaves it blank forever when
// the first load misses its budget, or outside RTH when that session has
// produced no positioning buckets yet — the measured cause of the line being
// invisible on NQ before the open.
assert.match(chart, /painted \? load\(1, 45_000\) : load\(historySessions, 120_000\)/);
assert.match(chart, /if \(payload\.points\.length\) painted = true;/);

// Every requested completed session gets its own intraday trail. Building
// only the newest left older sessions as a single closing anchor each, so the
// "history" was straight segments between days.
assert.match(server, /for \(const date of \[\.\.\.completedDates\]\.reverse\(\)\)/);
assert.match(server, /Math\.max\(MIN_TRAIL_BUDGET_MS, trailDeadline - Date\.now\(\)\)/);
// The trails share one budget so a cold multi-session load cannot stack a
// full budget per session and outlive the request.
assert.match(server, /const HISTORY_TRAIL_BUDGET_MS = 20_000;/);
// A session with no trail must not throw the whole payload away.
assert.ok(
  !/historySessions === 1 && completedDates\.includes\(sessionDate\)/.test(server),
  "the one-session poll no longer depends on today already being completed",
);

// Completed-session points persist in the cross-instance data cache and the
// route coalesces polling bursts, so a fleet of machines cannot multiply the
// provider chain for identical answers.
assert.match(server, /unstable_cache/);
assert.match(route, /payloadCache/);

assert.equal(zeroGammaRootForInstrument("NQ"), "NQ");
assert.equal(zeroGammaRootForInstrument("MNQU6"), "NQ");
assert.equal(zeroGammaRootForInstrument("ES"), "ES");
assert.equal(zeroGammaRootForInstrument("MESU6"), "ES");
assert.equal(zeroGammaRootForInstrument("QQQ"), "NQ");
assert.equal(zeroGammaRootForInstrument("I:SPX"), "ES");
assert.equal(zeroGammaSourceForInstrument("NDX"), "NDX");
assert.equal(zeroGammaSourceForInstrument("I:SPX"), "SPX");
assert.equal(zeroGammaSourceForInstrument("MNQU6"), "NQ");

// Observations connect directly into one continuous running line — the GEX
// BOX zero-Gamma trail behaviour — instead of stepping per candle. Duplicate
// seconds keep only the newest observation.
assert.deepEqual(paintZeroGammaLine([
  { timestampMs: 3_000, sessionDate: "2026-08-18", value: 104, status: "LIVE" },
  { timestampMs: 1_000, sessionDate: "2026-08-17", value: 100, status: "HISTORICAL" },
  { timestampMs: 3_400, sessionDate: "2026-08-18", value: 105, status: "LIVE" },
]), [
  { time: 1, value: 100 },
  { time: 3, value: 105 },
]);

assert.equal(isZeroGammaLinePayload({
  root: "NQ",
  sourceSymbol: "NQ",
  displayInstrument: "MNQ",
  asOf: "2026-08-17T00:00:00.000Z",
  status: "EOD",
  positiveAbove: true,
  points: [{ timestampMs: 1_776_000_000_000, sessionDate: "2026-08-14", value: 30125.5, status: "HISTORICAL" }],
  method: "TRUE_OI_SCENARIO",
  disclosure: "test",
}), true);
assert.equal(isZeroGammaLinePayload({ root: "NQ", points: [{ timestampMs: 1, value: Number.NaN }] }), false);

/**
 * The intraday trail rejects a crossing that sits too far from spot, because a
 * partially accumulated one-minute surface puts the cumulative crossing
 * thousands of points away. The bound was 10%, which on NQ near 29,400 still
 * admitted a crossing almost 3,000 points off — those survivors drew as
 * vertical spikes across the pane and made the line unreadable.
 */
{
  const server = readFileSync(
    new URL("../src/lib/zeroGammaLine.server.ts", import.meta.url),
    "utf8",
  );
  const match = server.match(/const ZERO_GAMMA_MAX_SPOT_DEVIATION = ([0-9.]+);/);
  assert.ok(match, "the trail must bound how far a crossing may sit from spot");

  const deviation = Number(match[1]);
  assert.ok(deviation > 0, "the bound must be a real fraction of spot");
  assert.ok(
    deviation <= 0.03,
    `a bound of ${deviation * 100}% is too loose to reject a half-built surface`,
  );

  // Sanity-check what the bound means on the instruments it runs on.
  const nqSpot = 29_400;
  const esSpot = 6_400;
  assert.ok(nqSpot * deviation < 1_000, "the NQ band must stay well under a thousand points");
  assert.ok(esSpot * deviation < 250, "the ES band must stay proportionate");
  // ...but wide enough for a genuine intraday migration.
  assert.ok(nqSpot * deviation > 200, "the band must not clip real movement on NQ");

  assert.match(
    server,
    /Math\.abs\(value - spot\) \/ spot > ZERO_GAMMA_MAX_SPOT_DEVIATION/,
    "the guard must use the named bound",
  );
  assert.match(server, /frame\.strikes\.length < 20/, "a thin surface is still rejected outright");
}

/**
 * Single-bucket artifact rejection. Each minute rebuilds the whole surface, so
 * one strike crossing a threshold throws that bucket's crossing hundreds of
 * points and the next puts it straight back. Measured on an NQ session: of 64
 * moves over 150 points, 29 were isolated round trips and 35 were real
 * migration — so the filter must remove the first kind and keep the second.
 */
{
  const { rejectZeroGammaArtifacts } = await import("../src/lib/zeroGammaLine.ts");
  const spot = 29_400;
  const at = (index, value) => ({
    timestampMs: 1_776_000_000_000 + index * 60_000,
    sessionDate: "2026-08-20",
    value,
    status: "HISTORICAL",
  });

  // An isolated excursion that reverts is an artifact.
  const spiky = [29_400, 29_410, 29_405, 29_950, 29_408, 29_412, 29_402].map((v, i) => at(i, v));
  const cleaned = rejectZeroGammaArtifacts(spiky, spot);
  assert.ok(
    !cleaned.some((point) => point.value === 29_950),
    "a lone excursion that reverts must be dropped",
  );
  assert.equal(cleaned.length, spiky.length - 1, "only the artifact is dropped");

  // A sustained migration moves the neighbourhood with it and must survive.
  const migrating = [29_400, 29_405, 29_500, 29_600, 29_700, 29_800, 29_900].map((v, i) => at(i, v));
  assert.equal(
    rejectZeroGammaArtifacts(migrating, spot).length,
    migrating.length,
    "a sustained migration is not an artifact",
  );

  // Ordinary variation passes untouched, and values are never rewritten.
  const calm = [29_400, 29_412, 29_398, 29_405, 29_410, 29_402, 29_407].map((v, i) => at(i, v));
  const calmOut = rejectZeroGammaArtifacts(calm, spot);
  assert.equal(calmOut.length, calm.length, "normal variation is kept");
  assert.deepEqual(
    calmOut.map((point) => point.value),
    calm.map((point) => point.value),
    "surviving readings are reported exactly as the surface produced them",
  );

  // Degenerate inputs are returned untouched rather than emptied.
  assert.equal(rejectZeroGammaArtifacts(calm, null).length, calm.length, "no spot means no filtering");
  assert.equal(rejectZeroGammaArtifacts(calm.slice(0, 3), spot).length, 3, "too few points to judge");
  assert.deepEqual(rejectZeroGammaArtifacts([], spot), []);
}

console.log("Zero Gamma Line contract tests passed.");

// --- pinning the option chain the crossing is read from ---
{
  // Only the chart's OWN Gamma family is offered. Reading the SPX crossing on
  // an NQ chart would plot one market's dealer positioning on another
  // market's price.
  assert.deepEqual(zeroGammaSourceChoices("NQ.v.0"), ["NQ", "NDX", "QQQ"]);
  assert.deepEqual(zeroGammaSourceChoices("MNQ"), ["NQ", "NDX", "QQQ"]);
  assert.deepEqual(zeroGammaSourceChoices("ES.v.0"), ["ES", "SPX", "SPXW", "SPY"]);
  assert.deepEqual(zeroGammaSourceChoices("NDX"), ["NQ", "NDX", "QQQ"]);
  assert.deepEqual(zeroGammaSourceChoices("CL"), [], "unsupported families offer nothing");

  assert.equal(isZeroGammaLineSource("SPXW"), true);
  assert.equal(isZeroGammaLineSource("AUTO"), false, "AUTO is the absence of a pin");
  assert.equal(isZeroGammaLineSource("TSLA"), false);
  assert.equal(isZeroGammaLineSource(undefined), false);

  // The route re-validates the pin against the chart's own family, so a saved
  // setting carried onto another instrument cannot cross markets.
  assert.match(route, /zeroGammaRootForInstrument\(requestedSource\) === zeroGammaRootForInstrument\(instrument\)/);
  // The client only sends a pin it can justify, and the cache key separates
  // chains so two panes on one instrument cannot serve each other's line.
  assert.match(chart, /zero-gamma-line:\$\{instrument\.toUpperCase\(\)\}:\$\{pinnedSource \?\? "AUTO"\}/);
}

// --- the display scale belongs to the chart, not to the chain ---
{
  // A futures pane needs every crossing converted to the futures scale
  // whichever chain it came from. Testing `sourceSymbol === root` only held
  // while the source was always the automatic pick; with pinning it would
  // leave a pinned cash chain on the cash scale under futures prices.
  assert.match(server, /if \(displayScale === "futures"\)/);
  assert.ok(
    !server.includes("if (sourceSymbol === root) {"),
    "the futures conversion must not key off the source symbol",
  );
  assert.match(server, /zeroGammaSourceForInstrument\(displayInstrument\) === root \? "futures" : "cash"/);
  // Same chain, two scales, two different price series — the durable cache
  // must not serve one for the other. The version is deliberately not pinned
  // to a number here: a completed session is cached for six hours, so any
  // change to how the crossing is derived HAS to bump it, and a test that
  // spells out the current number just has to be edited each time instead of
  // catching anything. What must hold is that the key carries the scale and
  // both acceptance bounds, so a tuning change cannot quietly keep serving
  // trails built under the old ones.
  assert.match(server, /"zero-gamma-trail-v\d+", root, sourceSymbol, date, displayScale/);
  assert.match(
    server,
    /"zero-gamma-trail-v\d+"[^\]]*String\(ZERO_GAMMA_MAX_SPOT_DEVIATION\)[^\]]*String\(ZERO_GAMMA_ARTIFACT_DEVIATION\)/,
    "the cache key must carry the acceptance bounds it was built under",
  );
  assert.match(server, /\$\{date\}:\$\{displayScale\}:\$\{completed \? "h" : "l"\}/);
}

console.log("Zero Gamma Line source-pinning and display-scale tests passed.");

// --- the line drifts between observations instead of stepping ---
{
  // Two verified observations ten minutes apart, one bar a minute.
  const sessionStart = Date.parse("2026-08-20T13:30:00.000Z");
  const points = [
    { timestampMs: sessionStart, sessionDate: "2026-08-20", value: 100, status: "HISTORICAL" },
    { timestampMs: sessionStart + 600_000, sessionDate: "2026-08-20", value: 200, status: "HISTORICAL" },
  ];
  const bars = Array.from({ length: 11 }, (_, index) => sessionStart / 1000 + index * 60);
  const painted = paintZeroGammaLineOnBars(points, bars, 60);

  // Holding 100 for ten bars and then jumping to 200 is the staircase the
  // trader sees as flat shelves with vertical steps. The level moved over
  // those ten minutes, so the line has to move over them too.
  const values = painted.map((point) => point.value);
  assert.ok(
    new Set(values).size > 2,
    `expected a drifting line between observations, got ${JSON.stringify(values)}`,
  );
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index] >= values[index - 1], "a monotonic move never doubles back");
  }
  // Vertices stay exactly on the verified observations.
  assert.equal(painted.at(-1).value, 200, "the line lands on the later observation");
  assert.ok(values[0] > 100 && values[0] < 200, "the first bar has already begun moving");
  // Nothing is invented outside the observed range.
  assert.ok(Math.min(...values) >= 100 && Math.max(...values) <= 200);

  // Past the newest observation the last verified level stands — there is no
  // later reading to move toward, so it must not extrapolate.
  const trailing = paintZeroGammaLineOnBars(points, [...bars, 660, 720], 60);
  assert.equal(trailing.at(-1).value, 200, "the last verified level stands, it is not extended");
  assert.equal(trailing.at(-2).value, 200);

  // Bars that precede the whole trail stay empty rather than back-painting.
  const later = paintZeroGammaLineOnBars(
    [{ timestampMs: sessionStart + 3_600_000, sessionDate: "2026-08-20", value: 150, status: "HISTORICAL" }],
    [sessionStart / 1000, sessionStart / 1000 + 60, sessionStart / 1000 + 120],
    60,
  );
  assert.equal(later.length, 0, "a completed value is never painted backward");

  // A completed options session must stop at the cash close. It must never
  // slope through Globex toward the next day's first root.
  const nextSessionStart = Date.parse("2026-08-21T13:30:00.000Z");
  const separated = paintZeroGammaLineOnBars([
    ...points,
    { timestampMs: nextSessionStart, sessionDate: "2026-08-21", value: 300, status: "HISTORICAL" },
    { timestampMs: nextSessionStart + 600_000, sessionDate: "2026-08-21", value: 320, status: "HISTORICAL" },
  ], [
    Date.parse("2026-08-20T19:59:00.000Z") / 1000,
    Date.parse("2026-08-20T22:00:00.000Z") / 1000,
    nextSessionStart / 1000,
  ], 60);
  assert.deepEqual(
    separated.map((point) => point.time),
    [Date.parse("2026-08-20T19:59:00.000Z") / 1000, nextSessionStart / 1000],
    "the zero-gamma line has a hard overnight gap",
  );
}

// --- the crossing nearest price, not the lowest strike ---
{
  const native = readFileSync(new URL("../src/lib/gex-box/native.ts", import.meta.url), "utf8");
  // A cumulative curve can cross zero several times across a wide ladder.
  // Returning the first crossing found scanning upward picked the lowest one
  // wherever price was, which put the level thousands of points away and made
  // it jump whenever a far crossing appeared or vanished.
  assert.ok(
    !native.includes("      return sorted[index - 1].strike + (sorted[index].strike - sorted[index - 1].strike) * ratio;"),
    "the scan must collect crossings rather than return the first one",
  );
  assert.match(native, /crossings\.push\(/);
  // Nearest-to-price selection, without pinning how spot is spelled at the
  // comparison — that has already changed once and the naming is not the
  // behaviour under test.
  assert.match(native, /Math\.abs\(crossing - continuityReference\) < Math\.abs\(best - continuityReference\)/);
  // Callers without a price reference keep the previous answer exactly.
  assert.match(native, /return crossings\[0\];/);
  // The flip is looked for in the chain AROUND price. The listed ladder runs
  // far past anything traded — NDX lists 8,000 through 40,000 against a spot
  // near 29,000 — and letting those strikes vote drags the balance point
  // thousands of points off the market. Measured over a full session,
  // scoping the scan cut the crossing's day range from 19,224 points to 544
  // while spot moved 264.
  assert.match(native, /ZERO_GAMMA_STRIKE_SAMPLE/, "the scan must be scoped to the near-money strikes");
  // Counted in strikes, not percent: half a percent is 35 strikes of NDX at
  // ten-point spacing and about six of SPY at a dollar.
  assert.match(native, /const ZERO_GAMMA_STRIKE_SAMPLE = \d+;/);
  // Net dealer Gamma at a hypothetical spot is the exposure below it against
  // the exposure above, so the flip is where the running total reaches HALF
  // the chain's total. Searching for zero asked a different question and had
  // no answer at all on a one-signed chain: 145 of 405 one-minute surfaces
  // over a full NDX session produced nothing, which is what left the trail
  // full of holes.
  assert.match(native, /const target = total \/ 2;/, "the flip is the half-total crossing");
  assert.ok(
    !native.includes("if ((previous < 0 && cumulative >= 0) || (previous > 0 && cumulative <= 0))"),
    "the zero-cumulative search cannot answer on a one-signed chain",
  );
  assert.match(native, /const zeroGammaStrikeUniverse = new Set/);
  assert.match(native, /previousZeroGamma/);
  assert.match(native, /fixedZeroGammaPairs/);
}

// --- above the line is positive Gamma, below is negative ---
{
  // Per-point colours segment the one line, so the stretches price spent
  // above the crossing and below it are readable straight off the chart.
  assert.match(chart, /close >= point\.value \? positiveColor : negativeColor/);
  assert.match(chart, /const positiveColor = colorWithOpacity\(settings\.upColor, opacity\)/);
  assert.match(chart, /const negativeColor = colorWithOpacity\(settings\.downColor, opacity\)/);
  // A bar with no close cannot say which side price was on.
  assert.ok(
    chart.includes("if (close === undefined) return point;"),
    "a bar without a close keeps the neutral colour instead of guessing a side",
  );
}


// --- history is collected until it actually arrives ---
{
  // A completed session's trail is built once and durably cached, but the
  // first request for a cold one cannot wait: the server races a short budget
  // and finishes the build in the background. So the first answer legitimately
  // comes back with no history, and the only way to collect it is to ask
  // again once the build has landed.
  //
  // The pane used to stop asking the moment ANY point had painted — and a
  // completed session always yields its single closing anchor, which counts
  // as painted. So the trails being built in the background were never
  // collected and history stayed a dot per day instead of a line.
  assert.match(chart, /const trailPresent = /, "the pane must tell a trail from a lone closing anchor");
  assert.match(chart, /count > 3/, "one anchor is not a trail");
  assert.match(chart, /historyRestoredAt/, "it must track whether history actually arrived");
  assert.doesNotMatch(
    chart,
    /window\.setInterval\(\s*\(\) => void \(painted \? load\(1, 45_000\) : load\(historySessions, 120_000\)\),/,
    "painting a single anchor must not end the search for history",
  );
  // And it must not hammer a cold provider queue while it waits.
  assert.match(chart, /HISTORY_RETRY_MS = 60_000/);
  assert.match(chart, /Date\.now\(\) - lastHistoryAttempt >= HISTORY_RETRY_MS/);
}

console.log("Zero Gamma Line drift, crossing-selection and regime-shading tests passed.");

// --- live line uses one calculation and pinned cash sources use chart scale ---
{
  // Mixing interval-map balance estimates with true scenario roots at
  // alternating timestamps is the exact saw-tooth failure reported live.
  assert.doesNotMatch(
    server,
    /points\.push\(\.\.\.liveTrail/,
    "the live line must contain scenario roots only",
  );
  assert.match(server, /successive scenario snapshot/);
  // NDX/QQQ/SPX/SPY crossings must be converted to the futures axis before
  // they are merged with NQ/ES candles and historical points.
  assert.match(server, /getCashCalibratedChartGammaLevels/);
  assert.match(server, /zero-gamma-point-v2/);
  // Event charts pass real source times separately from synthetic chart slots,
  // allowing the same cash-session boundary logic on 500V/40R/etc.
  assert.match(chart, /candles\.map\(\(candle\) => candle\.timestamp \/ 1_000\)/);
}

console.log("Zero Gamma Line single-method live trail and session-boundary tests passed.");
