import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  isZeroGammaLinePayload,
  paintZeroGammaLine,
  zeroGammaRootForInstrument,
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
assert.match(chart, /window\.setInterval\(\(\) => void load\(1, 45_000\)/);

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

console.log("Zero Gamma Line contract tests passed.");
