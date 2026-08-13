"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CircleGauge,
  Clock3,
  Database,
  Gauge,
  Layers3,
  Radio,
  RefreshCw,
  ScanLine,
  Shield,
  Sparkles,
  TableProperties,
  Waves,
  Zap,
} from "lucide-react";
import KwantLoader from "@/components/KwantLoader";
import MarketMapIntelligence from "@/components/options-flow/MarketMapIntelligence";
import PositioningIntelligence from "@/components/options-flow/PositioningIntelligence";
import {
  OPTIONS_FLOW_INSTRUMENTS,
  type ExposureSummary,
  type ExpectedMoveRange,
  type FlowBoardItem,
  type GreekMode,
  type OptionsCandle,
  type OptionsFlowPayload,
  type OptionsKeyLevel,
  type OptionsMarketData,
  type OptionsMarketPulsePayload,
  type OptionsPriceMode,
  type PremiumDriftPoint,
} from "@/lib/optionsFlow";
import {
  fetchWorkspaceData,
  optionsFlowCacheKey,
  readWorkspaceData,
  writeWorkspaceData,
} from "@/lib/workspaceDataCache";

const LOCAL_FUTURES_PULSE_MS = 250;
const LEVEL_REFRESH_MS = 5_000;
const FULL_POSITIONING_REFRESH_MS = 30_000;
const LIVE_OPTIONS_PAYLOAD_MAX_AGE_MS = 15_000;
const OPTIONS_CHART_HISTORY_BARS = 10_500;
const OPTIONS_CHART_BOOTSTRAP_BARS = 600;
const OPTIONS_CHART_READY_BARS = 20;
const OPTIONS_CHART_TIMEFRAME_STORAGE_KEY = "kwantify:options-flow:chart-timeframe";
const OPTIONS_CHART_TIMEFRAMES = [
  { id: "1m", label: "1 minute", milliseconds: 60_000 },
  { id: "5m", label: "5 minutes", milliseconds: 5 * 60_000 },
  { id: "15m", label: "15 minutes", milliseconds: 15 * 60_000 },
  { id: "30m", label: "30 minutes", milliseconds: 30 * 60_000 },
  { id: "1h", label: "1 hour", milliseconds: 60 * 60_000 },
  { id: "2h", label: "2 hours", milliseconds: 2 * 60 * 60_000 },
  { id: "4h", label: "4 hours", milliseconds: 4 * 60 * 60_000 },
  { id: "1D", label: "1 day", milliseconds: null },
] as const;
const OPTIONS_SESSION_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const optionsSessionDateCache = new Map<string, string>();

type OptionsChartTimeframe = (typeof OPTIONS_CHART_TIMEFRAMES)[number]["id"];

type LevelClock = {
  symbol: string;
  priceMode: OptionsPriceMode;
  sourceRevision: string;
  geometryRevision: string;
  basis: number;
  scale: number;
  basisEstablished: boolean;
  calibratedAt: string | null;
  futuresSymbol: string | null;
  futuresSessionOpen: number | null;
  checkedAt: string;
  changedAt: string;
};

type ChartMarketPreview = {
  key: string;
  marketData: OptionsMarketData;
};

const GREEK_LABELS: Record<GreekMode, { short: string; label: string; description: string }> = {
  GAMMA: { short: "GEX", label: "Gamma", description: "Dealer gamma exposure per 1% move" },
  DELTA: { short: "DEX", label: "Delta", description: "Dealer delta exposure per 1% move" },
  VANNA: { short: "VEX", label: "Vanna", description: "Volatility-sensitive delta exposure" },
  CHARM: { short: "CHEX", label: "Charm", description: "Time-decay-sensitive delta exposure" },
};

function formatCompact(value: number | null, currency = false) {
  if (value === null || !Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const prefix = currency ? "$" : "";
  if (absolute >= 1_000_000_000) return `${sign}${prefix}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${prefix}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${prefix}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${prefix}${absolute.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatPrice(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null, whole = false) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(whole ? value : value * 100).toFixed(1)}%`;
}

function formatClock(value: string | number) {
  return new Date(value).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatNewYorkSnapshot(value: string | number) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "unknown close";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
}

function formatPulse(value: number) {
  return value < 1_000 ? `${Math.round(value)}ms` : `${Math.max(1, Math.round(value / 1_000))}s`;
}

function getNewYorkOptionsClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const easternDate = new Date(Date.UTC(read("year"), read("month") - 1, read("day")));
  const weekday = easternDate.getUTCDay();
  const minutes = read("hour") * 60 + read("minute");
  return {
    marketOpen: weekday >= 1 && weekday <= 5 && minutes >= 9 * 60 + 30 && minutes < 16 * 60,
    sessionDate: easternDate.toISOString().slice(0, 10),
  };
}

function isFreshLiveOptionsPayload(payload: OptionsFlowPayload | null, now = Date.now()) {
  const clock = getNewYorkOptionsClock(new Date(now));
  if (!clock.marketOpen) return Boolean(payload);
  if (
    !payload
    || !payload.session.marketOpen
    || payload.snapshotMode !== "LIVE"
    || payload.session.sessionDate !== clock.sessionDate
    || !payload.exposures.GAMMA?.strikes.length
  ) return false;
  const asOf = Date.parse(payload.asOf);
  return Number.isFinite(asOf) && now - asOf <= LIVE_OPTIONS_PAYLOAD_MAX_AGE_MS;
}

function canRenderOptionsPayload(payload: OptionsFlowPayload | null, now = Date.now()) {
  return getNewYorkOptionsClock(new Date(now)).marketOpen
    ? isFreshLiveOptionsPayload(payload, now)
    : Boolean(payload);
}

function mergeCoreOptionsPayload(current: OptionsFlowPayload, incoming: OptionsFlowPayload) {
  if (
    current.symbol !== incoming.symbol
    || current.session.sessionDate !== incoming.session.sessionDate
    || current.snapshotMode !== incoming.snapshotMode
  ) return incoming;

  return {
    ...incoming,
    environment: {
      ...incoming.environment,
      ivRank: current.environment.ivRank,
      callIv: current.environment.callIv,
      putIv: current.environment.putIv,
    },
    levels: {
      ...incoming.levels,
      majorPositiveOi: incoming.levels.majorPositiveOi ?? current.levels.majorPositiveOi,
      zeroDteMaxPain: incoming.levels.zeroDteMaxPain ?? current.levels.zeroDteMaxPain,
      putSupport: incoming.levels.putSupport.length ? incoming.levels.putSupport : current.levels.putSupport,
      zeroDtePutSupport: incoming.levels.zeroDtePutSupport.length
        ? incoming.levels.zeroDtePutSupport
        : current.levels.zeroDtePutSupport,
    },
    exposures: {
      ...incoming.exposures,
      VANNA: incoming.exposures.VANNA ?? current.exposures.VANNA,
      CHARM: incoming.exposures.CHARM ?? current.exposures.CHARM,
    },
    openInterest: incoming.openInterest.length ? incoming.openInterest : current.openInterest,
    zeroDteOpenInterest: incoming.zeroDteOpenInterest.length
      ? incoming.zeroDteOpenInterest
      : current.zeroDteOpenInterest,
    positioning: current.positioning,
    marketMap: {
      ...incoming.marketMap,
      expectedMove: incoming.marketMap.expectedMove ?? current.marketMap.expectedMove,
      dealerPositioning: {
        ...incoming.marketMap.dealerPositioning,
        frontExpiryNetGex: current.marketMap.dealerPositioning.frontExpiryNetGex,
        frontExpiryNetDex: current.marketMap.dealerPositioning.frontExpiryNetDex,
        frontExpiryGexChange1h: current.marketMap.dealerPositioning.frontExpiryGexChange1h,
        frontExpiryDexChange1h: current.marketMap.dealerPositioning.frontExpiryDexChange1h,
        lastFrontExpiryGammaFlipAt: current.marketMap.dealerPositioning.lastFrontExpiryGammaFlipAt,
        dteGamma: incoming.marketMap.dealerPositioning.dteGamma.length
          ? incoming.marketMap.dealerPositioning.dteGamma
          : current.marketMap.dealerPositioning.dteGamma,
      },
      putCallVolume: incoming.marketMap.putCallVolume ?? current.marketMap.putCallVolume,
      volatility: current.marketMap.volatility,
    },
    flowBoard: incoming.flowBoard.length ? incoming.flowBoard : current.flowBoard,
  } satisfies OptionsFlowPayload;
}

function mergeCandles(current: OptionsCandle[], incoming: OptionsCandle[]) {
  if (!incoming.length) return current;
  const merged = new Map(current.map((candle) => [candle.timestamp, candle]));
  for (const candle of incoming) merged.set(candle.timestamp, candle);
  return [...merged.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-OPTIONS_CHART_HISTORY_BARS);
}

function marketCandlesForMode(
  marketData: OptionsMarketData | null | undefined,
  mode: OptionsPriceMode,
) {
  return marketData?.mode === mode && !marketData.fallback
    ? marketData.candles
    : [];
}

function isOptionsChartTimeframe(value: string): value is OptionsChartTimeframe {
  return OPTIONS_CHART_TIMEFRAMES.some((timeframe) => timeframe.id === value);
}

function loadOptionsChartTimeframe(): OptionsChartTimeframe {
  if (typeof window === "undefined") return "1m";
  try {
    const stored = window.localStorage.getItem(OPTIONS_CHART_TIMEFRAME_STORAGE_KEY) ?? "";
    return isOptionsChartTimeframe(stored) ? stored : "1m";
  } catch {
    return "1m";
  }
}

function dailySessionKey(timestamp: number, mode: OptionsPriceMode) {
  const shiftedTimestamp = mode === "FUTURES" ? timestamp + 6 * 60 * 60_000 : timestamp;
  const cacheKey = `${mode}:${Math.floor(shiftedTimestamp / 60_000)}`;
  const cached = optionsSessionDateCache.get(cacheKey);
  if (cached) return cached;
  const sessionDate = OPTIONS_SESSION_DATE_FORMATTER.format(new Date(shiftedTimestamp));
  optionsSessionDateCache.set(cacheKey, sessionDate);
  return sessionDate;
}

function optionsCandleBucket(
  timestamp: number,
  timeframe: OptionsChartTimeframe,
  mode: OptionsPriceMode,
) {
  const definition = OPTIONS_CHART_TIMEFRAMES.find((option) => option.id === timeframe)!;
  if (definition.milliseconds === null) {
    return { key: dailySessionKey(timestamp, mode), timestamp };
  }
  const bucketTimestamp = Math.floor(timestamp / definition.milliseconds) * definition.milliseconds;
  return { key: String(bucketTimestamp), timestamp: bucketTimestamp };
}

function aggregateOptionsCandles(
  candles: OptionsCandle[],
  timeframe: OptionsChartTimeframe,
  mode: OptionsPriceMode,
) {
  if (timeframe === "1m" || candles.length < 2) return candles;
  const aggregated: OptionsCandle[] = [];
  let activeKey = "";

  for (const candle of candles) {
    const bucket = optionsCandleBucket(candle.timestamp, timeframe, mode);
    const current = aggregated.at(-1);
    if (!current || activeKey !== bucket.key) {
      activeKey = bucket.key;
      aggregated.push({
        timestamp: bucket.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });
      continue;
    }
    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    current.close = candle.close;
    current.volume += candle.volume;
  }
  return aggregated;
}

function aggregateLiveOptionsCandle(
  candles: OptionsCandle[],
  liveCandle: OptionsCandle,
  timeframe: OptionsChartTimeframe,
  mode: OptionsPriceMode,
) {
  if (timeframe === "1m") return liveCandle;
  const liveBucket = optionsCandleBucket(liveCandle.timestamp, timeframe, mode);
  const aggregated: OptionsCandle = {
    timestamp: liveBucket.timestamp,
    open: liveCandle.open,
    high: liveCandle.high,
    low: liveCandle.low,
    close: liveCandle.close,
    volume: liveCandle.volume,
  };
  for (let index = candles.length - 1; index >= 0; index -= 1) {
    const candle = candles[index];
    const bucket = optionsCandleBucket(candle.timestamp, timeframe, mode);
    if (bucket.key !== liveBucket.key) break;
    if (candle.timestamp === liveCandle.timestamp) continue;
    aggregated.timestamp = timeframe === "1D" ? candle.timestamp : liveBucket.timestamp;
    aggregated.open = candle.open;
    aggregated.high = Math.max(aggregated.high, candle.high);
    aggregated.low = Math.min(aggregated.low, candle.low);
    aggregated.volume += candle.volume;
  }
  return aggregated;
}

function preservePublishedLevels(incoming: OptionsFlowPayload, current: OptionsFlowPayload) {
  return {
    ...incoming,
    levels: current.levels,
    marketMap: {
      ...incoming.marketMap,
      expectedMove: current.marketMap.expectedMove,
    },
  };
}

function gammaTone(regime: OptionsFlowPayload["environment"]["gammaRegime"]) {
  if (regime === "POSITIVE") return "text-primary bg-primary/10 border-primary/20";
  if (regime === "NEGATIVE") return "text-danger bg-danger/10 border-danger/20";
  return "text-muted bg-surface border-border";
}

function colorWithAlpha(color: string, alpha: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`overflow-hidden rounded-2xl border border-border bg-panel ${className}`}>{children}</section>;
}

function OptionsChartTimeframeSelect({
  value,
  onChange,
}: {
  value: OptionsChartTimeframe;
  onChange: (value: OptionsChartTimeframe) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = OPTIONS_CHART_TIMEFRAMES.find((timeframe) => timeframe.id === value)!;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative z-[90]">
      <button
        type="button"
        title={selected.label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-7 min-w-[78px] items-center justify-between gap-2 rounded-lg border px-2.5 font-mono text-[10px] font-semibold transition-colors ${
          open
            ? "border-primary/35 bg-primary/10 text-primary"
            : "border-border bg-surface text-foreground hover:border-primary/20"
        }`}
      >
        <span>{value}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Options Flow chart timeframe"
          className="absolute right-0 top-[calc(100%+6px)] z-[100] w-[220px] overflow-hidden rounded-2xl border border-border bg-panel/95 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          <div className="px-2.5 pb-1.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
            Chart timeframe
          </div>
          <div className="grid grid-cols-2 gap-1">
            {OPTIONS_CHART_TIMEFRAMES.map((timeframe) => {
              const active = timeframe.id === value;
              return (
                <button
                  key={timeframe.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(timeframe.id);
                    setOpen(false);
                  }}
                  className={`rounded-xl px-2.5 py-2 text-left transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface"
                  }`}
                >
                  <span className="block font-mono text-[11px] font-semibold">{timeframe.id}</span>
                  <span className="mt-0.5 block text-[9px] text-muted">{timeframe.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PanelHeader({
  title,
  eyebrow,
  icon: Icon,
  trailing,
}: {
  title: string;
  eyebrow?: string;
  icon: typeof Activity;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex h-[52px] items-center gap-3 border-b border-border px-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        {eyebrow ? <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">{eyebrow}</div> : null}
        <h2 className="truncate text-[13px] font-semibold text-foreground">{title}</h2>
      </div>
      {trailing ? <div className="ml-auto">{trailing}</div> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone = "primary",
  wrapValue = false,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "primary" | "danger" | "accent" | "neutral";
  wrapValue?: boolean;
  icon: typeof Activity;
}) {
  const tones = {
    primary: "text-primary bg-primary/10",
    danger: "text-danger bg-danger/10",
    accent: "text-accent bg-accent/10",
    neutral: "text-foreground bg-surface",
  };
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
          <div data-gamma-number="true" className={`mt-2 font-mono font-semibold tracking-tight text-foreground ${wrapValue ? "text-[16px] leading-5" : "truncate text-[20px]"}`}>{value}</div>
        </div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 truncate text-[10px] text-muted">{detail}</div>
    </div>
  );
}

function ExposureProfile({ exposure, stockPrice }: { exposure: ExposureSummary | null; stockPrice: number | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleStrikes = useMemo(() => {
    if (!exposure) return [];
    return [...exposure.strikes].sort((a, b) => b.strike - a.strike);
  }, [exposure]);
  const maximum = Math.max(1, ...visibleStrikes.flatMap((strike) => [Math.abs(strike.call), Math.abs(strike.put)]));
  const nearestStrike = stockPrice === null || !visibleStrikes.length
    ? null
    : visibleStrikes.reduce((best, row) => Math.abs(row.strike - stockPrice) < Math.abs(best.strike - stockPrice) ? row : best).strike;

  useEffect(() => {
    const container = scrollRef.current;
    const target = container?.querySelector<HTMLElement>("[data-near-spot='true']");
    if (!container || !target) return;
    container.scrollTop = Math.max(0, target.offsetTop - container.offsetTop - container.clientHeight / 2 + target.clientHeight / 2);
  }, [nearestStrike]);

  if (!exposure || !visibleStrikes.length) {
    return <div className="flex h-[390px] items-center justify-center text-[12px] text-muted">No exposure profile available</div>;
  }

  return (
    <div ref={scrollRef} className="h-[520px] overflow-y-auto px-4 py-3">
      <div className="sticky top-0 z-10 grid grid-cols-[1fr_72px_1fr_74px] items-center bg-panel pb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
        <span className="text-right">Put exposure</span>
        <span className="text-center">Strike</span>
        <span>Call exposure</span>
        <span className="text-right">Net</span>
      </div>
      <div className="space-y-[3px]">
        {visibleStrikes.map((strike) => {
          const nearSpot = strike.strike === nearestStrike;
          return (
            <div
              key={strike.strike}
              data-near-spot={nearSpot ? "true" : undefined}
              className={`grid h-[25px] grid-cols-[1fr_72px_1fr_74px] items-center rounded-md ${nearSpot ? "bg-primary/[0.08]" : "hover:bg-surface/60"}`}
            >
              <div className="flex h-3 justify-end border-r border-border/80">
                <div
                  className="h-full rounded-l-sm bg-danger/75"
                  style={{ width: `${Math.max(1, Math.abs(strike.put) / maximum * 100)}%` }}
                  title={`Put ${formatCompact(strike.put)}`}
                />
              </div>
              <div className={`text-center font-mono text-[10px] ${nearSpot ? "font-semibold text-primary" : "text-foreground"}`}>
                {strike.strike.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </div>
              <div className="flex h-3 border-l border-border/80">
                <div
                  className="h-full rounded-r-sm bg-primary/75"
                  style={{ width: `${Math.max(1, Math.abs(strike.call) / maximum * 100)}%` }}
                  title={`Call ${formatCompact(strike.call)}`}
                />
              </div>
              <div className={`text-right font-mono text-[9px] ${strike.net >= 0 ? "text-primary" : "text-danger"}`}>
                {formatCompact(strike.net)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mapOptionsLevelToChart(level: number, anchoredScale: number, anchoredBasis: number) {
  return level * anchoredScale + anchoredBasis;
}

function newYorkSessionMinute(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

function futuresExpectedMove(data: OptionsFlowPayload, calibratedSessionOpen: number | null): ExpectedMoveRange | null {
  const source = data.marketMap.expectedMove;
  if (!source || data.marketData.mode !== "FUTURES") return source;
  const sessionOpen = data.marketData.candles.find((candle) => {
    const clock = newYorkSessionMinute(candle.timestamp);
    return clock.date === data.session.sessionDate && clock.minute === 9 * 60 + 30;
  })?.open ?? calibratedSessionOpen;
  if (sessionOpen === null || sessionOpen <= 0) return null;
  const moveDollars = sessionOpen * source.movePercent;
  return {
    ...source,
    anchorPrice: sessionOpen,
    anchorLabel: "SESSION_OPEN",
    moveDollars,
    min: sessionOpen - moveDollars,
    max: sessionOpen + moveDollars,
  };
}

function mapKeyLevelToChart(
  level: OptionsKeyLevel,
  anchoredScale: number,
  anchoredBasis: number,
  expectedMove: ExpectedMoveRange | null,
) {
  if (level.kind === "EXPECTED_MOVE_MAX") return expectedMove?.max ?? null;
  if (level.kind === "EXPECTED_MOVE_MIN") return expectedMove?.min ?? null;
  return mapOptionsLevelToChart(level.price, anchoredScale, anchoredBasis);
}

function levelTone(level: OptionsKeyLevel) {
  if (level.kind === "EXPECTED_MOVE_MAX" || level.kind === "EXPECTED_MOVE_MIN") return "text-warning";
  if (level.kind === "MAJOR_POSITIVE_OI" || level.kind === "MAJOR_POSITIVE_VOLUME") return "text-primary";
  if (level.kind === "GEX_CLUSTER") return "text-accent";
  if (level.kind.includes("PUT") || level.kind === "ZERO_DTE_MAX_PAIN") return "text-danger";
  if (level.kind.includes("CALL")) return "text-primary";
  return "text-accent";
}

function levelSignal(level: OptionsKeyLevel) {
  if (level.metric === "EXPECTED_MOVE_1SIGMA") return formatPercent(Math.abs(level.value ?? 0));
  return formatCompact(level.value);
}

function chartLevelLabel(level: OptionsKeyLevel) {
  switch (level.kind) {
    case "ZERO_DTE_CALL_WALL": return "0DTE call";
    case "ZERO_DTE_PUT_WALL": return "0DTE put";
    case "ZERO_DTE_MAGNET": return "0DTE magnet";
    case "ZERO_DTE_MAX_PAIN": return "0DTE max pain";
    case "ZERO_DTE_PUT_SUPPORT": return "0DTE support";
    case "GAMMA_MAGNET": return "Magnet";
    case "GAMMA_CENTRE": return "KWANT center";
    case "HIGH_VOL_LEVEL": return "HVL";
    case "ZERO_GAMMA": return "Zero Gamma";
    case "MAJOR_POSITIVE_OI": return "MPO";
    case "MAJOR_POSITIVE_VOLUME": return "MPV";
    case "PUT_SUPPORT": return "Put support";
    default: return level.label;
  }
}

function KeyLevelsTable({ data, anchoredBasis, anchoredScale, expectedMove }: { data: OptionsFlowPayload; anchoredBasis: number; anchoredScale: number; expectedMove: ExpectedMoveRange | null }) {
  if (!data.levels.keyLevels.length) {
    return <div className="flex h-[330px] items-center justify-center text-[12px] text-muted">No key levels available</div>;
  }

  return (
    <div className="max-h-[520px] overflow-y-auto">
      <div className="sticky top-0 z-10 grid grid-cols-[minmax(150px,1fr)_88px_88px_78px] gap-3 border-b border-border bg-panel px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>Level</span><span className="text-right">Options</span><span className="text-right">Chart</span><span className="text-right">Signal</span>
      </div>
      {data.levels.keyLevels.map((level) => (
        <div key={level.id} className="grid grid-cols-[minmax(150px,1fr)_88px_88px_78px] items-center gap-3 border-b border-border/70 px-4 py-3 text-[10px] hover:bg-surface/50" title={level.explanation}>
          <span className="min-w-0">
            <span className={`block truncate font-semibold ${levelTone(level)}`}>{level.label}</span>
            <span className="mt-0.5 block truncate text-[9px] text-muted">{level.scope === "ZERO_DTE" ? `0DTE · ${data.session.sessionDate}` : level.scope === "SESSION" ? "Session model" : "Full chain"}</span>
          </span>
          <span className="text-right font-mono text-foreground">{formatPrice(level.price)}</span>
          <span className="text-right font-mono text-foreground">{formatPrice(mapKeyLevelToChart(level, anchoredScale, anchoredBasis, expectedMove))}</span>
          <span className="text-right font-mono text-muted">{levelSignal(level)}</span>
        </div>
      ))}
    </div>
  );
}

function DriftChart({ points }: { points: PremiumDriftPoint[] }) {
  const geometry = useMemo(() => {
    const width = 720;
    const height = 210;
    const padding = 18;
    if (points.length < 2) return { width, height, callPath: "", putPath: "", lastCall: 0, lastPut: 0 };
    const callValues = points.map((point) => point.cumulativeCallPremium);
    const putValues = points.map((point) => -point.cumulativePutPremium);
    const maximum = Math.max(1, ...callValues.map(Math.abs), ...putValues.map(Math.abs));
    const x = (index: number) => padding + index / (points.length - 1) * (width - padding * 2);
    const y = (value: number) => height / 2 - value / maximum * (height / 2 - padding);
    const path = (values: number[]) => values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    return {
      width,
      height,
      callPath: path(callValues),
      putPath: path(putValues),
      lastCall: callValues.at(-1) ?? 0,
      lastPut: Math.abs(putValues.at(-1) ?? 0),
    };
  }, [points]);

  if (points.length < 2) {
    return <div className="flex h-[210px] items-center justify-center text-[12px] text-muted">Premium drift is unavailable for this session</div>;
  }

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center justify-between gap-4 text-[10px]">
        <span data-gamma-number="true" className="flex items-center gap-1.5 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Calls {formatCompact(geometry.lastCall, true)}</span>
        <span data-gamma-number="true" className="flex items-center gap-1.5 text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" /> Puts {formatCompact(geometry.lastPut, true)}</span>
      </div>
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} className="h-[210px] w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative call and put premium drift">
        <defs>
          <linearGradient id="callFlowFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="putFlowFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--danger)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--danger)" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={geometry.width} y1={geometry.height * ratio} y2={geometry.height * ratio} stroke="var(--grid-color)" strokeWidth="1" />)}
        <line x1="0" x2={geometry.width} y1={geometry.height / 2} y2={geometry.height / 2} stroke="var(--border)" strokeWidth="1" />
        <path d={`${geometry.callPath} L${geometry.width - 18},${geometry.height / 2} L18,${geometry.height / 2} Z`} fill="url(#callFlowFill)" />
        <path d={`${geometry.putPath} L${geometry.width - 18},${geometry.height / 2} L18,${geometry.height / 2} Z`} fill="url(#putFlowFill)" />
        <path d={geometry.callPath} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={geometry.putPath} fill="none" stroke="var(--danger)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function ExpirationStack({ exposure }: { exposure: ExposureSummary | null }) {
  const expiries = exposure?.expiries.slice(0, 8) ?? [];
  const maximum = Math.max(1, ...expiries.map((item) => Math.abs(item.call) + Math.abs(item.put)));
  if (!expiries.length) return <div className="flex h-[180px] items-center justify-center text-[12px] text-muted">No expiration data</div>;
  return (
    <div className="space-y-3 px-4 py-4">
      {expiries.map((expiry) => {
        const callWidth = Math.abs(expiry.call) / maximum * 100;
        const putWidth = Math.abs(expiry.put) / maximum * 100;
        return (
          <div key={expiry.expiration}>
            <div className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="font-mono text-foreground">{new Date(`${expiry.expiration}T00:00:00`).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</span>
              <span data-gamma-number="true" className={expiry.net >= 0 ? "text-primary" : "text-danger"}>{formatCompact(expiry.net)}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full bg-danger/70" style={{ width: `${putWidth}%` }} />
              <div className="h-full bg-primary/70" style={{ width: `${callWidth}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FlowBoard({ rows, selected, onSelect }: { rows: FlowBoardItem[]; selected: string; onSelect: (ticker: string) => void }) {
  if (!rows.length) return <div className="flex h-[440px] items-center justify-center text-[12px] text-muted">Market flow board unavailable</div>;
  return (
    <div className="max-h-[440px] overflow-y-auto">
      {rows.map((row) => (
        <button
          key={row.ticker}
          type="button"
          onClick={() => onSelect(row.ticker)}
          className={`grid w-full grid-cols-[54px_1fr_72px] items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-surface/60 ${selected === row.ticker ? "bg-primary/[0.06]" : ""}`}
        >
          <span className={`font-mono text-[12px] font-semibold ${selected === row.ticker ? "text-primary" : "text-foreground"}`}>{row.ticker}</span>
          <span className="min-w-0">
            <span data-gamma-number="true" className="mb-1 flex justify-between text-[9px] text-muted"><span>Bear {formatPercent(1 - row.bullishShare)}</span><span>Bull {formatPercent(row.bullishShare)}</span></span>
            <span className="flex h-1.5 overflow-hidden rounded-full bg-surface"><span className="bg-danger/80" style={{ width: `${(1 - row.bullishShare) * 100}%` }} /><span className="bg-primary/80" style={{ width: `${row.bullishShare * 100}%` }} /></span>
          </span>
          <span className={`text-right font-mono text-[10px] ${row.netPremium >= 0 ? "text-primary" : "text-danger"}`}>{formatCompact(row.netPremium, true)}</span>
        </button>
      ))}
    </div>
  );
}

function LoadingScreen() {
  return (
    <KwantLoader
      className="flex-1"
      icon={Waves}
      title="Loading live options positioning"
      detail="Exposure, volatility, flow and price"
    />
  );
}


export default function GammaWorkspace() {
  const cachedInitialData = readWorkspaceData<OptionsFlowPayload>(optionsFlowCacheKey("QQQ", "CASH"));
  const initialData = canRenderOptionsPayload(cachedInitialData) ? cachedInitialData : null;
  const pageScrollRef = useRef<HTMLDivElement | null>(null);
  const [symbol, setSymbol] = useState("QQQ");
  const [priceMode, setPriceMode] = useState<OptionsPriceMode>("CASH");
  const [activeGreek, setActiveGreek] = useState<GreekMode>("GAMMA");
  const [gexScope, setGexScope] = useState<"FULL_CHAIN" | "ZERO_DTE">("FULL_CHAIN");
  const [data, setData] = useState<OptionsFlowPayload | null>(initialData);
  const [chartMarketPreview, setChartMarketPreview] = useState<ChartMarketPreview | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricePulseMs, setPricePulseMs] = useState(2_000);
  const [priceTick, setPriceTick] = useState<"UP" | "DOWN" | "FLAT">("FLAT");
  const [instrumentMenuOpen, setInstrumentMenuOpen] = useState(false);

  useEffect(() => {
    const pageScroller = pageScrollRef.current;
    if (!pageScroller) return;

    const routeWheelToPage = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();

      const deltaMultiplier = event.deltaMode === 1
        ? 32
        : event.deltaMode === 2
          ? pageScroller.clientHeight
          : 1;
      pageScroller.scrollTop += event.deltaY * deltaMultiplier;
    };

    pageScroller.addEventListener("wheel", routeWheelToPage, { capture: true, passive: false });
    return () => pageScroller.removeEventListener("wheel", routeWheelToPage, { capture: true });
  }, [data]);
  const instrumentMenuRef = useRef<HTMLDivElement>(null);
  const livePriceRef = useRef<HTMLSpanElement>(null);
  const previousPriceRef = useRef<number | null>(null);
  const requestIdRef = useRef<Record<"CORE" | "FULL", number>>({ CORE: 0, FULL: 0 });
  const dataRef = useRef<OptionsFlowPayload | null>(initialData);
  const liveRecoveryAttemptRef = useRef(0);

  useEffect(() => {
    if (!instrumentMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!instrumentMenuRef.current?.contains(event.target as Node)) setInstrumentMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInstrumentMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [instrumentMenuOpen]);

  const loadData = useCallback(async (
    nextSymbol: string,
    nextPriceMode: OptionsPriceMode,
    manual = false,
    background = false,
    detailMode: "CORE" | "FULL" = "FULL",
  ) => {
    const requestId = ++requestIdRef.current[detailMode];
    let keepLoading = false;
    if (manual) setRefreshing(true);
    else if (!background) setLoading(true);
    try {
      const payload = await fetchWorkspaceData<OptionsFlowPayload>(
        `${optionsFlowCacheKey(nextSymbol, nextPriceMode)}:${detailMode}`,
        `/api/options-flow?symbol=${encodeURIComponent(nextSymbol)}&priceMode=${nextPriceMode}&detail=${detailMode}`,
        { force: true },
      );
      if (requestId !== requestIdRef.current[detailMode]) return;
      if (!canRenderOptionsPayload(payload)) {
        const active = dataRef.current;
        setError(active
          ? "The live Gamma refresh returned no usable frame. Holding the last verified snapshot."
          : "KwantData returned no usable Gamma frame.");
        return;
      }
      const active = dataRef.current;
      const nextPayload = detailMode === "CORE" && active
        ? mergeCoreOptionsPayload(active, payload)
        : payload;
      dataRef.current = nextPayload;
      setData(nextPayload);
      writeWorkspaceData(optionsFlowCacheKey(nextSymbol, nextPriceMode), nextPayload);
      setError(null);
    } catch (loadError) {
      if (requestId !== requestIdRef.current[detailMode]) return;
      const active = dataRef.current;
      setError(loadError instanceof Error ? loadError.message : "Options Flow could not be loaded.");
      // Keep any verified frame already on screen. A live refresh failure is a
      // stale-data condition, not permission to destroy the workspace.
      if (active) keepLoading = false;
    } finally {
      if (requestId !== requestIdRef.current[detailMode]) return;
      if (!keepLoading) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cachedCandidate = readWorkspaceData<OptionsFlowPayload>(optionsFlowCacheKey(symbol, priceMode));
    const cached = canRenderOptionsPayload(cachedCandidate) ? cachedCandidate : null;
    if (cached) {
      dataRef.current = cached;
      setData(cached);
      setLoading(false);
      setError(null);
    } else {
      dataRef.current = null;
      setData(null);
      setLoading(true);
    }
    const timeout = window.setTimeout(() => {
      void (async () => {
        if (!cached) await loadData(symbol, priceMode, false, false, "CORE");
        await loadData(symbol, priceMode, false, true, "FULL");
      })();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData, priceMode, symbol]);

  useEffect(() => {
    const enforceLiveSession = () => {
      const current = dataRef.current;
      if (!getNewYorkOptionsClock().marketOpen || loading || !current || isFreshLiveOptionsPayload(current)) return;
      const now = Date.now();
      if (now - liveRecoveryAttemptRef.current < 10_000) return;
      liveRecoveryAttemptRef.current = now;
      void (async () => {
        await loadData(symbol, priceMode, false, true, "CORE");
        await loadData(symbol, priceMode, false, true, "FULL");
      })();
    };
    const interval = window.setInterval(enforceLiveSession, 2_000);
    return () => window.clearInterval(interval);
  }, [loadData, loading, priceMode, symbol]);

  useEffect(() => {
    const interval = window.setInterval(
      () => void loadData(symbol, priceMode, false, true, "CORE"),
      data?.refreshAfterMs ?? LEVEL_REFRESH_MS,
    );
    return () => window.clearInterval(interval);
  }, [data?.refreshAfterMs, loadData, priceMode, symbol]);

  useEffect(() => {
    const interval = window.setInterval(
      () => void loadData(symbol, priceMode, false, true, "FULL"),
      data?.session.marketOpen ? FULL_POSITIONING_REFRESH_MS : 5 * 60_000,
    );
    return () => window.clearInterval(interval);
  }, [data?.session.marketOpen, loadData, priceMode, symbol]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const marketKey = `${symbol}:${priceMode}`;
    setChartMarketPreview(null);

    const pollMarket = async () => {
      let nextDelay = 2_000;
      try {
        const response = await fetch(
          `/api/options-flow/market-data?symbol=${encodeURIComponent(symbol)}&priceMode=${priceMode}`,
          { cache: "no-store" },
        );
        const payload = await response.json() as OptionsMarketPulsePayload & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Live options price pulse failed.");
        if (cancelled || payload.symbol !== symbol) return;

        const current = dataRef.current;
        const marketData: OptionsMarketData = {
          ...payload.marketData,
          candles: mergeCandles(current?.marketData.candles ?? [], payload.marketData.candles),
        };
        setChartMarketPreview({ key: marketKey, marketData });
        nextDelay = Math.max(250, payload.refreshAfterMs);
        setPricePulseMs(nextDelay);

        setData((active) => {
          if (!active || active.symbol !== symbol || active.marketData.requestedMode !== priceMode) return active;
          const next: OptionsFlowPayload = {
            ...active,
            stockPrice: priceMode === "CASH" ? marketData.lastPrice ?? active.stockPrice : active.stockPrice,
            candles: mergeCandles(active.candles, marketData.candles),
            marketData,
            rateLimitRemaining: payload.rateLimitRemaining ?? active.rateLimitRemaining,
          };
          dataRef.current = next;
          writeWorkspaceData(optionsFlowCacheKey(symbol, priceMode), next);
          return next;
        });
      } catch {
        nextDelay = 2_000;
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void pollMarket(), nextDelay);
      }
    };

    timer = window.setTimeout(() => void pollMarket(), 0);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [priceMode, symbol]);

  const selectedInstrument = OPTIONS_FLOW_INSTRUMENTS.find((item) => item.symbol === symbol)
    ?? OPTIONS_FLOW_INSTRUMENTS[0];
  const activeMarketKey = `${symbol}:${priceMode}`;
  const headerMarketData = chartMarketPreview?.key === activeMarketKey
    ? chartMarketPreview.marketData
    : data?.marketData ?? null;

  useEffect(() => {
    const nextPrice = headerMarketData?.lastPrice;
    if (nextPrice === null || nextPrice === undefined) return;
    const previousPrice = previousPriceRef.current;
    previousPriceRef.current = nextPrice;
    if (previousPrice === null || nextPrice === previousPrice) return;
    setPriceTick(nextPrice > previousPrice ? "UP" : "DOWN");
    const timeout = window.setTimeout(() => setPriceTick("FLAT"), 500);
    return () => window.clearTimeout(timeout);
  }, [headerMarketData?.lastPrice]);

  const exposure = activeGreek === "GAMMA" && gexScope === "ZERO_DTE"
    ? data?.zeroDteGamma ?? null
    : data?.exposures[activeGreek] ?? null;
  const anchoredLevelBasis = 0;
  const anchoredLevelScale = priceMode === "FUTURES"
    ? data?.marketData.levelPriceScale ?? 1
    : 1;
  const chartExpectedMove = useMemo(
    () => data ? futuresExpectedMove(data, null) : null,
    [data],
  );
  const intelligenceData = useMemo(
    () => data && chartExpectedMove
      ? { ...data, marketMap: { ...data.marketMap, expectedMove: chartExpectedMove } }
      : data,
    [chartExpectedMove, data],
  );

  const changeSymbol = (nextSymbol: string) => {
    requestIdRef.current.CORE += 1;
    requestIdRef.current.FULL += 1;
    setInstrumentMenuOpen(false);
    setData(null);
    dataRef.current = null;
    setLoading(true);
    setChartMarketPreview(null);
    setError(null);
    setSymbol(nextSymbol);
    setPriceMode("CASH");
    setActiveGreek("GAMMA");
    setGexScope("FULL_CHAIN");
  };

  return (
    <div className="kwant-gamma-workspace flex h-full min-h-0 overflow-hidden bg-background text-foreground">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ScanLine className="h-[17px] w-[17px]" />
          </span>
          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-[13px] font-semibold">Options Flow · Gamma</h1>
            <p className="truncate text-[10px] text-muted">Dealer positioning, gamma intelligence and consolidated tape</p>
          </div>
          <div className="hidden h-5 w-px bg-border sm:block" />
          <div ref={instrumentMenuRef} className="relative z-[120]">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={instrumentMenuOpen}
              onClick={() => setInstrumentMenuOpen((open) => !open)}
              className={`group/instrument flex h-8 min-w-[178px] items-center gap-2 rounded-xl border px-2.5 text-left transition-all ${
                instrumentMenuOpen
                  ? "border-primary/35 bg-primary/[0.07] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                  : "border-border bg-surface hover:border-primary/20 hover:bg-card"
              }`}
            >
              <span className="flex h-5 min-w-8 items-center justify-center rounded-md bg-primary/10 px-1.5 font-mono text-[10px] font-semibold text-primary">
                {selectedInstrument.symbol}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                {selectedInstrument.label}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${instrumentMenuOpen ? "rotate-180 text-primary" : "group-hover/instrument:text-foreground"}`} />
            </button>

            {instrumentMenuOpen ? (
              <div
                role="listbox"
                aria-label="Options Flow instrument"
                className="absolute left-0 top-[calc(100%+7px)] z-[130] w-[292px] overflow-hidden rounded-2xl border border-border bg-panel/95 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl"
              >
                <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <span>Options underlying</span>
                  <span>{OPTIONS_FLOW_INSTRUMENTS.length} instruments</span>
                </div>
                <div className="max-h-[372px] space-y-0.5 overflow-y-auto">
                  {OPTIONS_FLOW_INSTRUMENTS.map((instrument) => {
                    const selected = instrument.symbol === symbol;
                    return (
                      <button
                        key={instrument.symbol}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => changeSymbol(instrument.symbol)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                          selected
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-surface"
                        }`}
                      >
                        <span className={`flex h-7 w-11 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-semibold ${
                          selected ? "bg-primary text-background" : "border border-border bg-card text-foreground"
                        }`}>
                          {instrument.symbol}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-medium">{instrument.label}</span>
                          <span className="mt-0.5 block text-[9px] text-muted">
                            {instrument.futuresRoot ? `${instrument.futuresRoot} futures mapping available` : "Cash underlying"}
                          </span>
                        </span>
                        {selected ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          {headerMarketData?.lastPrice !== null && headerMarketData?.lastPrice !== undefined ? <span ref={livePriceRef} data-gamma-number="true" className={`rounded-md px-1.5 py-1 font-mono text-[12px] font-semibold transition-colors duration-150 ${priceTick === "UP" ? "bg-primary/10 text-primary" : priceTick === "DOWN" ? "bg-danger/10 text-danger" : "text-foreground"}`}>{headerMarketData.symbol} {formatPrice(headerMarketData.lastPrice)}</span> : null}
          <div className="ml-auto flex items-center gap-2">
            {headerMarketData ? (
              <span data-gamma-time="true" className="hidden items-center gap-1.5 text-[10px] text-muted md:flex">
                <Clock3 className="h-3 w-3" /> Price {formatClock(headerMarketData.asOf)}
              </span>
            ) : null}
            <span data-gamma-time="true" className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${headerMarketData?.status === "LIVE" ? "border-primary/20 bg-primary/10 text-primary" : headerMarketData?.status === "UNAVAILABLE" ? "border-danger/20 bg-danger/10 text-danger" : "border-border bg-surface text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${headerMarketData?.status === "LIVE" ? "animate-pulse bg-primary" : "bg-muted"}`} /> {headerMarketData ? `${headerMarketData.provider} · ${headerMarketData.status.replace("_", " ")} · ${formatPulse(pricePulseMs)}` : "CONNECTING"}
            </span>
            <button type="button" onClick={() => void loadData(symbol, priceMode, true)} disabled={refreshing} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-foreground disabled:opacity-50" title="Refresh now">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {loading && !data ? <LoadingScreen /> : !data ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <Panel className="max-w-md p-6 text-center">
              <Database className="mx-auto h-6 w-6 text-danger" />
              <h2 className="mt-3 text-[15px] font-semibold">Live options data unavailable</h2>
              <p className="mt-2 text-[12px] leading-5 text-muted">{error || "KwantData did not return a usable response."}</p>
              <button type="button" onClick={() => void loadData(symbol, priceMode)} className="mt-4 rounded-lg bg-primary px-4 py-2 text-[12px] font-semibold text-background">Try again</button>
            </Panel>
          </div>
        ) : (
          <div
            ref={pageScrollRef}
            className="min-h-0 flex-1 overflow-y-auto bg-background p-3 lg:p-4"
          >
            {error ? <div className="mb-3 flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-[11px] text-danger"><Waves className="h-3.5 w-3.5" /> Refresh delayed: {error}. Showing the last good snapshot.</div> : null}
            {!data.session.marketOpen ? (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2.5 text-[10px] leading-4 text-amber-100/85">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                <span>
                  <strong className="font-semibold text-amber-200">New York EOD snapshot</strong>
                  {` · ${data.symbol} · ${data.session.sessionDate} · ${formatNewYorkSnapshot(data.asOf)}. `}
                  Gamma environment, exposure and levels are frozen from the last completed options session. Futures price may tick in Globex, but this is not Monday live options positioning.
                </span>
              </div>
            ) : null}
            {data.errors.length ? <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[10px] text-amber-200/80">Some KwantData panels are temporarily partial: {data.errors.join(" · ")}</div> : null}

            <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <StatCard label="Gamma environment" value={data.environment.gammaStateLabel} detail={`${formatPercent(data.environment.regimeStrength)} normalized |net GEX| / gross GEX`} tone={data.environment.gammaRegime === "POSITIVE" ? "primary" : data.environment.gammaRegime === "NEGATIVE" ? "danger" : "neutral"} wrapValue icon={CircleGauge} />
              <StatCard label="Net GEX" value={formatCompact(data.exposures.GAMMA?.net ?? null, true)} detail="Calls + dealer-signed puts · per 1% move" tone={(data.exposures.GAMMA?.net ?? 0) >= 0 ? "primary" : "danger"} icon={Activity} />
              <StatCard label="0DTE net GEX" value={formatCompact(data.zeroDteGamma?.net ?? null, true)} detail={data.levels.zeroDteAvailable ? `${data.zeroDteGamma?.strikes.length ?? 0} same-day strike levels` : "No same-day expiration for this session"} tone={(data.zeroDteGamma?.net ?? 0) >= 0 ? "primary" : "danger"} icon={Radio} />
              <StatCard label="Put support candidate" value={formatPrice(data.levels.putSupport[0] ?? null)} detail="Within 5% · 75% put GEX · 25% full-chain put OI" tone="danger" icon={Shield} />
              <StatCard label="Volatility state" value={data.environment.volatilityState} detail={`IV rank ${formatPercent(data.environment.ivRank)} · ${data.marketMap.volatility.ivHistorySessions} available sessions`} tone={data.environment.volatilityState === "EXPANSION RISK" ? "danger" : data.environment.volatilityState === "COMPRESSION" ? "primary" : "neutral"} icon={Gauge} />
              <StatCard label="Net options premium" value={formatCompact(data.environment.netPremium, true)} detail={`${formatPercent(data.environment.bullishShare)} bullish share this session`} tone={data.environment.netPremium >= 0 ? "primary" : "danger"} icon={Zap} />
            </div>

            {intelligenceData ? <MarketMapIntelligence data={intelligenceData} /> : null}

            <PositioningIntelligence data={data} />

            <div className="mt-3 grid gap-3 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.65fr)]">
              <Panel>
                <PanelHeader
                  title={`${GREEK_LABELS[activeGreek].label} exposure by strike · ${exposure?.strikes.length ?? 0} levels`}
                  eyebrow={`${GREEK_LABELS[activeGreek].description} · ${gexScope === "ZERO_DTE" ? "same-day expiry" : "all expirations"}`}
                  icon={BarChart3}
                  trailing={<span className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${gammaTone(data.environment.gammaRegime)}`}>{data.environment.gammaStateLabel}</span>}
                />
                <div className="flex gap-1 border-b border-border px-4 py-2">
                  {(Object.keys(GREEK_LABELS) as GreekMode[]).map((mode) => (
                    <button key={mode} type="button" onClick={() => { setActiveGreek(mode); if (mode !== "GAMMA") setGexScope("FULL_CHAIN"); }} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors ${activeGreek === mode ? "bg-primary text-background" : "text-muted hover:bg-surface hover:text-foreground"}`}>{GREEK_LABELS[mode].short}</button>
                  ))}
                  {activeGreek === "GAMMA" ? <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5"><button type="button" onClick={() => setGexScope("FULL_CHAIN")} className={`rounded-md px-2 py-1 text-[9px] font-semibold ${gexScope === "FULL_CHAIN" ? "bg-panel text-foreground" : "text-muted"}`}>Full chain</button><button type="button" disabled={!data.levels.zeroDteAvailable} onClick={() => setGexScope("ZERO_DTE")} className={`rounded-md px-2 py-1 text-[9px] font-semibold disabled:opacity-40 ${gexScope === "ZERO_DTE" ? "bg-panel text-foreground" : "text-muted"}`}>0DTE</button></div> : null}
                </div>
                <ExposureProfile exposure={exposure} stockPrice={data.stockPrice} />
              </Panel>

              <Panel>
                <PanelHeader title="Key options levels" eyebrow="Raw KwantData inputs · transparent Kwantify ranking" icon={TableProperties} trailing={<span className="text-[9px] uppercase tracking-[0.14em] text-muted">{data.levels.keyLevels.length} levels</span>} />
                <KeyLevelsTable data={data} anchoredBasis={anchoredLevelBasis} anchoredScale={anchoredLevelScale} expectedMove={chartExpectedMove} />
              </Panel>
            </div>

            <div className="mt-3 grid gap-3 2xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,.55fr)_minmax(300px,.7fr)]">
              <Panel>
                <PanelHeader title="Intraday premium drift" eyebrow="Cumulative 5-minute KwantData buckets" icon={Activity} />
                <DriftChart points={data.drift} />
              </Panel>
              <Panel>
                <PanelHeader title={`${GREEK_LABELS[activeGreek].short} by expiration`} eyebrow="Front expirations" icon={Sparkles} />
                <ExpirationStack exposure={exposure} />
              </Panel>
              <Panel>
                <PanelHeader title="Flow across instruments" eyebrow="Session premium leaders" icon={Layers3} trailing={<span className="text-[9px] uppercase tracking-[0.14em] text-muted">Select</span>} />
                <FlowBoard rows={data.flowBoard} selected={symbol} onSelect={changeSymbol} />
              </Panel>
            </div>

            <Panel className="mt-3">
              <PanelHeader title="Live consolidated options tape" eyebrow="Sweeps, blocks and splits" icon={ScanLine} trailing={<span className="text-[10px] text-muted">{data.flow.length} latest prints</span>} />
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[78px_64px_64px_84px_76px_78px_90px_72px_82px_1fr] gap-3 border-b border-border bg-surface/40 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                    <span>Time</span><span>Type</span><span>C / P</span><span>Expiry</span><span>Strike</span><span>Size</span><span>Premium</span><span>Side</span><span>Sentiment</span><span>Flags</span>
                  </div>
                  {data.flow.length ? data.flow.map((row) => (
                    <div key={row.id} className="grid grid-cols-[78px_64px_64px_84px_76px_78px_90px_72px_82px_1fr] items-center gap-3 border-b border-border/70 px-4 py-2.5 text-[10px] transition-colors hover:bg-surface/50">
                      <span data-gamma-time="true" className="font-mono text-muted">{formatClock(row.tradeTime)}</span>
                      <span className="font-semibold text-foreground">{row.consolidationType}</span>
                      <span className={row.contractType === "CALL" ? "font-semibold text-primary" : "font-semibold text-danger"}>{row.contractType}</span>
                      <span className="font-mono text-muted">{row.expirationDate ? new Date(`${row.expirationDate}T00:00:00`).toLocaleDateString("en-AU", { day: "2-digit", month: "short" }) : "—"}</span>
                      <span className="font-mono text-foreground">{formatPrice(row.strikePrice)}</span>
                      <span className="font-mono text-muted">{formatCompact(row.size)}</span>
                      <span className="font-mono font-semibold text-foreground">{formatCompact(row.premium, true)}</span>
                      <span className="font-mono text-muted">{row.side}</span>
                      <span className={`inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-semibold ${row.sentiment === "BULLISH" ? "bg-primary/10 text-primary" : row.sentiment === "BEARISH" ? "bg-danger/10 text-danger" : "bg-surface text-muted"}`}>{row.sentiment === "BULLISH" ? <ArrowUpRight className="h-3 w-3" /> : row.sentiment === "BEARISH" ? <ArrowDownRight className="h-3 w-3" /> : null}{row.sentiment}</span>
                      <span className="flex gap-1.5">{row.unusual ? <span className="rounded-md bg-accent/10 px-1.5 py-1 text-[9px] font-semibold text-accent">UNUSUAL</span> : null}{row.opening ? <span className="rounded-md bg-secondary/10 px-1.5 py-1 text-[9px] font-semibold text-secondary">OPENING</span> : null}</span>
                    </div>
                  )) : <div className="py-14 text-center text-[12px] text-muted">No consolidated prints returned for {symbol}</div>}
                </div>
              </div>
            </Panel>

            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-panel px-4 py-3 text-[10px] leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
              <span>GEX is raw KwantData call + dealer-signed put exposure. Gamma strength is normalized for the selected asset as |net GEX| / gross GEX: weak &lt;5%, moderate &lt;15%, strong &lt;30%, and extreme ≥30%; below 0.5% is neutral/balanced. Walls, magnet, centre and put-support candidates are transparent Kwantify rankings inside a ±3% near-the-money band; support candidates are concentrations, not guaranteed price floors. 0DTE uses expiration {data.session.sessionDate}. Open interest can lag the session open. {data.marketData.mode === "FUTURES" ? `${data.marketData.symbol} ticks independently; options levels use the last sane concurrent futures/source ratio, recalibrated every 10 minutes and immediately on a contract roll.` : "Chart and option strikes share the cash-underlying scale; price ticks do not reposition published levels."}</span>
              <span className="shrink-0 font-mono">KwantData quota {data.rateLimitRemaining ?? "—"} remaining</span>
            </div>
            </>
          </div>
        )}
      </main>
    </div>
  );
}
