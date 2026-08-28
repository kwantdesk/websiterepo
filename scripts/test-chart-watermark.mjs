import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  chartWatermarkSize,
  CHART_WATERMARK_ASPECT,
  CHART_WATERMARK_SRC,
  CHART_WATERMARK_OPACITY,
  LIQUIDITY_MAP_WATERMARK_SCALE,
} from "../src/lib/chartWatermark.ts";

/**
 * The KwantDesk mark, top centre of every chart and of the liquidity map.
 *
 * It scales with the pane rather than sitting at a fixed size: a full-screen
 * chart should wear it at a readable size, and one pane of a six-pane workspace
 * should not be dominated by it.
 *
 * The sizing is imported rather than scraped out of the component, which is how
 * this test used to read it. That broke the moment the function moved into a
 * shared module - the behaviour was identical and the test failed anyway. What
 * follows exercises the real function, so it survives the code moving and still
 * fails if the behaviour changes.
 */

const asset = fileURLToPath(new URL("../public/brand/kwantdesk-wordmark-white.png", import.meta.url));
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const chart = read("../src/components/Chart.tsx");
const liqMap = read("../src/components/liquidity-map/LiquidityMapWorkspace.tsx");
const shared = read("../src/lib/chartWatermark.ts");
const renderer = read("../public/heatmap-app/src/renderer.js");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const size = chartWatermarkSize;
const MAX_WIDTH = Math.max(...[2560, 3840, 5120].map((w) => chartWatermarkSize(w, 1400).width));

check("the asset exists, is a PNG, and is the white wordmark", () => {
  const stat = statSync(asset);
  assert.ok(stat.size > 1_000, "the mark is suspiciously small");
  const head = readFileSync(asset).subarray(0, 8);
  // PNG magic. The owner asked for a PNG specifically.
  assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "not a PNG");
  assert.equal(CHART_WATERMARK_SRC, "/brand/kwantdesk-wordmark-white.png");
});

check("the declared aspect matches the file", () => {
  // A wrong ratio here stretches the wordmark, which is worse than not showing
  // it at all. 1911x305 is the source wordmark's own pixel size.
  const png = readFileSync(asset);
  assert.equal(png.readUInt32BE(16), 1911);
  assert.equal(png.readUInt32BE(20), 305);
  assert.ok(
    Math.abs(CHART_WATERMARK_ASPECT - 1911 / 305) < 0.001,
    "declared aspect does not match the file",
  );
});

check("it grows with the chart and stops growing", () => {
  const full = size(2560, 1300);
  const single = size(1600, 900);
  const quarter = size(760, 420);
  assert.ok(full && single && quarter);
  assert.ok(single.width > quarter.width, "a bigger chart wears a bigger mark");
  assert.ok(full.width >= single.width, "and bigger again");
  assert.equal(full.width, MAX_WIDTH, "but it stops, so a wall display is not branded end to end");
  // Mid-range panes track the pane rather than snapping between two sizes.
  for (const [w, h] of [[900, 600], [1200, 800], [1600, 900]]) {
    const box = size(w, h);
    assert.ok(box.width / w > 0.12 && box.width / w < 0.16, `${w}x${h} drifted off the fraction`);
  }
});

check("a short pane does not get a tall mark", () => {
  // A strip above a footprint pane is wide but only a couple of candles tall.
  // Width alone would put a mark on it as tall as the data.
  const strip = size(900, 120);
  assert.ok(strip, "a strip still gets a mark");
  assert.ok(strip.height <= 120 * 0.08 + 1, "height is capped by the pane, not just the width");
  assert.ok(size(900, 900).height > strip.height, "the same width on a taller pane gets more of it");
});

check("panes too small to carry it show nothing", () => {
  // A smudge is worse than an absence.
  assert.equal(size(110, 300), null, "a sliver shows no mark");
  assert.equal(size(0, 0), null);
  assert.equal(size(-10, 500), null);
  assert.equal(size(500, 0), null);
});

check("the aspect ratio is never distorted", () => {
  for (const [w, h] of [[2560, 1300], [1600, 900], [900, 120], [520, 300], [300, 200]]) {
    const box = size(w, h);
    if (!box) continue;
    // Rounding to whole pixels is the only permitted deviation.
    assert.ok(
      Math.abs(box.width / box.height - CHART_WATERMARK_ASPECT) < 0.35,
      `${w}x${h} rendered ${box.width}x${box.height}, ratio ${(box.width / box.height).toFixed(2)}`,
    );
  }
});

check("both surfaces read the mark from the shared module", () => {
  /*
   * The chart and the liquidity map must not carry two sets of constants that
   * are meant to agree. They would drift the first time one was tuned, and the
   * two surfaces sit side by side in the same workspace where a difference is
   * immediately visible.
   */
  for (const [name, source] of [["Chart", chart], ["LiquidityMapWorkspace", liqMap]]) {
    assert.match(source, /from "@\/lib\/chartWatermark"/, `${name} does not use the shared mark`);
    assert.match(source, /src=\{CHART_WATERMARK_SRC\}/, `${name} hardcodes the asset path`);
    assert.doesNotMatch(source, /const CHART_WATERMARK_ASPECT =/, `${name} re-declares the aspect`);
  }
  assert.ok(CHART_WATERMARK_OPACITY > 0.2 && CHART_WATERMARK_OPACITY < 0.8, "readable, not a stain");
  assert.match(shared, /export function chartWatermarkSize/);
});

check("it sits under every reading on both surfaces", () => {
  // Above the canvas so it is visible at all, but beneath drawings (z-24) and
  // the order labels (z-31): a watermark must never be something a trader has
  // to look past. On the liquidity map it is likewise under the loader (z-10).
  for (const [name, source] of [["Chart", chart], ["LiquidityMapWorkspace", liqMap]]) {
    assert.match(
      source,
      /className="pointer-events-none absolute z-\[5\] select-none"/,
      `${name} watermark is not layered under the readings`,
    );
    assert.match(source, /aria-hidden/, `${name} watermark is not hidden from screen readers`);
    assert.match(source, /draggable=\{false\}/, `${name} watermark is draggable`);
  }
});

check("it is centred by the browser, not by measurement", () => {
  /*
   * `left: 0` with a right edge and `margin-inline: auto` splits the free space
   * evenly, so the mark re-centres on every resize, split, detach and aspect
   * ratio on its own. A measured centre would need a layout effect, which runs
   * a frame late and goes stale when a pane is resized while hidden.
   */
  assert.match(chart, /top: 8,\s*\n\s*left: 0,\s*\n\s*right: nativePriceScaleWidth,\s*\n\s*marginInline: "auto",/);
  // Centred over the candles, not the pane: the price scale is chrome on the
  // right, and centring across it leaves the mark visibly off-centre.
  assert.doesNotMatch(chart, /right: 0,\s*\n\s*marginInline: "auto"/);
  // An explicit width is what makes margin:auto centre anything at all.
  assert.match(chart, /marginInline: "auto",\s*\n\s*width: chartWatermark\.width,/);

  /*
   * The liquidity map brackets the plot the map reports rather than the pane,
   * for the same reason: its DOM ladder and price axis are chrome on the right,
   * and centring across them leaves the mark visibly left of the middle of the
   * chart. It cannot subtract a measured width the way the chart does, because
   * that chrome is painted inside the same canvas as the heat.
   */
  assert.match(liqMap, /top: \(plotBox\?\.top \?\? 0\) \+ 8,/, "the mark must sit under the map's own rail");
  assert.match(liqMap, /left: plotBox\?\.left \?\? 0,/);
  assert.match(
    liqMap,
    /right: paneSize\.width - \(\(plotBox\?\.left \?\? 0\) \+ \(plotBox\?\.width \?\? 0\)\)/,
    "the right edge must be the plot's edge, not the pane's",
  );
  assert.match(liqMap, /marginInline: "auto",\s*\n\s*width: watermark\.width,/);
});

check("the liquidity map centres on the chart, not the pane", () => {
  /*
   * The DOM ladder, price axis and volume profile are painted into the same
   * canvas as the heat, so from the workspace the map is one full-width
   * element and its internal geometry cannot be measured. The map posts its
   * plot rect; centring across the pane instead puts the mark visibly left of
   * the middle of the chart whenever the DOM is open.
   */
  assert.match(renderer, /kwantdesk:liquidity-map-plot/, "the map never reports its plot");
  assert.match(renderer, /publishedPlotKey/, "the plot would be posted on every render");
  assert.match(liqMap, /"kwantdesk:liquidity-map-plot"/, "the workspace never listens for it");
  // No plot yet means no mark: one that jumps into place on the first frame is
  // worse than one that simply arrives correct.
  assert.match(liqMap, /plotBox\s*\n?\s*\?\s*chartWatermarkSize/, "the mark is placed before the plot is known");
});

check("the liquidity map wears the mark at half size", () => {
  assert.equal(LIQUIDITY_MAP_WATERMARK_SCALE, 0.5);
  const full = chartWatermarkSize(1400, 700);
  const half = chartWatermarkSize(1400, 700, LIQUIDITY_MAP_WATERMARK_SCALE);
  assert.ok(Math.abs(half.width / full.width - 0.5) < 0.02, "half means half");
  // Scaling must not distort it.
  assert.ok(Math.abs(half.width / half.height - CHART_WATERMARK_ASPECT) < 0.35, "scaling distorted the mark");
  assert.match(liqMap, /LIQUIDITY_MAP_WATERMARK_SCALE/, "the liq map does not use the half-size scale");
  assert.doesNotMatch(chart, /LIQUIDITY_MAP_WATERMARK_SCALE/, "the charts must keep full size");
});

check("the liquidity map measures a pane that hides its own size", () => {
  /*
   * The pane carries `contain: size`. Measured live in Chromium, that element
   * reports a 0x0 content box AND delivers no ResizeObserver callbacks at all -
   * zero entries in both content-box and border-box modes for an element
   * measuring 1400x700. Reading `entry.contentRect` pinned the size at zero and
   * the mark never rendered once.
   *
   * So the entry is not what gets read, and the contained pane is not what gets
   * observed.
   */
  assert.match(liqMap, /\[contain:layout_paint_size\]/, "the containment this works around is gone");
  // Comments stripped: the paragraph above explains contentRect, and matching
  // the explanation instead of the code is not a check of anything.
  const liqMapCode = liqMap.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(liqMapCode, /entry\??\.contentRect/, "contentRect is 0x0 under contain: size");
  assert.match(liqMap, /node\.offsetWidth/, "the pane must be measured directly");
  assert.match(liqMap, /observer\.observe\(node\.parentElement \?\? node\)/, "the contained pane cannot be the observed one");
  // A pane that is never resized still has to wear the mark.
  assert.match(liqMap, /^\s*measure\(\);$/m, "there is no measurement before the first resize");
  assert.match(liqMap, /observer\.disconnect\(\)/, "the observer is never cleaned up");
  // Setting state on every observed frame would rerender the pane continuously.
  assert.match(liqMap, /current\.width === width && current\.height === height/);
});

console.log(`\nchart watermark: ${passed}/${passed} checks passed`);
