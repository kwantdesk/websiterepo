"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  FlaskConical,
  Layers3,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Candle } from "@/lib/backtester";
import type { ChartLevel, ChartZone } from "@/components/Chart";
import type { ChartGammaLevelsPayload, ChartGammaSourceLevelKind } from "@/lib/chartGammaLevels";
import { mergeGammaLevelsAtSamePrice } from "@/lib/chartGammaLevels";
import type { GameplanPayload, GameplanRole } from "@/lib/gameplan";
import { defaultChartSettings, loadStoredChartSettings, type ChartSettings } from "@/lib/chartSettings";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";

const Chart = dynamic(() => import("@/components/Chart"), {
  ssr: false,
  loading: () => <KwantLoader className="h-full" compact title="Opening replay chart" detail="Preparing the historical workspace." />,
});

type ReplayInstrument = "NQ" | "MNQ" | "ES" | "MES";
type ReplayTimeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h";
type LevelFamily = "gamma" | "quant" | "valueArea";

type SessionPayload = {
  candles: Candle[];
  dataset: string;
  coverage: { earliestDocumented: string; note: string };
  error?: string;
};

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
const TIMEFRAMES: ReplayTimeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h"];
const SPEEDS = [1, 2, 8, 10, 20, 40, 100, 200] as const;

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

function newYorkLocalToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = guess - timeZoneOffset(new Date(guess), "America/New_York");
  return first - (timeZoneOffset(new Date(first), "America/New_York") - timeZoneOffset(new Date(guess), "America/New_York"));
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

function formatReplayClock(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
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

async function requestJson<T extends { error?: string }>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json() as T;
  if (!response.ok) throw new Error(payload.error || "Historical data is unavailable.");
  return payload;
}

export default function BacktestingWorkspace() {
  const [settings, setSettings] = useState<ChartSettings>(defaultChartSettings);
  const [showSetup, setShowSetup] = useState(false);
  const [instrument, setInstrument] = useState<ReplayInstrument>("NQ");
  const [timeframe, setTimeframe] = useState<ReplayTimeframe>("1m");
  const [date, setDate] = useState(defaultReplayDate);
  const [time, setTime] = useState("09:30");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [sessionStartAt, setSessionStartAt] = useState<number | null>(null);
  const [replayStartIndex, setReplayStartIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [loading, setLoading] = useState(false);
  const [timeframeLoading, setTimeframeLoading] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [levelState, setLevelState] = useState<Record<LevelFamily, boolean>>({ gamma: false, quant: false, valueArea: false });
  const [levelLoading, setLevelLoading] = useState(false);
  const [levelError, setLevelError] = useState<Record<LevelFamily, string>>({ gamma: "", quant: "", valueArea: "" });
  const [gammaLevels, setGammaLevels] = useState<ChartLevel[]>([]);
  const [quantLevels, setQuantLevels] = useState<ChartLevel[]>([]);
  const [quantZones, setQuantZones] = useState<ChartZone[]>([]);
  const [valueAreaLevels, setValueAreaLevels] = useState<ChartLevel[]>([]);
  const [snapshotDate, setSnapshotDate] = useState("");
  const accumulatorRef = useRef(0);

  useEffect(() => setSettings(loadStoredChartSettings()), []);

  const selectedDefinition = INSTRUMENTS.find((item) => item.id === instrument) ?? INSTRUMENTS[0];
  const root = instrument === "NQ" || instrument === "MNQ" ? "NQ" : "ES";
  const replayClock = candles[Math.min(visibleIndex, Math.max(0, candles.length - 1))]?.timestamp ?? null;
  const visibleCandles = useMemo(() => candles.slice(0, visibleIndex + 1), [candles, visibleIndex]);
  const activeLevels = useMemo(() => [
    ...(levelState.gamma ? gammaLevels : []),
    ...(levelState.quant ? quantLevels : []),
    ...(levelState.valueArea ? valueAreaLevels : []),
  ], [gammaLevels, levelState, quantLevels, valueAreaLevels]);
  const activeZones = levelState.quant ? quantZones : [];

  const loadLevels = useCallback(async (clock: number, force = false) => {
    const eligibleDate = latestCompletedOptionsSession(clock);
    if (!force && eligibleDate === snapshotDate) return;
    setSnapshotDate(eligibleDate);
    setLevelLoading(true);
    setLevelError({ gamma: "", quant: "", valueArea: "" });
    const gammaSource = root === "NQ" ? "QQQ" : "SPY";
    const [gamma, quant, valueArea] = await Promise.allSettled([
      requestJson<ChartGammaLevelsPayload & { error?: string }>(
        `/api/chart-gamma-levels?root=${root}&source=${gammaSource}&calibrated=1&sessionDate=${eligibleDate}`,
      ),
      requestJson<GameplanPayload & { error?: string }>(
        `/api/gameplan?root=${root}&sessionDate=${eligibleDate}`,
      ),
      requestJson<ValueAreaPayload>(
        `/api/databento/value-area?symbol=${encodeURIComponent(selectedDefinition.symbol)}&asOf=${encodeURIComponent(new Date(clock).toISOString())}`,
      ),
    ]);
    if (gamma.status === "fulfilled") setGammaLevels(gammaSnapshot(gamma.value, settings));
    else setGammaLevels([]);
    if (quant.status === "fulfilled") {
      const snapshot = quantSnapshot(quant.value, settings);
      setQuantLevels(snapshot.levels);
      setQuantZones(snapshot.zones);
    } else {
      setQuantLevels([]);
      setQuantZones([]);
    }
    if (valueArea.status === "fulfilled") setValueAreaLevels(valueAreaSnapshot(valueArea.value));
    else setValueAreaLevels([]);
    setLevelError({
      gamma: gamma.status === "rejected" ? (gamma.reason instanceof Error ? gamma.reason.message : "Gamma unavailable") : "",
      quant: quant.status === "rejected" ? (quant.reason instanceof Error ? quant.reason.message : "Quant levels unavailable") : "",
      valueArea: valueArea.status === "rejected" ? (valueArea.reason instanceof Error ? valueArea.reason.message : "Value area unavailable") : "",
    });
    setLevelLoading(false);
  }, [root, selectedDefinition.symbol, settings, snapshotDate]);

  const loadReplayCandles = useCallback(async (requestedTimeframe: ReplayTimeframe, startAt: number) => {
    const start = new Date(startAt - 9 * 24 * 60 * 60_000).toISOString();
    const end = new Date(Math.min(Date.now(), startAt + 30 * 60 * 60_000)).toISOString();
    const payload = await requestJson<SessionPayload>(
      `/api/backtesting/session?symbol=${encodeURIComponent(selectedDefinition.symbol)}&timeframe=${requestedTimeframe}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
    const ordered = payload.candles
      .filter((candle) => Number.isFinite(candle.timestamp) && candle.timestamp <= Date.parse(end))
      .sort((left, right) => left.timestamp - right.timestamp);
    return { ordered, end };
  }, [selectedDefinition.symbol]);

  const candleIndexAt = useCallback((ordered: Candle[], clock: number) => {
    if (!ordered.length) return 0;
    const firstFuture = ordered.findIndex((candle) => candle.timestamp > clock);
    if (firstFuture < 0) return ordered.length - 1;
    return Math.max(0, firstFuture - 1);
  }, []);

  const startReplay = useCallback(async () => {
    const startAt = newYorkLocalToUtc(date, time);
    if (!Number.isFinite(startAt) || startAt >= Date.now()) {
      setError("Choose a historical New York date and time before now.");
      return;
    }
    setLoading(true);
    setError("");
    setPlaying(false);
    setLevelState({ gamma: false, quant: false, valueArea: false });
    setGammaLevels([]);
    setQuantLevels([]);
    setQuantZones([]);
    setValueAreaLevels([]);
    setSnapshotDate("");
    try {
      const { ordered } = await loadReplayCandles(timeframe, startAt);
      const index = candleIndexAt(ordered, startAt);
      setCandles(ordered);
      setSessionStartAt(startAt);
      setReplayStartIndex(index);
      setVisibleIndex(index);
      setStarted(true);
      setShowSetup(false);
      // Paint the replay as soon as CME candles arrive. Historical options
      // reconstruction can be materially slower and hydrates independently.
      void loadLevels(startAt, true);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The replay could not be started.");
    } finally {
      setLoading(false);
    }
  }, [candleIndexAt, date, loadLevels, loadReplayCandles, time, timeframe]);

  const changeReplayTimeframe = useCallback(async (nextTimeframe: ReplayTimeframe) => {
    if (!started || !sessionStartAt || nextTimeframe === timeframe || timeframeLoading) return;
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
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That historical timeframe could not be loaded.");
    } finally {
      setTimeframeLoading(false);
    }
  }, [candleIndexAt, loadReplayCandles, replayClock, sessionStartAt, started, timeframe, timeframeLoading]);

  useEffect(() => {
    if (!playing || !candles.length) return;
    const timer = window.setInterval(() => {
      accumulatorRef.current += speed / 10;
      const advance = Math.floor(accumulatorRef.current);
      if (advance < 1) return;
      accumulatorRef.current -= advance;
      setVisibleIndex((current) => {
        const next = Math.min(candles.length - 1, current + advance);
        if (next >= candles.length - 1) setPlaying(false);
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [candles, playing, speed]);

  useEffect(() => {
    if (!replayClock || !started) return;
    const eligible = latestCompletedOptionsSession(replayClock);
    if (eligible !== snapshotDate) void loadLevels(replayClock);
  }, [loadLevels, replayClock, snapshotDate, started]);

  const resetReplay = () => {
    setPlaying(false);
    setVisibleIndex(replayStartIndex);
    accumulatorRef.current = 0;
  };

  const toggleLevel = (family: LevelFamily) => {
    setLevelState((current) => ({ ...current, [family]: !current[family] }));
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
          <div className="mt-0.5 text-[9px] text-muted">Choose the market state to reconstruct · times use America/New_York</div>
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
          <KwantSelect value={instrument} onChange={(event) => setInstrument(event.target.value as ReplayInstrument)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary/40">
            {INSTRUMENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </KwantSelect>
        </label>
        <label className="space-y-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Replay date</span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input type="date" min="2010-06-06" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(event) => setDate(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[12px] text-foreground outline-none focus:border-primary/40" />
          </div>
        </label>
        <label className="space-y-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Start time · NY</span>
          <div className="relative">
            <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 font-mono text-[12px] text-foreground outline-none focus:border-primary/40" />
          </div>
        </label>
        <div className="sm:col-span-2 rounded-2xl border border-border bg-background/45 p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-foreground"><Layers3 className="h-3.5 w-3.5 text-primary" /> Historical coverage</div>
          <div className="mt-3 grid gap-2 text-[9px] leading-4 text-muted sm:grid-cols-2">
            <div><span className="block font-semibold text-foreground">CME candles + value area</span>Documented from June 2010; actual access depends on Databento entitlement.</div>
            <div><span className="block font-semibold text-foreground">Gamma + Quant levels</span>KwantData documents 365+ days. Older dates remain unavailable unless a validated native options reconstruction exists.</div>
          </div>
        </div>
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-panel px-4 py-2">
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
              <span className="rounded-lg border border-border bg-background/45 px-2.5 py-1.5 font-mono text-[9px] text-muted">
                {selectedDefinition.id}
              </span>
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background/45 p-0.5">
                {TIMEFRAMES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => void changeReplayTimeframe(option)}
                    disabled={timeframeLoading}
                    className={`h-7 min-w-8 rounded-md px-2 font-mono text-[9px] transition-colors disabled:cursor-wait ${timeframe === option ? "bg-primary text-background" : "text-muted hover:bg-surface hover:text-foreground"}`}
                  >
                    {option}
                  </button>
                ))}
                {timeframeLoading ? <Loader2 className="mx-1 h-3 w-3 animate-spin text-primary" /> : null}
              </div>
              <button
                type="button"
                onClick={() => toggleLevel("gamma")}
                className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold ${levelState.gamma ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
              >
                Gamma levels
              </button>
              <button
                type="button"
                onClick={() => toggleLevel("quant")}
                className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold ${levelState.quant ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
              >
                Quant levels
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
                onClick={() => replayClock && void loadLevels(replayClock, true)}
                disabled={levelLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-primary disabled:opacity-40"
                title="Rebuild levels from the latest eligible snapshot"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${levelLoading ? "animate-spin" : ""}`} />
              </button>
            </>
          ) : null}
          {started ? (
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              className="flex h-9 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <Play className="h-3.5 w-3.5" />
              Backtest
            </button>
          ) : null}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {started ? (
          <Chart
            candles={visibleCandles}
            levels={activeLevels}
            zones={activeZones}
            instrument={selectedDefinition.id}
            timeframe={timeframe}
            marketIsActive={false}
            settings={settings}
            toolbarEnabled
            gammaLevelsEnabled={levelState.gamma}
            gammaLevelsAvailable
            gammaLevelsLoading={levelLoading}
            gammaLevelsError={levelError.gamma || null}
            onToggleGammaLevels={() => toggleLevel("gamma")}
            valueAreaLevelsEnabled={levelState.valueArea}
            valueAreaLevelsAvailable
            valueAreaLevelsLoading={levelLoading}
            valueAreaLevelsError={levelError.valueArea || null}
            valueAreaLevelsDescription="Historical prior-session and prior-week VAH, VAL, POC and VWAP"
            onToggleValueAreaLevels={() => toggleLevel("valueArea")}
          />
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
            <KwantLoader className="h-full" title="Building replay" detail="Loading CME candles and reconstructing eligible historical levels." />
          </div>
        ) : null}

        {started ? (
          <div className="absolute bottom-8 left-1/2 z-30 w-[min(920px,calc(100%-32px))] -translate-x-1/2 rounded-2xl border border-border bg-panel/95 px-3 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPlaying((current) => !current)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-background hover:brightness-110">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
                    setVisibleIndex(Number(event.target.value));
                  }}
                  className="h-1.5 w-full cursor-pointer accent-[var(--primary)]"
                  aria-label="Replay position"
                />
                <div className="mt-1 flex items-center justify-between font-mono text-[8px] text-muted">
                  <span>{formatReplayClock(candles[replayStartIndex]?.timestamp ?? 0)} NY</span>
                  <span className="text-foreground">{replayClock ? formatReplayClock(replayClock) : "--"} NY</span>
                  <span>{formatReplayClock(candles.at(-1)?.timestamp ?? 0)} NY</span>
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
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-primary" /> Snapshot cut-off: {snapshotDate || "preparing"} New York EOD</span>
              <span>{levelLoading ? "Refreshing eligible levels…" : "Future candles remain hidden"}</span>
              {Object.entries(levelError).filter(([, message]) => message).map(([family, message]) => (
                <span key={family} className="text-danger">{family}: {message}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {showSetup && started ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) setShowSetup(false); }}>
          <div className="w-[min(620px,100%)] overflow-hidden rounded-[24px] border border-border bg-panel shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <button type="button" onClick={() => setShowSetup(false)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
              <div>
                <div className="text-[14px] font-semibold text-foreground">Start historical replay</div>
                <div className="mt-0.5 text-[9px] text-muted">Times are interpreted in America/New_York</div>
              </div>
              <button type="button" onClick={() => setShowSetup(false)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Instrument</span>
                <KwantSelect value={instrument} onChange={(event) => setInstrument(event.target.value as ReplayInstrument)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary/40">
                  {INSTRUMENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </KwantSelect>
              </label>
              <label className="space-y-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Replay date</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <input type="date" min="2010-06-06" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(event) => setDate(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[12px] text-foreground outline-none focus:border-primary/40" />
                </div>
              </label>
              <label className="space-y-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Start time · NY</span>
                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 font-mono text-[12px] text-foreground outline-none focus:border-primary/40" />
                </div>
              </label>
              <div className="sm:col-span-2 rounded-2xl border border-border bg-background/45 p-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-foreground"><Layers3 className="h-3.5 w-3.5 text-primary" /> Historical coverage</div>
                <div className="mt-3 grid gap-2 text-[9px] leading-4 text-muted sm:grid-cols-2">
                  <div><span className="block font-semibold text-foreground">CME candles + value area</span>Documented from June 2010; actual access depends on Databento entitlement.</div>
                  <div><span className="block font-semibold text-foreground">Gamma + Quant levels</span>KwantData documents 365+ days. Older dates remain unavailable unless a validated native options reconstruction exists.</div>
                </div>
              </div>
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
