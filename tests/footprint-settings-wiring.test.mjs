import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const control = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const primitive = fs.readFileSync(new URL("../src/lib/footprintPrimitive.ts", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/lib/footprintSettings.ts", import.meta.url), "utf8");
const build = fs.readFileSync(new URL("../src/lib/footprint.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/lib/footprintRuntime.ts", import.meta.url), "utf8");

const settingsTypeBody = settings.match(/export type FootprintSettings = \{([\s\S]*?)\n\};/)?.[1] ?? "";
const settingsKeys = [...settingsTypeBody.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)]
  .map((match) => match[1]);

test("every footprint setting has a default and a live runtime consumer", () => {
  const runtime = `${chart}\n${primitive}\n${build}`;
  for (const key of settingsKeys) {
    assert.match(settings, new RegExp(`\\b${key}:`), `${key} has a validated default`);
    if (key === "footprintSettingsVersion") continue;
    assert.match(runtime, new RegExp(`\\b${key}\\b`), `${key} reaches aggregation or rendering`);
  }
});

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
  assert.match(primitive, /options\.scaleMode === "all-loaded" && options\.allLoadedScaleMaximum > 0/);
  assert.match(primitive, /loadedScaleByTime/);
  assert.match(primitive, /visibleBars\.length <= options\.maximumDetailedVisibleBars/);
  assert.match(primitive, /const compactFits = rowHeight >= 7/);
  assert.match(primitive, /const fullBidAskFits = detailed/);
  assert.match(primitive, /const adaptiveProfileWidth = profileSideCount > 0/);
  assert.match(primitive, /options\.showImbalances && row\.isBidImbalance/);
  assert.match(primitive, /options\.markerAlignment === "right"/);
  assert.match(primitive, /options\.visualizationMode === "solid" \|\| options\.colorMode === "fixed"/);
  assert.match(primitive, /if \(options\.colorMode === "none"\) return 0/);
  assert.match(primitive, /1_000 \/ this\.renderOptions\.fpsLimit/);
  assert.match(chart, /return footprintVisibleCandles/);
  assert.match(runtime, /FOOTPRINT_DATA_REFRESH_INTERVAL_MS = 250/);
  assert.match(chart, /\? FOOTPRINT_DATA_REFRESH_INTERVAL_MS/);
  assert.match(workspace, /scheduleMarketTradeStateSync\(\)/);
  assert.match(workspace, /setMarketTrades\(latestMarketTradesRef\.current\)/);
  assert.doesNotMatch(chart, /Math\.round\(1_000 \/ footprintRefreshFps\)/);
  assert.doesNotMatch(workspace, /Math\.round\(1_000 \/ footprintRefreshFps\)/);
  assert.match(chart, /barWidth: clamp\([^\n]+, 28, 180\)/);
  assert.match(primitive, /options\.showBodyOutline \|\| options\.showBodyFill/);
  assert.match(primitive, /options\.colorCalculation === "dominant-delta"/);
});

test("per-bar volume and delta profiles share the footprint execution rows", () => {
  for (const key of [
    "showPerBarVolumeProfile",
    "showPerBarDeltaProfile",
    "perBarProfileScaleMode",
    "perBarProfileWidthPercent",
    "perBarProfileGap",
    "perBarProfileExtraSpacing",
    "perBarProfileOpacity",
    "showPerBarProfilePoc",
    "perBarProfilePocSize",
    "perBarProfileOutline",
  ]) {
    assert.match(control, new RegExp(`\\b${key}\\b`), `${key} is exposed in footprint settings`);
    assert.match(chart, new RegExp(`footprintSettings\\.${key}`), `${key} reaches the chart runtime`);
  }
  assert.match(primitive, /profileValues = bar\.rows\.map\(\(row\) => displayValues\(row, options\)\)/);
  assert.match(primitive, /values\.total \/ volumeDenominator/);
  assert.match(primitive, /Math\.abs\(values\.delta\) \/ deltaDenominator/);
  assert.match(primitive, /options\.showPerBarProfilePoc && row\.isPoc/);
  assert.match(primitive, /deltaLeft = left - options\.perBarProfileGap - deltaWidth/);
  assert.match(primitive, /volumeLeft = left \+ barWidth \+ options\.perBarProfileGap/);
  assert.match(primitive, /drawRightFacingVolumeProfileRow/);
  assert.match(primitive, /path\.roundRect\(x, y, width, rowHeight, \[0, radius, radius, 0\]\)/);
  assert.doesNotMatch(primitive, /context\.fillRect\(volumeLeft, profileTop, volumeWidth, profileHeight\)/);
  assert.match(chart, /const adaptiveProfileSpan = profileLayerEnabled/);
  assert.match(chart, /Math\.min\([\s\S]*42,[\s\S]*profileSideWidth \* profileSideCount/);
  assert.match(settings, /"order-flow": \{[\s\S]*showPerBarVolumeProfile: true,[\s\S]*showPerBarDeltaProfile: true/);
});

test("footprint preset and local-template selections remain controlled and persistent", () => {
  assert.match(control, /value=\{selectedFootprintPreset\}/);
  assert.match(control, /setSelectedFootprintPreset\(preset\)/);
  assert.match(control, /setSelectedFootprintTemplateId\(saved\?\.id \?\? ""\)/);
  assert.match(control, /saveFootprintSelection\(settingsInstance\.instanceId/);
  assert.match(settings, /FOOTPRINT_SELECTION_STORAGE_PREFIX/);
  assert.match(settings, /loadFootprintSelection/);
  assert.match(settings, /saveFootprintSelection/);
});
