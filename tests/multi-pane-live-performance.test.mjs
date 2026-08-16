import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);
const stream = readFileSync(
  new URL("../src/lib/rithmicIndicatorStream.ts", import.meta.url),
  "utf8",
);
const renderer = readFileSync(
  new URL("../public/heatmap-app/src/renderer.js", import.meta.url),
  "utf8",
);

test("plain time charts do not duplicate the shared Rithmic execution workload", () => {
  assert.match(
    workspace,
    /requiresExecutionStream = needsOrderFlowHistory \|\| isEventBasedChartInterval\(pane\.timeframe\)/,
  );
  assert.match(workspace, /\|\| !requiresExecutionStream/);
  assert.match(workspace, /applyInstitutionalTradesToCandles\(/);
  assert.doesNotMatch(
    workspace,
    /records\.reduce\(\(current, record\) => mergeLiveMidIntoCandles/,
  );
});

test("one shared execution stream batches visual fanout without dropping its tape", () => {
  assert.match(stream, /TRADE_PUBLISH_INTERVAL_MS = 40/);
  assert.match(stream, /stream\.records = mergeRecords\(stream\.records, additions\)/);
  assert.match(stream, /queueTradePublication\(stream, additions\)/);
  assert.match(stream, /flushPendingTrades\(stream\)/);
  assert.match(stream, /if \(!stream\.seedPublished\)/);
  assert.match(stream, /stream\.seedPublished = true/);
  assert.match(stream, /STREAM_STALE_AFTER_MS = 20_000/);
  assert.match(stream, /source\.addEventListener\("heartbeat"/);
  assert.match(stream, /scheduleReconnect\(key, stream, symbol, contractSymbol\)/);
});

test("each pane losslessly coalesces execution work before copying tape and candles", () => {
  assert.match(workspace, /let pendingExecutionRecords: InstitutionalTrade\[\] = \[\]/);
  assert.match(workspace, /const flushExecutionRecords = \(\) =>/);
  assert.match(workspace, /pendingExecutionRecords\.push\(\.\.\.records\)/);
  assert.match(workspace, /footprintLiveActive \? 100 : 160/);
  assert.match(workspace, /onTrades: \(records\) => \{[\s\S]{0,160}queueExecutionUpdate\(records\)/);
});

test("sibling panes share one bounded execution tape instead of retaining duplicate archives", () => {
  assert.match(workspace, /MAX_WORKSPACE_EXECUTION_TAPES = 8/);
  assert.match(workspace, /function storeWorkspaceExecutionTape/);
  assert.match(workspace, /while \(workspaceExecutionTape\.size > MAX_WORKSPACE_EXECUTION_TAPES\)/);
  assert.match(workspace, /function mergeSharedWorkspaceExecutionTape/);
  assert.match(workspace, /const records = pendingExecutionRecords;[\s\S]{0,520}mergeSharedWorkspaceExecutionTape\([\s\S]{0,180}records/);
  assert.match(workspace, /if \(requiresExecutionStream\) return;[\s\S]{0,520}setMarketTrades/);
});

test("inactive TPO and removed studies release large derived execution arrays", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const tpoSamplingEnabled = useMemo/);
  assert.match(chart, /if \(!tpoSamplingEnabled\) return \[\]/);
  assert.match(chart, /return indicatorMarketTrades[\s\S]{0,520}aggressorSide/);
  assert.match(chart, /if \(indicatorSamplingEnabled\) return;[\s\S]{0,520}setSampledIndicatorMarketTrades\(\[\]\)/);
});

test("chart teardown detaches every heavy primitive before disposing its canvas", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const teardown = chart.slice(chart.indexOf("if (candleSeriesRef.current && tpoProfilePrimitiveRef.current)"));
  assert.ok(teardown.indexOf("detachPrimitive(tpoProfilePrimitiveRef.current)") < teardown.indexOf("chartRef.current.remove()"));
  assert.ok(teardown.indexOf("detachPrimitive(stackedImbalancePrimitiveRef.current)") < teardown.indexOf("chartRef.current.remove()"));
  assert.ok(teardown.indexOf("detachPrimitive(tapeSpeedPrimitiveRef.current)") < teardown.indexOf("chartRef.current.remove()"));
});

test("professional drawing invalidations are coalesced away from the live tape cadence", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /drawingDataRefreshTimerRef/);
  assert.match(chart, /window\.setTimeout\(\(\) => \{[\s\S]{0,240}drawing\.requestUpdate\(\)/);
  assert.match(chart, /\}, 200\)/);
});

test("live profiles and heatmap style work are throttled independently", () => {
  assert.match(workspace, /queueProfileUpdate\(records\)/);
  assert.match(workspace, /\}, 250\)/);
  assert.match(renderer, /lastFontStyleSyncAt/);
  assert.match(renderer, /now - this\.lastFontStyleSyncAt >= 1_000/);
});

test("visible quotes fan out once per display frame instead of at a fixed 10fps", () => {
  assert.match(workspace, /function scheduleLiveWatchlistPaint\(key: string\)/);
  assert.match(workspace, /liveWatchlistNotifyFrame = window\.requestAnimationFrame/);
  assert.doesNotMatch(workspace, /liveWatchlistNotifyTimers/);
});

test("a live candle frame clones history once while every tick still reaches execution", () => {
  assert.match(workspace, /mutateWorkingCopy = false/);
  assert.match(workspace, /const updated = mutateWorkingCopy \? candles : \[\.\.\.candles\]/);
  assert.match(workspace, /\), \[\.\.\.previous\]\);/);
  assert.match(workspace, /const currentLedger = paperLedgerRef\.current/);
  assert.match(workspace, /if \(executionChanged\) \{\s*syncPaperLedgerUi\(true\)/);
  assert.match(workspace, /showTradesMenu \|\| rightPanel === "order"[\s\S]{0,80}syncPaperLedgerUi\(false, 250\)/);
  assert.match(
    readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8"),
    /paperPositionOverlayPrimitiveRef\.current\?\.updateMarketQuote\(detail\)/,
  );
});

test("exchange quotes do not continuously reconcile the full workspace shell", () => {
  assert.match(workspace, /if \(!quoteBelongsToActivePane \|\| \(!showTradesMenu && rightPanel !== "order"\)\) return/);
  assert.match(workspace, /if \(quoteBelongsToActivePane && quote\.mid > 0\) liveGexCalibrationPriceRef\.current = quote\.mid/);
  assert.match(workspace, /watchlistRef\.current = next/);
  assert.match(workspace, /now - watchlistReactSyncAtRef\.current < 15_000/);
  assert.doesNotMatch(workspace, /setWatchlist\(\(current\) => \{[\s\S]{0,120}updates\.get/);
});
