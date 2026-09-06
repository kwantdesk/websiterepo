import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ChartIndicatorsControl from "../../src/components/ChartIndicatorsControl";
import ChartIndicatorPanes from "../../src/components/ChartIndicatorPanes";
import { defaultChartSettings } from "../../src/lib/chartSettings";
import { defaultIndicatorSettings } from "../../src/lib/chartIndicatorConfig";
import { calculateIndicatorSeries } from "../../src/lib/chartIndicatorEngine";
import { createChart } from "../../src/lib/lightweightChartsCompat";
import actualOverlayOptions from "kwant-preview-overlay-options";

// Isolated, clearly labelled fixtures: never a market feed or production page.
const requestedPreview = new URLSearchParams(location.search).get("indicator");
const previewId = requestedPreview === "kst" ? "know-sure-thing-kst" : requestedPreview === "t3" ? "tillson-t3" : requestedPreview === "regression" ? "linear-regression" : requestedPreview === "sar" ? "parabolic-sar" : requestedPreview === "adx" ? "average-directional-index-adx" : "absolute-levels";
const previewName = previewId === "know-sure-thing-kst" ? "Know Sure Thing" : previewId === "tillson-t3" ? "Tillson T3" : previewId === "linear-regression" ? "Linear Regression" : previewId === "absolute-levels" ? "Absolute Levels" : previewId === "parabolic-sar" ? "Parabolic SAR" : "ADX";
const storageKey = `qa-indicators-${previewId}`;
const candles = Array.from({ length: previewId === "absolute-levels" ? 30 : 100 }, (_, i) => {
  const close = previewId === "absolute-levels" ? 100.2 + i / 40 : 100 + Math.sin(i / 8) * 2 + i / 40;
  return { timestamp: 1700000000000 + i * 60000, open: close - 0.2, close, high: close + 0.3, low: close - 0.4, volume: 10 };
});
const theme = { primary: "#11ff44", secondary: "#ffaa22", positive: "#44ff66", negative: "#ff7777", muted: "#bbbbbb" };
function Preview() {
  const host = useRef(null);
  const [indicators, setIndicators] = useState(() => JSON.parse(localStorage.getItem(storageKey) || "null") ?? [{ instanceId: "qa-study", indicatorId: previewId, enabled: true, settings: { ...defaultIndicatorSettings(previewId), ...(previewId === "absolute-levels" ? { firstValue: 100.25, secondValue: 101.5, firstLineStyle: "dashed", secondLineStyle: "dotted" } : {}) } }]);
  const [request, setRequest] = useState(null);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(indicators)); }, [indicators]);
  useEffect(() => {
    const chart = createChart(host.current, { width: 1000, height: 440, layout: { background: { color: "#080b10" }, textColor: "#dddddd" } });
    chart.addCandlestickSeries().setData(candles.map(c => ({ time: c.timestamp / 1000, open: c.open, high: c.high, low: c.low, close: c.close })));
    for (const instance of indicators) for (const definition of calculateIndicatorSeries(instance, candles, theme)) {
      if (definition.placement === "overlay") chart.addLineSeries(actualOverlayOptions(definition)).setData(definition.data);
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [indicators]);
  return <main style={{ padding: 24 }}>
    <h1>Indicator QA — SYNTHETIC TEST DATA — no trading connection</h1>
    <button onClick={() => setRequest({ instanceId: "qa-study", requestId: Date.now() })}>Open {previewName} settings</button>
    <ChartIndicatorsControl chartInstanceId="qa" instrument="NQ" broker="Rithmic" timeframe="1m" chartSettings={defaultChartSettings} indicators={indicators} onChange={setIndicators} settingsOpenRequest={request}/>
    <div ref={host}/>
    {["average-directional-index-adx", "know-sure-thing-kst"].includes(previewId) ? <div style={{ position: "relative", width: 1000, height: 260 }}>
      <ChartIndicatorPanes groups={indicators.map(instance => ({ key: instance.instanceId, indicatorId: instance.indicatorId, title: previewName, settings: instance.settings, showLegend: previewId === "know-sure-thing-kst" ? false : undefined, series: calculateIndicatorSeries(instance, candles, theme) }))}
        width={1000} priceScaleWidth={65} height={260} chartHeight={260} bottom={0} viewportVersion={0}
        paneHeights={{}} collapsedPanes={{}} paneLayout={{}} timeToX={time => (time - candles[0].timestamp / 1000) / (99 * 60) * 935}
        onResizePane={() => {}} onTogglePane={() => {}} onMovePane={() => {}}
        onOpenSettings={instanceId => setRequest({ instanceId, requestId: Date.now() })}/>
    </div> : null}
    <pre aria-label="QA current settings">{JSON.stringify(indicators, null, 2)}</pre>
  </main>;
}
createRoot(document.getElementById("root")).render(<Preview/>);
