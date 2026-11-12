import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { replayIndicatorCandles } from "../src/lib/replayChartHistory.ts";

const theme = { primary: "#ffffff", secondary: "#aaaaaa", positive: "#00ff00", negative: "#ff0000", muted: "#888888" };
const context = { instrument: "NQ", tickSize: 0.25 };
const candles = Array.from({ length: 2_400 }, (_, index) => ({
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
const deepHistory = /const DEEP_HISTORY_INDICATOR_IDS = new Set\(\[([\s\S]*?)\]\)/.exec(source)?.[1] ?? "";
assert.match(deepHistory, /"aroon-oscillator"/);
assert.doesNotMatch(deepHistory, /"aroon-up-down"/);
const historyLimit = Number(/const DEEP_HISTORY_INDICATOR_MAX_BARS = ([\d_]+)/.exec(source)?.[1].replaceAll("_", ""));
const loaded = replayIndicatorCandles(candles, historyLimit, null);
assert.equal(loaded.length, candles.length);

function expectedAroon(bars, length) {
  return bars.slice(length).map((candle, offset) => {
    const end = offset + length;
    let high = offset;
    let low = offset;
    for (let index = offset + 1; index <= end; index += 1) {
      if (bars[index].high >= bars[high].high) high = index;
      if (bars[index].low <= bars[low].low) low = index;
    }
    return { time: candle.timestamp / 1_000, value: ((high - offset) / length) * 100 - ((low - offset) / length) * 100 };
  });
}

const cutoff = candles[1_100].timestamp;
for (const length of [2, 14, 25, 100, 500]) {
  const [result] = calculateIndicatorSeries(instance(length), loaded, theme, context);
  assert.deepEqual(result.data, expectedAroon(loaded, length));
  const [replay] = calculateIndicatorSeries(instance(length), loaded, theme, { ...context, replayTimestampMs: cutoff });
  assert.deepEqual(replay.data, result.data.filter(point => point.time <= cutoff / 1_000));
}
const [base] = calculateIndicatorSeries(instance(25), loaded, theme, context);
const changed = loaded.slice();
changed[changed.length - 1] = { ...changed.at(-1), high: 20_100, low: 19_900 };
const [live] = calculateIndicatorSeries(instance(25), changed, theme, context);
assert.deepEqual(live.data.slice(0, -1), base.data.slice(0, -1));
assert.notEqual(live.data.at(-1).value, base.data.at(-1).value);
assert.equal(base.data.length, 2_375);

console.log("Aroon Oscillator history, rolling extremes, five lookbacks, causal replay and forming candle checks passed.");
