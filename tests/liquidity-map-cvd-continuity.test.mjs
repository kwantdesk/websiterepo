import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeLiveCvdHistory,
  normalizeCvdHistory,
} from "../public/heatmap-app/src/order-flow-indicators.js";

const point = (timestamp, value) => ({
  timestamp,
  open: value,
  high: value,
  low: value,
  close: value,
  value,
  buy: Math.max(0, value),
  sell: Math.min(0, value),
});

test("scheduled reconnect keeps the existing sub-second CVD path", () => {
  const current = [point(60_000, 10), point(60_250, 14), point(60_500, 12)];
  const minuteSeed = [point(60_000, 12)];
  assert.deepEqual(
    mergeLiveCvdHistory(current, minuteSeed, { sameSession: true, asOfMs: 60_600 }),
    current,
  );
});

test("a reconnect adds one truthful reconciliation point for missed flow", () => {
  const current = [point(60_000, 10), point(60_500, 12)];
  const minuteSeed = [point(60_000, 17)];
  const merged = mergeLiveCvdHistory(current, minuteSeed, {
    sameSession: true,
    asOfMs: 60_800,
  });
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.at(-1), {
    timestamp: 60_800,
    open: 12,
    high: 17,
    low: 12,
    close: 17,
    value: 17,
    buy: 17,
    sell: 0,
  });
});

test("a new trading session replaces rather than joins the old CVD", () => {
  assert.deepEqual(
    mergeLiveCvdHistory([point(60_000, 12)], [point(120_000, -3)], { sameSession: false }),
    [point(120_000, -3)],
  );
});

test("CVD history normalization is monotonic and deduplicated", () => {
  assert.deepEqual(
    normalizeCvdHistory([point(2, 1), point(1, 0), point(2, 2)]).map(row => [row.timestamp, row.value]),
    [[1, 0], [2, 2]],
  );
});
