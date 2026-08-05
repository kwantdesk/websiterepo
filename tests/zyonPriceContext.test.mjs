import assert from "node:assert/strict";
import test from "node:test";

import {
  buildZyonPriceAnalytics,
  cmeTradingDateKey,
  selectZyonFuturesPrice,
  summarizeCmeSessions,
  summarizeTimeframeStructure,
} from "../src/lib/zyonPriceContext.ts";

function bar(iso, open, high, low, close, volume = 100) {
  return { timestamp: Date.parse(iso), open, high, low, close, volume };
}

test("assigns Sunday evening CME bars to Monday's trading date", () => {
  assert.equal(cmeTradingDateKey(Date.parse("2026-08-02T22:00:00.000Z")), "2026-08-03");
  assert.equal(cmeTradingDateKey(Date.parse("2026-08-03T21:00:00.000Z")), "2026-08-03");
  assert.equal(cmeTradingDateKey(Date.parse("2026-08-03T22:00:00.000Z")), "2026-08-04");
});

test("never promotes an options-underlying quote into the NQ futures price", () => {
  const selected = selectZyonFuturesPrice({
    browserTick: {
      price: 723.33,
      timestamp: Date.parse("2026-08-05T13:34:00.000Z"),
      source: "BROWSER_FUTURES_TICK",
    },
    history: {
      price: 29_733.25,
      timestamp: Date.parse("2026-08-05T13:30:00.000Z"),
      source: "CME_HISTORY",
    },
  });

  assert.equal(selected?.price, 29_733.25);
  assert.equal(selected?.source, "CME_HISTORY");
});

test("returns exact previous and developing current CME session OHLC", () => {
  const sessions = summarizeCmeSessions([
    bar("2026-08-03T22:00:00.000Z", 100, 102, 99, 101),
    bar("2026-08-04T02:00:00.000Z", 101, 106, 100, 105),
    bar("2026-08-04T20:55:00.000Z", 105, 107, 103, 104),
    bar("2026-08-04T22:00:00.000Z", 104, 105, 103, 104.5),
    bar("2026-08-05T02:00:00.000Z", 104.5, 109, 104, 108),
    bar("2026-08-05T12:00:00.000Z", 108, 110, 106, 109),
  ]);

  assert.equal(sessions.previous?.sessionDate, "2026-08-04");
  assert.deepEqual(
    {
      open: sessions.previous?.open,
      high: sessions.previous?.high,
      low: sessions.previous?.low,
      close: sessions.previous?.close,
      complete: sessions.previous?.complete,
    },
    { open: 100, high: 107, low: 99, close: 104, complete: true },
  );
  assert.equal(sessions.current?.sessionDate, "2026-08-05");
  assert.deepEqual(
    {
      open: sessions.current?.open,
      high: sessions.current?.high,
      low: sessions.current?.low,
      current: sessions.current?.current,
      complete: sessions.current?.complete,
    },
    { open: 104, high: 110, low: 103, current: 109, complete: false },
  );
});

test("builds explicit one-hour and four-hour structure from CME bars", () => {
  const bars = Array.from({ length: 36 }, (_, index) => {
    const open = 100 + index * 0.5;
    return bar(
      new Date(Date.parse("2026-08-04T00:00:00.000Z") + index * 30 * 60_000).toISOString(),
      open,
      open + 1.5,
      open - 0.5,
      open + 1,
    );
  });
  const oneHour = summarizeTimeframeStructure(bars, "1H");
  const fourHour = summarizeTimeframeStructure(bars, "4H");
  const analytics = buildZyonPriceAnalytics(bars);

  assert.equal(oneHour?.direction, "UP");
  assert.equal(oneHour?.structure, "HIGHER_HIGH_HIGHER_LOW");
  assert.equal(fourHour?.direction, "UP");
  assert.equal(fourHour?.structure, "HIGHER_HIGH_HIGHER_LOW");
  assert.equal(analytics.structure.oneHour?.timeframe, "1H");
  assert.equal(analytics.structure.fourHour?.timeframe, "4H");
});
