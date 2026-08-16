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
    /const paperMarkPrice = candles\.at\(-1\)\?\.close \?\? null/,
  );
});

test("exchange quotes do not continuously reconcile the full workspace shell", () => {
  assert.match(workspace, /if \(!quoteBelongsToActivePane \|\| \(!showTradesMenu && rightPanel !== "order"\)\) return/);
  assert.match(workspace, /if \(quoteBelongsToActivePane && quote\.mid > 0\) liveGexCalibrationPriceRef\.current = quote\.mid/);
  assert.match(workspace, /watchlistRef\.current = next/);
  assert.match(workspace, /now - watchlistReactSyncAtRef\.current < 15_000/);
  assert.doesNotMatch(workspace, /setWatchlist\(\(current\) => \{[\s\S]{0,120}updates\.get/);
});
