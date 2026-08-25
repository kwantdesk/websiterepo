"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  createChart,
  LineStyle,
  type IChartApi,
  type Time,
} from "@/lib/lightweightChartsCompat";
import {
  appendRithmicClassicTrade,
  buildRithmicClassicCandles,
  rithmicContractForRoot,
  type RithmicClassicCandle,
} from "@/lib/gex-box/rithmicCandles";
import { subscribeRithmicIndicatorTrades, type RithmicIndicatorStreamStatus } from "@/lib/rithmicIndicatorStream";
import type { LabMode, LabRoot, LabSnapshotLevel, LabSnapshotUpdate } from "@/lib/labSnapshot";

type ChartCandle = RithmicClassicCandle & { volume?: number };
type LabCandleSeries = ReturnType<IChartApi["addCandlestickSeries"]>;

function validCandle(value: unknown): value is ChartCandle {
  if (!value || typeof value !== "object") return false;
  const candle = value as Partial<ChartCandle>;
  return [candle.timestamp, candle.open, candle.high, candle.low, candle.close]
    .every((item) => typeof item === "number" && Number.isFinite(item) && item > 0)
    && candle.high! >= candle.low!;
}

function mergeCandles(base: ChartCandle[], incoming: ChartCandle[], incomingWins = true) {
  const merged = new Map<number, ChartCandle>();
  for (const candle of base) merged.set(candle.timestamp, candle);
  for (const candle of incoming) {
    if (incomingWins || !merged.has(candle.timestamp)) merged.set(candle.timestamp, candle);
  }
  return [...merged.values()].sort((left, right) => left.timestamp - right.timestamp).slice(-1_200);
}

function seriesRows(candles: ChartCandle[]) {
  return candles.map((candle) => ({
    time: Math.floor(candle.timestamp / 1_000) as Time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function levelColor(level: LabSnapshotLevel, colors: Record<string, string>) {
  if (level.kind === "BUY" || level.kind === "TARGET") return colors.accent;
  if (level.kind === "SELL" || level.kind === "NO_TRADE") return colors.danger;
  if (level.kind === "FLIP") return colors.primary;
  return colors.foreground;
}

export default function LabSessionChart({
  root,
  mode,
  levels,
  updates,
}: {
  root: LabRoot;
  mode: LabMode;
  levels: LabSnapshotLevel[];
  updates: LabSnapshotUpdate[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<LabCandleSeries | null>(null);
  const candlesRef = useRef<ChartCandle[]>([]);
  const priceLinesRef = useRef<Array<ReturnType<LabCandleSeries["createPriceLine"]>>>([]);
  const [chartReady, setChartReady] = useState(0);
  const [themeRevision, setThemeRevision] = useState(0);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [streamStatus, setStreamStatus] = useState<RithmicIndicatorStreamStatus>("checking");
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const contract = useMemo(() => rithmicContractForRoot(root), [root]);

  useEffect(() => {
    const onTheme = () => setThemeRevision((value) => value + 1);
    window.addEventListener("kwantdesk:theme-change", onTheme);
    return () => window.removeEventListener("kwantdesk:theme-change", onTheme);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const styles = getComputedStyle(document.documentElement);
    const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    const muted = color("--muted", "#777777");
    const border = color("--border", "#242424");
    const primary = color("--primary", "#ffffff");
    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: muted,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 9,
        attributionLogo: false,
      },
      grid: { vertLines: { color: border }, horzLines: { color: border } },
      rightPriceScale: { borderColor: border, scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false, barSpacing: 7, rightOffset: 8 },
      crosshair: {
        vertLine: { color: primary, labelBackgroundColor: primary },
        horzLine: { color: primary, labelBackgroundColor: primary },
      },
      handleScroll: true,
      handleScale: true,
    });
    const series = chart.addCandlestickSeries({
      upColor: color("--candle-up", "#ffffff"),
      downColor: color("--candle-down", "#737373"),
      borderVisible: false,
      wickUpColor: color("--candle-up", "#ffffff"),
      wickDownColor: color("--candle-down", "#737373"),
      priceLineVisible: true,
      lastValueVisible: true,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    if (candlesRef.current.length) series.setData(seriesRows(candlesRef.current));
    setChartReady((value) => value + 1);
    return () => {
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [themeRevision]);

  useEffect(() => {
    candlesRef.current = [];
    setLastPrice(null);
    setHistoryState("loading");
    setStreamStatus("checking");
    const controller = new AbortController();
    let disposed = false;
    let uiFrame: number | null = null;

    const publishBuffer = (fit = false) => {
      if (disposed || !seriesRef.current) return;
      seriesRef.current.setData(seriesRows(candlesRef.current));
      const price = candlesRef.current.at(-1)?.close ?? null;
      setLastPrice(price);
      if (fit) chartRef.current?.timeScale().fitContent();
    };

    void (async () => {
      try {
        const response = await fetch(`/api/cme-history?symbol=${root}.v.0&timeframe=5m&days=3`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json() as { candles?: unknown[]; error?: string };
        if (!response.ok || !Array.isArray(body.candles)) throw new Error(body.error || "CME history is unavailable.");
        const history = body.candles.filter(validCandle);
        if (!history.length) throw new Error("CME history returned no candles.");
        candlesRef.current = mergeCandles(history, candlesRef.current, true);
        publishBuffer(true);
        setHistoryState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!disposed) setHistoryState("unavailable");
      }
    })();

    if (!contract) return () => controller.abort();
    const schedulePrice = () => {
      if (uiFrame !== null) return;
      uiFrame = window.requestAnimationFrame(() => {
        uiFrame = null;
        if (!disposed) setLastPrice(candlesRef.current.at(-1)?.close ?? null);
      });
    };
    const unsubscribe = subscribeRithmicIndicatorTrades({
      symbol: root,
      contractSymbol: contract,
      onStatus: (status) => { if (!disposed) setStreamStatus(status); },
      onSeed: (records) => {
        const live = buildRithmicClassicCandles(records, 1_200);
        candlesRef.current = mergeCandles(candlesRef.current, live, true);
        publishBuffer(true);
      },
      onTrades: (records) => {
        if (!records.length) return;
        const touchedBuckets = new Set<number>();
        records.forEach((record) => appendRithmicClassicTrade(candlesRef.current, record, 1_200));
        records.forEach((record) => touchedBuckets.add(Math.floor(record.timestamp / 60_000) * 60_000));
        const candleByTime = new Map(candlesRef.current.map((candle) => [candle.timestamp, candle]));
        [...touchedBuckets].sort((left, right) => left - right).forEach((timestamp) => {
          const candle = candleByTime.get(timestamp);
          if (candle) seriesRef.current?.update(seriesRows([candle])[0]);
        });
        schedulePrice();
      },
    });
    return () => {
      disposed = true;
      controller.abort();
      unsubscribe();
      if (uiFrame !== null) window.cancelAnimationFrame(uiFrame);
    };
  // chartReady ensures a theme-driven chart rebuild receives a fresh feed and
  // history paint without retaining listeners from the previous instance.
  }, [chartReady, contract, root]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    priceLinesRef.current = [];
    const styles = getComputedStyle(document.documentElement);
    const colors = {
      foreground: styles.getPropertyValue("--foreground").trim() || "#ffffff",
      primary: styles.getPropertyValue("--primary").trim() || "#ffffff",
      accent: styles.getPropertyValue("--accent").trim() || "#9a9a9a",
      danger: styles.getPropertyValue("--danger").trim() || "#6b6b6b",
    };
    for (const level of levels.filter((item) => item.status !== "INVALIDATED" && item.status !== "BROKEN").slice(0, 32)) {
      const color = levelColor(level, colors);
      const title = `${level.kind} · ${level.label}`.slice(0, 34);
      priceLinesRef.current.push(series.createPriceLine({
        price: level.low,
        color,
        lineWidth: level.strength >= 80 ? 2 : 1,
        lineStyle: level.kind === "NO_TRADE" || level.kind === "REFERENCE" ? LineStyle.Dotted : LineStyle.Dashed,
        axisLabelVisible: true,
        title,
      }));
      if (level.high !== level.low) {
        priceLinesRef.current.push(series.createPriceLine({
          price: level.high,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: "",
        }));
      }
    }
    return () => {
      priceLinesRef.current.forEach((line) => series.removePriceLine(line));
      priceLinesRef.current = [];
    };
  }, [chartReady, levels]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !candlesRef.current.length) return;
    const candleTimes = candlesRef.current.map((candle) => candle.timestamp);
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--primary").trim() || "#ffffff";
    const danger = styles.getPropertyValue("--danger").trim() || "#737373";
    const nearestTime = (timestamp: number) => {
      let nearest = candleTimes[0];
      for (const candidate of candleTimes) {
        if (Math.abs(candidate - timestamp) < Math.abs(nearest - timestamp)) nearest = candidate;
      }
      return Math.floor(nearest / 1_000) as Time;
    };
    series.setMarkers(updates
      .filter((update) => update.price !== null && Number.isFinite(Date.parse(update.at)))
      .slice(-24)
      .map((update) => ({
        time: nearestTime(Date.parse(update.at)),
        position: "aboveBar" as const,
        shape: update.kind === "LEVEL" ? "arrowDown" as const : "circle" as const,
        color: update.kind === "RISK" ? danger : primary,
        text: update.title.slice(0, 20),
      })));
  }, [chartReady, updates]);

  const feedLabel = streamStatus === "connected"
    ? "Rithmic tape live"
    : streamStatus === "checking"
      ? "Checking live tape"
      : historyState === "ready"
        ? "History only · live tape down"
        : "Price feed unavailable";

  return (
    <section className="relative min-h-[410px] overflow-hidden border border-border bg-background">
      <div className="absolute inset-x-0 top-0 z-10 flex h-8 items-center gap-2 border-b border-border bg-panel/95 px-3 backdrop-blur-sm">
        <span className="font-mono text-[10px] font-semibold text-foreground">{root} · 5M</span>
        <span className={`border px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] ${mode === "FOLLOW" ? "border-danger/35 text-danger" : mode === "FADE" ? "border-primary/35 text-primary" : "border-border text-muted"}`}>{mode}</span>
        <span className="ml-auto font-mono text-[10px] text-foreground">{lastPrice?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "—"}</span>
        <span className="text-[7px] uppercase tracking-[0.1em] text-muted">{feedLabel}</span>
      </div>
      <div ref={hostRef} className="absolute inset-x-0 bottom-0 top-8" />
      {historyState !== "ready" && streamStatus !== "connected" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-8 z-20 flex items-center justify-center bg-background/80">
          <div className="text-center">
            {historyState === "loading" ? <span className="mx-auto block h-5 w-5 animate-spin border-2 border-primary/20 border-t-primary" /> : null}
            <p className="mt-3 text-[8px] uppercase tracking-[0.14em] text-muted">{historyState === "loading" ? "Loading authoritative CME history" : "No authoritative price series"}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
