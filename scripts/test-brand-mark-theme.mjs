import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { brandMarkTokens, resolveBrandMarkColor } from "../src/lib/brandMark.ts";
import { contrastRatio, parseResolvedColor } from "../src/lib/readableContrast.ts";
import { themePresets } from "../src/lib/themePresets.ts";
import { themeBootstrapScript, THEME_STORAGE_KEY } from "../src/lib/theme.ts";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const watermark = readFileSync(new URL("../src/lib/chartWatermark.ts", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/components/WorkspaceHome.tsx", import.meta.url), "utf8");
const theme = readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8");
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
    /--brand-mark: var\(--primary\);/,
    "--brand-mark no longer starts from the bright theme signature",
  );
  assert.match(css, /--chart-brand-mark: var\(--primary\);/);
  assert.match(theme, /root\.style\.setProperty\("--brand-mark", brand\.shell\)/);
  assert.match(theme, /root\.style\.setProperty\("--chart-brand-mark", brand\.chart\)/);
});

check("every preset chooses visible ink from its own bright palette", () => {
  for (const preset of themePresets) {
    const tokens = brandMarkTokens(preset.colors);
    for (const [surface, colour, background] of [
      ["shell", tokens.shell, preset.colors.background],
      ["chart", tokens.chart, preset.colors.chartBackground],
    ]) {
      const foregroundRgb = parseResolvedColor(colour);
      const backgroundRgb = parseResolvedColor(background);
      assert.ok(foregroundRgb && backgroundRgb, `${preset.name} ${surface} colours did not resolve`);
      assert.ok(contrastRatio(foregroundRgb, backgroundRgb) >= 3, `${preset.name} ${surface} mark is not visible`);
    }
  }
});

check("the owner's representative themes use their signature colour", () => {
  const midnight = themePresets.find((preset) => preset.name === "Midnight Cockpit");
  const tangerine = themePresets.find((preset) => preset.name === "Tangerine Terminal");
  const chromey = themePresets.find((preset) => preset.name === "Chromey Mono");
  const forestFire = themePresets.find((preset) => preset.name === "Forest Fire");
  assert.equal(resolveBrandMarkColor(midnight.colors, midnight.colors.background), midnight.colors.primary);
  assert.equal(resolveBrandMarkColor(tangerine.colors, tangerine.colors.background), tangerine.colors.primary);
  assert.equal(resolveBrandMarkColor(chromey.colors, chromey.colors.background), chromey.colors.primary);
  assert.equal(resolveBrandMarkColor(forestFire.colors, forestFire.colors.background), forestFire.colors.secondary);
});

check("first paint and hydrated paint choose the same logo colours", () => {
  for (const preset of themePresets) {
    const properties = new Map();
    const root = {
      dataset: {},
      style: {
        setProperty: (name, value) => properties.set(name, value),
        backgroundColor: "",
        color: "",
      },
    };
    runInNewContext(themeBootstrapScript(), {
      document: { documentElement: root, querySelector: () => null },
      localStorage: { getItem: (key) => key === THEME_STORAGE_KEY ? JSON.stringify(preset.colors) : null },
      requestAnimationFrame: (callback) => callback(),
    });
    const expected = brandMarkTokens(preset.colors);
    assert.equal(properties.get("--brand-mark"), expected.shell, `${preset.name} shell changed after hydration`);
    assert.equal(properties.get("--chart-brand-mark"), expected.chart, `${preset.name} chart changed after hydration`);
  }
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
  assert.match(watermark, /brandWordmarkPaint\("--chart-brand-mark"\)/, "chart marks do not use chart-background contrast");
  // Both prefixes: the unprefixed property alone is not enough in WebKit.
  assert.match(watermark, /WebkitMaskImage:/, "the WebKit mask prefix is missing");
  assert.ok(
    !/filter:/i.test(watermark),
    "a filter crept in - it cannot recolour white and fringes the letters",
  );
});

check("the home wordmark uses the same masked theme paint", () => {
  assert.match(home, /\.\.\.brandWordmarkPaint\(\)/);
  assert.doesNotMatch(home, /src="\/images\/kwantdesk-wordmark\.webp"/);
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
