import assert from "node:assert/strict";
import { buildBarPocFrame, normalizeBarPocSettings } from "../src/lib/barPocIndicator.ts";

const tickSize = 0.25;
const row = (tickIndex, bidVolume, askVolume, bidTrades = 1, askTrades = 1, unknownVolume = 0) => ({
  tickIndex, price: tickIndex * tickSize, bidVolume, askVolume, unknownVolume,
  bidTrades, askTrades, unknownTrades: 0,
});
const bar = (id, startTime, rows, closeTick, isClosed = true) => ({
  id, startTime, endTime: startTime + 60_000,
  highTick: Math.max(...rows.map((item) => item.tickIndex)), lowTick: Math.min(...rows.map((item) => item.tickIndex)),
  closeTick, close: closeTick * tickSize, rows, hasPriceLevelFlow: true, isClosed,
});

const base = Date.parse("2026-09-03T23:00:00Z");
const first = bar("one", base, [row(100, 30, 5, 6, 5), row(101, 20, 40), row(102, 3, 2)], 102);
const second = bar("two", base + 60_000, [row(100, 5, 5), row(101, 2, 2), row(102, 4, 4)], 100);
const frame = buildBarPocFrame([first, second], "NQ", tickSize, { extendPoc: true, removeOnShadowTouch: true });
const firstPoc = frame.levels.find((item) => item.id.includes("one"));
assert.equal(firstPoc?.priceTick, 101, "Bar POC must be the exact price row with the greatest traded volume");
assert.equal(firstPoc?.direction, "ask", "POC colour side must follow signed Bid/Ask delta");
assert.equal(firstPoc?.triggered, true, "a later candle trading through a virgin POC must trigger its extension");

const orderFrame = buildBarPocFrame([first], "NQ", tickSize, { inputData: "order", extendPoc: false });
assert.equal(orderFrame.levels[0]?.priceTick, 100, "Order mode must rank exact price rows by trade/order count");

const manual = buildBarPocFrame([first, second], "NQ", tickSize, { filterMode: "manual", manualMinimumVolume: 20, extendPoc: false });
assert.equal(manual.levels.length, 1, "manual filtering must remove POCs below the selected metric threshold");

const noRowsTouch = { ...second, id: "ohlc-touch", rows: [], hasPriceLevelFlow: false };
const lifecycle = buildBarPocFrame([first, noRowsTouch], "NQ", tickSize, { extendPoc: true, removeOnShadowTouch: true });
assert.equal(lifecycle.levels.find((item) => item.id.includes("one"))?.triggered, true, "every later candle must participate in virgin-line lifecycle even when it has no usable POC row");

const unavailable = buildBarPocFrame([{ ...first, rows: [], hasPriceLevelFlow: false }], "NQ", tickSize);
assert.equal(unavailable.status, "WAITING_FOR_VOLUME_AT_PRICE");
assert.deepEqual(unavailable.levels, []);

const normalized = normalizeBarPocSettings({ rectangleLineWidth: 99, autoStdDev: 9, backgroundOpacity: -1, maxBarsExtension: -5 });
assert.equal(normalized.rectangleLineWidth, 8);
assert.equal(normalized.autoStdDev, 4);
assert.equal(normalized.backgroundOpacity, 0);
assert.equal(normalized.maxBarsExtension, 0);

console.log("Bar POC indicator tests passed.");
