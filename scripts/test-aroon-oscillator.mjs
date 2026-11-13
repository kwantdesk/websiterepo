import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeStoredIndicatorList } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";

const theme = { primary: "#ffffff", secondary: "#aaaaaa", positive: "#00ff00", negative: "#ff0000", muted: "#888888" };
const context = { instrument: "NQ", tickSize: 0.25 };
const candles = Array.from({ length: 30_656 }, (_, index) => ({
  timestamp: 1_700_000_000_000 + index * 60_000,
  open: 20_000,
  high: 20_010 + ((index * 31) % 37),
  low: 19_990 - ((index * 13) % 41),
  close: 20_000,
  volume: 1,
}));
const instance = (length, settings = {}) => ({
  instanceId: "aroon-test", indicatorId: "aroon-oscillator", enabled: true, settings: { length, ...settings },
});
const source = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
assert.match(source, /const studyCandles = instance\.indicatorId === "aroon-oscillator"\s*\? sampledIndicatorCandles/);
const loaded = candles;

function expectedAroon(bars, length) {
  return bars.slice(length).map((candle, offset) => {
    const end = offset + length;
    let high = offset;
    let low = offset;
    for (let index = offset + 1; index <= end; index += 1) {
      if (bars[index].high >= bars[high].high) high = index;
      if (bars[index].low <= bars[low].low) low = index;
    }
    const value = ((high - offset) / length) * 100 - ((low - offset) / length) * 100;
    return { time: candle.timestamp / 1_000, value, color: value > 0 ? "#4ADE80" : value < 0 ? "#C084FC" : "transparent" };
  });
}

const cutoff = candles[1_100].timestamp;
for (const length of [2, 14, 25, 100, 500]) {
  const [result] = calculateIndicatorSeries(instance(length), loaded, theme, context);
  assert.deepEqual(result.data, expectedAroon(loaded, length));
  const [replay] = calculateIndicatorSeries(instance(length), loaded, theme, { ...context, replayTimestampMs: cutoff });
  assert.deepEqual(replay.data, result.data.filter(point => point.time <= cutoff / 1_000));
}
const [defaultPlot] = calculateIndicatorSeries(instance(undefined), loaded, theme, context);
assert.equal(defaultPlot.label, "Aroon Oscillator (14)");
assert.equal(defaultPlot.kind, "histogram");
assert.equal(defaultPlot.showZeroLine, true);
assert.deepEqual(defaultPlot.data, expectedAroon(loaded, 14));
const [customPlot] = calculateIndicatorSeries(instance(14, { useThemeColors: false, plotUpColor: "#112233", plotDownColor: "#445566" }), loaded, theme, context);
assert.ok(customPlot.data.every(point => point.color === (point.value > 0 ? "#112233" : point.value < 0 ? "#445566" : "transparent")));
const [themedPlot] = calculateIndicatorSeries(instance(14, { useThemeColors: true }), loaded, theme, context);
assert.ok(themedPlot.data.every(point => point.color === (point.value > 0 ? theme.positive : point.value < 0 ? theme.negative : "transparent")));
const [base] = calculateIndicatorSeries(instance(25), loaded, theme, context);
const changed = loaded.slice();
changed[changed.length - 1] = { ...changed.at(-1), high: 20_100, low: 19_900 };
const [live] = calculateIndicatorSeries(instance(25), changed, theme, context);
assert.deepEqual(live.data.slice(0, -1), base.data.slice(0, -1));
assert.notEqual(live.data.at(-1).value, base.data.at(-1).value);
assert.equal(base.data.length, 30_631);

const streaming = instance(25);
const cached = calculateIndicatorSeries(streaming, loaded, theme, context)[0].data;
assert.strictEqual(calculateIndicatorSeries(streaming, loaded, theme, context)[0].data, cached);
const correction = loaded.slice();
const oldBar = correction[correction.length - 101];
correction[correction.length - 101] = { ...oldBar, high: oldBar.high + 500 };
const corrected = calculateIndicatorSeries(streaming, correction, theme, context)[0].data;
assert.deepEqual(corrected, expectedAroon(correction, 25));
assert.notDeepEqual(corrected, cached);
assert.deepEqual(corrected.at(-1), cached.at(-1));
const shortened = correction.slice(0, 12_000);
assert.deepEqual(calculateIndicatorSeries(streaming, shortened, theme, context)[0].data, expectedAroon(shortened, 25));
const appended = [...shortened, correction[12_000]];
assert.deepEqual(calculateIndicatorSeries(streaming, appended, theme, context)[0].data, expectedAroon(appended, 25));

console.log("Aroon Oscillator history, rolling extremes, five lookbacks, causal replay and forming candle checks passed.");

const removed = { ...instance(25), indicatorId: "aroon-up-down" };
assert.deepEqual(calculateIndicatorSeries(removed, loaded, theme, context), []);
assert.deepEqual(normalizeStoredIndicatorList([removed, instance(14)]).map(entry => entry.indicatorId), ["aroon-oscillator"]);
