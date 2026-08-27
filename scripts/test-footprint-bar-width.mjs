import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A footprint bar is one slot wide, however quiet the minute before it was.
 *
 * The width used to be the distance to the nearest neighbouring bar, which is
 * the same thing only while bars are contiguous. Footprint bars are built from
 * the tape, so a minute nobody traded in produces no bar - and the bar after
 * the hole was then handed the width of the hole. The live bar is where a
 * trader sees it, because it is the one most likely to sit just after a quiet
 * minute, and it rendered several times wider than everything else at random.
 */

const source = readFileSync(new URL("../src/lib/footprintPrimitive.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the slot comes from the time scale, not from a neighbour", () => {
  assert.match(source, /const slotWidth = Number\(timeScale\.options\(\)\.barSpacing\);/);
  // The neighbour lookups ARE the bug. They must not come back.
  assert.doesNotMatch(source, /Math\.abs\(x - previousX\)/);
  assert.doesNotMatch(source, /Math\.abs\(nextX - x\)/);
  assert.doesNotMatch(source, /timeScale\.timeToCoordinate\(bars\[index - 1\]\.time\)/);
  assert.doesNotMatch(source, /timeScale\.timeToCoordinate\(bars\[index \+ 1\]\.time\)/);
});

check("a nonsense bar spacing falls back rather than collapsing the bar", () => {
  // barSpacing is a number from the charting library; if it ever arrives as 0
  // or NaN the bar must fall back to the configured ceiling, not to a
  // zero-width column that would draw nothing at all.
  assert.match(source, /Number\.isFinite\(slotWidth\) && slotWidth > 0 \? slotWidth : ceilingWidth/);
});

check("the configured maximum still caps it", () => {
  // Zoomed far out, a slot can be wider than the bar the trader asked for.
  // The ceiling is what keeps a footprint the width it was configured to be
  // rather than growing to fill the screen.
  assert.match(source, /const ceilingWidth = options\.barWidth\s*\n\s*\+ options\.candleSpacing/);
  assert.match(source, /const nearest = Math\.min\([\s\S]{0,160}?ceilingWidth,\s*\n\s*\);/);
  // And the floor below it is unchanged: a bar never disappears entirely.
  assert.match(source, /const availableSlotWidth = Math\.max\(8, nearest - options\.candleSpacing\);/);
  assert.match(source, /const barWidth = Math\.max\(\s*\n\s*8,/);
});

console.log(`\nfootprint bar width: ${passed}/${passed} checks passed`);
