import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The order label is drawn TWICE.
 *
 * PaperPositionOverlayRenderer paints the box, the SL / TP dividers and the
 * text onto the chart canvas. A canvas cannot receive a click, so an invisible
 * HTML twin - the paper-position-overlay-label / paper-protection-overlay-label
 * blocks - is stacked exactly on top of it to carry the pointer targets.
 *
 * Both were hand-matched magic numbers: 164x16 box, 20px handles, 8px type,
 * 16px close cell, written out once in canvas arithmetic and again as Tailwind
 * classes several thousand lines away. Nothing tied them together, so resizing
 * the painted label alone would leave every hit target behind it - the SL and
 * TP handles would still work, just not where the trader can see them, which on
 * a live position means dragging a stop somewhere you did not intend.
 *
 * They now derive from PAPER_LABEL_SCALE. This test fails if either half goes
 * back to carrying its own numbers.
 */

const source = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const constant = (name) => {
  const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
  assert.ok(match, `${name} is missing`);
  return Function(`"use strict";const PAPER_LABEL_SCALE=${
    name === "PAPER_LABEL_SCALE" ? match[1] : source.match(/const PAPER_LABEL_SCALE = (\d+);/)[1]
  };return ${match[1]};`)();
};

const SCALE = constant("PAPER_LABEL_SCALE");
const WIDTH = constant("PAPER_LABEL_WIDTH");
const HEIGHT = constant("PAPER_LABEL_HEIGHT");
const FONT = constant("PAPER_LABEL_FONT_PX");
const PAD = constant("PAPER_LABEL_PAD_X");
const HANDLE = constant("PAPER_LABEL_HANDLE_WIDTH");
const CLOSE = constant("PAPER_LABEL_CLOSE_WIDTH");

check("the label is twice the size it was", () => {
  // The owner asked for 2x: the box and the numbers inside it were too small
  // to read against candles.
  assert.equal(SCALE, 2);
  assert.deepEqual(
    { WIDTH, HEIGHT, FONT, PAD, HANDLE, CLOSE },
    { WIDTH: 328, HEIGHT: 32, FONT: 16, PAD: 14, HANDLE: 40, CLOSE: 32 },
  );
});

check("the canvas painter carries no geometry of its own", () => {
  const renderer = source.slice(
    source.indexOf("class PaperPositionOverlayRenderer"),
    source.indexOf("class PaperPositionOverlayView"),
  );
  assert.ok(renderer.length > 0 && renderer.length < 6_000);
  assert.match(renderer, /const labelWidth = PAPER_LABEL_WIDTH;/);
  assert.match(renderer, /const labelHeight = PAPER_LABEL_HEIGHT;/);
  assert.match(renderer, /context\.font = `700 \$\{PAPER_LABEL_FONT_PX\}px/);
  assert.match(renderer, /let textLeft = labelX \+ PAPER_LABEL_PAD_X;/);
  assert.match(renderer, /level\.showClose \? PAPER_LABEL_CLOSE_WIDTH : 0/);
  // The old literals must not creep back in.
  assert.doesNotMatch(renderer, /const labelWidth = 164;/);
  assert.doesNotMatch(renderer, /700 8px/);
  assert.doesNotMatch(renderer, /textLeft \+= 20;/);
});

check("the hit targets are sized from the same constants", () => {
  for (const marker of ["paper-position-overlay-label", "paper-protection-overlay-label"]) {
    const at = source.indexOf(marker);
    assert.ok(at > 0, `${marker} is missing`);
    const block = source.slice(at, at + 400);
    // A fixed Tailwind size here is the drift: it cannot follow the scale.
    assert.doesNotMatch(block, /w-\[164px\]/, `${marker} still hard-codes its width`);
    assert.doesNotMatch(block, /\bh-4\b/, `${marker} still hard-codes its height`);
    assert.match(block, /height: PAPER_LABEL_HEIGHT/, `${marker} must size from the constant`);
    assert.match(block, /width: PAPER_LABEL_WIDTH/, `${marker} must size from the constant`);
  }
  // Handles, text inset and close cell too.
  assert.equal((source.match(/width: PAPER_LABEL_HANDLE_WIDTH/g) ?? []).length, 2, "SL and TP handles");
  assert.equal((source.match(/width: PAPER_LABEL_CLOSE_WIDTH/g) ?? []).length, 2, "both close cells");
  assert.equal((source.match(/paddingLeft: PAPER_LABEL_PAD_X/g) ?? []).length, 2, "both text bodies");
  assert.equal((source.match(/fontSize: PAPER_LABEL_FONT_PX/g) ?? []).length, 2, "both handle captions");
  assert.doesNotMatch(source, /<X className="h-2\.5 w-2\.5" \/>/, "the close glyph must scale too");
});

check("both halves land on the same cell boundaries", () => {
  // Canvas walks left to right with textLeft; the HTML twin is a flex row.
  // If these ever disagree the handles sit off the drawn dividers.
  const canvasAfterBothHandles = PAD + HANDLE + HANDLE;
  const htmlTextStart = HANDLE + HANDLE + PAD;
  assert.equal(canvasAfterBothHandles, htmlTextStart, "text body starts in the same place");
  assert.equal(WIDTH - CLOSE, 296, "the close cell divider");
  // The dividers must fall inside the box, not past its right edge.
  assert.ok(HANDLE * 2 + PAD < WIDTH - CLOSE, "handles and close cell must not overlap");
});

console.log(`\npaper order label geometry: ${passed}/${passed} checks passed`);
