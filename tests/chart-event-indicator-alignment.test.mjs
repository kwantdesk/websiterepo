import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const chart = await fs.readFile(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const engine = await fs.readFile(new URL("../src/lib/chartIndicatorEngine.ts", import.meta.url), "utf8");

test("event-bar pane indicators resolve through the price chart's synthetic time map", () => {
  assert.match(
    chart,
    /const indicatorTimeToX = useCallback\([\s\S]*?Math\.round\(time \* 1_000\)[\s\S]*?eventChartTimeBySourceTimeRef\.current\.get\(sourceTimestamp\)[\s\S]*?eventChartTime \?\? time/,
  );
  assert.match(chart, /<ChartIndicatorPanes[\s\S]*?timeToX=\{indicatorTimeToX\}/);
});

test("delta is calculated once for every verified chart candle", () => {
  assert.match(
    engine,
    /key === "delta-bar"[\s\S]*?candles\.filter\(hasVerifiedOrderFlow\)\.map\(\(candle\)/,
  );
  assert.match(engine, /const value = finite\(candle\.delta, finite\(candle\.askVolume\) - finite\(candle\.bidVolume\)\)/);
  assert.match(engine, /time: candle\.timestamp \/ 1000/);
});

test("the standard CVD pane uses its full user-facing name", () => {
  assert.match(engine, /: "Cumulative Volume Delta",/);
  assert.match(chart, /title: "Cumulative Volume Delta"/);
  assert.doesNotMatch(chart, /title: instance\.indicatorId === "delta-bar" \? "Delta"/);
});
