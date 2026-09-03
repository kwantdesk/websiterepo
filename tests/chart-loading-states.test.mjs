import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

test("every workspace chart keeps a loader over empty candle state", () => {
  assert.match(workspace, /const chartIsLoading = chartNeedsLoadingCover\(\{/);
  assert.match(workspace, /settledRequestKey: settledChartRequestKey/);
  assert.match(workspace, /Cached rows may be used as merge input[\s\S]*?setLoading\(true\);/);
  assert.match(workspace, /if \(cachedIsHydrated\) \{[\s\S]*?setSettledChartRequestKey\(requestedChartHydrationKey\)/);
  assert.match(workspace, /data-chart-loading="true"/);
  assert.match(workspace, /title="Loading chart"/);
  assert.match(workspace, /chartIsLoading \? \(/);
});

test("chart construction and workspace module transitions both show loaders", () => {
  assert.match(chart, /!chartVisualReady \? \(/);
  assert.match(chart, /title="Loading chart"/);
  assert.match(workspace, /data-workspace-panel-loading=\{pendingPanel\.id\}/);
  assert.match(workspace, /title=\{`Loading \$\{pendingPanel\.label\}`\}/);
});
