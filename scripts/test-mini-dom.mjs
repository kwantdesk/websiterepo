import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_MINI_DOM_OPTIONS,
  aggregateMiniDomBook,
  miniDomBandStep,
  miniDomBarHeight,
  miniDomBarWidth,
  miniDomLayout,
} from "../src/lib/miniDomPrimitive.ts";
import { CHART_INDICATOR_BY_ID } from "../src/lib/chartIndicatorCatalog.ts";
import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";

/**
 * The Mini DOM is the liquidity map's resting-book rail drawn on the chart:
 * bid and ask size summed into price BANDS, one thick bar per band with its
 * contract count sitting on it.
 *
 * The failure this study already shipped with is the one worth guarding: a bar
 * per tick. A tick is a couple of pixels at normal zoom, so per-tick rows are
 * hairlines with no room for a number between them — the ladder renders, and
 * is useless. Banding is what makes the bars thick, so the band step and the
 * bar height floor are the load-bearing pieces here.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the study is registered and addable", () => {
  const definition = CHART_INDICATOR_BY_ID.get("mini-dom");
  assert.ok(definition, "mini-dom is not in the catalog");
  assert.equal(definition.name, "Mini DOM");
  assert.equal(definition.requiresOrderFlow, true, "it draws the book, so it needs order flow");
  const settings = defaultIndicatorSettings("mini-dom");
  for (const key of ["widthPx", "rightGapPx", "levelSpacingPx", "barOpacity", "fontSize"]) {
    assert.ok(settings[key] !== undefined, `${key} has no default`);
  }
  for (const key of ["showBids", "showAsks", "showSizes", "alignLeft"]) {
    assert.equal(typeof settings[key], "boolean", `${key} has no default`);
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

check("bars are thick enough to carry a number, not per-tick hairlines", () => {
  // A typical NQ view: 200 ticks (50 points) over an 800px pane. One bar per
  // tick would be 4px apart — the shipped bug. Banding must give bars that
  // clear the 8px floor with the counts readable.
  const span = 200;
  const height = 800;
  const step = miniDomBandStep(span, height, DEFAULT_MINI_DOM_OPTIONS.levelSpacingPx);
  assert.ok(step > 1, `a band covers ${step} ticks — that is a bar per tick again`);
  const spacing = height / (span / step);
  assert.ok(spacing >= 20, `levels are ${spacing.toFixed(1)}px apart, too tight for a number`);
  assert.ok(miniDomBarHeight(spacing) >= 8, "bars must clear the 8px floor");
});

check("bar height stays between the floor and the cap at any zoom", () => {
  for (const spacing of [0.5, 4, 12, 25, 200, 5000]) {
    const height = miniDomBarHeight(spacing);
    assert.ok(height >= 8, `spacing ${spacing} gave a ${height}px hairline`);
    assert.ok(height <= 16, `spacing ${spacing} gave a ${height}px block`);
  }
});

check("zooming right in still bands at one tick rather than a fraction", () => {
  // Fully zoomed in there is nothing left to merge; the step must bottom out
  // at a whole tick instead of going fractional and misplacing every band.
  const step = miniDomBandStep(10, 900, 25);
  assert.equal(step, 1);
  assert.ok(Number.isInteger(step));
});

check("resting size is summed into bands, keeping bid and ask apart", () => {
  const levels = [
    { side: "BID", price: 100.0, size: 5 },
    { side: "BID", price: 100.25, size: 7 },   // same band as 100.00
    { side: "ASK", price: 100.25, size: 3 },
    { side: "ASK", price: 102.0, size: 40 },
  ];
  const book = aggregateMiniDomBook(levels, 0.25, 4, 380, 420);
  const band = book.bands.get(400); // 100.00 / 0.25 = tick 400
  assert.equal(band.buy, 12, "both bids in the band must be summed");
  assert.equal(band.sell, 3, "the ask in that band stays on its own side");
  assert.equal(book.peak, 40, "the peak is the largest single band on screen");
});

check("only what is on screen is banded and scaled", () => {
  // A wall far off screen must not flatten every visible bar against it.
  const levels = [
    { side: "BID", price: 100.0, size: 10 },
    { side: "BID", price: 500.0, size: 90_000 },
  ];
  const book = aggregateMiniDomBook(levels, 0.25, 4, 380, 420);
  assert.equal(book.peak, 10, "the off-screen wall must not set the scale");
  assert.equal(book.bands.size, 1);
});

check("switching a rail off gives the other the whole ladder", () => {
  const both = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 2, showBids: true, showAsks: true });
  const one = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 2, showBids: true, showAsks: false });
  assert.equal(both.sideWidth, 95, "two rails split the width");
  assert.equal(one.sideWidth, 190, "one rail takes it all rather than leaving a hole");
  assert.equal(one.buyLeft, one.left, "the surviving rail starts at the ladder's edge");
});

check("the rails grow away from each other and never overlap", () => {
  const layout = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 2, showBids: true, showAsks: true });
  assert.equal(layout.sellRight, layout.buyLeft, "the rails meet without a gap or an overlap");
  // The ask bar ends at sellRight and grows left; the bid bar starts at
  // buyLeft and grows right. A full-size pair must not cross.
  const full = miniDomBarWidth(100, 100, layout.barExtent);
  assert.ok(layout.sellRight - full - 1 >= layout.sellLeft, "a full ask bar escaped its rail");
  assert.ok(layout.buyLeft + 1 + full <= layout.buyRight, "a full bid bar escaped its rail");
});

check("it sits where a right-docked volume profile sits", () => {
  // That profile anchors at rightEdge - 2, and rightEdge is the pane width
  // because its right inset is never set. Matching it puts the two on the
  // same line rather than a hair apart.
  assert.equal(DEFAULT_MINI_DOM_OPTIONS.rightGapPx, 2);
  const layout = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 2, showBids: true, showAsks: true });
  assert.equal(layout.right, 1198, "the ladder's right edge is the profile's dock");
});

check("the ladder never outgrows or escapes the pane", () => {
  for (const paneWidth of [140, 300, 900]) {
    const layout = miniDomLayout({ paneWidth, widthPx: 420, rightGapPx: 0, showBids: true, showAsks: true });
    assert.ok(layout.left >= 0, `ladder started at ${layout.left} on a ${paneWidth}px pane`);
    assert.ok(layout.right <= paneWidth, `ladder reached ${layout.right} on a ${paneWidth}px pane`);
  }
});

check("counts are dropped rather than overprinted on a narrow rail", () => {
  const wide = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 0, showBids: true, showAsks: true });
  const narrow = miniDomLayout({ paneWidth: 1200, widthPx: 70, rightGapPx: 0, showBids: true, showAsks: true });
  assert.equal(wide.sizesFit, true);
  assert.equal(narrow.sizesFit, false, "a 35px rail cannot hold a contract count");
});

check("a band bigger than the frame's peak is clamped, not drawn past its rail", () => {
  const layout = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 0, showBids: true, showAsks: true });
  assert.equal(miniDomBarWidth(1000, 26, layout.barExtent), layout.barExtent);
  assert.ok(miniDomBarWidth(1, 100_000, layout.barExtent) >= 1, "one lot must still be drawable");
});

check("an empty or impossible band draws nothing", () => {
  const layout = miniDomLayout({ paneWidth: 1200, widthPx: 190, rightGapPx: 0, showBids: true, showAsks: true });
  for (const [size, peak] of [[0, 26], [-5, 26], [10, 0], [Number.NaN, 26]]) {
    assert.equal(miniDomBarWidth(size, peak, layout.barExtent), 0, `size ${size} peak ${peak} must draw nothing`);
  }
  assert.equal(miniDomBarWidth(10, 26, 0), 0, "no track means no bar");
  assert.equal(aggregateMiniDomBook([{ side: "BID", price: 100, size: 5 }], 0, 4, 0, 1e9).peak, 0,
    "no tick size means no book");
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
