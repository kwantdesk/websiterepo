import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("LIQ MAP participates in the persistent workspace navigation", () => {
  const sidebar = read("src/components/AppSidebar.tsx");
  const layout = read("src/app/(workspace)/layout.tsx");
  const workspace = read("src/components/KwantifyWorkspace.tsx");

  assert.match(sidebar, /PERSISTENT_WORKSPACE_KEYS[\s\S]*"liqmap"/);
  assert.match(layout, /"\/liqmap":\s*"liqmap"/);
  assert.match(workspace, /liqmap:\s*loadLiquidityMapWorkspace/);
  assert.match(workspace, /bottomWorkspaceSection === "liqmap"/);
});

test("LIQ MAP iframe is owned by the persistent shell and unmounts when inactive", () => {
  const root = new URL("../", import.meta.url);
  const workspace = read("src/components/KwantifyWorkspace.tsx");
  const liquidityMap = read("src/components/liquidity-map/LiquidityMapWorkspace.tsx");

  assert.equal(existsSync(new URL("src/app/liqmap/page.tsx", root)), false);
  assert.equal(existsSync(new URL("src/app/(workspace)/liqmap/page.tsx", root)), true);
  assert.match(liquidityMap, /src="\/heatmap-app\/index\.html"/);
  assert.doesNotMatch(workspace, /visitedWorkspaceSections\.has\("liqmap"\)/);
});

test("LIQ MAP watchlist selection is saved and sent into the iframe", () => {
  const workspace = read("src/components/KwantifyWorkspace.tsx");
  const liquidityMap = read("src/components/liquidity-map/LiquidityMapWorkspace.tsx");
  const mapRuntime = read("public/heatmap-app/src/main.js");

  assert.match(workspace, /LIQUIDITY_MAP_INSTRUMENT_STORAGE_KEY/);
  assert.match(workspace, /bottomWorkspaceSection === "liqmap"/);
  assert.match(workspace, /setSelectedLiquidityMapInstrument/);
  assert.match(liquidityMap, /kwantdesk:liquidity-map-symbol/);
  assert.match(mapRuntime, /kwantdesk:liquidity-map-symbol/);
  assert.match(mapRuntime, /requested === 'NQ' \|\| requested === 'MNQ'/);
  assert.match(mapRuntime, /requested === 'ES' \|\| requested === 'MES'/);
});

test("LIQ MAP renders one standard loader until a real depth frame has painted", () => {
  const liquidityMap = read("src/components/liquidity-map/LiquidityMapWorkspace.tsx");
  const mapRuntime = read("public/heatmap-app/src/main.js");
  const liveMarket = read("public/heatmap-app/src/live-market.js");

  assert.match(liquidityMap, /KwantLoader/);
  assert.match(liquidityMap, /Loading LIQ MAP/);
  assert.match(liquidityMap, /kwantdesk:liquidity-map-ready/);
  assert.match(mapRuntime, /kwantdesk:liquidity-map-ready/);
  assert.match(liveMarket, /historical: true/);
  assert.match(liveMarket, /final: index === snapshots\.length - 1/);
});
