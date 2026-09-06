import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ChartIndicatorsControl from "../../src/components/ChartIndicatorsControl";
import ChartIndicatorPanes from "../../src/components/ChartIndicatorPanes";
import { defaultChartSettings } from "../../src/lib/chartSettings";
import { defaultIndicatorSettings } from "../../src/lib/chartIndicatorConfig";
import { calculateIndicatorSeries } from "../../src/lib/chartIndicatorEngine";
import { createChart } from "../../src/lib/lightweightChartsCompat";
import { SuperTrendLabels } from "../../src/lib/superTrendLabels";
import { PivotPointLabels } from "../../src/lib/pivotPointLabels";
import { GapZonePrimitive } from "../../src/lib/gapZonePrimitive";
import { ZigZagRetracementPrimitive } from "../../src/lib/zigZagRetracementPrimitive";
import { IchimokuCloudPrimitive } from "../../src/lib/ichimokuCloudPrimitive";
import { SwingPointLevelPrimitive } from "../../src/lib/swingPointLevelPrimitive";
import { TextOnChartPrimitive } from "../../src/lib/textOnChartPrimitive";
import { useSuperTrendAlerts } from "../../src/components/useSuperTrendAlerts";
import { paintSuperTrendSeries } from "../../src/lib/superTrendSeries";
import { LIVE_CHART_CANDLE_EVENT } from "../../src/lib/chartLiveEvents";
import { SUPER_TREND_LIVE_PLOT_EVENT, SuperTrendPlotBuffer } from "../../src/lib/superTrendLivePlot";
import actualOverlayOptions from "kwant-preview-overlay-options";

// Isolated, clearly labelled fixtures: never a market feed or production page.
const requestedPreview = new URLSearchParams(location.search).get("indicator");
const autoOpenSettings = new URLSearchParams(location.search).get("settings") === "1";
const previewId = requestedPreview === "fvg" ? "fvg-identifier" : requestedPreview === "text-on-chart" ? "text-on-chart" : requestedPreview === "swing-point" ? "swing-point" : requestedPreview === "regression-channel" ? "regression-channel" : requestedPreview === "ichimoku-indicator" ? "ichimoku-indicator" : requestedPreview === "inverse-cyber-cycle" ? "inverse-cyber-cycle" : requestedPreview === "zigzag" ? "zig-zag" : requestedPreview === "gap" ? "gap-detector" : requestedPreview === "pivot" ? "pivot-points" : requestedPreview === "supertrend" ? "super-trend" : requestedPreview === "supertrend-difference" ? "super-trend-difference" : requestedPreview === "kst" ? "know-sure-thing-kst" : requestedPreview === "t3" ? "tillson-t3" : requestedPreview === "regression" ? "linear-regression" : requestedPreview === "sar" ? "parabolic-sar" : requestedPreview === "adx" ? "average-directional-index-adx" : "absolute-levels";
const previewName = previewId === "fvg-identifier" ? "FVG Identifier" : previewId === "text-on-chart" ? "Text on Chart" : previewId === "swing-point" ? "Swing Point" : previewId === "regression-channel" ? "Regression Channel" : previewId === "ichimoku-indicator" ? "Ichimoku Indicator" : previewId === "inverse-cyber-cycle" ? "Inverse Cyber Cycle" : previewId === "zig-zag" ? "Zig Zag" : previewId === "gap-detector" ? "Gap Detector" : previewId === "pivot-points" ? "Pivot Points" : previewId === "super-trend" ? "Super Trend" : previewId === "super-trend-difference" ? "Super Trend Difference" : previewId === "know-sure-thing-kst" ? "Know Sure Thing" : previewId === "tillson-t3" ? "Tillson T3" : previewId === "linear-regression" ? "Linear Regression" : previewId === "absolute-levels" ? "Absolute Levels" : previewId === "parabolic-sar" ? "Parabolic SAR" : "ADX";
const storageKey = `qa-indicators-${previewId}`;
const candles = Array.from({ length: previewId === "absolute-levels" ? 30 : previewId === "pivot-points" ? 96 : 100 }, (_, i) => {
  const gapStep = previewId === "gap-detector" || previewId === "fvg-identifier" ? (Math.floor(i / 18) % 2) * 3 : 0;
  const close = previewId === "absolute-levels" ? 100.2 + i / 40 : 100 + Math.sin(i / 8) * 2 + i / 40 + gapStep;
  return { timestamp: 1700000000000 + i * (previewId === "pivot-points" ? 3600000 : 60000), open: close - 0.2, close, high: close + 0.3, low: close - 0.4, volume: 10 };
});
const theme = { primary: "#11ff44", secondary: "#ffaa22", positive: "#44ff66", negative: "#ff7777", muted: "#bbbbbb" };
function Preview() {
  const host = useRef(null);
  const livePlots = useRef(new Map());
  const liveCandle = useRef(null);
  const liveStatus = useRef(null);
  const syntheticDirection = useRef(1);
  const [indicators, setIndicators] = useState(() => JSON.parse(localStorage.getItem(storageKey) || "null") ?? [{ instanceId: "qa-study", indicatorId: previewId, enabled: true, settings: { ...defaultIndicatorSettings(previewId), ...(previewId === "text-on-chart" ? { text: "Plan the trade. Trade the plan." } : {}), ...(previewId === "absolute-levels" ? { firstValue: 100.25, secondValue: 101.5, firstLineStyle: "dashed", secondLineStyle: "dotted" } : {}), ...(previewId === "gap-detector" ? { gapMode: "always", tickValue: 4 } : {}) } }]);
  const [request, setRequest] = useState(() => autoOpenSettings ? { instanceId: "qa-study", requestId: Date.now() } : null);
  const [paneLayout, setPaneLayout] = useState({});
  const alert = useSuperTrendAlerts({ indicators, history: candles, liveKey: "qa-synthetic", instrument: "NQ", timeframe: "1m", live: true,
    onReset: instanceId => {
      window.dispatchEvent(new CustomEvent(SUPER_TREND_LIVE_PLOT_EVENT, { detail: { chartKey: "qa-synthetic", instanceId, reset: true } }));
    },
    onPoint: (instanceId, point, previous, settings, difference) => {
      const [painted] = paintSuperTrendSeries([point], settings, theme, instanceId, difference,
        previous ? difference ? previous.difference : previous.value : undefined);
      if (!painted) return;
      if (painted.placement === "pane") window.dispatchEvent(new CustomEvent(SUPER_TREND_LIVE_PLOT_EVENT, {
        detail: { chartKey: "qa-synthetic", instanceId, series: painted },
      }));
      else {
        const target = livePlots.current.get(painted.key);
        if (target) {
          target.plot.update(painted.data[0]); target.buffer.push(painted);
          const merged = target.buffer.merge(target.definition);
          target.labels?.update(merged.data, merged.superTrendLabels, "#080b10", merged.color, 2);
        }
      }
      if (liveStatus.current) liveStatus.current.textContent = `Synthetic live ${difference ? "difference" : "trend"}: ${painted.data[0].value.toFixed(4)}`;
    } });
  const sendSyntheticTick = () => {
    const last = candles.at(-1), close = last.close + 12 * syntheticDirection.current;
    syntheticDirection.current *= -1;
    const candle = { ...last, close, high: Math.max(last.high, close), low: Math.min(last.low, close) };
    liveCandle.current?.update({ time: candle.timestamp / 1000, open: candle.open, close, high: candle.high, low: candle.low });
    window.dispatchEvent(new CustomEvent(LIVE_CHART_CANDLE_EVENT, { detail: {
      key: "qa-synthetic", candle, sourceTimestampMs: Date.now(),
    } }));
  };
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(indicators)); }, [indicators]);
  useEffect(() => {
    const chart = createChart(host.current, { width: 1000, height: 440, layout: { background: { color: "#080b10" }, textColor: "#dddddd" } });
    liveCandle.current = chart.addCandlestickSeries();
    liveCandle.current.setData(candles.map(c => ({ time: c.timestamp / 1000, open: c.open, high: c.high, low: c.low, close: c.close })));
    livePlots.current.clear();
    for (const instance of indicators) for (const definition of calculateIndicatorSeries(instance, candles, theme)) {
      if (definition.placement === "overlay") {
        const plot = chart.addLineSeries(actualOverlayOptions(definition)); plot.setData(definition.data);
        let labels;
        if (definition.superTrendLabels) {
          labels = new SuperTrendLabels(); plot.attachPrimitive(labels);
          labels.update(definition.data, definition.superTrendLabels, "#080b10", definition.color, 2);
        }
        if (definition.pivotLabels) {
          labels = new PivotPointLabels(); plot.attachPrimitive(labels);
          labels.update(definition.data, definition.pivotLabels, definition.color);
        }
        if (definition.gapZones) {
          labels = new GapZonePrimitive(); plot.attachPrimitive(labels);
          labels.update(definition.gapZones, definition.color);
        }
        if (definition.zigZagRetracements) {
          labels = new ZigZagRetracementPrimitive(); plot.attachPrimitive(labels);
          labels.update(definition.zigZagRetracements);
        }
        if (definition.ichimokuCloud) {
          labels = new IchimokuCloudPrimitive(); plot.attachPrimitive(labels);
          labels.update(definition.ichimokuCloud);
        }
        if (definition.swingPointLevels) {
          labels = new SwingPointLevelPrimitive(); plot.attachPrimitive(labels);
          labels.update(definition.data, definition.swingPointLevels);
        }
        if (definition.textOnChart) {
          labels = new TextOnChartPrimitive(); plot.attachPrimitive(labels);
          labels.update(definition.textOnChart);
        }
        livePlots.current.set(definition.key, { plot, labels, definition, buffer: new SuperTrendPlotBuffer() });
      }
    }
    chart.timeScale().fitContent();
    return () => { chart.remove(); livePlots.current.clear(); liveCandle.current = null; };
  }, [indicators]);
  return <main style={{ padding: 24 }}>
    <h1>Indicator QA — SYNTHETIC TEST DATA — no trading connection</h1>
    <button onClick={() => setRequest({ instanceId: "qa-study", requestId: Date.now() })}>Open {previewName} settings</button>
    {["super-trend", "super-trend-difference"].includes(previewId) ? <div>
      <button onClick={sendSyntheticTick}>QA synthetic live reversal</button>
      <output ref={liveStatus}>No synthetic live tick sent</output>
      {alert ? <div role="status">{alert}</div> : null}
      {["bottom", "right", "left", "top"].map(dock => <button key={dock}
        onClick={() => setPaneLayout({ "qa-study": { dock, order: 0 } })}>QA dock {dock}</button>)}
    </div> : null}
    <ChartIndicatorsControl chartInstanceId="qa" instrument="NQ" broker="Rithmic" timeframe="1m" chartSettings={defaultChartSettings} indicators={indicators} onChange={setIndicators} settingsOpenRequest={request}/>
    <div ref={host}/>
    {["average-directional-index-adx", "inverse-cyber-cycle", "know-sure-thing-kst", "super-trend-difference", "super-trend"].includes(previewId) ? <div style={{ position: "relative", width: 1000, height: 260 }}>
      <ChartIndicatorPanes groups={indicators.map(instance => ({ key: instance.instanceId, indicatorId: instance.indicatorId, title: previewName, settings: instance.settings, showLegend: previewId === "know-sure-thing-kst" ? false : undefined, series: calculateIndicatorSeries(instance, candles, theme).filter(series => series.placement === "pane") })).filter(group => group.series.length)}
        liveChartKey="qa-synthetic" width={1000} priceScaleWidth={65} height={260} chartHeight={260} bottom={0} viewportVersion={0}
        paneHeights={{}} collapsedPanes={{}} paneLayout={paneLayout} timeToX={time => (time - candles[0].timestamp / 1000) / (99 * 60) * 935}
        onResizePane={() => {}} onTogglePane={() => {}} onMovePane={(id, dock, order) => setPaneLayout(current => ({ ...current, [id]: { dock, order } }))}
        onOpenSettings={instanceId => setRequest({ instanceId, requestId: Date.now() })}/>
    </div> : null}
    <pre aria-label="QA current settings">{JSON.stringify(indicators, null, 2)}</pre>
  </main>;
}
createRoot(document.getElementById("root")).render(<Preview/>);
