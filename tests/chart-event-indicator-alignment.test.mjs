import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";

const chart = await fs.readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const engine = await fs.readFile(new URL("../src/lib/chartIndicatorEngine.ts", import.meta.url), "utf8");

test("event-bar pane indicators resolve through the price chart's synthetic time map", () => {
  assert.match(
    chart,
    /const indicatorTimeToX = useCallback\([\s\S]*?Math\.round\(time \* 1_000\)[\s\S]*?eventChartTimeBySourceTimeRef\.current\.get\(sourceTimestamp\)[\s\S]*?eventChartTime \?\? time/,
  );
  assert.match(chart, /<ChartIndicatorPanes[\s\S]*?timeToX=\{indicatorTimeToX\}/);
});

test("Delta Bar uses executed sides and validated intrabar extrema at the host candle time", () => {
  const timestamp = 1793865600123;
  const candle = { timestamp, open: 100, high: 101, low: 99, close: 100, volume: 55,
    askVolume: 35, bidVolume: 20, delta: 999, deltaOpen: 100, deltaHigh: 127, deltaLow: 89, deltaClose: 115 };
  const theme = { primary: "#fff", secondary: "#aaa", positive: "#0f0", negative: "#f00", muted: "#888" };
  const series = (settings = {}, bars = [candle]) => calculateIndicatorSeries(
    { indicatorId: "delta-bar", instanceId: "delta", enabled: true, settings }, bars, theme,
  )[0];
  assert.equal(series().kind, "candlestick");
  assert.equal(series().includeZeroInScale, true);
  assert.deepEqual(series().data[0], {
    time: timestamp / 1000, value: 15, open: 0, close: 15, high: 27, low: -11, color: "#0f0",
  });
  assert.equal(series({ candleStyle: "ohlc", lineWidth: 3 }).candleStyle, "ohlc");
  assert.equal(series({ lineWidth: 3 }).lineWidth, 3);
  const [body] = series({ candleStyle: "candle-body" }).data;
  assert.deepEqual([body.high, body.low], [15, 0]);
  const [invalid] = series({}, [{ ...candle, deltaHigh: 999, deltaLow: -999 }]).data;
  assert.deepEqual([invalid.high, invalid.low], [15, 0]);
  assert.equal(series({}, [{ ...candle, askVolume: undefined }]), undefined);
  const sell = { ...candle, askVolume: 20, bidVolume: 35 };
  assert.equal(series({ filterMinDelta: 15, filterMaxDelta: 15 }, [sell]).data[0].color, "#f00");
  assert.equal(series({ filterMinDelta: 16 }).data.length, 0);
  assert.equal(series({ filterMaxDelta: 14 }).data.length, 0);
  assert.equal(series({ useThemeColors: false, plotUpColor: "#008844" }).data[0].color, "#008844");
});

test("the standard CVD pane uses its full user-facing name", () => {
  const [series] = calculateIndicatorSeries({ indicatorId: "cumulative-volume-delta", instanceId: "cvd", enabled: true, settings: {} },
    [{ timestamp: 1793865600000, open: 100, high: 101, low: 99, close: 100, volume: 10, askVolume: 7, bidVolume: 3 }],
    { primary: "#fff", secondary: "#aaa", positive: "#0f0", negative: "#f00", muted: "#888" });
  assert.equal(series.label, "Cumulative Volume Delta");
  assert.match(chart, /title: instance\.indicatorId === "delta-bar" \? "Delta Bar" : "Cumulative Volume Delta"/);
  assert.doesNotMatch(chart, /title: instance\.indicatorId === "delta-bar" \? "Delta"/);
});
