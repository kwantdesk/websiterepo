import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { miniDomLayout } from "../src/lib/miniDomPrimitive.ts";

/**
 * The price scale is the chart's right edge — not the Mini DOM.
 *
 * The ladder used to push the time scale over by its own width so candles
 * stopped at its left side, which made the LADDER the boundary of the page.
 * It now sits inside the plot against the price scale and price runs on
 * underneath it.
 *
 * Its resize strip was also positioned from the CONTAINER's right edge while
 * the ladder's own left edge is measured from the PANE's — a difference of the
 * whole price-scale width. The strip therefore sat about sixty pixels away
 * from the edge it was meant to grab, which is why dragging it did nothing.
 */

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("nothing reserves time-scale space for the ladder any more", () => {
  // A reservation is what moved the edge. Restoring one that was already
  // applied is fine; applying a new one is the behaviour being removed.
  //
  // Scoped to the ladder's own effect on purpose: the NET-GAMMA lane keeps a
  // reservation of its own, and asserting across the whole file would either
  // fail on that or force it to be removed too.
  const miniDomEffect = chart.slice(
    chart.indexOf("The Mini DOM does NOT get its own page edge"),
    chart.indexOf("}, [chartReadyRevision, miniDomEnabled]);"),
  );
  assert.ok(miniDomEffect.length > 0, "the ladder's own edge effect must exist");
  assert.doesNotMatch(miniDomEffect, /barsToReserve/, "the bar reservation must be gone");
  assert.doesNotMatch(miniDomEffect, /Math\.max\(/, "nothing may push the time scale out for the ladder");
  // The restore path stays, so a chart that already had one gets it back.
  assert.match(miniDomEffect, /miniDomReservedRightOffsetRef\.current = null;/);
  // And the net-gamma lane is untouched — it still owns its own reservation.
  assert.match(chart, /netGammaReservedRightOffsetRef\.current, barsToReserve/);
});

check("right-docked studies run to the price scale again", () => {
  // While the ladder owned the edge, a volume profile had to stop at its left
  // side. With the edge given back there is nothing to dock against.
  assert.match(
    chart,
    /primitive\.setPaneInsets\(\{ left: toolbarPlotLeftInset, right: 0 \}\)/,
    "the pane must not be inset by the ladder's width",
  );
});

check("the grab strip sits on the ladder's actual edge", () => {
  // THE REPORTED FAILURE. Without the price-scale width in this offset the
  // strip is a scale's width away from the edge it is supposed to grab.
  const strip = chart.slice(
    chart.indexOf('aria-label="Drag to resize the Mini DOM"'),
    chart.indexOf('aria-label="Drag to resize the Mini DOM"') + 2200,
  );
  assert.match(
    strip,
    /right: `\$\{Math\.max\(0, nativePriceScaleWidth \+ miniDomReservedWidth - 5\)\}px`/,
    "the offset must include the price scale, which the container spans and the pane does not",
  );
  assert.match(strip, /cursor-ew-resize/);
});

check("dragging toward the scale shrinks it, and it clamps", () => {
  const strip = chart.slice(
    chart.indexOf('aria-label="Drag to resize the Mini DOM"'),
    chart.indexOf('aria-label="Drag to resize the Mini DOM"') + 2200,
  );
  // Dragging right raises clientX, so subtracting shrinks — the ladder grows
  // away from the scale and shrinks back toward it.
  assert.match(strip, /startWidth - \(moveEvent\.clientX - startX\)/);
  assert.match(strip, /clamp\(Math\.round\(startWidth - \(moveEvent\.clientX - startX\)\), 60, 420\)/,
    "it must clamp rather than collapse or run away");
  assert.match(strip, /updateIndicatorSettingRef\.current\?\.\(instanceId, "widthPx", next\)/,
    "the drag must write the study's own width setting so it persists");
});

check("the ladder still cannot run underneath the price scale", () => {
  // It is anchored to the PANE's right edge, which is the chart side of the
  // scale — that is what keeps it inside the plot now that nothing is
  // reserved for it.
  const wide = miniDomLayout({
    paneWidth: 800, widthPx: 4_000, rightGapPx: 2, showBids: true, showAsks: true,
  });
  assert.ok(wide.right <= 800, "its right edge stops at the pane");
  assert.ok(wide.left >= 0, "and it cannot start off the left of the pane");
});

check("its width is what the setting asks for, between the clamps", () => {
  const at = (widthPx) => miniDomLayout({
    paneWidth: 900, widthPx, rightGapPx: 2, showBids: true, showAsks: true,
  });
  assert.equal(at(95).right - at(95).left, 95, "the default width is honoured exactly");
  assert.equal(at(200).right - at(200).left, 200, "and a dragged-wider one");
  assert.equal(at(60).right - at(60).left, 60, "and the drag's minimum");
  // reservedWidth is what positions the grab strip, and it is the width PLUS
  // the gap the ladder leaves against the scale — i.e. the distance from the
  // pane's right edge to the ladder's left edge, which is exactly where the
  // strip has to sit.
  const layout = miniDomLayout({
    paneWidth: 900, widthPx: 140, rightGapPx: 2, showBids: true, showAsks: true,
  });
  assert.equal(layout.reservedWidth, 142, "width plus the gap");
  assert.equal(900 - layout.reservedWidth, layout.left, "which is the ladder's left edge measured from the pane");
});

console.log(`\nmini dom edge: ${passed}/${passed} checks passed`);
