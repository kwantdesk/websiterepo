import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ChartIndicatorsControl from "../../src/components/ChartIndicatorsControl";
import { defaultChartSettings } from "../../src/lib/chartSettings";
import { defaultIndicatorSettings } from "../../src/lib/chartIndicatorConfig";
import { calculateIndicatorSeries } from "../../src/lib/chartIndicatorEngine";
import { createChart } from "../../src/lib/lightweightChartsCompat";
import actualOverlayOptions from "kwant-preview-overlay-options";

// Isolated, clearly labelled fixtures: never a market feed or production page.
const candles = Array.from({ length: 30 }, (_, i) => ({ timestamp: 1700000000000 + i * 60000, open: 100 + i / 40, close: 100.2 + i / 40, high: 100.5 + i / 40, low: 99.9 + i / 40, volume: 10 }));
const theme = { primary: "#11ff44", secondary: "#ffaa22", positive: "#44ff66", negative: "#ff7777", muted: "#bbbbbb" };
function Preview() {
  const host = useRef(null);
  const [indicators, setIndicators] = useState(() => JSON.parse(localStorage.getItem("qa-indicators") || "null") ?? [{ instanceId: "qa-absolute", indicatorId: "absolute-levels", enabled: true, settings: { ...defaultIndicatorSettings("absolute-levels"), firstValue: 100.25, secondValue: 101.5, firstLineStyle: "dashed", secondLineStyle: "dotted" } }]);
  const [request, setRequest] = useState(null);
  useEffect(() => { localStorage.setItem("qa-indicators", JSON.stringify(indicators)); }, [indicators]);
  useEffect(() => {
    const chart = createChart(host.current, { width: 1000, height: 440, layout: { background: { color: "#080b10" }, textColor: "#dddddd" } });
    chart.addCandlestickSeries().setData(candles.map(c => ({ time: c.timestamp / 1000, open: c.open, high: c.high, low: c.low, close: c.close })));
    for (const instance of indicators) for (const definition of calculateIndicatorSeries(instance, candles, theme)) {
      chart.addLineSeries(actualOverlayOptions(definition)).setData(definition.data);
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [indicators]);
  return <main style={{ padding: 24 }}>
    <h1>Indicator QA — SYNTHETIC TEST DATA — no trading connection</h1>
    <button onClick={() => setRequest({ instanceId: "qa-absolute", requestId: Date.now() })}>Open Absolute Levels settings</button>
    <ChartIndicatorsControl chartInstanceId="qa" instrument="NQ" broker="Rithmic" timeframe="1m" chartSettings={defaultChartSettings} indicators={indicators} onChange={setIndicators} settingsOpenRequest={request}/>
    <div ref={host}/>
    <pre aria-label="QA current settings">{JSON.stringify(indicators, null, 2)}</pre>
  </main>;
}
createRoot(document.getElementById("root")).render(<Preview/>);
