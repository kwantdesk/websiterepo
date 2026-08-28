import assert from "node:assert/strict";

const { visibleIndicatorTheme } = await import("../src/lib/indicatorPlotColors.ts");
const { themePresets } = await import("../src/lib/themePresets.ts");

/**
 * No study may be painted the colour of the chart it is drawn on.
 *
 * A theme is free to paint a candle BODY the same colour as the chart - that is
 * what a hollow candle is, and Chromey Mono draws its bearish bars that way.
 * Studies seeded "negative" straight from that body and "muted" from the grid,
 * so selecting that theme turned CVD, the delta histograms and volume black on
 * a black chart. They were still being drawn; there was simply nothing to see.
 *
 * A candle body is a candle body. The colour that MEANS bearish on a hollow
 * theme is the outline, so where a body cannot be seen against the background
 * the outline stands in for it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const asChart = (t) => ({
  upColor: t.candleUp,
  downColor: t.candleDown,
  borderUpColor: t.candleUpBorder,
  borderDownColor: t.candleDownBorder,
  gridColor: t.gridColor,
  backgroundColor: t.chartBackground,
});

/** WCAG relative luminance, the same measure the resolver uses. */
function luminance(colour) {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(colour).trim());
  if (!hex) return null;
  const channels = [0, 2, 4].map((at) => {
    const value = parseInt(hex[1].slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  if (x === null || y === null) return Infinity;
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

check("no theme seeds a study with the chart's own colour", () => {
  /*
   * The whole point. Every palette, every role - if a study can be handed a
   * colour indistinguishable from the chart, some study will draw with it.
   */
  const invisible = [];
  for (const preset of themePresets) {
    const seed = visibleIndicatorTheme(asChart(preset.colors));
    for (const [role, colour] of Object.entries(seed)) {
      if (contrast(colour, preset.colors.chartBackground) < 1.2) {
        invisible.push(`${preset.name}.${role} = ${colour}`);
      }
    }
  }
  assert.deepEqual(invisible, [], `studies would be invisible: ${invisible.join("; ")}`);
});

check("Chromey Mono's bearish studies use the candle outline", () => {
  const t = themePresets.find((preset) => preset.name === "Chromey Mono").colors;
  const seed = visibleIndicatorTheme(asChart(t));
  assert.equal(t.candleDown, t.chartBackground, "the theme is no longer hollow, so this guards nothing");
  assert.equal(seed.negative, t.candleDownBorder, "bearish studies are not using the outline");
  assert.notEqual(seed.muted, t.gridColor, "volume is still seeded from a near-invisible grid");
  assert.equal(seed.positive, t.candleUp, "the bullish colour should be untouched - it is visible");
});

check("a solid theme is left completely alone", () => {
  /*
   * The substitution must be rare. A theme whose candles are solid and whose
   * grid can be seen has nothing to fix, and repainting it would be a change
   * nobody asked for.
   */
  const solid = themePresets.find((preset) => {
    const t = preset.colors;
    return contrast(t.candleDown, t.chartBackground) >= 1.2
      && contrast(t.gridColor, t.chartBackground) >= 1.2;
  });
  assert.ok(solid, "no solid theme to compare against");
  const seed = visibleIndicatorTheme(asChart(solid.colors));
  assert.equal(seed.negative, solid.colors.candleDown);
  assert.equal(seed.muted, solid.colors.gridColor);
  assert.equal(seed.positive, solid.colors.candleUp);
});

check("the substitution stays rare across the whole set", () => {
  /*
   * A threshold tuned too high repaints volume on most palettes. Measured:
   * #0E120E on black is 1.12 and gets replaced; the usual #1F1F1F gridline is
   * 1.30 and is left alone. If this count climbs, the bar has moved from
   * "effectively the background" to "a bit dim", which is not this rule's job.
   */
  const adjusted = themePresets.filter((preset) => {
    const t = preset.colors;
    const seed = visibleIndicatorTheme(asChart(t));
    return seed.negative !== t.candleDown || seed.muted !== t.gridColor
      || seed.positive !== t.candleUp;
  });
  assert.ok(
    adjusted.length <= 12,
    `${adjusted.length} themes are being repainted: ${adjusted.map((p) => p.name).join(", ")}`,
  );
  assert.ok(adjusted.length >= 1, "nothing is being fixed at all");
});

console.log(`\nindicator visibility: ${passed}/${passed} checks passed`);
