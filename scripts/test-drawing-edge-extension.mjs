import assert from "node:assert/strict";

const { extendHorizontalBoundsToViewport } = await import(
  "../src/vendor/lightweight-charts-drawing/core/geometry.ts"
);
const { Rectangle } = await import(
  "../src/vendor/lightweight-charts-drawing/tools/shapes/rectangle.ts"
);

const original = extendHorizontalBoundsToViewport(180, 420, 900, false, false);
assert.deepEqual(original, { left: 180, right: 420 });

const left = extendHorizontalBoundsToViewport(180, 420, 900, true, false);
assert.deepEqual(left, { left: 0, right: 420 });

const right = extendHorizontalBoundsToViewport(420, 180, 900, false, true);
assert.deepEqual(right, { left: 180, right: 900 });

const both = extendHorizontalBoundsToViewport(420, 180, 900, true, true);
assert.deepEqual(both, { left: 0, right: 900 });

const viewport = {
  width: 900,
  height: 500,
  timeScale: {
    coordinateToTime: (x) => x,
    timeToCoordinate: (time) => Number(time),
  },
  priceScale: {
    coordinateToPrice: (y) => y,
    priceToCoordinate: (price) => price,
  },
};
const rectangle = new Rectangle(
  "edge-test",
  [{ time: 180, price: 100 }, { time: 420, price: 200 }],
  {},
  { extendLeft: true, extendRight: true },
);
assert.deepEqual(rectangle.computeGeometry(viewport)[0], {
  type: "rectangle",
  topLeft: { x: 0, y: 100 },
  width: 900,
  height: 100,
});
assert.equal(rectangle.testHit({ x: 850, y: 150 }, viewport), true);

console.log("drawing edge extension: 6/6 checks passed");
