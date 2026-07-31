"use client";

import {
  CandlestickChart,
  ChevronLeft,
  ChevronRight,
  LineChart,
  Radio,
} from "lucide-react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import ClassifiedGexLadder from "@/components/gexdesk/ClassifiedGexLadder";
import ClassifiedVolumeLadder from "@/components/gexdesk/ClassifiedVolumeLadder";
import DexWeightedOrderflow, {
  ConvexityOrderflow,
  GexWeightedOrderflow,
} from "@/components/gexdesk/DexWeightedOrderflow";
import ExpiryOrderflowComparison from "@/components/gexdesk/ExpiryOrderflowComparison";
import KwantSteps from "@/components/gexdesk/KwantSteps";
import LiveExposureFlowStack from "@/components/gexdesk/LiveExposureFlowStack";
import LookbackPlayback from "@/components/gexdesk/LookbackPlayback";
import MajorGamma from "@/components/gexdesk/MajorGamma";
import type { Candle } from "@/lib/backtester";
import {
  DATABENTO_LIVE_STATUS_EVENT,
  DATABENTO_LIVE_TICK_EVENT,
  readDatabentoLiveStatus,
  type DatabentoLiveStatus,
} from "@/lib/chartLiveEvents";
import {
  mergeChartHistory,
  readCompatibleChartHistoryCache,
  writeChartHistoryCache,
} from "@/lib/chartHistoryCache";
import { DEFAULT_CHART_HISTORY_CALENDAR_DAYS } from "@/lib/chartHistoryWindow";
import { DATABENTO_DEFAULT_SYMBOLS, DATABENTO_FUTURES } from "@/lib/databento";
import type {
  GexDeskHistoryPayload,
  GexDeskPayload,
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";

type GexViewChartMode = "CANDLES" | "LINE";
type GexViewChartConfig = {
  instrument: string;
  timeframe: string;
  mode: GexViewChartMode;
};

type MarketHistoryResponse = {
  candles?: Candle[];
  error?: string;
};

type LiveTick = {
  instrument?: string;
  mid?: number;
  timestamp?: string | number;
};

const CHART_COUNT = 10;
const STORAGE_KEY = "kwantdesk:gex-view:charts:v1";
const DEFAULT_CHART: GexViewChartConfig = {
  instrument: "NQ.v.0",
  timeframe: "5m",
  mode: "CANDLES",
};
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1D"] as const;
const historyRequests = new Map<string, Promise<Candle[]>>();
const historyFreshAt = new Map<string, number>();

const INSTRUMENTS = DATABENTO_DEFAULT_SYMBOLS
  .map((symbol) => DATABENTO_FUTURES.find((instrument) => instrument.symbol === symbol))
  .filter((instrument): instrument is NonNullable<typeof instrument> => Boolean(instrument));

function displaySymbol(symbol: string) {
  return symbol.replace(/\.[vnc]\.\d+$/i, "");
}

function validCandles(value: unknown): Candle[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row): Candle[] => {
    if (!row || typeof row !== "object") return [];
    const candle = row as Partial<Candle>;
    const timestamp = Number(candle.timestamp);
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    if (
      !Number.isFinite(timestamp)
      || ![open, high, low, close].every((number) => Number.isFinite(number) && number > 0)
    ) {
      return [];
    }
    return [{
      timestamp,
      open,
      high: Math.max(open, high, low, close),
      low: Math.min(open, high, low, close),
      close,
      volume: Number.isFinite(Number(candle.volume)) ? Number(candle.volume) : undefined,
    }];
  });
}

function timeframeMs(timeframe: string) {
  const match = timeframe.match(/^(\d+)(m|h|D)$/);
  if (!match) return 5 * 60_000;
  const value = Math.max(1, Number(match[1]));
  const unit = match[2] === "m"
    ? 60_000
    : match[2] === "h"
      ? 60 * 60_000
      : 24 * 60 * 60_000;
  return value * unit;
}

function tickTimestamp(value: string | number | undefined) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Date.now();
  return parsed < 10_000_000_000 ? parsed * 1_000 : parsed;
}

async function loadHistory(instrument: string, timeframe: string) {
  const key = `${instrument}::${timeframe}`;
  const cached = await readCompatibleChartHistoryCache(instrument, timeframe);
  if (
    cached?.candles.length
    && Date.now() - (historyFreshAt.get(key) ?? 0) < 12_000
  ) {
    return cached.candles;
  }

  const pending = historyRequests.get(key);
  if (pending) return pending;

  const request = (async () => {
    const response = await fetch(
      `/api/databento/market?symbol=${encodeURIComponent(instrument)}&timeframe=${encodeURIComponent(timeframe)}&days=${DEFAULT_CHART_HISTORY_CALENDAR_DAYS}`,
      { cache: "no-store" },
    );
    const body = await response.json() as MarketHistoryResponse;
    if (!response.ok) throw new Error(body.error || "Five-session CME history is unavailable.");
    const incoming = validCandles(body.candles);
    if (!incoming.length && !cached?.candles.length) {
      throw new Error("No CME history was returned for this instrument.");
    }
    const candles = mergeChartHistory(cached?.candles ?? [], incoming);
    await writeChartHistoryCache(instrument, timeframe, candles);
    historyFreshAt.set(key, Date.now());
    return candles;
  })().finally(() => {
    historyRequests.delete(key);
  });

  historyRequests.set(key, request);
  return request;
}

function GexViewChart({
  config,
  chartNumber,
}: {
  config: GexViewChartConfig;
  chartNumber: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [feedStatus, setFeedStatus] = useState<DatabentoLiveStatus>(
    () => readDatabentoLiveStatus() ?? "connecting",
  );
  const [themeRevision, setThemeRevision] = useState(0);

  useEffect(() => {
    const updateTheme = () => setThemeRevision((revision) => revision + 1);
    window.addEventListener("kwantdesk:theme-change", updateTheme);
    return () => window.removeEventListener("kwantdesk:theme-change", updateTheme);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const controller = new AbortController();
    const styles = getComputedStyle(document.documentElement);
    const background = styles.getPropertyValue("--background").trim() || "#050505";
    const foreground = styles.getPropertyValue("--foreground").trim() || "#f4f4f4";
    const muted = styles.getPropertyValue("--muted").trim() || "#777";
    const border = styles.getPropertyValue("--border").trim() || "#222";
    const primary = styles.getPropertyValue("--primary").trim() || "#d6ad55";
    const accent = styles.getPropertyValue("--accent").trim() || "#65d69a";

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: background },
        textColor: muted,
        fontFamily: "var(--font-sans)",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: border, style: 1 },
        horzLines: { color: border, style: 1 },
      },
      rightPriceScale: {
        borderColor: border,
        scaleMargins: { top: 0.09, bottom: 0.1 },
      },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      crosshair: {
        vertLine: { color: primary, labelBackgroundColor: primary },
        horzLine: { color: primary, labelBackgroundColor: primary },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candleSeries: ISeriesApi<"Candlestick"> | null = config.mode === "CANDLES"
      ? chart.addCandlestickSeries({
          upColor: accent,
          downColor: foreground,
          borderUpColor: accent,
          borderDownColor: foreground,
          wickUpColor: accent,
          wickDownColor: foreground,
          priceLineColor: primary,
          priceLineWidth: 1,
          priceLineStyle: 2,
          lastValueVisible: true,
        })
      : null;
    const lineSeries: ISeriesApi<"Line"> | null = config.mode === "LINE"
      ? chart.addLineSeries({
          color: primary,
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          lastValueVisible: true,
          priceLineVisible: true,
          priceLineColor: primary,
          priceLineWidth: 1,
          priceLineStyle: 2,
        })
      : null;
    let candles: Candle[] = [];
    let renderedHistory = false;

    const renderHistory = (nextCandles: Candle[], fit = false) => {
      candles = nextCandles;
      if (candleSeries) {
        candleSeries.setData(nextCandles.map((candle) => ({
          time: Math.floor(candle.timestamp / 1_000) as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })));
      } else if (lineSeries) {
        lineSeries.setData(nextCandles.map((candle) => ({
          time: Math.floor(candle.timestamp / 1_000) as Time,
          value: candle.close,
        })));
      }
      if (fit && nextCandles.length && !renderedHistory) {
        chart.timeScale().fitContent();
        renderedHistory = true;
      }
    };

    setState("loading");
    setError("");
    void (async () => {
      const cached = await readCompatibleChartHistoryCache(config.instrument, config.timeframe);
      if (controller.signal.aborted) return;
      if (cached?.candles.length) {
        renderHistory(cached.candles, true);
        setState("ready");
      }
      try {
        const loaded = await loadHistory(config.instrument, config.timeframe);
        if (controller.signal.aborted) return;
        renderHistory(loaded, true);
        setState("ready");
      } catch (historyError) {
        if (controller.signal.aborted) return;
        if (candles.length) {
          setState("ready");
          return;
        }
        setError(historyError instanceof Error ? historyError.message : "CME history could not load.");
        setState("error");
      }
    })();

    const receiveStatus = (event: Event) => {
      setFeedStatus((event as CustomEvent<DatabentoLiveStatus>).detail);
    };
    const receiveTick = (event: Event) => {
      const tick = (event as CustomEvent<LiveTick>).detail;
      const root = displaySymbol(config.instrument).toUpperCase();
      const tickInstrument = String(tick?.instrument ?? "").toUpperCase();
      if (!tickInstrument.startsWith(root)) return;
      const price = Number(tick.mid);
      if (!Number.isFinite(price) || price <= 0) return;

      const latest = candles.at(-1);
      if (latest && Math.abs(price - latest.close) / latest.close > 0.2) return;
      const duration = timeframeMs(config.timeframe);
      const timestamp = tickTimestamp(tick.timestamp);
      const bucket = Math.floor(timestamp / duration) * duration;
      if (latest && bucket < latest.timestamp) return;

      const candle = !latest || bucket > latest.timestamp
        ? { timestamp: bucket, open: price, high: price, low: price, close: price }
        : {
            ...latest,
            high: Math.max(latest.high, price),
            low: Math.min(latest.low, price),
            close: price,
          };
      candles = latest && bucket === latest.timestamp
        ? [...candles.slice(0, -1), candle]
        : [...candles, candle];
      const time = Math.floor(candle.timestamp / 1_000) as Time;
      candleSeries?.update({
        time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
      lineSeries?.update({ time, value: candle.close });
      setFeedStatus("live");
      setState("ready");
    };
    window.addEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);

    const resize = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });
    resize.observe(container);

    return () => {
      controller.abort();
      resize.disconnect();
      window.removeEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
      window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
      chart.remove();
    };
  }, [config.instrument, config.mode, config.timeframe, themeRevision]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-background">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-border bg-background/85 px-2.5 py-1.5 backdrop-blur-md">
        <span className="font-mono text-[8px] font-semibold text-foreground">{displaySymbol(config.instrument)}</span>
        <span className="text-[6px] text-muted">CME</span>
        <span className="text-[6px] text-muted">{config.timeframe}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${feedStatus === "live" ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted"}`} />
        <span className={`text-[6px] font-semibold ${feedStatus === "live" ? "text-primary" : "text-muted"}`}>
          {feedStatus === "live" ? "LIVE" : "CONNECTING"}
        </span>
      </div>
      {state !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/82 backdrop-blur-[2px]">
          {state === "loading" ? (
            <div className="flex flex-col items-center">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.07] text-primary shadow-[0_0_32px_color-mix(in_srgb,var(--primary)_18%,transparent)]">
                <Radio className="h-4 w-4 animate-pulse" />
              </span>
              <span className="mt-3 text-[7px] font-semibold uppercase tracking-[0.14em] text-muted">Loading five CME sessions</span>
            </div>
          ) : (
            <div className="max-w-sm px-5 text-center">
              <div className="text-[8px] font-semibold text-foreground">Chart {chartNumber} could not load</div>
              <div className="mt-2 text-[7px] leading-4 text-muted">{error}</div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function initialCharts(): GexViewChartConfig[] {
  if (typeof window === "undefined") {
    return Array.from({ length: CHART_COUNT }, () => ({ ...DEFAULT_CHART }));
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as GexViewChartConfig[];
    if (!Array.isArray(parsed) || parsed.length !== CHART_COUNT) throw new Error("Invalid chart state");
    return parsed.map((chart) => ({
      instrument: INSTRUMENTS.some((instrument) => instrument.symbol === chart.instrument)
        ? chart.instrument
        : DEFAULT_CHART.instrument,
      timeframe: TIMEFRAMES.includes(chart.timeframe as (typeof TIMEFRAMES)[number])
        ? chart.timeframe
        : DEFAULT_CHART.timeframe,
      mode: chart.mode === "LINE" ? "LINE" : "CANDLES",
    }));
  } catch {
    return Array.from({ length: CHART_COUNT }, () => ({ ...DEFAULT_CHART }));
  }
}

export default function GexViewWorkspace({
  payload,
  history,
  historyLoading,
  historyError,
  livePrice,
  sourceFilter,
  onSourceFilterChange,
}: {
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  historyLoading: boolean;
  historyError: string;
  livePrice: number | null;
  sourceFilter: "COMBINED" | GexDeskSourceSymbol;
  onSourceFilterChange: (source: "COMBINED" | GexDeskSourceSymbol) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [charts, setCharts] = useState<GexViewChartConfig[]>(initialCharts);
  const activeChart = charts[activeIndex] ?? DEFAULT_CHART;
  const preloadKey = useMemo(
    () => [...new Set(charts.slice(10).map((chart) => `${chart.instrument}::${chart.timeframe}`))].join("|"),
    [charts],
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
  }, [charts]);

  useEffect(() => {
    const uniqueCharts = [...new Map(
      charts.slice(10).map((chart) => [`${chart.instrument}::${chart.timeframe}`, chart]),
    ).values()];
    void Promise.allSettled(uniqueCharts.map((chart) => loadHistory(chart.instrument, chart.timeframe)));
  }, [preloadKey]);

  const updateActive = (patch: Partial<GexViewChartConfig>) => {
    setCharts((current) => current.map((chart, index) => (
      index === activeIndex ? { ...chart, ...patch } : chart
    )));
  };
  const previous = () => setActiveIndex((index) => (index - 1 + CHART_COUNT) % CHART_COUNT);
  const next = () => setActiveIndex((index) => (index + 1) % CHART_COUNT);

  return (
    <section className="flex min-h-[720px] items-center justify-center py-3">
      <div className="grid w-full max-w-[1660px] grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-3">
        <button
          type="button"
          onClick={previous}
          className="flex h-10 w-10 items-center justify-center justify-self-end rounded-full border border-border bg-panel text-muted shadow-lg transition hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary"
          aria-label="Previous Gex View chart"
          title="Previous chart"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          {activeIndex > 9 ? <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary">
                <LineChart className="h-3.5 w-3.5" />
              </span>
              <div className="hidden min-w-0 sm:block">
                <div className="text-[8px] font-semibold">Gex View</div>
                <div className="text-[6px] uppercase tracking-[0.12em] text-muted">Chart {activeIndex + 1} of {CHART_COUNT}</div>
              </div>
            </div>

            <KwantSelect
              value={activeChart.instrument}
              onChange={(event) => updateActive({ instrument: event.target.value })}
              menuLabel="CME instrument"
              className="h-8 min-w-44 rounded-xl border border-border bg-surface px-2.5 text-[8px] font-semibold"
            >
              {INSTRUMENTS.map((instrument) => (
                <option key={instrument.symbol} value={instrument.symbol}>
                  {displaySymbol(instrument.symbol)} · {instrument.label}
                </option>
              ))}
            </KwantSelect>

            <KwantSelect
              value={activeChart.timeframe}
              onChange={(event) => updateActive({ timeframe: event.target.value })}
              menuLabel="Chart timeframe"
              className="h-8 min-w-20 rounded-xl border border-border bg-surface px-2.5 text-[8px] font-semibold"
            >
              {TIMEFRAMES.map((timeframe) => (
                <option key={timeframe} value={timeframe}>{timeframe}</option>
              ))}
            </KwantSelect>

            <div className="ml-auto flex items-center rounded-xl border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => updateActive({ mode: "CANDLES" })}
                className={`flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-[7px] font-semibold transition ${activeChart.mode === "CANDLES" ? "bg-primary/[0.1] text-primary" : "text-muted hover:text-foreground"}`}
                title="Candlestick chart"
              >
                <CandlestickChart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Candles</span>
              </button>
              <button
                type="button"
                onClick={() => updateActive({ mode: "LINE" })}
                className={`flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-[7px] font-semibold transition ${activeChart.mode === "LINE" ? "bg-primary/[0.1] text-primary" : "text-muted hover:text-foreground"}`}
                title="Price line chart"
              >
                <LineChart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Line</span>
              </button>
            </div>
          </div> : null}

          <div className="h-[clamp(640px,calc(100vh-230px),900px)] min-h-[640px]">
            {activeIndex === 0 ? (
              <KwantSteps
                payload={payload}
                history={history}
                historyLoading={historyLoading}
                historyError={historyError}
                livePrice={livePrice}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : activeIndex === 1 ? (
              <LiveExposureFlowStack
                payload={payload}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : activeIndex === 2 ? (
              <MajorGamma
                payload={payload}
                history={history}
                historyLoading={historyLoading}
                historyError={historyError}
                livePrice={livePrice}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : activeIndex === 3 ? (
              <LookbackPlayback
                payload={payload}
                history={history}
                historyLoading={historyLoading}
                historyError={historyError}
                livePrice={livePrice}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : activeIndex === 4 ? (
              <ClassifiedVolumeLadder
                payload={payload}
                history={history}
                livePrice={livePrice}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : activeIndex === 5 ? (
              <ClassifiedGexLadder
                payload={payload}
                history={history}
                livePrice={livePrice}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : activeIndex === 6 ? (
              <DexWeightedOrderflow
                payload={payload}
                history={history}
                livePrice={livePrice}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : activeIndex === 7 ? (
              <GexWeightedOrderflow
                payload={payload}
                history={history}
                livePrice={livePrice}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : activeIndex === 8 ? (
              <ConvexityOrderflow
                payload={payload}
                history={history}
                livePrice={livePrice}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : activeIndex === 9 ? (
              <ExpiryOrderflowComparison
                payload={payload}
                history={history}
                livePrice={livePrice}
                sourceFilter={sourceFilter}
                onSourceFilterChange={onSourceFilterChange}
              />
            ) : (
              <GexViewChart
                key={`${activeIndex}:${activeChart.instrument}:${activeChart.timeframe}:${activeChart.mode}`}
                config={activeChart}
                chartNumber={activeIndex + 1}
              />
            )}
          </div>

          <div className="flex h-9 items-center justify-center gap-2 border-t border-border bg-panel">
            {charts.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-6 bg-primary shadow-[0_0_8px_var(--primary)]" : "w-1.5 bg-muted/35 hover:bg-muted"}`}
                aria-label={`Open Gex View chart ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={next}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-panel text-muted shadow-lg transition hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary"
          aria-label="Next Gex View chart"
          title="Next chart"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
