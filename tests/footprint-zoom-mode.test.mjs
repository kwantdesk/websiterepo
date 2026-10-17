import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const presentation = chart.slice(chart.indexOf("const footprintPresentationScopeRef"), chart.indexOf("const ivRankSubscriptions"));

test("Footprint selection, not zoom-dependent execution coverage, owns native candle visibility", () => {
  assert.match(presentation, /const replaceCandles = Boolean\(footprintIndicator\) \|\| !candlesVisible/);
  assert.doesNotMatch(presentation, /footprintHasPriceLevelFlow/);
  assert.match(presentation, /const stableFootprintBars = footprintIndicator && liveFootprintRenderBars.length/);
  assert.match(presentation, /footprintPresentationScopeRef.current === presentationScope/);
  assert.match(presentation, /footprintDataKey/);
  assert.match(presentation, /contractSymbol/);
});

test("first paint cannot briefly expose native candles underneath Footprint", () => {
  const start = chart.indexOf("const candleSeries = chart.addCandlestickSeries(");
  const initialization = chart.slice(start, chart.indexOf("candleSeriesRef.current = candleSeries", start));
  assert.match(initialization, /footprintIndicator \|\| !candlesVisible/);
  for (const colour of ["upColor", "downColor", "borderUpColor", "borderDownColor", "wickUpColor", "wickDownColor"]) {
    assert.match(initialization, new RegExp(`${colour}: "rgba\\(0,0,0,0\\)"`));
  }
});
