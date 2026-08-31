import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildOptionsSurfaceNetSeries,
  optionsDeltaSourceForInstrument,
} from "../src/lib/optionsDelta.ts";

const [catalog, config, controls, chart, route] = await Promise.all([
  readFile(new URL("../src/lib/chartIndicatorCatalog.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/api/zero-gamma-bars/route.ts", import.meta.url), "utf8"),
]);

assert.match(catalog, /indicator\("Zero Gamma Bars", "Options Flow"/);
assert.match(config, /LIVE_CHART_INDICATOR_IDS[\s\S]*?"zero-gamma-bars"/);
assert.match(controls, /RENDERED_CHART_INDICATOR_IDS[\s\S]*?"zero-gamma-bars"/);
assert.match(chart, /indicatorId === "zero-gamma-bars"/);
assert.match(chart, /optionsSurfacePaneEffect\(zeroGammaBarsIndicator, "GAMMA"/);
assert.match(route, /getGexMapPanel\([\s\S]*?"GAMMA"[\s\S]*?"FRONT_EXPIRY"[\s\S]*?"PER_ONE_DOLLAR_MOVE"/);
assert.match(route, /frame\.timestamp <= replayAsOfMs/);

assert.equal(optionsDeltaSourceForInstrument("NQU6"), "NDX");
assert.equal(optionsDeltaSourceForInstrument("MNQ"), "NDX");
assert.equal(optionsDeltaSourceForInstrument("ESU6"), "SPX");
assert.equal(optionsDeltaSourceForInstrument("MES"), "SPX");
assert.equal(optionsDeltaSourceForInstrument("SPXW"), "SPXW");
assert.equal(optionsDeltaSourceForInstrument("CL"), null);

assert.deepEqual(buildOptionsSurfaceNetSeries({
  frames: [
    { timestamp: 2_000, updates: [{ strike: 20_000, net: 6 }, { strike: 20_100, net: -2 }] },
    { timestamp: 1_000, updates: [{ strike: 20_000, net: 3 }] },
    { timestamp: 2_000, updates: [{ strike: 20_000, net: -4 }] },
    { timestamp: 3_000, updates: [{ strike: 20_100, net: 5 }] },
  ],
}), [
  { timestampMs: 1_000, net: 3 },
  { timestampMs: 2_000, net: -6 },
  { timestampMs: 3_000, net: 1 },
]);

console.log("Zero Gamma Bars contract tests passed.");
