"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, RefreshCw, Settings2, X } from "lucide-react";
import { DATABENTO_LIVE_TICK_EVENT, type DatabentoLiveTick } from "@/lib/chartLiveEvents";
import {
  fetchInstitutionalSnapshot,
  fetchInstitutionalVolumeProfile,
  mergeInstitutionalVolumeProfiles,
  type InstitutionalVolumeProfile,
} from "@/lib/institutionalMarketData";
import { readLiveQuoteCache } from "@/lib/liveQuoteCache";
import { buildTpoProfiles, periodBoundaryForTime, zonedParts } from "@/lib/tpo/engine";
import { defaultTpoSettings } from "@/lib/tpo/settings";
import { tickToPrice, type TpoBar, type TpoProfileModel } from "@/lib/tpo/types";

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
};

type RenderRow = {
  price: number;
  weight: number;
  label: string;
  inValueArea: boolean;
  isPoc: boolean;
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
      };
    }),
    poc,
    vah,
    val,
    startMs: profile.startTimeMs,
    endMs: profile.endTimeMs,
    source: profile.source === "exact-trades" ? "EXACT EXECUTIONS" : "CME 1M RANGE",
    total: profile.totalTpos,
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
    })),
    poc: profile.poc,
    vah: profile.vah,
    val: profile.val,
    startMs: profile.startMs,
    endMs: profile.endMs,
    source: profile.provider === "Rithmic" ? "RITHMIC EXECUTIONS" : `${profile.provider.toUpperCase()} EXECUTIONS`,
    total: profile.totalVolume,
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

function ProfileCanvas({ kind, profile, livePrice, display }: { kind: ProfileKind; profile: ProfileView; livePrice: number | null; display: WorkspaceSettings["display"] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 640 });
  const [accent, setAccent] = useState("#a3ff12");

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const read = () => {
      const bounds = element.getBoundingClientRect();
      setSize({ width: Math.max(320, bounds.width), height: Math.max(260, bounds.height) });
      setAccent(getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#a3ff12");
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
  const axisWidth = 92;
  const plotWidth = Math.max(120, size.width - axisWidth - 40);
  const plotHeight = Math.max(120, size.height - padTop - padBottom);
  const maxWeight = Math.max(1, ...sorted.map((row) => row.weight));
  const rowHeight = Math.max(2, Math.min(18, plotHeight / Math.max(1, sorted.length)));
  const y = (price: number) => padTop + ((maxPrice - price) / range) * plotHeight;
  const profileStartX = 28;
  const profileMaxWidth = plotWidth * 0.72;

  return (
    <div ref={containerRef} className="h-full min-h-0 w-full overflow-hidden bg-background">
      <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" role="img" aria-label={`${kind === "tpo" ? "TPO" : "Volume"} profile`}>
        <defs>
          <linearGradient id={`profile-fill-${kind}`} x1="0" x2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.92" />
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
          const width = Math.max(2, (row.weight / maxWeight) * profileMaxWidth);
          const fill = row.isPoc ? "#f5b83b" : row.inValueArea ? `url(#profile-fill-${kind})` : "var(--muted)";
          const tpoBlockWidth = Math.max(1.5, Math.min(10, rowHeight - 0.75, profileMaxWidth / maxWeight));
          return (
            <g key={row.price}>
              {kind === "volume" ? <rect x={profileStartX} y={rowY} width={width} height={Math.max(1, rowHeight - 1)} fill={fill} opacity={row.inValueArea || row.isPoc ? 0.95 : 0.45} /> : null}
              {kind === "tpo" ? Array.from({ length: Math.min(300, Math.max(1, Math.round(row.weight))) }, (_, index) => (
                <g key={index}>
                  <rect x={profileStartX + index * tpoBlockWidth} y={rowY} width={Math.max(1, tpoBlockWidth - 0.6)} height={Math.max(1, rowHeight - 1)} fill={fill} opacity={row.inValueArea || row.isPoc ? 0.96 : 0.55} />
                  {display === "letters" && tpoBlockWidth >= 7 && rowHeight >= 8 ? <text x={profileStartX + index * tpoBlockWidth + tpoBlockWidth / 2} y={rowY + rowHeight * 0.72} textAnchor="middle" fill="var(--background)" fontSize={Math.min(8, rowHeight - 2)} fontFamily="var(--font-mono)">{row.label[index] ?? "·"}</text> : null}
                </g>
              )) : null}
            </g>
          );
        })}
        {profile.vah !== null ? <line x1="0" x2={size.width - axisWidth} y1={y(profile.vah)} y2={y(profile.vah)} stroke={accent} strokeWidth="1" strokeDasharray="4 4" opacity="0.75" /> : null}
        {profile.val !== null ? <line x1="0" x2={size.width - axisWidth} y1={y(profile.val)} y2={y(profile.val)} stroke={accent} strokeWidth="1" strokeDasharray="4 4" opacity="0.75" /> : null}
        {profile.poc !== null ? <line x1="0" x2={size.width - axisWidth} y1={y(profile.poc)} y2={y(profile.poc)} stroke="#f5b83b" strokeWidth="1.5" /> : null}
        {livePrice !== null ? (
          <g filter={`url(#profile-glow-${kind})`}>
            <line x1="0" x2={size.width - axisWidth} y1={y(livePrice)} y2={y(livePrice)} stroke={accent} strokeWidth="1.5" />
            <rect x={size.width - axisWidth} y={y(livePrice) - 11} width={axisWidth} height="22" fill={accent} />
            <text x={size.width - axisWidth + 7} y={y(livePrice) + 4} fill="var(--background)" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)">{formatPrice(livePrice)}</text>
          </g>
        ) : null}
        <line x1={size.width - axisWidth} x2={size.width - axisWidth} y1="0" y2={size.height} stroke="var(--border)" />
        {[0, 1, 2, 3, 4, 5, 6].map((index) => {
          const price = maxPrice - (range * index) / 6;
          const axisY = padTop + (plotHeight * index) / 6;
          return <text key={index} x={size.width - axisWidth + 7} y={axisY + 3} fill="var(--muted)" fontSize="9" fontFamily="var(--font-mono)">{formatPrice(price)}</text>;
        })}
        {profile.vah !== null ? <text x={size.width - axisWidth - 5} y={y(profile.vah) - 4} textAnchor="end" fill={accent} fontSize="8" fontFamily="var(--font-mono)">VAH</text> : null}
        {profile.val !== null ? <text x={size.width - axisWidth - 5} y={y(profile.val) - 4} textAnchor="end" fill={accent} fontSize="8" fontFamily="var(--font-mono)">VAL</text> : null}
        {profile.poc !== null ? <text x={size.width - axisWidth - 5} y={y(profile.poc) - 4} textAnchor="end" fill="#f5b83b" fontSize="8" fontFamily="var(--font-mono)">POC</text> : null}
      </svg>
    </div>
  );
}

export default function SingleProfileWorkspace({
  workspaceId,
  instrument,
  kind,
  active,
}: {
  workspaceId: string;
  instrument: string;
  kind: ProfileKind;
  active: boolean;
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
  const tradingDates = useMemo(() => recentTradingDates(10), []);

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
    const snapshot = await fetchInstitutionalSnapshot({ symbol: instrument, timeframe: "1m", lookbackBars: 60_000, timeoutMs: 45_000 });
    if (!snapshot?.candles.length) return null;
    setLivePrice(snapshot.lastPrice);
    const tickSize = snapshot.tickSize && snapshot.tickSize > 0 ? snapshot.tickSize : rootSymbol(instrument).includes("ES") || rootSymbol(instrument).includes("NQ") ? 0.25 : 0.01;
    const bars: TpoBar[] = snapshot.candles.map((candle) => ({
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
    const profiles = buildTpoProfiles({ trades: [], bars, settings: engineSettings, nowMs: snapshot.asOfMs });
    const previous = settings.preset.startsWith("previous");
    const completed = profiles.filter((candidate) => candidate.endTimeMs <= snapshot.asOfMs);
    const selected = previous ? completed.at(-1) : profiles.at(-1);
    if (!selected) return null;
    return applyVisibility(tpoView(selected), settings);
  }, [instrument, settings]);

  const loadVolume = useCallback(async () => {
    const snapshot = await fetchInstitutionalSnapshot({ symbol: instrument, timeframe: "1m", lookbackBars: 2, timeoutMs: 20_000 });
    if (snapshot?.lastPrice) setLivePrice(snapshot.lastPrice);
    if (settings.preset === "merge-days") {
      if (!settings.selectedDates.length) return null;
      const parts = (await Promise.all(settings.selectedDates.map((tradingDate) => fetchInstitutionalVolumeProfile({
        symbol: instrument,
        period: "daily",
        tradingDate,
        groupTicks: settings.ticksPerRow,
      })))).filter((value): value is InstitutionalVolumeProfile => Boolean(value));
      if (!parts.length) return null;
      return volumeView(parts.slice(1).reduce((merged, next) => mergeInstitutionalVolumeProfiles(merged, next), parts[0]));
    }
    let profile: InstitutionalVolumeProfile | null = null;
    if (settings.preset === "current-week") {
      profile = await fetchInstitutionalVolumeProfile({ symbol: instrument, period: "weekly", groupTicks: settings.ticksPerRow });
    } else if (settings.preset === "previous-week") {
      const boundary = previousWeeklyBoundary(settings);
      profile = boundary ? await fetchInstitutionalVolumeProfile({ symbol: instrument, period: "custom", startMs: boundary.startMs, endMs: boundary.endMs, groupTicks: settings.ticksPerRow }) : null;
    } else if (settings.preset === "recurring-custom") {
      const boundary = recurringBoundary(settings);
      profile = boundary ? await fetchInstitutionalVolumeProfile({ symbol: instrument, period: "custom", startMs: boundary.startMs, endMs: Math.min(boundary.endMs, Date.now()), groupTicks: settings.ticksPerRow }) : null;
    } else if (settings.preset === "custom") {
      profile = await fetchInstitutionalVolumeProfile({
        symbol: instrument,
        period: "custom",
        startMs: Date.parse(settings.customStart),
        endMs: Date.parse(settings.customEnd),
        groupTicks: settings.ticksPerRow,
      });
    } else {
      const previous = settings.preset.startsWith("previous");
      profile = await fetchInstitutionalVolumeProfile({
        symbol: instrument,
        period: "daily",
        tradingDate: previous ? latestCompletedRthDate(tradingDates) : tradingDates[0],
        groupTicks: settings.ticksPerRow,
      });
    }
    if (!profile) return null;
    return applyVisibility(volumeView(profile), settings);
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
    const next = { ...draft, ticksPerRow: Math.max(1, Math.round(draft.ticksPerRow)), subperiodMinutes: Math.max(5, Math.round(draft.subperiodMinutes)) };
    setSettings(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
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
          <button type="button" onClick={() => { setDraft(settings); setSettingsOpen(true); }} className="flex h-7 w-7 items-center justify-center border border-border text-muted hover:border-primary/40 hover:text-primary" title="Profile settings"><Settings2 className="h-3.5 w-3.5" /></button>
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
        {profile ? <ProfileCanvas kind={kind} profile={profile} livePrice={livePrice} display={settings.display} /> : null}
        {loading && !profile ? <div className="absolute inset-0 flex items-center justify-center bg-background"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-muted"><Loader2 className="h-4 w-4 animate-spin text-primary" />Building {kind === "tpo" ? "time" : "volume"} profile</div></div> : null}
        {error && !profile && !loading ? <div className="absolute inset-0 flex items-center justify-center p-6"><div className="max-w-sm border border-border bg-panel p-4 text-center"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">Profile unavailable</p><p className="mt-2 text-[10px] leading-5 text-muted">{error}</p><button type="button" onClick={() => setRefreshNonce((value) => value + 1)} className="mt-3 border border-primary/40 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-primary">Try again</button></div></div> : null}
      </div>
      {profile ? <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-panel px-2.5 font-mono text-[7px] uppercase tracking-[0.12em] text-muted"><span>{profile.source}</span><span>{kind === "tpo" ? `${profile.total.toLocaleString()} TPOS` : `${profile.total.toLocaleString()} CONTRACTS`} · FIXED 70% VALUE AREA</span></div> : null}

      {settingsOpen ? (
        <div className="absolute inset-0 z-50 flex justify-end bg-background/55 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <div className="flex h-full w-[min(390px,92%)] flex-col border-l border-border bg-panel shadow-2xl">
            <div className="flex h-11 items-center justify-between border-b border-border px-3"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">{kind === "tpo" ? "Single TPO" : "Single Volume Profile"}</p><p className="mt-0.5 text-[8px] text-muted">Workspace settings</p></div><button type="button" onClick={() => setSettingsOpen(false)} className="flex h-7 w-7 items-center justify-center text-muted hover:text-foreground"><X className="h-4 w-4" /></button></div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
              <label className="block"><span className="mb-1.5 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Profile preset</span><div className="relative"><select value={draft.preset} onChange={(event) => setDraft((current) => ({ ...current, preset: event.target.value as ProfilePreset }))} className="h-9 w-full appearance-none border border-border bg-background px-2.5 pr-8 font-mono text-[9px] text-foreground outline-none focus:border-primary/60">{PRESETS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}{kind === "volume" ? <option value="merge-days">Merge selected days</option> : null}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted" /></div><span className="mt-1 block text-[8px] leading-4 text-muted">{draft.preset === "merge-days" ? "Select two or more completed RTH sessions and combine them into one exact profile." : PRESETS.find((option) => option.id === draft.preset)?.detail}</span></label>
              {draft.preset === "custom" ? <div className="grid grid-cols-1 gap-3"><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">From</span><input type="datetime-local" value={draft.customStart} onChange={(event) => setDraft((current) => ({ ...current, customStart: event.target.value }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Until</span><input type="datetime-local" value={draft.customEnd} onChange={(event) => setDraft((current) => ({ ...current, customEnd: event.target.value }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label></div> : null}
              {draft.preset === "recurring-custom" ? <div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Daily start</span><input type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Daily end</span><input type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] text-foreground outline-none focus:border-primary/60" /></label></div> : null}
              {draft.preset === "merge-days" && kind === "volume" ? <div><span className="mb-2 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Sessions to merge</span><div className="grid grid-cols-2 gap-1.5">{tradingDates.map((date) => { const selected = draft.selectedDates.includes(date); return <button key={date} type="button" onClick={() => setDraft((current) => ({ ...current, selectedDates: selected ? current.selectedDates.filter((value) => value !== date) : [...current.selectedDates, date] }))} className={`flex h-8 items-center justify-between border px-2 font-mono text-[8px] ${selected ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-background text-muted"}`}><span>{date}</span>{selected ? <Check className="h-3 w-3" /> : null}</button>; })}</div></div> : null}
              <div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Rows · ticks</span><input type="number" min="1" max="64" value={draft.ticksPerRow} onChange={(event) => setDraft((current) => ({ ...current, ticksPerRow: Number(event.target.value) }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] outline-none focus:border-primary/60" /></label>{kind === "tpo" ? <label><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">TPO period · min</span><input type="number" min="5" max="120" step="5" value={draft.subperiodMinutes} onChange={(event) => setDraft((current) => ({ ...current, subperiodMinutes: Number(event.target.value) }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px] outline-none focus:border-primary/60" /></label> : null}</div>
              {kind === "tpo" ? <label className="block"><span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted">Display</span><select value={draft.display} onChange={(event) => setDraft((current) => ({ ...current, display: event.target.value as "blocks" | "letters" }))} className="h-9 w-full border border-border bg-background px-2 font-mono text-[9px]"><option value="blocks">Square blocks</option><option value="letters">TPO letters</option></select></label> : null}
              <div className="space-y-2">{[["showPoc", "Show point of control"], ["showValueArea", "Show VAH and VAL"]].map(([key, label]) => <label key={key} className="flex items-center justify-between border border-border bg-background px-2.5 py-2 font-mono text-[8px] uppercase tracking-[0.1em] text-muted"><span>{label}</span><input type="checkbox" checked={Boolean(draft[key as keyof WorkspaceSettings])} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))} className="accent-[var(--primary)]" /></label>)}</div>
              <div className="border border-border bg-background p-2.5 text-[8px] leading-4 text-muted">Value area is fixed at the market-standard 70%. Profiles use the shared CME/Rithmic data path and never render future data.</div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border p-3"><button type="button" onClick={() => setDraft({ ...DEFAULT_SETTINGS, customStart: dateInputValue(Date.now() - 86_400_000), customEnd: dateInputValue(Date.now()) })} className="h-9 border border-border font-mono text-[8px] uppercase tracking-[0.12em] text-muted hover:text-foreground">Reset</button><button type="button" onClick={save} disabled={(draft.preset === "merge-days" && draft.selectedDates.length < 2) || (draft.preset === "custom" && (!Number.isFinite(Date.parse(draft.customStart)) || !Number.isFinite(Date.parse(draft.customEnd)) || Date.parse(draft.customEnd) <= Date.parse(draft.customStart)))} className="h-9 bg-primary font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-background disabled:opacity-40">Apply profile</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
