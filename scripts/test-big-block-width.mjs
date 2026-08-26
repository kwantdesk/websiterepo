import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartCandleBodyWidth } from "../src/lib/chartBarWidth.ts";

/**
 * A big block prints at the standard candle width straight away.
 *
 * `timeToCoordinate` answers with the MIDDLE of a bar. A block that starts and
 * ends on the same bar — which every one of them does the moment it prints —
 * therefore measured zero pixels across and was clamped to a 2px sliver, then
 * appeared to grow as the zone reached further bars. A block is supposed to
 * cover the bars it belongs to, so each end is widened by half a candle body.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const source = readFileSync(new URL("../src/lib/bigBlocksPrimitive.ts", import.meta.url), "utf8");

/** The primitive's own arithmetic, so the numbers below are the drawn ones. */
function drawnWidth(startX, endX, barSpacing) {
  const bodyWidth = chartCandleBodyWidth(barSpacing);
  const halfBody = bodyWidth / 2;
  const left = Math.min(startX, endX) - halfBody;
  const right = Math.max(startX, endX) + halfBody;
  return { width: Math.max(bodyWidth, right - left), left, right, bodyWidth };
}

check("a block on ONE bar is a full candle wide, not a sliver", () => {
  // THE REPORTED FAILURE: start and end resolve to the same pixel.
  for (const barSpacing of [6, 8, 12, 20, 40]) {
    const body = chartCandleBodyWidth(barSpacing);
    const drawn = drawnWidth(500, 500, barSpacing);
    assert.equal(drawn.width, body, `at barSpacing ${barSpacing} it must be one candle wide`);
    assert.ok(drawn.width > 2, "and never the old 2px clamp");
  }
});

check("it is centred on the bar it printed on", () => {
  const drawn = drawnWidth(500, 500, 12);
  assert.equal((drawn.left + drawn.right) / 2, 500, "the bar's centre stays the block's centre");
});

check("it matches what a candle on the same chart is drawn at", () => {
  // The whole point of "standard width" — a block and a candle agree.
  for (const barSpacing of [6, 10, 18, 30]) {
    assert.equal(drawnWidth(700, 700, barSpacing).width, chartCandleBodyWidth(barSpacing));
  }
});

check("a multi-bar block covers its first and last bars completely", () => {
  // Centre-to-centre left half a bar uncovered at each end.
  const barSpacing = 12;
  const body = chartCandleBodyWidth(barSpacing);
  const drawn = drawnWidth(400, 400 + barSpacing * 5, barSpacing);
  assert.equal(drawn.width, barSpacing * 5 + body, "the span plus one whole candle");
  assert.equal(drawn.left, 400 - body / 2, "starts at the left edge of the first bar");
  assert.equal(drawn.right, 400 + barSpacing * 5 + body / 2, "ends at the right edge of the last");
});

check("it does not care which way round the two times resolve", () => {
  assert.deepEqual(drawnWidth(600, 400, 12), drawnWidth(400, 600, 12));
});

check("zooming does not change how many bars it covers", () => {
  // Width is derived from the live barSpacing, so a one-bar block stays one
  // bar wide at every zoom rather than holding a fixed pixel size.
  const tight = drawnWidth(500, 500, 4);
  const wide = drawnWidth(500, 500, 40);
  assert.ok(wide.width > tight.width, "a zoomed-in chart draws a wider block");
  assert.equal(tight.width, chartCandleBodyWidth(4));
  assert.equal(wide.width, chartCandleBodyWidth(40));
});

check("the primitive really uses this, and the old clamp is gone", () => {
  assert.match(source, /const bodyWidth = chartCandleBodyWidth\(Number\(timeScale\.options\(\)\.barSpacing\)\)/);
  assert.match(source, /const left = Math\.min\(rawStartX, rawEndX\) - halfBody;/);
  assert.match(source, /const right = Math\.max\(rawStartX, rawEndX\) \+ halfBody;/);
  assert.match(source, /const width = Math\.max\(bodyWidth, right - left\);/);
  assert.doesNotMatch(source, /Math\.max\(2, right - left\)/, "the 2px sliver clamp must be gone");
});

console.log(`\nbig block width: ${passed}/${passed} checks passed`);
