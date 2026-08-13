import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const chart = await fs.readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const workspace = await fs.readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("CVD waits for a verified historical order-flow baseline after refresh", () => {
  assert.match(workspace, /const \[orderFlowHistoryReady, setOrderFlowHistoryReady\] = useState\(false\)/);
  assert.match(workspace, /immediateOrderFlowHistoryReady = !needsOrderFlowHistory[\s\S]*?hasUsableOrderFlowHistory\(immediateHydratedCandles\)/);
  assert.match(workspace, /orderFlowHistoryReady=\{orderFlowHistoryReady\}/);
  assert.match(chart, /!orderFlowHistoryReady[\s\S]*?"cumulative-volume-delta"[\s\S]*?return \[\]/);
  assert.match(chart, /Restoring cumulative volume delta history\./);
});

test("verified cached and downloaded flow release CVD without blocking price history", () => {
  assert.match(workspace, /if \(hasUsableOrderFlowHistory\(cachedCandles\)\) setOrderFlowHistoryReady\(true\)/);
  assert.match(workspace, /setOrderFlowHistoryReady\(hasUsableOrderFlowHistory\(mergedCandles\)\)/);
  assert.match(workspace, /setCandles\(hasImmediateHistory \? immediateHydratedCandles : \[\]\)/);
  assert.match(workspace, /immediateHydratedCandles = needsOrderFlowHistory[\s\S]*?applyAvailableOrderFlowHistory\([\s\S]*?immediateMarketTrades/);
});

test("verified Rithmic seed and live buckets release CVD if the archive backfill is delayed", () => {
  assert.match(workspace, /onSeed:[\s\S]*?seededCandles[\s\S]*?hasUsableOrderFlowHistory\(seededCandles\)[\s\S]*?setOrderFlowHistoryReady\(true\)/);
  assert.match(workspace, /onTrades:[\s\S]*?hasUsableOrderFlowHistory\(nextCandles\)[\s\S]*?setOrderFlowHistoryReady\(true\)/);
  assert.match(workspace, /enrichCandlesWithInstitutionalTrades\([\s\S]*?records/);
});

test("CVD and Volume repaint immediately with hydrated candle history", () => {
  assert.match(chart, /const historyShapeChanged = \([\s\S]*?previousCandles\.length !== candles\.length/);
  assert.match(chart, /const orderFlowHydrated = \([\s\S]*?orderFlowHistoryReady/);
  assert.match(chart, /if \(historyShapeChanged \|\| orderFlowHydrated\)[\s\S]*?setSampledIndicatorCandles\(candles\)[\s\S]*?setSampledIndicatorMarketTrades\(marketTrades\)/);
});

test("an early order-flow response is reapplied when base candles arrive and survive tail repair", () => {
  assert.match(workspace, /latestOrderFlowCandlesRef\.current = orderFlowCandles;[\s\S]*?if \(!latestCandlesRef\.current\.length\) return/);
  assert.match(workspace, /baseCandles = applyAvailableOrderFlowHistory\([\s\S]*?latestOrderFlowCandlesRef\.current/);
  assert.match(workspace, /writeChartHistoryCache\(pane\.symbol, pane\.timeframe, cachedCandles\)/);
  assert.match(workspace, /repaired = needsOrderFlowHistory[\s\S]*?applyAvailableOrderFlowHistory\([\s\S]*?latestOrderFlowCandlesRef\.current/);
});
