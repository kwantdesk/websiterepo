import { test } from "node:test";
import assert from "node:assert/strict";
import { SuperTrendPlotBuffer } from "../src/lib/superTrendLivePlot.ts";
import { calculateSuperTrendSeries, paintSuperTrendSeries } from "../src/lib/superTrendSeries.ts";
import { SuperTrendLiveCalculator } from "../src/lib/superTrend.ts";

const theme = { primary: "#00ff00", secondary: "#ffffff", positive: "#00ee77", negative: "#ee0055", muted: "#888888" };
const series = (data, style = "a") => ({ key: "st-x", kind: "line", placement: "overlay", color: "#fff", label: "ST", superTrendStyleKey: style, data });
test("live plot buffer replaces forming point, keeps new bars and respects historical corrections", () => {
  const buffer = new SuperTrendPlotBuffer();
  const base = series([{ time: 1, value: 10 }, { time: 2, value: 20 }]);
  buffer.push(series([{ time: 2, value: 22 }, { time: 3, value: 30 }]));
  assert.deepEqual(buffer.merge(base).data, [{ time: 1, value: 10 }, { time: 2, value: 22 }, { time: 3, value: 30 }]);
  const corrected = series([{ time: 1, value: 11 }, { time: 2, value: 21 }, { time: 3, value: 29 }]);
  assert.deepEqual(buffer.merge(corrected).data, [{ time: 1, value: 11 }, { time: 2, value: 21 }, { time: 3, value: 30 }]);
  assert.equal(buffer.merge(series(base.data, "new-theme")).data, base.data);
  buffer.push(series([{ time: 3, value: 31 }], "new-theme"));
  assert.equal(buffer.merge(base), base);
  buffer.clear(); assert.equal(buffer.merge(base), base);
});

test("buffer is bounded, rejects invalid values and preserves event-bar times", () => {
  const buffer = new SuperTrendPlotBuffer();
  buffer.push(series(Array.from({ length: 4000 }, (_, i) => ({ time: 100 + i / 100, value: i }))));
  buffer.push(series([{ time: NaN, value: 1 }, { time: 140, value: Infinity }]));
  const result = buffer.merge(series([]));
  assert.equal(result.data.length, 1500); assert.equal(result.data[0].time, 125);
  assert.equal(result.data.at(-1).time, 139.99);
});

test("incremental styles match complete engine plots, including same-bar slope colouring", () => {
  const bars = Array.from({ length: 100 }, (_, i) => {
    const close = 100 + Math.sin(i / 4) * 20;
    return { timestamp: 1700000000000 + i * 1000, close, open: close, high: close + 1, low: close - 1 };
  });
  for (const difference of [false, true]) for (const colorMode of ["none", "slope", difference ? "sign" : "direction"]) {
    const live = new SuperTrendLiveCalculator(); live.reseed(bars);
    for (const shift of [-0.5, 0.5, 0]) {
      const candle = { ...bars.at(-1), close: bars.at(-1).close + shift };
      const point = live.update(candle), previous = live.previousPoint();
      const s = { colorMode, useThemeColors: false, plotColor: "#123456", secondaryColor: "#abcdef" };
      const [painted] = paintSuperTrendSeries([point], s, theme, "one", difference,
        difference ? previous.difference : previous.value);
      const [full] = calculateSuperTrendSeries([...bars.slice(0, -1), candle], s, theme, "one", difference);
      assert.deepEqual(painted.data[0], full.data.at(-1));
      assert.equal(painted.superTrendStyleKey, full.superTrendStyleKey);
    }
  }
  assert.notEqual(calculateSuperTrendSeries(bars, {}, theme, "one")[0].key,
    calculateSuperTrendSeries(bars, {}, theme, "two")[0].key);
});
