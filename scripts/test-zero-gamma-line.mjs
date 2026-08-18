import assert from "node:assert/strict";
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

assert.equal(zeroGammaRootForInstrument("NQ"), "NQ");
assert.equal(zeroGammaRootForInstrument("MNQU6"), "NQ");
assert.equal(zeroGammaRootForInstrument("ES"), "ES");
assert.equal(zeroGammaRootForInstrument("MESU6"), "ES");
assert.equal(zeroGammaRootForInstrument("QQQ"), "NQ");
assert.equal(zeroGammaRootForInstrument("I:SPX"), "ES");
assert.equal(zeroGammaSourceForInstrument("NDX"), "NDX");
assert.equal(zeroGammaSourceForInstrument("I:SPX"), "SPX");
assert.equal(zeroGammaSourceForInstrument("MNQU6"), "NQ");

assert.deepEqual(paintZeroGammaLine([
  { timestampMs: 1_000, sessionDate: "2026-08-17", value: 100, status: "HISTORICAL" },
  { timestampMs: 3_000, sessionDate: "2026-08-18", value: 105, status: "LIVE" },
], [0, 1_000, 2_000, 3_000, 4_000]), [
  { time: 1, value: 100 },
  { time: 2, value: 100 },
  { time: 3, value: 105 },
  { time: 4, value: 105 },
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

console.log("Zero Gamma Line contract tests passed.");
