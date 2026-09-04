import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateImbalanceZones } from "../src/lib/imbalanceTracker.ts";
import { imbalanceZoneHorizontalBounds } from "../src/lib/imbalanceZoneGeometry.ts";
import { normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

const fixture = JSON.parse(readFileSync(
  new URL("../native/parity/fixtures/charts/imbalance-tracker-authoritative.json", import.meta.url),
  "utf8",
));

for (const scenario of fixture.scenarios) {
  const candles = scenario.candles.map((candle) => ({
    ...candle,
    volume: 0,
    trades: 0,
    bidVolume: 0,
    askVolume: 0,
    delta: 0,
  }));
  const records = scenario.trades.map((trade, recordIndex) => ({
    recordIndex,
    timestamp: trade.timestamp,
    open: trade.price,
    high: trade.price,
    low: trade.price,
    close: trade.price,
    trades: 1,
    volume: trade.size,
    bidVolume: trade.aggressor === "SELL" ? trade.size : 0,
    askVolume: trade.aggressor === "BUY" ? trade.size : 0,
    delta: trade.aggressor === "BUY" ? trade.size : -trade.size,
    aggressor: trade.aggressor,
  }));
  const instance = {
    instanceId: `fixture:${scenario.name}`,
    indicatorId: "imbalance-tracker",
    enabled: true,
    settings: scenario.settings,
  };
  const zones = calculateImbalanceZones(candles, records, instance, fixture.tickSize)
    .map((zone) => ({
      id: zone.id,
      side: zone.side,
      startIndex: zone.startIndex,
      endIndex: zone.endIndex,
      startTimestamp: zone.startTimestamp,
      endTimestamp: candles[zone.endIndex].timestamp,
      top: zone.top,
      bottom: zone.bottom,
      triggered: zone.triggered,
    }));
  assert.deepEqual(zones, scenario.expected, scenario.name);
}

const liveEdgeCandles = [{
  timestamp: 1787581800000,
  open: 100,
  high: 101,
  low: 99.75,
  close: 100.5,
  volume: 180,
  trades: 6,
  bidVolume: 30,
  askVolume: 150,
  delta: 120,
  isClosed: false,
}];
const liveEdgeTrades = [
  [99.75, 10, "SELL"], [100, 50, "BUY"],
  [100, 10, "SELL"], [100.25, 60, "BUY"],
  [100.25, 10, "SELL"], [100.5, 70, "BUY"],
].map(([price, size, aggressor], recordIndex) => ({
  recordIndex,
  timestamp: liveEdgeCandles[0].timestamp + 1_000 + recordIndex,
  open: Number(price), high: Number(price), low: Number(price), close: Number(price),
  trades: 1,
  volume: Number(size),
  bidVolume: aggressor === "SELL" ? Number(size) : 0,
  askVolume: aggressor === "BUY" ? Number(size) : 0,
  delta: aggressor === "BUY" ? Number(size) : -Number(size),
  aggressor,
}));
const liveEdgeZones = calculateImbalanceZones(liveEdgeCandles, liveEdgeTrades, {
  instanceId: "live-edge",
  indicatorId: "imbalance-tracker",
  enabled: true,
  settings: { minimumPercent: 400, minimumConsecutive: 3, extendedBars: 10 },
}, fixture.tickSize);
assert.equal(liveEdgeZones.length, 1, "a qualifying live-edge imbalance is visible immediately");
assert.equal(liveEdgeZones[0].futureBars, 10, "the live edge retains its full configured extension");
assert.deepEqual(
  imbalanceZoneHorizontalBounds(200, 200, liveEdgeZones[0].futureBars, 6),
  { left: 200, width: 60 },
  "ten future bars render as ten native bar spacings instead of a two-pixel sliver",
);

const migrated = normalizeStoredIndicator({
  instanceId: "saved-v2",
  indicatorId: "imbalance-tracker",
  enabled: true,
  settings: { imbalanceTrackerSettingsVersion: 2, opacity: 78 },
});
assert.equal(migrated.settings?.opacity, 100, "the old dim stock opacity migrates to the visible default");
assert.equal(migrated.settings?.minimumPercent, 400, "missing saved fields receive the reference default");
assert.equal(migrated.settings?.extendedBars, 10, "saved trackers receive the reference width");
assert.equal(migrated.settings?.imbalanceTrackerSettingsVersion, 3);

const customOpacity = normalizeStoredIndicator({
  instanceId: "saved-v3",
  indicatorId: "imbalance-tracker",
  enabled: true,
  settings: { imbalanceTrackerSettingsVersion: 3, opacity: 42 },
});
assert.equal(customOpacity.settings?.opacity, 42, "a current user's explicit opacity is preserved");

console.log(`Imbalance Tracker authoritative fixture passed (${fixture.scenarios.length} scenarios + live edge + saved settings).`);
