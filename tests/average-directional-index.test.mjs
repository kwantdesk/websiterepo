import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateAverageDirectionalIndex } from "../src/lib/averageDirectionalIndex.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
const theme = { primary: "#11ff44", secondary: "#ffaa22", positive: "#44ff66", negative: "#ff7777", muted: "#bbbbbb" };
const bar = (i, high, low, close) => ({ timestamp: 1700000000000 + i * 60000, open: close, high, low, close });
const up = count => Array.from({ length: count }, (_, i) => bar(i, 102 + i, 100 + i, 101 + i));
const find = (series, label) => series.find(s => s.label === label)?.data ?? [];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const instance = settings => ({ instanceId: "adx-1", indicatorId: "average-directional-index-adx", enabled: true, settings: { ...defaultIndicatorSettings("average-directional-index-adx"), ...settings } });

test("full Wilder seeds: DI needs period changes, ADX needs period DX observations", () => {
  assert.equal(find(calculateAverageDirectionalIndex(up(14), {}, theme), "+DI").length, 0);
  assert.equal(find(calculateAverageDirectionalIndex(up(15), {}, theme), "+DI").length, 1);
  assert.equal(find(calculateAverageDirectionalIndex(up(27), {}, theme), "ADX").length, 0);
  const result = calculateAverageDirectionalIndex(up(28), {}, theme);
  assert.equal(find(result, "ADX").length, 1);
  near(find(result, "ADX")[0].value, 100);
  near(find(result, "+DI")[0].value, 50);
  near(find(result, "−DI")[0].value, 0);
});

test("hand-calculated mixed direction fixture includes true range and Wilder smoothing", () => {
  const candles = [[10, 8, 9], [12, 9, 11], [13, 10, 12], [12, 9, 10], [14, 10, 13], [13, 8, 9]].map((v, i) => bar(i, ...v));
  const result = calculateAverageDirectionalIndex(candles, { period: 3 }, theme);
  near(find(result, "+DI")[0].value, 100 / 3);
  near(find(result, "−DI")[0].value, 100 / 9);
  near(find(result, "ADX")[0].value, (50 + 500 / 7 + 100 / 23) / 3);
});

test("flat prices and equally expanding outside bars do not manufacture direction", () => {
  const flat = Array.from({ length: 40 }, (_, i) => bar(i, 100, 100, 100));
  assert.ok(calculateAverageDirectionalIndex(flat, {}, theme).every(s => s.data.every(p => p.value === 0)));
  const equal = Array.from({ length: 40 }, (_, i) => bar(i, 100 + i, 100 - i, 100));
  assert.ok(calculateAverageDirectionalIndex(equal, {}, theme).every(s => s.data.every(p => p.value === 0)));
});

test("invalid bars reset warmup and break plots; closed-session time gaps do not invent bars", () => {
  const candles = up(100);
  candles[40] = { ...candles[40], close: NaN };
  const data = find(calculateAverageDirectionalIndex(candles, { period: 3 }, theme), "ADX");
  assert.ok(data.find(p => p.time === candles[46].timestamp / 1000)?.breakBefore);
  assert.ok(!data.some(p => p.time >= candles[40].timestamp / 1000 && p.time < candles[46].timestamp / 1000));
  const gapped = up(35).map((c, i) => ({ ...c, timestamp: c.timestamp + (i >= 20 ? 3 * 86400000 : 0) }));
  assert.equal(find(calculateAverageDirectionalIndex(gapped, {}, theme), "ADX").length, 8);
});

test("event timestamps, settings, colors and saved instances retain their meanings", () => {
  const candles = up(35).map((c, i) => ({ ...c, timestamp: 1700000000000 + i }));
  const config = instance({ lineWidth: 3, lineStyle: "dashed", useThemeColors: false, adxColor: "#123456", plusDiColor: "#abcdef", minusDiColor: "#fedcba" });
  const result = calculateIndicatorSeries(config, candles, theme);
  assert.deepEqual(result.map(s => s.color), ["#123456", "#abcdef", "#fedcba"]);
  assert.ok(result.every(s => s.placement === "pane" && s.lineWidth === 3 && s.lineStyle === "dashed"));
  assert.equal(find(result, "ADX")[0].time, candles[27].timestamp / 1000);
  const saved = normalizePaneIndicatorState({ pane: [JSON.parse(JSON.stringify(config))] });
  assert.deepEqual(saved.pane[0].settings, config.settings);
  assert.equal(calculateIndicatorSeries(instance({ showPlusDi: false, showMinusDi: false }), candles, theme).length, 1);
  assert.equal(calculateIndicatorSeries({ ...config, enabled: false }, candles, theme).length, 0);
});

test("period changes recalculate and registration reaches the actual engine", () => {
  assert.equal(find(calculateAverageDirectionalIndex(up(10), { period: 3 }, theme), "ADX").length, 5);
  assert.equal(find(calculateAverageDirectionalIndex(up(10), { period: 5 }, theme), "ADX").length, 1);
  assert.equal(auditIndicatorLibrary().pending.some(row => row.id === "average-directional-index-adx"), false);
});

test("a forming candle changes only its own output and theme changes retain explicit ownership", () => {
  const candles = up(40);
  const config = instance({});
  const original = calculateIndicatorSeries(config, candles, theme);
  const moved = candles.map((c, i) => i === 39 ? { ...c, high: c.high + 3, close: c.close + 2 } : c);
  const changed = calculateIndicatorSeries(config, moved, theme);
  assert.deepEqual(find(original, "ADX").slice(0, -1), find(changed, "ADX").slice(0, -1));
  assert.notEqual(find(original, "+DI").at(-1).value, find(changed, "+DI").at(-1).value);
  const recolored = calculateIndicatorSeries(config, candles, { ...theme, primary: "#ff00ff", positive: "#00ffff" });
  assert.equal(recolored[0].color, "#ff00ff");
  assert.equal(recolored[1].color, "#00ffff");
});

test("out-of-order input cannot produce invalid chart ordering or duplicate plotted times", () => {
  const candles = up(90);
  candles[30] = { ...candles[30], timestamp: candles[10].timestamp };
  const result = calculateAverageDirectionalIndex(candles, { period: 3 }, theme);
  for (const series of result) for (let i = 1; i < series.data.length; i++) assert.ok(series.data[i].time > series.data[i - 1].time);
});
