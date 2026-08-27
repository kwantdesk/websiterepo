import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The KwantDesk mark, bottom-left of every chart.
 *
 * It scales with the pane rather than sitting at a fixed size: a full-screen
 * chart should wear it at a readable size, and one pane of a six-pane workspace
 * should not be dominated by it. The sizing is a pure function so the behaviour
 * at every pane size can be checked here rather than eyeballed at one size.
 */

const source = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const asset = fileURLToPath(new URL("../public/brand/kwantdesk-wordmark-white.png", import.meta.url));

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// Lift the real sizing function out of the component.
const at = source.indexOf("function chartWatermarkSize(");
assert.ok(at > 0, "chartWatermarkSize is missing");
const body = source.slice(at, source.indexOf("\n}\n", at) + 2).replace(/: number\b/g, "");
const constant = (name) => {
  const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
  assert.ok(match, `${name} is missing`);
  return Function(`return ${match[1]};`)();
};
const ASPECT = constant("CHART_WATERMARK_ASPECT");
const MIN_WIDTH = constant("CHART_WATERMARK_MIN_WIDTH");
const MAX_WIDTH = constant("CHART_WATERMARK_MAX_WIDTH");
const size = Function(
  "CHART_WATERMARK_ASPECT", "CHART_WATERMARK_WIDTH_FRACTION", "CHART_WATERMARK_MIN_WIDTH",
  "CHART_WATERMARK_MAX_WIDTH", "CHART_WATERMARK_MAX_HEIGHT_FRACTION",
  `${body} return chartWatermarkSize;`,
)(
  ASPECT, constant("CHART_WATERMARK_WIDTH_FRACTION"), MIN_WIDTH,
  MAX_WIDTH, constant("CHART_WATERMARK_MAX_HEIGHT_FRACTION"),
);

check("the asset exists, is a PNG, and is the white wordmark", () => {
  const stat = statSync(asset);
  assert.ok(stat.size > 1_000, "the mark is suspiciously small");
  const head = readFileSync(asset).subarray(0, 8);
  // PNG magic. The owner asked for a PNG specifically.
  assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "not a PNG");
  assert.match(source, /const CHART_WATERMARK_SRC = "\/brand\/kwantdesk-wordmark-white\.png";/);
});

check("the declared aspect matches the file", () => {
  // A wrong ratio here stretches the wordmark, which is worse than not showing
  // it at all. 1911x305 is the source wordmark's own pixel size.
  const png = readFileSync(asset);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(width, 1911);
  assert.equal(height, 305);
  assert.ok(Math.abs(ASPECT - width / height) < 0.001, "declared aspect does not match the file");
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
  const tall = size(900, 900);
  assert.ok(tall.height > strip.height, "the same width on a taller pane gets more of it");
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
      Math.abs(box.width / box.height - ASPECT) < 0.35,
      `${w}x${h} rendered ${box.width}x${box.height}, ratio ${(box.width / box.height).toFixed(2)}`,
    );
  }
});

check("it sits under every reading on the chart", () => {
  // Above the canvas so it is visible at all, but beneath drawings (z-24) and
  // the order labels (z-31): a watermark must never be something a trader has
  // to look past.
  assert.match(source, /className="pointer-events-none absolute z-\[5\] select-none"/);
  assert.match(source, /aria-hidden/);
  assert.match(source, /draggable=\{false\}/);
  /*
   * Top centre, and centred by the BROWSER rather than by measurement.
   *
   * `left: 0` with `right: <price scale>` and `margin-inline: auto` splits the
   * free space evenly, so the mark re-centres on every resize, split, detach
   * and aspect ratio on its own. A measured centre would need a layout effect,
   * which runs a frame late and goes stale when a pane is resized while hidden.
   */
  assert.match(source, /top: 8,\s*\n\s*left: 0,\s*\n\s*right: nativePriceScaleWidth,\s*\n\s*marginInline: "auto",/);
  // Centred over the candles, not the pane: the price scale is chrome on the
  // right, and centring across it leaves the mark visibly off-centre.
  assert.doesNotMatch(source, /right: 0,\s*\n\s*marginInline: "auto"/);
  // An explicit width is what makes margin:auto centre anything at all.
  assert.match(source, /marginInline: "auto",\s*\n\s*width: chartWatermark\.width,/);
});

console.log(`\nchart watermark: ${passed}/${passed} checks passed`);
