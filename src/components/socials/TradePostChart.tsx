"use client";

import { createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SocialTradeSnapshot } from "@/lib/socials";
import { newYorkExpectedMoveSessionBounds } from "@/lib/expectedMove";

type Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
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

function validCandles(value: unknown): Candle[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is Candle => {
    if (!candidate || typeof candidate !== "object") return false;
    const candle = candidate as Record<string, unknown>;
    return ["timestamp", "open", "high", "low", "close"]
      .every((key) => Number.isFinite(Number(candle[key])));
  }).map((candle) => ({
    timestamp: Number(candle.timestamp),
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  }));
}

function newYorkSessionDate(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default function TradePostChart({ trade, height = 270 }: { trade: SocialTradeSnapshot; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markerTimesRef = useRef<{ entry: Time | null; exit: Time | null }>({ entry: null, exit: null });
  const markerElementsRef = useRef<Record<"entry" | "exit", HTMLDivElement | null>>({ entry: null, exit: null });
  const refreshMarkersRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const symbol = useMemo(() => continuousSymbol(trade.instrument), [trade.instrument]);
  const entryColor = trade.side === "SHORT" ? TRADE_SELL_COLOR : trade.side === "LONG" ? TRADE_BUY_COLOR : "var(--primary)";
  const exitColor = trade.side === "SHORT" ? TRADE_BUY_COLOR : trade.side === "LONG" ? TRADE_SELL_COLOR : "var(--danger)";
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
    const resolvedEntryColor = trade.side === "SHORT" ? TRADE_SELL_COLOR : trade.side === "LONG" ? TRADE_BUY_COLOR : primary;
    const resolvedExitColor = trade.side === "SHORT" ? TRADE_BUY_COLOR : trade.side === "LONG" ? TRADE_SELL_COLOR : danger;
    if (trade.entryPrice !== null) series.createPriceLine({ price: trade.entryPrice, color: resolvedEntryColor, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "ENTRY" });
    if (trade.exitPrice !== null) series.createPriceLine({ price: trade.exitPrice, color: resolvedExitColor, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "EXIT" });
    chartRef.current = chart;
    seriesRef.current = series;
    const refreshTradeMarkers = () => {
      const entryTime = markerTimesRef.current.entry;
      const exitTime = markerTimesRef.current.exit;
      const position = (key: "entry" | "exit", time: Time | null, price: number | null) => {
        const element = markerElementsRef.current[key];
        if (!element || time === null || price === null) {
          if (element) element.style.display = "none";
          return;
        }
        const x = chart.timeScale().timeToCoordinate(time);
        const y = series.priceToCoordinate(price);
        if (x === null || y === null) {
          element.style.display = "none";
          return;
        }
        element.style.display = "block";
        element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      };
      position("entry", entryTime, trade.entryPrice);
      position("exit", exitTime, trade.exitPrice);
    };
    refreshMarkersRef.current = refreshTradeMarkers;
    chart.timeScale().subscribeVisibleLogicalRangeChange(refreshTradeMarkers);
    chart.subscribeCrosshairMove(refreshTradeMarkers);
    let markerFrame: number | null = null;
    const scheduleMarkerRefresh = () => {
      if (markerFrame !== null) window.cancelAnimationFrame(markerFrame);
      markerFrame = window.requestAnimationFrame(() => {
        markerFrame = null;
        refreshTradeMarkers();
      });
    };
    container.addEventListener("wheel", scheduleMarkerRefresh, { passive: true });
    container.addEventListener("pointermove", scheduleMarkerRefresh, { passive: true });
    container.addEventListener("pointerup", scheduleMarkerRefresh, { passive: true });
    const resize = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height });
      window.requestAnimationFrame(refreshTradeMarkers);
    });
    resize.observe(container);
    return () => {
      resize.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(refreshTradeMarkers);
      chart.unsubscribeCrosshairMove(refreshTradeMarkers);
      container.removeEventListener("wheel", scheduleMarkerRefresh);
      container.removeEventListener("pointermove", scheduleMarkerRefresh);
      container.removeEventListener("pointerup", scheduleMarkerRefresh);
      if (markerFrame !== null) window.cancelAnimationFrame(markerFrame);
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
        const sessionBounds = newYorkExpectedMoveSessionBounds(newYorkSessionDate(openedAt));
        // A trade taken during the first hour of New York RTH must not pull an
        // hour of pre-market bars into the post. Start at the 09:30 cash open.
        const startAt = openedAt >= sessionBounds.open && openedAt < sessionBounds.open + 60 * 60_000
          ? sessionBounds.open
          : openedAt - 60 * 60_000;
        const start = new Date(startAt).toISOString();
        const end = new Date(Math.min(Date.now(), Math.max(openedAt, closedAt) + 60 * 60_000)).toISOString();
        let sourceCandles: Candle[] = [];
        try {
          const response = await fetch(`/api/backtesting/session?symbol=${encodeURIComponent(symbol)}&timeframe=1m&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const body = await response.json().catch(() => null) as { candles?: unknown } | null;
          if (response.ok) sourceCandles = validCandles(body?.candles);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
        }

        // A just-completed trade can be newer than the historical archive.
        // The normal chart-history route includes its retained live tail, so
        // use that before declaring a social trade chart unavailable.
        if (!sourceCandles.length) {
          const fallback = await fetch(`/api/cme-history?symbol=${encodeURIComponent(symbol)}&timeframe=1m&days=5`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const fallbackBody = await fallback.json().catch(() => null) as { candles?: unknown } | null;
          const recentCandles = fallback.ok ? validCandles(fallbackBody?.candles) : [];
          const windowStart = Date.parse(start);
          const windowEnd = Date.parse(end);
          const windowCandles = recentCandles.filter((candle) => candle.timestamp >= windowStart && candle.timestamp <= windowEnd);
          sourceCandles = windowCandles.length ? windowCandles : recentCandles.slice(-180);
        }
        if (!sourceCandles.length) throw new Error("No historical bars");
        const candles = sourceCandles
          .map((candle) => ({
            time: Math.floor(candle.timestamp / 1_000) as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
        if (!candles.length) throw new Error("No historical bars");
        seriesRef.current?.setData(candles);
        const entryTime = nearestCandleTime(sourceCandles, openedAt);
        const exitTime = nearestCandleTime(sourceCandles, closedAt);
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
        Object.values(markerElementsRef.current).forEach((element) => {
          if (element) element.style.display = "none";
        });
        setState("error");
      }
    })();
    return () => controller.abort();
  }, [exactTimesAvailable, symbol, trade.closedAt, trade.openedAt, trade.side]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background/45" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {(["entry", "exit"] as const).map((key) => {
        const direction = key === "entry"
          ? (trade.side === "SHORT" ? "down" : "up")
          : (trade.side === "SHORT" ? "up" : "down");
        const color = key === "entry" ? entryColor : exitColor;
        return (
        <div
          key={key}
          ref={(element) => { markerElementsRef.current[key] = element; }}
          className="pointer-events-none absolute left-0 top-0 z-20 hidden will-change-transform"
          style={{ color }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 14 18"
            className="absolute h-[18px] w-[14px] drop-shadow-[0_0_5px_currentColor]"
            style={{ left: -7, top: direction === "up" ? 0 : -18 }}
          >
            <path
              d={direction === "up" ? "M7 0L13 7H9.5V18H4.5V7H1L7 0Z" : "M4.5 0H9.5V11H13L7 18L1 11H4.5V0Z"}
              fill="currentColor"
            />
          </svg>
          <span
            className="absolute whitespace-nowrap rounded border bg-background/90 px-1.5 py-0.5 font-mono text-[6px] font-semibold shadow-[0_0_8px_currentColor]"
            style={{ left: 10, top: direction === "up" ? 2 : -15, borderColor: color }}
          >
            {key === "entry" ? "ENTRY" : "EXIT"}
          </span>
        </div>
        );
      })}
      {state !== "ready" ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/76 backdrop-blur-[2px]">{state === "loading" ? <div className="flex items-center gap-2 text-[8px] text-muted"><span className="h-4 w-4 animate-spin rounded-full border border-primary/20 border-t-primary" />Loading the recorded market path</div> : <span className="text-[8px] text-muted">Historical bars are unavailable for this instrument or date.</span>}</div> : null}
      <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-border bg-background/85 px-2 py-1 text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">1m · available session bars · drag + scroll</div>
    </div>
  );
}
