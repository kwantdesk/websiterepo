import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calculateGammaExposure,
  expirationMatchesFilter,
  resolveMappedBinTicks,
  roundMappedPriceToTick,
  summarizeGammaRows,
} from "../src/lib/netGammaExposureMath.ts";

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
  assert.equal((catalog.match(/indicator\("Net Gamma Exposure By Strike", "Options Flow"/g) ?? []).length, 1);
  assert.match(config, /LIVE_CHART_INDICATOR_IDS[\s\S]*"net-gamma-exposure-by-strike"/);
  assert.match(controls, /RENDERED_CHART_INDICATOR_IDS[\s\S]*"net-gamma-exposure-by-strike"/);
  assert.match(workspace, /"tool-net-gamma-exposure-by-strike"/);
  assert.match(workspace, /indicatorId: "net-gamma-exposure-by-strike"/);
  assert.match(chart, /attachPrimitive\(netGammaExposurePrimitive\)/);
  assert.match(chart, /detachPrimitive\(netGammaExposurePrimitiveRef\.current\)/);
});

test("provider signs are preserved and net versus absolute concentration are distinct", () => {
  assert.match(engine, /calculateGammaExposure\(row\.call, row\.put\)/);
  assert.doesNotMatch(engine, /putExposure\s*\*\s*-1|row\.put\s*\*\s*-1/);
  assert.match(engine, /KwantData exposure is provider-signed; put exposure is not signed a second time/);
});

test("exposure math handles provider signs and missing legs", () => {
  assert.deepEqual(calculateGammaExposure(200, -150), {
    callExposure: 200,
    putExposure: -150,
    netExposure: 50,
    absoluteCallExposure: 200,
    absolutePutExposure: 150,
    absoluteTotalExposure: 350,
  });
  assert.equal(calculateGammaExposure(undefined, -25).netExposure, -25);
  assert.equal(calculateGammaExposure(40, null).netExposure, 40);
});

test("mapped prices round to display ticks and each binning mode is deterministic", () => {
  assert.deepEqual(roundMappedPriceToTick(20123.13, 0.25), { mappedDisplayTick: 80493, mappedDisplayPrice: 20123.25 });
  assert.equal(resolveMappedBinTicks({ mode: "exact-display-tick", tickSize: 0.25, mappedSpacings: [1, 2] }), 1);
  assert.equal(resolveMappedBinTicks({ mode: "custom-bin", tickSize: 0.25, mappedSpacings: [1, 2], customBinSizePoints: 2 }), 8);
  assert.equal(resolveMappedBinTicks({ mode: "auto-bin", tickSize: 0.25, mappedSpacings: [4, 8, 12] }), 8);
});

test("derived levels and total regime use the required signed definitions", () => {
  const row = (id, call, put) => ({ id, ...calculateGammaExposure(call, put) });
  const rows = [row("a", 200, -150), row("b", 25, -250), row("c", 500, -100), row("d", 10, -700)];
  const summary = summarizeGammaRows(rows);
  assert.equal(summary.maxPositiveRow?.id, "c");
  assert.equal(summary.maxNegativeRow?.id, "d");
  assert.equal(summary.dominantAbsoluteRow?.id, "d");
  assert.equal(summary.callWallRow?.id, "c");
  assert.equal(summary.putWallRow?.id, "d");
  assert.equal(summary.totalRegime, "negative");
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

test("every expiration mode selects the intended rows", () => {
  const base = { includeWeeklies: true, includeMonthlies: true, includeQuarterlies: true };
  const matches = (mode, expiration, extra = {}) => expirationMatchesFilter(expiration, "2026-08-14", { ...base, mode, ...extra }, "2026-08-14");
  assert.equal(matches("zero-dte", "2026-08-14"), true);
  assert.equal(matches("zero-dte", "2026-08-15"), false);
  assert.equal(matches("zero-to-one-dte", "2026-08-15"), true);
  assert.equal(matches("zero-to-seven-dte", "2026-08-21"), true);
  assert.equal(matches("front-expiration", "2026-08-14"), true);
  assert.equal(matches("all-expirations", "2026-09-18"), true);
  assert.equal(matches("custom-dte-range", "2026-08-19", { minimumDte: 3, maximumDte: 6 }), true);
  assert.equal(matches("specific-expirations", "2026-08-21", { expirationDates: ["2026-08-21"] }), true);
  assert.equal(expirationMatchesFilter("2026-08-20", "2026-08-14", { ...base, mode: "all-expirations", includeWeeklies: false }, null), false);
});

test("shared secure provider and shared strike mapper are reused", () => {
  assert.match(adapter, /getNetGammaExposureSurface/);
  assert.match(adapter, /quantDataPost\("\/options\/tool\/exposure-by-strike"/);
  assert.match(adapter, /parseExposure\(response\.payload, providerTicker, greekMode\)/);
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
  assert.match(primitive, /minimumAbsoluteExposure/);
  assert.match(primitive, /maximumDistanceFromSourceSpot/);
  assert.match(primitive, /textCache = new Map/);
  assert.match(primitive, /mergedLevels/);
});

test("settings expose presets, expirations, mapping confidence, geometry and display modes", () => {
  assert.match(config, /"net-gamma-exposure-by-strike": \[/);
  assert.match(config, /minimumMappingConfidence/);
  assert.match(config, /expirationMode: "zero-to-one-dte"/);
  assert.match(config, /placement: "floating"/);
  assert.match(config, /contentMode: "net"/);
  assert.match(config, /scaleMode: "visible-percentile"/);
  assert.match(config, /fadeWhenBelowMinimum: true/);
  assert.match(controls, /Balanced Net GEX/);
  assert.match(controls, /Specific expirations/);
  assert.match(config, /floatingXPercent: 50/);
  assert.match(controls, /Reset data/);
  assert.match(controls, /Reset visuals/);
  assert.match(controls, /Restore defaults/);
});

test("visual changes do not refetch provider data and requests are shared", () => {
  assert.match(chart, /const netGammaDataSettings = useMemo/);
  assert.match(chart, /fetchWorkspaceData<NetGammaProfileSnapshot>/);
  assert.match(chart, /\[instrument, netGammaDataSettings\]/);
  assert.doesNotMatch(route, /minimumAbsoluteExposure:/);
  assert.doesNotMatch(route, /maximumDistanceFromSourceSpot:/);
});

test("persistence migration clamps settings and strips secrets and snapshots", () => {
  assert.match(config, /netGammaSettingsVersion: 3/);
  assert.match(config, /apiKey/);
  assert.match(config, /liveSnapshot/);
  assert.match(config, /Number\.isFinite/);
});

test("all modes, status labels, and mapping limitations remain honest", () => {
  for (const mode of ["net", "net-with-call-put-detail", "call-put-split", "absolute-concentration", "net-change"]) assert.match(engine + config, new RegExp(`"${mode}"`));
  for (const mode of ["linear", "square-root", "logarithmic"]) assert.match(primitive + config, new RegExp(`"${mode}"`));
  assert.match(engine, /live-ratio fallback; it is not affine regression/);
  assert.match(engine, /smoothed NDX basis series/);
  assert.match(engine, /contract-specific futures calendar-spread mapping is unavailable/);
  assert.match(chart, /No qualifying rows/);
  assert.match(chart, /LIVE RATIO FALLBACK/);
});

test("native analytics route is exact, authenticated, bounded and live-only", () => {
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /x-kwantdesk-internal-analytics-token/);
  assert.match(route, /MAX_ROWS = 2_048/);
  assert.match(route, /MAX_TOTAL_CONTRIBUTIONS = 32_768/);
  assert.match(route, /familySources/);
  assert.match(route, /replayAsOfMs: null/);
  assert.doesNotMatch(route, /"asOf"/);
});
