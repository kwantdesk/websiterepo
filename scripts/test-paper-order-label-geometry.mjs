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
 * Both halves once carried their own hand-matched magic numbers, written out in
 * canvas arithmetic and again as Tailwind classes several thousand lines away.
 * Nothing tied them together, so resizing the painted label alone would leave
 * every hit target behind it: the SL and TP handles would still work, just not
 * where the trader can see them, which on a live position means dragging a stop
 * somewhere you did not intend.
 *
 * They now derive from PAPER_LABEL_SCALE and a shared width helper. This test
 * fails if either half goes back to carrying its own numbers.
 */

const source = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const SCALE_TEXT = source.match(/const PAPER_LABEL_SCALE = (\d+);/)?.[1];
assert.ok(SCALE_TEXT, "PAPER_LABEL_SCALE is missing");

const constant = (name) => {
  const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
  assert.ok(match, `${name} is missing`);
  return Function(
    "PAPER_LABEL_SCALE", "PAPER_LABEL_FONT_PX",
    `return ${match[1]};`,
  )(Number(SCALE_TEXT), Number(SCALE_TEXT) * 8);
};

const SCALE = constant("PAPER_LABEL_SCALE");
const HEIGHT = constant("PAPER_LABEL_HEIGHT");
const FONT = constant("PAPER_LABEL_FONT_PX");
const PAD = constant("PAPER_LABEL_PAD_X");
const HANDLE = constant("PAPER_LABEL_HANDLE_WIDTH");
const CLOSE = constant("PAPER_LABEL_CLOSE_WIDTH");
const CHAR = constant("PAPER_LABEL_CHAR_PX");
const MIN = constant("PAPER_LABEL_MIN_WIDTH");
const MAX = constant("PAPER_LABEL_MAX_WIDTH");

const renderer = source.slice(
  source.indexOf("class PaperPositionOverlayRenderer"),
  source.indexOf("class PaperPositionOverlayView"),
);

/** Lift a helper out of the source and run it for real. */
const evalHelper = (name) => {
  const at = source.indexOf(`function ${name}(`);
  assert.ok(at > 0, `${name} is missing`);
  const body = source.slice(at, source.indexOf("\n}\n", at) + 2)
    .replace(/: (number|string|boolean)\b/g, "");
  return Function(
    "PAPER_LABEL_PAD_X", "PAPER_LABEL_HANDLE_WIDTH", "PAPER_LABEL_CLOSE_WIDTH",
    "PAPER_LABEL_CHAR_PX", "PAPER_LABEL_MIN_WIDTH", "PAPER_LABEL_MAX_WIDTH",
    "paperLabelChromePx",
    `${body} return ${name};`,
  );
};
const args = [PAD, HANDLE, CLOSE, CHAR, MIN, MAX];
const chromePx = evalHelper("paperLabelChromePx")(...args, null);
const widthPx = evalHelper("paperLabelWidthPx")(...args, chromePx);
const fitted = evalHelper("paperLabelFittedText")(...args, chromePx);

check("the label is twice the size it was", () => {
  // The owner asked for 2x: the box and the numbers inside were not readable
  // against candles, which is the one moment they need to be.
  assert.equal(SCALE, 2);
  assert.deepEqual(
    { HEIGHT, FONT, PAD, HANDLE, CLOSE, MIN },
    { HEIGHT: 32, FONT: 16, PAD: 14, HANDLE: 40, CLOSE: 32, MIN: 328 },
  );
});

check("the canvas painter carries no geometry of its own", () => {
  assert.ok(renderer.length > 0 && renderer.length < 8_000, `slice looks wrong: ${renderer.length}`);
  assert.match(renderer, /const labelHeight = PAPER_LABEL_HEIGHT;/);
  assert.match(renderer, /context\.font = `700 \$\{PAPER_LABEL_FONT_PX\}px/);
  assert.match(renderer, /let textLeft = labelX \+ PAPER_LABEL_PAD_X;/);
  assert.match(renderer, /level\.showClose \? PAPER_LABEL_CLOSE_WIDTH : 0/);
  assert.doesNotMatch(renderer, /const labelWidth = 164;/);
  assert.doesNotMatch(renderer, /700 8px/);
  assert.doesNotMatch(renderer, /textLeft \+= 20;/);
});

check("the hit targets are sized from the same constants", () => {
  for (const marker of ["paper-position-overlay-label", "paper-protection-overlay-label"]) {
    const at = source.indexOf(marker);
    assert.ok(at > 0, `${marker} is missing`);
    const block = source.slice(at, at + 600);
    // A fixed Tailwind size here is the drift: it cannot follow the scale.
    assert.doesNotMatch(block, /w-\[164px\]/, `${marker} still hard-codes its width`);
    assert.doesNotMatch(block, /\bh-4\b/, `${marker} still hard-codes its height`);
    assert.match(block, /height: PAPER_LABEL_HEIGHT/, `${marker} must size from the constant`);
    assert.match(block, /width: paperLabelWidthPx\(/, `${marker} must use the shared width`);
  }
  assert.equal((source.match(/width: PAPER_LABEL_HANDLE_WIDTH/g) ?? []).length, 2, "SL and TP handles");
  assert.equal((source.match(/width: PAPER_LABEL_CLOSE_WIDTH/g) ?? []).length, 2, "both close cells");
  assert.equal((source.match(/paddingLeft: PAPER_LABEL_PAD_X/g) ?? []).length, 2, "both text bodies");
  assert.equal((source.match(/fontSize: PAPER_LABEL_FONT_PX/g) ?? []).length, 2, "both handle captions");
  assert.doesNotMatch(source, /<X className="h-2\.5 w-2\.5" \/>/, "the close glyph must scale too");
});

check("glyphs are never condensed to fit", () => {
  // THE BUG. fillText's maxWidth argument does not truncate, it SQUEEZES the
  // glyphs horizontally. "SELL 2 LIMIT - 21550.25 - working" is 33 characters,
  // about 317px at this size, against roughly 194px between the handles and the
  // close cell - a crush to 61% of natural width. The short SL and TP captions
  // fitted and rendered normally, so the body read as a different typeface.
  assert.match(renderer, /paperLabelFittedText\(/, "the body must be trimmed, not squeezed");
  assert.doesNotMatch(
    renderer,
    /fillText\(\s*renderedLabel,\s*textLeft,\s*y,\s*labelX/,
    "the maxWidth argument must not come back",
  );
  // The clip that bounds the text has to survive, or a label could still paint
  // over the close cell.
  assert.match(renderer, /context\.clip\(\);/);
});

check("the box grows to hold a working order", () => {
  const working = "SELL 2 LIMIT - 21550.25 - working";
  const wide = widthPx(working, 2, true);
  assert.ok(wide > MIN, "a long working order must widen its box");
  assert.ok(wide <= MAX, "and must still stop somewhere");
  // It must fit WHOLE. Capping below this trims the price off the one label
  // that most needs it, which is no better than the squeeze it replaced.
  const textSpace = wide - CLOSE - (PAD + 2 * HANDLE) - 8;
  assert.equal(fitted(working, textSpace), working,
    "a full working order must render without an ellipsis");
  // Short labels keep the tidy default rather than collapsing.
  assert.equal(widthPx("-2 - -$110.00", 2, true), MIN);
  assert.equal(widthPx("", 0, false), MIN);
  // Every character is paid for in the box, up to the cap.
  assert.ok(widthPx("x".repeat(40), 0, false) > widthPx("x".repeat(20), 0, false));
});

check("trimming keeps whole characters and marks the cut", () => {
  const text = "SELL 2 LIMIT - 21550.25 - working";
  assert.equal(fitted(text, 10_000), text, "text that fits is untouched");
  const short = fitted(text, 10 * CHAR);
  assert.ok(short.endsWith("…"), "a trimmed label says so");
  assert.ok(short.length <= 10, "and stays inside the space it was given");
  assert.equal(fitted(text, 0), "", "no room means no text, not a stray ellipsis");
});

check("canvas and hit target derive the same width", () => {
  // Both sides size from level.label - the one string React also holds - so the
  // twin reaches the identical number without measureText. Sizing the canvas
  // from renderedLabel instead would move the handles off what is painted.
  assert.match(renderer, /paperLabelWidthPx\(level\.label, handleCount, Boolean\(level\.showClose\)\)/);
  assert.equal(
    (source.match(/paperLabelWidthPx\(/g) ?? []).length, 4,
    "one definition, one canvas caller, two hit targets",
  );
  assert.equal(
    (source.match(/maxWidth: "calc\(100% - 8px\)"/g) ?? []).length, 2,
    "both twins must stop at the pane edge like the canvas does",
  );
});

check("both halves land on the same cell boundaries", () => {
  // Canvas walks left to right with textLeft; the HTML twin is a flex row.
  assert.equal(PAD + HANDLE + HANDLE, HANDLE + HANDLE + PAD, "text body starts in the same place");
  assert.ok(HANDLE * 2 + PAD < MIN - CLOSE, "handles and close cell must not overlap");
});

console.log(`\npaper order label geometry: ${passed}/${passed} checks passed`);
