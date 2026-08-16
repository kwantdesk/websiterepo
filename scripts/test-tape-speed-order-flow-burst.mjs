import assert from "node:assert/strict";
import {
  buildTapeSpeedFrame,
  DEFAULT_TAPE_SPEED_SETTINGS,
  normalizeTapeSpeedSettings,
  tapeSpeedPaneSeries,
  TAPE_SPEED_PRESETS,
} from "../src/lib/tapeSpeedOrderFlowBurst.ts";

const trade = (eventId, timestamp, close, volume, aggressor, recordIndex) => ({
  eventId,
  recordIndex,
  timestamp,
  open: close,
  high: close,
  low: close,
  close,
  trades: 1,
  volume,
  bidVolume: aggressor === "SELL" ? volume : 0,
  askVolume: aggressor === "BUY" ? volume : 0,
  delta: aggressor === "BUY" ? volume : aggressor === "SELL" ? -volume : 0,
  aggressor,
});

const base = 1_000_000;
const directSettings = {
  ...DEFAULT_TAPE_SPEED_SETTINGS,
  dynamicBaselineEnabled: false,
  windowMode: "fixed",
  fixedBucketMs: 1_000,
  minimumContractsPerSecond: 1,
  minimumTradesPerSecond: 0,
  minimumAbsoluteDeltaPerSecond: 1,
  minimumQuantity: 1,
  minimumTradeCount: 1,
  minimumDirectionalShare: 0.6,
  minimumDirectionalDelta: 1,
  minimumQualityScore: 0,
  minimumMarkerScore: 0,
  historySeconds: 60,
};

const fixture = [
  trade("a", base + 100, 100, 40, "BUY", 1),
  trade("b", base + 200, 100.25, 30, "BUY", 2),
  trade("c", base + 300, 100, 10, "SELL", 3),
  trade("u", base + 400, 100.25, 20, "UNKNOWN", 4),
  trade("a", base + 100, 100, 40, "BUY", 1), // duplicate must not double count
];

const frame = buildTapeSpeedFrame({ trades: fixture, settings: directSettings, instrumentId: "NQ", tickSize: 0.25, nowMs: base + 1_000 });
assert.equal(frame.buckets.length, 1);
assert.equal(frame.latest.totalQuantity, 100);
assert.equal(frame.latest.buyQuantity, 70);
assert.equal(frame.latest.sellQuantity, 10);
assert.equal(frame.latest.unknownQuantity, 20);
assert.equal(frame.latest.delta, 60);
assert.equal(frame.latest.contractsPerSecond, 100);
assert.equal(frame.latest.tradesPerSecond, 4);
assert.equal(frame.latest.buyShare, 0.875);
assert.equal(frame.latest.largestTrade, 40);
assert.equal(frame.events.length, 1);
assert.equal(frame.events[0].direction, "buy");
assert(frame.events[0].classifications.includes("buy-burst"));
assert(frame.events[0].warnings[0].includes("unknown-side"));

const sellFrame = buildTapeSpeedFrame({
  trades: [trade("s1", base + 100, 100.25, 45, "SELL", 1), trade("s2", base + 200, 100, 35, "SELL", 2), trade("s3", base + 300, 100, 10, "BUY", 3)],
  settings: directSettings,
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 1_000,
});
assert.equal(sellFrame.events[0].direction, "sell");
assert(sellFrame.events[0].classifications.includes("sell-burst"));

const churnFrame = buildTapeSpeedFrame({
  trades: [trade("c1", base + 100, 100, 30, "BUY", 1), trade("c2", base + 200, 100.25, 30, "SELL", 2), trade("c3", base + 300, 100, 30, "BUY", 3), trade("c4", base + 400, 100.25, 30, "SELL", 4)],
  settings: { ...directSettings, minimumDirectionalShare: 0.7 },
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 1_000,
});
assert.equal(churnFrame.events[0].direction, "neutral");
assert(churnFrame.events[0].classifications.includes("two-sided-churn"));

const rolling = buildTapeSpeedFrame({
  trades: fixture.slice(0, 4),
  settings: { ...directSettings, windowMode: "rolling", rollingWindowMs: 500, updateStepMs: 100 },
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 1_000,
});
assert(rolling.buckets.length >= 3);
assert(rolling.buckets.every((bucket) => bucket.durationMs === 500));

const eventBurst = buildTapeSpeedFrame({
  trades: [
    trade("e1", base + 10, 100, 10, "BUY", 1),
    trade("e2", base + 20, 100.25, 10, "BUY", 2),
    trade("e3", base + 300, 100.5, 10, "SELL", 3),
  ],
  settings: { ...directSettings, windowMode: "event-burst", maximumInterTradeGapMs: 75 },
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 1_000,
});
assert.equal(eventBurst.buckets.length, 2);

const zeroDuration = buildTapeSpeedFrame({
  trades: [trade("z1", base + 10, 100, 10, "BUY", 1), trade("z2", base + 10, 100, 10, "BUY", 2)],
  settings: { ...directSettings, windowMode: "event-burst" },
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 1_000,
});
assert.equal(zeroDuration.latest.durationMs, 1);
assert(Number.isFinite(zeroDuration.latest.contractsPerSecond));

const medianFrame = buildTapeSpeedFrame({
  trades: [trade("m1", base + 100, 100, 1, "BUY", 1), trade("m2", base + 200, 100, 1, "BUY", 2), trade("m3", base + 300, 100.25, 100, "BUY", 3)],
  settings: directSettings,
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 1_000,
});
assert.equal(medianFrame.latest.medianTradeSize, 1);
assert.equal(medianFrame.latest.averageTradeSize, 34);

const chartBar = buildTapeSpeedFrame({
  trades: fixture.slice(0, 4),
  settings: { ...directSettings, windowMode: "chart-bar" },
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 2_000,
  chartBars: [{ timestamp: base, open: 100, high: 101, low: 99, close: 100.5, volume: 100 }],
});
assert.equal(chartBar.buckets.length, 1);
assert.equal(chartBar.latest.totalQuantity, 100);

const context = buildTapeSpeedFrame({
  trades: fixture.slice(0, 3),
  settings: directSettings,
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 1_000,
  contextEvents: [{ startMs: base, endMs: base + 500, lowPrice: 99.75, highPrice: 100.5, tag: "sweep-linked" }],
});
assert(context.events[0].classifications.includes("sweep-linked"));

const continuation = buildTapeSpeedFrame({
  trades: [trade("q1", base + 100, 100, 50, "BUY", 1), trade("q2", base + 200, 100.25, 50, "BUY", 2), trade("q3", base + 1_500, 101.25, 1, "BUY", 3)],
  settings: { ...directSettings, continuationTicks: 3 },
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 2_000,
});
assert.equal(continuation.events[0].response, "continuation");

const rejection = buildTapeSpeedFrame({
  trades: [trade("r1", base + 100, 100, 50, "BUY", 1), trade("r2", base + 200, 100.25, 50, "BUY", 2), trade("r3", base + 1_500, 99.25, 1, "SELL", 3)],
  settings: { ...directSettings, rejectionTicks: 3 },
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 2_000,
});
assert.equal(rejection.events[0].response, "rejection");

const historical = buildTapeSpeedFrame({ trades: fixture.slice(0, 3), settings: directSettings, instrumentId: "NQ", tickSize: 0.25, nowMs: base + 10_000_000 });
assert.equal(historical.status, "HISTORICAL");
assert(historical.buckets.length > 0, "historical execution frames must remain visible outside RTH");

const unavailable = buildTapeSpeedFrame({ trades: [{ ...fixture[0], flowOnly: true }], settings: directSettings, instrumentId: "NQ", tickSize: 0.25, nowMs: base + 1_000 });
assert.equal(unavailable.status, "UNAVAILABLE");
assert.equal(unavailable.events.length, 0);

const pane = tapeSpeedPaneSeries(frame, "fixture", directSettings);
assert.equal(pane.length, 3);
assert(pane.find((series) => series.key.endsWith("sell-speed")).data.every((point) => point.value <= 0));
assert(pane.find((series) => series.key.endsWith("buy-speed")).data.every((point) => point.value >= 0));

const normalized = normalizeTapeSpeedSettings({ updateStepMs: 9999, rollingWindowMs: 100, minimumDirectionalShare: 9, paneHeight: 9999 });
assert.equal(normalized.updateStepMs, 100);
assert.equal(normalized.minimumDirectionalShare, 1);
assert.equal(normalized.paneHeight, 520);
assert.deepEqual(Object.keys(TAPE_SPEED_PRESETS), ["balanced-futures", "nq-scalper", "tape-acceleration", "delta-burst", "large-trade-burst", "sweep-focus", "absorbed-burst", "churn-rotation", "minimal", "research"]);

const boundedTrades = Array.from({ length: 160 }, (_, index) => trade(`cap-${index}`, base + index * 100, 100 + (index % 4) * 0.25, 2, index % 2 ? "BUY" : "SELL", index));
const bounded = buildTapeSpeedFrame({
  trades: boundedTrades,
  settings: { ...directSettings, windowMode: "rolling", rollingWindowMs: 1_000, updateStepMs: 100, maximumBuckets: 100 },
  instrumentId: "NQ",
  tickSize: 0.25,
  nowMs: base + 20_000,
});
assert.equal(bounded.buckets.length, 100, "high-frequency history must be capped before rendering");

console.log("Tape Speed & Order-Flow Burst fixtures passed.");
