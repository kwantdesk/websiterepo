import assert from "node:assert/strict";

const { calculateIndicatorSeries } = await import("../src/lib/chartIndicatorEngine.ts");

/**
 * A CVD candle opens where the one before it closed.
 *
 * `deltaOpen` is meant to be the delta at the START of a bar, so the body
 * spans that bar's own flow. Our flow-baked bars store a single delta and set
 * deltaOpen to deltaClose - so open equalled close on EVERY bar. Two things
 * followed, and only the second was noticed:
 *
 *   - every body was zero height, drawn at the renderer's 2px minimum;
 *   - `close >= open` was true on every bar, so every candle took the ask
 *     colour and the whole study read as one block.
 *
 * The cumulative line still rose and fell correctly, which is why it looked
 * like a theme bug. It was not: the theme, the palette resolver and the pane
 * renderer were all correct, and three separate attempts at the colour layer
 * could not have fixed it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const THEME = {
  primary: "#FFB627", secondary: "#FFB627",
  positive: "#FFB627", negative: "#F15BB5", muted: "#351D42",
};

/** Alternating bars: +600 delta, then -600, and so on. */
const bars = ({ deltaOpenEqualsClose }) => Array.from({ length: 12 }, (_, index) => {
  const rising = index % 2 === 0;
  const delta = rising ? 600 : -600;
  const open = 100 + index;
  const candle = {
    timestamp: 1_788_000_000_000 + index * 60_000,
    open, high: open + 3, low: open - 3, close: rising ? open + 2 : open - 2,
    volume: 1_000,
    askVolume: rising ? 800 : 200,
    bidVolume: rising ? 200 : 800,
    delta, deltaClose: delta,
  };
  if (deltaOpenEqualsClose) {
    // What the baked bars actually carry.
    candle.deltaOpen = delta;
    candle.deltaHigh = delta;
    candle.deltaLow = delta;
  }
  return candle;
});

const cvd = (candles) => {
  const [series] = calculateIndicatorSeries(
    {
      instanceId: "test", indicatorId: "cumulative-volume-delta", enabled: true,
      settings: { useThemeColors: true, gradientPreset: "off", displayStyle: "candles" },
    },
    candles, THEME, { instrument: "NQ", tickSize: 0.25 },
  );
  assert.ok(series, "CVD produced no series");
  return series;
};

const tally = (series) => {
  const counts = {};
  for (const point of series.data) counts[point.color ?? "(none)"] = (counts[point.color ?? "(none)"] ?? 0) + 1;
  return counts;
};

check("a bar that stores one delta still paints both sides", () => {
  // This is the shape that produced the report. Every candle came back ask.
  const counts = tally(cvd(bars({ deltaOpenEqualsClose: true })));
  assert.equal(counts[THEME.positive], 6, `ask bars: ${JSON.stringify(counts)}`);
  assert.equal(counts[THEME.negative], 6, `bid bars: ${JSON.stringify(counts)}`);
});

check("and its bodies have real height", () => {
  /*
   * The colour was the visible half. A zero-height body is the same bug: the
   * candle carried no information at all, only a wick.
   */
  const series = cvd(bars({ deltaOpenEqualsClose: true }));
  for (const point of series.data) {
    assert.notEqual(point.open, point.close, `a candle at ${point.time} has no body`);
    assert.equal(Math.abs(point.close - point.open), 600, "the body is not the bar's own delta");
  }
});

check("a bar with a genuine intra-bar open keeps it", () => {
  // The healthy path must be untouched: only the degenerate case is corrected.
  const counts = tally(cvd(bars({ deltaOpenEqualsClose: false })));
  assert.equal(counts[THEME.positive], 6);
  assert.equal(counts[THEME.negative], 6);
});

check("the colour follows the body that is drawn", () => {
  /*
   * A candle drawn falling and coloured buying would be worse than either bug
   * on its own, so they are checked together rather than separately.
   */
  for (const shape of [true, false]) {
    for (const point of cvd(bars({ deltaOpenEqualsClose: shape })).data) {
      const rising = point.close >= point.open;
      assert.equal(
        point.color, rising ? THEME.positive : THEME.negative,
        `a ${rising ? "rising" : "falling"} candle took the wrong side`,
      );
    }
  }
});

check("volume still paints per bar, not per series", () => {
  // Same family of failure, checked here so the two cannot drift apart.
  const [series] = calculateIndicatorSeries(
    { instanceId: "v", indicatorId: "volume", enabled: true, settings: { useThemeColors: true, gradientPreset: "off" } },
    bars({ deltaOpenEqualsClose: true }), THEME, { instrument: "NQ", tickSize: 0.25 },
  );
  const counts = tally(series);
  assert.equal(counts[THEME.positive], 6, `volume up bars: ${JSON.stringify(counts)}`);
  assert.equal(counts[THEME.negative], 6, `volume down bars: ${JSON.stringify(counts)}`);
});

console.log(`\ncvd candle direction: ${passed}/${passed} checks passed`);
