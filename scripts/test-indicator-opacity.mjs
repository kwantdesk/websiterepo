import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { CHART_INDICATOR_CATALOG } = await import("../src/lib/chartIndicatorCatalog.ts");
const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

/**
 * An indicator arrives at full strength.
 *
 * A study that paints itself at 42% out of the box looks broken - the trader
 * turns it on, sees a wash, and assumes the data is thin rather than the
 * default. Anything drawing its OWN mark now starts solid and can be turned
 * down; the reverse is not discoverable.
 *
 * Area washes are deliberately excluded. A session background or a value-area
 * band at full strength is a solid block over the candles, which is not "more
 * visible", it is unusable.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** Keys that draw the indicator itself, as opposed to shading behind price. */
const PRIMARY = /^(opacity|lineOpacity|barOpacity|ladderOpacity|bandOpacity|borderOpacity|pocHighlightOpacity|shiftedPocOpacity)$/;
/** Deliberately left below full: these sit behind or around price. */
const AREA_WASH = new Set(["fillOpacity", "backgroundOpacity", "businessZoneOpacity"]);

check("every indicator's own mark defaults to full strength", () => {
  const faded = [];
  for (const definition of CHART_INDICATOR_CATALOG) {
    let settings;
    try {
      settings = defaultIndicatorSettings(definition.id) ?? {};
    } catch {
      continue;
    }
    for (const [key, value] of Object.entries(settings)) {
      if (!PRIMARY.test(key) || typeof value !== "number") continue;
      // Percent scales run to 100, normalised ones to 1. Both mean "full".
      const full = value <= 1 ? 1 : 100;
      if (value < full) faded.push(`${definition.id}.${key} = ${value}`);
    }
  }
  assert.deepEqual(faded, [], `these still arrive faded:\n  ${faded.join("\n  ")}`);
});

check("the numeric settings agree with the defaults they seed", () => {
  /*
   * The slider's own defaultValue is what a reset returns to. If it disagreed
   * with the object default, resetting would quietly fade the study again.
   */
  const config = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  const rows = config.matchAll(
    /\{ key: "([A-Za-z]+)", label: "([^"]*)", defaultValue: ([0-9.]+), min: ([0-9.]+), max: ([0-9.]+)/g,
  );
  const faded = [];
  for (const [, key, label, value, , max] of rows) {
    if (!PRIMARY.test(key)) continue;
    if (Number(value) < Number(max)) faded.push(`${key} "${label}" = ${value} (max ${max})`);
  }
  assert.deepEqual(faded, [], `sliders still default faded:\n  ${faded.join("\n  ")}`);
});

check("area washes are left alone, on purpose", () => {
  /*
   * Named explicitly rather than left implicit, so raising one later is a
   * decision someone makes rather than a sweep that catches it.
   */
  const config = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  for (const key of AREA_WASH) {
    assert.ok(config.includes(`${key}:`), `${key} vanished; the exclusion list is stale`);
  }
  assert.match(config, /fillOpacity: 10,/, "the session background became a solid block");
  assert.match(config, /businessZoneOpacity: 18,/, "the business zone became a solid block");
});

check("the drawn primitives start solid too", () => {
  // A default living in the renderer is just as much "stock" as one in config.
  for (const [file, what] of [
    ["bigBlocksPrimitive", "big blocks"],
    ["footprintPrimitive", "footprint cells"],
    ["smtDivergencePrimitive", "SMT divergence"],
  ]) {
    const source = readFileSync(new URL(`../src/lib/${file}.ts`, import.meta.url), "utf8");
    assert.match(source, /^ {2}opacity: 1,$/m, `${what} still defaults faded`);
  }
});

console.log(`\nindicator opacity: ${passed}/${passed} checks passed`);
