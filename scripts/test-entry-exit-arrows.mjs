import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fillMarkerGeometry } from "../src/lib/chartDrawGeometry.ts";
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
 * Entry and exit markers: the drawn version of the mark a real fill leaves.
 *
 * When a paper order fills, PaperFillMarkersRenderer paints a SIDEWAYS
 * triangle centred on the fill — pointing RIGHT into an entry, LEFT out of an
 * exit, in #22e887 / #ff3b5c. These tools draw that same mark by hand, so the
 * shape, the direction and the colours are all pinned against the renderer
 * itself rather than against a remembered description of it.
 *
 * (An earlier cut of this used the BACKTEST series markers instead — vertical
 * up/down arrows in a different green and red. Same idea, wrong marker. The
 * checks below read the real renderer so that cannot happen silently again.)
 */

const SIZES = {
  defaultHalfWidth: 9, defaultHalfHeight: 6, minHalfWidth: 4, minHalfHeight: 3,
};
const entryAt = (over = {}) => fillMarkerGeometry({ direction: "right", anchorX: 100, anchorY: 200, ...SIZES, ...over });
const exitAt = (over = {}) => fillMarkerGeometry({ direction: "left", anchorX: 100, anchorY: 200, ...SIZES, ...over });

/** The renderer that draws a genuine fill, read as the source of truth. */
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const realRenderer = chart.slice(
  chart.indexOf("class PaperFillMarkersRenderer"),
  chart.indexOf("class PaperFillMarkersView"),
);

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the real fill marker is a sideways triangle, and still is", () => {
  // If the genuine marker is ever redrawn as something else, this fails and
  // the drawn version has to follow it rather than quietly diverging.
  assert.match(realRenderer, /const entry = marker\.role === "entry"/);
  // Entry: back at x-6, point at x+6 — pointing RIGHT.
  assert.match(realRenderer, /moveTo\(x - 6, y - 4\)[\s\S]*?lineTo\(x \+ 6, y\)[\s\S]*?lineTo\(x - 6, y \+ 4\)/);
  // Exit: back at x+6, point at x-6 — pointing LEFT.
  assert.match(realRenderer, /moveTo\(x \+ 6, y - 4\)[\s\S]*?lineTo\(x - 6, y\)[\s\S]*?lineTo\(x \+ 6, y \+ 4\)/);
  assert.match(realRenderer, new RegExp(PAPER_FILL_BUY_COLOR));
  assert.match(realRenderer, new RegExp(PAPER_FILL_SELL_COLOR));
});

check("an entry points right into the trade, an exit points left out of it", () => {
  assert.equal(entryAt().tipX, 109, "the entry's point is to the RIGHT of the fill");
  assert.equal(entryAt().backX, 91, "and its flat back to the left");
  assert.equal(exitAt().tipX, 91, "the exit's point is to the LEFT");
  assert.equal(exitAt().backX, 109);
  // Never up or down: the point sits exactly on the fill's price.
  assert.equal(entryAt().points[0][1], 200);
  assert.equal(exitAt().points[0][1], 200);
});

check("it is centred on the fill, exactly as the real marker is", () => {
  // The real triangle straddles the anchor from x-6 to x+6 and y-4 to y+4,
  // so the anchor is its middle, not its tip.
  const geometry = entryAt();
  assert.equal((geometry.tipX + geometry.backX) / 2, 100, "horizontally centred on the fill");
  const ys = geometry.points.map(([, y]) => y);
  assert.equal((Math.min(...ys) + Math.max(...ys)) / 2, 200, "and vertically");
});

check("it keeps the real marker's 3:2 proportion by default", () => {
  // 12x8 in the renderer; the drawn one starts larger for grabbing but the
  // same shape, so a drawn mark and a real one read as the same thing.
  const geometry = entryAt();
  assert.equal(geometry.halfWidth / geometry.halfHeight, 9 / 6);
  assert.equal(12 / 8, 6 / 4, "the real marker's own ratio");
  assert.equal(geometry.halfWidth / geometry.halfHeight, 6 / 4);
});

check("the handle resizes it and can never turn it around", () => {
  // THE RULE. The half-extents are distances, so dragging the handle to the
  // far side of the anchor makes the marker bigger — an entry cannot be
  // dragged into pointing left.
  const bigger = entryAt({ handleX: 140, handleY: 230 });
  assert.equal(bigger.halfWidth, 40);
  assert.equal(bigger.halfHeight, 30);
  assert.ok(bigger.tipX > 100, "still pointing right");

  const draggedThrough = entryAt({ handleX: 60, handleY: 170 });
  assert.equal(draggedThrough.halfWidth, 40, "the same size, mirrored");
  assert.equal(draggedThrough.tipX, 140, "and still pointing right");
  assert.ok(exitAt({ handleX: 160 }).tipX < 100, "an exit still points left");
});

check("it stays legible when squashed", () => {
  const tiny = entryAt({ handleX: 100, handleY: 200 });
  assert.equal(tiny.halfWidth, 4);
  assert.equal(tiny.halfHeight, 3);
  assert.equal(tiny.points.length, 3, "always three corners");
});

check("an unplaced handle falls back to the default size", () => {
  const placing = fillMarkerGeometry({ direction: "right", anchorX: 100, anchorY: 200, ...SIZES });
  assert.equal(placing.halfWidth, 9);
  assert.equal(placing.halfHeight, 6);
});

check("both tools are on the live rail, in their own group", () => {
  // The rail renders ONE button per group; sharing a group with the position
  // calculators would put these a chevron and a flyout away.
  for (const id of ["entryArrow", "exitArrow"]) {
    const spec = DRAW_TOOL_SPECS[id];
    assert.ok(spec, `${id} must be registered`);
    assert.equal(spec.group, "trade");
    assert.equal(spec.points, 1, "one click places it, then the handle sizes it");
    assert.ok(DRAW_TOOL_LIST.some((tool) => tool.id === id));
  }
  assert.ok(DRAW_TOOL_GROUPS.some((group) => group.id === "trade"), "the group needs its own rail slot");
});

check("they carry the real fill colours, and a theme cannot repaint them", () => {
  const entry = createDrawing("entryArrow", [{ time: 1, price: 1 }]);
  const exit = createDrawing("exitArrow", [{ time: 1, price: 1 }]);
  assert.equal(entry.style.color, PAPER_FILL_BUY_COLOR);
  assert.equal(exit.style.color, PAPER_FILL_SELL_COLOR);
  assert.equal(entry.style.useThemeColor, false);
  assert.equal(exit.style.useThemeColor, false);
  assert.equal(resolveDrawColor(entry.style, "#1E90FF"), PAPER_FILL_BUY_COLOR, "a blue theme must not tint a buy");
  assert.equal(resolveDrawColor(exit.style, "#1E90FF"), PAPER_FILL_SELL_COLOR);
  // A real fill marker carries no caption, so neither does the drawn one.
  assert.equal(entry.style.showLabels, false);
});

check("the whole marker is grabbable, not just its outline", () => {
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  const bodyHit = layer.slice(layer.indexOf("const bodyHit ="), layer.indexOf("// ---- rendering ----"));
  assert.match(bodyHit, /"entryArrow", "exitArrow"/, "both must use the bounding-box hit test");
});

console.log(`\nentry/exit fill markers: ${passed}/${passed} checks passed`);
