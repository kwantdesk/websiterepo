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

check("pulling the handle in SHRINKS it, and past the anchor clamps", () => {
  // THE REPORTED FAILURE. Width used to be measured as a raw distance from
  // the anchor, so pulling the handle inward shrank the marker only until it
  // reached the anchor and then GREW it again out the other side. Overshoot
  // by a pixel and it started expanding, which is why it "just did nothing"
  // when you tried to make it small.
  const big = entryAt({ handleX: 200 });
  assert.equal(big.halfWidth, 100);
  const smaller = entryAt({ handleX: 120 });
  assert.equal(smaller.halfWidth, 20, "pulling the handle in must shrink it");
  const tiny = entryAt({ handleX: 103 });
  assert.equal(tiny.halfWidth, 4, "all the way down to the minimum");
  // Dragged well past the anchor it stays at the minimum rather than growing.
  assert.equal(entryAt({ handleX: 20 }).halfWidth, 4, "past the anchor it must not grow back");
  assert.equal(entryAt({ handleX: -500 }).halfWidth, 4);
  // And it still points the right way at every size.
  for (const handleX of [200, 120, 103, 20, -500]) {
    assert.ok(entryAt({ handleX }).tipX >= 100, "an entry always points right");
  }
});

check("an exit shrinks the same way, in its own direction", () => {
  // Mirrored: its handle is to the LEFT, so pulling it right shrinks.
  assert.equal(exitAt({ handleX: 0 }).halfWidth, 100);
  assert.equal(exitAt({ handleX: 80 }).halfWidth, 20);
  assert.equal(exitAt({ handleX: 200 }).halfWidth, 4, "past the anchor it must not grow back");
  for (const handleX of [0, 80, 200]) {
    assert.ok(exitAt({ handleX }).tipX <= 100, "an exit always points left");
  }
});

check("height resizes symmetrically about the price", () => {
  assert.equal(entryAt({ handleY: 260 }).halfHeight, 60);
  assert.equal(entryAt({ handleY: 140 }).halfHeight, 60, "either side of the fill is the same height");
  assert.equal(entryAt({ handleY: 201 }).halfHeight, 3, "down to the minimum");
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

check("there is exactly ONE handle, and it is not buried under the anchor", () => {
  // The generic handles put one dot per POINT. This tool's two points are the
  // fill and a size corner nine pixels away, so both dots landed on top of
  // each other and the hit test always returned the anchor - the size handle
  // could not be grabbed at all. One handle now, drawn out at the triangle's
  // point where nothing else sits.
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  assert.match(layer, /const fillMarkerHandle = \(drawing\.tool === "entryArrow" \|\| drawing\.tool === "exitArrow"\)/);
  assert.match(layer, /cx=\{fillMarkerHandle\.tipX\}/, "the handle sits at the tip");
  assert.match(layer, /onPointerDown=\{\(event\) => beginFillMarkerResize\(drawing, event\)\}/);
  // It must be chosen BEFORE the generic per-point handles, or the overlapping
  // dots come straight back.
  const handles = layer.slice(layer.indexOf("const handles = !selected"));
  assert.ok(
    handles.indexOf("fillMarkerHandle") < handles.indexOf("positionCorners"),
    "the fill-marker branch must precede the generic handles",
  );
});

check("the whole marker is grabbable, not just its outline", () => {
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  const bodyHit = layer.slice(layer.indexOf("const bodyHit ="), layer.indexOf("// ---- rendering ----"));
  assert.match(bodyHit, /"entryArrow", "exitArrow"/, "both must use the bounding-box hit test");
});

console.log(`\nentry/exit fill markers: ${passed}/${passed} checks passed`);
