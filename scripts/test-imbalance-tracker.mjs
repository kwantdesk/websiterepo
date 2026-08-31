import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateImbalanceZones } from "../src/lib/imbalanceTracker.ts";

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
      ...zone,
      endTimestamp: candles[zone.endIndex].timestamp,
    }));
  assert.deepEqual(zones, scenario.expected, scenario.name);
}

console.log(`Imbalance Tracker authoritative fixture passed (${fixture.scenarios.length} scenarios).`);
