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
