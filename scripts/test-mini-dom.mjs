import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_MINI_DOM_OPTIONS,
  miniDomBarWidth,
  miniDomLayout,
} from "../src/lib/miniDomPrimitive.ts";
import { CHART_INDICATOR_BY_ID } from "../src/lib/chartIndicatorCatalog.ts";
import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";

/**
 * The Mini DOM is a ladder pinned against the price scale: every bar shares
 * its right edge and grows left, and every row sits centred on its own price.
 *
 * The failures worth catching are geometric and silent — a bar running under
 * the size column so the number cannot be read, a ladder wider than the pane
 * it sits in, or a level arriving larger than the frame was scaled from and
 * drawing past the end of its own track.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the study is registered and addable", () => {
  const definition = CHART_INDICATOR_BY_ID.get("mini-dom");
  assert.ok(definition, "mini-dom is not in the catalog");
  assert.equal(definition.name, "Mini DOM");
  assert.equal(definition.requiresOrderFlow, true, "it draws the book, so it needs order flow");
  const settings = defaultIndicatorSettings("mini-dom");
  for (const key of ["widthPx", "rightGapPx", "depth", "opacity", "fontSize"]) {
    assert.ok(settings[key] !== undefined, `${key} has no default`);
  }
});

check("the library offers it rather than showing it as Pending", () => {
  // Being built is not enough. The library marks a study live only when it is
  // in BOTH gating sets, and they live in different files — CVD Divergence
  // shipped fully working and unaddable for exactly this reason.
  const inSet = (source, setName) => {
    const open = source.indexOf(`${setName} = new Set([`);
    if (open < 0) return false;
    const close = source.indexOf("]);", open);
    return close > open && source.slice(open, close).includes('"mini-dom"');
  };
  const config = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  assert.ok(inSet(config, "LIVE_CHART_INDICATOR_IDS"), "missing from LIVE_CHART_INDICATOR_IDS");
  assert.ok(inSet(control, "RENDERED_CHART_INDICATOR_IDS"), "missing from RENDERED_CHART_INDICATOR_IDS");
});

check("it sits where a right-docked volume profile sits", () => {
  // That profile anchors at rightEdge - 2, and rightEdge is the pane width
  // because its right inset is never set. Matching it puts the two on the
  // same line rather than a hair apart.
  assert.equal(DEFAULT_MINI_DOM_OPTIONS.rightGapPx, 2);
  const paneWidth = 1200;
  const dockedProfileAnchor = paneWidth - 2;
  const layout = miniDomLayout({ paneWidth, widthPx: 190, rightGapPx: DEFAULT_MINI_DOM_OPTIONS.rightGapPx });
  assert.equal(layout.right, dockedProfileAnchor, "the ladder's right edge is the profile's dock");
  assert.equal(layout.barRight, layout.right, "bars start at that edge and grow left");
});

check("the ladder cannot run under the price scale", () => {
  // The scale is its own canvas, so the pane width is the boundary: even asked
  // for more width than the pane has, the ladder narrows instead of spilling.
  const layout = miniDomLayout({ paneWidth: 300, widthPx: 420, rightGapPx: 0 });
  assert.ok(layout.right <= 300, `right edge ${layout.right} escaped a 300px pane`);
});

check("a larger gap moves the whole ladder in", () => {
  const layout = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 20 });
  assert.equal(layout.right, 1180);
  assert.equal(layout.left, 990);
});

check("no bar ever runs under the size column", () => {
  const layout = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 0 });
  for (const size of [1, 7, 26, 99, 1e6]) {
    const width = miniDomBarWidth(size, 26, layout.barExtent);
    const leftEnd = layout.barRight - width;
    assert.ok(
      leftEnd >= layout.numberX,
      `a size of ${size} reached ${leftEnd.toFixed(1)}, past the numbers at ${layout.numberX.toFixed(1)}`,
    );
  }
});

check("a level bigger than the frame's peak is clamped, not drawn past the track", () => {
  // A late book update can carry a level larger than the peak the frame was
  // scaled from; without the clamp it would draw off the end.
  const layout = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 0 });
  assert.equal(miniDomBarWidth(1000, 26, layout.barExtent), layout.barExtent);
});

check("an empty or impossible level draws nothing", () => {
  const layout = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 0 });
  for (const [size, peak] of [[0, 26], [-5, 26], [10, 0], [Number.NaN, 26]]) {
    assert.equal(miniDomBarWidth(size, peak, layout.barExtent), 0, `size ${size} peak ${peak} must draw nothing`);
  }
  assert.equal(miniDomBarWidth(10, 26, 0), 0, "no track means no bar");
});

check("a real level always gets a visible bar", () => {
  const layout = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 0 });
  assert.ok(miniDomBarWidth(1, 100_000, layout.barExtent) >= 1, "one lot must still be drawable");
});

check("the ladder never outgrows the pane", () => {
  for (const paneWidth of [140, 300, 900]) {
    const layout = miniDomLayout({ paneWidth, widthPx: 420, rightGapPx: 0 });
    assert.ok(layout.left >= 0, `ladder started at ${layout.left} on a ${paneWidth}px pane`);
    assert.ok(layout.width <= paneWidth, `ladder was ${layout.width} wide on a ${paneWidth}px pane`);
  }
});

check("it reuses the shared book stream rather than opening another", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /subscribeRithmicLiquidity\(\{[\s\S]{0,400}onSnapshot: \(snapshot\) => \{[\s\S]{0,200}MiniDomLevel/,
    "the ladder must read the same feed the DOM panel and liquidity studies use");
  assert.match(chart, /setOptions\(miniDomOptions\)/,
    "a settings change must restyle rather than blank the ladder until the next frame");
  assert.doesNotMatch(chart, /setBook\(\[\], priceFormat\.minMove, miniDomOptions\)/,
    "carrying options on an empty book would blank the ladder until the next frame");
});

console.log(`\nmini dom: ${passed}/${passed} checks passed`);
