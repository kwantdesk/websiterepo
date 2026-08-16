import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildExecutedVolumeProfile,
  calculateAnchoredVwap,
  calculateTradeRisk,
  extendRay,
  fibPrice,
  simplifyRdp,
  snapPrice,
} from "../src/chart/precision-tools/math.ts";
import { PRECISION_TOOL_GROUPS, PRECISION_TOOL_REGISTRY } from "../src/chart/precision-tools/registry.ts";

const root = process.cwd();
const precisionRoot = join(root, "src", "chart", "precision-tools");
const read = (file) => readFileSync(join(root, file), "utf8");

test("Precision Tools registry contains exactly the 17 specified independent tools", () => {
  const expected = [
    "precision-line", "precision-ray", "precision-horizontal-line", "precision-vertical-line", "precision-parallel-line",
    "precision-rectangle", "precision-ellipse", "precision-text", "precision-pencil",
    "precision-fibonacci-retracement", "precision-fibonacci-projection", "precision-fibonacci-fan",
    "precision-ruler", "precision-volume-profile", "precision-anchored-vwap",
    "precision-buy-calculator", "precision-sell-calculator",
  ];
  assert.deepEqual([...PRECISION_TOOL_REGISTRY.keys()], expected);
  assert.equal(PRECISION_TOOL_GROUPS.length, 5);
  assert.deepEqual(PRECISION_TOOL_GROUPS.map((group) => group.toolIds.length), [5, 4, 3, 3, 2]);
});

test("every Precision tool owns exactly nine complete configuration slots", () => {
  const defaults = read("src/chart/precision-tools/defaults.ts");
  assert.match(defaults, /Array\.from\(\{ length: 9 \}/);
  assert.match(defaults, /mode: "volume-and-delta"/);
  assert.match(defaults, /valueAreaPercent: 70/);
  assert.match(defaults, /band5Multiplier: 5/);
  assert.match(defaults, /band5Enabled: false/);
});

test("Precision domain never imports the legacy drawing implementation", () => {
  const files = readdirSync(precisionRoot).filter((file) => /\.(ts|tsx)$/.test(file));
  for (const file of files) {
    const source = readFileSync(join(precisionRoot, file), "utf8");
    assert.doesNotMatch(source, /professionalDrawingEngine|kwantify-chart-drawings|chart-drawings\?/i, file);
  }
  assert.match(read("src/components/Chart.tsx"), /PrecisionToolsLayer/);
  assert.match(read("src/components/Chart.tsx"), /professionalDrawingEngine/);
});

test("storage namespaces and account-backed API are independent", () => {
  const persistence = read("src/chart/precision-tools/persistence.ts");
  assert.match(persistence, /kwantdesk:precision-tools:v1/);
  assert.match(persistence, /kwantdesk:precision-tool-configs:v1/);
  assert.match(persistence, /kwantdesk:precision-toolbar:v1/);
  const route = read("src/app/api/precision-tools/route.ts");
  assert.match(route, /precision_tool_documents/);
  assert.match(route, /user_preferences/);
  assert.match(route, /account-preferences/);
  assert.match(route, /getRouteActor/);
  const preferences = read("src/lib/userPreferences.ts");
  assert.match(preferences, /kwantdesk:precision-tools:v1:/);
  assert.match(preferences, /kwantdesk:precision-tool-configs:v1:/);
  assert.match(preferences, /kwantdesk:precision-toolbar:v1:/);
  const migration = read("supabase/migrations/202608150001_create_precision_tool_documents.sql");
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/);
});

test("price snap and ray extension are deterministic", () => {
  assert.equal(snapPrice(30000.13, 0.25, 2), 30000.25);
  assert.deepEqual(extendRay({ x: 10, y: 10 }, { x: 20, y: 20 }, 100, 80), { x: 80, y: 80 });
  assert.equal(fibPrice(100, 200, 0.618), 161.8);
  assert.equal(fibPrice(100, 200, 0.618, true), 138.2);
});

test("precision drawings can be selected anywhere on their rendered geometry", () => {
  const hitTesting = read("src/chart/precision-tools/hitTesting.ts");
  assert.match(hitTesting, /precision-fibonacci-retracement/);
  assert.match(hitTesting, /Math\.min\(\.\.\.ys\)/);
  assert.match(hitTesting, /precision-fibonacci-fan/);
  assert.match(hitTesting, /precision-volume-profile/);
  assert.match(hitTesting, /precision-parallel-line/);
});

test("pencil RDP removes redundant points while preserving endpoints", () => {
  const result = simplifyRdp([{ x: 0, y: 0 }, { x: 5, y: 0.1 }, { x: 10, y: 0 }], 0.2);
  assert.deepEqual(result, [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
});

test("executed range profile uses actual trade rows and calculates POC/value area", () => {
  const trades = [
    { timestamp: 1000, open: 100, high: 100, low: 100, close: 100, volume: 10, bidVolume: 4, askVolume: 6, delta: 2, trades: 1, aggressor: "BUY", recordIndex: 0 },
    { timestamp: 2000, open: 100.25, high: 100.25, low: 100.25, close: 100.25, volume: 30, bidVolume: 20, askVolume: 10, delta: -10, trades: 2, aggressor: "SELL", recordIndex: 1 },
    { timestamp: 3000, open: 100.5, high: 100.5, low: 100.5, close: 100.5, volume: 5, bidVolume: 1, askVolume: 4, delta: 3, trades: 1, aggressor: "BUY", recordIndex: 2 },
  ];
  const profile = buildExecutedVolumeProfile(trades, 0, 5000, 0.25, 48, 70);
  assert.equal(profile.source, "executed-trades");
  assert.equal(profile.totalVolume, 45);
  assert.equal(profile.poc, 100.25);
  assert.ok(profile.vah >= profile.val);
  assert.equal(profile.rows.reduce((sum, row) => sum + row.delta, 0), -5);
  assert.equal(buildExecutedVolumeProfile([], 0, 1, 0.25, 48, 70).source, "unavailable");
});

test("anchored VWAP uses real bar volume and omits volume-less bars", () => {
  const points = calculateAnchoredVwap([
    { timestamp: 1000, open: 9, high: 11, low: 9, close: 10, volume: 10 },
    { timestamp: 2000, open: 19, high: 21, low: 19, close: 20, volume: 30 },
    { timestamp: 3000, open: 99, high: 101, low: 99, close: 100 },
  ], 1000);
  assert.equal(points.length, 2);
  assert.equal(points[1].value, 17.5);
  assert.ok(points[1].sd1 >= 0);
  assert.equal(points[1].sd5, points[1].deviation * 5);
  const closeSource = calculateAnchoredVwap([
    { timestamp: 1000, open: 1, high: 10, low: 0, close: 8, volume: 10 },
  ], 1000, "close");
  assert.equal(closeSource[0].value, 8);
});

test("trade calculators respect futures tick size and point value", () => {
  const result = calculateTradeRisk({
    toolId: "precision-buy-calculator",
    anchors: [
      { time: 1, logicalIndex: 1, price: 20000 },
      { time: 2, logicalIndex: 2, price: 19990 },
      { time: 3, logicalIndex: 3, price: 20030 },
    ],
    options: { accountSize: 50000, riskPercent: 1, commissionPerContract: 0, slippageTicks: 0, quantityOverride: 0 },
  }, 0.25, 20);
  assert.equal(result.valid, true);
  assert.equal(result.riskTicks, 40);
  assert.equal(result.riskPerContract, 200);
  assert.equal(result.quantity, 2);
  assert.equal(result.rMultiple, 3);
  const invalid = calculateTradeRisk({ ...result, toolId: "precision-sell-calculator", anchors: [
    { time: 1, logicalIndex: 1, price: 100 }, { time: 2, logicalIndex: 2, price: 90 }, { time: 3, logicalIndex: 3, price: 110 },
  ], options: {} }, 0.25, 20);
  assert.equal(invalid.valid, false);
  const tickOnly = calculateTradeRisk({
    toolId: "precision-buy-calculator",
    anchors: [
      { time: 1, logicalIndex: 1, price: 100 }, { time: 2, logicalIndex: 2, price: 99 }, { time: 3, logicalIndex: 3, price: 102 },
    ],
    options: { quantityMode: "fixed", quantity: 3 },
  }, 0.25, 0);
  assert.equal(tickOnly.valid, true);
  assert.equal(tickOnly.quantity, 3);
  assert.equal(tickOnly.riskTicks, 4);
  assert.equal(tickOnly.monetaryAvailable, false);
});

test("Precision renderer has all analytical and geometry branches", () => {
  const renderer = read("src/chart/precision-tools/renderer.ts");
  for (const toolId of PRECISION_TOOL_REGISTRY.keys()) assert.match(renderer, new RegExp(toolId));
  assert.match(renderer, /buildExecutedVolumeProfile/);
  assert.match(renderer, /calculateAnchoredVwap/);
  assert.match(renderer, /calculateTradeRisk/);
});

test("interaction arbiter exposes three neutral owners", () => {
  const source = read("src/lib/chartInteractionArbiter.ts");
  assert.match(source, /"chart" \| "legacy-tools" \| "precision-tools"/);
  assert.match(read("src/components/Chart.tsx"), /claimChartInteraction\("legacy-tools"\)/);
  assert.match(read("src/chart/precision-tools/PrecisionToolsLayer.tsx"), /claimChartInteraction\("precision-tools"\)/);
});

test("the old movable rail owns the selected Precision tools and hides the second rail", () => {
  const chart = read("src/components/Chart.tsx");
  const layer = read("src/chart/precision-tools/PrecisionToolsLayer.tsx");
  assert.match(chart, /brush: "precision-pencil"/);
  assert.match(chart, /longPosition: "precision-buy-calculator"/);
  assert.match(chart, /shortPosition: "precision-sell-calculator"/);
  assert.match(chart, /volumeProfile: "precision-volume-profile"/);
  assert.match(chart, /activeDrawingTool\("volumeProfile", "Volume Profile"/);
  assert.match(chart, /showChrome=\{false\}/);
  assert.match(chart, /externalSelectionMode=\{selectedTool === "selection"\}/);
  assert.match(chart, /Select drawings with a drag box/);
  assert.match(chart, /selectedToolRef\.current = tool\.id;\s+setSelectedTool\(tool\.id\);/);
  assert.match(layer, /onExternalSelectionBox/);
  assert.match(layer, /mergeHydratedPrecisionObjects\(payload\.objects, objectsChangedDuringHydration\)/);
  assert.match(layer, /useLayoutEffect\(\(\) => \{\s+if \(externalActiveTool\)/);
  assert.match(layer, /closestIndex = -1/);
  assert.match(layer, /adapter\.yToPrice\(y\)/);
  assert.match(layer, /Math\.max\(\.\.\.xs\) >= left/);
  assert.match(layer, /showChrome \? <PrecisionRail/);
});
