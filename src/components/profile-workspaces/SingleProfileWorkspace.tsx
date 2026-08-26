"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import { Check, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import FloatingSettingsWindow from "@/components/ui/FloatingSettingsWindow";
import { DATABENTO_LIVE_TICK_EVENT, type DatabentoLiveTick } from "@/lib/chartLiveEvents";
import {
  fetchInstitutionalOrderFlowLevels,
  fetchInstitutionalSnapshot,
  fetchInstitutionalVolumeProfile,
  mergeInstitutionalVolumeProfiles,
  type InstitutionalVolumeProfile,
} from "@/lib/institutionalMarketData";
import { readLiveQuoteCache } from "@/lib/liveQuoteCache";
import { buildTpoProfiles, periodBoundaryForTime, zonedParts } from "@/lib/tpo/engine";
import { defaultTpoSettings } from "@/lib/tpo/settings";
import { tickToPrice, type TpoBar, type TpoProfileModel } from "@/lib/tpo/types";
import type { Candle } from "@/lib/backtester";
import {
  calculateVolumeProfileValueArea,
  STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
  volumeProfileBinTick,
} from "@/lib/volumeProfileMath";
import {
  VOLUME_PROFILE_GRADIENTS,
  VOLUME_PROFILE_GRADIENT_OFF,
  resolveVolumeProfileGradient,
} from "@/lib/volumeProfileGradients";
import { writeProtectedItem } from "@/lib/browserStorageQuota";

type ProfileKind = "tpo" | "volume";
type ProfilePreset =
  | "previous-rth"
  | "current-rth"
  | "previous-globex"
  | "current-globex"
  | "current-week"
  | "previous-week"
  | "recurring-custom"
  | "custom"
  | "merge-days";

type WorkspaceSettings = {
  preset: ProfilePreset;
  timezone: string;
  startTime: string;
  endTime: string;
  customStart: string;
  customEnd: string;
  subperiodMinutes: number;
  ticksPerRow: number;
  display: "blocks" | "letters";
  showPoc: boolean;
  showValueArea: boolean;
  selectedDates: string[];
  volumeGranularity: "auto" | "ticks" | "price";
  pricePerRow: number;
  targetRows: number;
  minTradeVolume: number;
  maxTradeVolume: number;
  profileWidthPercent: number;
  profileSide: "left" | "right";
  volumeDisplay: "total" | "bid-ask" | "delta-volume";
  volumeScale: "linear" | "sqrt" | "log";
  opacityPercent: number;
  /** Gradient scheme id, or "off" to use the individual colours. */
  gradientPreset: string;
  showVwap: boolean;
  showRowValues: boolean;
};

type RenderRow = {
  price: number;
  weight: number;
  label: string;
  inValueArea: boolean;
  isPoc: boolean;
  bidVolume: number;
  askVolume: number;
  delta: number;
  trades: number;
};

type ProfileView = {
  rows: RenderRow[];
  poc: number | null;
  vah: number | null;
  val: number | null;
  startMs: number;
  endMs: number;
  source: string;
  total: number;
  vwap: number | null;
  tickSize: number;
  groupTicks: number;
};

const NY_TIME_ZONE = "America/New_York";
const DEFAULT_SETTINGS: WorkspaceSettings = {
  preset: "previous-rth",
  timezone: NY_TIME_ZONE,
  startTime: "09:30",
  endTime: "16:00",
  customStart: "",
  customEnd: "",
  subperiodMinutes: 30,
  ticksPerRow: 1,
  display: "blocks",
  showPoc: true,
  showValueArea: true,
  selectedDates: [],
  volumeGranularity: "auto",
  pricePerRow: 1,
  targetRows: 120,
  minTradeVolume: 0,
  maxTradeVolume: 0,
  profileWidthPercent: 72,
  profileSide: "left",
  volumeDisplay: "total",
  volumeScale: "linear",
  opacityPercent: 86,
  gradientPreset: VOLUME_PROFILE_GRADIENT_OFF,
  showVwap: true,
  showRowValues: false,
};

const PRESETS: Array<{ id: ProfilePreset; label: string; detail: string }> = [
  { id: "previous-rth", label: "Previous NY RTH", detail: "Previous completed 09:30–16:00 New York profile" },
  { id: "current-rth", label: "Current NY RTH", detail: "Developing New York cash-session profile" },
  { id: "previous-globex", label: "Previous Globex", detail: "Previous completed 18:00–17:00 New York session" },
  { id: "current-globex", label: "Current Globex", detail: "Developing full futures session" },
  { id: "current-week", label: "Current Week", detail: "Developing weekly composite" },
  { id: "previous-week", label: "Previous Week", detail: "Previous completed weekly composite" },
  { id: "recurring-custom", label: "Recurring Daily Window", detail: "Rebuilds automatically from the same start and end time every trading day" },
  { id: "custom", label: "Custom Range", detail: "Exact start and end selected below" },
];

function rootSymbol(symbol: string) {
  const root = symbol.toUpperCase().replace(/\.[VNC]\.\d+$/i, "").replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, "");
  if (root === "MNQ") return "NQ";
  if (root === "MES") return "ES";
  return root;
}

function dateInputValue(timestamp: number) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}

function recentTradingDates(count = 10) {
  const dates: string[] = [];
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const cursor = new Date();
  cursor.setUTCHours(16, 0, 0, 0);
  while (dates.length < count) {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: NY_TIME_ZONE, weekday: "short" }).format(cursor);
    if (weekday !== "Sat" && weekday !== "Sun") {
      const parts = formatter.formatToParts(cursor);
      const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      dates.push(`${value.year}-${value.month}-${value.day}`);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
}

function latestCompletedRthDate(dates: string[]) {
  const now = zonedParts(Date.now(), NY_TIME_ZONE);
  const weekday = now.weekday;
  const afterClose = now.hour > 16 || (now.hour === 16 && now.minute >= 0);
  const todayIsTradingDay = weekday >= 1 && weekday <= 5;
  return dates[todayIsTradingDay && !afterClose ? 1 : 0] ?? dates[0];
}

function normalizeTpoCandles(value: unknown) {
  if (!Array.isArray(value)) return [];
  const candles = new Map<number, Candle>();
  value.forEach((candidate) => {
    if (!candidate || typeof candidate !== "object") return;
    const row = candidate as Record<string, unknown>;
    const rawTimestamp = Number(row.timestamp ?? row.time);
    const timestamp = Number.isFinite(rawTimestamp)
      ? rawTimestamp < 10_000_000_000 ? rawTimestamp * 1000 : rawTimestamp
      : typeof row.timestamp === "string" || typeof row.time === "string"
        ? Date.parse(String(row.timestamp ?? row.time))
        : Number.NaN;
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    if (
      !Number.isFinite(timestamp)
      || !Number.isFinite(open)
      || !Number.isFinite(high)
      || !Number.isFinite(low)
      || !Number.isFinite(close)
      || open <= 0
      || close <= 0
      || low <= 0
      || high < Math.max(open, close)
      || low > Math.min(open, close)
    ) return;
    candles.set(timestamp, {
      timestamp,
      open,
      high,
      low,
      close,
      volume: Math.max(0, Number(row.volume) || 0),
      trades: Math.max(0, Number(row.trades) || 0),
      bidVolume: Math.max(0, Number(row.bidVolume) || 0),
      askVolume: Math.max(0, Number(row.askVolume) || 0),
    });
  });
  return [...candles.values()].sort((left, right) => left.timestamp - right.timestamp);
}

async function fetchTpoHistory(symbol: string) {
  // The durable CME history route uses Databento's continuous symbology.
  // The institutional/Rithmic gateway intentionally uses the bare parent
  // root instead, so these two requests must not share the same symbol form.
  const continuousSymbol = `${rootSymbol(symbol)}.v.0`;
  const response = await fetch(
    `/api/cme-history?symbol=${encodeURIComponent(continuousSymbol)}&timeframe=1m&days=14`,
    { cache: "no-store", signal: AbortSignal.timeout(45_000) },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") return [];
  return normalizeTpoCandles((payload as { candles?: unknown }).candles);
}

function mergeTpoCandles(...sources: Candle[][]) {
  const merged = new Map<number, Candle>();
  sources.forEach((source) => source.forEach((candle) => merged.set(candle.timestamp, candle)));
  return [...merged.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function recurringBoundary(settings: WorkspaceSettings, timestamp = Date.now()) {
  const engine = defaultTpoSettings("daily-tpo");
  engine.timezone = settings.timezone;
  engine.scheduleKind = "daily";
  engine.periodMode = "multiple-profiles";
  engine.dailyStartTime = settings.startTime;
  engine.dailyEndMode = "explicit-time";
  engine.dailyEndTime = settings.endTime;
  engine.enabledWeekdays = [1, 2, 3, 4, 5];
  return periodBoundaryForTime(timestamp, engine);
}

function previousWeeklyBoundary(settings: WorkspaceSettings) {
  const engine = defaultTpoSettings("weekly-tpo");
  engine.timezone = settings.timezone;
  engine.weekStartDay = 0;
  engine.weekStartTime = "18:00";
  engine.weekEndMode = "explicit-day-time";
  engine.weekEndDay = 5;
  engine.weekEndTime = "17:00";
  const current = periodBoundaryForTime(Date.now(), engine);
  return current ? periodBoundaryForTime(current.startMs - 1, engine) : null;
}

function applyVisibility(view: ProfileView, settings: WorkspaceSettings): ProfileView {
  return {
    ...view,
    rows: view.rows.map((row) => ({
      ...row,
      isPoc: settings.showPoc && row.isPoc,
      inValueArea: settings.showValueArea && row.inValueArea,
    })),
    poc: settings.showPoc ? view.poc : null,
    vah: settings.showValueArea ? view.vah : null,
    val: settings.showValueArea ? view.val : null,
  };
}

function matchesInstrument(tickInstrument: string, instrument: string) {
  return rootSymbol(tickInstrument) === rootSymbol(instrument);
}

function tpoView(profile: TpoProfileModel): ProfileView {
  const poc = profile.pocTick === null ? null : tickToPrice(profile.pocTick, profile.tickSize);
  const vah = profile.vahTick === null ? null : tickToPrice(profile.vahTick, profile.tickSize);
  const val = profile.valTick === null ? null : tickToPrice(profile.valTick, profile.tickSize);
  return {
    rows: profile.rows.map((row) => {
      const price = tickToPrice(row.rowTick, profile.tickSize);
      return {
        price,
        weight: row.tpoCount,
        label: row.markers.join(""),
        inValueArea: vah !== null && val !== null && price >= val && price <= vah,
        isPoc: poc !== null && Math.abs(price - poc) < profile.tickSize / 2,
        bidVolume: 0,
        askVolume: 0,
        delta: 0,
        trades: 0,
      };
    }),
    poc,
    vah,
    val,
    startMs: profile.startTimeMs,
    endMs: profile.endTimeMs,
    source: profile.source === "exact-trades" ? "EXACT EXECUTIONS" : "CME 1M RANGE",
    total: profile.totalTpos,
    vwap: null,
    tickSize: profile.tickSize,
    groupTicks: profile.ticksPerRow,
  };
}

function volumeView(profile: InstitutionalVolumeProfile): ProfileView {
  return {
    rows: profile.levels.map((row) => ({
      price: row.price,
      weight: row.volume,
      label: row.volume.toLocaleString(),
      inValueArea: profile.vah !== null && profile.val !== null && row.price >= profile.val && row.price <= profile.vah,
      isPoc: profile.poc !== null && Math.abs(row.price - profile.poc) < profile.tickSize * profile.groupTicks / 2,
      bidVolume: row.bidVolume,
      askVolume: row.askVolume,
      delta: row.delta,
      trades: row.trades,
    })),
    poc: profile.poc,
    vah: profile.vah,
    val: profile.val,
    startMs: profile.startMs,
    endMs: profile.endMs,
    source: profile.provider === "Rithmic" ? "RITHMIC EXECUTIONS" : `${profile.provider.toUpperCase()} EXECUTIONS`,
    total: profile.totalVolume,
    vwap: profile.vwap,
    tickSize: profile.tickSize,
    groupTicks: profile.groupTicks,
  };
}

function resolvedVolumeGroupTicks(profile: InstitutionalVolumeProfile, settings: WorkspaceSettings) {
  if (settings.volumeGranularity === "ticks") return Math.max(1, Math.round(settings.ticksPerRow));
  if (settings.volumeGranularity === "price") {
    return Math.max(1, Math.round(Math.max(profile.tickSize, settings.pricePerRow) / profile.tickSize));
  }
  const first = profile.levels[0]?.price;
  const last = profile.levels.at(-1)?.price;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 1;
  const spanTicks = Math.max(1, Math.round((Number(last) - Number(first)) / profile.tickSize) + 1);
  return Math.max(1, Math.ceil(spanTicks / Math.max(20, Math.round(settings.targetRows))));
}

function rebinVolumeProfile(profile: InstitutionalVolumeProfile, settings: WorkspaceSettings): InstitutionalVolumeProfile {
  const groupTicks = resolvedVolumeGroupTicks(profile, settings);
  if (groupTicks === profile.groupTicks) return profile;
  const levels = new Map<number, InstitutionalVolumeProfile["levels"][number]>();
  for (const level of profile.levels) {
    const groupedTick = volumeProfileBinTick(Math.round(level.price / profile.tickSize), groupTicks);
    const current = levels.get(groupedTick) ?? {
      price: Number((groupedTick * profile.tickSize).toFixed(10)),
      volume: 0,
      bidVolume: 0,
      askVolume: 0,
      delta: 0,
      trades: 0,
    };
    current.volume += level.volume;
    current.bidVolume += level.bidVolume;
    current.askVolume += level.askVolume;
    current.delta += level.delta;
    current.trades += level.trades;
    levels.set(groupedTick, current);
  }
  const rebinned = [...levels.values()].sort((left, right) => left.price - right.price);
  const valueArea = calculateVolumeProfileValueArea(
    rebinned,
    profile.tickSize * groupTicks,
    STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
  );
  return {
    ...profile,
    groupTicks,
    levels: rebinned,
    poc: valueArea.poc,
    vah: valueArea.vah,
    val: valueArea.val,
  };
}

function formatPrice(value: number | null, tickSize = 0.25) {
  if (value === null || !Number.isFinite(value)) return "—";
  const decimals = tickSize >= 1 ? 0 : tickSize >= 0.1 ? 2 : 4;
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatPeriod(startMs: number, endMs: number) {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIME_ZONE,
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${format.format(startMs)} — ${format.format(endMs)} ET`;
}

function ProfileCanvas({ kind, profile, livePrice, settings }: { kind: ProfileKind; profile: ProfileView; livePrice: number | null; settings: WorkspaceSettings }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 640 });
  const [colors, setColors] = useState({ accent: "#a3ff12", up: "#16c7ce", down: "#ff1f78" });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const read = () => {
      const bounds = element.getBoundingClientRect();
      // No artificial minimum: clamping the measurement above the real pane
      // size was itself a source of scaling, because the oversized coordinate
      // space then had to be squeezed back into the box.
      setSize({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
      const style = getComputedStyle(document.documentElement);
      setColors({
        accent: style.getPropertyValue("--primary").trim() || "#a3ff12",
        up: style.getPropertyValue("--candle-up").trim() || "#16c7ce",
        down: style.getPropertyValue("--candle-down").trim() || "#ff1f78",
      });
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    const themeObserver = new MutationObserver(read);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => { observer.disconnect(); themeObserver.disconnect(); };
  }, []);

  const sorted = useMemo(() => [...profile.rows].sort((left, right) => right.price - left.price), [profile.rows]);
  const prices = sorted.map((row) => row.price);
  if (livePrice !== null) prices.push(livePrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = Math.max(0.0001, maxPrice - minPrice);
  const padTop = 34;
  const padBottom = 34;
  const activeGradient = resolveVolumeProfileGradient(settings.gradientPreset);
  const axisWidth = 92;
  const plotWidth = Math.max(120, size.width - axisWidth - 40);
  const plotHeight = Math.max(120, size.height - padTop - padBottom);
  const scaledWeight = (value: number) => settings.volumeScale === "sqrt"
    ? Math.sqrt(Math.max(0, value))
    : settings.volumeScale === "log"
      ? Math.log1p(Math.max(0, value))
      : Math.max(0, value);
  const maxWeight = Math.max(1, ...sorted.map((row) => scaledWeight(row.weight)));
  const maxAbsDelta = Math.max(1, ...sorted.map((row) => scaledWeight(Math.abs(row.delta))));
  const maxSideVolume = Math.max(1, ...sorted.map((row) => scaledWeight(Math.max(row.bidVolume, row.askVolume))));
  const rowHeight = Math.max(2, Math.min(18, plotHeight / Math.max(1, sorted.length)));
  const y = (price: number) => padTop + ((maxPrice - price) / range) * plotHeight;
  const profileMaxWidth = plotWidth * Math.max(0.1, Math.min(1, settings.profileWidthPercent / 100));
  const profileStartX = settings.profileSide === "right" ? size.width - axisWidth - 10 : 28;
  const barX = (width: number) => settings.profileSide === "right" ? profileStartX - width : profileStartX;
  const opacity = Math.max(0.1, Math.min(1, settings.opacityPercent / 100));

  return (
    <div ref={containerRef} className="h-full min-h-0 w-full overflow-hidden bg-background">
      {/*
        Drawn in real pixels, not a stretched coordinate space.
        A percentage-sized viewBox with preserveAspectRatio="none" maps the LAST
        measured size onto whatever box the pane currently has, so every resize
        scaled the whole drawing — prices, POC and VAH/VAL labels included —
        until the observer caught up, and stretched it non-uniformly on the way.
        A real price scale does not resize its type when the pane narrows; the
        levels simply move. Sizing the canvas in pixels gives exactly that.
      */}
      <svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={`${kind === "tpo" ? "TPO" : "Volume"} profile`}>
        <defs>
          {/*
            The active gradient scheme, laid out DOWN the profile so it fades
            across the auction's price range exactly as it does on the chart's
            own volume profiles. Rendered here so a single-profile workspace
            carries the same schemes rather than its own separate look.
          */}
          {activeGradient ? (
            <linearGradient id={`profile-scheme-${kind}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={activeGradient.from} />
              <stop offset="100%" stopColor={activeGradient.to} />
            </linearGradient>
          ) : null}
          <linearGradient id={`profile-fill-${kind}`} x1="0" x2="1">
            <stop offset="0%" stopColor={colors.accent} stopOpacity="0.3" />
            <stop offset="100%" stopColor={colors.accent} stopOpacity="0.92" />
          </linearGradient>
          <filter id={`profile-glow-${kind}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {Array.from({ length: 7 }, (_, index) => {
          const gridY = padTop + (plotHeight * index) / 6;
          return <line key={index} x1="0" x2={size.width} y1={gridY} y2={gridY} stroke="var(--border)" strokeOpacity="0.45" strokeWidth="1" />;
        })}
        {sorted.map((row) => {
          const rowY = y(row.price) - rowHeight / 2;
          const width = Math.max(2, (scaledWeight(row.weight) / maxWeight) * profileMaxWidth);
          // A scheme owns every body colour, so the value area, the outside
          // rows and the POC row all draw through the same fade.
          const fill = activeGradient
            ? `url(#profile-scheme-${kind})`
            : row.isPoc ? "#f5b83b" : row.inValueArea ? `url(#profile-fill-${kind})` : "var(--muted)";
          const tpoBlockWidth = Math.max(1.5, Math.min(10, rowHeight - 0.75, profileMaxWidth / maxWeight));
          const bidWidth = Math.max(0, scaledWeight(row.bidVolume) / maxSideVolume * profileMaxWidth);
          const askWidth = Math.max(0, scaledWeight(row.askVolume) / maxSideVolume * profileMaxWidth);
          const deltaWidth = Math.max(0, scaledWeight(Math.abs(row.delta)) / maxAbsDelta * profileMaxWidth);
          return (
            <g key={row.price}>
              {kind === "volume" && settings.volumeDisplay === "total" ? <rect x={barX(width)} y={rowY} width={width} height={Math.max(1, rowHeight - 1)} fill={fill} opacity={(row.inValueArea || row.isPoc ? 1 : 0.52) * opacity} /> : null}
              {kind === "volume" && settings.volumeDisplay === "bid-ask" ? <>
                <rect x={barX(bidWidth)} y={rowY} width={bidWidth} height={Math.max(1, rowHeight / 2 - 0.5)} fill={activeGradient ? fill : colors.down} opacity={opacity} />
                <rect x={barX(askWidth)} y={rowY + rowHeight / 2} width={askWidth} height={Math.max(1, rowHeight / 2 - 0.5)} fill={activeGradient ? fill : colors.up} opacity={opacity} />
              </> : null}
              {kind === "volume" && settings.volumeDisplay === "delta-volume" ? <>
                <rect x={barX(width)} y={rowY} width={width} height={Math.max(1, rowHeight - 1)} fill={fill} opacity={0.34 * opacity} />
                <rect x={barX(deltaWidth)} y={rowY + rowHeight * 0.2} width={deltaWidth} height={Math.max(1, rowHeight * 0.6)} fill={activeGradient ? fill : row.delta >= 0 ? colors.up : colors.down} opacity={opacity} />
              </> : null}
              {kind === "tpo" ? Array.from({ length: Math.min(300, Math.max(1, Math.round(row.weight))) }, (_, index) => (
                <g key={index}>
                  <rect x={profileStartX + index * tpoBlockWidth} y={rowY} width={Math.max(1, tpoBlockWidth - 0.6)} height={Math.max(1, rowHeight - 1)} fill={fill} opacity={row.inValueArea || row.isPoc ? 0.96 : 0.55} />
                  {settings.display === "letters" && tpoBlockWidth >= 7 && rowHeight >= 8 ? <text x={profileStartX + index * tpoBlockWidth + tpoBlockWidth / 2} y={rowY + rowHeight * 0.72} textAnchor="middle" fill="var(--background)" fontSize={Math.min(8, rowHeight - 2)} fontFamily="var(--font-mono)">{row.label[index] ?? "·"}</text> : null}
                </g>
              )) : null}
              {kind === "volume" && settings.showRowValues && rowHeight >= 8 ? <text x={settings.profileSide === "right" ? barX(width) - 4 : profileStartX + width + 4} y={rowY + rowHeight * 0.7} textAnchor={settings.profileSide === "right" ? "end" : "start"} fill="var(--foreground)" opacity="0.8" fontSize="7" fontFamily="var(--font-mono)">{row.weight.toLocaleString()}</text> : null}
            </g>
          );
        })}
        {profile.vah !== null ? <line x1="0" x2={size.width - axisWidth} y1={y(profile.vah)} y2={y(profile.vah)} stroke={colors.accent} strokeWidth="1" strokeDasharray="4 4" opacity="0.75" /> : null}
        {profile.val !== null ? <line x1="0" x2={size.width - axisWidth} y1={y(profile.val)} y2={y(profile.val)} stroke={colors.accent} strokeWidth="1" strokeDasharray="4 4" opacity="0.75" /> : null}
        {profile.poc !== null ? <line x1="0" x2={size.width - axisWidth} y1={y(profile.poc)} y2={y(profile.poc)} stroke="#f5b83b" strokeWidth="1.5" /> : null}
        {kind === "volume" && settings.showVwap && profile.vwap !== null ? <line x1="0" x2={size.width - axisWidth} y1={y(profile.vwap)} y2={y(profile.vwap)} stroke={colors.up} strokeWidth="1" strokeDasharray="2 3" opacity="0.8" /> : null}
        {livePrice !== null ? (
          <g filter={`url(#profile-glow-${kind})`}>
            <line x1="0" x2={size.width - axisWidth} y1={y(livePrice)} y2={y(livePrice)} stroke={colors.accent} strokeWidth="1.5" />
            <rect x={size.width - axisWidth} y={y(livePrice) - 11} width={axisWidth} height="22" fill={colors.accent} />
            <text x={size.width - axisWidth + 7} y={y(livePrice) + 4} fill="var(--background)" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)">{formatPrice(livePrice)}</text>
          </g>
        ) : null}
        <line x1={size.width - axisWidth} x2={size.width - axisWidth} y1="0" y2={size.height} stroke="var(--border)" />
        {[0, 1, 2, 3, 4, 5, 6].map((index) => {
          const price = maxPrice - (range * index) / 6;
          const axisY = padTop + (plotHeight * index) / 6;
          return <text key={index} x={size.width - axisWidth + 7} y={axisY + 3} fill="var(--muted)" fontSize="9" fontFamily="var(--font-mono)">{formatPrice(price)}</text>;
        })}
        {profile.vah !== null ? <text x={size.width - axisWidth - 5} y={y(profile.vah) - 4} textAnchor="end" fill={colors.accent} fontSize="8" fontFamily="var(--font-mono)">VAH</text> : null}
        {profile.val !== null ? <text x={size.width - axisWidth - 5} y={y(profile.val) - 4} textAnchor="end" fill={colors.accent} fontSize="8" fontFamily="var(--font-mono)">VAL</text> : null}
        {profile.poc !== null ? <text x={size.width - axisWidth - 5} y={y(profile.poc) - 4} textAnchor="end" fill="#f5b83b" fontSize="8" fontFamily="var(--font-mono)">POC</text> : null}
        {kind === "volume" && settings.showVwap && profile.vwap !== null ? <text x={size.width - axisWidth - 5} y={y(profile.vwap) - 4} textAnchor="end" fill={colors.up} fontSize="8" fontFamily="var(--font-mono)">VWAP</text> : null}
      </svg>
    </div>
  );
}

export default function SingleProfileWorkspace({
  workspaceId,
  instrument,
  kind,
  active,
  settingsOpenRequest = 0,
}: {
  workspaceId: string;
  instrument: string;
  kind: ProfileKind;
  active: boolean;
  settingsOpenRequest?: number;
}) {
  const storageKey = `kwantdesk:single-${kind}-workspace:v1:${workspaceId}`;
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const previousSettingsOpenRequestRef = useRef(settingsOpenRequest);
  const tradingDates = useMemo(() => recentTradingDates(10), []);

  useEffect(() => {
    if (settingsOpenRequest === previousSettingsOpenRequestRef.current) return;
    previousSettingsOpenRequestRef.current = settingsOpenRequest;
    setDraft(settings);
    setSettingsOpen(true);
  }, [settings, settingsOpenRequest]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<WorkspaceSettings> | null;
      if (!saved) return;
      const next = { ...DEFAULT_SETTINGS, ...saved };
      setSettings(next);
      setDraft(next);
    } catch {
      // Corrupt local preferences should never block the profile.
    }
  }, [storageKey]);

  useEffect(() => {
    const quote = [...readLiveQuoteCache(Number.POSITIVE_INFINITY).values()].find((candidate) => matchesInstrument(candidate.instrument, instrument));
    if (quote?.mid) setLivePrice(quote.mid);
    const receive = (event: Event) => {
      const tick = (event as CustomEvent<DatabentoLiveTick>).detail;
      if (!tick || !matchesInstrument(tick.instrument, instrument) || !Number.isFinite(tick.mid)) return;
      setLivePrice(tick.mid);
    };
    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receive);
    return () => window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receive);
  }, [instrument]);

  const loadTpo = useCallback(async () => {
    // A live Rithmic collector only owns prints observed since its latest
    // restart. That is not enough to guarantee a completed Friday RTH profile
    // on a weekend (or after a gateway restart), so the durable CME candle
    // history is the base and the live snapshot only refreshes its tail.
    const marketRoot = rootSymbol(instrument);
    const historyStartMs = Date.now() - 14 * 24 * 60 * 60_000;
    const [snapshot, archivedFlow, historicalCandles] = await Promise.all([
      fetchInstitutionalSnapshot({ symbol: marketRoot, timeframe: "1m", lookbackBars: 20_000, timeoutMs: 45_000 }),
      fetchInstitutionalOrderFlowLevels({
        symbol: marketRoot,
        timeframe: "1m",
        fromMs: historyStartMs,
        toMs: Date.now(),
        includeTrades: false,
        timeoutMs: 45_000,
      }),
      fetchTpoHistory(instrument).catch(() => []),
    ]);
    const candles = mergeTpoCandles(
      historicalCandles,
      archivedFlow?.candles ?? [],
      snapshot?.candles ?? [],
    );
    if (!candles.length) return null;
    const lastCandle = candles.at(-1)!;
    setLivePrice(snapshot?.lastPrice ?? lastCandle.close);
    const tickSize = snapshot?.tickSize && snapshot.tickSize > 0 ? snapshot.tickSize : rootSymbol(instrument).includes("ES") || rootSymbol(instrument).includes("NQ") ? 0.25 : 0.01;
    const bars: TpoBar[] = candles.map((candle) => ({
      instrumentId: instrument,
      startTimeMs: candle.timestamp,
      endTimeMs: candle.timestamp + 60_000,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      bidVolume: candle.bidVolume,
      askVolume: candle.askVolume,
      tradeCount: candle.trades,
      tickSize,
    }));
    const weekly = settings.preset === "current-week" || settings.preset === "previous-week";
    const engineSettings = defaultTpoSettings(weekly ? "weekly-tpo" : "daily-tpo");
    engineSettings.profileCount = 20;
    engineSettings.visitSource = "bar-range";
    engineSettings.subperiodMinutes = settings.subperiodMinutes;
    engineSettings.groupingMode = "manual";
    engineSettings.ticksPerRow = settings.ticksPerRow;
    engineSettings.displayType = settings.display;
    engineSettings.timezone = settings.timezone;
    engineSettings.valueAreaPercent = 70;
    engineSettings.showPoc = settings.showPoc;
    engineSettings.showValueArea = settings.showValueArea;
    if (weekly) {
      engineSettings.scheduleKind = "weekly";
      engineSettings.weekStartDay = 0;
      engineSettings.weekStartTime = "18:00";
      engineSettings.weekEndMode = "explicit-day-time";
      engineSettings.weekEndDay = 5;
      engineSettings.weekEndTime = "17:00";
    } else if (settings.preset === "custom") {
      engineSettings.scheduleKind = "custom-range";
      engineSettings.periodMode = "custom-range";
      engineSettings.customStartMs = Date.parse(settings.customStart);
      engineSettings.customEndMs = Date.parse(settings.customEnd);
      engineSettings.customEndFollowsLatest = false;
    } else {
      const globex = settings.preset.includes("globex");
      engineSettings.scheduleKind = "daily";
      engineSettings.dailyStartTime = globex ? "18:00" : settings.startTime;
      engineSettings.dailyEndMode = "explicit-time";
      engineSettings.dailyEndTime = globex ? "17:00" : settings.endTime;
      engineSettings.enabledWeekdays = globex ? [0, 1, 2, 3, 4] : [1, 2, 3, 4, 5];
    }
    const previous = settings.preset.startsWith("previous");
    const dataAsOfMs = Math.max(snapshot?.asOfMs ?? 0, lastCandle.timestamp + 60_000);
    // Completion is a wall-clock fact, not a last-trade fact. A Friday RTH
    // profile still completed at 16:00 ET when its final print arrived before
    // 16:00. Comparing its scheduled end only with the last print incorrectly
    // rejects it for the entire weekend.
    const evaluationNowMs = previous ? Math.max(Date.now(), dataAsOfMs) : dataAsOfMs;
    const profiles = buildTpoProfiles({ trades: [], bars, settings: engineSettings, nowMs: evaluationNowMs });
    const completed = profiles.filter((candidate) => candidate.endTimeMs <= evaluationNowMs);
    const selected = previous ? completed.at(-1) : profiles.at(-1);
    if (!selected) return null;
    return applyVisibility(tpoView(selected), settings);
  }, [instrument, settings]);

  const loadVolume = useCallback(async () => {
    const snapshot = await fetchInstitutionalSnapshot({ symbol: instrument, timeframe: "1m", lookbackBars: 2, timeoutMs: 20_000 });
    if (snapshot?.lastPrice) setLivePrice(snapshot.lastPrice);
    const executionFilters = {
      groupTicks: 1,
      minTradeVolume: Math.max(0, settings.minTradeVolume),
      maxTradeVolume: Math.max(0, settings.maxTradeVolume),
    };
    if (settings.preset === "merge-days") {
      if (!settings.selectedDates.length) return null;
      const parts = (await Promise.all(settings.selectedDates.map((tradingDate) => fetchInstitutionalVolumeProfile({
        symbol: instrument,
        period: "daily",
        tradingDate,
        ...executionFilters,
      })))).filter((value): value is InstitutionalVolumeProfile => Boolean(value));
      if (!parts.length) return null;
      const merged = parts.slice(1).reduce((current, next) => mergeInstitutionalVolumeProfiles(current, next), parts[0]);
      return applyVisibility(volumeView(rebinVolumeProfile(merged, settings)), settings);
    }
    let profile: InstitutionalVolumeProfile | null = null;
    if (settings.preset === "current-week") {
      profile = await fetchInstitutionalVolumeProfile({ symbol: instrument, period: "weekly", ...executionFilters });
    } else if (settings.preset === "previous-week") {
      const boundary = previousWeeklyBoundary(settings);
      profile = boundary ? await fetchInstitutionalVolumeProfile({ symbol: instrument, period: "custom", startMs: boundary.startMs, endMs: boundary.endMs, ...executionFilters }) : null;
    } else if (settings.preset === "recurring-custom") {
      const boundary = recurringBoundary(settings);
      profile = boundary ? await fetchInstitutionalVolumeProfile({ symbol: instrument, period: "custom", startMs: boundary.startMs, endMs: Math.min(boundary.endMs, Date.now()), ...executionFilters }) : null;
    } else if (settings.preset === "custom") {
      profile = await fetchInstitutionalVolumeProfile({
        symbol: instrument,
        period: "custom",
        startMs: Date.parse(settings.customStart),
        endMs: Date.parse(settings.customEnd),
        ...executionFilters,
      });
    } else {
      const previous = settings.preset.startsWith("previous");
      profile = await fetchInstitutionalVolumeProfile({
        symbol: instrument,
        period: "daily",
        tradingDate: previous ? latestCompletedRthDate(tradingDates) : tradingDates[0],
        ...executionFilters,
      });
    }
    if (!profile) return null;
    return applyVisibility(volumeView(rebinVolumeProfile(profile, settings)), settings);
  }, [instrument, settings, tradingDates]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const next = kind === "tpo" ? await loadTpo() : await loadVolume();
        if (cancelled) return;
        setProfile(next);
        setError(next ? null : "No completed profile was returned for this window.");
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The profile request did not complete.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const developing = settings.preset.startsWith("current") || settings.preset === "custom" || settings.preset === "recurring-custom";
    if (active && developing) timer = window.setInterval(load, 15_000);
    return () => { cancelled = true; if (timer !== null) window.clearInterval(timer); };
  }, [active, kind, loadTpo, loadVolume, refreshNonce, settings.preset]);

  const save = () => {
    const next = {
      ...draft,
      ticksPerRow: Math.max(1, Math.round(draft.ticksPerRow)),
      pricePerRow: Math.max(0.000001, Number(draft.pricePerRow)),
      targetRows: Math.max(20, Math.min(400, Math.round(draft.targetRows))),
      minTradeVolume: Math.max(0, Math.round(draft.minTradeVolume)),
      maxTradeVolume: Math.max(0, Math.round(draft.maxTradeVolume)),
      profileWidthPercent: Math.max(10, Math.min(100, Number(draft.profileWidthPercent))),
      opacityPercent: Math.max(10, Math.min(100, Number(draft.opacityPercent))),
      gradientPreset: String(draft.gradientPreset ?? VOLUME_PROFILE_GRADIENT_OFF),
      subperiodMinutes: Math.max(5, Math.round(draft.subperiodMinutes)),
    };
    setSettings(next);
    writeProtectedItem(storageKey, JSON.stringify(next));
    setSettingsOpen(false);
  };

  const preset = PRESETS.find((candidate) => candidate.id === settings.preset);
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-panel px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[9px] font-semibold text-primary">{rootSymbol(instrument)}</span>
          <span className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{preset?.label ?? "Custom profile"}</span>
          {profile ? <span className="hidden truncate font-mono text-[8px] text-muted/70 lg:inline">{formatPeriod(profile.startMs, profile.endMs)}</span> : null}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setRefreshNonce((value) => value + 1)} className="flex h-7 w-7 items-center justify-center border border-border text-muted hover:border-primary/40 hover:text-primary" title="Refresh profile"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>
      {profile ? (
        <div className="grid h-9 shrink-0 grid-cols-4 border-b border-border bg-panel/70">
          {[["LIVE", formatPrice(livePrice)], ["POC", formatPrice(profile.poc)], ["VAH", formatPrice(profile.vah)], ["VAL", formatPrice(profile.val)]].map(([label, value]) => (
            <div key={label} className="flex items-center justify-center gap-1.5 border-r border-border last:border-r-0"><span className="font-mono text-[7px] tracking-[0.14em] text-muted">{label}</span><span className="font-mono text-[9px] font-semibold text-foreground">{value}</span></div>
          ))}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        {profile ? <ProfileCanvas kind={kind} profile={profile} livePrice={livePrice} settings={settings} /> : null}
        {loading && !profile ? <div className="absolute inset-0 flex items-center justify-center bg-background"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-muted"><Loader2 className="h-4 w-4 animate-spin text-primary" />Building {kind === "tpo" ? "time" : "volume"} profile</div></div> : null}
        {error && !profile && !loading ? <div className="absolute inset-0 flex items-center justify-center p-6"><div className="max-w-sm border border-border bg-panel p-4 text-center"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">Profile unavailable</p><p className="mt-2 text-[10px] leading-5 text-muted">{error}</p><button type="button" onClick={() => setRefreshNonce((value) => value + 1)} className="mt-3 border border-primary/40 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-primary">Try again</button></div></div> : null}
      </div>
      {profile ? <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-panel px-2.5 font-mono text-[7px] uppercase tracking-[0.12em] text-muted"><span>{profile.source}</span><span>{kind === "tpo" ? `${profile.total.toLocaleString()} TPOS` : `${profile.total.toLocaleString()} CONTRACTS · ${profile.groupTicks} TICKS/ROW`} · FIXED 70% VALUE AREA</span></div> : null}

      <FloatingSettingsWindow
        open={settingsOpen}
        title={kind === "tpo" ? "Single TPO Settings" : "Single Volume Profile Settings"}
        subtitle="Workspace preview remains visible and interactive"
        onClose={() => setSettingsOpen(false)}
        widthClassName="w-[min(480px,calc(100vw-24px))]"
        contentClassName="space-y-4 p-3"
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDraft({ ...DEFAULT_SETTINGS, customStart: dateInputValue(Date.now() - 86_400_000), customEnd: dateInputValue(Date.now()) })} className="h-9 border border-border font-mono text-[8px] uppercase tracking-[0.12em] text-muted hover:text-foreground">Reset</button>
            <button type="button" onClick={save} disabled={(draft.preset === "merge-days" && draft.selectedDates.length < 2) || (draft.preset === "custom" && (!Number.isFinite(Date.parse(draft.customStart)) || !Number.isFinite(Date.parse(draft.customEnd)) || Date.parse(draft.customEnd) <= Date.parse(draft.customStart)))} className="h-9 bg-primary font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-background disabled:opacity-40">Apply profile</button>
          </div>
        )}
      >
              <label className="block"><span className="mb-1.5 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Profile preset</span><div className="relative"><KwantSelect value={draft.preset} onChange={(event) => setDraft((current) => ({ ...current, preset: event.target.value as ProfilePreset }))} className="h-9 w-full appearance-none border border-border bg-background px-2.5 pr-8 font-mono text-[9px] text-foreground outline-none focus:border-primary/60">{PRESETS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}{kind === "volume" ? <option value="merge-days">Merge selected days</option> : null}</KwantSelect><ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted" /></div><span className="mt-1 block text-[8px] leading-4 text-muted">{draft.preset === "merge-days" ? "Select two or more completed RTH sessions and combine them into one exact profile." : PRESETS.find((option) => option.id === draft.preset)?.detail}</span></label>
              {draft.preset === "custom" ? <div className="grid grid-cols-1 gap-3"><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">From</span><input type="datetime-local" value={draft.customStart} onChange={(event) => setDraft((current) => ({ ...current, customStart: event.target.value }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Until</span><input type="datetime-local" value={draft.customEnd} onChange={(event) => setDraft((current) => ({ ...current, customEnd: event.target.value }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label></div> : null}
              {draft.preset === "recurring-custom" ? <div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Daily start</span><input type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Daily end</span><input type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label></div> : null}
              {draft.preset === "merge-days" && kind === "volume" ? <div><span className="mb-2 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Sessions to merge</span><div className="grid grid-cols-2 gap-1.5">{tradingDates.map((date) => { const selected = draft.selectedDates.includes(date); return <button key={date} type="button" onClick={() => setDraft((current) => ({ ...current, selectedDates: selected ? current.selectedDates.filter((value) => value !== date) : [...current.selectedDates, date] }))} className={`flex h-8 items-center justify-between border px-2 font-mono text-[8px] ${selected ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-background text-muted"}`}><span>{date}</span>{selected ? <Check className="h-3 w-3" /> : null}</button>; })}</div></div> : null}
              {kind === "tpo" ? <div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Rows · ticks</span><input type="number" min="1" max="64" value={draft.ticksPerRow} onChange={(event) => setDraft((current) => ({ ...current, ticksPerRow: Number(event.target.value) }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] outline-none focus:border-primary/60" /></label><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">TPO period · min</span><input type="number" min="5" max="120" step="5" value={draft.subperiodMinutes} onChange={(event) => setDraft((current) => ({ ...current, subperiodMinutes: Number(event.target.value) }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] outline-none focus:border-primary/60" /></label></div> : null}
              {kind === "volume" ? <div className="space-y-3 border border-border bg-background p-2.5">
                <div><p className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-foreground">Price granularity</p><p className="mt-1 text-[8px] leading-4 text-muted">Changes the real price bins and recalculates POC, VAH and VAL.</p></div>
                <label className="block"><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Grouping mode</span><KwantSelect value={draft.volumeGranularity} onChange={(event) => setDraft((current) => ({ ...current, volumeGranularity: event.target.value as WorkspaceSettings["volumeGranularity"] }))} className="h-9 w-full border border-border bg-panel px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60"><option value="auto">Automatic target rows</option><option value="ticks">Ticks per row</option><option value="price">Price per row</option></KwantSelect></label>
                {draft.volumeGranularity === "auto" ? <label className="block"><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Target rows · {draft.targetRows}</span><input type="range" min="20" max="400" step="5" value={draft.targetRows} onChange={(event) => setDraft((current) => ({ ...current, targetRows: Number(event.target.value) }))} className="w-full accent-[var(--primary)]" /></label> : null}
                {draft.volumeGranularity === "ticks" ? <label className="block"><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Ticks per row</span><input type="number" min="1" max="500" value={draft.ticksPerRow} onChange={(event) => setDraft((current) => ({ ...current, ticksPerRow: Number(event.target.value) }))} className="h-9 w-full border border-border bg-panel px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label> : null}
                {draft.volumeGranularity === "price" ? <label className="block"><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Price per row</span><input type="number" min="0.000001" step="0.25" value={draft.pricePerRow} onChange={(event) => setDraft((current) => ({ ...current, pricePerRow: Number(event.target.value) }))} className="h-9 w-full border border-border bg-panel px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label> : null}
              </div> : null}
              {kind === "volume" ? <div className="space-y-3 border border-border bg-background p-2.5">
                <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-foreground">Profile display</p>
                <div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Profile mode</span><KwantSelect value={draft.volumeDisplay} onChange={(event) => setDraft((current) => ({ ...current, volumeDisplay: event.target.value as WorkspaceSettings["volumeDisplay"] }))} className="h-9 w-full border border-border bg-panel px-2 font-mono text-[9px] text-foreground"><option value="total">Total volume</option><option value="bid-ask">Bid / Ask</option><option value="delta-volume">Delta + Volume</option></KwantSelect></label><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Scale</span><KwantSelect value={draft.volumeScale} onChange={(event) => setDraft((current) => ({ ...current, volumeScale: event.target.value as WorkspaceSettings["volumeScale"] }))} className="h-9 w-full border border-border bg-panel px-2 font-mono text-[9px] text-foreground"><option value="linear">Linear</option><option value="sqrt">Square root</option><option value="log">Logarithmic</option></KwantSelect></label></div>
                <div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Anchor side</span><KwantSelect value={draft.profileSide} onChange={(event) => setDraft((current) => ({ ...current, profileSide: event.target.value as WorkspaceSettings["profileSide"] }))} className="h-9 w-full border border-border bg-panel px-2 font-mono text-[9px] text-foreground"><option value="left">Left</option><option value="right">Right</option></KwantSelect></label><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Width · {draft.profileWidthPercent}%</span><input type="range" min="10" max="100" step="1" value={draft.profileWidthPercent} onChange={(event) => setDraft((current) => ({ ...current, profileWidthPercent: Number(event.target.value) }))} className="mt-2 w-full accent-[var(--primary)]" /></label></div>
                <label className="block"><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Opacity · {draft.opacityPercent}%</span><input type="range" min="10" max="100" step="1" value={draft.opacityPercent} onChange={(event) => setDraft((current) => ({ ...current, opacityPercent: Number(event.target.value) }))} className="w-full accent-[var(--primary)]" /></label>
                <div className="block">
                  <span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Gradient scheme</span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, gradientPreset: VOLUME_PROFILE_GRADIENT_OFF }))}
                      className={`h-8 border font-mono text-[8px] uppercase tracking-[0.1em] ${
                        draft.gradientPreset === VOLUME_PROFILE_GRADIENT_OFF
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      Off
                    </button>
                    {VOLUME_PROFILE_GRADIENTS.map((gradient) => (
                      <button
                        key={gradient.id}
                        type="button"
                        title={gradient.label}
                        onClick={() => setDraft((current) => ({ ...current, gradientPreset: gradient.id }))}
                        className={`relative h-8 overflow-hidden border ${
                          draft.gradientPreset === gradient.id ? "border-primary" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})` }} />
                        <span className="relative z-10 px-1 font-mono text-[7px] uppercase tracking-[0.08em] text-white mix-blend-difference">{gradient.label}</span>
                      </button>
                    ))}
                  </div>
                  <span className="mt-1 block text-[8px] leading-4 text-muted">Fades the profile across its price range, matching the schemes on the chart volume profiles.</span>
                </div>
              </div> : null}
              {kind === "volume" ? <div className="space-y-3 border border-border bg-background p-2.5">
                <div><p className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-foreground">Execution filter</p><p className="mt-1 text-[8px] leading-4 text-muted">Filters individual executed trades before the profile is calculated.</p></div>
                <div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Minimum size</span><input type="number" min="0" step="1" value={draft.minTradeVolume} onChange={(event) => setDraft((current) => ({ ...current, minTradeVolume: Number(event.target.value) }))} className="h-9 w-full border border-border bg-panel px-2 font-mono text-[9px] text-foreground" /></label><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-muted">Maximum · 0 = none</span><input type="number" min="0" step="1" value={draft.maxTradeVolume} onChange={(event) => setDraft((current) => ({ ...current, maxTradeVolume: Number(event.target.value) }))} className="h-9 w-full border border-border bg-panel px-2 font-mono text-[9px] text-foreground" /></label></div>
              </div> : null}
              {kind === "tpo" ? <label className="block"><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Display</span><KwantSelect value={draft.display} onChange={(event) => setDraft((current) => ({ ...current, display: event.target.value as "blocks" | "letters" }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px]"><option value="blocks">Square blocks</option><option value="letters">TPO letters</option></KwantSelect></label> : null}
              <div className="space-y-2">{[["showPoc", "Show point of control"], ["showValueArea", "Show VAH and VAL"], ...(kind === "volume" ? [["showVwap", "Show VWAP"], ["showRowValues", "Show row volume labels"]] : [])].map(([key, label]) => <label key={key} className="flex items-center justify-between border border-border bg-background px-2.5 py-2 font-mono text-[8px] uppercase tracking-[0.1em] text-muted"><span>{label}</span><input type="checkbox" checked={Boolean(draft[key as keyof WorkspaceSettings])} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))} className="accent-[var(--primary)]" /></label>)}</div>
              <div className="border border-border bg-background p-2.5 text-[8px] leading-4 text-muted">Value area is fixed at the market-standard 70%. Profiles use the shared CME/Rithmic data path and never render future data.</div>
      </FloatingSettingsWindow>
    </div>
  );
}
