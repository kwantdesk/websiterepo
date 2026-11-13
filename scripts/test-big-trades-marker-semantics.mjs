import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bigContractMarkerSizes, sizeBigTradePrint } from "../src/lib/bigTrades.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

/**
 * A Big Contracts marker must report the size of a real execution, not the sum
 * of every qualifying print in a bar.
 *
 * DeepChart marks individual executions (its setting is TradeMinTrade), which
 * is why a marker there reads 50 or 20 and sits on the price that traded.
 * Aggregating instead produces a different quantity wearing the same label — a
 * measured 5m NQ bubble read 1,410 while the largest single execution behind
 * it was 76 — and places it at a volume-weighted price no trade occurred at.
 *
 * The two halves of that decision live in different files, and they disagreed:
 * the config declared the aggregate OFF while the renderer treated an absent
 * key as ON, so every chart saved before the key existed silently aggregated.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const defaults = defaultIndicatorSettings("big-trades");
const chartSource = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

check("the declared default keeps markers per execution", () => {
  assert.equal(
    defaults.combineByCandle, false,
    "combineByCandle must default off, or a marker reports a bar total rather than a trade",
  );
});

check("the renderer reads an absent key the same way", () => {
  assert.match(
    chartSource,
    /const combineByCandle = indicatorSettings\.combineByCandle === true;/,
    "the renderer must treat absent as OFF. Reading `!== false` flips the default for every "
    + "settings object saved before this key existed.",
  );
  assert.doesNotMatch(
    chartSource,
    /const combineByCandle = indicatorSettings\.combineByCandle !== false;/,
    "this is the inverted reading that silently aggregated old charts",
  );
});

check("normalisation does not reintroduce the aggregate", () => {
  const config = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  const assignments = [...config.matchAll(/combineByCandle:\s*(\w+)/g)].map((match) => match[1]);
  assert.ok(assignments.length > 0, "combineByCandle is not set anywhere in the config");
  for (const value of assignments) {
    assert.equal(value, "false", `combineByCandle is assigned "${value}" somewhere in the config`);
  }
});

check("per-bar marker count is high enough to show real prints", () => {
  // With aggregation off, this caps how many executions a bar may mark. Set
  // low, the biggest prints in a busy bar are dropped rather than merged.
  assert.ok(
    Number(defaults.maxMarkersPerBar) >= 20,
    `maxMarkersPerBar is ${defaults.maxMarkersPerBar}; too low and busy bars lose real prints`,
  );
});

check("default and saved markers stay compact without losing size ordering", () => {
  const legacy = { indicatorId: "big-trades", instanceId: "saved", enabled: true,
    settings: { bigTradesSettingsVersion: 6, minimumSize: 6, maximumSize: 32 } };
  const saved = normalizeStoredIndicator(legacy).settings;
  assert.deepEqual(bigContractMarkerSizes(saved), { minSize: 4, maxSize: 11 });
  assert.deepEqual(bigContractMarkerSizes(defaults), { minSize: 4, maxSize: 11 });
  const context = { ...bigContractMarkerSizes({ minimumSize: 80, maximumSize: 160 }),
    minOpacity: 0.25, maxOpacity: 0.9, scaleFor: () => ({ sizeFloor: 30, visualCeiling: 150 }) };
  assert.equal(sizeBigTradePrint({ timestamp: 0, volume: 150 }, context).radius, 14);
  const stock = { ...context, ...bigContractMarkerSizes(defaults) };
  assert.ok(sizeBigTradePrint({ timestamp: 0, volume: 150 }, stock).radius
    > sizeBigTradePrint({ timestamp: 0, volume: 30 }, stock).radius);
});

console.log(`\nbig trades marker semantics: ${passed}/${passed} checks passed`);
