import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [engine, primitive, route, adapter, chart, catalog, config, workspace, controls] = await Promise.all([
  read("src/lib/netGammaExposureByStrike.ts"),
  read("src/lib/netGammaExposurePrimitive.ts"),
  read("src/app/api/net-gamma-exposure-by-strike/route.ts"),
  read("src/lib/quantData.server.ts"),
  read("src/components/Chart.tsx"),
  read("src/lib/chartIndicatorCatalog.ts"),
  read("src/lib/chartIndicatorConfig.ts"),
  read("src/components/KwantifyWorkspace.tsx"),
  read("src/components/ChartIndicatorsControl.tsx"),
]);

test("Net Gamma Exposure has one stable indicator and chart-backed workspace tool", () => {
  assert.match(engine, /NET_GAMMA_EXPOSURE_BY_STRIKE_ID = "net-gamma-exposure-by-strike"/);
  assert.match(catalog, /indicator\("Net Gamma Exposure By Strike", "Options Flow"/);
  assert.match(config, /LIVE_CHART_INDICATOR_IDS[\s\S]*"net-gamma-exposure-by-strike"/);
  assert.match(controls, /RENDERED_CHART_INDICATOR_IDS[\s\S]*"net-gamma-exposure-by-strike"/);
  assert.match(workspace, /"tool-net-gamma-exposure-by-strike"/);
  assert.match(workspace, /indicatorId: "net-gamma-exposure-by-strike"/);
  assert.match(chart, /attachPrimitive\(netGammaExposurePrimitive\)/);
  assert.match(chart, /detachPrimitive\(netGammaExposurePrimitiveRef\.current\)/);
});

test("provider signs are preserved and net versus absolute concentration are distinct", () => {
  assert.match(engine, /const netExposure = row\.call \+ row\.put/);
  assert.match(engine, /absoluteTotalExposure: Math\.abs\(row\.call\) \+ Math\.abs\(row\.put\)/);
  assert.doesNotMatch(engine, /putExposure\s*\*\s*-1|row\.put\s*\*\s*-1/);
  assert.match(engine, /KwantData exposure is provider-signed; put exposure is not signed a second time/);
});

test("expiration aggregation covers the required modes without manufacturing rows", () => {
  for (const mode of ["zero-dte", "zero-to-one-dte", "zero-to-seven-dte", "front-expiration", "all-expirations", "custom-dte-range", "specific-expirations"]) {
    assert.match(engine, new RegExp(`"${mode}"`));
  }
  assert.match(engine, /surface\.expiryStrikes\.filter/);
  assert.match(engine, /current\.call \+=/);
  assert.match(engine, /current\.put \+=/);
  assert.match(engine, /expirationContributions/);
  assert.doesNotMatch(engine, /Math\.random|mockGamma|fakeGamma/i);
});

test("shared secure provider and shared strike mapper are reused", () => {
  assert.match(adapter, /getNetGammaExposureSurface/);
  assert.match(adapter, /quantDataPost\("\/options\/tool\/exposure-by-strike"/);
  assert.match(adapter, /parseExposure\(response\.payload, sourceTicker, "GAMMA"\)/);
  assert.match(engine, /buildGammaHeatmapMapping/);
  assert.match(engine, /mapGammaHeatmapStrike/);
  assert.match(route, /getNetGammaExposureSurface/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_.*QUANTDATA|NEXT_PUBLIC_.*DATABENTO/);
});

test("unsafe provider modes are disabled honestly", () => {
  assert.match(route, /provider !== "quantdata"/);
  assert.match(route, /disabled because the validated option definitions, IV and open-interest fields are not available/);
  assert.match(engine, /provider !== "quantdata"/);
});

test("renderer is Canvas-native, price aligned and below candles", () => {
  assert.match(primitive, /priceToCoordinate\(row\.mappedDisplayPrice\)/);
  assert.match(primitive, /return "bottom" as const/);
  assert.match(primitive, /positive \? rightCapacity : leftCapacity/);
  assert.match(primitive, /growsRight = data\.reverseDirections \? !positive : positive/);
  assert.match(primitive, /useMediaCoordinateSpace/);
  assert.doesNotMatch(primitive, /createElement|appendChild/);
});

test("settings expose presets, expirations, mapping confidence, geometry and display modes", () => {
  assert.match(config, /"net-gamma-exposure-by-strike": \[/);
  assert.match(config, /minimumMappingConfidence/);
  assert.match(config, /expirationMode: "zero-to-one-dte"/);
  assert.match(config, /placement: "right"/);
  assert.match(config, /contentMode: "net"/);
  assert.match(config, /scaleMode: "visible-percentile"/);
  assert.match(config, /fadeWhenBelowMinimum: true/);
  assert.match(controls, /Balanced Net GEX/);
  assert.match(controls, /Specific expirations/);
});
