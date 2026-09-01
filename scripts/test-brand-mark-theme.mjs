import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const watermark = readFileSync(new URL("../src/lib/chartWatermark.ts", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const liqmap = readFileSync(
  new URL("../src/components/liquidity-map/LiquidityMapWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * The KwantDesk mark takes the theme, everywhere it appears.
 *
 * It shipped as white in three places: a hardcoded `#fff` on the header
 * wordmark, and a white PNG drawn straight into an `<img>` on the chart and
 * the liquidity map. White belongs to no palette, so on every theme the mark
 * read as a sticker rather than as part of the product.
 *
 * The PNG is masked rather than filtered. Its alpha is the stencil and the
 * colour is painted behind it, so the letterforms and their antialiasing stay
 * exactly as drawn - a filter chain on white either does nothing (hue-rotate)
 * or lands somewhere different per theme and fringes the edges.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("one variable defines the mark's colour", () => {
  assert.match(
    css,
    /--brand-mark: color-mix\(in srgb, var\(--foreground\) \d+%, var\(--primary\)\);/,
    "--brand-mark is gone or no longer derived from the theme",
  );
});

check("it is derived, never a fixed colour", () => {
  /*
   * A literal here would be white again under a different name, and would not
   * move when the palette does.
   */
  const line = css.split("\n").find((row) => row.includes("--brand-mark:"));
  assert.ok(line, "no --brand-mark declaration");
  assert.ok(!/#[0-9a-f]{3,8}/i.test(line), `--brand-mark carries a literal colour: ${line.trim()}`);
  assert.ok(line.includes("var(--foreground)"), "it no longer starts from the theme foreground");
});

check("the header wordmark reads it", () => {
  const start = css.indexOf(".kwant-primary-brand-wordmark {");
  assert.ok(start > 0, "the header wordmark rule is gone");
  const rule = css.slice(start, css.indexOf("}", start));
  assert.match(rule, /color: var\(--brand-mark\);/, "the header wordmark is not on the theme colour");
  assert.ok(!/color:\s*#fff/i.test(rule), "the header wordmark is hardcoded white again");
});

check("the PNG is masked, not filtered", () => {
  assert.match(watermark, /maskImage: `url\("\$\{CHART_WATERMARK_SRC\}"\)`/, "the mark is no longer used as a mask");
  assert.match(watermark, /backgroundColor: "var\(--brand-mark\)"/, "the mask is not painted with the theme colour");
  // Both prefixes: the unprefixed property alone is not enough in WebKit.
  assert.match(watermark, /WebkitMaskImage:/, "the WebKit mask prefix is missing");
  assert.ok(
    !/filter:/i.test(watermark),
    "a filter crept in - it cannot recolour white and fringes the letters",
  );
});

check("both surfaces paint through that one helper", () => {
  for (const [name, source] of [["chart", chart], ["liquidity map", liqmap]]) {
    assert.match(source, /\.\.\.chartWatermarkPaint\(\),/, `the ${name} watermark does not use the shared paint`);
    assert.ok(
      !/<img\s+[\s\S]{0,80}?src=\{CHART_WATERMARK_SRC\}/.test(source),
      `the ${name} still draws the white PNG directly`,
    );
  }
});

check("the mask keeps the mark's own proportions", () => {
  // A mask that tiles or crops would letterbox the wordmark; it is sized to
  // the box the layout already computed for it.
  assert.match(watermark, /maskSize: "100% 100%"/);
  assert.match(watermark, /maskRepeat: "no-repeat"/);
});

console.log(`\nbrand mark theme: ${passed}/${passed} checks passed`);
