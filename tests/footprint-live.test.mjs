import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/footprintLive.ts", import.meta.url), "utf8")
  .replace(/export type[\s\S]*?};\r?\n\r?\n/g, "")
  .replace("export function applyLiveFootprintCandleGeometry<T extends LiveFootprintBarShape>", "function applyLiveFootprintCandleGeometry")
  .replace(/\n  bars: T\[\],\n  candle: LiveFootprintCandleGeometry,\n  tickSize: number,\n\): T\[\] \{/, "\n  bars,\n  candle,\n  tickSize,\n) {")
  .replaceAll("const priceTick = (price: number)", "const priceTick = (price)")
  .replace("export function retainLiveFootprintRows<T extends LiveFootprintBarShape>", "function retainLiveFootprintRows")
  .replace(/\n  current: T\[\],\n  retained: T\[\],\n\): T\[\] \{/, "\n  current,\n  retained,\n) {");
const retainLiveFootprintRows = Function(`${source}; return retainLiveFootprintRows;`)();
const applyLiveFootprintCandleGeometry = Function(`${source}; return applyLiveFootprintCandleGeometry;`)();

const bar = (time, flow, close = 100) => ({
  id: `NQ:${time}`,
  time,
  timestamp: time,
  startTime: time,
  endTime: time + 1,
  open: close,
  high: close,
  low: close,
  close,
  openTick: close,
  highTick: close,
  lowTick: close,
  closeTick: close,
  isClosed: false,
  hasPriceLevelFlow: flow,
  rows: flow ? [{ price: close, volume: 10 }] : [],
});

test("retains execution rows through a transient empty live batch", () => {
  const retained = [bar(1, true, 100)];
  const current = [bar(1, false, 101)];
  const result = retainLiveFootprintRows(current, retained);
  assert.equal(result[0].hasPriceLevelFlow, true);
  assert.equal(result[0].rows.length, 1);
  assert.equal(result[0].close, 101);
});

test("does not leak retained rows into a different time range", () => {
  const result = retainLiveFootprintRows([bar(2, false)], [bar(1, true)]);
  assert.equal(result[0].hasPriceLevelFlow, false);
  assert.equal(result[0].rows.length, 0);
});

test("retains the last valid view while a transport refresh is empty", () => {
  const retained = [bar(1, true)];
  assert.deepEqual(retainLiveFootprintRows([], retained), retained);
});

test("moves live footprint OHLC immediately without replacing execution rows", () => {
  const current = [bar(1, true, 100)];
  const result = applyLiveFootprintCandleGeometry(current, {
    time: 1,
    timestamp: 1,
    open: 100,
    high: 111,
    low: 99,
    close: 110,
  }, 0.25);

  assert.notEqual(result, current);
  assert.equal(result[0].close, 110);
  assert.equal(result[0].high, 111);
  assert.equal(result[0].closeTick, 440);
  assert.equal(result[0].rows, current[0].rows);
  assert.equal(result[0].hasPriceLevelFlow, true);
});

test("appends a new forming candle without deleting the completed footprint", () => {
  const current = [bar(1, true, 100)];
  const result = applyLiveFootprintCandleGeometry(current, {
    time: 5,
    timestamp: 5,
    open: 110,
    high: 112,
    low: 109,
    close: 111,
  }, 0.25);
  assert.notEqual(result, current);
  assert.equal(result.length, 2);
  assert.equal(result[0].hasPriceLevelFlow, true);
  assert.equal(result[0].rows.length, 1);
  assert.equal(result[0].isClosed, true);
  assert.equal(result[1].timestamp, 5);
  assert.equal(result[1].close, 111);
  assert.equal(result[1].hasPriceLevelFlow, false);
  assert.equal(result[1].rows.length, 0);
});

test("retains rows by source timestamp when chart coordinates are remapped", () => {
  const retained = [{ ...bar(1, true, 100), time: 500 }];
  const current = [{ ...bar(1, false, 101), time: 900 }];
  const result = retainLiveFootprintRows(current, retained);
  assert.equal(result[0].time, 900);
  assert.equal(result[0].close, 101);
  assert.equal(result[0].hasPriceLevelFlow, true);
  assert.equal(result[0].rows.length, 1);
});

test("a stale sampled render cannot delete the forming live candle", () => {
  const current = [{ ...bar(1, true, 100), isClosed: false }];
  const retained = [
    { ...bar(1, true, 100), isClosed: true },
    { ...bar(2, false, 101), isClosed: false },
  ];
  const result = retainLiveFootprintRows(current, retained);
  assert.equal(result.length, 2);
  assert.equal(result[0].timestamp, 1);
  assert.equal(result[1].timestamp, 2);
  assert.equal(result[1].close, 101);
});
