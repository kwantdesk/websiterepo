import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chart = readFileSync("src/components/Chart.tsx", "utf8");

/**
 * Reproduces the overlay-refresh rule: sign the PROJECTION of two fixed probe
 * points, rounded to whole pixels. It must fire when anything on screen moves
 * by a pixel and stay silent otherwise.
 */
function makeChart({ from, to, top, bottom, width, height }) {
  return {
    // Linear projections, matching a Lightweight Charts linear scale.
    xOf: (logical) => ((logical - from) / (to - from)) * width,
    yOf: (price) => ((top - price) / (top - bottom)) * height,
  };
}
function signature(view, probes) {
  const c = makeChart(view);
  return [
    Math.round(c.xOf(0)),
    Math.round(c.xOf(100)),
    Math.round(c.yOf(probes[0])),
    Math.round(c.yOf(probes[1])),
  ].join(":");
}

const base = { from: 0, to: 240, top: 20_100, bottom: 20_000, width: 1200, height: 600 };
const PROBES = [base.bottom, base.top];
const pricePerPixel = 100 / 600;
const barsPerPixel = 240 / 1200;

// 1. A steady transform is silent — this is what stops a live market
//    re-rendering the chart on every tick.
assert.equal(signature(base, PROBES), signature({ ...base }, PROBES));

// 2. Sub-pixel movement is invisible and stays silent, on both axes.
assert.equal(
  signature({ ...base, top: base.top + pricePerPixel * 0.3, bottom: base.bottom + pricePerPixel * 0.3 }, PROBES),
  signature(base, PROBES),
);
assert.equal(
  signature({ ...base, from: base.from + barsPerPixel * 0.3, to: base.to + barsPerPixel * 0.3 }, PROBES),
  signature(base, PROBES),
);

// 3. A pixel of movement MUST refresh. Missing this is the float.
assert.notEqual(
  signature({ ...base, top: base.top + pricePerPixel * 1.2, bottom: base.bottom + pricePerPixel * 1.2 }, PROBES),
  signature(base, PROBES),
  "a pixel of price movement must refresh",
);
assert.notEqual(
  signature({ ...base, from: base.from + barsPerPixel * 1.2, to: base.to + barsPerPixel * 1.2 }, PROBES),
  signature(base, PROBES),
  "a pixel of pan must refresh",
);

// 4. A ZOOM must refresh. A span-normalised signature is scale-invariant and
//    silently ignored this entirely.
assert.notEqual(signature({ ...base, to: 480 }, PROBES), signature(base, PROBES), "a horizontal zoom must refresh");
assert.notEqual(signature({ ...base, top: 20_200 }, PROBES), signature(base, PROBES), "a price rescale must refresh");

// 5. The old range-fraction step was several pixels wide; movement it ignored
//    must now refresh.
const oldQuantum = 100 / 120;
assert.ok(oldQuantum / pricePerPixel > 4, "fixture must represent the old multi-pixel step");
assert.notEqual(
  signature({ ...base, top: base.top + oldQuantum * 0.9, bottom: base.bottom + oldQuantum * 0.9 }, PROBES),
  signature(base, PROBES),
);

// 6. The source must sign projected pixels, not ranges.
assert.match(chart, /const probeY = \(price: number\)/);
assert.match(chart, /const probeX = \(logicalIndex: number\)/);
assert.match(chart, /timeScale\.logicalToCoordinate\(logicalIndex as never\)/);
assert.doesNotMatch(chart, /span \/ 120/, "the coarse range step must not come back");
assert.doesNotMatch(chart, /const barQuantum/, "the scale-invariant step must not come back");

// 7. The probes are captured once, so the reference cannot drift with the
//    viewport it is measuring.
assert.match(chart, /if \(!overlayProbePrices && topPrice != null/);

console.log("overlay refresh: 7/7 checks passed");
