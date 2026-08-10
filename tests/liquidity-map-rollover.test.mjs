import assert from "node:assert/strict";
import test from "node:test";

import { RollingDepthEngine } from "../public/heatmap-app/src/depth-engine.js";

const frame = (id, size) => ({
  id,
  bids: new Map([[99, size]]),
  asks: new Map([[101, size + 1]]),
  trades: [],
});

const heatmap = (engine) => engine.buildHeatmap({
  start: 0,
  end: engine.frames.length - 1,
  bottomTick: 96,
  topTick: 104,
  rowTicks: 1,
  rowPixels: 8,
  sensitivity: 1,
});

test("heatmap remains intact when half-step display frames roll past capacity", () => {
  const engine = new RollingDepthEngine(4);
  for (const current of [frame(1, 10), frame(1.5, 10), frame(2, 12), frame(2.5, 12)]) {
    engine.append(current);
  }
  heatmap(engine);

  const { shifted } = engine.append(frame(3, 14));
  const rolled = heatmap(engine);

  assert.equal(shifted, 1);
  assert.equal(rolled.shiftColumns, 1);
  assert.equal(rolled.updateStart, 3);
  assert.equal(rolled.width, 4);
  assert.ok(rolled.intensities.some((value) => value > 0));
});
