import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createDrawing,
  normalizeDrawings,
  updateDrawingHandle,
} from "../src/lib/chartDrawTools.ts";

/**
 * The long/short position calculator, in the toolbar that is actually live.
 *
 * Positions are drawn by ChartDrawLayer, which reads style.showLabels and the
 * drawing's own three points. It is NOT the position primitive in Chart.tsx -
 * that path is behind LEGACY_LEFT_TOOLBAR_ENABLED, which is false.
 */
const points = [
  { time: 100, price: 50 },   // entry, and the box's LEFT edge
  { time: 200, price: 45 },   // stop
  { time: 200, price: 60 },   // target
];

// --- a calculator is placed without its readout ---
{
  for (const tool of ["longPosition", "shortPosition"]) {
    const drawing = createDrawing(tool, points);
    assert.equal(drawing.style.showLabels, false,
      `${tool} must not place three pills across the chart`);
  }
  // Other tools keep their labels: this is specific to the calculators.
  assert.equal(createDrawing("trendLine", points.slice(0, 2)).style.showLabels, true);
  assert.equal(createDrawing("priceRange", points.slice(0, 2)).style.showLabels, true);
  // Turning them back on is still the trader's call and must survive a reload.
  const [restored] = normalizeDrawings([{
    id: "p1", tool: "longPosition", points,
    style: { ...createDrawing("longPosition", points).style, showLabels: true },
  }]);
  assert.equal(restored.style.showLabels, true, "an explicit choice is not overridden");
}

// --- THE resize bug: the right edge has to move IN, not only out ---
{
  const drawing = createDrawing("longPosition", points);
  const rightEdge = (d) => Math.max(d.points[1].time, d.points[2].time);
  assert.equal(rightEdge(drawing), 200);

  // Drag the TARGET handle (top-right on a long) inward.
  const pulledIn = updateDrawingHandle(drawing, 2, { time: 150, price: 60 });
  assert.equal(rightEdge(pulledIn), 150, "dragging the target in must shrink the box");

  // Drag the STOP handle (bottom-right) inward.
  const stopIn = updateDrawingHandle(drawing, 1, { time: 130, price: 45 });
  assert.equal(rightEdge(stopIn), 130, "dragging the stop in must shrink the box");

  // And outward still works.
  assert.equal(rightEdge(updateDrawingHandle(drawing, 2, { time: 300, price: 60 })), 300);

  // The old behaviour, for the record: moving one point alone left the other
  // holding the maximum, so the edge could only ever be pushed out.
  const naive = { ...drawing, points: drawing.points.map((p, i) => (i === 2 ? { time: 150, price: 60 } : p)) };
  assert.equal(rightEdge(naive), 200, "if this shrank, the bug would not have existed");
}

// --- the two right-edge points share a TIME, never a price ---
{
  const drawing = createDrawing("longPosition", points);
  const moved = updateDrawingHandle(drawing, 2, { time: 150, price: 72 });
  assert.equal(moved.points[2].price, 72, "the dragged handle takes the new price");
  assert.equal(moved.points[1].price, 45, "the stop level must not follow the target");
  assert.equal(moved.points[1].time, 150, "but the edge is shared");
  // The entry is the LEFT edge and is never dragged by the right-hand handles.
  assert.deepEqual(moved.points[0], { time: 100, price: 50 });
}

// --- the entry handle still moves the left edge on its own ---
{
  const drawing = createDrawing("longPosition", points);
  const moved = updateDrawingHandle(drawing, 0, { time: 140, price: 52 });
  assert.equal(moved.points[0].time, 140, "the left edge follows the entry handle");
  assert.equal(moved.points[0].price, 52);
  assert.equal(moved.points[1].time, 200, "and does not drag the right edge with it");
  assert.equal(moved.points[2].time, 200);
}

// --- every other tool moves exactly the handle it was given ---
{
  const line = createDrawing("trendLine", [{ time: 1, price: 1 }, { time: 2, price: 2 }]);
  const moved = updateDrawingHandle(line, 1, { time: 5, price: 9 });
  assert.deepEqual(moved.points, [{ time: 1, price: 1 }, { time: 5, price: 9 }]);
  const tri = createDrawing("trianglePattern", [
    { time: 1, price: 1 }, { time: 2, price: 2 }, { time: 3, price: 3 },
  ]);
  if (tri) {
    const t = updateDrawingHandle(tri, 1, { time: 9, price: 9 });
    assert.equal(t.points[2].time, 3, "a non-position third point must not be dragged");
  }
}

// --- the live layer is the one that changed ---
{
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  assert.ok(layer.includes("case \"longPosition\":"), "positions really are drawn here");
  assert.ok(layer.includes("updateDrawingHandle(drawing, drag.index, point)"),
    "the layer must resize through the shared helper");
  // The zones were pinned to TradingView's palette, so the calculator was the
  // one tool that never matched the theme.
  assert.ok(layer.includes("themeColor || \"#089981\""), "the target zone follows the bullish candle");
  assert.ok(layer.includes("themeBearColor || \"#F23645\""), "the risk zone follows the bearish candle");

  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.ok(chart.includes("themeBearColor={settings.downColor}"), "and the chart supplies it");
  // The other position implementation is behind a disabled flag; asserting it
  // stays disabled keeps a future reader from editing the dead one, which is
  // exactly the mistake this change corrects.
  assert.ok(chart.includes("const LEGACY_LEFT_TOOLBAR_ENABLED = false"),
    "the legacy toolbar must stay off, or there are two live position tools");
}

console.log("Position calculator tests passed.");
