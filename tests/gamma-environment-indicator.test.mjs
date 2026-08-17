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

  assert.match(workspace, /gammaEnvironment=\{gammaEnvironmentIndicator \? currentGammaOverlay : null\}/);
  assert.match(workspace, /!expectedMoveIndicator && !gammaEnvironmentIndicator/);
  assert.match(chart, /aria-label="Gamma Environment"/);
  assert.match(chart, /gammaEnvironment\?\.label/);
  assert.match(chart, /gammaEnvironment\.stale \? "Last session" : "Live"/);
});
