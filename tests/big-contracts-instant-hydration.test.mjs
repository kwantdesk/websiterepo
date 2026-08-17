import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const chart = await fs.readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const workspace = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("Big Contracts paints an arriving execution archive without the live sampling delay", () => {
  assert.match(chart, /const executionTapeHydrated = \([\s\S]*?previousSampledTrades\.length === 0/);
  assert.match(chart, /historyShapeChanged \|\| orderFlowHydrated \|\| executionTapeHydrated/);
  assert.match(
    chart,
    /if \(historyShapeChanged \|\| orderFlowHydrated \|\| executionTapeHydrated\)[\s\S]*?setSampledIndicatorMarketTrades\(marketTrades\)/,
  );
});

test("persisted execution history restores independently of live network requests", () => {
  const cacheRestore = workspace.indexOf("void readExecutionTapeCache(pane.symbol, pane.timeframe).then");
  const liveCollector = workspace.indexOf("void fetchWorkspaceOrderFlow(", cacheRestore);
  const canonicalArchive = workspace.indexOf("void fetchWorkspaceHistoricalExecutions", cacheRestore);
  assert.ok(cacheRestore >= 0, "execution tape cache restore is missing");
  assert.ok(liveCollector > cacheRestore, "cache restore must start before the live collector");
  assert.ok(canonicalArchive > cacheRestore, "cache restore must start before canonical history");
  assert.match(
    workspace.slice(cacheRestore, canonicalArchive),
    /applyFlow\(latestOrderFlowCandlesRef\.current, cachedTape\.records\)/,
  );
});
