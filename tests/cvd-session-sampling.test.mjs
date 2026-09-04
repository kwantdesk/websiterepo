import assert from "node:assert/strict";
import test from "node:test";

import {
  sampledPanePoints,
  sampledVerticalPanePoints,
} from "../src/lib/chartIndicatorPaneSampling.ts";

function cvdData(kind) {
  return Array.from({ length: 260 }, (_, time) => {
    const newSession = time >= 100;
    const value = newSession ? time - 99 : 1_000 + time;
    return {
      time,
      value,
      open: kind === "candlestick" ? value - 1 : undefined,
      high: kind === "candlestick" ? value + 2 : undefined,
      low: kind === "candlestick" ? value - 2 : undefined,
      close: kind === "candlestick" ? value : undefined,
      breakBefore: time === 100,
    };
  });
}

function definition(kind) {
  return {
    key: `cvd-${kind}`,
    label: "CVD",
    kind,
    placement: "pane",
    color: "#fff",
    data: cvdData(kind),
  };
}

test("zoomed-out CVD candles never merge two sessions into one false candle", () => {
  const sampled = sampledPanePoints(definition("candlestick"), (time) => Math.round(time / 2), 120);
  const boundaryBucket = sampled.filter((point) => point.x === 50);

  assert.equal(boundaryBucket.length, 2, "both sides of a shared boundary pixel must survive");
  assert.ok((boundaryBucket[0].close ?? 0) > 1_000, "the old-session candle remains independent");
  assert.equal(boundaryBucket[1].breakBefore, true, "the new session still begins a fresh path");
  assert.ok((boundaryBucket[1].open ?? Infinity) < 10, "the reset candle cannot inherit the prior session open");
});

test("line and histogram sampling preserve a break through the whole pixel bucket", () => {
  for (const kind of ["line", "histogram"]) {
    const sampled = sampledPanePoints(definition(kind), (time) => Math.round(time / 2), 120);
    const boundaryBucket = sampled.filter((point) => point.x === 50);
    assert.equal(boundaryBucket.length, 2, `${kind} keeps both boundary segments`);
    assert.equal(boundaryBucket[1].breakBefore, true, `${kind} keeps the path break`);
  }
});

test("side-docked CVD panes apply the same hard session boundary", () => {
  const sampled = sampledVerticalPanePoints(definition("candlestick"), (time) => Math.round(time / 2), 120);
  const boundaryBucket = sampled.filter((point) => point.y === 50);
  assert.equal(boundaryBucket.length, 2);
  assert.equal(boundaryBucket[1].breakBefore, true);
  assert.ok((boundaryBucket[1].open ?? Infinity) < 10);
});
