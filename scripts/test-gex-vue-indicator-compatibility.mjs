import assert from "node:assert/strict";

import { CHART_INDICATOR_CATALOG } from "../src/lib/chartIndicatorCatalog.ts";
import { indicatorCompatibility } from "../src/lib/indicatorInstrumentCompatibility.ts";

for (const instrument of ["SPX", "NDX", "SPY", "QQQ", "META", "ES"]) {
  for (const definition of CHART_INDICATOR_CATALOG) {
    const result = indicatorCompatibility(
      definition,
      instrument,
      instrument === "ES" ? "Databento" : "Market Index",
    );
    assert.ok(result.reason.length > 10, `${definition.id}/${instrument} must have an explicit reason`);
    assert.equal(result.canAdd, result.status !== "unavailable");
  }
}

const byId = (id) => {
  const definition = CHART_INDICATOR_CATALOG.find((candidate) => candidate.id === id);
  assert.ok(definition, `missing ${id}`);
  return definition;
};

assert.equal(indicatorCompatibility(byId("kwant-profile"), "SPX", "Market Index").status, "adapted");
assert.match(indicatorCompatibility(byId("kwant-profile"), "SPX", "Market Index").reason, /ES\/NQ|related ES\/NQ/);
assert.equal(indicatorCompatibility(byId("kwant-profile"), "QQQ", "Market Index").status, "native");
assert.match(indicatorCompatibility(byId("kwant-profile"), "QQQ", "Market Index").reason, /own five-day OHLCV/);
assert.equal(indicatorCompatibility(byId("deep-print-footprint"), "NDX", "Market Index").canAdd, false);
assert.equal(indicatorCompatibility(byId("tpo-chart"), "NDX", "Market Index").canAdd, true);
assert.equal(indicatorCompatibility(byId("moving-average"), "SPX", "Market Index").canAdd, true);
assert.equal(indicatorCompatibility(byId("zero-gamma-line"), "SPX", "Market Index").canAdd, true);
assert.equal(indicatorCompatibility(byId("dark-pool-map"), "SPX", "Market Index").canAdd, false);
assert.equal(indicatorCompatibility(byId("dark-pool-map"), "SPY", "Market Index").canAdd, true);
assert.equal(indicatorCompatibility(byId("vwap"), "NDX", "Market Index").canAdd, false);
assert.equal(indicatorCompatibility(byId("vwap"), "QQQ", "Market Index").canAdd, true);

console.log(`GEX VUE indicator compatibility audited for ${CHART_INDICATOR_CATALOG.length} catalog entries across cash indices, equity underlyings and futures.`);
