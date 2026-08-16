import assert from "node:assert/strict";
import {
  buildDarkPoolGexFrame,
  calculateDarkPoolGexReaction,
  DEFAULT_DARK_POOL_GEX_SETTINGS,
  resolveDarkPoolGexCoordinate,
  summarizeDarkPoolGexResearch,
} from "../src/lib/darkPoolGex.ts";
import {
  createMappingReceipt,
  deduplicateDarkPoolPrints,
  mapDarkPoolPrint,
  normalizeDarkPoolPrint,
} from "../src/lib/darkPoolMap.ts";

const NOW = Date.UTC(2026, 7, 14, 15, 0, 0); // Friday 11:00 New York.
const mapping = createMappingReceipt({ mode: "direct", direct: true, sourceMid: 737, displayMid: 737, calculatedAtMs: NOW });
assert.ok(mapping);

const mappedPrint = (id, executionTime, price, notional, overrides = {}) => {
  const print = {
    id,
    recordId: id,
    originalRecordId: null,
    ticker: "QQQ",
    price,
    rawPrice: price,
    adjustedChartPrice: price,
    size: Math.round(notional / price),
    rawShares: Math.round(notional / price),
    notionalValue: notional,
    rawNotional: notional,
    printType: "DARK_POOL",
    tradeSide: "UNKNOWN",
    askPrice: null,
    askSize: null,
    bidPrice: null,
    bidSize: null,
    isDelayedPrint: false,
    tradeTimeMs: executionTime,
    executionTimestampMs: executionTime,
    reportTimestampMs: executionTime,
    observableTimestampMs: executionTime,
    source: "QuantData off-exchange endpoint",
    offExchangeClassification: "TRF_REPORTED",
    venue: "FINRA TRF",
    trf: "FINRA TRF",
    tradeConditions: [],
    correctionState: "ORIGINAL",
    cancellationState: "ACTIVE",
    corporateActionAdjustmentFactor: 1,
    corporateAction: null,
    ...overrides,
  };
  return mapDarkPoolPrint(print, "QQQ", mapping);
};

const node = (price, signedExposure, role, timestamp = NOW) => ({
  id: `${role}:${price}:${timestamp}`,
  sourceStrike: price,
  mappedPrice: price,
  signedExposure,
  absoluteExposure: Math.abs(signedExposure),
  role,
  timestamp,
  snapshotTimeMs: timestamp,
});

const prints = [
  mappedPrint("A", NOW - 60_000, 737.38, 1_000_000_000),
  mappedPrint("B", NOW - 120_000, 737.55, 5_000_000_000),
  mappedPrint("C", NOW - 180_000, 738.17, 3_000_000_000),
  mappedPrint("D", NOW - 240_000, 739.125, 4_000_000_000),
  mappedPrint("E", NOW - 300_000, 740.25, 500_000_000),
  mappedPrint("F", NOW - 360_000, 741.375, 2_000_000_000),
  mappedPrint("old", NOW - 40 * 86_400_000, 730, 8_000_000_000),
  mappedPrint("future", NOW + 1, 750, 10_000_000_000),
];
const darkPool = {
  sourceTicker: "QQQ",
  displayInstrument: "QQQ",
  checkedAtMs: NOW,
  status: "LIVE",
  direct: true,
  prints,
  levels: [],
  zones: [],
  limitations: [],
  pollIntervalMs: 5_000,
};
const gex = {
  snapshotTimeMs: NOW,
  levels: [node(737.5, -10_000_000_000, "KING"), node(738.17, 5_000_000_000, "MAJOR")],
  exposureField: [
    { timestamp: NOW - 300_000, nodes: [node(737.38, 1_000_000_000, "MAJOR", NOW - 300_000)] },
    { timestamp: NOW - 90_000, nodes: [node(737.5, -8_000_000_000, "KING", NOW - 90_000)] },
  ],
};

const frame = buildDarkPoolGexFrame({ darkPool, gex, asOfMs: NOW, tickSize: 0.01 });
assert.equal(frame.schemaVersion, 2);
assert.deepEqual(frame.rawEvents.map((event) => event.print.id), ["B", "D", "C", "F", "A"], "Top-N membership must use raw individual print notional only");
assert.deepEqual(frame.rawEvents.map((event) => event.rank), [1, 2, 3, 4, 5]);
assert.equal(frame.eligibleEventCount, 6, "Old and future prints must not enter the replay-safe eligible set");
assert.equal(frame.rawEvents.find((event) => event.print.id === "A")?.price, 737.38, "Exact source precision must survive the analytical pipeline");
assert.ok(frame.rawEvents.every((event) => event.direction === "UNKNOWN"), "Dark-pool direction must remain neutral");
assert.ok(frame.rawEvents.every((event) => event.classification === "TRF_REPORTED"));
assert.equal(frame.clusters.length, 0, "Derived clusters are off by default");

const clustered = buildDarkPoolGexFrame({
  darkPool,
  gex,
  asOfMs: NOW,
  tickSize: 0.01,
  settings: { clusterEnabled: true, displayMode: "raw-and-clusters", clusterDistanceMode: "absolute", clusterDistance: 0.25, minimumClusterNotional: 1_000_000, topN: 6 },
});
assert.ok(clustered.clusters.length >= 1, "Optional clusters must remain a separate derived layer");
assert.ok(clustered.rawEvents.some((event) => event.price === 737.38) && clustered.rawEvents.some((event) => event.price === 737.55), "Clustering must not merge or mutate raw exact-price levels");

const directExact = mappedPrint("exact", NOW, 737.375, 1_000_000_000);
assert.equal(directExact.mappedPrice, 737.375, "Direct underlying mapping must not tick-round exact prints");

const correctedOriginal = mappedPrint("original", NOW - 10_000, 740, 4_000_000_000, { recordId: "original" });
const correction = mappedPrint("correction", NOW - 10_000, 740, 400_000_000, {
  recordId: "correction",
  originalRecordId: "original",
  correctionState: "CORRECTED",
  observableTimestampMs: NOW - 5_000,
  reportTimestampMs: NOW - 5_000,
});
assert.equal(deduplicateDarkPoolPrints([correctedOriginal, correction])[0].notionalValue, 400_000_000, "A correction must replace its original record before ranking");

const canceled = mappedPrint("canceled", NOW - 20_000, 742, 9_000_000_000, { cancellationState: "CANCELED", correctionState: "CANCELED" });
const cleaned = buildDarkPoolGexFrame({ darkPool: { ...darkPool, prints: [...prints, canceled] }, gex, asOfMs: NOW, tickSize: 0.01 });
assert.ok(!cleaned.rawEvents.some((event) => event.print.id === "canceled"), "Canceled records must be excluded");

const late = mappedPrint("late", NOW - 10 * 60_000, 745, 9_000_000_000, {
  reportTimestampMs: NOW - 2 * 60_000,
  observableTimestampMs: NOW - 2 * 60_000,
  isDelayedPrint: true,
});
const latePool = { ...darkPool, prints: [late] };
assert.equal(buildDarkPoolGexFrame({ darkPool: latePool, gex, asOfMs: NOW - 3 * 60_000, tickSize: 0.01 }).rawEvents.length, 0, "Replay must not reveal a late print before its report was observable");
assert.equal(buildDarkPoolGexFrame({ darkPool: latePool, gex, asOfMs: NOW - 60_000, tickSize: 0.01 }).rawEvents[0]?.print.id, "late", "Replay may reveal a late print after its observable report time");

const futureGex = { ...gex, snapshotTimeMs: NOW + 1, levels: [node(737.38, 99_000_000_000, "KING", NOW + 1)] };
const replaySafeGex = buildDarkPoolGexFrame({ darkPool, gex: futureGex, asOfMs: NOW, tickSize: 0.01 });
assert.equal(replaySafeGex.gexSnapshotTimeMs, null, "A future GEX snapshot must not enter current replay context");
assert.equal(replaySafeGex.rawEvents.find((event) => event.print.id === "A")?.currentConfluence, null);

const reaction = calculateDarkPoolGexReaction(737.38, NOW - 60_000, [
  { timestampMs: NOW - 30_000, price: 737.39, resolution: "tick" },
  { timestampMs: NOW - 20_000, price: 737.44, resolution: "tick" },
], 0.01, { ...DEFAULT_DARK_POOL_GEX_SETTINGS, reactionHorizonMs: 60_000 }, NOW);
assert.equal(reaction.supportsTickClaim, true);
assert.ok(Math.abs((reaction.touches[0]?.touchErrorTicks ?? 0) - 1) < 1e-9, "Tick reaction error must use exact raw level distance");
const researchFrame = { ...frame, rawEvents: frame.rawEvents.map((event, index) => index === 0 ? { ...event, reaction } : event) };
const research = summarizeDarkPoolGexResearch(researchFrame);
assert.equal(research.touchCount, reaction.touchCount);
assert.equal(research.disclosures.resolution, "tick");
assert.equal(research.sufficientSample, false, "A tiny reaction sample must not be presented as proof");

for (const dpr of [1, 1.25, 1.5, 2]) {
  const coordinate = resolveDarkPoolGexCoordinate(737.38, (price) => price * 2, dpr);
  assert.equal(coordinate?.media, 1474.76);
  assert.equal(coordinate?.bitmap, 1474.76 * dpr, `Bitmap coordinate must remain DPR-correct at ${dpr}`);
}

const adjusted = normalizeDarkPoolPrint({
  id: "split",
  ticker: "QQQ",
  price: 200,
  size: 1000,
  tradeTime: NOW,
  reportTime: NOW,
  trf: "FINRA",
  corporateActionAdjustmentFactor: 0.5,
  corporateAction: "2-for-1 split",
});
assert.ok(adjusted);
assert.equal(mapDarkPoolPrint(adjusted, "QQQ", mapping).mappedPrice, 100, "Corporate-action adjustments must be explicit and deterministic");

const sunday = Date.UTC(2026, 7, 16, 15, 0, 0);
const closed = buildDarkPoolGexFrame({ darkPool, gex, asOfMs: sunday, tickSize: 0.01 });
assert.equal(closed.status, "MARKET_CLOSED");
assert.ok(closed.limitations.some((text) => text.includes("LAST VALID SNAPSHOT")));

console.log("Dark Pool (GEX) precision, cleaning, reaction and replay-safety tests passed.");
