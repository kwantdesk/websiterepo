import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/footprintLive.ts", import.meta.url), "utf8")
  .replace(/export type[\s\S]*?};\n\n/, "")
  .replace("export function retainLiveFootprintRows<T extends LiveFootprintBarShape>", "function retainLiveFootprintRows")
  .replace(/\n  current: T\[\],\n  retained: T\[\],\n\): T\[\] \{/, "\n  current,\n  retained,\n) {");
const retainLiveFootprintRows = Function(`${source}; return retainLiveFootprintRows;`)();

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
