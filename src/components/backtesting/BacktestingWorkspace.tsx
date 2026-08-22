"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  FlaskConical,
  GripVertical,
  Layers3,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Candle } from "@/lib/backtester";
import type { ChartLevel, ChartZone } from "@/components/Chart";
import type { ChartGammaLevelsPayload, ChartGammaSourceLevelKind } from "@/lib/chartGammaLevels";
import { mergeGammaLevelsAtSamePrice } from "@/lib/chartGammaLevels";
import type { GameplanPayload, GameplanRole } from "@/lib/gameplan";
import { CHART_SETTINGS_CHANGE_EVENT, CHART_SETTINGS_STORAGE_KEY, chartSettingsEqual, defaultChartSettings, loadStoredChartSettings, type ChartSettings } from "@/lib/chartSettings";
import KwantLoader from "@/components/KwantLoader";
import ChartIndicatorsControl, { type ChartLevelControl } from "@/components/ChartIndicatorsControl";
import HistoricalGexPanel from "@/components/backtesting/HistoricalGexPanel";
import HistoricalZyonPanel from "@/components/backtesting/HistoricalZyonPanel";
import ReplayDatePicker from "@/components/backtesting/ReplayDatePicker";
import KwantSelect from "@/components/ui/KwantSelect";
import TimeZoneSelect from "@/components/ui/TimeZoneSelect";
import { browserTimeZone, normalizeTimeZone, timeZoneCity } from "@/lib/timeZones";
import type { HistoricalZyonPriceWindow, HistoricalZyonReplayInput } from "@/lib/historicalZyon";
import {
  CHART_INTERVAL_GROUPS,
  formatChartInterval,
  makeCustomChartInterval,
  parseChartIntervalInput,
  supportsChartInterval,
  type ChartIntervalKind,
} from "@/lib/chartIntervals";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "@/lib/chartIndicatorConfig";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";
import type { PaperPosition, PaperProtectionUpdate, PaperTradeFill } from "@/lib/paperTrading";

const Chart = dynamic(() => import("@/components/Chart"), {
  ssr: false,
  loading: () => <KwantLoader className="h-full" compact title="Opening replay chart" detail="Preparing the historical workspace." />,
});

type ReplayInstrument = "NQ" | "MNQ" | "ES" | "MES";
type ReplayTimeframe = string;
type LevelFamily = "gamma" | "quant" | "valueArea";
type ReplayDockKind = "gex" | "zyon";

type BacktestingWorkspaceProps = {
  onReplayExecutionQuote?: (quote: {
    symbol: string;
    bid: number;
    ask: number;
    mid: number;
    timestamp: number;
  }) => void;
  paperPositions?: PaperPosition[];
  paperFills?: PaperTradeFill[];
  onUpdatePaperProtection?: (
    accountId: string,
    positionId: string,
    update: PaperProtectionUpdate,
  ) => void;
  onPaperProtectionDragStateChange?: (positionId: string, dragging: boolean) => void;
  onClosePaperPosition?: (position: PaperPosition) => void;
  onRemovePaperFills?: (fillIds: string[]) => void;
  onResetPaperTrading?: () => void;
};

const REPLAY_INDICATORS_STORAGE_KEY = "kwantdesk:historical-replay:indicators:v1";

function defaultReplayIndicators(theme: ChartSettings): ChartIndicatorInstance[] {
  const requestedReplayStudies = [
    "kwant-profile",
    "cumulative-volume-delta",
    "big-trades",
    "deep-m-effort-nq",
    "weekly-volume-profile",
    "tpo-chart",
    "volume",
    "vwap",
  ];
  return [{
    instanceId: "historical-replay-ib-levels",
    indicatorId: "ib-levels",
    enabled: true,
    settings: {
      ...defaultIndicatorSettings("ib-levels", theme),
      durationMinutes: 30,
      showGlobex: false,
      showTokyo: false,
      showLondon: false,
      showNewYork: true,
      showSydney: false,
      newYorkLabel: "New York",
      newYorkStart: "09:30",
      newYorkEnd: "16:00",
      followSessionsStudy: false,
    },
  }, ...requestedReplayStudies.map((indicatorId) => ({
    instanceId: `historical-replay-${indicatorId}`,
    indicatorId,
    enabled: true,
    settings: defaultIndicatorSettings(indicatorId, theme),
  }))];
}

function loadReplayIndicators(theme: ChartSettings): ChartIndicatorInstance[] {
  if (typeof window === "undefined") return defaultReplayIndicators(theme);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REPLAY_INDICATORS_STORAGE_KEY) ?? "null") as unknown;
    if (!Array.isArray(parsed)) return defaultReplayIndicators(theme);
    const normalized = parsed
      .filter((value): value is ChartIndicatorInstance => Boolean(
        value
        && typeof value === "object"
        && typeof (value as ChartIndicatorInstance).instanceId === "string"
        && typeof (value as ChartIndicatorInstance).indicatorId === "string",
      ))
      .map(normalizeStoredIndicator);
    return normalized;
  } catch {
    return defaultReplayIndicators(theme);
  }
}

const DEFAULT_REPLAY_DOCK_WIDTH = 380;
const MIN_REPLAY_DOCK_WIDTH = 240;
const COLLAPSE_REPLAY_DOCK_WIDTH = 150;

function ResizableReplayDock({
  open,
  order,
  width,
  multiPanel,
  label,
  onResize,
  onCollapse,
  children,
}: {
  open: boolean;
  order: number;
  width: number;
  multiPanel: boolean;
  label: string;
  onResize: (width: number) => void;
  onCollapse: () => void;
  children: ReactNode;
}) {
  const dragRef = useRef<{ startX: number; startWidth: number; latestWidth: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const resizeFromPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const maximum = Math.max(
      MIN_REPLAY_DOCK_WIDTH,
      Math.min(620, window.innerWidth * (multiPanel ? 0.38 : 0.68)),
    );
    const nextWidth = Math.max(64, Math.min(maximum, drag.startWidth + drag.startX - event.clientX));
    drag.latestWidth = nextWidth;
    onResize(nextWidth);
  };

  const finishResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const latestWidth = dragRef.current?.latestWidth ?? width;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (latestWidth <= COLLAPSE_REPLAY_DOCK_WIDTH) {
      onCollapse();
      return;
    }
    if (latestWidth < MIN_REPLAY_DOCK_WIDTH) onResize(MIN_REPLAY_DOCK_WIDTH);
  };

  return (
    <section
      aria-hidden={!open}
      className={`relative h-full min-w-0 shrink-0 overflow-visible ${dragging ? "select-none" : ""}`}
      style={{
        display: open ? "block" : "none",
        order,
        width: `min(${width}px, ${multiPanel ? "38vw" : "68vw"})`,
      }}
    >
      <button
        type="button"
        role="separator"
        aria-label={`Resize ${label}. Drag fully right to collapse.`}
        aria-orientation="vertical"
        title={`Resize ${label} · drag closed to collapse`}
        onPointerDown={(event) => {
          event.preventDefault();
          const actualWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? width;
          dragRef.current = { startX: event.clientX, startWidth: actualWidth, latestWidth: actualWidth };
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={resizeFromPointer}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
        className={`group absolute inset-y-0 left-0 z-[70] w-3 -translate-x-1/2 cursor-col-resize touch-none outline-none ${dragging ? "bg-primary/10" : ""}`}
      >
        <span className="absolute left-1/2 top-1/2 flex h-14 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-panel text-muted shadow-lg transition group-hover:border-primary/45 group-hover:text-primary">
          <GripVertical className="h-3 w-3" />
        </span>
      </button>
      {children}
    </section>
  );
}

type SessionPayload = {
  candles: Candle[];
  executions?: ReplayExecutionTuple[];
  orderFlow?: {
    requested: boolean;
    ready: boolean;
    source: "historical-executions" | "bars";
    semantics: string;
  };
  dataset: string;
  coverage: { earliestDocumented: string; note: string };
  error?: string;
};

type ReplayExecutionTuple = [
  timestamp: number,
  price: number,
  size: number,
  delta: number,
  askVolume?: number,
  bidVolume?: number,
  trades?: number,
  kind?: "flow",
];

type CompletedProfile = {
  start: string;
  end: string;
  label: string;
  vah: number;
  val: number;
  poc: number;
  vwap: number;
};

type ValueAreaPayload = {
  generatedAt: string;
  daily: CompletedProfile;
  weekly: CompletedProfile;
  error?: string;
};

const INSTRUMENTS: Array<{ id: ReplayInstrument; symbol: string; label: string }> = [
  { id: "NQ", symbol: "NQ.v.0", label: "NQ · E-mini Nasdaq-100" },
  { id: "MNQ", symbol: "MNQ.v.0", label: "MNQ · Micro Nasdaq-100" },
  { id: "ES", symbol: "ES.v.0", label: "ES · E-mini S&P 500" },
  { id: "MES", symbol: "MES.v.0", label: "MES · Micro S&P 500" },
];
const DEFAULT_FAVOURITE_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"];
const SPEEDS = [1, 2, 8, 10, 20, 40, 100, 200] as const;
const REPLAY_TIME_ZONE_STORAGE_KEY = "kwantdesk:backtesting-timezone:v1";
const REPLAY_LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const REPLAY_FORWARD_MS = 24 * 60 * 60_000;
const REPLAY_LOAD_TIMEOUT_MS = 20_000;
const REPLAY_ORDER_FLOW_TIMEOUT_MS = 120_000;
const REPLAY_TICK_WINDOW_MS = 6 * 60 * 60_000;
const REPLAY_TICK_PREFETCH_MS = 10 * 60_000;

function replayIntervalMs(timeframe: string) {
  const match = timeframe.match(/^(\d+)(s|m|h|D|W|M)$/);
  if (!match) return null;
  const value = Math.max(1, Number(match[1]));
  const unitMs: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 60 * 60_000,
    D: 24 * 60 * 60_000,
    W: 7 * 24 * 60 * 60_000,
    M: 30 * 24 * 60 * 60_000,
  };
  return value * unitMs[match[2]];
}

function firstCandleAtOrAfter(candles: Candle[], timestamp: number) {
  let low = 0;
  let high = candles.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (candles[middle].timestamp < timestamp) low = middle + 1;
    else high = middle;
  }
  return low;
}

function firstCandleAfter(candles: Candle[], timestamp: number) {
  let low = 0;
  let high = candles.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (candles[middle].timestamp <= timestamp) low = middle + 1;
    else high = middle;
  }
  return low;
}

function historicalCandlesAtClock(
  candles: Candle[],
  oneSecondBars: Candle[],
  timeframe: string,
  clock: number | null,
) {
  if (!candles.length || clock === null) return [];
  const intervalMs = replayIntervalMs(timeframe);
  if (!intervalMs) return candles.filter((candle) =>
    Number(candle.sourceEndTimestamp ?? candle.timestamp) <= clock);

  const bucketStart = Math.floor(clock / intervalMs) * intervalMs;
  const completedEnd = firstCandleAtOrAfter(candles, bucketStart);
  const completed = candles.slice(0, completedEnd);
  const tickStart = firstCandleAtOrAfter(oneSecondBars, bucketStart);
  const tickEnd = firstCandleAfter(oneSecondBars, clock);
  const intrabar = oneSecondBars.slice(tickStart, tickEnd);
  if (intrabar.length) {
    let high = intrabar[0].high;
    let low = intrabar[0].low;
    let volume = 0;
    intrabar.forEach((bar) => {
      high = Math.max(high, bar.high);
      low = Math.min(low, bar.low);
      volume += bar.volume ?? 0;
    });
    return [
      ...completed,
      {
        timestamp: bucketStart,
        open: intrabar[0].open,
        high,
        low,
        close: intrabar.at(-1)?.close ?? intrabar[0].close,
        volume,
      },
    ];
  }

  const source = candles[completedEnd]?.timestamp === bucketStart ? candles[completedEnd] : undefined;
  if (!source || bucketStart > clock) return completed;
  return [
    ...completed,
    {
      timestamp: bucketStart,
      open: source.open,
      high: source.open,
      low: source.open,
      close: source.open,
      volume: 0,
    },
  ];
}

function replayExecutionTrades(executions: ReplayExecutionTuple[] | undefined): InstitutionalTrade[] {
  if (!executions?.length) return [];
  return executions.flatMap((execution, recordIndex) => {
    const [timestamp, price, size, delta, tupleAskVolume, tupleBidVolume, tupleTrades, kind] = execution;
    if (![timestamp, price, size, delta].every(Number.isFinite) || timestamp <= 0 || price <= 0 || size <= 0) return [];
    const askVolume = Number.isFinite(tupleAskVolume)
      ? Math.max(0, Number(tupleAskVolume))
      : Math.max(0, delta);
    const bidVolume = Number.isFinite(tupleBidVolume)
      ? Math.max(0, Number(tupleBidVolume))
      : Math.max(0, -delta);
    return [{
      eventId: `replay-${timestamp}-${price}-${size}-${recordIndex}`,
      recordIndex,
      timestamp,
      open: price,
      high: price,
      low: price,
      close: price,
      trades: Math.max(1, Number(tupleTrades ?? 1)),
      volume: size,
      bidVolume,
      askVolume,
      delta,
      aggressor: delta > 0 ? "BUY" as const : delta < 0 ? "SELL" as const : "UNKNOWN" as const,
      flowOnly: kind === "flow",
    }];
  });
}

function historicalPriceWindows(candles: Candle[], clock: number): HistoricalZyonPriceWindow[] {
  const windows = [
    ["5M", 5 * 60_000],
    ["15M", 15 * 60_000],
    ["30M", 30 * 60_000],
    ["1H", 60 * 60_000],
    ["4H", 4 * 60 * 60_000],
    ["1D", 24 * 60 * 60_000],
  ] as const;
  return windows.flatMap(([window, duration]): HistoricalZyonPriceWindow[] => {
    const rows = candles.filter((candle) => candle.timestamp >= clock - duration && candle.timestamp <= clock);
    const first = rows[0];
    const last = rows.at(-1);
    if (!first || !last) return [];
    const open = first.open;
    const close = last.close;
    return [{
      window,
      from: new Date(first.timestamp).toISOString(),
      to: new Date(clock).toISOString(),
      bars: rows.length,
      open,
      high: Math.max(...rows.map((row) => row.high)),
      low: Math.min(...rows.map((row) => row.low)),
      close,
      change: close - open,
      changePercent: open ? ((close - open) / open) * 100 : 0,
      volume: rows.reduce((sum, row) => sum + Math.max(0, row.volume ?? 0), 0),
    }];
  });
}

function previousWeekday(date: Date) {
  const value = new Date(date);
  do value.setUTCDate(value.getUTCDate() - 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value;
}

function defaultReplayDate() {
  return previousWeekday(new Date()).toISOString().slice(0, 10);
}

function timeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  ) - date.getTime();
}

function zonedLocalToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const normalized = normalizeTimeZone(timeZone);
  const first = guess - timeZoneOffset(new Date(guess), normalized);
  return first - (timeZoneOffset(new Date(first), normalized) - timeZoneOffset(new Date(guess), normalized));
}

function latestCompletedOptionsSession(replayMs: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(replayMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const date = `${read("year")}-${read("month")}-${read("day")}`;
  const minute = Number(read("hour")) * 60 + Number(read("minute"));
  const utcDate = new Date(`${date}T00:00:00.000Z`);
  const weekday = utcDate.getUTCDay();
  if (weekday >= 1 && weekday <= 5 && minute >= 16 * 60 + 5) return date;
  return previousWeekday(utcDate).toISOString().slice(0, 10);
}

function replayOptionsSnapshot(replayMs: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(replayMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const sessionDate = `${read("year")}-${read("month")}-${read("day")}`;
  const minute = Number(read("hour")) * 60 + Number(read("minute"));
  const weekday = new Date(`${sessionDate}T00:00:00.000Z`).getUTCDay();
  const newYorkOpen = 9 * 60 + 30;
  const newYorkClose = 16 * 60;
  const isTradingDay = weekday >= 1 && weekday <= 5;
  const kwantReleased = isTradingDay && minute >= newYorkOpen + 5;
  if (isTradingDay && minute >= newYorkOpen && minute < newYorkClose) {
    return {
      mode: "INTRADAY" as const,
      sessionDate,
      asOf: new Date(replayMs).toISOString(),
      key: `${sessionDate}:INTRADAY:${minute}`,
      newYorkDate: sessionDate,
      kwantReleased,
    };
  }
  const completedDate = latestCompletedOptionsSession(replayMs);
  return {
    mode: "EOD" as const,
    sessionDate: completedDate,
    asOf: null,
    key: `${completedDate}:EOD`,
    newYorkDate: sessionDate,
    kwantReleased,
  };
}

function formatReplayClock(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timeZone),
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function gammaColor(kind: ChartGammaSourceLevelKind, settings: ChartSettings) {
  if (kind === "PUT_WALL" || kind === "NEGATIVE_GEX" || kind === "EXPECTED_MOVE_MIN") return settings.downColor;
  if (kind === "CALL_WALL" || kind === "POSITIVE_GEX" || kind === "MAJOR_POSITIVE_OI" || kind === "MAJOR_POSITIVE_VOLUME") return settings.upColor;
  if (kind === "ZERO_GAMMA") return "#22D3EE";
  if (kind === "HIGH_VOL_LEVEL") return "#F59E0B";
  return "#A78BFA";
}

function gammaSnapshot(payload: ChartGammaLevelsPayload, settings: ChartSettings): ChartLevel[] {
  const source = payload.sources.find((item) => item.symbol === payload.requestedSource && item.levels.length)
    ?? payload.sources.find((item) => item.levels.length);
  return mergeGammaLevelsAtSamePrice(source?.levels ?? [], 0.25).slice(0, 24).map((level) => ({
    id: `replay-gamma-${payload.sessionDate}-${level.id}`,
    price: level.price,
    color: gammaColor(level.kind, settings),
    label: level.label,
    lineStyle: level.kind === "CALL_WALL" || level.kind === "PUT_WALL" ? "solid" : "dashed",
    lineWidth: level.kind === "CALL_WALL" || level.kind === "PUT_WALL" ? 2 : 1,
    axisLabelVisible: true,
  }));
}

function quantSnapshot(payload: GameplanPayload, settings: ChartSettings) {
  const colors: Record<GameplanRole, string> = {
    magnet: settings.upColor,
    wall: settings.downColor,
    accelerant: "#F59E0B",
    decision: "#22D3EE",
  };
  const levels: ChartLevel[] = payload.plan.ladder.map((row, index) => ({
    id: `replay-quant-${payload.plan.edition.date}-${index}`,
    price: (row.zone[0] + row.zone[1]) / 2,
    color: colors[row.role],
    label: `${row.name} · ${row.role.toUpperCase()}`,
    lineStyle: row.role === "decision" ? "solid" : row.role === "accelerant" ? "dotted" : "dashed",
    lineWidth: row.strength >= 4 ? 2 : 1,
    axisLabelVisible: true,
  }));
  const zones: ChartZone[] = payload.plan.ladder.map((row, index) => ({
    id: `replay-quant-zone-${payload.plan.edition.date}-${index}`,
    low: Math.min(...row.zone),
    high: Math.max(...row.zone),
    color: colors[row.role],
    fillColor: `${colors[row.role]}16`,
    label: row.name,
  }));
  return { levels, zones };
}

function quantSnapshotFromGamma(payload: ChartGammaLevelsPayload, root: "NQ" | "ES", settings: ChartSettings) {
  const source = payload.sources.find((item) => item.symbol === payload.requestedSource && item.levels.length)
    ?? payload.sources.find((item) => item.levels.length);
  const colors: Record<GameplanRole, string> = {
    magnet: settings.upColor,
    wall: settings.downColor,
    accelerant: "#F59E0B",
    decision: "#22D3EE",
  };
  const roleFor = (kind: ChartGammaSourceLevelKind): GameplanRole => {
    if (kind === "GAMMA_MAGNET") return "magnet";
    if (kind === "EXPECTED_MOVE_MAX" || kind === "EXPECTED_MOVE_MIN") return "accelerant";
    if (kind === "GAMMA_CENTRE" || kind === "ZERO_GAMMA") return "decision";
    return "wall";
  };
  const nameFor = (kind: ChartGammaSourceLevelKind) => {
    if (kind === "CALL_WALL") return "THE CEILING";
    if (kind === "PUT_WALL") return "THE FORTRESS";
    if (kind === "GAMMA_MAGNET") return "THE MAGNET";
    if (kind === "GAMMA_CENTRE" || kind === "ZERO_GAMMA") return "THE HINGE";
    if (kind === "EXPECTED_MOVE_MAX") return "THE UPPER EDGE";
    if (kind === "EXPECTED_MOVE_MIN") return "THE TRAPDOOR";
    return "POSITIONING WALL";
  };
  const rows = mergeGammaLevelsAtSamePrice(source?.levels ?? [], 0.25).slice(0, 16);
  const levels: ChartLevel[] = rows.map((row, index) => {
    const role = roleFor(row.kind);
    return {
      id: `replay-quant-intraday-${payload.sessionDate}-${index}`,
      price: row.price,
      color: colors[role],
      label: `${nameFor(row.kind)} · ${role.toUpperCase()}`,
      lineStyle: role === "decision" ? "solid" : role === "accelerant" ? "dotted" : "dashed",
      lineWidth: row.rank <= 2 ? 2 : 1,
      axisLabelVisible: true,
    };
  });
  const zones: ChartZone[] = rows.map((row, index) => {
    const role = roleFor(row.kind);
    const halfWidth = root === "NQ"
      ? role === "magnet" ? 12 : 6
      : role === "magnet" ? 3 : 1.5;
    return {
      id: `replay-quant-intraday-zone-${payload.sessionDate}-${index}`,
      low: row.price - halfWidth,
      high: row.price + halfWidth,
      color: colors[role],
      fillColor: `${colors[role]}16`,
      label: nameFor(row.kind),
    };
  });
  return { levels, zones };
}

function valueAreaSnapshot(payload: ValueAreaPayload): ChartLevel[] {
  const make = (prefix: "PD" | "PW", profile: CompletedProfile, color: string) =>
    (["VAH", "VAL", "POC", "VWAP"] as const).map((kind): ChartLevel => ({
      id: `replay-${prefix}-${kind}-${profile.end}`,
      price: kind === "VAH" ? profile.vah : kind === "VAL" ? profile.val : kind === "POC" ? profile.poc : profile.vwap,
      color,
      label: `${prefix} ${kind}`,
      lineStyle: kind === "POC" ? "solid" : kind === "VWAP" ? "dotted" : "dashed",
      lineWidth: kind === "POC" || kind === "VWAP" ? 2 : 1,
      axisLabelVisible: true,
    }));
  return [...make("PD", payload.daily, "#38BDF8"), ...make("PW", payload.weekly, "#F59E0B")];
}

async function requestJson<T extends { error?: string }>(
  url: string,
  options: { timeoutMs?: number; cache?: RequestCache; timeoutMessage?: string } = {},
) {
  const controller = options.timeoutMs ? new AbortController() : null;
  const timer = options.timeoutMs
    ? window.setTimeout(() => controller?.abort(), options.timeoutMs)
    : null;
  try {
    const response = await fetch(url, {
      cache: options.cache ?? "no-store",
      signal: controller?.signal,
    });
    const payload = await response.json() as T;
    if (!response.ok) throw new Error(payload.error || "Historical data is unavailable.");
    return payload;
  } catch (problem) {
    if (problem instanceof DOMException && problem.name === "AbortError") {
      throw new Error(options.timeoutMessage ?? "Historical request timed out. Retry it.");
    }
    throw problem;
  } finally {
    if (timer !== null) window.clearTimeout(timer);
  }
}

export default function BacktestingWorkspace({
  onReplayExecutionQuote,
  paperPositions = [],
  paperFills = [],
  onUpdatePaperProtection,
  onPaperProtectionDragStateChange,
  onClosePaperPosition,
  onRemovePaperFills,
  onResetPaperTrading,
}: BacktestingWorkspaceProps) {
  const [settings, setSettings] = useState<ChartSettings>(defaultChartSettings);
  const [replayIndicators, setReplayIndicators] = useState<ChartIndicatorInstance[]>(() =>
    loadReplayIndicators(defaultChartSettings));
  const [indicatorSettingsOpenRequest, setIndicatorSettingsOpenRequest] = useState<{
    instanceId: string;
    requestId: number;
  } | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [instrument, setInstrument] = useState<ReplayInstrument>("NQ");
  const [timeframe, setTimeframe] = useState<ReplayTimeframe>("1m");
  const [replayTimeZone, setReplayTimeZone] = useState("America/New_York");
  const [date, setDate] = useState(defaultReplayDate);
  const [time, setTime] = useState("09:30");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [replayStudyCandles, setReplayStudyCandles] = useState<Candle[]>([]);
  const [replayTrades, setReplayTrades] = useState<InstitutionalTrade[]>([]);
  const [orderFlowHistoryReady, setOrderFlowHistoryReady] = useState(false);
  const [oneSecondBars, setOneSecondBars] = useState<Candle[]>([]);
  const [sessionStartAt, setSessionStartAt] = useState<number | null>(null);
  const [replayStartIndex, setReplayStartIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [playbackClock, setPlaybackClock] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [loading, setLoading] = useState(false);
  const [timeframeLoading, setTimeframeLoading] = useState(false);
  const [tickerLoading, setTickerLoading] = useState(false);
  const [tickerError, setTickerError] = useState("");
  const [tickerCoverageStart, setTickerCoverageStart] = useState(0);
  const [tickerCoverageEnd, setTickerCoverageEnd] = useState(0);
  const [favouriteTimeframes, setFavouriteTimeframes] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_FAVOURITE_TIMEFRAMES;
    try {
      const stored = JSON.parse(window.localStorage.getItem("olisa-chart-favourite-intervals") ?? "null") as unknown;
      return Array.isArray(stored) && stored.every((item) => typeof item === "string")
        ? stored.filter((item) => supportsChartInterval(item, "Databento"))
        : DEFAULT_FAVOURITE_TIMEFRAMES;
    } catch {
      return DEFAULT_FAVOURITE_TIMEFRAMES;
    }
  });
  const [showAllTimeframes, setShowAllTimeframes] = useState(false);
  const [intervalDrafts, setIntervalDrafts] = useState<Record<ChartIntervalKind, { primary: number; secondary: number }>>({
    second: { primary: 1, secondary: 1 },
    minute: { primary: 1, secondary: 1 },
    time: { primary: 1, secondary: 1 },
    "volume-bars": { primary: 4, secondary: 2 },
    range: { primary: 40, secondary: 1 },
    volume: { primary: 500, secondary: 1 },
    trade: { primary: 100, secondary: 1 },
    renko: { primary: 8, secondary: 1 },
    "point-figure": { primary: 1, secondary: 27 },
    delta: { primary: 100, secondary: 1 },
  });
  const [intervalCommandOpen, setIntervalCommandOpen] = useState(false);
  const [intervalCommandDraft, setIntervalCommandDraft] = useState("");
  const [intervalCommandError, setIntervalCommandError] = useState("");
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [levelState, setLevelState] = useState<Record<LevelFamily, boolean>>({ gamma: false, quant: false, valueArea: false });
  const [levelLoading, setLevelLoading] = useState(false);
  const [manualLevelLoading, setManualLevelLoading] = useState(false);
  const [levelError, setLevelError] = useState<Record<LevelFamily, string>>({ gamma: "", quant: "", valueArea: "" });
  const [gammaLevels, setGammaLevels] = useState<ChartLevel[]>([]);
  const [gammaPositioning, setGammaPositioning] = useState<ChartGammaLevelsPayload | null>(null);
  const [showGexPanel, setShowGexPanel] = useState(false);
  const [showZyonPanel, setShowZyonPanel] = useState(false);
  const [replayDockOrder, setReplayDockOrder] = useState<ReplayDockKind[]>([]);
  const [replayDockWidths, setReplayDockWidths] = useState<Record<ReplayDockKind, number>>({
    gex: DEFAULT_REPLAY_DOCK_WIDTH,
    zyon: DEFAULT_REPLAY_DOCK_WIDTH,
  });
  const [quantLevels, setQuantLevels] = useState<ChartLevel[]>([]);
  const [quantZones, setQuantZones] = useState<ChartZone[]>([]);
  const [valueAreaLevels, setValueAreaLevels] = useState<ChartLevel[]>([]);
  const [valueAreaSnapshotKey, setValueAreaSnapshotKey] = useState("");
  const [snapshotDate, setSnapshotDate] = useState("");
  const [levelSnapshotKey, setLevelSnapshotKey] = useState("");
  const lastLevelLoadAtRef = useRef(0);
  const pendingLevelRefreshRef = useRef<{ clock: number; futuresPrice: number | null } | null>(null);
  const levelRefreshTimerRef = useRef<number | null>(null);
  const levelRequestIdRef = useRef(0);
  const levelLoadingRef = useRef(false);
  const eodGammaCacheRef = useRef<{
    key: string;
    payload: ChartGammaLevelsPayload & { error?: string };
  } | null>(null);
  const intervalCommandInputRef = useRef<HTMLInputElement>(null);
  const intervalCommandPanelRef = useRef<HTMLDivElement>(null);
  const timeframeMenuRef = useRef<HTMLDivElement>(null);
  const tickerRequestIdRef = useRef(0);

  useEffect(() => {
    const storedSettings = loadStoredChartSettings();
    setSettings(storedSettings);
    setReplayTimeZone(normalizeTimeZone(
      window.localStorage.getItem(REPLAY_TIME_ZONE_STORAGE_KEY)
      ?? browserTimeZone(),
    ));
  }, []);

  useEffect(() => {
    const syncSettings = () => {
      const next = loadStoredChartSettings();
      setSettings((current) => chartSettingsEqual(current, next) ? current : next);
    };
    const syncSettingsAcrossTabs = (event: StorageEvent) => {
      if (event.key === CHART_SETTINGS_STORAGE_KEY) syncSettings();
    };
    window.addEventListener(CHART_SETTINGS_CHANGE_EVENT, syncSettings);
    window.addEventListener("storage", syncSettingsAcrossTabs);
    return () => {
      window.removeEventListener(CHART_SETTINGS_CHANGE_EVENT, syncSettings);
      window.removeEventListener("storage", syncSettingsAcrossTabs);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("olisa-chart-favourite-intervals", JSON.stringify(favouriteTimeframes));
  }, [favouriteTimeframes]);

  useEffect(() => {
    window.localStorage.setItem(REPLAY_INDICATORS_STORAGE_KEY, JSON.stringify(replayIndicators));
  }, [replayIndicators]);

  const selectedDefinition = INSTRUMENTS.find((item) => item.id === instrument) ?? INSTRUMENTS[0];
  const root = instrument === "NQ" || instrument === "MNQ" ? "NQ" : "ES";
  const replayClock = playbackClock;
  const replayDataClock = replayClock === null ? null : Math.floor(replayClock / 1_000) * 1_000;
  const activeOptionsSnapshot = replayClock ? replayOptionsSnapshot(replayClock) : null;
  const visibleCandles = useMemo(
    () => historicalCandlesAtClock(candles, oneSecondBars, timeframe, replayDataClock),
    [candles, oneSecondBars, replayDataClock, timeframe],
  );
  const visibleReplayStudyCandles = useMemo(
    () => historicalCandlesAtClock(replayStudyCandles, oneSecondBars, "1m", replayDataClock),
    [oneSecondBars, replayDataClock, replayStudyCandles],
  );
  const visibleReplayTrades = useMemo(() => {
    if (replayDataClock === null) return [];
    const firstVisibleTimestamp = Math.max(0, replayDataClock - REPLAY_LOOKBACK_MS);
    return replayTrades.filter((trade) =>
      trade.timestamp >= firstVisibleTimestamp && trade.timestamp <= replayDataClock);
  }, [replayDataClock, replayTrades]);
  useEffect(() => {
    if (!started || replayDataClock === null || !onReplayExecutionQuote) return;
    const latest = visibleCandles[visibleCandles.length - 1];
    if (!latest || !Number.isFinite(latest.close) || latest.close <= 0) return;
    // Archived replay bars do not contain an honest historical BBO. A paper
    // fill therefore executes at the exact replay mark with zero simulated
    // spread, while all tick/point value and protection math remains native
    // to the selected futures contract in the shared paper ledger.
    onReplayExecutionQuote({
      symbol: selectedDefinition.id,
      bid: latest.close,
      ask: latest.close,
      mid: latest.close,
      timestamp: replayDataClock,
    });
  }, [onReplayExecutionQuote, replayDataClock, selectedDefinition.id, started, visibleCandles]);
  const historicalZyonContext = useMemo<HistoricalZyonReplayInput | null>(() => {
    if (replayClock === null || sessionStartAt === null || !visibleCandles.length) return null;
    const mapLevels = (family: "gamma" | "quant" | "valueArea", rows: ChartLevel[], visible: boolean) => rows.map((row) => ({
      family,
      label: row.label,
      price: row.price,
      visible,
    }));
    return {
      mode: "HISTORICAL_REPLAY",
      replayId: `${selectedDefinition.id}-${sessionStartAt}`,
      root,
      instrument: selectedDefinition.id,
      asOf: new Date(replayClock).toISOString(),
      replayStartedAt: new Date(sessionStartAt).toISOString(),
      replayTimeZone,
      timeframe,
      playing,
      speed,
      currentPrice: visibleCandles.at(-1)?.close ?? null,
      priceWindows: historicalPriceWindows(visibleCandles, replayClock),
      recentCandles: visibleCandles.slice(-160),
      levels: [
        ...mapLevels("gamma", gammaLevels, levelState.gamma),
        ...mapLevels("quant", quantLevels, levelState.quant),
        ...mapLevels("valueArea", valueAreaLevels, levelState.valueArea),
      ],
      zones: quantZones.map((zone) => ({
        family: "quant" as const,
        label: zone.label,
        low: zone.low,
        high: zone.high,
        visible: levelState.quant,
      })),
    };
  }, [gammaLevels, levelState.gamma, levelState.quant, levelState.valueArea, playing, quantLevels, quantZones, replayClock, replayTimeZone, root, selectedDefinition.id, sessionStartAt, speed, timeframe, valueAreaLevels, visibleCandles]);
  const replayEndClock = useMemo(() => {
    if (!candles.length) return null;
    return (candles.at(-1)?.timestamp ?? 0) + (replayIntervalMs(timeframe) ?? 1_000);
  }, [candles, timeframe]);
  const activeLevels = useMemo(() => [
    ...(levelState.gamma ? gammaLevels : []),
    ...(levelState.quant ? quantLevels : []),
    ...(levelState.valueArea ? valueAreaLevels : []),
  ], [gammaLevels, levelState, quantLevels, valueAreaLevels]);
  const activeZones = levelState.quant ? quantZones : [];
  const availableReplayIntervalGroups = useMemo(
    () => CHART_INTERVAL_GROUPS
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => supportsChartInterval(option.id, "Databento")),
      }))
      .filter((group) => group.options.length > 0),
    [],
  );
  const visibleFavouriteTimeframes = useMemo(
    () => favouriteTimeframes.filter((interval) => supportsChartInterval(interval, "Databento")),
    [favouriteTimeframes],
  );

  const loadLevels = useCallback(async (clock: number, force = false, futuresPrice: number | null = null) => {
    const snapshot = replayOptionsSnapshot(clock);
    if (!force && snapshot.key === levelSnapshotKey) return;
    if (levelLoadingRef.current) {
      pendingLevelRefreshRef.current = { clock, futuresPrice };
      return;
    }
    levelLoadingRef.current = true;
    setLevelSnapshotKey(snapshot.key);
    setSnapshotDate(snapshot.sessionDate);
    setLevelLoading(true);
    const requestId = ++levelRequestIdRef.current;
    const gammaSource = root === "NQ" ? "QQQ" : "SPY";
    const completedDate = latestCompletedOptionsSession(clock);
    const replayPrice = futuresPrice !== null && Number.isFinite(futuresPrice) && futuresPrice > 0
      ? `&futuresPrice=${encodeURIComponent(String(futuresPrice))}`
      : "";
    const eodGammaUrl = `/api/chart-gamma-levels?root=${root}&source=${gammaSource}&calibrated=1&replay=1&sessionDate=${completedDate}${replayPrice}`;
    const eodCacheKey = `${root}:${completedDate}`;
    const cachedEodGamma = eodGammaCacheRef.current?.key === eodCacheKey
      ? eodGammaCacheRef.current.payload
      : null;
    const eodGammaRequest = cachedEodGamma
      ? Promise.resolve(cachedEodGamma)
      : requestJson<ChartGammaLevelsPayload & { error?: string }>(eodGammaUrl, {
          cache: "force-cache",
          timeoutMs: 18_000,
          timeoutMessage: "The prior New York EOD Gamma snapshot timed out.",
        });
    // There is deliberately no synthetic Kwant structure before the first
    // validated post-open release. The prior EOD Gamma structure remains on
    // screen while we wait for that timestamped intraday frame.
    const intradayGammaRequest = snapshot.mode === "INTRADAY" && snapshot.kwantReleased && futuresPrice !== null
      ? requestJson<ChartGammaLevelsPayload & { error?: string }>(
          `/api/chart-gamma-levels?root=${root}&source=${gammaSource}&calibrated=1&replay=1&sessionDate=${snapshot.sessionDate}&asOf=${encodeURIComponent(snapshot.asOf)}&futuresPrice=${encodeURIComponent(String(futuresPrice))}`,
          {
            cache: "force-cache",
            // A cold historical interval-map build can take ~25 seconds. Do
            // not abort a valid point-in-time release before the server has
            // had enough time to finish and seed its completed-session cache.
            timeoutMs: 45_000,
            timeoutMessage: "The historical intraday Gamma frame timed out.",
          },
        )
      : Promise.resolve(null);
    const kwantRequest = snapshot.mode === "EOD" && snapshot.kwantReleased
      ? requestJson<GameplanPayload & { error?: string }>(
          `/api/gameplan?root=${root}&sessionDate=${snapshot.newYorkDate}`,
          {
            cache: "force-cache",
            timeoutMs: 15_000,
            timeoutMessage: "The completed Kwant level edition timed out.",
          },
        )
      : Promise.resolve(null);
    const valueAreaRequest = valueAreaSnapshotKey === snapshot.sessionDate && valueAreaLevels.length
      ? Promise.resolve(null)
      : requestJson<ValueAreaPayload>(
          `/api/databento/value-area?symbol=${encodeURIComponent(selectedDefinition.symbol)}&asOf=${encodeURIComponent(new Date(clock).toISOString())}`,
          {
            cache: "force-cache",
            // Cold replay windows rebuild from the full tick tape server-side
            // (15-120s measured); the old 15s abort could never see one finish.
            timeoutMs: 150_000,
            timeoutMessage: "The historical value-area snapshot timed out.",
          },
        );
    // Attach rejection handlers immediately; all independent sources can
    // paint as soon as their own point-in-time request completes.
    const eodGammaResult = Promise.allSettled([eodGammaRequest]);
    const kwantResult = Promise.allSettled([kwantRequest]);
    const intradayGammaResult = Promise.allSettled([intradayGammaRequest]);
    const valueAreaResult = Promise.allSettled([valueAreaRequest]);
    try {
      if (!snapshot.kwantReleased) {
        setQuantLevels([]);
        setQuantZones([]);
      }

      // Each independent source paints as soon as it resolves. Previously the
      // exact intraday Kwant frame could already be available but remained
      // invisible while the prior-EOD request was still completing.
      let intradayApplied = false;
      const intradayTask = intradayGammaResult.then(([intradayGamma]) => {
        if (requestId !== levelRequestIdRef.current) return intradayGamma;
        const eligible = intradayGamma.status === "fulfilled"
          && intradayGamma.value !== null
          && intradayGamma.value.snapshotMode === "HISTORICAL_INTRADAY";
        if (eligible && intradayGamma.status === "fulfilled" && intradayGamma.value) {
          intradayApplied = true;
          setGammaLevels(gammaSnapshot(intradayGamma.value, settings));
          setGammaPositioning(intradayGamma.value);
          const livePlan = quantSnapshotFromGamma(intradayGamma.value, root, settings);
          setQuantLevels(livePlan.levels);
          setQuantZones(livePlan.zones);
        }
        return intradayGamma;
      });
      const eodTask = eodGammaResult.then(([eodGamma]) => {
        if (requestId !== levelRequestIdRef.current) return eodGamma;
        if (eodGamma.status === "fulfilled") {
          eodGammaCacheRef.current = { key: eodCacheKey, payload: eodGamma.value };
          if (!intradayApplied) {
            setGammaLevels(gammaSnapshot(eodGamma.value, settings));
            setGammaPositioning(eodGamma.value);
          }
        }
        return eodGamma;
      });
      const kwantTask = kwantResult.then(([kwant]) => {
        if (requestId !== levelRequestIdRef.current) return kwant;
        if (snapshot.kwantReleased && kwant.status === "fulfilled" && kwant.value) {
          const completedPlan = quantSnapshot(kwant.value, settings);
          setQuantLevels(completedPlan.levels);
          setQuantZones(completedPlan.zones);
        }
        return kwant;
      });
      const valueAreaTask = valueAreaResult.then(([valueArea]) => {
        if (requestId !== levelRequestIdRef.current) return valueArea;
        if (valueArea.status === "fulfilled" && valueArea.value) {
          setValueAreaLevels(valueAreaSnapshot(valueArea.value));
          setValueAreaSnapshotKey(snapshot.sessionDate);
        } else if (valueArea.status === "rejected") {
          setValueAreaLevels([]);
        }
        return valueArea;
      });

      const [eodGamma, , intradayGamma, valueArea] = await Promise.all([
        eodTask,
        kwantTask,
        intradayTask,
        valueAreaTask,
      ]);
      if (requestId !== levelRequestIdRef.current) return;
      const eligibleIntraday = intradayGamma.status === "fulfilled"
        && intradayGamma.value !== null
        && intradayGamma.value.snapshotMode === "HISTORICAL_INTRADAY";
      if (!eligibleIntraday && eodGamma.status === "rejected" && intradayGamma.status === "fulfilled" && intradayGamma.value) {
        setGammaLevels(gammaSnapshot(intradayGamma.value, settings));
        setGammaPositioning(intradayGamma.value);
      }

      const gammaAvailable = eodGamma.status === "fulfilled"
        || (intradayGamma.status === "fulfilled" && intradayGamma.value !== null);
      setLevelError({
        gamma: gammaAvailable
          ? ""
          : eodGamma.status === "rejected" && eodGamma.reason instanceof Error
            ? eodGamma.reason.message
            : intradayGamma.status === "rejected" && intradayGamma.reason instanceof Error
              ? intradayGamma.reason.message
              : "Gamma unavailable",
        quant: snapshot.kwantReleased && snapshot.mode === "INTRADAY" && !eligibleIntraday
          ? intradayGamma.status === "rejected" && intradayGamma.reason instanceof Error
            ? intradayGamma.reason.message
            : "Waiting for the first recorded intraday Kwant edition at this replay clock."
          : "",
        valueArea: valueArea.status === "rejected"
          ? valueArea.reason instanceof Error ? valueArea.reason.message : "Value area unavailable"
          : "",
      });
    } finally {
      levelLoadingRef.current = false;
      setLevelLoading(false);
    }
  }, [levelSnapshotKey, root, selectedDefinition.symbol, settings, valueAreaLevels.length, valueAreaSnapshotKey]);

  const loadReplayCandles = useCallback(async (requestedTimeframe: ReplayTimeframe, startAt: number) => {
    const start = new Date(startAt - REPLAY_LOOKBACK_MS).toISOString();
    const end = new Date(Math.min(Date.now(), startAt + REPLAY_FORWARD_MS)).toISOString();
    const payload = await requestJson<SessionPayload>(
      `/api/backtesting/session?symbol=${encodeURIComponent(selectedDefinition.symbol)}&timeframe=${requestedTimeframe}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&orderFlow=1&executions=1`,
      {
        timeoutMs: REPLAY_ORDER_FLOW_TIMEOUT_MS,
        cache: "force-cache",
        timeoutMessage: "Exact historical executions are taking longer than expected. Retry the replay; no approximate order flow was substituted.",
      },
    );
    const ordered = payload.candles
      .filter((candle) => Number.isFinite(candle.timestamp) && candle.timestamp <= Date.parse(end))
      .sort((left, right) => left.timestamp - right.timestamp);
    return {
      ordered,
      end,
      trades: replayExecutionTrades(payload.executions),
      orderFlowReady: Boolean(payload.orderFlow?.ready),
    };
  }, [selectedDefinition.symbol]);

  const loadReplayTickerWindow = useCallback(async (
    clock: number,
    reset = false,
    requestedTimeframe = timeframe,
  ) => {
    if (!Number.isFinite(clock) || (tickerLoading && !reset)) return false;
    if (
      !reset
      && tickerCoverageStart <= clock
      && tickerCoverageEnd >= clock + REPLAY_TICK_PREFETCH_MS
    ) return true;

    const requestId = ++tickerRequestIdRef.current;
    const intervalMs = replayIntervalMs(requestedTimeframe);
    const activeBucketStart = intervalMs
      ? Math.floor(clock / intervalMs) * intervalMs
      : clock - 60_000;
    const requestStart = reset
      ? Math.max(clock - 24 * 60 * 60_000, activeBucketStart)
      : Math.max(clock, tickerCoverageEnd - 1_000);
    const requestEnd = Math.min(Date.now(), Math.max(clock + REPLAY_TICK_WINDOW_MS, requestStart + REPLAY_TICK_WINDOW_MS));
    if (requestEnd <= requestStart) return false;

    setTickerLoading(true);
    setTickerError("");
    try {
      const payload = await requestJson<SessionPayload>(
        `/api/backtesting/session?symbol=${encodeURIComponent(selectedDefinition.symbol)}&timeframe=1s&start=${encodeURIComponent(new Date(requestStart).toISOString())}&end=${encodeURIComponent(new Date(requestEnd).toISOString())}`,
        { timeoutMs: REPLAY_LOAD_TIMEOUT_MS, cache: "force-cache" },
      );
      if (requestId !== tickerRequestIdRef.current) return false;
      const ordered = payload.candles
        .filter((bar) => Number.isFinite(bar.timestamp) && bar.timestamp >= requestStart && bar.timestamp <= requestEnd)
        .sort((left, right) => left.timestamp - right.timestamp);
      setOneSecondBars((current) => {
        if (reset) return ordered;
        const merged = new Map(current.map((bar) => [bar.timestamp, bar]));
        ordered.forEach((bar) => merged.set(bar.timestamp, bar));
        return [...merged.values()].sort((left, right) => left.timestamp - right.timestamp);
      });
      setTickerCoverageStart((current) => reset || current === 0 ? requestStart : Math.min(current, requestStart));
      setTickerCoverageEnd((current) => reset ? requestEnd : Math.max(current, requestEnd));
      return true;
    } catch (problem) {
      if (requestId !== tickerRequestIdRef.current) return false;
      setTickerError(problem instanceof Error ? problem.message : "Historical one-second replay could not be loaded.");
      return false;
    } finally {
      if (requestId === tickerRequestIdRef.current) setTickerLoading(false);
    }
  }, [selectedDefinition.symbol, tickerCoverageEnd, tickerCoverageStart, tickerLoading, timeframe]);

  const candleIndexAt = useCallback((ordered: Candle[], clock: number) => {
    if (!ordered.length) return 0;
    return Math.max(0, Math.min(ordered.length - 1, firstCandleAfter(ordered, clock) - 1));
  }, []);

  const startReplay = useCallback(async () => {
    const startAt = zonedLocalToUtc(date, time, replayTimeZone);
    if (!Number.isFinite(startAt) || startAt >= Date.now()) {
      setError(`Choose a historical date and time in ${timeZoneCity(replayTimeZone)} before now.`);
      return;
    }
    setLoading(true);
    setError("");
    setPlaying(false);
    setLevelState({ gamma: false, quant: false, valueArea: false });
    setGammaLevels([]);
    setGammaPositioning(null);
    setQuantLevels([]);
    setQuantZones([]);
    setValueAreaLevels([]);
    setReplayStudyCandles([]);
    setReplayTrades([]);
    setOrderFlowHistoryReady(false);
    setOneSecondBars([]);
    setTickerCoverageStart(0);
    setTickerCoverageEnd(0);
    setTickerError("");
    tickerRequestIdRef.current += 1;
    levelRequestIdRef.current += 1;
    eodGammaCacheRef.current = null;
    setValueAreaSnapshotKey("");
    setSnapshotDate("");
    setLevelSnapshotKey("");
    try {
      const [primaryPayload, studyPayload] = await Promise.all([
        loadReplayCandles(timeframe, startAt),
        timeframe === "1m" ? Promise.resolve(null) : loadReplayCandles("1m", startAt),
      ]);
      const { ordered } = primaryPayload;
      const orderFlowPayload = studyPayload ?? primaryPayload;
      const index = candleIndexAt(ordered, startAt);
      setCandles(ordered);
      setReplayStudyCandles(studyPayload?.ordered ?? ordered);
      setReplayTrades(orderFlowPayload.trades);
      setOrderFlowHistoryReady(orderFlowPayload.orderFlowReady);
      setSessionStartAt(startAt);
      setReplayStartIndex(index);
      setVisibleIndex(index);
      setPlaybackClock(startAt);
      setStarted(true);
      setShowSetup(false);
      // Paint the replay as soon as CME candles arrive. Historical options
      // reconstruction can be materially slower and hydrates independently.
      void loadLevels(startAt, true, ordered[index]?.close ?? null);
      void loadReplayTickerWindow(startAt, true);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The replay could not be started.");
    } finally {
      setLoading(false);
    }
  }, [candleIndexAt, date, loadLevels, loadReplayCandles, loadReplayTickerWindow, replayTimeZone, time, timeframe]);

  const changeReplayTimeframe = useCallback(async (nextTimeframe: ReplayTimeframe) => {
    if (!started || !sessionStartAt || nextTimeframe === timeframe || timeframeLoading) return;
    if (!supportsChartInterval(nextTimeframe, "Databento")) {
      setError(`${formatChartInterval(nextTimeframe)} is unavailable for historical CME replay.`);
      return;
    }
    const targetClock = replayClock ?? sessionStartAt;
    setPlaying(false);
    setTimeframeLoading(true);
    setError("");
    try {
      const { ordered } = await loadReplayCandles(nextTimeframe, sessionStartAt);
      setTimeframe(nextTimeframe);
      setCandles(ordered);
      setReplayStartIndex(candleIndexAt(ordered, sessionStartAt));
      setVisibleIndex(candleIndexAt(ordered, targetClock));
      setPlaybackClock(targetClock);
      setOneSecondBars([]);
      setTickerCoverageStart(0);
      setTickerCoverageEnd(0);
      tickerRequestIdRef.current += 1;
      void loadReplayTickerWindow(targetClock, true, nextTimeframe);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That historical timeframe could not be loaded.");
    } finally {
      setTimeframeLoading(false);
    }
  }, [candleIndexAt, loadReplayCandles, loadReplayTickerWindow, replayClock, sessionStartAt, started, timeframe, timeframeLoading]);

  const toggleFavouriteTimeframe = useCallback((interval: string) => {
    setFavouriteTimeframes((current) => current.includes(interval)
      ? current.filter((item) => item !== interval)
      : [...current, interval]);
  }, []);

  const applyCustomInterval = useCallback((kind: ChartIntervalKind) => {
    const draft = intervalDrafts[kind];
    const interval = makeCustomChartInterval(kind, draft.primary, draft.secondary);
    if (!supportsChartInterval(interval, "Databento")) return;
    setShowAllTimeframes(false);
    void changeReplayTimeframe(interval);
  }, [changeReplayTimeframe, intervalDrafts]);

  const submitIntervalCommand = useCallback(() => {
    const interval = parseChartIntervalInput(intervalCommandDraft);
    if (!interval) {
      setIntervalCommandError("Try 5m, 5 min, 30s, 2h, 1D, 500v or 40r");
      return;
    }
    if (!supportsChartInterval(interval, "Databento")) {
      setIntervalCommandError(`${formatChartInterval(interval)} is unavailable for historical CME replay`);
      return;
    }
    setIntervalCommandOpen(false);
    setIntervalCommandDraft("");
    setIntervalCommandError("");
    void changeReplayTimeframe(interval);
  }, [changeReplayTimeframe, intervalCommandDraft]);

  useEffect(() => {
    if (!started || showSetup) {
      setIntervalCommandOpen(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (intervalCommandOpen) {
          event.preventDefault();
          setIntervalCommandOpen(false);
          setIntervalCommandDraft("");
          setIntervalCommandError("");
        }
        if (showAllTimeframes) setShowAllTimeframes(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      const editingText = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target?.isContentEditable;
      if (editingText || event.code !== "Space" || event.repeat) return;

      event.preventDefault();
      setShowAllTimeframes(false);
      setIntervalCommandOpen(true);
      setIntervalCommandDraft("");
      setIntervalCommandError("");
      window.requestAnimationFrame(() => intervalCommandInputRef.current?.focus());
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [intervalCommandOpen, showAllTimeframes, showSetup, started]);

  useEffect(() => {
    if (!intervalCommandOpen && !showAllTimeframes) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (intervalCommandOpen && intervalCommandPanelRef.current?.contains(target)) return;
      if (showAllTimeframes && timeframeMenuRef.current?.contains(target)) return;
      setIntervalCommandOpen(false);
      setIntervalCommandDraft("");
      setIntervalCommandError("");
      setShowAllTimeframes(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [intervalCommandOpen, showAllTimeframes]);

  const togglePlayback = useCallback(async () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (replayClock === null) return;
    const tickerReady = tickerCoverageStart <= replayClock && tickerCoverageEnd > replayClock + 1_000;
    if (!tickerReady) {
      const loaded = await loadReplayTickerWindow(replayClock, true);
      if (!loaded) return;
    }
    setTickerError("");
    setPlaying(true);
  }, [loadReplayTickerWindow, playing, replayClock, tickerCoverageEnd, tickerCoverageStart]);

  useEffect(() => {
    if (!playing || !candles.length) return;
    const intervalMs = replayIntervalMs(timeframe) ?? 1_000;
    const replayEnd = (candles.at(-1)?.timestamp ?? 0) + intervalMs;
    let previousUpdate = performance.now();

    const advance = () => {
      const updateTime = performance.now();
      const elapsed = Math.min(500, Math.max(0, updateTime - previousUpdate));
      previousUpdate = updateTime;
      setPlaybackClock((current) => {
        if (current === null) return current;
        const availableEnd = tickerCoverageEnd > 0
          ? Math.min(replayEnd, tickerCoverageEnd)
          : current;
        const next = Math.min(availableEnd, current + elapsed * speed);
        return next;
      });
    };

    const timer = window.setInterval(advance, 100);
    return () => window.clearInterval(timer);
  }, [candles, playing, speed, tickerCoverageEnd, timeframe]);

  useEffect(() => {
    if (playing && replayClock !== null && replayEndClock !== null && replayClock >= replayEndClock) {
      setPlaying(false);
    }
  }, [playing, replayClock, replayEndClock]);

  useEffect(() => {
    if (replayClock === null || !candles.length) return;
    setVisibleIndex(candleIndexAt(candles, replayClock));
  }, [candleIndexAt, candles, replayClock]);

  useEffect(() => {
    if (!playing || replayClock === null || tickerLoading || tickerCoverageEnd <= 0) return;
    const lead = Math.max(REPLAY_TICK_PREFETCH_MS, speed * 5_000);
    if (replayClock < tickerCoverageEnd - lead) return;
    void loadReplayTickerWindow(tickerCoverageEnd, false);
  }, [loadReplayTickerWindow, playing, replayClock, speed, tickerCoverageEnd, tickerLoading]);

  useEffect(() => {
    if (tickerError) setPlaying(false);
  }, [tickerError]);

  useEffect(() => {
    if (!replayClock || !started) return;
    const snapshot = replayOptionsSnapshot(replayClock);
    if (snapshot.key === levelSnapshotKey) return;
    pendingLevelRefreshRef.current = {
      clock: replayClock,
      futuresPrice: visibleCandles.at(-1)?.close ?? null,
    };
    if (levelRefreshTimerRef.current !== null) return;
    const delay = Math.max(0, 2_000 - (Date.now() - lastLevelLoadAtRef.current));
    levelRefreshTimerRef.current = window.setTimeout(() => {
      levelRefreshTimerRef.current = null;
      const pending = pendingLevelRefreshRef.current;
      pendingLevelRefreshRef.current = null;
      if (!pending) return;
      lastLevelLoadAtRef.current = Date.now();
      void loadLevels(pending.clock, false, pending.futuresPrice);
    }, delay);
  }, [levelSnapshotKey, loadLevels, replayClock, started, visibleCandles]);

  useEffect(() => {
    if (levelLoading || !started || levelLoadingRef.current) return;
    const pending = pendingLevelRefreshRef.current;
    if (!pending) return;
    pendingLevelRefreshRef.current = null;
    void loadLevels(pending.clock, true, pending.futuresPrice);
  }, [levelLoading, loadLevels, started]);

  useEffect(() => () => {
    if (levelRefreshTimerRef.current !== null) window.clearTimeout(levelRefreshTimerRef.current);
  }, []);

  const resetReplay = () => {
    setPlaying(false);
    setVisibleIndex(replayStartIndex);
    setPlaybackClock(sessionStartAt);
    if (sessionStartAt !== null && !(tickerCoverageStart <= sessionStartAt && tickerCoverageEnd > sessionStartAt)) {
      void loadReplayTickerWindow(sessionStartAt, true);
    }
  };

  const openReplaySetup = () => {
    setPlaying(false);
    setError("");
    setShowSetup(true);
  };

  const closeReplayDock = useCallback((kind: ReplayDockKind, resetWidth = false) => {
    if (kind === "gex") setShowGexPanel(false);
    else setShowZyonPanel(false);
    setReplayDockOrder((current) => current.filter((item) => item !== kind));
    if (resetWidth) {
      setReplayDockWidths((current) => ({ ...current, [kind]: DEFAULT_REPLAY_DOCK_WIDTH }));
    }
  }, []);

  const toggleReplayDock = useCallback((kind: ReplayDockKind) => {
    const isOpen = kind === "gex" ? showGexPanel : showZyonPanel;
    if (isOpen) {
      closeReplayDock(kind);
      return;
    }
    if (kind === "gex") setShowGexPanel(true);
    else setShowZyonPanel(true);
    setReplayDockOrder((current) => [...current.filter((item) => item !== kind), kind]);
  }, [closeReplayDock, showGexPanel, showZyonPanel]);

  const toggleLevel = (family: LevelFamily) => {
    setLevelState((current) => ({ ...current, [family]: !current[family] }));
  };

  const replayLevelControls: ChartLevelControl[] = [
    {
      id: "gamma",
      label: "Gamma levels",
      description: "Point-in-time historical Gamma levels with no lookahead",
      badge: "Γ",
      enabled: levelState.gamma,
      available: true,
      loading: levelLoading && levelState.gamma,
      onToggle: () => toggleLevel("gamma"),
    },
    {
      id: "kwant",
      label: "Kwant levels",
      description: "The Kwant edition available at this replay timestamp",
      badge: "K",
      enabled: levelState.quant,
      available: true,
      loading: levelLoading && levelState.quant,
      onToggle: () => toggleLevel("quant"),
    },
    {
      id: "value-area",
      label: "Value area",
      description: "Historical VAH, VAL, POC and VWAP references",
      badge: "VA",
      enabled: levelState.valueArea,
      available: true,
      loading: levelLoading && levelState.valueArea,
      onToggle: () => toggleLevel("valueArea"),
    },
  ];

  const changeReplayTimeZone = (nextTimeZone: string) => {
    const normalized = normalizeTimeZone(nextTimeZone);
    setError("");
    setReplayTimeZone(normalized);
    window.localStorage.setItem(REPLAY_TIME_ZONE_STORAGE_KEY, normalized);
  };

  const renderSetupPanel = (overlay: boolean) => (
    <div className="w-[min(620px,calc(100%-32px))] overflow-hidden rounded-[24px] border border-border bg-panel/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        {overlay ? (
          <button type="button" onClick={() => setShowSetup(false)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Clock3 className="h-4 w-4" />
          </div>
        )}
        <div>
          <div className="text-[14px] font-semibold text-foreground">Start historical replay</div>
          <div className="mt-0.5 text-[9px] text-muted">Choose the market state to reconstruct · replay times use your selected timezone</div>
        </div>
        {overlay ? (
          <button type="button" onClick={() => setShowSetup(false)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Instrument</span>
          <KwantSelect value={instrument} onChange={(event) => { setError(""); setInstrument(event.target.value as ReplayInstrument); }} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary/40">
            {INSTRUMENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </KwantSelect>
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Replay timezone</span>
          <TimeZoneSelect
            value={replayTimeZone}
            onChange={changeReplayTimeZone}
            menuLabel="Replay timezone"
            className="h-11 bg-background"
          />
        </label>
        <div className="space-y-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Replay date</span>
          <ReplayDatePicker min="2010-06-06" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(nextDate) => { setError(""); setDate(nextDate); }} />
        </div>
        <label className="space-y-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Start time · {timeZoneCity(replayTimeZone)}</span>
          <div className="relative">
            <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input type="time" value={time} onChange={(event) => { setError(""); setTime(event.target.value); }} className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 font-mono text-[12px] text-foreground outline-none focus:border-primary/40" />
          </div>
        </label>
        {error ? <div className="sm:col-span-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-[10px] text-danger">{error}</div> : null}
      </div>
      <div className="flex items-center gap-3 border-t border-border bg-background/25 px-5 py-4">
        <div className="mr-auto flex items-center gap-2 text-[9px] text-muted"><Check className="h-3.5 w-3.5 text-primary" /> No future bars are rendered</div>
        {overlay ? <button type="button" onClick={() => setShowSetup(false)} className="h-10 rounded-xl border border-border px-4 text-[10px] font-semibold text-muted hover:text-foreground">Cancel</button> : null}
        <button type="button" onClick={() => void startReplay()} disabled={loading || !date || !time} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[10px] font-semibold text-background hover:brightness-110 disabled:opacity-40">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Start replay
        </button>
      </div>
    </div>
  );

  const zyonDocked = started && showZyonPanel && Boolean(historicalZyonContext);
  const gexDocked = started && showGexPanel;
  const openReplayDockCount = Number(gexDocked) + Number(zyonDocked);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="relative z-40 shrink-0 border-b border-border bg-panel">
        <div className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground">Historical Backtesting</div>
            <div className="truncate text-[9px] text-muted">Point-in-time CME replay · no live watchlist · no future candles</div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {started ? (
            <>
              <ChartIndicatorsControl
                instrument={selectedDefinition.id}
                timeframe={timeframe}
                indicators={replayIndicators}
                chartSettings={settings}
                levelControls={replayLevelControls}
                settingsOpenRequest={indicatorSettingsOpenRequest}
                onChange={setReplayIndicators}
              />
              <span className="rounded-lg border border-border bg-background/45 px-2.5 py-1.5 font-mono text-[9px] text-muted">
                {selectedDefinition.id}
              </span>
              <button
                type="button"
                onClick={() => toggleLevel("gamma")}
                className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold ${levelState.gamma ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
              >
                Gamma levels
              </button>
              <button
                type="button"
                onClick={() => toggleReplayDock("gex")}
                aria-expanded={showGexPanel}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold transition-colors ${showGexPanel ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
              >
                <Layers3 className="h-3 w-3" />
                {showGexPanel ? "Hide GEX" : "Show GEX"}
              </button>
              <button
                type="button"
                onClick={() => toggleReplayDock("zyon")}
                aria-expanded={showZyonPanel}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold transition-colors ${showZyonPanel ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
              >
                <Sparkles className="h-3 w-3" />
                ZYON
              </button>
              <button
                type="button"
                onClick={() => toggleLevel("quant")}
                className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold ${levelState.quant ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
              >
                Kwant levels
              </button>
              <button
                type="button"
                onClick={() => toggleLevel("valueArea")}
                className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold ${levelState.valueArea ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
              >
                Value area
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!replayClock) return;
                  setManualLevelLoading(true);
                  void loadLevels(replayClock, true, visibleCandles.at(-1)?.close ?? null)
                    .finally(() => setManualLevelLoading(false));
                }}
                disabled={levelLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-primary disabled:opacity-40"
                title="Rebuild levels from the latest eligible snapshot"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${manualLevelLoading ? "animate-spin" : ""}`} />
              </button>
            </>
          ) : null}
          {started ? (
            <button
              type="button"
              onClick={openReplaySetup}
              className="flex h-9 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <Play className="h-3.5 w-3.5" />
              Backtest
            </button>
          ) : null}
          </div>
        </div>

        {started ? (
          <div className="flex min-h-[52px] min-w-0 items-center border-t border-border/70 px-3">
            <div ref={timeframeMenuRef} className="relative flex min-w-0 items-center gap-0.5">
              <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleFavouriteTimeframes.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => void changeReplayTimeframe(option)}
                    disabled={timeframeLoading}
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] transition-all disabled:cursor-wait ${timeframe === option ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}
                  >
                    {formatChartInterval(option)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Historical chart intervals"
                aria-expanded={showAllTimeframes}
                onClick={() => setShowAllTimeframes((current) => !current)}
                className={`ml-1 flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${showAllTimeframes ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface/50 text-muted hover:text-foreground"}`}
              >
                <span>{formatChartInterval(timeframe)}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllTimeframes ? "rotate-180" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => toggleFavouriteTimeframe(timeframe)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-primary"
                aria-label={`${favouriteTimeframes.includes(timeframe) ? "Remove" : "Add"} ${formatChartInterval(timeframe)} ${favouriteTimeframes.includes(timeframe) ? "from" : "to"} favourites`}
                title={favouriteTimeframes.includes(timeframe) ? "Remove interval from top bar" : "Pin interval to top bar"}
              >
                <Star className={`h-3.5 w-3.5 ${favouriteTimeframes.includes(timeframe) ? "fill-primary text-primary" : ""}`} />
              </button>
              {timeframeLoading ? <Loader2 className="ml-1 h-3.5 w-3.5 shrink-0 animate-spin text-primary" /> : null}

              {showAllTimeframes ? (
                <div className="absolute left-0 top-[40px] z-[90] w-[720px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-black/50">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <div className="text-[12px] font-semibold text-foreground">Chart intervals</div>
                      <div className="mt-0.5 text-[10px] text-muted">Time, volume and order-flow bars from historical CME market data</div>
                    </div>
                    <button type="button" onClick={() => setShowAllTimeframes(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground" aria-label="Close chart intervals">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-[min(560px,calc(100vh-180px))] overflow-y-auto p-2">
                    {availableReplayIntervalGroups.map((group) => {
                      const draft = intervalDrafts[group.kind];
                      return (
                        <div key={group.kind} className="grid grid-cols-[128px_138px_minmax(0,1fr)] items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface/40">
                          <div className="flex items-center gap-2 text-[12px] font-medium text-foreground">
                            <Settings2 className="h-4 w-4 text-muted" />
                            <span>{group.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              aria-label={`${group.label} interval value`}
                              type="number"
                              min={1}
                              step={1}
                              value={draft.primary}
                              onChange={(event) => setIntervalDrafts((current) => ({
                                ...current,
                                [group.kind]: { ...current[group.kind], primary: Math.max(1, Number(event.target.value) || 1) },
                              }))}
                              className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-[12px] text-foreground outline-none focus:border-primary/40"
                            />
                            {group.secondaryDefault !== undefined ? (
                              <input
                                aria-label={`${group.label} secondary interval value`}
                                type="number"
                                min={1}
                                step={1}
                                value={draft.secondary}
                                onChange={(event) => setIntervalDrafts((current) => ({
                                  ...current,
                                  [group.kind]: { ...current[group.kind], secondary: Math.max(1, Number(event.target.value) || 1) },
                                }))}
                                className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-[12px] text-foreground outline-none focus:border-primary/40"
                              />
                            ) : null}
                            <button
                              type="button"
                              onClick={() => applyCustomInterval(group.kind)}
                              disabled={timeframeLoading}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:border-primary/30 hover:text-primary disabled:cursor-wait disabled:opacity-40"
                              aria-label={`Apply custom ${group.label} interval`}
                              title="Apply custom interval"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex min-w-0 flex-wrap items-center gap-1">
                            {group.options.map((option) => (
                              <div key={option.id} className={`flex items-center rounded-lg border transition-colors ${timeframe === option.id ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-border hover:bg-surface"}`}>
                                <button
                                  type="button"
                                  disabled={timeframeLoading}
                                  onClick={() => {
                                    setShowAllTimeframes(false);
                                    void changeReplayTimeframe(option.id);
                                  }}
                                  className={`px-2 py-1.5 font-mono text-[11px] disabled:cursor-wait ${timeframe === option.id ? "text-primary" : "text-foreground"}`}
                                >
                                  {option.label}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFavouriteTimeframe(option.id)}
                                  className="pr-1.5 text-muted hover:text-primary"
                                  aria-label={`${favouriteTimeframes.includes(option.id) ? "Remove" : "Add"} ${option.label} ${favouriteTimeframes.includes(option.id) ? "from" : "to"} favourites`}
                                >
                                  <Star className={`h-3 w-3 ${favouriteTimeframes.includes(option.id) ? "fill-primary text-primary" : ""}`} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-border px-4 py-2.5 text-[10px] leading-4 text-muted">
                    Range and Renko use the contract tick size. Volume, trade and delta bars use native historical CME executions.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden"
          style={{ order: 0 }}
        >
          {started ? (
          <Chart
            candles={visibleCandles}
            levels={activeLevels}
            zones={activeZones}
            indicators={replayIndicators}
            initialBalanceCandles={visibleReplayStudyCandles}
            marketTrades={visibleReplayTrades}
            replayTimestampMs={replayDataClock}
            orderFlowHistoryReady={orderFlowHistoryReady}
            instrument={selectedDefinition.id}
            timeframe={timeframe}
            marketIsActive={false}
            settings={settings}
            paperPositions={paperPositions}
            paperFills={paperFills}
            onUpdatePaperProtection={onUpdatePaperProtection}
            onPaperProtectionDragStateChange={onPaperProtectionDragStateChange}
            onClosePaperPosition={onClosePaperPosition}
            onRemovePaperFills={onRemovePaperFills}
            onResetPaperTrading={onResetPaperTrading}
            toolbarEnabled
            gammaLevelsEnabled={levelState.gamma}
            gammaLevelsAvailable
            // Point-in-time replacements are always background refreshes in
            // replay. Never cover or pause the chart while a snapshot swaps.
            gammaLevelsLoading={false}
            gammaLevelsError={levelError.gamma || null}
            onToggleGammaLevels={() => toggleLevel("gamma")}
            valueAreaLevelsEnabled={levelState.valueArea}
            valueAreaLevelsAvailable
            valueAreaLevelsLoading={false}
            valueAreaLevelsError={levelError.valueArea || null}
            valueAreaLevelsDescription="Historical prior-session and prior-week VAH, VAL, POC and VWAP"
            onToggleValueAreaLevels={() => toggleLevel("valueArea")}
            onUpdateIndicatorSetting={(instanceId, key, value) => {
              setReplayIndicators((current) => current.map((indicator) =>
                indicator.instanceId === instanceId
                  ? { ...indicator, settings: { ...(indicator.settings ?? {}), [key]: value } }
                  : indicator));
            }}
            onOpenIndicatorSettings={(instanceId) => {
              setIndicatorSettingsOpenRequest({ instanceId, requestId: Date.now() });
            }}
            onRemoveAllIndicators={() => setReplayIndicators([])}
          />
          ) : null}

          {started && levelState.quant && quantLevels.length === 0 && activeOptionsSnapshot ? (
          <div className="pointer-events-none absolute right-4 top-[62px] z-30 flex max-w-[340px] items-start gap-2.5 rounded-xl border border-amber-400/30 bg-[#0b0b0b]/94 px-3 py-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-400/10 text-amber-300">
              <TriangleAlert className="h-3.5 w-3.5" />
            </span>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground">Kwant levels not released</div>
              <div className="mt-1 text-[8px] leading-4 text-muted">
                {levelLoading && activeOptionsSnapshot.kwantReleased
                  ? `Loading the exact ${activeOptionsSnapshot.newYorkDate} point-in-time Kwant edition. The replay continues without interruption.`
                  : levelError.quant
                    ? levelError.quant
                    : activeOptionsSnapshot.kwantReleased
                  ? "No validated Kwant edition exists at this replay timestamp yet. It will appear automatically at the first recorded release."
                  : activeOptionsSnapshot.mode === "INTRADAY"
                    ? `The ${activeOptionsSnapshot.newYorkDate} edition is still being established. It normally appears within the first five minutes after New York opens.`
                    : `The ${activeOptionsSnapshot.newYorkDate} edition is not available before New York opens. It normally appears within the first five minutes.`}
              </div>
            </div>
          </div>
          ) : null}

          {started && intervalCommandOpen ? (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
            <div
              ref={intervalCommandPanelRef}
              className="pointer-events-auto w-[300px] max-w-[calc(100%-32px)] rounded-2xl border border-border bg-panel/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <Search className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-medium text-foreground">Change interval</span>
                <span className="ml-auto rounded-md border border-border bg-surface px-1.5 py-0.5 text-[9px] text-muted">ESC</span>
              </div>
              <input
                ref={intervalCommandInputRef}
                value={intervalCommandDraft}
                onChange={(event) => {
                  setIntervalCommandDraft(event.target.value);
                  setIntervalCommandError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitIntervalCommand();
                  }
                }}
                autoFocus
                spellCheck={false}
                placeholder="Type 5m, 40 range or 500 volume"
                aria-label="Historical chart interval"
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 font-mono text-[15px] text-foreground outline-none transition-colors placeholder:text-muted/55 focus:border-primary/60"
              />
              <div className={`mt-2 px-1 text-[10px] ${intervalCommandError ? "text-danger" : "text-muted"}`}>
                {intervalCommandError || "Seconds · minutes · hours · days · weeks · event bars"}
              </div>
            </div>
          </div>
          ) : null}

          {!started && !loading ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-background px-4 py-8">
            <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:64px_64px]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.06] blur-[100px]" />
            <div className="relative z-10 flex w-full justify-center">
              {renderSetupPanel(false)}
            </div>
          </div>
          ) : null}

          {loading ? (
          <div className="absolute inset-0 z-40 bg-background/90">
            <KwantLoader className="h-full" title="Building replay" detail="Loading one week of CME context and the selected replay session." />
          </div>
          ) : null}

          {started ? (
          <div className="absolute bottom-8 left-1/2 z-30 w-[min(920px,calc(100%-32px))] -translate-x-1/2 rounded-2xl border border-border bg-panel/95 px-3 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void togglePlayback()} disabled={tickerLoading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-background hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
                {tickerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button type="button" onClick={resetReplay} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted hover:text-foreground" title="Reset to replay start">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-[180px] flex-1 px-1">
                <input
                  type="range"
                  min={replayStartIndex}
                  max={Math.max(replayStartIndex, candles.length - 1)}
                  value={visibleIndex}
                  onChange={(event) => {
                    setPlaying(false);
                    const nextIndex = Number(event.target.value);
                    const nextClock = candles[nextIndex]?.timestamp ?? sessionStartAt;
                    setVisibleIndex(nextIndex);
                    setPlaybackClock(nextClock);
                    if (
                      nextClock !== null
                      && !(tickerCoverageStart <= nextClock && tickerCoverageEnd > nextClock + REPLAY_TICK_PREFETCH_MS)
                    ) void loadReplayTickerWindow(nextClock, true);
                  }}
                  className="h-1.5 w-full cursor-pointer accent-[var(--primary)]"
                  aria-label="Replay position"
                />
                <div className="mt-1 flex items-center justify-between font-mono text-[8px] text-muted">
                  <span>{formatReplayClock(candles[replayStartIndex]?.timestamp ?? 0, replayTimeZone)} {timeZoneCity(replayTimeZone)}</span>
                  <span className="text-foreground">{replayClock ? formatReplayClock(replayClock, replayTimeZone) : "--"} {timeZoneCity(replayTimeZone)}</span>
                  <span>{formatReplayClock(candles.at(-1)?.timestamp ?? 0, replayTimeZone)} {timeZoneCity(replayTimeZone)}</span>
                </div>
              </div>
              <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-background/45 p-1">
                {SPEEDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSpeed(option)}
                    className={`h-7 shrink-0 rounded-lg px-2 font-mono text-[9px] ${speed === option ? "bg-primary text-background" : "text-muted hover:bg-surface hover:text-foreground"}`}
                  >
                    {option}×
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-[8px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-primary" />
                {activeOptionsSnapshot?.mode === "INTRADAY"
                  ? `New York intraday snapshot · ${formatReplayClock(replayClock ?? 0, "America/New_York")} NY`
                  : `Snapshot cut-off: ${snapshotDate || "preparing"} New York EOD`}
              </span>
              <span>{tickerLoading ? "Loading historical ticker…" : playing ? `${speed}× real-time market clock` : manualLevelLoading ? "Refreshing eligible levels…" : "Future candles remain hidden"}</span>
              {tickerError ? <span className="text-danger">ticker: {tickerError}</span> : null}
              {Object.entries(levelError).filter(([, message]) => message).map(([family, message]) => (
                <span key={family} className="text-danger">{family}: {message}</span>
              ))}
            </div>
          </div>
          ) : null}
        </div>

        {started ? (
          <ResizableReplayDock
            open={gexDocked}
            order={replayDockOrder.indexOf("gex") + 1}
            width={replayDockWidths.gex}
            multiPanel={openReplayDockCount > 1}
            label="Historical GEX"
            onResize={(width) => setReplayDockWidths((current) => ({ ...current, gex: width }))}
            onCollapse={() => closeReplayDock("gex", true)}
          >
            <HistoricalGexPanel
              snapshot={gammaPositioning}
              loading={levelLoading && !gammaPositioning}
              error={levelError.gamma}
              releaseState={activeOptionsSnapshot?.kwantReleased
                ? "RELEASED"
                : activeOptionsSnapshot?.mode === "INTRADAY" ? "OPENING" : "PREOPEN"}
              sessionDate={activeOptionsSnapshot?.newYorkDate ?? date}
              onClose={() => closeReplayDock("gex")}
            />
          </ResizableReplayDock>
        ) : null}

        {started && historicalZyonContext ? (
          <ResizableReplayDock
            open={zyonDocked}
            order={replayDockOrder.indexOf("zyon") + 1}
            width={replayDockWidths.zyon}
            multiPanel={openReplayDockCount > 1}
            label="Historical ZYON"
            onResize={(width) => setReplayDockWidths((current) => ({ ...current, zyon: width }))}
            onCollapse={() => closeReplayDock("zyon", true)}
          >
            <HistoricalZyonPanel
              context={historicalZyonContext}
              onClose={() => closeReplayDock("zyon")}
            />
          </ResizableReplayDock>
        ) : null}
      </div>

      {showSetup && started ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) setShowSetup(false); }}>
          <div className="w-[min(620px,100%)] overflow-hidden rounded-[24px] border border-border bg-panel shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <button type="button" onClick={() => setShowSetup(false)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
              <div>
                <div className="text-[14px] font-semibold text-foreground">Start historical replay</div>
                <div className="mt-0.5 text-[9px] text-muted">Replay date and time use {timeZoneCity(replayTimeZone)}</div>
              </div>
              <button type="button" onClick={() => setShowSetup(false)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Instrument</span>
                <KwantSelect value={instrument} onChange={(event) => { setError(""); setInstrument(event.target.value as ReplayInstrument); }} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary/40">
                  {INSTRUMENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </KwantSelect>
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Replay timezone</span>
                <TimeZoneSelect
                  value={replayTimeZone}
                  onChange={changeReplayTimeZone}
                  menuLabel="Replay timezone"
                  className="h-11 bg-background"
                />
              </label>
              <div className="space-y-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Replay date</span>
                <ReplayDatePicker min="2010-06-06" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(nextDate) => { setError(""); setDate(nextDate); }} />
              </div>
              <label className="space-y-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Start time · {timeZoneCity(replayTimeZone)}</span>
                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <input type="time" value={time} onChange={(event) => { setError(""); setTime(event.target.value); }} className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 font-mono text-[12px] text-foreground outline-none focus:border-primary/40" />
                </div>
              </label>
              {error ? <div className="sm:col-span-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-[10px] text-danger">{error}</div> : null}
            </div>
            <div className="flex items-center gap-3 border-t border-border bg-background/25 px-5 py-4">
              <div className="mr-auto flex items-center gap-2 text-[9px] text-muted"><Check className="h-3.5 w-3.5 text-primary" /> No future bars are rendered</div>
              <button type="button" onClick={() => setShowSetup(false)} className="h-10 rounded-xl border border-border px-4 text-[10px] font-semibold text-muted hover:text-foreground">Cancel</button>
              <button type="button" onClick={() => void startReplay()} disabled={loading || !date || !time} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[10px] font-semibold text-background hover:brightness-110 disabled:opacity-40">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Start replay
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
