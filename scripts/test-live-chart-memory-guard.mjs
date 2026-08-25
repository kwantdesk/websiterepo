import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildLightweightSeriesDataSnapshot,
  planLightweightSeriesDataSync,
} from "../src/lib/lightweightSeriesDataSync.ts";

const base = Array.from({ length: 512 }, (_, index) => ({
  time: index + 1,
  value: index * 0.25,
}));
const first = buildLightweightSeriesDataSnapshot(base);
assert.equal(planLightweightSeriesDataSync(null, first), "replace");

const unchanged = buildLightweightSeriesDataSnapshot(base, first);
assert.equal(planLightweightSeriesDataSync(first, unchanged), "none");

const revised = base.map((point, index) => index === base.length - 1
  ? { ...point, value: point.value + 1 }
  : point);
const revisedSnapshot = buildLightweightSeriesDataSnapshot(revised, unchanged);
assert.equal(planLightweightSeriesDataSync(unchanged, revisedSnapshot), "update-last");

const appended = [...revised, { time: 513, value: 130 }];
const appendedSnapshot = buildLightweightSeriesDataSnapshot(appended, revisedSnapshot);
assert.equal(planLightweightSeriesDataSync(revisedSnapshot, appendedSnapshot), "append");

const rewritten = appended.map((point, index) => index === 100
  ? { ...point, value: -999 }
  : point);
let forcedPrevious = appendedSnapshot;
for (let index = forcedPrevious.incrementalUpdates; index < 128; index += 1) {
  forcedPrevious = buildLightweightSeriesDataSnapshot(appended, forcedPrevious);
}
const rewrittenSnapshot = buildLightweightSeriesDataSnapshot(rewritten, forcedPrevious);
assert.equal(planLightweightSeriesDataSync(forcedPrevious, rewrittenSnapshot), "replace");

let setDataCalls = 0;
let updateCalls = 0;
const snapshots = [];
const windows = [];
for (let seriesIndex = 0; seriesIndex < 48; seriesIndex += 1) {
  const points = base.map((point) => ({ ...point, value: point.value + seriesIndex }));
  windows.push(points);
  snapshots.push(buildLightweightSeriesDataSnapshot(points));
  setDataCalls += 1;
}

for (let tick = 0; tick < 10_000; tick += 1) {
  for (let seriesIndex = 0; seriesIndex < windows.length; seriesIndex += 1) {
    const points = windows[seriesIndex];
    const lastTime = Number(points.at(-1)?.time ?? 0);
    points.shift();
    points.push({ time: lastTime + 1, value: tick + seriesIndex / 10 });
    const next = buildLightweightSeriesDataSnapshot(points, snapshots[seriesIndex]);
    const plan = planLightweightSeriesDataSync(snapshots[seriesIndex], next);
    if (plan === "replace") setDataCalls += 1;
    else if (plan === "append" || plan === "update-last") updateCalls += 1;
    snapshots[seriesIndex] = next;
  }
}

assert.ok(updateCalls > 470_000, `expected incremental updates, received ${updateCalls}`);
assert.ok(setDataCalls < 4_000, `full replacements were not bounded: ${setDataCalls}`);
assert.ok(JSON.stringify(snapshots).length < 40_000, "series sync metadata retained too much state");

const chartSource = await readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
assert.match(chartSource, /planLightweightSeriesDataSync\(existing\.dataSnapshot, dataSnapshot\)/);
assert.match(chartSource, /existing\.series\.update\(latestPoint\)/);
assert.doesNotMatch(
  chartSource,
  /priceFormat, settings, themeVersion/,
  "raw settings object must not recreate the complete chart lifecycle",
);
assert.match(chartSource, /marketTrades = EMPTY_CHART_ITEMS/);
assert.match(chartSource, /paperWorkingOrders = EMPTY_CHART_ITEMS/);

console.log(`live chart memory guard passed: ${updateCalls} incremental updates, ${setDataCalls} bounded replacements`);
