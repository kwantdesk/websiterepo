import assert from "node:assert/strict";
import { accumulateCumulativeIcebergStop, buildCumulativeIcebergStopFrame, normalizeCumulativeIcebergStopSettings } from "../src/lib/cumulativeIcebergStop.ts";

const settings = normalizeCumulativeIcebergStopSettings({ displayMode: "sum", filterMin: 1 });
const summed = accumulateCumulativeIcebergStop([
  { id: "a", timestampMs: 1_000, side: "bid", value: 10 },
  { id: "b", timestampMs: 2_000, side: "ask", value: 4 },
  { id: "c", timestampMs: 3_000, side: "bid", value: 3 },
], settings, 3_000);
assert.deepEqual(summed.map((point) => point.value), [10, 6, 9], "bid adds and ask subtracts");

const rolling = accumulateCumulativeIcebergStop([
  { id: "a", timestampMs: 1_000, side: "bid", value: 10 },
  { id: "b", timestampMs: 3_000, side: "ask", value: 4 },
], normalizeCumulativeIcebergStopSettings({ displayMode: "last-seconds", displayParameter: 1 }), 4_500);
assert.equal(rolling.at(-1)?.value, 0, "rolling window expires old activity at live time");

const filtered = accumulateCumulativeIcebergStop([
  { id: "small", timestampMs: 1_000, side: "bid", value: 2 },
  { id: "inside", timestampMs: 2_000, side: "bid", value: 7 },
  { id: "large", timestampMs: 3_000, side: "bid", value: 12 },
], normalizeCumulativeIcebergStopSettings({ filterMin: 5, filterMax: 10 }), 3_000);
assert.deepEqual(filtered.map((point) => point.value), [7], "min and max apply to each event");

const orderMode = buildCumulativeIcebergStopFrame(null, null, { inputData: "orders" });
assert.equal(orderMode.status, "ORDER_IDS_REQUIRED", "order counts are never fabricated without maker IDs");

const frame = buildCumulativeIcebergStopFrame({
  generatedAt: 5_000, status: "LIVE", instrument: "NQ", tickSize: 0.25, lastPrice: 20_000, bestBid: 19_999.75, bestAsk: 20_000,
  feedMode: "MBO_PRICE_LEVEL", nativeSupport: false, makerOrderSupport: false, replaceLineageSupport: false, cycles: [], zones: [], alerts: [], limitations: [],
  candidates: [{ id: "ice", instrumentId: "NQ", passiveSide: "BID", priceTick: 80_000, evidenceLevel: "price-level-aggregate", state: "SUSPECTED", startMs: 1_000, lastUpdatedMs: 4_000, initialDisplayedQuantity: 10, peakDisplayedQuantity: 10, minimumDisplayedQuantity: 1, currentDisplayedQuantity: 5, cumulativeAggressiveExecuted: 40, cumulativeAttributedReplenishment: 25, cumulativeOrdinaryStack: 0, cumulativePulled: 0, refreshCycleCount: 3, completedRefreshCycleCount: 3, largestCycleExecution: 20, largestCycleReplenishment: 15, replenishmentRatio: 0.625, executionToPeakDisplayRatio: 4, displayedRecoveryRatio: 0.5, samePriceDurationMs: 3_000, maximumPenetrationTicks: 0, responseTicks: 0, uniqueMakerOrderCount: 0, nativeIcebergFlag: false, inferredReloadedQuantity: 25, score: 80, scoreComponents: {}, quality: 80, qualityWarnings: [], retestCount: 0, departed: false }],
}, {
  generatedAt: 5_000, status: "LIVE", instrument: "NQ", tickSize: 0.25, lastPrice: 20_000, bestBid: 19_999.75, bestAsk: 20_000, fullDepth: true, alerts: [], limitations: [],
  events: [{ id: "stop", direction: "sell", subtype: "multi-level-execution", state: "possible-stop-sweep", evidenceLevel: "possible-stop-sweep", startMs: 3_000, endMs: 4_500, lowTick: 79_990, highTick: 80_000, firstTick: 80_000, lastTick: 79_990, totalQuantity: 50, confirmedAggressorQuantity: 50, estimatedAggressorQuantity: 0, opposingQuantity: 0, tradeCount: 4, uniqueLevelCount: 3, rangeTicks: 10, durationMs: 1_500, contractsPerSecond: 33, tradesPerSecond: 2.6, levelsPerSecond: 2, largestTrade: 20, averageTradeSize: 12.5, weightedAverageTick: 79_995, slippageTicks: 10, netProgressTicks: 10, backtrackTicks: 0, contiguousCoverageRatio: 0.3, directionalProgressRatio: 1, matchedReferences: [{ id: "r", type: "session-low", label: "Low", priceTick: 79_995, breachTicks: 5, distanceFromSweepStartTicks: 5, priority: 1 }], primaryReference: null, maximumBreachTicks: 5, continuationTicks: 0, rejectionTicks: 0, score: 80, scoreComponents: {}, dataQualityScore: 80, tradeIds: [], contextTags: [], warnings: [] }],
}, settings);
assert.equal(frame.currentIceberg, 25);
assert.equal(frame.currentStop, -50);
assert.equal(frame.status, "LIVE");

console.log("Cumulative Iceberg/Stop tests passed");
