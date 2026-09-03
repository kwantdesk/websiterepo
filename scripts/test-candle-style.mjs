import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  CANDLE_STYLES, CANDLE_SETTING_KEYS, resolveCandleStyle, resolveCandleSeriesColors,
  isHollowStyle, isHeikinAshiStyle, toHeikinAshi,
} = await import("../src/lib/candleStyle.ts");
const { indicatorColorRoles } = await import("../src/lib/indicatorPalettes.ts");
const { themePresets } = await import("../src/lib/themePresets.ts");
const { contrastRatio, legibleOn, parseResolvedColor } = await import("../src/lib/readableContrast.ts");
const settingsPanel = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");

/**
 * The price series' own settings.
 *
 * The candles were the one thing on the chart with none - a visibility toggle
 * and nothing else - while every study drawn on top of them had a dialog, and
 * their colours could only be changed by changing the theme for every chart.
 *
 * The knobs are the ones the platforms traders come from actually expose, read
 * out of the installed builds rather than guessed: DeepChart carries HollowFill,
 * BodyOpacity, BorderColor/Width and MinBodyTick on its bars; ATAS carries a
 * CandleVisualMode of Candles or Bars, with Renko, Range and Delta being how it
 * AGGREGATES rather than how it draws.
 */

const THEME = {
  up: "#22C55E", down: "#EF4444",
  borderUp: "#16A34A", borderDown: "#DC2626",
  wickUp: "#22C55E", wickDown: "#EF4444",
};
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("an unconfigured chart paints exactly the theme", () => {
  // The feature has to be invisible until someone uses it.
  const out = resolveCandleSeriesColors(null, THEME);
  assert.equal(out.upColor, THEME.up);
  assert.equal(out.downColor, THEME.down);
  assert.equal(out.borderUpColor, THEME.borderUp);
  assert.equal(out.wickDownColor, THEME.wickDown);
  assert.equal(out.borderVisible, true);
  assert.equal(out.wickVisible, true);
});

check("an unknown style falls back to candles", () => {
  assert.equal(resolveCandleStyle("no-such-style"), "candles");
  assert.equal(resolveCandleStyle(undefined), "candles");
  for (const style of CANDLE_STYLES) assert.equal(resolveCandleStyle(style.id), style.id);
});

check("hollow empties the body and keeps the outline", () => {
  /*
   * A hollow candle with no border is not a hollow candle, it is an absent one.
   * The border is forced on regardless of the switch for exactly that reason.
   */
  const out = resolveCandleSeriesColors(
    { [CANDLE_SETTING_KEYS.style]: "hollow", [CANDLE_SETTING_KEYS.borderVisible]: false },
    THEME,
  );
  assert.match(out.upColor, /rgba\(0, ?0, ?0, ?0\)/, "the up body is not hollow");
  assert.match(out.downColor, /rgba\(0, ?0, ?0, ?0\)/, "the down body is not hollow");
  assert.equal(out.borderUpColor, THEME.borderUp, "the outline lost its colour");
  assert.equal(out.borderVisible, true, "a hollow candle was allowed to lose its outline");
});

check("an explicit colour beats the theme, and a scheme beats both", () => {
  const picked = resolveCandleSeriesColors({ [CANDLE_SETTING_KEYS.up]: "#123456" }, THEME);
  assert.equal(picked.upColor, "#123456");
  assert.equal(picked.downColor, THEME.down, "an untouched side should still follow the theme");

  const schemed = resolveCandleSeriesColors(
    { gradientPreset: "chromey-mono", [CANDLE_SETTING_KEYS.up]: "#123456" },
    THEME,
  );
  // Falling takes the scheme's start, rising its end - the same way a two-role
  // study is coloured.
  assert.equal(schemed.upColor, "#00FF00");
  assert.equal(schemed.downColor, "#C11414");
  assert.equal(schemed.borderUpColor, "#00FF00", "the outline ignored the scheme");
});

check("body opacity dims the fill and never the outline", () => {
  const out = resolveCandleSeriesColors({ [CANDLE_SETTING_KEYS.bodyOpacity]: 40 }, THEME);
  assert.match(out.upColor, /^rgba\(34, 197, 94, 0\.4/, `expected a dimmed fill, got ${out.upColor}`);
  assert.equal(out.borderUpColor, THEME.borderUp, "the outline was dimmed too");
  // Out of range values cannot make a candle invisible.
  assert.equal(resolveCandleSeriesColors({ [CANDLE_SETTING_KEYS.bodyOpacity]: 0 }, THEME).upColor.includes("0.05"), true);
  assert.equal(resolveCandleSeriesColors({ [CANDLE_SETTING_KEYS.bodyOpacity]: 999 }, THEME).upColor, THEME.up);
});

check("Heikin Ashi keeps every body inside its own wick", () => {
  /*
   * High and low have to include the SYNTHETIC open and close. Averaging only
   * the real values lets a body escape its wick, which draws a bar with its
   * top cut off.
   */
  const bars = [
    { open: 10, high: 12, low: 9, close: 11 },
    { open: 11, high: 14, low: 10, close: 13 },
    { open: 13, high: 13.5, low: 11, close: 11.5 },
    { open: 11.5, high: 11.6, low: 8, close: 8.5 },
  ];
  const ha = toHeikinAshi(bars);
  assert.equal(ha.length, bars.length);
  for (const bar of ha) {
    assert.ok(bar.high >= Math.max(bar.open, bar.close), "a body escaped above its wick");
    assert.ok(bar.low <= Math.min(bar.open, bar.close), "a body escaped below its wick");
  }
  // The first bar seeds from its own values rather than inventing a prior bar.
  assert.equal(ha[0].open, (bars[0].open + bars[0].close) / 2);
  // And it smooths: the averaged series must not simply be the input back.
  assert.notDeepEqual(ha.map((b) => b.open), bars.map((b) => b.open));
});

check("Heikin Ashi does not touch anything but the bars it is given", () => {
  // Studies, profiles and levels read the real tape; only the drawn series is
  // smoothed, so the transform must be pure and preserve every other field.
  const bars = [{ open: 1, high: 2, low: 0.5, close: 1.5, timestamp: 42, volume: 7 }];
  const [out] = toHeikinAshi(bars);
  assert.equal(out.timestamp, 42);
  assert.equal(out.volume, 7);
  assert.equal(bars[0].open, 1, "the input was mutated");
});

check("the style flags agree with the style list", () => {
  assert.equal(isHollowStyle("hollow"), true);
  assert.equal(isHollowStyle("heikin-ashi-hollow"), true);
  assert.equal(isHollowStyle("candles"), false);
  assert.equal(isHeikinAshiStyle("heikin-ashi"), true);
  assert.equal(isHeikinAshiStyle("heikin-ashi-hollow"), true);
  assert.equal(isHeikinAshiStyle("hollow"), false);
});

check("every style button writes its own catalogue id", () => {
  assert.match(settingsPanel, /CANDLE_STYLES\.map\(\(style\) => \(/);
  assert.match(settingsPanel, /aria-pressed=\{candleStyleId === style\.id\}/);
  assert.match(
    settingsPanel,
    /onClick=\{\(\) => setCandleSetting\(CANDLE_SETTING_KEYS\.style, style\.id\)\}/,
    "the candle-style buttons are not connected to the setting consumed by the renderer",
  );
});

check("the pickers write the keys the resolver reads", () => {
  /*
   * Two lists naming the same colours is how a picker ends up controlling
   * nothing. They are checked against each other rather than trusted.
   */
  const pickerKeys = indicatorColorRoles("candles").map((role) => role.key).sort();
  const resolverKeys = Object.entries(CANDLE_SETTING_KEYS)
    .filter(([name]) => !["style", "bodyOpacity", "borderVisible", "wickVisible"].includes(name))
    .map(([, key]) => key)
    .sort();
  assert.deepEqual(pickerKeys, resolverKeys, "the candle pickers and the candle resolver disagree");
});

check("the live-price line cannot inherit an invisible falling-candle colour", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(
    chart,
    /const livePriceLineColor = useMemo\([\s\S]*?legibleOn\(settings\.upColor, settings\.backgroundColor, 4\.5\)/,
    "the price-line colour is not resolved against the chart background",
  );
  assert.match(
    chart,
    /\.\.\.resolvedCandleColors,[\s\S]*?priceLineColor: livePriceLineColor/,
    "candle setting or theme changes can restore the library's direction-dependent price line",
  );
  assert.match(
    chart,
    /addCandlestickSeries\(\{[\s\S]*?priceLineColor: legibleOn\(settings\.upColor, settings\.backgroundColor, 4\.5\)/,
    "the first chart paint can still create an invisible live-price line",
  );
});

check("every theme gives the live-price line institutional contrast", () => {
  for (const theme of themePresets) {
    const line = legibleOn(theme.colors.candleUp, theme.colors.chartBackground, 4.5);
    const lineRgb = parseResolvedColor(line);
    const backgroundRgb = parseResolvedColor(theme.colors.chartBackground);
    assert.ok(lineRgb && backgroundRgb, `${theme.name} uses an unresolved chart colour`);
    assert.ok(
      contrastRatio(lineRgb, backgroundRgb) >= 4.5,
      `${theme.name} live-price line is not readable on its chart`,
    );
  }
});

check("an averaged series is redrawn rather than updated bar by bar", () => {
  /*
   * Every Heikin Ashi bar is computed from the one before it, so there is no
   * incremental form of "the last bar changed". Pushing a raw tick onto the
   * series would paint one true candle inside a smoothed one.
   */
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /isHeikinAshiStyle\(candleStyle\) \|\|\s*\n\s*prevCandlesLengthRef\.current === 0/, "an averaged series is not forced to redraw");
  assert.match(chart, /if \(heikinAshiActiveRef\.current\) return;/, "the live tick path still pushes raw bars");
  // And a style change must redraw even when no new bar has arrived.
  assert.match(chart, /const styleChanged = lastDrawnCandleStyleRef\.current !== candleStyle;/);
  assert.match(
    chart,
    /const needsFullRedraw =[\s\S]*?styleChanged \|\|[\s\S]*?isHeikinAshiStyle\(candleStyle\)/,
    "leaving Heikin Ashi updates only the newest bar instead of restoring the full real-OHLC series",
  );
});

console.log(`\ncandle style: ${passed}/${passed} checks passed`);
