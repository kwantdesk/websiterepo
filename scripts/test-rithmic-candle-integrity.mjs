import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CHART_INTERVAL_OPTIONS, isEventBasedChartInterval } from "../src/lib/chartIntervals.ts";
import { applyMarketTradesToEventBars, futuresTickSize } from "../src/lib/eventBars.ts";
import { futuresVenue } from "../src/lib/futuresVenue.ts";

const catalogSource = readFileSync(new URL("../src/lib/databento.ts", import.meta.url), "utf8");
const catalogBlock = catalogSource.slice(
  catalogSource.indexOf("export const DATABENTO_FUTURES"),
  catalogSource.indexOf("export const DATABENTO_DEFAULT_SYMBOLS"),
);
const DATABENTO_FUTURES = [...catalogBlock.matchAll(/\{ symbol: "([^"]+)", label: "[^"]+", venue: "(CME|CBOT|NYMEX|COMEX)"/g)]
  .map((match) => ({ symbol: match[1], venue: match[2] }));
assert.ok(DATABENTO_FUTURES.length >= 50, "the full futures instrument catalogue was not audited");

const eventIntervals = CHART_INTERVAL_OPTIONS.filter((option) => isEventBasedChartInterval(option.id));
const timeIntervals = CHART_INTERVAL_OPTIONS.filter((option) => !isEventBasedChartInterval(option.id));
const start = Date.parse("2026-08-31T14:30:00Z");
let combinations = 0;

for (const instrument of DATABENTO_FUTURES) {
  assert.equal(futuresVenue(instrument.symbol), instrument.venue, `${instrument.symbol} uses the wrong tape venue`);
  const tick = futuresTickSize(instrument.symbol);
  assert.ok(Number.isFinite(tick) && tick > 0, `${instrument.symbol} has no tick size`);
  const anchor = tick < 0.001 ? 1.1 : tick < 0.1 ? 100 : 20_000;
  const records = Array.from({ length: 120 }, (_, index) => {
    const wave = [0, 1, 2, 5, 3, -1, -4, -2, 4, 8, 2, -5][index % 12];
    const side = index % 3 === 0 ? 1 : index % 3 === 1 ? -1 : 0;
    const size = 1 + (index % 11);
    return {
      timestamp: start + index * 137,
      price: anchor + wave * tick,
      size,
      trades: 1,
      delta: side * size,
    };
  });

  for (const interval of eventIntervals) {
    const oneShot = applyMarketTradesToEventBars([], records, interval.id, instrument.symbol, 5_000);
    const incremental = applyMarketTradesToEventBars(
      applyMarketTradesToEventBars([], records.slice(0, 60), interval.id, instrument.symbol, 5_000),
      records.slice(60), interval.id, instrument.symbol, 5_000,
    );
    assert.deepEqual(incremental, oneShot, `${instrument.symbol} ${interval.id} differs after an incremental update`);
    assert.ok(oneShot.length > 0, `${instrument.symbol} ${interval.id} produced no bars`);
    let previousTimestamp = -Infinity;
    for (const candle of oneShot) {
      for (const value of [candle.open, candle.high, candle.low, candle.close]) {
        assert.ok(Number.isFinite(value) && value > 0, `${instrument.symbol} ${interval.id} contains an invalid price`);
      }
      assert.ok(candle.low <= Math.min(candle.open, candle.close), `${instrument.symbol} ${interval.id} low excludes its body`);
      assert.ok(candle.high >= Math.max(candle.open, candle.close), `${instrument.symbol} ${interval.id} high excludes its body`);
      assert.ok(candle.timestamp > previousTimestamp, `${instrument.symbol} ${interval.id} timestamps are not increasing`);
      previousTimestamp = candle.timestamp;
      const aligned = (candle.close / tick) - Math.round(candle.close / tick);
      assert.ok(Math.abs(aligned) < 1e-6, `${instrument.symbol} ${interval.id} close is off tick`);
    }
    const inputVolume = records.reduce((sum, record) => sum + record.size, 0);
    const outputVolume = oneShot.reduce((sum, candle) => sum + Number(candle.volume ?? 0), 0);
    assert.ok(Math.abs(inputVolume - outputVolume) < 1e-6, `${instrument.symbol} ${interval.id} duplicated or lost volume`);
    combinations += 1;
  }
}

const server = readFileSync(new URL("../services/rithmic_gateway/src/server.mjs", import.meta.url), "utf8");
assert.match(server, /tradeTape\.loadTimeBars\(/, "seconds are not sourced from executions");
assert.match(server, /requestedInstrument\(url, \{\}, \{ exactRoot: true \}\)/, "history aliases a micro to its parent");
assert.match(server, /\.\.\.config\.subscriptions/, "configured subscriptions are not all taped");
for (const interval of timeIntervals) {
  if (interval.kind === "second") assert.match(interval.id, /^\d+s$/);
  combinations += DATABENTO_FUTURES.length;
}

console.log(`Rithmic candle integrity: ${DATABENTO_FUTURES.length} instruments x ${CHART_INTERVAL_OPTIONS.length} intervals = ${combinations} combinations passed`);
