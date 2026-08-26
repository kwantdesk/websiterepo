import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A grab handle has to be big enough to actually grab.
 *
 * Every handle was a bare r=4.5 circle, so the grabbable region ended about
 * six pixels from its centre — measured in the live layer with
 * elementFromPoint. Aim for a dot and land seven pixels out and the pointer
 * hit the body layer underneath instead, which MOVES the drawing. So a resize
 * silently became a drag, on every tool that has handles: trend lines, rays,
 * rectangles, fibs, the position calculators, all of them.
 *
 * The dot still draws at 4.5 so nothing looks different. What changed is the
 * transparent circle around it that the pointer actually catches.
 */

const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const radius = (name) => {
  const match = layer.match(new RegExp(`const ${name} = ([\\d.]+);`));
  assert.ok(match, `${name} must be defined`);
  return Number(match[1]);
};

check("the target is far bigger than the dot", () => {
  const dot = radius("HANDLE_DOT_RADIUS_PX");
  const hit = radius("HANDLE_HIT_RADIUS_PX");
  assert.ok(hit >= dot * 2, `the grabbable area must dwarf the dot — dot ${dot}, hit ${hit}`);
  // Below about ten pixels a handle is not reliably hittable with a mouse,
  // and missing it does not do nothing: it drags the whole drawing.
  assert.ok(hit >= 10, `a ${hit}px reach is still too small to aim at`);
});

check("the dot itself did not change size", () => {
  // This is a hit-testing fix, not a restyle. A bigger visible dot would
  // cover the price action the handle is marking.
  assert.equal(radius("HANDLE_DOT_RADIUS_PX"), 4.5, "the drawn dot must look exactly as it did");
});

check("every handle goes through the one helper", () => {
  // Three separate render paths grew their own circles: the generic per-point
  // handles, the position calculator's four corners, and the fill marker's
  // single tip handle. All three had the same unreachable target.
  const block = layer.slice(layer.indexOf("const grabHandle = ("), layer.indexOf("return (\n      <g"));
  assert.match(block, /fillMarkerHandle\s*\?\s*grabHandle\(/, "the fill marker's handle");
  assert.match(block, /positionCorners\s*\n?\s*\?\s*positionCorners\.map\(\(corner\) => grabHandle\(/, "the position corners");
  assert.match(block, /\)\.map\(\(\{ point, index \}\) => grabHandle\(/, "the generic per-point handles");
  // And none of them may hand-roll a circle with its own pointer handling.
  assert.doesNotMatch(
    block,
    /<circle[^>]*onPointerDown/s,
    "a hand-rolled handle would reintroduce the small target",
  );
});

check("the helper draws the target first and the dot on top", () => {
  const helper = layer.slice(layer.indexOf("const grabHandle = ("), layer.indexOf("const handles = !selected"));
  const hitIndex = helper.indexOf("HANDLE_HIT_RADIUS_PX");
  const dotIndex = helper.indexOf("HANDLE_DOT_RADIUS_PX");
  assert.ok(hitIndex > 0 && dotIndex > hitIndex, "the transparent target must sit behind the visible dot");
  assert.match(helper, /fill="transparent"/, "the target must be invisible");
  // The group carries the pointer handling, so a press anywhere inside the
  // target counts — including on the dot.
  assert.match(helper, /<g key=\{key\} data-draw-hit="handle" style=\{\{ pointerEvents: "all", cursor \}\} onPointerDown=\{onGrab\}>/);
});

check("each handle keeps its own cursor", () => {
  // The cursor is the only thing telling a trader what a handle will do.
  const block = layer.slice(layer.indexOf("const handles = !selected"), layer.indexOf("return (\n      <g"));
  assert.match(block, /"ew-resize"/, "the fill marker resizes sideways");
  assert.match(block, /"nwse-resize"/, "a position corner resizes diagonally");
  assert.match(block, /"grab"/, "a plain anchor is grabbed");
});

check("pressing a handle cannot deselect the drawing out from under it", () => {
  // THE REPORTED FAILURE, reproduced on production: grab a corner, and the
  // handles vanish instead of resizing. Measured with a real mouse drag on a
  // placed Long Position — the four handle dots went from four to zero.
  //
  // The deselect listener is NATIVE and sits on the chart container. React
  // attaches its own listeners once at the app ROOT, an ancestor of that
  // container, so the native listener runs FIRST and the React handler's
  // stopPropagation() lands too late to protect the selection. The old code
  // cleared unconditionally and relied on exactly that stopPropagation, which
  // is why every tool with handles behaved the same way.
  const clear = layer.slice(layer.indexOf("if (!selectedId) return;"), layer.indexOf("const dragCleanupRef"));
  assert.match(clear, /const clear = \(event: PointerEvent\) =>/,
    "the listener must receive the event so it can read the target");
  assert.match(clear, /target\?\.closest\?\.\("\[data-draw-hit\]"\)/,
    "a press inside a drawing must be recognised by its marker, not by propagation");
  assert.doesNotMatch(clear, /const clear = \(\) => onSelect\(null\);/,
    "an unconditional clear is the bug");
});

check("every interactive part of a drawing carries the hit marker", () => {
  // If a grabbable element is missing the marker, pressing it clears the
  // selection and that tool goes back to doing nothing.
  assert.match(layer, /<g key=\{key\} data-draw-hit="handle"/, "resize/anchor handles");
  assert.match(layer, /<g data-draw-hit="body"/, "the fat transparent hit layer");
  assert.match(layer, /data-draw-hit=\{interactive \? "drawing" : undefined\}/, "the drawing group itself");
});

check("handles still only appear on the selected drawing", () => {
  // Every drawing showing its dots at once would bury the chart.
  assert.match(layer, /const handles = !selected\s*\n\s*\? null/);
});

console.log(`\ndraw handle grab: ${passed}/${passed} checks passed`);
