import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_FOOTPRINT_CHART_TYPE,
  FOOTPRINT_CHART_TYPES,
  footprintChartType,
  footprintSettingApplies,
  footprintSettingSection,
  footprintVariant,
  footprintVariantSettings,
  groupFootprintSettingRows,
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

// --- a chart is not offered settings it cannot use ---
{
  // Imbalance compares the two sides, so it needs both sides to exist.
  assert.equal(footprintSettingApplies("imbalanceMode", "bid-ask"), true);
  for (const other of ["volume", "trades", "delta", "heatmap"]) {
    assert.equal(footprintSettingApplies("imbalanceMode", other), false,
      `${other} has no two sides to compare`);
    assert.equal(footprintSettingApplies("minimumRatio", other), false);
  }
  // The heatmap is read as colour, never as figures, and colour mode is what
  // it IS — neither may be offered there.
  for (const key of ["numberFormat", "minimumWidthToShowText", "colorMode"]) {
    assert.equal(footprintSettingApplies(key, "heatmap"), false, `${key} on a heatmap`);
    assert.equal(footprintSettingApplies(key, "volume"), true, `${key} on a volume chart`);
  }
  // Anything not spoken for applies everywhere.
  for (const type of FOOTPRINT_CHART_TYPES) {
    assert.equal(footprintSettingApplies("scaleMode", type.id), true);
    assert.equal(footprintSettingApplies("barWidth", type.id), true);
    assert.equal(footprintSettingApplies("somethingNewNobodyMapped", type.id), true,
      "an unmapped setting must still be offered, not silently hidden");
  }
}

// --- settings land under a tab, and the profile keys all land together ---
{
  assert.equal(footprintSettingSection("scaleMode"), "Scale");
  assert.equal(footprintSettingSection("groupingMode"), "Grouping");
  assert.equal(footprintSettingSection("imbalanceMode"), "Imbalance");
  assert.equal(footprintSettingSection("colorMode"), "Colours");
  assert.equal(footprintSettingSection("fpsLimit"), "Performance");
  for (const key of [
    "showPerBarVolumeProfile", "showPerBarDeltaProfile", "perBarProfileTicksPerRow",
    "perBarProfileOpacity", "perBarProfilePocColor", "perBarVolumeColor",
  ]) {
    assert.equal(footprintSettingSection(key), "Profile", `${key} belongs with the profile`);
  }
  // An unmapped key still gets a home rather than vanishing.
  assert.equal(footprintSettingSection("brandNewSetting"), "Cells");
}

// --- the dialog really is split into tabs, and reads cleanly ---
{
  const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  // These blocks are fixed; the setting sections are emitted per section from
  // groupFootprintSettingRows, so they carry the attribute dynamically.
  for (const section of ["View", "Profile", "Bar"]) {
    assert.ok(
      control.includes(`data-settings-section="${section}"`),
      `the footprint dialog needs a ${section} tab`,
    );
  }
  // The dropdowns are grouped into per-section blocks, filtered by chart.
  assert.match(control, /groupFootprintSettingRows\(/);
  // The old menu carried mojibake where the multiplication signs should be.
  assert.ok(!control.includes("Ã—"), "no mojibake in the indicator control");
}

// --- the settings really are split into tabs, per chart ---
{
  const rows = [
    ["Scale", "scaleMode", []],
    ["Tick grouping", "groupingMode", []],
    ["Grouping mode", "groupMode", []],
    ["Imbalance", "imbalanceMode", []],
    ["Number format", "numberFormat", []],
    ["Colour mode", "colorMode", []],
    ["Outline", "outsideBarStyle", []],
    ["Marker", "markerAlignment", []],
    ["FPS", "fpsLimit", []],
  ];
  const sectionsFor = (typeId) => groupFootprintSettingRows(rows, typeId).map(([section]) => section);

  // More than one block, or there are no tabs at all — which is what a nested
  // data-settings-section produced before: one long list.
  for (const type of FOOTPRINT_CHART_TYPES) {
    assert.ok(sectionsFor(type.id).length >= 4, `${type.id} must be split into tabs`);
  }
  // Only Bid x Ask can compare two sides.
  assert.ok(sectionsFor("bid-ask").includes("Imbalance"));
  for (const other of ["volume", "trades", "delta", "heatmap"]) {
    assert.ok(!sectionsFor(other).includes("Imbalance"), `${other} must not offer Imbalance`);
  }
  // The heatmap IS its colour mode, so it has no Colours tab.
  assert.ok(!sectionsFor("heatmap").includes("Colours"));
  assert.ok(sectionsFor("volume").includes("Colours"));
  // Reading order is fixed, so hiding a tab does not reshuffle the strip.
  const order = sectionsFor("bid-ask");
  assert.deepEqual(order, [...order].sort(
    (a, b) => ["Scale", "Grouping", "Cells", "Colours", "Imbalance", "Profile", "Performance"].indexOf(a)
      - ["Scale", "Grouping", "Cells", "Colours", "Imbalance", "Profile", "Performance"].indexOf(b),
  ), "tabs must keep a fixed reading order");
  // Every row that survives the filter lands in exactly one tab.
  const placed = groupFootprintSettingRows(rows, "bid-ask").flatMap(([, group]) => group.map((r) => r[1]));
  assert.equal(new Set(placed).size, placed.length, "a setting must not appear under two tabs");
  assert.equal(placed.length, rows.length, "no setting may be dropped on Bid x Ask");
}

// --- the blocks are siblings, not one nested lump ---
{
  const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  // IndicatorSettingsSections reads only DIRECT children, and a Fragment is a
  // single child: wrapping the group in one would collapse every tab into
  // "General", which is exactly the bug this replaced.
  const group = control.slice(control.indexOf("groupFootprintSettingRows(["));
  const emitted = group.slice(0, group.indexOf("))"));
  assert.ok(
    !emitted.includes("<>"),
    "the per-section blocks must not be wrapped in a Fragment",
  );
  assert.match(control, /data-settings-section=\{section\}/,
    "each emitted block carries its own section");
}

console.log("Footprint chart type, section and filter tests passed.");
