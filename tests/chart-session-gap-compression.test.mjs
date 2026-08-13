import test from "node:test";
import assert from "node:assert/strict";

import {
  compressCmeClosedSessionCandles,
  isCmeClosedSessionTimestamp,
} from "../src/lib/chartHistoryWindow.ts";

const candle = (iso, close = 100) => ({
  timestamp: Date.parse(iso),
  open: close,
  high: close,
  low: close,
  close,
  volume: 0,
});

test("identifies the Chicago maintenance break and weekend closure", () => {
  assert.equal(isCmeClosedSessionTimestamp(Date.parse("2026-08-13T20:55:00Z")), false);
  assert.equal(isCmeClosedSessionTimestamp(Date.parse("2026-08-13T21:00:00Z")), true);
  assert.equal(isCmeClosedSessionTimestamp(Date.parse("2026-08-13T21:55:00Z")), true);
  assert.equal(isCmeClosedSessionTimestamp(Date.parse("2026-08-13T22:00:00Z")), false);
  assert.equal(isCmeClosedSessionTimestamp(Date.parse("2026-08-15T15:00:00Z")), true);
  assert.equal(isCmeClosedSessionTimestamp(Date.parse("2026-08-16T21:55:00Z")), true);
  assert.equal(isCmeClosedSessionTimestamp(Date.parse("2026-08-16T22:00:00Z")), false);
});

test("intraday charts place the final close candle beside the reopen candle", () => {
  const bars = [
    candle("2026-08-13T20:55:00Z", 100),
    candle("2026-08-13T21:00:00Z", 100.25),
    candle("2026-08-13T21:30:00Z", 100.5),
    candle("2026-08-13T21:55:00Z", 100.75),
    candle("2026-08-13T22:00:00Z", 102),
  ];

  const plotted = compressCmeClosedSessionCandles(bars, "5m");
  assert.deepEqual(plotted.map((bar) => bar.timestamp), [bars[0].timestamp, bars[4].timestamp]);
});

test("daily aggregation is not altered by intraday session compression", () => {
  const bars = [candle("2026-08-13T21:00:00Z", 100)];
  assert.equal(compressCmeClosedSessionCandles(bars, "1D"), bars);
});
