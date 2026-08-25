import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { entryExitArrowGeometry } from "../src/lib/chartDrawGeometry.ts";
import {
  DRAW_TOOL_GROUPS,
  DRAW_TOOL_LIST,
  DRAW_TOOL_SPECS,
  PAPER_FILL_BUY_COLOR,
  PAPER_FILL_SELL_COLOR,
  createDrawing,
  resolveDrawColor,
} from "../src/lib/chartDrawTools.ts";

/**
 * Entry and exit arrows: the drawn version of a real fill marker.
 *
 * The chart already marks a genuine fill with a green arrow pointing UP at the
 * bar from below for a buy, and a red one pointing DOWN at it from above for a
 * sell. A hand-drawn mark that faces the other way, or that a theme repaints
 * blue, is worse than useless on a chart being reviewed — so both the
 * direction and the colours are pinned here.
 */

const GEOMETRY = {
  defaultLength: 44, defaultHalfWidth: 9, minLength: 10, minHalfWidth: 4,
};
const up = (over = {}) => entryExitArrowGeometry({ direction: "up", tipX: 100, tipY: 200, ...GEOMETRY, ...over });
const down = (over = {}) => entryExitArrowGeometry({ direction: "down", tipX: 100, tipY: 200, ...GEOMETRY, ...over });

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("an entry points up at the bar, an exit points down at it", () => {
  // Screen y grows downward, so an arrow pointing UP has its body BELOW the
  // tip. This is the same orientation the real fill markers use.
  assert.ok(up().tailY > 200, "an entry's tail hangs below the marked price");
  assert.ok(down().tailY < 200, "an exit's tail sits above it");
  // The head is between the tip and the tail in both cases.
  assert.ok(up().headBaseY > 200 && up().headBaseY < up().tailY);
  assert.ok(down().headBaseY < 200 && down().headBaseY > down().tailY);
});

check("the tip is exactly the price being marked", () => {
  // A fill happened at one price; the point of the arrow is that price and
  // nothing else may shift it.
  for (const geometry of [up(), down(), up({ tailY: 900 }), down({ tailX: -400 })]) {
    assert.deepEqual(geometry.points[0], [100, 200], "the first point is the tip");
  }
});

check("dragging the tail through the tip cannot flip the arrow over", () => {
  // THE RULE. A green buy pointing down is the one thing a fill mark must
  // never show, so the tail is clamped to its own side of the tip however far
  // it is dragged past.
  const flipped = up({ tailY: 40 });
  assert.equal(flipped.tailY, 210, "clamped to the minimum length below the tip");
  assert.ok(flipped.tailY > 200, "still pointing up");

  const flippedDown = down({ tailY: 900 });
  assert.equal(flippedDown.tailY, 190);
  assert.ok(flippedDown.tailY < 200, "still pointing down");
});

check("the tail sets length and width, and nothing else", () => {
  const longer = up({ tailY: 400 });
  assert.equal(longer.length, 200);
  const wider = up({ tailX: 140 });
  assert.equal(wider.halfWidth, 40);
  // Width is a distance, so dragging left widens exactly as dragging right.
  assert.equal(up({ tailX: 60 }).halfWidth, 40);
  // Width never moves the arrow sideways off the bar it marks.
  assert.equal(wider.points[0][0], 100);
});

check("it stays legible when squashed", () => {
  const tiny = up({ tailY: 201, tailX: 100 });
  assert.ok(tiny.length >= 10, "a minimum length is enforced");
  assert.ok(tiny.halfWidth >= 4, "and a minimum width");
  assert.ok(tiny.shaftHalf >= 1.5, "the shaft never collapses to nothing");
  // The head may not swallow the whole arrow.
  assert.ok(Math.abs(tiny.headBaseY - 200) < tiny.length, "the head stops short of the tail");
});

check("an unplaced tail falls back to a sensible default", () => {
  // While the arrow is being placed there is no second point yet.
  const placing = entryExitArrowGeometry({ direction: "up", tipX: 100, tipY: 200, ...GEOMETRY });
  assert.equal(placing.tailY, 244);
  assert.equal(placing.halfWidth, 9);
  assert.equal(entryExitArrowGeometry({ direction: "down", tipX: 100, tipY: 200, ...GEOMETRY }).tailY, 156);
});

check("the outline is a closed arrow, not a triangle or a bar", () => {
  const geometry = up({ tailY: 300, tailX: 120 });
  assert.equal(geometry.points.length, 7, "tip, two head corners, and the four shaft corners");
  const [tip, headLeft, shaftLeftTop, shaftLeftEnd, shaftRightEnd, shaftRightTop, headRight] = geometry.points;
  assert.deepEqual(tip, [100, 200]);
  // The head is wider than the shaft — that is what makes it read as an arrow.
  assert.ok(headLeft[0] < shaftLeftTop[0], "head overhangs the shaft on the left");
  assert.ok(headRight[0] > shaftRightTop[0], "and on the right");
  assert.equal(shaftLeftEnd[1], geometry.tailY);
  assert.equal(shaftRightEnd[1], geometry.tailY);
  // Symmetric about the marked price.
  assert.equal(headLeft[0] + headRight[0], 200);
});

check("both tools are on the live rail, in their own group", () => {
  // The rail renders ONE button per group; a tool sharing a group with the
  // position calculators would be a chevron and a flyout away.
  for (const id of ["entryArrow", "exitArrow"]) {
    const spec = DRAW_TOOL_SPECS[id];
    assert.ok(spec, `${id} must be registered`);
    assert.equal(spec.group, "trade");
    assert.equal(spec.points, 1, "one click places it, then the handles size it");
    assert.ok(DRAW_TOOL_LIST.some((tool) => tool.id === id), `${id} must be in the live list`);
  }
  assert.ok(DRAW_TOOL_GROUPS.some((group) => group.id === "trade"), "the group needs its own rail slot");
});

check("they carry the real fill colours, and a theme cannot repaint them", () => {
  const entry = createDrawing("entryArrow", [{ time: 1, price: 1 }]);
  const exit = createDrawing("exitArrow", [{ time: 1, price: 1 }]);
  assert.equal(entry.style.color, PAPER_FILL_BUY_COLOR);
  assert.equal(exit.style.color, PAPER_FILL_SELL_COLOR);
  // useThemeColor:false is what stops the theme's line colour winning.
  assert.equal(entry.style.useThemeColor, false);
  assert.equal(exit.style.useThemeColor, false);
  assert.equal(resolveDrawColor(entry.style, "#1E90FF"), PAPER_FILL_BUY_COLOR, "a blue theme must not tint a buy");
  assert.equal(resolveDrawColor(exit.style, "#1E90FF"), PAPER_FILL_SELL_COLOR);
});

check("the colours are the ones the chart uses for genuine fills", () => {
  // If the marker colours are ever changed, a drawn entry must move with them
  // rather than quietly drifting to a different green.
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const markers = chart.slice(chart.indexOf("const isLong = trade.direction === \"LONG\""));
  assert.match(markers.slice(0, 300), new RegExp(PAPER_FILL_BUY_COLOR, "i"), "the buy green must match the fill marker");
  assert.match(markers.slice(0, 300), new RegExp(PAPER_FILL_SELL_COLOR, "i"), "and the sell red");
});

check("the whole arrow is grabbable, not just its outline", () => {
  // A 1px outline is not a drag target. The body hit test uses the bounding
  // box for these, the way it does for a rectangle or a position box.
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  const bodyHit = layer.slice(layer.indexOf("const bodyHit ="), layer.indexOf("// ---- rendering ----"));
  assert.match(bodyHit, /"entryArrow", "exitArrow"/, "both must use the bounding-box hit test");
});

console.log(`\nentry/exit arrows: ${passed}/${passed} checks passed`);
