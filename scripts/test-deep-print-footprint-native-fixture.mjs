import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFootprintBars } from "../src/lib/footprint.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../native/parity/fixtures/charts/deep-print-footprint-authoritative.json",
  import.meta.url,
), "utf8"));

const records = fixture.trades.map((trade, index) => ({
  eventId: `fixture-${index}`,
  recordIndex: index,
  timestamp: trade.timestamp,
  open: trade.price,
  high: trade.price,
  low: trade.price,
  close: trade.price,
  price: trade.price,
  size: trade.size,
  volume: trade.size,
  trades: trade.trades ?? 1,
  bidVolume: trade.aggressor === "SELL" ? trade.size : 0,
  askVolume: trade.aggressor === "BUY" ? trade.size : 0,
  delta: trade.aggressor === "BUY" ? trade.size : trade.aggressor === "SELL" ? -trade.size : 0,
  aggressor: trade.aggressor,
}));
const bars = buildFootprintBars(fixture.candles, records, {
  ...fixture.settings,
  tickSize: fixture.tickSize,
  instrument: fixture.instrument,
});

const actual = fixture.expectedBars.map((expected) => {
  const bar = bars.find((candidate) => candidate.startTime === expected.startTime);
  assert.ok(bar, `missing browser bar ${expected.startTime}`);
  return {
    startTime: bar.startTime,
    bidVolume: bar.bidVolume,
    askVolume: bar.askVolume,
    unknownVolume: bar.unknownVolume,
    totalVolume: bar.totalVolume,
    delta: bar.delta,
    deltaHigh: bar.deltaHigh,
    deltaLow: bar.deltaLow,
    deltaClose: bar.deltaClose,
    pocTick: bar.pocTick,
    valueAreaHighTick: bar.valueAreaHighTick,
    valueAreaLowTick: bar.valueAreaLowTick,
    deltaPocTick: bar.deltaPocPrice / fixture.tickSize,
    vwap: bar.vwap,
    isClosed: bar.isClosed,
    hasPriceLevelFlow: bar.hasPriceLevelFlow,
    rows: expected.rows.map((expectedRow) => {
      const row = bar.rows.find((candidate) => candidate.tickIndex === expectedRow.tickIndex);
      assert.ok(row, `missing browser row ${expectedRow.tickIndex}`);
      return Object.fromEntries(Object.keys(expectedRow).map((key) => [key, row[key]]));
    }),
  };
});

assert.deepEqual(actual, fixture.expectedBars);
console.log("Deep Print Footprint browser authority fixture passed.");
