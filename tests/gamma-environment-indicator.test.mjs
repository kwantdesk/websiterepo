import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Gamma Environment is a live rendered chart indicator", () => {
  const catalog = read("src/lib/chartIndicatorCatalog.ts");
  const config = read("src/lib/chartIndicatorConfig.ts");
  const control = read("src/components/ChartIndicatorsControl.tsx");

  assert.match(catalog, /indicator\("Gamma Environment", "Options Flow"/);
  assert.match(config, /LIVE_CHART_INDICATOR_IDS[\s\S]*?"gamma-environment"/);
  assert.match(config, /indicatorId === "gamma-environment"[\s\S]*?position: "top-right"/);
  assert.match(control, /RENDERED_CHART_INDICATOR_IDS[\s\S]*?"gamma-environment"/);
  assert.match(control, /<option value="top-middle">Top middle<\/option>/);
});

test("Gamma Environment reuses the authoritative chart gamma snapshot", () => {
  const workspace = read("src/components/KwantifyWorkspace.tsx");
  const chart = read("src/components/Chart.tsx");
  const conversion = read("src/lib/chartGammaConversion.ts");

  assert.match(workspace, /gammaEnvironment=\{gammaEnvironmentIndicator \? currentGammaEnvironment : null\}/);
  assert.match(workspace, /!expectedMoveIndicator && !gammaEnvironmentIndicator/);
  assert.match(workspace, /buildDirectGammaEnvironment/);
  assert.doesNotMatch(workspace, /gammaEnvironmentIndicator\s*&&\s*\(pane\.broker === "Market Index"/);
  assert.match(workspace, /directGammaEnvironmentConversion\.source/);
  assert.match(workspace, /payload\.marketOpen \? "LIVE NY OPTIONS" : "NEW YORK EOD"/);
  assert.match(conversion, /resolveDirectGammaEnvironmentConversion/);
  for (const ticker of ["SPX", "SPXW", "SPY", "NDX", "QQQ"]) {
    assert.match(conversion, new RegExp(`source === "${ticker}"|"${ticker}"`));
  }
  assert.match(chart, /aria-label="Gamma Environment"/);
  assert.match(chart, /gammaEnvironment\?\.label/);
  assert.match(chart, /gammaEnvironment\.stale \? "Last session" : "Live"/);
});

test("options charts share a batched low-latency quote feed and paint imperatively", () => {
  const workspace = read("src/components/KwantifyWorkspace.tsx");
  const client = read("src/lib/marketIndexLiveClient.ts");
  const server = read("src/lib/marketIndices.server.ts");

  assert.match(workspace, /subscribeMarketIndexSnapshot/);
  assert.match(workspace, /window\.dispatchEvent\(new CustomEvent\(LIVE_CHART_CANDLE_EVENT/);
  assert.match(workspace, /timestamp <= previousTimestamp/);
  assert.match(workspace, /marketIndexChartStateSyncAtRef\.current >= 5_000/);
  assert.match(client, /(?:vpsSymbols|legacySymbols|symbols)\.join\(","\)/);
  assert.match(client, /const LIVE_POLL_MS = 750/);
  assert.match(client, /let pollInFlight = false/);
  assert.match(client, /const pollStartedAt = Date\.now\(\)/);
  assert.match(client, /targetCadence - \(Date\.now\(\) - pollStartedAt\)/);
  assert.match(server, /MASSIVE_API_BASE}\/v3\/snapshot/);
  assert.match(server, /searchParams\.set\("ticker\.any_of", providerTickers\.join\(","\)\)/);
  assert.match(server, /new Set\(definitions\.map\(\(definition\) => definition\.providerTicker\)\)/);
  assert.match(server, /fetchMassiveMarketIndexFallback\(missingDefinitions\)/);
});
