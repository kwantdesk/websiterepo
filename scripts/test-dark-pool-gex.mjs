import assert from "node:assert/strict";
import { buildDarkPoolGexFrame, DEFAULT_DARK_POOL_GEX_SETTINGS } from "../src/lib/darkPoolGex.ts";

const NOW = Date.UTC(2026, 7, 14, 15, 0, 0);
const mappedPrint = (id, time, price, notional) => ({
  id,
  ticker: "QQQ",
  displayInstrument: "QQQ",
  price,
  mappedPrice: price,
  size: Math.round(notional / price),
  notionalValue: notional,
  tradeTimeMs: time,
  tradeSide: "UNKNOWN",
  isDelayedPrint: false,
  mapping: { method: "direct", alpha: 0, beta: 1, confidence: 1 },
});
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
const darkPool = {
  sourceTicker: "QQQ",
  displayInstrument: "QQQ",
  checkedAtMs: NOW,
  status: "LIVE",
  direct: true,
  prints: [
    mappedPrint("largest", NOW - 60_000, 500, 2_900_000_000),
    mappedPrint("second", NOW - 120_000, 500.2, 900_000_000),
    mappedPrint("third", NOW - 180_000, 502, 500_000_000),
    mappedPrint("old", NOW - 40 * 86_400_000, 490, 8_000_000_000),
    mappedPrint("future", NOW + 1, 510, 10_000_000_000),
  ],
  levels: [], zones: [], limitations: [], pollIntervalMs: 5_000,
};
const gex = {
  snapshotTimeMs: NOW,
  levels: [node(500.1, -10_000_000_000, "KING"), node(502, 5_000_000_000, "MAJOR")],
  exposureField: [
    { timestamp: NOW - 300_000, nodes: [node(500, 1_000_000_000, "MAJOR", NOW - 300_000)] },
    { timestamp: NOW - 90_000, nodes: [node(500, -8_000_000_000, "KING", NOW - 90_000)] },
  ],
};

const frame = buildDarkPoolGexFrame({
  darkPool,
  gex,
  asOfMs: NOW,
  tickSize: 0.01,
  settings: { ...DEFAULT_DARK_POOL_GEX_SETTINGS, topN: 2, minimumClusterNotional: 1_000_000, clusterDistance: 0.1 },
});
assert.equal(frame.rawEvents.length, 2, "Top-N must use eligible individual prints");
assert.equal(frame.rawEvents[0].print.id, "largest", "Top-N must rank by raw notional");
assert.equal(frame.eligibleEventCount, 3, "Old and future prints must not enter the replay-safe eligible set");
assert.ok(frame.rawEvents.every((event) => event.direction === "UNKNOWN"), "Dark-pool direction must remain neutral");
assert.ok(frame.rawEvents.every((event) => event.classification === "OFF_EXCHANGE"), "Classification must remain off-exchange");
assert.equal(frame.clusters.length, 1, "Nearby prints should form one cluster");
assert.equal(frame.clusters[0].totalNotional, 3_800_000_000);
assert.ok(frame.clusters[0].weightedPrice > 500 && frame.clusters[0].weightedPrice < 500.2, "Cluster price must be notional weighted");

const current = frame.rawEvents.find((event) => event.print.id === "largest");
assert.ok(current?.currentConfluence, "Current GEX confluence should resolve within tolerance");
assert.ok(current?.eventTimeConfluence, "Event-time GEX confluence should use the latest snapshot at or before the event");
assert.ok(Math.abs(current.combinedImportance - (0.65 * current.visualStrength + 0.35 * current.primaryConfluence.confluence)) < 1e-9, "Combined score must use the documented 65/35 formula");

const replayBefore = buildDarkPoolGexFrame({ darkPool, gex, asOfMs: NOW - 150_000, tickSize: 0.01 });
assert.deepEqual(replayBefore.rawEvents.map((event) => event.print.id), ["third"], "Replay must never reveal later prints");

const eventTime = buildDarkPoolGexFrame({ darkPool, gex, asOfMs: NOW, tickSize: 0.01, settings: { contextMode: "event-time", topN: 5 } });
const second = eventTime.rawEvents.find((event) => event.print.id === "second");
assert.equal(second?.primaryConfluence?.signedExposure, 1_000_000_000, "Event-time mode must not use a future GEX slice");

console.log("Dark Pool (GEX) calculation and replay-safety tests passed.");
