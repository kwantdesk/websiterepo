import assert from "node:assert/strict";
import test from "node:test";

import { RollingDepthEngine } from "../public/heatmap-app/src/depth-engine.js";
import { resolveTradeClusterAnchorIndex } from "../public/heatmap-app/src/renderer.js";

const frame = (id, timestamp, trades = []) => ({
  id,
  timestamp,
  bids: new Map(),
  asks: new Map(),
  trades,
});

const trade = (id, timestamp, tick, size, side = "buy") => ({
  id,
  timestamp,
  tick,
  size,
  side,
});

const clusterOptions = {
  start: 0,
  end: 20,
  rowTicks: 1,
  rowPixels: 10,
  columnPixels: 2,
  circleSize: 40,
  smartClustering: 100,
  differential: false,
};

test("a growing smart cluster retains its first execution price and frame", () => {
  const engine = new RollingDepthEngine(20);
  const firstFrame = frame(1, 1_000, [trade(1, 1_000, 100, 5)]);
  engine.append(firstFrame);

  const initial = engine.clusterTrades({ ...clusterOptions, end: 0 });
  assert.equal(initial.length, 1);
  assert.equal(initial[0].tick, 100);
  assert.equal(initial[0].anchorFrame, firstFrame);

  engine.append(frame(2, 1_050, [trade(2, 1_050, 101, 50)]));
  const grown = engine.clusterTrades({ ...clusterOptions, end: 1 });
  assert.equal(grown.length, 1, "nearby executions form one smart bubble");
  assert.equal(grown[0].total, 55, "the bubble still grows with new executions");
  assert.equal(grown[0].tick, 100, "new volume cannot drag an existing bubble to another price");
  assert.equal(grown[0].anchorFrame, firstFrame, "new volume cannot drag it to another time column");
});

test("a cached bubble resolves the same frame after the rolling window shifts", () => {
  const engine = new RollingDepthEngine(3);
  const anchor = frame(1, 1_000, [trade(1, 1_000, 100, 5)]);
  engine.append(anchor);
  engine.append(frame(2, 1_050));
  engine.append(frame(3, 1_100));
  const [cached] = engine.clusterTrades({ ...clusterOptions, end: 2 });
  assert.equal(resolveTradeClusterAnchorIndex(engine.frames, cached), 0);

  engine.append(frame(4, 1_150));
  assert.equal(resolveTradeClusterAnchorIndex(engine.frames, cached), -1,
    "a rolled-off cached bubble disappears instead of jumping onto another frame");

  const survivingAnchor = frame(5, 1_200, [trade(5, 1_200, 102, 4)]);
  engine.append(survivingAnchor);
  const [surviving] = engine.clusterTrades({ ...clusterOptions, end: 2 });
  engine.append(frame(6, 1_250));
  assert.equal(resolveTradeClusterAnchorIndex(engine.frames, surviving), 1,
    "the same market frame is remapped to its current rolling-array index");
});
