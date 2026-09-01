import assert from "node:assert/strict";

const { calculateIndicatorSeries } = await import("../src/lib/chartIndicatorEngine.ts");
const { CHART_INDICATOR_CATALOG } = await import("../src/lib/chartIndicatorCatalog.ts");
const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

/**
 * A study that paints by direction paints BOTH directions.
 *
 * This is the failure the colour work kept missing. The theme was right, the
 * palette resolver was right, the pane renderer was right - and the study
 * still arrived as one solid block, because the colour applied to every bar
 * was correct and there was only ever one of it.
 *
 * The cause was one line in the plot-colour override: a study that plots one
 * series carries one colour setting, and a study that paints bars by direction
 * carries per-point colours. Where both were true the single setting was
 * pushed into BOTH directions - `up ?? color`, `down ?? color` - collapsing
 * every rising and falling bar onto one value. Eight studies did it: CVD and
 * its three delta variants, Volume, Delta Bar, the MACD histogram and the
 * Awesome Oscillator.
 *
 * Checking colours could never have found this. Counting them does.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const THEME = { primary: "#3B82F6", secondary: "#8B5CF6", positive: "#22C55E", negative: "#EF4444", muted: "#71717A" };
const CS = {
  upColor: "#22C55E", downColor: "#EF4444", borderUpColor: "#16A34A",
  borderDownColor: "#DC2626", gridColor: "#71717A", backgroundColor: "#050607",
};

/*
 * Bars that genuinely alternate in price, aggressor delta and volume.
 *
 * `deltaOpen` is set equal to `deltaClose`, which is what our flow-baked bars
 * actually carry - a study must cope with that and still show direction.
 */
let price = 20_000;
const CANDLES = Array.from({ length: 400 }, (_, index) => {
  const rising = Math.sin(index / 7) > 0;
  const open = price;
  price += rising ? 3 : -3;
  const close = price;
  const ask = rising ? 900 : 150;
  const bid = rising ? 150 : 900;
  const delta = ask - bid;
  return {
    timestamp: 1_788_000_000_000 + index * 60_000,
    open, high: Math.max(open, close) + 2, low: Math.min(open, close) - 2, close,
    volume: ask + bid, askVolume: ask, bidVolume: bid,
    askTrades: ask / 10, bidTrades: bid / 10, trades: (ask + bid) / 10,
    delta, deltaClose: delta, deltaOpen: delta, deltaHigh: delta, deltaLow: delta,
  };
});

const run = (id, settings) => {
  try {
    return calculateIndicatorSeries(
      { instanceId: "t", indicatorId: id, enabled: true, settings }, CANDLES, THEME,
      { instrument: "NQ", tickSize: 0.25 },
    ) ?? [];
  } catch { return []; }
};

check("no study paints every bar the same colour", () => {
  const flat = [];
  for (const { id } of CHART_INDICATOR_CATALOG) {
    let settings;
    try { settings = { ...defaultIndicatorSettings(id, CS), useThemeColors: true, gradientPreset: "off" }; } catch { continue; }
    for (const series of run(id, settings)) {
      const data = series.data ?? [];
      if (data.length < 10) continue;
      const coloured = data.filter((point) => point.color);
      // Only studies that colour EVERY point by direction are in scope; a
      // study that marks a few events is meant to have one marker colour.
      if (coloured.length !== data.length) continue;
      if (new Set(coloured.map((point) => point.color)).size === 1) {
        flat.push(`${id} / ${series.key}: all ${data.length} bars ${coloured[0].color}`);
      }
    }
  }
  assert.deepEqual(flat, [], `these paint one colour on data that alternates:\n  ${flat.join("\n  ")}`);
});

check("the studies that were broken are actually exercised here", () => {
  /*
   * If the fixture stopped producing series for them, the check above would
   * pass by drawing nothing at all.
   */
  for (const id of [
    "cumulative-volume-delta", "volume", "delta-bar",
    "delta-cumulative-candlestick", "delta-cumulative-histogram",
    "cvd-divergence", "macd-indicator", "awesome-oscillator",
  ]) {
    const settings = { ...defaultIndicatorSettings(id, CS), useThemeColors: true, gradientPreset: "off" };
    const coloured = run(id, settings).flatMap((series) => (series.data ?? []).filter((point) => point.color));
    assert.ok(coloured.length > 10, `${id} produced no coloured bars to check`);
    assert.ok(new Set(coloured.map((point) => point.color)).size >= 2, `${id} is back to one colour`);
  }
});

check("a deliberate colour pick still reaches the bars", () => {
  /*
   * The behaviour the collapsing line was added for, and the reason the fix is
   * a guard rather than a deletion: choosing a colour sets useThemeColors to
   * false, and then it must win.
   */
  const settings = {
    ...defaultIndicatorSettings("volume", CS),
    // Volume plots one series, so its picker key is plotColor.
    useThemeColors: false, gradientPreset: "off", plotColor: "#123456",
  };
  const coloured = run("volume", settings).flatMap((series) => (series.data ?? []).filter((point) => point.color));
  assert.ok(coloured.length, "volume drew nothing");
  assert.ok(
    coloured.some((point) => point.color.toLowerCase() === "#123456"),
    `a chosen colour never reached the bars: ${[...new Set(coloured.map((p) => p.color))].join(", ")}`,
  );
});

check("a scheme still outranks both", () => {
  // Scheme > explicit pick > theme, unchanged.
  const settings = {
    ...defaultIndicatorSettings("volume", CS),
    useThemeColors: true, gradientPreset: "pink-blue",
  };
  const coloured = run("volume", settings).flatMap((series) => (series.data ?? []).filter((point) => point.color));
  assert.ok(coloured.length, "volume drew nothing under a scheme");
  const distinct = new Set(coloured.map((point) => point.color.toLowerCase()));
  assert.ok(
    !distinct.has(THEME.positive.toLowerCase()) || !distinct.has(THEME.negative.toLowerCase()),
    "a scheme left the raw theme colours in place",
  );
});

console.log(`\nindicator both sides: ${passed}/${passed} checks passed`);
