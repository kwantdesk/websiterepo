import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const control = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const primitive = fs.readFileSync(new URL("../src/lib/footprintPrimitive.ts", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/lib/footprintSettings.ts", import.meta.url), "utf8");

test("every exposed footprint mode is connected to the live chart options", () => {
  for (const key of [
    "contentMode",
    "visualizationMode",
    "scaleMode",
    "inputType",
    "groupingMode",
    "groupMode",
    "imbalanceMode",
    "numberFormat",
    "colorMode",
    "colorCalculation",
    "outsideBarStyle",
    "markerAlignment",
    "fpsLimit",
  ]) {
    assert.match(control, new RegExp(`"${key}"`), `${key} is exposed`);
    assert.match(chart, new RegExp(`footprintSettings\\.${key}`), `${key} reaches Chart`);
  }
});

test("all footprint numeric controls feed aggregation, rendering, or performance", () => {
  for (const key of [
    "barWidth", "candleSpacing", "autoGroupFactor", "manualTicks",
    "minimumTradeVolume", "maximumTradeVolume", "minimumImbalancePercent",
    "minimumDominantVolume", "minimumDelta", "stackedImbalanceLevels",
    "unfinishedAuctionMinimumVolume", "valueAreaPercent", "backgroundOpacity",
    "minimumOpacity", "maximumOpacity", "gradientExponent", "visibleRegionPercentile",
    "fixedMaximum", "borderWidth", "fontSize", "fontWeight",
    "minimumWidthToShowText", "minimumRowHeightToShowText", "dynamicTextIncrease",
    "singlePrintMaximum", "minimumRatio", "maximumRatio", "clusterMinimumVolume",
    "maximumRetainedBars", "maximumDetailedVisibleBars",
  ]) {
    assert.match(chart, new RegExp(`footprintSettings\\.${key}`), `${key} reaches the live chart`);
    assert.match(settings, new RegExp(`${key}:`), `${key} is validated and defaulted`);
  }
});

test("previously disconnected footprint controls now change renderer behavior", () => {
  assert.match(primitive, /options\.scaleMode === "all-loaded" \? allBars : visibleBars/);
  assert.match(primitive, /visibleBars\.length <= options\.maximumDetailedVisibleBars/);
  assert.match(primitive, /options\.showImbalances && row\.isBidImbalance/);
  assert.match(primitive, /options\.markerAlignment === "right"/);
  assert.match(primitive, /options\.visualizationMode === "solid" \|\| options\.colorMode === "fixed"/);
  assert.match(primitive, /if \(options\.colorMode === "none"\) return 0/);
  assert.match(primitive, /1_000 \/ this\.renderOptions\.fpsLimit/);
  assert.match(chart, /footprintSettings\.scaleMode !== "all-loaded"/);
});
