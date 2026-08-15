import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chart = readFileSync(
  new URL("../src/components/Chart.tsx", import.meta.url),
  "utf8",
);

test("session boxes are native chart primitives anchored at draw time", () => {
  assert.match(chart, /class SessionWindowPrimitive implements ISeriesPrimitive<Time>/);
  assert.match(chart, /chart\.timeScale\(\)\.timeToCoordinate\(session\.startTime\)/);
  assert.match(chart, /chart\.timeScale\(\)\.timeToCoordinate\(session\.endTime\)/);
  assert.match(chart, /series\.priceToCoordinate\(session\.high\)/);
  assert.match(chart, /series\.priceToCoordinate\(session\.low\)/);
  assert.match(chart, /candleSeries\.attachPrimitive\(sessionWindowPrimitive\)/);
  assert.match(chart, /sessionWindowPrimitiveRef\.current\?\.update\(sessionWindowRenderData\)/);
  assert.doesNotMatch(chart, /positionedSessionWindows/);
});
