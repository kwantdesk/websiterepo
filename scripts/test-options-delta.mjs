import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildOptionsDeltaSeries,
  optionsDeltaSourceForInstrument,
} from "../src/lib/optionsDelta.ts";

const [catalog, config, controls, chart] = await Promise.all([
  readFile(new URL("../src/lib/chartIndicatorCatalog.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8"),
]);

assert.match(catalog, /indicator\("Options Delta", "Options Flow"/);
assert.match(config, /LIVE_CHART_INDICATOR_IDS[\s\S]*?"options-delta"/);
assert.match(controls, /RENDERED_CHART_INDICATOR_IDS[\s\S]*?"options-delta"/);
assert.match(chart, /indicatorId === "options-delta"/);
assert.match(chart, /buildOptionsDeltaSeries\(payload\)/);
assert.match(chart, /optionsSurfacePaneEffect\(optionsDeltaIndicator, "DELTA"/);
assert.match(chart, /\/api\/gex-map\?symbol=.*greekMode=\$\{greekMode\}/);

// The pane maps to the chart's own options family.
assert.equal(optionsDeltaSourceForInstrument("QQQ"), "QQQ");
assert.equal(optionsDeltaSourceForInstrument("I:SPX"), "SPX");
assert.equal(optionsDeltaSourceForInstrument("SPXW"), "SPXW");
assert.equal(optionsDeltaSourceForInstrument("SPY"), "SPY");
assert.equal(optionsDeltaSourceForInstrument("NDX"), "NDX");
assert.equal(optionsDeltaSourceForInstrument("MNQU6"), "NDX");
assert.equal(optionsDeltaSourceForInstrument("NQ.v.0"), "NDX");
assert.equal(optionsDeltaSourceForInstrument("MESU6"), "SPX");
assert.equal(optionsDeltaSourceForInstrument("CL"), null);

// Frames update a cumulative per-strike surface; each frame yields one signed
// net value. Later updates replace a strike's prior value, never add to it.
assert.deepEqual(buildOptionsDeltaSeries({
  frames: [
    { timestamp: 2_000, updates: [{ strike: 100, net: 5 }, { strike: 110, net: -2 }] },
    { timestamp: 1_000, updates: [{ strike: 100, net: 3 }] },
    { timestamp: 3_000, updates: [{ strike: 100, net: -4 }] },
  ],
}), [
  { timestampMs: 1_000, net: 3 },
  { timestampMs: 2_000, net: 3 },
  { timestampMs: 3_000, net: -6 },
]);
assert.deepEqual(buildOptionsDeltaSeries({ frames: [] }), []);

console.log("Options Delta contract tests passed.");
