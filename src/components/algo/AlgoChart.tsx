"use client";

import { useEffect, useMemo, useRef } from "react";
import { CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers, type UTCTimestamp, type SeriesMarker, type Time } from "lightweight-charts";
import { createChart, type IChartApi } from "@/lib/lightweightChartsCompat";
import { CHART_SETTINGS_CHANGE_EVENT, chartSettingsFromChangeEvent } from "@/lib/chartSettings";
import { legibleOn } from "@/lib/readableContrast";
import { aggregateAlgoCandles, ALGO_INSTRUMENTS, ALGO_TEMPLATES, type AlgoInterval, type AlgoRun } from "@/lib/algoWorkspace";

export default function AlgoChart({ run, interval, chartType, showTrades, selectedTrade, fitRevision }: {
  run: AlgoRun; interval: AlgoInterval; chartType: "candles" | "line"; showTrades: boolean;
  selectedTrade: string | null; fitRevision: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const bars = useMemo(() => aggregateAlgoCandles(run.candles, interval), [run.candles, interval]);
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const chart = createChart(element, {
      autoSize: true,
      layout: { background: { color: "#000000" }, textColor: "#aaaaaa", fontFamily: "Aleph, sans-serif", fontSize: 11, attributionLogo: false },
      timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false, rightOffset: 8 },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: .14, bottom: .24 } },
      leftPriceScale: { visible: false },
      crosshair: { mode: 0 },
      handleScroll: true, handleScale: true,
    });
    chartRef.current = chart;
    const instrument = ALGO_INSTRUMENTS[run.config.instrument];
    const dateTimeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: run.config.timeZone, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: run.config.timeZone, day: "2-digit", month: "short" });
    const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: run.config.timeZone, hour: "2-digit", minute: "2-digit" });
    const series = chart.addSeries(chartType === "candles" ? CandlestickSeries : LineSeries, {
      priceFormat: { type: "price", precision: instrument.tick < .25 ? 1 : 2, minMove: instrument.tick },
      priceLineVisible: false, lastValueVisible: true,
    });
    series.setData(bars.map((b) => ({ ...b, time: b.timestamp / 1000 as UTCTimestamp, value: b.close })));
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "volume", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    volume.priceScale().applyOptions({ scaleMargins: { top: .88, bottom: 0 } });
    volume.setData(bars.map((b) => ({ time: b.timestamp / 1000 as UTCTimestamp, value: b.volume, color: "rgba(127,127,127,0.2)" })));

    const bucket = (timestamp: number) => Math.floor(timestamp / (interval * 60000)) * interval * 60 as UTCTimestamp;
    const markers: SeriesMarker<Time>[] = showTrades ? run.trades.flatMap((trade) => {
      const long = trade.direction === "Long";
      const label = ALGO_TEMPLATES.find((a) => a.id === trade.algoId)?.short ?? "ALGO";
      return [
        { time: bucket(trade.entryTime), position: long ? "belowBar" as const : "aboveBar" as const,
          shape: long ? "arrowUp" as const : "arrowDown" as const, color: long ? "#22c55e" : "#ef4444",
          text: label + (long ? " L" : " S"), size: .7 },
        { time: bucket(trade.exitTime), position: long ? "aboveBar" as const : "belowBar" as const,
          shape: long ? "arrowDown" as const : "arrowUp" as const, color: trade.net >= 0 ? "#22c55e" : "#ef4444",
          text: trade.reason === "Session close" ? "EXIT" : trade.reason, size: .7 },
      ];
    }).sort((a, b) => Number(a.time) - Number(b.time)) : [];
    // Native marker margins grow with bar spacing and can consume a short
    // resized pane. Keep OHLC autoscaling independent of these annotations.
    const markerLayer = createSeriesMarkers(series, markers, { autoScale: false });
    const applyTheme = (event?: Event) => {
      const s = chartSettingsFromChangeEvent(event);
      const css = getComputedStyle(element);
      const foreground = css.getPropertyValue("--foreground").trim() || "#ffffff";
      const muted = css.getPropertyValue("--muted").trim() || foreground;
      chart.applyOptions({
        layout: { background: { color: s.backgroundColor }, textColor: legibleOn(muted, s.backgroundColor, 4.5) },
        grid: { vertLines: { visible: s.gridLines, color: s.gridColor }, horzLines: { visible: s.gridLines, color: s.gridColor } },
        localization: {
          timeFormatter: (time: number) => dateTimeFormat.format(time * 1000),
        },
        timeScale: {
          tickMarkFormatter: (time: number, type: number) => (type < 3 ? dateFormat : timeFormat).format(time * 1000),
        },
      });
      markerLayer.setMarkers(markers.map((marker) => ({ ...marker, color: legibleOn(marker.color, s.backgroundColor, 4.5) })));
      if (chartType === "candles") series.applyOptions({
        upColor: s.upColor, downColor: s.downColor, borderUpColor: s.borderUpColor, borderDownColor: s.borderDownColor,
        wickUpColor: s.wickUpColor, wickDownColor: s.wickDownColor,
      });
      else series.applyOptions({ color: s.upColor, lineWidth: 2 });
    };
    applyTheme();
    // The site theme event carries theme metadata, not ChartSettings.
    const onTheme = () => applyTheme();
    window.addEventListener(CHART_SETTINGS_CHANGE_EVENT, applyTheme);
    window.addEventListener("kwantdesk:theme-change", onTheme);
    const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
    const sessionBars = Math.ceil((minutes(run.config.sessionEnd) - minutes(run.config.sessionStart)) / interval);
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - sessionBars), to: bars.length + 6 });
    return () => {
      window.removeEventListener(CHART_SETTINGS_CHANGE_EVENT, applyTheme);
      window.removeEventListener("kwantdesk:theme-change", onTheme);
      markerLayer.detach(); chart.remove(); chartRef.current = null;
    };
  }, [bars, chartType, interval, run, showTrades]);
  useEffect(() => {
    const trade = run.trades.find((t) => t.id === selectedTrade);
    if (!trade) return;
    chartRef.current?.timeScale().setVisibleRange({
      from: (trade.entryTime - 35 * 60000) / 1000 as UTCTimestamp,
      to: (trade.exitTime + 35 * 60000) / 1000 as UTCTimestamp,
    });
  }, [selectedTrade, run, interval, chartType, showTrades]);
  useEffect(() => {
    if (fitRevision > 0) chartRef.current?.timeScale().fitContent();
  }, [fitRevision]);
  return <div className="algo-price-chart" ref={host} data-testid="algo-chart" aria-label="Interactive preview candlestick chart" />;
}
