"use client";

import { createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SocialTradeSnapshot } from "@/lib/socials";

type Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const FUTURES_ROOTS = ["MNQ", "MES", "M2K", "MYM", "NQ", "ES", "RTY", "YM", "MCL", "CL", "MGC", "GC", "SIL", "SI", "NG", "HG", "ZB", "ZN", "ZF", "ZT", "6E", "6B", "6J", "6A", "6C"];

function continuousSymbol(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const root = FUTURES_ROOTS.find((candidate) => normalized.startsWith(candidate));
  return root ? `${root}.v.0` : "";
}

function nearestCandleTime(candles: Candle[], timestamp: number) {
  if (!candles.length) return null;
  return candles.reduce((best, candle) => Math.abs(candle.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? candle : best).timestamp;
}

export default function TradePostChart({ trade, height = 270 }: { trade: SocialTradeSnapshot; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const symbol = useMemo(() => continuousSymbol(trade.instrument), [trade.instrument]);

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
      layout: { background: { color: "transparent" }, textColor: muted, fontSize: 9 },
      grid: { vertLines: { color: border }, horzLines: { color: border } },
      rightPriceScale: { borderColor: border, minimumWidth: 68 },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: {
        vertLine: { color: primary, labelBackgroundColor: primary },
        horzLine: { color: primary, labelBackgroundColor: primary },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
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
    if (trade.entryPrice !== null) series.createPriceLine({ price: trade.entryPrice, color: primary, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "ENTRY" });
    if (trade.exitPrice !== null) series.createPriceLine({ price: trade.exitPrice, color: trade.netPnl >= 0 ? accent : danger, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "EXIT" });
    chartRef.current = chart;
    seriesRef.current = series;
    const resize = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth, height }));
    resize.observe(container);
    return () => {
      resize.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, trade.entryPrice, trade.exitPrice, trade.netPnl]);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    void (async () => {
      try {
        if (!symbol) throw new Error("Unsupported historical instrument");
        const openedAt = Date.parse(trade.openedAt);
        const closedAt = trade.closedAt ? Date.parse(trade.closedAt) : openedAt + 60 * 60_000;
        if (!Number.isFinite(openedAt) || !Number.isFinite(closedAt)) throw new Error("Invalid trade time");
        const start = new Date(openedAt - 60 * 60_000).toISOString();
        const end = new Date(Math.min(Date.now(), Math.max(openedAt, closedAt) + 60 * 60_000)).toISOString();
        const response = await fetch(`/api/backtesting/session?symbol=${encodeURIComponent(symbol)}&timeframe=1m&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
          cache: "force-cache",
          signal: controller.signal,
        });
        const body = await response.json() as { candles?: Candle[]; error?: string };
        if (!response.ok || !Array.isArray(body.candles) || !body.candles.length) throw new Error(body.error || "No historical bars");
        const candles = body.candles
          .filter((candle) => [candle.open, candle.high, candle.low, candle.close, candle.timestamp].every(Number.isFinite))
          .map((candle) => ({
            time: Math.floor(candle.timestamp / 1_000) as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
        if (!candles.length) throw new Error("No historical bars");
        seriesRef.current?.setData(candles);
        const entryTime = nearestCandleTime(body.candles, openedAt);
        const exitTime = nearestCandleTime(body.candles, closedAt);
        seriesRef.current?.setMarkers([
          ...(entryTime ? [{
            time: Math.floor(entryTime / 1_000) as Time,
            position: trade.side === "SHORT" ? "aboveBar" as const : "belowBar" as const,
            color: primaryColor(),
            shape: trade.side === "SHORT" ? "arrowDown" as const : "arrowUp" as const,
            text: "ENTRY",
          }] : []),
          ...(exitTime ? [{
            time: Math.floor(exitTime / 1_000) as Time,
            position: trade.side === "SHORT" ? "belowBar" as const : "aboveBar" as const,
            color: trade.netPnl >= 0 ? accentColor() : dangerColor(),
            shape: trade.side === "SHORT" ? "arrowUp" as const : "arrowDown" as const,
            text: "EXIT",
          }] : []),
        ]);
        chartRef.current?.timeScale().fitContent();
        setState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      }
    })();
    return () => controller.abort();
  }, [symbol, trade.closedAt, trade.netPnl, trade.openedAt, trade.side]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background/45" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {state !== "ready" ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/76 backdrop-blur-[2px]">{state === "loading" ? <div className="flex items-center gap-2 text-[8px] text-muted"><span className="h-4 w-4 animate-spin rounded-full border border-primary/20 border-t-primary" />Loading the recorded market path</div> : <span className="text-[8px] text-muted">Historical bars are unavailable for this instrument or date.</span>}</div> : null}
      <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-border bg-background/85 px-2 py-1 text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">1m · one hour each side · drag + scroll</div>
    </div>
  );
}

function themeColor(variable: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

function primaryColor() { return themeColor("--primary", "#d6ad55"); }
function accentColor() { return themeColor("--accent", "#65d69a"); }
function dangerColor() { return themeColor("--danger", "#ff586d"); }
