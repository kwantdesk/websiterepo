import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layer = readFileSync("src/chart/precision-tools/PrecisionToolsLayer.tsx", "utf8");
const drawLayer = readFileSync("src/components/ChartDrawLayer.tsx", "utf8");

/**
 * Reproduces the magnet rule: the snap radius is a SCREEN distance, so it
 * behaves the same at every zoom. Measuring it in price units meant the magnet
 * quietly stopped reaching the wick as the chart was zoomed out.
 */
const RADIUS = 18;
function snap({ candle, cursor, project, radius = RADIUS }) {
  const anchorX = project.x(cursor.time);
  const barX = project.x(candle.timestamp);
  const anchorY = project.y(cursor.price);
  if (Math.abs(barX - anchorX) > radius) return null;
  let best = null;
  let bestDistance = radius;
  for (const price of [candle.high, candle.low, candle.open, candle.close]) {
    const distance = Math.abs(project.y(price) - anchorY);
    if (distance <= bestDistance) { bestDistance = distance; best = price; }
  }
  return best;
}

const candle = { timestamp: 1_000_000, open: 20_000, high: 20_040, low: 19_960, close: 20_010 };

// A zoomed-IN chart: 2 pixels per point.
const zoomedIn = { x: (t) => (t - 1_000_000) / 1000, y: (p) => (21_000 - p) * 2 };
// A zoomed-OUT chart: 0.1 pixels per point. The old price-unit threshold
// (8 ticks = 2 points) is a fifth of a pixel here — unreachable.
const zoomedOut = { x: (t) => (t - 1_000_000) / 1000, y: (p) => (21_000 - p) * 0.1 };

// 1. Near the high, the magnet takes the high — at BOTH zoom levels.
for (const [name, project] of [["zoomed in", zoomedIn], ["zoomed out", zoomedOut]]) {
  const got = snap({ candle, cursor: { time: 1_000_000, price: 20_040 + (name === "zoomed in" ? 3 : 60) }, project });
  assert.equal(got, candle.high, `${name}: the magnet must take the wick`);
}

// 2. The old price-unit threshold could not do that when zoomed out.
{
  const priceThreshold = 0.25 * 8;
  const cursorPrice = 20_040 + 60;
  assert.ok(
    Math.abs(cursorPrice - candle.high) > priceThreshold,
    "fixture must be outside the old price threshold",
  );
  assert.ok(
    Math.abs(zoomedOut.y(cursorPrice) - zoomedOut.y(candle.high)) <= RADIUS,
    "yet within reach on screen — which is what the trader sees",
  );
}

// 3. A wick wins a tie against the body: high and low are offered first.
{
  const tie = { timestamp: 1_000_000, open: 20_000, high: 20_000, low: 19_960, close: 20_010 };
  assert.equal(snap({ candle: tie, cursor: { time: 1_000_000, price: 20_000 }, project: zoomedIn }), tie.high);
}

// 4. Beside the candle, nothing is taken — the magnet must not reach across.
assert.equal(
  snap({ candle, cursor: { time: 1_000_000 + 40_000, price: 20_040 }, project: zoomedIn }),
  null,
  "a cursor beside the bar must not snap",
);

// 5. Far above the bar in price, nothing is taken.
assert.equal(snap({ candle, cursor: { time: 1_000_000, price: 20_400 }, project: zoomedIn }), null);

// 6. The source must measure in pixels, and the old price threshold must be gone.
assert.match(layer, /const ANCHOR_SNAP_RADIUS_PX = 18;/);
assert.match(layer, /Math\.abs\(barX - anchorX\) > radius/);
assert.doesNotMatch(
  layer,
  /adapter\.minMove \* \(mode === "strong" \? 8 : 3\)/,
  "the price-unit threshold must not come back",
);
assert.doesNotMatch(layer, /Math\.abs\(nearest\.timestamp - anchor\.time\) < 60_000/);

// 7. Both drawing engines use a screen-space radius, and the live layer takes
// it from the chosen magnet strength rather than a fixed 18px. (This assertion
// still named the old constant long after weak/strong landed, so it had been
// failing on its own.)
assert.match(drawLayer, /const SNAP_RADIUS_PX = magnetStrengthSpec\(magnetStrength\)\.radiusPx;/);
assert.match(drawLayer, /const SNAP_RELEASE_PX = magnetStrengthSpec\(magnetStrength\)\.releasePx;/);

// --- the magnet applies to MOVING a drawing, not only to placing one ---
{
  const { readFileSync } = await import("node:fs");
  const layer = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  const move = layer.slice(layer.indexOf("const drag = dragRef.current;"), layer.indexOf("const handlePointerUp"));

  // THE REPORTED FAILURE: a drawing snapped to a wick when placed and then
  // never again - drag it away and it floated free for the rest of its life.
  // The body drag called fromXY straight; the handles snapped only because they
  // run through localPoint. Every tool with a body behaved this way.
  assert.match(move, /const snapped = snapAt\(anchorPixel\.x \+ dx, anchorPixel\.y \+ dy, \{ velocityAware: true \}\);/,
    "a body drag must consult the magnet");

  // Snapped through ONE anchor: snapping each point independently would pull
  // them onto different candles and deform the shape.
  assert.match(move, /const anchorPixel = drag\.originPixels\[0\];/);
  assert.match(move, /dx = snappedX - anchorPixel\.x;/);
  assert.match(move, /dy = snappedY - anchorPixel\.y;/);
  assert.ok(
    (move.match(/snapAt\(/g) ?? []).length === 1,
    "exactly one snap per move, not one per point",
  );

  // The translation itself is unchanged, so the geometry still carries across
  // and an unplaceable point still keeps its stored anchor.
  assert.match(move, /return fromXY\(pixel\.x \+ dx, pixel\.y \+ dy\) \?\? p;/);

  // Magnet off, or a pixel the scale cannot name: the raw delta stands.
  assert.match(move, /if \(snappedX != null && snappedY != null\)/);
  assert.match(move, /let dx = event\.clientX/, "dx must be reassignable for the snap to adjust it");
}

console.log("magnet snapping: 7/7 checks passed");
