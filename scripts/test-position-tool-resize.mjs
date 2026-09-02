import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  medianBarStep,
  positionToolScreenGeometry,
  timeAtPixelPastLastBar,
} from "../src/lib/chartDrawGeometry.ts";

/**
 * The long/short position calculator must resize by its corners.
 *
 * Measured in the live layer: dragging a LEFT corner worked, dragging either
 * RIGHT corner did nothing at all. The corner drag asked the chart for a
 * {time, price} pair and gave up when that came back null - and it is null for
 * every pixel the time scale cannot name, which is the whole blank area to the
 * right of the last bar. A position tool is placed with its right edge twelve
 * bars past the entry, so both right-hand corners sit in exactly that dead
 * zone. The price was discarded along with the time, so those corners could
 * not even be moved up or down.
 *
 * Two things fix it, and both are pinned here: the axes resolve separately, so
 * a knowable price still moves the stop or target; and past the last bar the
 * time is counted in BARS, which is the only measure that works on a volume,
 * range or tick chart.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** A regular one-minute chart: bar 0 at t=0, 10px apart. */
const regular = {
  lastTime: 600, lastX: 500,
  previousTime: 540, previousX: 490,
  recentTimes: Array.from({ length: 12 }, (_, i) => 60 * (i + 1)),
};

check("a pixel past the last bar resolves to a time", () => {
  // THE REPORTED FAILURE: this used to be null, so the drag did nothing.
  // Five bar widths right of the last bar is five bars later in time.
  const time = timeAtPixelPastLastBar({ ...regular, localX: 550 });
  assert.equal(time, 600 + 5 * 60, `expected five bars past the edge, got ${time}`);
});

check("it is linear in both directions from the last bar", () => {
  assert.equal(timeAtPixelPastLastBar({ ...regular, localX: 500 }), 600, "the last bar itself");
  assert.equal(timeAtPixelPastLastBar({ ...regular, localX: 510 }), 660, "one bar right");
  assert.equal(timeAtPixelPastLastBar({ ...regular, localX: 490 }), 540, "one bar left");
  // Half a bar width is half a bar of time — resizing is not quantised.
  assert.equal(timeAtPixelPastLastBar({ ...regular, localX: 505 }), 630);
});

check("a maintenance break does not stretch every extrapolated bar", () => {
  // THE REASON IT IS A MEDIAN. One overnight gap among ordinary one-minute
  // bars would drag a mean far above the real bar spacing, so every dragged
  // corner would jump hours instead of minutes.
  const withBreak = [0, 60, 120, 180, 240, 300, 300 + 57_600, 300 + 57_660, 300 + 57_720];
  assert.equal(medianBarStep(withBreak), 60, "the typical bar is still a minute");
  const mean = (withBreak[withBreak.length - 1] - withBreak[0]) / (withBreak.length - 1);
  assert.ok(mean > 60 * 50, "a mean really would be wildly wrong here");
});

check("irregular volume-chart bars still extrapolate", () => {
  // Volume, range and tick bars close on traded size, not a clock, so they
  // carry irregular times and there is no fixed interval to extrapolate with.
  // Counting in bars is what makes this work at all.
  const irregular = [0, 37, 61, 118, 140, 205, 233, 291];
  const step = medianBarStep(irregular);
  assert.ok(step > 0 && step < 60, `a sensible typical gap, got ${step}`);
  const time = timeAtPixelPastLastBar({
    localX: 530, lastTime: 291, lastX: 500, previousTime: 233, previousX: 490, recentTimes: irregular,
  });
  assert.equal(time, 291 + 3 * step, "three bar widths past the edge is three bars of time");
});

check("degenerate geometry returns nothing rather than a wrong answer", () => {
  // Zero-width bars, a single bar, and non-finite input must not produce a
  // fabricated time that would fling a drawing across the chart.
  assert.equal(timeAtPixelPastLastBar({ ...regular, previousX: 500, localX: 550 }), null, "no bar width");
  assert.equal(timeAtPixelPastLastBar({ ...regular, localX: Number.NaN }), null);
  assert.equal(timeAtPixelPastLastBar({ ...regular, lastX: Number.POSITIVE_INFINITY, localX: 550 }), null);
  assert.equal(medianBarStep([]), null);
  assert.equal(medianBarStep([100]), null);
  // Times that never advance give no spacing to count with.
  assert.equal(
    timeAtPixelPastLastBar({ localX: 550, lastTime: 600, lastX: 500, previousTime: 600, previousX: 490, recentTimes: [600, 600, 600] }),
    null,
  );
});

check("the corner drag resolves the two axes separately", () => {
  // The behavioural half of the fix. If the pair is ever resolved as one unit
  // again, an unknowable time silently takes the price down with it and the
  // right-hand corners go dead exactly as before.
  const source = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  const drag = source.slice(
    source.indexOf("const beginPositionCornerDrag"),
    source.indexOf("const beginDrag ="),
  );
  assert.ok(drag.length > 0, "the corner drag handler must exist");
  assert.match(drag, /const price = priceAtY\(localY\);/);
  assert.match(drag, /const time = timeAtX\(localX\);/);
  assert.match(drag, /if \(price == null && time == null\) return;/,
    "it may only bail when NEITHER axis resolved");
  assert.doesNotMatch(drag, /rawPoint\(/, "the all-or-nothing pair is what broke it");
  // Each axis is applied only when it resolved.
  assert.match(drag, /if \(price != null\) \{/);
  assert.match(drag, /if \(time != null\) \{/);
});

check("the box can still never be turned inside out", () => {
  const source = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  const drag = source.slice(
    source.indexOf("const beginPositionCornerDrag"),
    source.indexOf("const beginDrag ="),
  );
  assert.match(drag, /Math\.min\(time, next\[1\]\.time - 1\)/, "the left edge stays left of the right");
  assert.match(drag, /Math\.max\(time, next\[0\]\.time \+ 1\)/, "the right edge stays right of the left");
});

check("all four handles remain welded to the painted box at narrow widths", () => {
  // This is the reported drift. The old body widened this 12px projection to
  // 40px while the handles remained at x=112, leaving them floating inside.
  const geometry = positionToolScreenGeometry([
    { x: 100, y: 80 },
    { x: 112, y: 120 },
    { x: 112, y: 40 },
  ]);
  assert.ok(geometry);
  assert.equal(geometry.width, 12, "screen geometry must not invent a second width");
  assert.deepEqual(geometry.corners.map(({ x, y }) => [x, y]), [
    [100, 120], [112, 120], [100, 40], [112, 40],
  ]);
});

check("the renderer and the handles consume the same position geometry", () => {
  const source = readFileSync(new URL("../src/components/ChartDrawLayer.tsx", import.meta.url), "utf8");
  const render = source.slice(source.indexOf("const renderDrawing"), source.indexOf("const previewDrawing"));
  assert.match(render, /const positionGeometry = isPositionTool \? positionToolScreenGeometry\(coords\) : null;/);
  assert.match(render, /left: xL, right: xR, stopY, targetY.*positionGeometry/);
  assert.match(render, /const positionCorners = positionGeometry\?\.corners \?\? null;/);
  assert.doesNotMatch(render, /Math\.max\(xL \+ 40/,
    "a visual width clamp would detach the handles again");
});

console.log(`\nposition tool resize: ${passed}/${passed} checks passed`);
