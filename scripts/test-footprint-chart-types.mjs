import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_FOOTPRINT_CHART_TYPE,
  FOOTPRINT_CHART_TYPES,
  footprintChartType,
  footprintVariant,
  footprintVariantSettings,
} from "../src/lib/footprintChartTypes.ts";
import { validateFootprintSettings } from "../src/lib/footprintSettings.ts";

/**
 * A trader picks the chart, then the variant. The engine switches behind them
 * — content, visualisation, colour calculation, input type — used to be four
 * independent dropdowns, so most combinations produced nothing anyone wanted
 * and the named views were unreachable without knowing the recipe.
 */

// --- the five charts, each with variants that name a real view ---
{
  assert.deepEqual(
    FOOTPRINT_CHART_TYPES.map((type) => type.id),
    ["volume", "trades", "bid-ask", "delta", "heatmap"],
  );
  for (const type of FOOTPRINT_CHART_TYPES) {
    assert.ok(type.variants.length >= 3, `${type.id} needs its variants`);
    assert.ok(type.description.length > 10, `${type.id} needs a description`);
    const ids = type.variants.map((variant) => variant.id);
    assert.equal(new Set(ids).size, ids.length, `${type.id} has a duplicate variant id`);
    for (const variant of type.variants) {
      assert.ok(variant.label.length > 0 && variant.description.length > 10,
        `${type.id}/${variant.id} needs a label and description`);
    }
  }
  // Variant ids are unique across the whole catalog, so a stored id is
  // unambiguous even if the type is ever lost.
  const all = FOOTPRINT_CHART_TYPES.flatMap((type) => type.variants.map((v) => v.id));
  assert.equal(new Set(all).size, all.length, "variant ids must be unique across types");
}

// --- every variant resolves to a mode the renderer actually draws ---
{
  const types = readFileSync(new URL("../src/lib/footprintTypes.ts", import.meta.url), "utf8");
  const contentModes = [...types.matchAll(/\n  \| "([a-z-]+)"/g)].map((m) => m[1]);
  const primitive = readFileSync(new URL("../src/lib/footprintPrimitive.ts", import.meta.url), "utf8");
  for (const type of FOOTPRINT_CHART_TYPES) {
    for (const variant of type.variants) {
      const { contentMode, visualizationMode } = variant.settings;
      assert.ok(contentModes.includes(contentMode),
        `${type.id}/${variant.id}: "${contentMode}" is not a declared content mode`);
      assert.ok(
        ["solid", "heatmap", "histogram", "heatmap-histogram", "text-only"].includes(visualizationMode),
        `${type.id}/${variant.id}: "${visualizationMode}" is not a visualisation mode`,
      );
    }
  }
  // The two modes added for these views must be handled, not merely declared.
  assert.ok(primitive.includes('contentMode === "trades-histogram"'),
    "the renderer must count trades for the trades histogram");
  assert.ok(primitive.includes('contentMode === "volume-trades"'),
    "the renderer must print volume beside trade count");
}

// --- a histogram and a digital histogram differ only in the figures ---
{
  for (const [typeId, plain, digital] of [
    ["volume", "volume-histogram", "volume-digital-histogram"],
    ["trades", "trades-histogram", "trades-digital-histogram"],
    ["bid-ask", "bid-ask-histogram", "bid-ask-digital-histogram"],
  ]) {
    const bars = footprintVariantSettings(typeId, plain);
    const figures = footprintVariantSettings(typeId, digital);
    assert.equal(bars.showCellText, false, `${plain} must not print figures`);
    assert.equal(figures.showCellText, true, `${digital} must print figures`);
    assert.equal(bars.contentMode, figures.contentMode, "and must otherwise be the same view");
    assert.equal(bars.visualizationMode, figures.visualizationMode);
  }
}

// --- switching view clears the previous view's profile switches ---
{
  // Bid × Ask volume profile turns the side profile on; moving to another
  // view must not leave it there.
  const withProfile = footprintVariantSettings("bid-ask", "bid-ask-volume-profile");
  assert.equal(withProfile.showPerBarVolumeProfile, true);
  const after = footprintVariantSettings("delta", "delta");
  assert.equal(after.showPerBarVolumeProfile, false, "the previous view's profile must be cleared");
  assert.equal(after.showPerBarDeltaProfile, false);
  // And a view that wants the delta profile still gets it.
  assert.equal(footprintVariantSettings("delta", "delta-profile").showPerBarDeltaProfile, true);
}

// --- the trader's own tuning survives a view change ---
{
  const owned = new Set(FOOTPRINT_CHART_TYPES.flatMap((type) =>
    type.variants.flatMap((variant) => Object.keys(variant.settings))));
  for (const key of ["manualTicks", "barWidth", "fontSize", "perBarProfileTicksPerRow", "bidColor", "askColor"]) {
    assert.ok(!owned.has(key), `${key} belongs to the trader, not to a variant`);
  }
}

// --- unknown ids never leave the footprint in a combination nobody picked ---
{
  assert.equal(footprintChartType("nonsense").id, DEFAULT_FOOTPRINT_CHART_TYPE);
  assert.equal(footprintChartType(undefined).id, DEFAULT_FOOTPRINT_CHART_TYPE);
  assert.equal(footprintVariant("volume", "nonsense").id, "volume",
    "an unknown variant falls back to the type's first");
  const settings = validateFootprintSettings({ chartType: "nope", chartVariant: "nope" });
  assert.equal(settings.chartType, DEFAULT_FOOTPRINT_CHART_TYPE);
  assert.ok(footprintChartType(settings.chartType).variants.some((v) => v.id === settings.chartVariant));
  // A real pair survives validation untouched.
  const kept = validateFootprintSettings({ chartType: "trades", chartVariant: "trades-histogram" });
  assert.equal(kept.chartType, "trades");
  assert.equal(kept.chartVariant, "trades-histogram");
}

console.log("Footprint chart type tests passed.");
