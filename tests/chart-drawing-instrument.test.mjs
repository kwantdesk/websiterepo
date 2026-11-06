import test from "node:test";
import assert from "node:assert/strict";
import { createDrawing, DRAW_TOOL_LIST, normalizeDrawings } from "../src/lib/chartDrawTools.ts";
import { commitChartDrawingProjection, drawingPriceBasis, projectChartDrawing } from "../src/lib/chartDrawingInstrument.ts";

const time = 1_800_000_000;
const market = (instrument, open, timestamp = time * 1_000, tickSize = 0.25) => ({
  instrument, candles: [{ timestamp, open }], intervalMs: 60_000, tickSize,
});
const nq = market("NQ", 20_000);
const es = market("ES", 5_000);
const points = prices => prices.map((price, i) => ({ time: time + i * 60, price }));
function saved(tool, prices) {
  const drawing = createDrawing(tool, points(prices));
  return { ...drawing, priceBasis: drawingPriceBasis(drawing.points, nq) };
}

test("instrument projections preserve timestamps, styles, same-market prices and stored anchors", () => {
  const original = saved("rectangle", [20_000, 20_020]);
  const projected = projectChartDrawing(original, es);
  assert.deepEqual(projected.points, points([5_000, 5_005]));
  assert.strictEqual(projected.style, original.style);
  assert.strictEqual(projectChartDrawing(original, market("MNQ", 20_000.25)), original);
  assert.deepEqual(projectChartDrawing(original, nq).points, points([20_000, 20_020]));
  assert.deepEqual(normalizeDrawings(JSON.parse(JSON.stringify([original])))[0].priceBasis, original.priceBasis);
});

test("converting a small risk or reward keeps its side and preserves exact break-even", () => {
  const long = saved("longPosition", [20_000, 19_999.75, 20_000.25]);
  const short = saved("shortPosition", [20_000, 20_000, 19_999.75]);
  assert.deepEqual(projectChartDrawing(long, es).points, points([5_000, 4_999.75, 5_000.25]));
  assert.deepEqual(projectChartDrawing(short, es).points, points([5_000, 5_000, 4_999.75]));
});

test("unpaired prices stay hidden and do not get deleted with visible drawings", () => {
  const line = saved("trendLine", [20_000, 20_020]);
  const profile = saved("fixedRangeVolumeProfile", [20_000, 20_020]);
  const late = market("ES", 5_100, (time + 60) * 1_000);
  const projected = projectChartDrawing(profile, late);
  assert.equal(projectChartDrawing(line, late), null);
  assert.deepEqual(projected.points, points([5_100, 5_100]));
  assert.deepEqual(commitChartDrawingProjection([line, profile], [projected], [], late), [line]);
});

test("style-only edits retain native geometry, while a moved drawing adopts its edited market basis", () => {
  const original = saved("rectangle", [20_000, 20_020]);
  const projected = projectChartDrawing(original, es);
  const styled = { ...projected, style: { ...projected.style, width: 2 } };
  const [changedStyle] = commitChartDrawingProjection([original], [projected], [styled], es);
  assert.deepEqual(changedStyle.points, original.points);
  assert.deepEqual(changedStyle.priceBasis, original.priceBasis);
  assert.equal(changedStyle.style.width, 2);
  const moved = { ...styled, points: points([5_002, 5_007]) };
  const [changedGeometry] = commitChartDrawingProjection([changedStyle], [styled], [moved], es);
  assert.deepEqual(changedGeometry.points, moved.points);
  assert.equal(changedGeometry.priceBasis.instrument, "ES");
  assert.deepEqual(projectChartDrawing(changedGeometry, nq).points, points([20_008, 20_028]));
});


test("every chart drawing geometry projects through the same tick-aware path", () => {
  for (const spec of DRAW_TOOL_LIST) {
    if (spec.points === 0) continue;
    const count = typeof spec.points === "number" ? spec.points : 3;
    const native = saved(spec.id, Array.from({ length: count }, (_, i) => 20_000 + 4 * i));
    const converted = projectChartDrawing(native, es);
    assert.equal(converted.tool, spec.id);
    assert.deepEqual(converted.points, points(Array.from({ length: count }, (_, i) => 5_000 + i)));
  }
});
