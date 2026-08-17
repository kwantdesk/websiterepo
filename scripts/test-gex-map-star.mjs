import assert from "node:assert/strict";
import {
  RECOMMENDED_GEX_MAP_STAR_SETTINGS,
  deriveGexMapStarModel,
  formatMagnitudeVelocity,
  stabilizeHighlightedStrikes,
} from "../src/lib/gexMapStar.ts";

const row = (strike, net) => ({ strike, net, call: Math.max(0, net), put: Math.min(0, net) });
const previous = (...rows) => new Map(rows.map((item) => [item.strike, item]));

const model = deriveGexMapStarModel({
  rows: [row(95, -25), row(100, 10), row(105, -80), row(110, 30), row(115, 5)],
  previous: previous(row(95, -20), row(100, 8), row(105, -40), row(110, 40), row(115, 5)),
  spot: 102,
});
assert.equal(model.starStrike, 105, "negative maximum absolute exposure must be STAR");
assert.ok(Math.abs(model.rows.reduce((sum, item) => sum + item.mapControlPct, 0) - 100) < 1e-9, "map control must sum to 100%");
assert.ok(model.rows.find((item) => item.strike === 95)?.roles.includes("floor"), "floor must sit below spot");
assert.ok(model.rows.find((item) => item.strike === 105)?.roles.includes("ceiling"), "ceiling must sit above spot");
assert.equal(new Set(model.highlightedStrikes).size, model.highlightedStrikes.length, "overlapping roles must count once");
assert.ok(model.highlightedStrikes.length >= 2, "missing structural slots must be filled deterministically");

const growingNegative = model.rows.find((item) => item.strike === 105);
const decayingNegative = model.rows.find((item) => item.strike === 95);
assert.ok(growingNegative.magnitudeVelocityPct > 0, "negative becoming more negative is positive magnitude growth");
assert.ok(decayingNegative.magnitudeVelocityPct > 0, "-20 to -25 grows in magnitude");

const decay = deriveGexMapStarModel({ rows: [row(100, -20)], previous: previous(row(100, -40)), spot: 100 });
assert.ok(decay.rows[0].magnitudeVelocityPct < 0, "negative moving toward zero is magnitude decay");

const emerged = deriveGexMapStarModel({
  rows: [row(100, 1_000), row(105, 1)],
  previous: previous(row(100, 0), row(105, 1)),
  spot: 100,
});
assert.equal(emerged.rows.find((item) => item.strike === 100)?.isNew, true, "near-zero baseline must produce NEW");
assert.equal(formatMagnitudeVelocity(emerged.rows.find((item) => item.strike === 100), 1), "NEW");

const noHistory = deriveGexMapStarModel({ rows: [row(100, 20)], previous: new Map(), spot: 100 });
assert.equal(noHistory.rows[0].magnitudeVelocityPct, null, "missing history must stay null");

const duplicate = deriveGexMapStarModel({ rows: [row(100, 20), row(100, -5)], previous: new Map(), spot: 100 });
assert.equal(duplicate.rows.length, 1, "duplicate strikes must aggregate");
assert.equal(duplicate.rows[0].net, 15);

const invalid = deriveGexMapStarModel({ rows: [row(Number.NaN, 20), row(100, Number.POSITIVE_INFINITY), row(105, 10)], previous: new Map(), spot: 100 });
assert.equal(invalid.rows.length, 1, "invalid values must be quarantined");
assert.ok(invalid.rows.every((item) => Number.isFinite(item.mapControlPct)));

const pocket = deriveGexMapStarModel({
  rows: [row(90, 1000), row(95, 1), row(100, 1), row(105, 1), row(110, -800)],
  previous: new Map(),
  spot: 100,
  settings: { ...RECOMMENDED_GEX_MAP_STAR_SETTINGS, highlightedNodes: 2, airPocketRowThresholdPct: 1, airPocketCombinedThresholdPct: 2 },
});
assert.ok(pocket.airPockets.some((item) => item.rowCount >= 2), "air-pocket thresholds must identify weak consecutive rows");

const moreNodes = deriveGexMapStarModel({
  rows: [row(90, 100), row(95, -90), row(100, 80), row(105, -70), row(110, 60), row(115, -50)],
  previous: previous(row(90, 90), row(95, -80), row(100, 70), row(105, -60), row(110, 50), row(115, -40)),
  spot: 102,
  settings: { ...RECOMMENDED_GEX_MAP_STAR_SETTINGS, highlightedNodes: 6 },
});
assert.equal(moreNodes.highlightedStrikes.length, 6, "highlighted-node setting must alter the calculation");

const stabilized = stabilizeHighlightedStrikes([95, 100, 105, 110], model, { ...RECOMMENDED_GEX_MAP_STAR_SETTINGS, promotionMargin: 0.5 });
assert.ok(stabilized.length <= 4, "hysteresis must preserve a bounded unique selection");

console.log("GEX Map STAR derivation: all assertions passed");
