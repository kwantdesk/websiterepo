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
const chartHistoryCache = readFileSync(
  new URL("../src/lib/chartHistoryCache.ts", import.meta.url),
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
  assert.match(workspace, /footprintLiveActive \? 125 : 200/);
  assert.match(workspace, /LIVE_CHART_EXECUTION_EVENT/);
  assert.match(workspace, /tape: next/);
  assert.match(workspace, /footprintLiveActive[\s\S]{0,120}\? 1_500/);
  assert.match(workspace, /footprintLiveActive && !nonFootprintOrderFlowActive\) return/);
  assert.match(workspace, /onTrades: \(records\) => \{[\s\S]{0,160}queueExecutionUpdate\(records\)/);
});

test("sibling panes share one bounded execution tape instead of retaining duplicate archives", () => {
  assert.match(workspace, /MAX_WORKSPACE_EXECUTION_TAPES = 8/);
  assert.match(workspace, /function storeWorkspaceExecutionTape/);
  assert.match(workspace, /while \(workspaceExecutionTape\.size > MAX_WORKSPACE_EXECUTION_TAPES\)/);
  assert.match(workspace, /function mergeSharedWorkspaceExecutionTape/);
  assert.match(workspace, /workspaceExecutionBatchResults = new WeakMap/);
  assert.match(workspace, /completedBatch\?\.key === key/);
  assert.match(workspace, /incomingTail\.timestamp <= sharedTailRecord\.timestamp/);
  assert.match(workspace, /workspaceExecutionIdentity\(sharedTape\[index\]\)/);
  assert.match(workspace, /const records = pendingExecutionRecords;[\s\S]{0,520}mergeSharedWorkspaceExecutionTape\([\s\S]{0,180}records/);
  assert.match(workspace, /if \(requiresExecutionStream\) return;[\s\S]{0,520}setMarketTrades/);
});

test("inactive TPO and removed studies release large derived execution arrays", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const tpoSamplingEnabled = useMemo/);
  assert.match(chart, /if \(!tpoSamplingEnabled\) return \[\]/);
  assert.match(
    chart,
    /const tpoSourceBars = useMemo<TpoBar\[\]>\(\(\) => \{\s*\/\/[\s\S]{0,360}if \(!tpoSamplingEnabled\) return \[\]/,
  );
  assert.match(chart, /return indicatorMarketTrades[\s\S]{0,520}aggressorSide/);
  assert.match(chart, /if \(indicatorSamplingEnabled\) return;[\s\S]{0,520}setSampledIndicatorMarketTrades\(\[\]\)/);
});

test("multi-timeframe panes share one bounded execution cache without full-store clones", () => {
  assert.match(chartHistoryCache, /return `tape-v3::\$\{symbol\}`/);
  assert.match(chartHistoryCache, /MAX_MEMORY_HISTORY_RECORDS = 12/);
  assert.match(chartHistoryCache, /MAX_MEMORY_EXECUTION_RECORDS = 6/);
  assert.match(chartHistoryCache, /transaction\.objectStore\(STORE_NAME\)\.openCursor\(\)/);
  assert.doesNotMatch(
    chartHistoryCache.slice(
      chartHistoryCache.indexOf("export async function pruneChartHistoryCache"),
      chartHistoryCache.indexOf("export async function readChartHistoryCache"),
    ),
    /\.getAll\(\)/,
  );
  assert.match(workspace, /activeRef\.current && latestMarketTradesRef\.current\.length/);
  assert.match(workspace, /\}, 120_000\)/);
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
  assert.match(chart, /keyboardActive \? 250 : 1_000/);
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
  assert.match(workspace, /showTradesMenu \|\| rightPanel === "order"[\s\S]{0,480}syncPaperLedgerUi\(false, 1_000\)/);
  assert.match(workspace, /activeChartExecutionQuoteUiAtRef\.current >= 1_000/);
  assert.match(
    readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8"),
    /paperPositionOverlayPrimitiveRef\.current\?\.updateMarketQuote\(detail\)/,
  );
  assert.match(workspace, /if \(activeRef\.current\) setCandles\(\[\.\.\.next\]\)/);
  assert.match(workspace, /if \(activeRef\.current\) setCandles\(nextCandles\)/);
});

test("plain multi-day charts aggregate ticks on a bounded tail before React reconciliation", () => {
  assert.match(workspace, /const lightweightLiveTailRef = useRef/);
  assert.match(workspace, /Math\.max\(0, previous\.length - 32\)/);
  assert.match(workspace, /const mergedTail = ticks\.reduce/);
  assert.match(workspace, /detail: \{ key: pane\.id, candle: latest \}/);
  assert.match(workspace, /activeRef\.current \? 5_000 : 10_000/);
  assert.match(workspace, /previous\.slice\(0, tailStart\)/);
});

test("background studies and drawings cannot consume foreground cadence", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /keyboardActive \? 250 : 750/);
  assert.match(chart, /queueChartFrameWork\(footprintWorkKey, refreshVisibleFootprint\)/);
  assert.match(chart, /footprintSamplingEnabled && !nonFootprintIndicatorSamplingEnabled/);
  assert.match(chart, /nonFootprintOrderFlowIndicatorEnabled[\s\S]*ORDER_FLOW_DATA_REFRESH_INTERVAL_MS/);
  assert.match(chart, /LIVE_CHART_EXECUTION_EVENT/);
  assert.match(chart, /primitive\.update\(nextBars, primitiveOptions\)/);
});

test("heavy studies from sibling panes are serialized across animation frames", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const scheduler = readFileSync(new URL("../src/lib/chartFrameWork.ts", import.meta.url), "utf8");
  assert.match(chart, /queueChartFrameWork\(`indicators:\$\{chartFrameWorkKey\}`/);
  assert.match(chart, /cancelChartFrameWork\(`indicators:\$\{chartFrameWorkKey\}`\)/);
  assert.match(scheduler, /const pendingTasks = new Map/);
  assert.match(scheduler, /pendingTasks\.set\(key, task\)/);
  assert.match(scheduler, /window\.requestAnimationFrame/);
  assert.doesNotMatch(chart, /\? 10_000\s*:/);
});

test("footprint viewport folding cannot run at the native chart interaction cadence", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const \[footprintViewportVersion, setFootprintViewportVersion\]/);
  assert.match(chart, /keyboardActive \? 200 : 500/);
  assert.match(chart, /queueChartFrameWork\(`footprint-viewport:\$\{chartFrameWorkKey\}`/);
  assert.match(chart, /footprintDataConsumer, footprintViewportVersion/);
  assert.doesNotMatch(
    chart,
    /\[candles\.length, footprintCandles, footprintDataConsumer, viewportVersion\]/,
  );
});

test("the five-minute chart stream proves the canonical selected symbol before warm takeover", () => {
  assert.match(workspace, /sameLiveInstrument\(warmingPrice\.instrument, selectedInstrument\)/);
  assert.match(workspace, /now - activeStreamOpenedAt > 270_000/);
  assert.match(workspace, /lastPriceMessageAtBySymbol\.get\(selectedLiveInstrument\) === undefined/);
  assert.match(workspace, /activeStreamOpenedAt = Date\.now\(\)/);
  assert.match(workspace, /openEventSource\(false\);\s*scheduleWarmHandoff\(\);/);
  assert.match(workspace, /window\.addEventListener\("online", resumeLiveStream\)/);
});

test("exchange quotes do not continuously reconcile the full workspace shell", () => {
  assert.match(workspace, /if \(!quoteBelongsToActivePane \|\| \(!showTradesMenu && rightPanel !== "order"\)\) return/);
  assert.match(workspace, /if \(quoteBelongsToActivePane && quote\.mid > 0\) liveGexCalibrationPriceRef\.current = quote\.mid/);
  assert.match(workspace, /watchlistRef\.current = next/);
  assert.match(workspace, /now - watchlistReactSyncAtRef\.current < 15_000/);
  assert.doesNotMatch(workspace, /setWatchlist\(\(current\) => \{[\s\S]{0,120}updates\.get/);
});

test("one pane per symbol owns paper execution instead of racing sibling charts", () => {
  assert.match(workspace, /const paperExecutionAuthorityPaneIds = useMemo/);
  assert.match(workspace, /const paneIds = new Set<string>\(\[activePaneId\]\)/);
  assert.match(workspace, /paperExecutionAuthorityPaneIds\.has\(pane\.id\)/);
  assert.doesNotMatch(
    workspace,
    /activePaneId === pane\.id \|\| paperExecutionTrackedSymbols\.has\(normalizePaperSymbol\(pane\.symbol\)\)/,
  );
});

test("unrelated shell state cannot rerender every heavyweight chart surface", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const gexMap = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
  const liquidityMap = readFileSync(new URL("../src/components/liquidity-map/LiquidityMapWorkspace.tsx", import.meta.url), "utf8");

  assert.match(workspace, /const WorkspaceChartPane = memo\(WorkspaceChartPaneComponent, areWorkspaceChartPanePropsEqual\)/);
  assert.match(workspace, /typeof previousValue === "function" && typeof nextValue === "function"/);
  assert.match(chart, /export default memo\(Chart, areChartPropsEqual\)/);
  assert.match(chart, /shallowChartArrayEqual/);
  assert.match(gexMap, /export default memo\(GexMapWorkspace\)/);
  assert.match(liquidityMap, /export default memo\([\s\S]{0,280}previous\.instrument === next\.instrument/);
});

test("saved multi-panel workspaces hydrate one heavyweight surface per turn", () => {
  assert.match(workspace, /const \[mountedWorkspacePaneIds, setMountedWorkspacePaneIds\] = useState<Set<string>>/);
  assert.match(workspace, /hydrationTimer = window\.setTimeout\(hydrateNextPane, 250\)/);
  assert.match(workspace, /workspacePaneIsMounted\(node\.paneId\) \? renderWorkspacePane\(node\.paneId\)/);
  assert.match(workspace, /Starting this live panel without blocking the others\./);
});

test("live indicator summaries cannot reconcile the chart tree at packet cadence", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /LIVE_INDICATOR_REACT_SUMMARY_INTERVAL_MS = 1_000/);
  assert.ok(
    chart.match(/LIVE_INDICATOR_REACT_SUMMARY_INTERVAL_MS/g)?.length >= 9,
    "every Level 3 summary publisher should share the bounded React cadence",
  );
  assert.doesNotMatch(chart, /elapsed >= 200/);
  assert.match(chart, /stackedImbalanceLastReactPublishRef/);
  assert.match(chart, /pocAuctionLastReactPublishRef/);
});

test("liquidity sweep discovery is disabled when hidden and bounded when visible", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /if \(!liquidityStopSweepIndicator\) \{\s*liquidityStopSweepReferencesRef\.current = \[\]/);
  assert.match(chart, /candles\.length > 4_000 \? candles\.slice\(-4_000\) : candles/);
  assert.match(chart, /buildSweepReferencesFromCandles\(referenceCandles/);
});

test("options indicators share cached refreshes instead of force-fetching per pane", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(chart, /setInterval\(\(\) => void load\(true\)/);
  assert.doesNotMatch(chart, /setTimeout\(\(\) => void load\(true\)/);
  assert.match(chart, /setInterval\(\(\) => void load\(false\), refreshMs\)/);
  assert.ok(
    chart.match(/setTimeout\(\(\) => void load\(false\), refreshMs\)/g)?.length >= 3,
    "gamma heatmap, net gamma and dark-pool refreshes should use shared cache dedupe",
  );
});

test("native overlay payloads are not reassigned during every pan and zoom event", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(chart, /\[gammaHeatmapPrimitiveData, viewportVersion\]/);
  assert.doesNotMatch(chart, /\[gexIntervalPrimitiveData, viewportVersion\]/);
  assert.doesNotMatch(chart, /\[netGammaPrimitiveData, viewportVersion\]/);
  assert.doesNotMatch(chart, /\[darkPoolMapPrimitiveData, viewportVersion\]/);
  assert.doesNotMatch(chart, /pullingStackingSettings, settings\.backgroundColor, viewportVersion/);
  assert.doesNotMatch(chart, /absorptionSettings, chartReadyRevision, settings\.backgroundColor, viewportVersion/);
});

test("GEX interval and volume-profile work use bounded scalar inputs", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const displayPrices = indicatorCandles\.map/);
  assert.match(chart, /timeAnchors: indicatorCandles\.map/);
  assert.match(chart, /const volumeProfileLastCandleTimestamp = candles\.at\(-1\)\?\.timestamp/);
  const profileEffect = chart.slice(
    chart.indexOf("const volumeProfileLastCandleTimestamp"),
    chart.indexOf("const primitive = tpoProfilePrimitiveRef.current", chart.indexOf("const volumeProfileLastCandleTimestamp")),
  );
  assert.doesNotMatch(profileEffect, /^\s+candles,\s*$/m);
  assert.match(profileEffect, /volumeProfileLastCandleTimestamp/);
});

test("status-only indicator clocks cannot reconcile the full chart every second", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(chart, /setInterval\(\(\) => setHedgeLevelsNow\(Date\.now\(\)\), 1_000\)/);
  assert.match(chart, /setInterval\(\(\) => setHedgeLevelsNow\(Date\.now\(\)\), 15_000\)/);
});
