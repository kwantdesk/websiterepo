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
  assert.match(workspace, /syncPaperLedgerUi\(executionChanged\)/);
});
