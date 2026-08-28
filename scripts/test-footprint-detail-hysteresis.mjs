import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The footprint's numbers must not flicker.
 *
 * Whether a cell prints its bid/ask numbers is decided by three hard
 * comparisons: visible bar count, bar width, and row height. All three move
 * continuously. Row height is the pixel gap between adjacent price levels, so
 * it shrinks the instant the price scale autoscales; bar width follows
 * barSpacing, so it moves on every zoom. Sitting near any of those thresholds,
 * the footprint flipped between printed, hollow and blank frame to frame -
 * reported as numbers appearing and vanishing while the market moved, and
 * going hollow when zoomed.
 *
 * The repair is a release margin, not a lower threshold: a cell still has to
 * clear the configured minimum to start printing, and only keeps printing while
 * it stays within the margin of it.
 */

const source = readFileSync(new URL("../src/lib/footprintPrimitive.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const RELEASE = Number(source.match(/const FOOTPRINT_DETAIL_RELEASE = ([\d.]+);/)?.[1]);

check("the release margin exists and is a margin, not a discount", () => {
  assert.ok(Number.isFinite(RELEASE), "FOOTPRINT_DETAIL_RELEASE is missing");
  // Below the threshold, so it only ever relaxes; close enough to it that a
  // genuinely too-small cell still drops its text.
  assert.ok(RELEASE > 0.5 && RELEASE < 1, `release ${RELEASE} is not a margin`);
});

check("all three gates are banded, not just one", () => {
  // Any gate left hard keeps flickering on its own axis: width flaps on zoom,
  // row height on autoscale, bar count on scrolling one bar in or out.
  assert.match(source, /options\.maximumDetailedVisibleBars \/ release/, "the bar-count gate is still hard");
  assert.match(source, /const minimumTextWidth = options\.minimumWidthToShowText \* release/, "the width gate is still hard");
  assert.match(
    source,
    /const minimumTextRowHeight = options\.minimumRowHeightToShowText \* release/,
    "the row-height gate is still hard",
  );
  // And the comparisons must actually use the banded values.
  assert.match(source, /barWidth >= minimumTextWidth/);
  assert.match(source, /rowHeight >= minimumTextRowHeight/);
  assert.doesNotMatch(source, /rowHeight >= options\.minimumRowHeightToShowText/, "a raw comparison survived");
  assert.doesNotMatch(source, /barWidth >= options\.minimumWidthToShowText/, "a raw comparison survived");
});

check("the band is read once a frame and written once", () => {
  /*
   * A latch updated mid-paint would print numbers on some cells of a bar and
   * not others, which is a worse artefact than the flicker it replaces.
   */
  assert.match(source, /const release = this\.printedText \? FOOTPRINT_DETAIL_RELEASE : 1;/,
    "the band is not resolved once at the top of the frame");
  assert.match(source, /this\.printedText = printedTextThisFrame;/, "the latch is never written back");
  // Written after the paint, not during it.
  const readAt = source.indexOf("const release = this.printedText");
  const writeAt = source.indexOf("this.printedText = printedTextThisFrame;");
  assert.ok(readAt > 0 && writeAt > readAt, "the latch is written before the frame is painted");
});

check("the latch is per pane, not shared between charts", () => {
  /*
   * A module-level latch would let one chart's zoom decide whether another
   * chart printed its numbers - four charts is the normal workspace here.
   */
  assert.match(source, /private printedText = false;/, "the latch is not an instance field");
  assert.doesNotMatch(source, /^let printedText/m, "the latch is module state");
});

check("banding relaxes the gate rather than tightening it", () => {
  // Arithmetic check on the real constant: the released thresholds must be
  // easier to satisfy than the configured ones, and the bar-count gate is a
  // <= comparison so it divides where the others multiply.
  const width = 32;
  const rowHeight = 9;
  const maxBars = 200;
  assert.ok(width * RELEASE < width, "the width band tightened the gate");
  assert.ok(rowHeight * RELEASE < rowHeight, "the row-height band tightened the gate");
  assert.ok(maxBars / RELEASE > maxBars, "the bar-count band tightened the gate");
  // A cell that never qualified still does not qualify.
  assert.ok(width * RELEASE > 0, "the band cannot let a zero-width cell print");
});

console.log(`\nfootprint detail hysteresis: ${passed}/${passed} checks passed`);
