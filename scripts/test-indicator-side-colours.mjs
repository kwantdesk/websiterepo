import assert from "node:assert/strict";

const { themePresets } = await import("../src/lib/themePresets.ts");
const { visibleIndicatorTheme } = await import("../src/lib/indicatorPlotColors.ts");

/**
 * The two sides of a study can always be told apart.
 *
 * Colours were only ever checked against the BACKGROUND, which is why a rising
 * and a falling CVD bar could arrive the same colour: several palettes pair two
 * shades of one hue for up and down - brick against maroon, orange against
 * red-orange. That reads fine on candles, where position carries the meaning,
 * and not at all on a delta histogram where colour is the only signal.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const channels = (hex) => {
  const clean = String(hex).replace("#", "");
  return /^[0-9a-f]{6}$/i.test(clean)
    ? [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16))
    : null;
};
const distance = (a, b) => {
  const x = channels(a);
  const y = channels(b);
  if (!x || !y) return Number.POSITIVE_INFINITY;
  return Math.sqrt(x.reduce((total, value, i) => total + (value - y[i]) ** 2, 0));
};
const roles = (colors) => visibleIndicatorTheme({
  upColor: colors.candleUp,
  downColor: colors.candleDown,
  borderUpColor: colors.candleUpBorder,
  borderDownColor: colors.candleDownBorder,
  gridColor: colors.gridColor,
  backgroundColor: colors.chartBackground,
});

check("no palette leaves bull and bear reading as one colour", () => {
  const collapsed = [];
  for (const preset of themePresets) {
    const theme = roles(preset.colors);
    const apart = distance(theme.positive, theme.negative);
    if (apart < 60) collapsed.push(`${preset.name}: ${theme.positive} vs ${theme.negative} (${apart.toFixed(0)})`);
  }
  assert.deepEqual(collapsed, [], `these still collapse:\n  ${collapsed.join("\n  ")}`);
});

check("a palette that already separates them is left alone", () => {
  /*
   * The point of trying the outline before altering anything: an author who
   * chose orange against blue keeps orange against blue.
   */
  const solar = themePresets.find((preset) => preset.name === "Solar Flare");
  assert.ok(solar, "Solar Flare is gone from the presets");
  const theme = roles(solar.colors);
  assert.equal(theme.positive.toLowerCase(), solar.colors.candleUp.toLowerCase());
  assert.equal(theme.negative.toLowerCase(), solar.colors.candleDown.toLowerCase());
});

check("both sides still stand off the chart background", () => {
  // Separating them is no good if the fix buries one in the background.
  for (const preset of themePresets) {
    const theme = roles(preset.colors);
    for (const role of ["positive", "negative"]) {
      const apart = distance(theme[role], preset.colors.chartBackground);
      assert.ok(apart >= 25, `${preset.name} ${role} ${theme[role]} vanishes into ${preset.colors.chartBackground}`);
    }
  }
});

check("a down colour equal to the background is replaced", () => {
  /*
   * Chromey Mono paints its falling candle pure black on a black chart. On
   * candles the outline carries it; a histogram bar would simply be missing.
   */
  const chromey = themePresets.find((preset) => preset.name === "Chromey Mono");
  if (!chromey) return;
  const theme = roles(chromey.colors);
  assert.notEqual(theme.negative.toLowerCase(), chromey.colors.chartBackground.toLowerCase());
  assert.ok(distance(theme.negative, theme.positive) >= 60);
});

check("the roles stay stable for the same palette", () => {
  // Resolution must be pure: the same theme cannot paint differently twice.
  for (const preset of themePresets.slice(0, 6)) {
    assert.deepEqual(roles(preset.colors), roles(preset.colors), `${preset.name} is not deterministic`);
  }
});

console.log(`\nindicator side colours: ${passed}/${passed} checks passed`);
