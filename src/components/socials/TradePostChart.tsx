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

type PositionedTradeMarker = {
  key: "entry" | "exit";
  x: number;
  y: number;
  color: string;
  label: "ENTRY" | "EXIT";
  direction: "up" | "down";
};

const FUTURES_ROOTS = ["MNQ", "MES", "M2K", "MYM", "NQ", "ES", "RTY", "YM", "MCL", "CL", "MGC", "GC", "SIL", "SI", "NG", "HG", "ZB", "ZN", "ZF", "ZT", "6E", "6B", "6J", "6A", "6C"];
const TRADE_BUY_COLOR = "#22c55e";
const TRADE_SELL_COLOR = "#ef4444";

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
  const markerTimesRef = useRef<{ entry: Time | null; exit: Time | null }>({ entry: null, exit: null });
  const refreshMarkersRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [tradeMarkers, setTradeMarkers] = useState<PositionedTradeMarker[]>([]);
  const symbol = useMemo(() => continuousSymbol(trade.instrument), [trade.instrument]);
  const exactTimesAvailable = useMemo(() => {
    const openedAt = Date.parse(trade.openedAt);
    const closedAt = trade.closedAt ? Date.parse(trade.closedAt) : Number.NaN;
    return trade.entryTimeKnown !== false
      && trade.exitTimeKnown !== false
      && Number.isFinite(openedAt)
      && Number.isFinite(closedAt)
      && closedAt >= openedAt;
  }, [trade.closedAt, trade.entryTimeKnown, trade.exitTimeKnown, trade.openedAt]);

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
      rightPriceScale: { borderColor: border, minimumWidth: 68 },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: {
        // Lightweight Charts defaults to magnet mode, which snaps the
        // horizontal crosshair to the nearest candle value. Feed charts
        // should behave like the main terminal: both axes follow the pointer.
        mode: 0,
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
    const entryColor = trade.side === "SHORT" ? TRADE_SELL_COLOR : trade.side === "LONG" ? TRADE_BUY_COLOR : primary;
    const exitColor = trade.side === "SHORT" ? TRADE_BUY_COLOR : trade.side === "LONG" ? TRADE_SELL_COLOR : danger;
    if (trade.entryPrice !== null) series.createPriceLine({ price: trade.entryPrice, color: entryColor, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "ENTRY" });
    if (trade.exitPrice !== null) series.createPriceLine({ price: trade.exitPrice, color: exitColor, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "EXIT" });
    chartRef.current = chart;
    seriesRef.current = series;
    const refreshTradeMarkers = () => {
      const entryTime = markerTimesRef.current.entry;
      const exitTime = markerTimesRef.current.exit;
      const markers: PositionedTradeMarker[] = [];
      if (entryTime !== null && trade.entryPrice !== null) {
        const x = chart.timeScale().timeToCoordinate(entryTime);
        const y = series.priceToCoordinate(trade.entryPrice);
        if (x !== null && y !== null) markers.push({
          key: "entry",
          x,
          y,
          color: entryColor,
          label: "ENTRY",
          direction: trade.side === "SHORT" ? "down" : "up",
        });
      }
      if (exitTime !== null && trade.exitPrice !== null) {
        const x = chart.timeScale().timeToCoordinate(exitTime);
        const y = series.priceToCoordinate(trade.exitPrice);
        if (x !== null && y !== null) markers.push({
          key: "exit",
          x,
          y,
          color: exitColor,
          label: "EXIT",
          direction: trade.side === "SHORT" ? "up" : "down",
        });
      }
      setTradeMarkers(markers);
    };
    refreshMarkersRef.current = refreshTradeMarkers;
    chart.timeScale().subscribeVisibleLogicalRangeChange(refreshTradeMarkers);
    const resize = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height });
      window.requestAnimationFrame(refreshTradeMarkers);
    });
    resize.observe(container);
    return () => {
      resize.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(refreshTradeMarkers);
      refreshMarkersRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, trade.entryPrice, trade.exitPrice, trade.side]);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    void (async () => {
      try {
        if (!symbol) throw new Error("Unsupported historical instrument");
        if (!exactTimesAvailable || !trade.closedAt) throw new Error("Exact entry and exit times are required");
        const openedAt = Date.parse(trade.openedAt);
        const closedAt = Date.parse(trade.closedAt);
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
        markerTimesRef.current = {
          entry: entryTime ? Math.floor(entryTime / 1_000) as Time : null,
          exit: exitTime ? Math.floor(exitTime / 1_000) as Time : null,
        };
        chartRef.current?.timeScale().fitContent();
        window.requestAnimationFrame(() => refreshMarkersRef.current?.());
        setState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        markerTimesRef.current = { entry: null, exit: null };
        setTradeMarkers([]);
        setState("error");
      }
    })();
    return () => controller.abort();
  }, [exactTimesAvailable, symbol, trade.closedAt, trade.openedAt, trade.side]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background/45" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {state === "ready" ? tradeMarkers.map((marker) => (
        <div key={marker.key} className="pointer-events-none absolute z-20" style={{ left: marker.x, top: marker.y, color: marker.color }}>
          <svg
            aria-hidden="true"
            viewBox="0 0 14 18"
            className="absolute h-[18px] w-[14px] drop-shadow-[0_0_5px_currentColor]"
            style={{ left: -7, top: marker.direction === "up" ? 0 : -18 }}
          >
            <path
              d={marker.direction === "up" ? "M7 0L13 7H9.5V18H4.5V7H1L7 0Z" : "M4.5 0H9.5V11H13L7 18L1 11H4.5V0Z"}
              fill="currentColor"
            />
          </svg>
          <span
            className="absolute whitespace-nowrap rounded border bg-background/90 px-1.5 py-0.5 font-mono text-[6px] font-semibold shadow-[0_0_8px_currentColor]"
            style={{ left: 10, top: marker.direction === "up" ? 2 : -15, borderColor: marker.color }}
          >
            {marker.label}
          </span>
        </div>
      )) : null}
      {state !== "ready" ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/76 backdrop-blur-[2px]">{state === "loading" ? <div className="flex items-center gap-2 text-[8px] text-muted"><span className="h-4 w-4 animate-spin rounded-full border border-primary/20 border-t-primary" />Loading the recorded market path</div> : <span className="text-[8px] text-muted">Historical bars are unavailable for this instrument or date.</span>}</div> : null}
      <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-border bg-background/85 px-2 py-1 text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">1m · one hour each side · drag + scroll</div>
    </div>
  );
}
