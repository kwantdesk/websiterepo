import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The order labels are DOM, and they sit above the drawings.
 *
 * They used to be painted twice: a Lightweight Charts primitive drew the box,
 * the SL / TP dividers and the text onto the chart canvas, while an invisible
 * HTML twin was stacked on top to carry the click targets, because a canvas
 * cannot receive a pointer. Two renderers that had to stay pixel-identical, in
 * code thousands of lines apart.
 *
 * A canvas primitive also cannot paint above the drawing layer - drawings are
 * an SVG overlay stacked on the chart - so a trendline drawn across a stop
 * covered the label reporting it. On a live position that is the one label you
 * need to be able to read.
 *
 * So the twin became the renderer. One implementation, above the drawings. What
 * the canvas gave for free was a fresh position every frame; React commits
 * coordinate overlays on a 64ms transition, so the nodes are repositioned
 * imperatively on the same frame the drawing layer reprojects on.
 */

const source = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const drawLayer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const SCALE_TEXT = source.match(/const PAPER_LABEL_SCALE = ([\d.]+);/)?.[1];
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

check("every dimension scales together", () => {
  // The original was 8px type in a 164x16 box, unreadable against candles.
  // 2x fixed that and overshot - the labels crowded the candles they sit on -
  // so it settled at 1.5. What matters is that ONE number moves all of them:
  // the painted box and its hit targets are the same geometry, and a dimension
  // that stopped following the scale would put a handle off its divider.
  assert.equal(SCALE, 1.5);
  assert.deepEqual(
    { HEIGHT, FONT, PAD, HANDLE, CLOSE, MIN },
    { HEIGHT: 16 * SCALE, FONT: 8 * SCALE, PAD: 7 * SCALE, HANDLE: 20 * SCALE, CLOSE: 16 * SCALE, MIN: 164 * SCALE },
  );
  // Still meaningfully bigger than the original that could not be read.
  assert.ok(FONT > 8 && HEIGHT > 16);
});

check("nothing paints these on the canvas any more", () => {
  // Two renderers is the bug this replaced. If a primitive comes back, the
  // pixel-identical-geometry problem comes back with it - and so does the
  // z-order, because a canvas cannot beat the SVG drawing layer.
  assert.doesNotMatch(source, /class PaperPositionOverlayRenderer/);
  assert.doesNotMatch(source, /class PaperPositionOverlayPrimitive/);
  assert.doesNotMatch(source, /paperPositionOverlayPrimitiveRef/);
  // The trimming helper existed only to stop canvas fillText condensing
  // glyphs; CSS truncate does it now.
  assert.doesNotMatch(source, /paperLabelFittedText/);
  assert.match(source, /className="min-w-0 flex-1 truncate"/);
});

check("the labels sit above the drawing layer", () => {
  // THE POINT. A trendline drawn across a stop must not cover it.
  assert.match(drawLayer, /className="absolute inset-0 z-\[24\]"/, "drawings are the layer to beat");
  const containers = source.match(/className="pointer-events-none absolute left-0 z-\[31\]"/g) ?? [];
  assert.equal(containers.length, 2, "live levels and previews both sit above the drawings");
});

check("every level carries its own price line", () => {
  // The line used to be painted on the canvas while the box moved to DOM. Split
  // across two surfaces they would separate whenever the price scale moved, so
  // the line belongs to the same node as the box.
  const lines = source.match(/borderTopStyle: level\.kind === "entry" \? "solid" : "dashed"/g) ?? [];
  assert.equal(lines.length, 2, "live levels and previews both draw their line");
});

check("position is imperative, not left to React's transition", () => {
  // React commits coordinate overlays on a 64ms transition. Left to that, a
  // label would trail the candles by about four frames through a pan.
  assert.match(source, /const VIEWPORT_REACT_REFRESH_INTERVAL_MS = 64;/);
  assert.match(source, /const repositionPaperOverlays = useCallback\(/);
  assert.match(source, /const price = Number\(node\.dataset\.paperPrice\);/);
  assert.match(source, /node\.style\.top = `\$\{y\}px`;/);
  // Off-scale levels hide rather than pinning to an edge, which would read as a
  // stop sitting somewhere it is not.
  assert.match(source, /node\.style\.visibility = "hidden";/);
  // Same frame as the drawing layer, so drawings and labels agree.
  assert.match(source, /reprojectDrawingLayer\(\);\s*\n\s*repositionPaperOverlays\(\);/);
});

check("the previews the canvas used to own came across", () => {
  // The dragged protection and the armed "click to place" order existed ONLY on
  // the canvas. Removing it without these would have silently dropped both.
  assert.match(source, /const paperOverlayPreviewLevels = \[/);
  assert.match(source, /paperDraftOverlayLevel \? \[\{/);
  assert.match(source, /armedOrder && armedOrderPrice !== null \? \[\{/);
  assert.match(source, /click to place/);
  assert.match(source, /\{paperOverlayPreviewLevels\.map\(\(level\) => \(/);
});

check("the box still grows to hold a working order", () => {
  const working = "SELL 2 LIMIT - 21550.25 - working";
  const wide = widthPx(working, 2, true);
  assert.ok(wide > MIN, "a long working order must widen its box");
  assert.ok(wide <= MAX, "and must still stop somewhere");
  assert.equal(widthPx("-2 - -$110.00", 2, true), MIN, "short labels keep the tidy default");
  assert.equal(widthPx("", 0, false), MIN);
  assert.ok(widthPx("x".repeat(40), 0, false) > widthPx("x".repeat(20), 0, false));
});

check("the handles are still sized from the shared constants", () => {
  for (const marker of ["paper-position-overlay-label", "paper-protection-overlay-label"]) {
    const at = source.indexOf(marker);
    assert.ok(at > 0, `${marker} is missing`);
    const block = source.slice(at, at + 700);
    assert.doesNotMatch(block, /opacity-0/, `${marker} must be the visible renderer now`);
    assert.match(block, /height: PAPER_LABEL_HEIGHT/, `${marker} must size from the constant`);
    assert.match(block, /width: paperLabelWidthPx\(/, `${marker} must use the shared width`);
  }
  assert.equal((source.match(/width: PAPER_LABEL_HANDLE_WIDTH/g) ?? []).length, 2, "SL and TP handles");
  assert.equal((source.match(/width: PAPER_LABEL_CLOSE_WIDTH/g) ?? []).length, 2, "both close cells");
  // Two handles, the entry and protection shells, and the preview shell.
  assert.equal((source.match(/fontSize: PAPER_LABEL_FONT_PX/g) ?? []).length, 5, "every label shell sizes its type");
  assert.ok(HANDLE * 2 + PAD < MIN - CLOSE, "handles and close cell must not overlap");
});

check("open P&L still ticks after the move to DOM", () => {
  // THE REGRESSION. The canvas primitive held the live mark quote itself and
  // recomputed the figure on every frame it painted. React only has
  // position.markPrice, which is whatever it was at the last commit, so moving
  // the labels to the DOM without carrying the quote across froze the number.
  assert.match(source, /PAPER_MARK_QUOTE_EVENT/, "the quote subscription must exist");
  assert.match(source, /paperMarkQuoteRef\.current = detail;/, "the quote has to be kept");
  assert.match(source, /const refreshPaperLivePnl = useCallback\(/);
  // Written straight into the text node: a setState per tick is exactly what
  // the imperative overlay exists to avoid.
  assert.match(source, /node\.textContent = next;/);
  assert.doesNotMatch(source, /setPaperLivePnl/, "no render per tick");
  // The figure must be recomputed with the LIVE quote, not the stale mark.
  assert.match(source, /paperPositionLivePnl\(live\.position, quote\)/);
});

check("a resting order keeps its own label", () => {
  // A working order has no open P&L, because there is no position. Feeding one
  // in replaces "BUY 2 LIMIT - working" with a size and a running dollar figure
  // measured from the limit price, so an untouched order reads as an open
  // trade. This caught the canvas renderer once already.
  assert.match(source, /if \(level\.kind !== "entry" \|\| level\.resting\) return;/,
    "only an open position may have its text rewritten");
  assert.match(source, /if \(level\.kind !== "entry" \|\| level\.resting\) continue;/,
    "and only an open position enters the live map");
});

check("the figure refreshes on commits and pan frames too", () => {
  // A quote that stops arriving must not leave a number that is silently wrong
  // after the position changes underneath it.
  assert.match(source, /paperLivePositionsRef\.current = live;\s*\n\s*refreshPaperLivePnl\(\);/);
  assert.match(source, /repositionPaperOverlays\(\);\s*\n\s*refreshPaperLivePnl\(\);/);
});

console.log(`\npaper order label geometry: ${passed}/${passed} checks passed`);
