import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildFootprintBars, buildFootprintBarsCached } from "../src/lib/footprint.ts";
import { FOOTPRINT_CHART_TYPES } from "../src/lib/footprintChartTypes.ts";
import { validateFootprintSettings } from "../src/lib/footprintSettings.ts";

const candle = {
  timestamp: 1_000,
  open: 100,
  high: 100.25,
  low: 100,
  close: 100.25,
  volume: 120,
};

const execution = (recordIndex, timestamp, price, volume, trades) => ({
  eventId: `print-${recordIndex}`,
  recordIndex,
  timestamp,
  open: price,
  high: price,
  low: price,
  close: price,
  volume,
  trades,
  bidVolume: 0,
  askVolume: volume,
  delta: volume,
  aggressor: "BUY",
});

const records = [
  // Largest volume, but only one execution.
  execution(0, 2_000, 100, 100, 1),
  // Less volume, but five executions.
  execution(1, 3_000, 100.25, 20, 5),
];

const settings = {
  tickSize: 0.25,
  groupTicks: 1,
  minimumTradeVolume: 0,
  maximumTradeVolume: 0,
  imbalanceMode: "diagonal",
  minimumImbalancePercent: 300,
  minimumDelta: 0,
  includeZero: false,
  valueAreaPercent: 0.7,
};

test("POC, value area, maxima and VWAP use the selected footprint input", () => {
  const volume = buildFootprintBars([candle], records, { ...settings, inputType: "volume" })[0];
  const trades = buildFootprintBars([candle], records, { ...settings, inputType: "num-trades" })[0];

  assert.equal(volume.pocPrice, 100);
  assert.equal(volume.val, 100);
  assert.equal(volume.vah, 100);
  assert.ok(Math.abs(volume.vwap - ((100 * 100 + 100.25 * 20) / 120)) < 1e-9);

  assert.equal(trades.pocPrice, 100.25);
  assert.equal(trades.val, 100.25);
  assert.equal(trades.vah, 100.25);
  assert.ok(Math.abs(trades.vwap - ((100 * 1 + 100.25 * 5) / 6)) < 1e-9);
  assert.equal(trades.rows.find((row) => row.price === 100.25)?.isPoc, true);
  assert.equal(trades.maxBidTick, trades.rows[0].tickIndex);
  assert.equal(trades.maxAskTick, trades.rows.find((row) => row.price === 100.25)?.tickIndex);
});

test("the incremental footprint cache invalidates when input data changes", () => {
  const cache = { current: null };
  const volume = buildFootprintBarsCached(cache, [candle], records, { ...settings, inputType: "volume" });
  const trades = buildFootprintBarsCached(cache, [candle], records, { ...settings, inputType: "num-trades" });
  assert.equal(volume[0].pocPrice, 100);
  assert.equal(trades[0].pocPrice, 100.25);
});

test("every named footprint view survives settings validation", () => {
  for (const chartType of FOOTPRINT_CHART_TYPES) {
    for (const variant of chartType.variants) {
      const validated = validateFootprintSettings({
        chartType: chartType.id,
        chartVariant: variant.id,
        ...variant.settings,
      });
      assert.equal(validated.contentMode, variant.settings.contentMode, `${chartType.id}/${variant.id} content`);
      assert.equal(validated.inputType, variant.settings.inputType, `${chartType.id}/${variant.id} input`);
    }
  }
});

test("live footprint packets go straight to the shared frame queue", () => {
  const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const start = chart.indexOf("const footprintWorkKey = `footprint:${chartFrameWorkKey}`;");
  const end = chart.indexOf("window.addEventListener(LIVE_CHART_EXECUTION_EVENT, receive);", start);
  const receive = start >= 0 && end > start ? chart.slice(start, end) : "";
  assert.match(receive, /queueChartFrameWork\(footprintWorkKey, refreshVisibleFootprint\)/);
  assert.doesNotMatch(receive, /setTimeout/);
  assert.doesNotMatch(receive, /FOOTPRINT_DATA_REFRESH_INTERVAL_MS/);
});
