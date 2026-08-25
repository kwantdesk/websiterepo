import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * An index chart has to load on every timeframe the timeframe control offers.
 *
 * SPX, SPY and QQQ showed nothing but a spinner on the daily. The timeframe
 * was resolved through maps keyed "1D", "1W", "1M" — uppercase — while
 * minutes and hours were matched in lowercase. The chart sends "1d", so the
 * lookup missed, and depending on which of the three maps missed it the
 * request either came back "market instruments do not support 1d" or fell
 * past the KwantData adapter onto a provider the desk is no longer entitled
 * to. Either way the pane sat spinning.
 *
 * Case carries meaning in exactly one place: `m` is MINUTES and `M` is
 * MONTHS. Everywhere else either spelling must resolve the same way, and a
 * blanket lower-casing would quietly turn every monthly chart into a
 * one-minute one over the same window.
 */

const indices = readFileSync(new URL("../src/lib/marketIndices.server.ts", import.meta.url), "utf8");
const quant = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");
const sources = [["marketIndices.server", indices], ["quantData.server", quant]];

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("minutes and months stay distinct", () => {
  // The one collision. If it ever collapses, a monthly chart silently becomes
  // a one-minute chart.
  for (const [label, source] of sources) {
    // Backslash-free on purpose: these look for the regex TAIL, so the
    // check does not become an exercise in escaping.
    assert.ok(source.includes("m$/"), `${label}: minutes must match lowercase m only`);
    assert.ok(source.includes("M$/"), `${label}: months must match uppercase M only`);
  }
});

check("no timeframe lookup is keyed on the uppercase spelling alone", () => {
  // The three maps that made the daily miss.
  assert.ok(
    !indices.includes('"1D": { multiplier: 1, timespan: "day" }'),
    "the aggregate map must not be exact-case",
  );
  assert.ok(!quant.includes('"1D": "1d",'), "the provider aggregation must not be exact-case");
  assert.ok(!quant.includes('if (timeframe === "1W") {'), "the bucket must not be exact-case");
});

check("hours, days and weeks accept either spelling", () => {
  for (const [label, source] of sources) {
    assert.ok(
      source.includes("[hdw]") || source.includes('span === "1w"'),
      `${label}: a span must resolve whichever way it is spelled`,
    );
  }
});

check("a daily request reaches the entitled adapter", () => {
  // KwantData is the authoritative source for these instruments. Missing it
  // is what sent the request on to the unentitled provider, whose refusal the
  // trader saw as a permanent spinner.
  const plan = quant.slice(
    quant.indexOf("function underlyingHistoryPlan"),
    quant.indexOf("function marketDateKey"),
  );
  assert.ok(plan.includes("[hdw]"), "the plan must resolve a lowercase day");
  assert.ok(!plan.includes("providerAggregation[timeframe]"), "an exact-case lookup is what missed");
});

check("a daily and a weekly bucket to their own period", () => {
  // Falling past the duration table returned the source timestamp, so the
  // request handed back the candles it was built from — which is how "1w"
  // came back with a month of daily rows instead of seven weekly ones.
  const bucket = quant.slice(
    quant.indexOf("function underlyingHistoryBucket"),
    quant.indexOf("function aggregateUnderlyingHistory"),
  );
  assert.ok(bucket.includes('span === "1d"'), "a daily must bucket to its own day");
  assert.ok(bucket.includes('span === "1w"'), "a weekly must bucket to its own week");
});

console.log(`\nindex timeframes: ${passed}/${passed} checks passed`);
