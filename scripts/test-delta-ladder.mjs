import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_DELTA_LADDER_OPTIONS,
  aggregateDeltaLadder,
  deltaLadderLayout,
} from "../src/lib/deltaLadderPrimitive.ts";
import { ladderBandStep, ladderBarHeight, ladderBarWidth } from "../src/lib/priceLadderGeometry.ts";
import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";

/**
 * The Delta Bar docked to a side stops being a per-BAR histogram and becomes a
 * per-PRICE one: a spine down the chosen edge with a spike at every level that
 * traded, reaching toward the candles.
 *
 * The failures worth catching are the ones that look like a rendering glitch
 * rather than a wrong answer — spikes leaving the spine in two directions so
 * lengths cannot be compared, a ladder that only covers part of the pane, a
 * side ladder that also claims a lower pane, and buying and selling scaled
 * separately so a small sell draws like a big one.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the lower pane stays the default", () => {
  // Every chart that already has a Delta Bar must keep the histogram it has;
  // the ladder is something you opt into.
  const settings = defaultIndicatorSettings("delta-bar");
  assert.equal(settings.displayMode, "pane");
  for (const key of ["ladderWidthPx", "ladderEdgeGapPx", "ladderLevelSpacingPx", "ladderOpacity", "ladderFontSize"]) {
    assert.ok(settings[key] !== undefined, `${key} has no default`);
  }
  assert.equal(typeof settings.showLadderValues, "boolean");
});

check("every spike leaves the spine toward the candles", () => {
  // Docked right the chart is to the LEFT of the spine, docked left it is to
  // the right. Spikes growing the wrong way would point off the pane edge.
  const right = deltaLadderLayout({ paneWidth: 1200, widthPx: 150, edgeGapPx: 2, side: "right" });
  assert.equal(right.direction, -1, "a right-docked ladder must grow left");
  assert.ok(right.farX < right.spineX);

  const left = deltaLadderLayout({ paneWidth: 1200, widthPx: 150, edgeGapPx: 2, side: "left" });
  assert.equal(left.direction, 1, "a left-docked ladder must grow right");
  assert.ok(left.farX > left.spineX);
});

check("the spine sits on the edge it is docked to", () => {
  const right = deltaLadderLayout({ paneWidth: 1200, widthPx: 150, edgeGapPx: 2, side: "right" });
  assert.equal(right.spineX, 1198);
  const left = deltaLadderLayout({ paneWidth: 1200, widthPx: 150, edgeGapPx: 2, side: "left" });
  assert.equal(left.spineX, 2);
});

check("a full-length spike stays inside the pane on either side", () => {
  for (const side of ["right", "left"]) {
    for (const paneWidth of [200, 600, 1400]) {
      const layout = deltaLadderLayout({ paneWidth, widthPx: 900, edgeGapPx: 4, side });
      assert.ok(layout.farX >= 0, `${side} on ${paneWidth}px reached ${layout.farX}`);
      assert.ok(layout.farX <= paneWidth, `${side} on ${paneWidth}px reached ${layout.farX}`);
      assert.ok(layout.spineX >= 0 && layout.spineX <= paneWidth, "the spine left the pane");
    }
  }
});

check("delta is summed per price band and scaled on the largest, either way", () => {
  const levels = [
    { price: 100.0, delta: 5 },
    { price: 100.25, delta: 7 },    // same band as 100.00
    { price: 101.0, delta: -40 },
  ];
  const profile = aggregateDeltaLadder(levels, 0.25, 4, 380, 420);
  assert.equal(profile.bands.get(400), 12, "both prints in the band must be summed");
  // Scaled on the ABSOLUTE peak: a big sell has to draw as long as a big buy,
  // with the side carried by colour alone.
  assert.equal(profile.peak, 40, "selling must set the scale when it is largest");
});

check("buying and selling cancel inside a band rather than both drawing", () => {
  const profile = aggregateDeltaLadder(
    [{ price: 100, delta: 60 }, { price: 100.25, delta: -50 }], 0.25, 4, 380, 420,
  );
  assert.equal(profile.bands.get(400), 10, "a band carries its NET delta");
});

check("only what is on screen is banded", () => {
  // A huge print at a level long since scrolled past must not flatten every
  // spike the trader is actually looking at.
  const profile = aggregateDeltaLadder(
    [{ price: 100, delta: 10 }, { price: 500, delta: 90_000 }], 0.25, 4, 380, 420,
  );
  assert.equal(profile.peak, 10, "the off-screen print must not set the scale");
  assert.equal(profile.bands.size, 1);
});

check("a flat band draws nothing", () => {
  const profile = aggregateDeltaLadder(
    [{ price: 100, delta: 20 }, { price: 100, delta: -20 }, { price: 100.5, delta: Number.NaN }],
    0.25, 4, 380, 420,
  );
  assert.equal(profile.peak, 0, "perfectly balanced trade is not a spike");
  assert.equal(ladderBarWidth(0, 40, 100), 0);
  assert.equal(aggregateDeltaLadder([{ price: 100, delta: 5 }], 0, 4, 0, 1e9).peak, 0,
    "no tick size means no ladder");
});

check("it covers the pane top to bottom with readable spikes", () => {
  // 200 ticks over an 800px pane: bands must span the whole height and still
  // be thick enough to carry a number.
  const span = 200;
  const height = 800;
  const step = ladderBandStep(span, height, DEFAULT_DELTA_LADDER_OPTIONS.levelSpacingPx);
  assert.ok(step > 1, `a band covers ${step} ticks — that is a spike per tick`);
  const levels = Math.floor(span / step);
  assert.ok(levels >= 24, `only ${levels} bands over the pane, too sparse to read as a ladder`);
  assert.ok(ladderBarHeight(height / levels) >= 8, "spikes must clear the 8px floor");
});

check("a side ladder does not also claim a lower pane", () => {
  // It would draw the same study twice and steal chart height for a pane the
  // trader deliberately moved out of.
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /instance\.indicatorId === "delta-bar" && deltaLadderSide\) return \[\]/,
    "the pane path must bail while the study is docked to a side");
  assert.match(chart, /footprintDataConsumer = [\s\S]{0,160}deltaLadderSide \? deltaBarIndicator/,
    "the ladder needs the executed price levels the footprint is built from");
});

console.log(`\ndelta ladder: ${passed}/${passed} checks passed`);
