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
  assert.match(mapRuntime, /LIQUIDITY_MAP_ROOTS/);
  assert.match(mapRuntime, /availableInstrumentSymbols/);
  assert.match(liquidityMap, /liquidityMapInstrument/);
  assert.match(mapRuntime, /normalizeLiquidityMapSymbol/);
});

test("LIQ MAP renders one standard loader until a real depth frame has painted", () => {
  const liquidityMap = read("src/components/liquidity-map/LiquidityMapWorkspace.tsx");
  const mapRuntime = read("public/heatmap-app/src/main.js");
  const liveMarket = read("public/heatmap-app/src/live-market.js");

  assert.match(liquidityMap, /KwantLoader/);
  assert.match(liquidityMap, /Loading LIQ MAP/);
  assert.match(liquidityMap, /kwantdesk:liquidity-map-ready/);
  assert.match(liquidityMap, /kwantdesk:liquidity-map-data-ready/);
  assert.match(mapRuntime, /kwantdesk:liquidity-map-ready/);
  assert.match(mapRuntime, /kwantdesk:liquidity-map-data-ready/);
  assert.match(liveMarket, /historical: true/);
  assert.match(liveMarket, /final: payload\.final !== false && index === snapshots\.length - 1/);
});

test("LIQ MAP instrument changes never restore the blocking full-screen loader", () => {
  const liquidityMap = read("src/components/liquidity-map/LiquidityMapWorkspace.tsx");
  const mapRuntime = read("public/heatmap-app/src/main.js");

  assert.doesNotMatch(
    liquidityMap,
    /useEffect\(\(\) => \{\s*setIsReady\(false\);\s*syncInstrument\(\)/,
  );
  assert.match(
    mapRuntime,
    /normalized === this\.symbol[\s\S]*kwantdesk:liquidity-map-ready/,
  );
});

test("LIQ MAP receives every active website theme, including new custom colours", () => {
  const liquidityMap = read("src/components/liquidity-map/LiquidityMapWorkspace.tsx");
  const mapRuntime = read("public/heatmap-app/src/main.js");
  const mapThemes = read("public/heatmap-app/src/ui-themes.js");

  assert.match(liquidityMap, /kwantdesk:liquidity-map-theme/);
  assert.match(liquidityMap, /kwantdesk:theme-change/);
  assert.match(liquidityMap, /readStoredTheme\(\)/);
  assert.match(mapRuntime, /kwantdesk:liquidity-map-theme/);
  assert.match(mapRuntime, /kwantdesk:liquidity-map-theme-request/);
  assert.match(liquidityMap, /event\.data\?\.type === "kwantdesk:liquidity-map-theme-request"[\s\S]*?syncTheme\(\)/);
  assert.match(liquidityMap, /event\.data\?\.type === "kwantdesk:liquidity-map-ready"[\s\S]*?syncTheme\(\)/);
  assert.match(mapRuntime, /setWebsiteThemeColors\(event\.data\.theme\)/);
  assert.match(mapThemes, /websiteThemeOverride/);
});
