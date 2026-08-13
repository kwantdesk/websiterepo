"use client";

import { createChart, type IChartApi, type ISeriesApi, type Time } from "@/lib/lightweightChartsCompat";
import { useEffect, useRef, useState } from "react";

type Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export default function ReasoningOutcomeChart({
  instrument,
  lockedAt,
  entryLow,
  entryHigh,
  stop,
  targets,
  height = 170,
}: {
  instrument: string;
  lockedAt: string;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: number[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const targetsKey = targets.join(",");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const styles = getComputedStyle(document.documentElement);
    const foreground = styles.getPropertyValue("--foreground").trim() || "#f4f4f4";
    const muted = styles.getPropertyValue("--muted").trim() || "#777";
    const border = styles.getPropertyValue("--border").trim() || "#222";
    const primary = styles.getPropertyValue("--primary").trim() || "#d6ad55";
    const danger = styles.getPropertyValue("--danger").trim() || "#ff586d";
    const accent = styles.getPropertyValue("--accent").trim() || "#65d69a";
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: { background: { color: "transparent" }, textColor: muted, fontSize: 9, attributionLogo: false },
      grid: { vertLines: { color: border }, horzLines: { color: border } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: primary, labelBackgroundColor: primary },
        horzLine: { color: primary, labelBackgroundColor: primary },
      },
      handleScroll: true,
      handleScale: true,
    });
    const series = chart.addCandlestickSeries({
      upColor: accent,
      downColor: foreground,
      borderUpColor: accent,
      borderDownColor: foreground,
      wickUpColor: accent,
      wickDownColor: foreground,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    if (entryLow !== null) series.createPriceLine({ price: entryLow, color: primary, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "ENTRY" });
    if (entryHigh !== null && entryHigh !== entryLow) series.createPriceLine({ price: entryHigh, color: primary, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });
    if (stop !== null) series.createPriceLine({ price: stop, color: danger, lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: "STOP" });
    targetsKey.split(",").map(Number).filter(Number.isFinite).slice(0, 5).forEach((target, index) => series.createPriceLine({ price: target, color: accent, lineWidth: 1, lineStyle: 2, axisLabelVisible: index === 0, title: `TP${index + 1}` }));
    const resize = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth, height }));
    resize.observe(container);
    return () => {
      resize.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [entryHigh, entryLow, height, stop, targetsKey]);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    const root = instrument.toUpperCase().includes("NQ") ? "NQ" : "ES";
    void (async () => {
      try {
        const response = await fetch(`/api/databento/market?symbol=${root}.v.0&timeframe=5m&days=5`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json() as { candles?: Candle[] };
        if (!response.ok || !Array.isArray(body.candles)) throw new Error("History unavailable");
        const lockTime = Date.parse(lockedAt);
        const start = lockTime - 6 * 60 * 60_000;
        const end = Math.max(Date.now(), lockTime + 18 * 60 * 60_000);
        const candles = body.candles
          .filter((candle) => candle.timestamp >= start && candle.timestamp <= end)
          .slice(-420)
          .map((candle) => ({
            time: Math.floor(candle.timestamp / 1_000) as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
        if (!candles.length) throw new Error("No candles");
        seriesRef.current?.setData(candles);
        chartRef.current?.timeScale().fitContent();
        setState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      }
    })();
    return () => controller.abort();
  }, [instrument, lockedAt]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-background/45" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {state !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
          {state === "loading" ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /> : <span className="text-[7px] text-muted">Chart evidence is loading</span>}
        </div>
      ) : null}
      <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-border bg-background/80 px-2 py-1 text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">1 day path · scroll to zoom</div>
    </div>
  );
}
