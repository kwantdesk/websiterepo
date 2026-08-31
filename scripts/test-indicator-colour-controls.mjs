import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { CHART_INDICATOR_CATALOG } = await import("../src/lib/chartIndicatorCatalog.ts");
const { VOLUME_PROFILE_INDICATOR_IDS } = await import("../src/lib/chartIndicatorConfig.ts");
const { supportsPalette } = await import("../src/lib/indicatorPaletteRegistry.ts");
const { INDICATOR_GRADIENT_KEY } = await import("../src/lib/indicatorPalettes.ts");
const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

const control = readFileSync(
  new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8",
);

/**
 * One scheme picker per indicator, never two.
 *
 * The profiles carried "Gradient scheme" near the top of their dialog and
 * "Colour scheme" further down. Both wrote `gradientPreset`, so they were the
 * same setting twice over with no way to tell which was in charge - whichever
 * was clicked last silently moved the other, and turning one Off left the
 * other still reading as on.
 *
 * The dialog's own comment already said the shared section stepped aside for
 * the studies with hand-built blocks. Its gate did not.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const isTpo = (id) => id === "tpo-chart" || id === "weekly-tpo";
// Mirrors hasOwnPaletteSection in the dialog; the next check holds it there.
const handBuilt = (id) => VOLUME_PROFILE_INDICATOR_IDS.has(id) || isTpo(id) || id === "deep-print-footprint";

check("the dialog's own list is the one used here", () => {
  /*
   * A source check, because the alternative is this test agreeing with itself
   * while the dialog quietly grows a third hand-built block.
   */
  assert.match(
    control,
    /const hasOwnPaletteSection = \(id: string\) =>\s*\n\s*VOLUME_PROFILE_INDICATOR_IDS\.has\(id\) \|\| isTpoIndicator\(id\) \|\| id === "deep-print-footprint";/,
    "hasOwnPaletteSection is gone or covers different studies",
  );
});

check("the shared section steps aside for them", () => {
  assert.match(
    control,
    /\{indicatorSupportsPalette\(settingsDefinition\.id\)\s*\n\s*&& !hasOwnPaletteSection\(settingsDefinition\.id\) \? \(/,
    "the shared Colours section no longer excludes the hand-built studies",
  );
});

check("no indicator offers two scheme pickers", () => {
  const doubled = CHART_INDICATOR_CATALOG
    .map((definition) => definition.id)
    .filter((id) => handBuilt(id) && supportsPalette(id))
    // Both would render only if the shared gate stopped excluding them, which
    // the check above pins - so this asserts the pairing is understood, not
    // that it is impossible.
    .filter(() => !/&& !hasOwnPaletteSection\(settingsDefinition\.id\)/.test(control));
  assert.deepEqual(doubled, [], `these render two scheme pickers: ${doubled.join(", ")}`);
});

check("no indicator lost its only scheme picker", () => {
  /*
   * The fix removes a control. Every study that had one must still have one,
   * or this traded a duplicate for a missing setting.
   */
  const pickerCount = (id) =>
    Number(handBuilt(id)) + Number(supportsPalette(id) && !handBuilt(id));

  const orphaned = CHART_INDICATOR_CATALOG
    .map((definition) => definition.id)
    // A study that stores a scheme has to have somewhere to set it.
    .filter((id) => INDICATOR_GRADIENT_KEY in (defaultIndicatorSettings(id) ?? {}))
    .filter((id) => pickerCount(id) === 0);
  assert.deepEqual(orphaned, [], `these store a scheme with no way to set it: ${orphaned.join(", ")}`);

  for (const { id } of CHART_INDICATOR_CATALOG) {
    assert.ok(pickerCount(id) <= 1, `${id} offers ${pickerCount(id)} scheme pickers`);
  }
});

check("every profile and the footprint still have theirs", () => {
  // Their block is the one that survived, so it has to still be gated on them.
  assert.match(
    control,
    /\{VOLUME_PROFILE_INDICATOR_IDS\.has\(settingsDefinition\.id\)\s*\n\s*\|\| isTpoIndicator\(settingsDefinition\.id\) \? \(/,
    "the profiles' own gradient block is gone",
  );
  assert.ok(
    control.includes('{settingsDefinition.id === "deep-print-footprint" ? ('),
    "the footprint's own palette block is gone",
  );
});

check("both pickers wrote the same key, which is why this mattered", () => {
  // If they had written different keys this would have been two features, not
  // one duplicated. They did not.
  assert.equal(INDICATOR_GRADIENT_KEY, "gradientPreset");
  assert.ok(control.includes("gradientPreset: VOLUME_PROFILE_GRADIENT_OFF"), "the hand-built block writes another key now");
});

console.log(`\nindicator colour controls: ${passed}/${passed} checks passed`);
