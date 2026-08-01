"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  BookOpenCheck,
  CircleDot,
  Crosshair,
  Database,
  Layers3,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChartLevel, ChartZone } from "@/components/Chart";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import type { Candle } from "@/lib/backtester";
import type { ChartGammaLevelsPayload, ChartGammaSourceLevelKind } from "@/lib/chartGammaLevels";
import {
  DATABENTO_LIVE_STATUS_EVENT,
  DATABENTO_LIVE_TICK_EVENT,
  readDatabentoLiveStatus,
  type DatabentoLiveStatus,
} from "@/lib/chartLiveEvents";
import { defaultChartSettings, loadStoredChartSettings, type ChartSettings } from "@/lib/chartSettings";
import type { GameplanPayload } from "@/lib/gameplan";

const Chart = dynamic(() => import("@/components/Chart"), {
  ssr: false,
  loading: () => (
    <KwantLoader
      className="h-full"
      compact
      title="Loading level chart"
      detail="Restoring CME candles and the selected level family."
    />
  ),
});

type LevelFamily = "gamma" | "gameplan" | "structure" | "value-area";
type LevelInstrument = "NQ" | "MNQ" | "ES" | "MES";
type LevelTimeframe = "1m" | "5m" | "15m";

type PanelConfig = {
  id: string;
  instrument: LevelInstrument;
  family: LevelFamily;
  timeframe: LevelTimeframe;
};

type LevelEvidence = "OBSERVED" | "CALCULATED" | "DERIVED" | "UNAVAILABLE";

type IntelligentLevel = ChartLevel & {
  family: LevelFamily;
  kind: string;
  evidence: LevelEvidence;
  value: number | null;
  explanation: string;
  firstTouch: string;
  hold: string;
  break: string;
};

type LevelSnapshot = {
  levels: IntelligentLevel[];
  zones: ChartZone[];
  asOf: string | null;
  source: string;
  status: "LIVE" | "EOD" | "READY" | "UNAVAILABLE";
  regime: string;
  tape: string;
  flowLean: number | null;
  note: string;
};

type PanelRuntime = {
  candles: Candle[];
  price: number | null;
  loading: boolean;
  error: string;
  liveStatus: DatabentoLiveStatus | null;
  snapshot: LevelSnapshot;
};

type MarketPayload = {
  candles?: Candle[];
  error?: string;
};

type LiveTick = {
  instrument?: string;
  mid?: number;
  timestamp?: string | number;
  cached?: boolean;
};

type CompletedProfile = {
  vah: number;
  val: number;
  poc: number;
  vwap: number;
  start: string;
  end: string;
  label: string;
  totalVolume: number;
  tradeRecords: number;
};

type ValueAreaPayload = {
  symbol: string;
  generatedAt: string;
  nextRefreshAt: string;
  method: "TRADE_BY_TRADE";
  daily: CompletedProfile;
  weekly: CompletedProfile;
  error?: string;
};

const LEVELZ_LAYOUT_STORAGE_KEY = "kwantdesk:levelz-layout:v1";
const LEVELZ_SNAPSHOT_STORAGE_KEY = "kwantdesk:levelz-snapshots:v1";
const FIVE_DAY_HISTORY_DAYS = 8;
const MARKET_CACHE_MS = 15_000;

const DEFAULT_PANELS: PanelConfig[] = [
  { id: "levelz-1", instrument: "NQ", family: "gamma", timeframe: "5m" },
  { id: "levelz-2", instrument: "NQ", family: "gameplan", timeframe: "5m" },
  { id: "levelz-3", instrument: "NQ", family: "value-area", timeframe: "5m" },
  { id: "levelz-4", instrument: "NQ", family: "structure", timeframe: "5m" },
];

const FAMILY_LABELS: Record<LevelFamily, string> = {
  gamma: "Gamma levels",
  gameplan: "Gameplan levels",
  structure: "Supply / demand + S/R",
  "value-area": "Value area + prior periods",
};

const marketCache = new Map<string, { candles: Candle[]; updatedAt: number }>();
const marketRequests = new Map<string, Promise<Candle[]>>();
const levelCache = new Map<string, { snapshot: LevelSnapshot; updatedAt: number }>();
const levelRequests = new Map<string, Promise<LevelSnapshot>>();

function isNewYorkOptionsOpen(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = read("weekday");
  const minutes = Number(read("hour")) * 60 + Number(read("minute"));
  return weekday !== "Sat" && weekday !== "Sun" && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

function storedSnapshotKey(config: PanelConfig) {
  return `${levelRoot(config.instrument)}:${config.family}`;
}

function isStoredLevelSnapshot(value: unknown): value is LevelSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LevelSnapshot>;
  return Array.isArray(candidate.levels)
    && candidate.levels.length > 0
    && Array.isArray(candidate.zones)
    && typeof candidate.source === "string"
    && typeof candidate.status === "string";
}

function rethemeSnapshot(snapshot: LevelSnapshot, family: LevelFamily, settings: ChartSettings): LevelSnapshot {
  if (family === "gamma") {
    return {
      ...snapshot,
      levels: snapshot.levels.map((level) => ({
        ...level,
        color: gammaColor(level.kind as ChartGammaSourceLevelKind, settings),
      })),
    };
  }
  if (family !== "gameplan") return snapshot;
  const roleColors: Record<string, string> = {
    MAGNET: settings.upColor,
    WALL: settings.downColor,
    ACCELERANT: "#F59E0B",
    DECISION: "#22D3EE",
  };
  const levels = snapshot.levels.map((level) => ({ ...level, color: roleColors[level.kind] ?? level.color }));
  return {
    ...snapshot,
    levels,
    zones: snapshot.zones.map((zone, index) => {
      const color = levels[index]?.color ?? zone.color;
      return { ...zone, color, fillColor: `${color}18` };
    }),
  };
}

function readStoredLevelSnapshot(config: PanelConfig, settings: ChartSettings) {
  if (typeof window === "undefined" || (config.family !== "gamma" && config.family !== "gameplan")) return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(LEVELZ_SNAPSHOT_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    const snapshot = stored[storedSnapshotKey(config)];
    return isStoredLevelSnapshot(snapshot) ? rethemeSnapshot(snapshot, config.family, settings) : null;
  } catch {
    return null;
  }
}

function storeLevelSnapshot(config: PanelConfig, snapshot: LevelSnapshot) {
  if (typeof window === "undefined" || !snapshot.levels.length || (config.family !== "gamma" && config.family !== "gameplan")) return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(LEVELZ_SNAPSHOT_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    stored[storedSnapshotKey(config)] = snapshot;
    window.localStorage.setItem(LEVELZ_SNAPSHOT_STORAGE_KEY, JSON.stringify(stored));
  } catch {}
}

function retainedNewYorkSnapshot(snapshot: LevelSnapshot, family: LevelFamily, marketOpen: boolean) {
  if (family !== "gamma" && family !== "gameplan") return snapshot;
  return {
    ...snapshot,
    status: "EOD" as const,
    note: marketOpen
      ? `The live New York refresh is reconnecting. The last confirmed snapshot remains on screen instead of disappearing. ${snapshot.note}`
      : `New York is closed. These levels are frozen from the latest completed New York session and remain active through Asia, Tokyo, Frankfurt, London and pre-market. ${snapshot.note}`,
  };
}

function marketSymbol(instrument: LevelInstrument) {
  return `${instrument}.v.0`;
}

function levelRoot(instrument: LevelInstrument): "NQ" | "ES" {
  return instrument === "NQ" || instrument === "MNQ" ? "NQ" : "ES";
}

function timestampMs(value: string | number | undefined) {
  if (typeof value === "string") return Date.parse(value);
  if (typeof value !== "number" || !Number.isFinite(value)) return Date.now();
  if (value > 10_000_000_000_000_000) return Math.floor(value / 1_000_000);
  if (value > 10_000_000_000_000) return Math.floor(value / 1_000);
  if (value < 10_000_000_000) return value * 1_000;
  return value;
}

function timeframeMs(timeframe: LevelTimeframe) {
  if (timeframe === "1m") return 60_000;
  if (timeframe === "15m") return 15 * 60_000;
  return 5 * 60_000;
}

function sanitizeCandles(value: unknown): Candle[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Candle[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<Candle>;
    const timestamp = Number(row.timestamp);
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    if (![timestamp, open, high, low, close].every(Number.isFinite) || close <= 0) return [];
    return [{
      timestamp,
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      volume: Number(row.volume ?? 0),
    }];
  }).sort((left, right) => left.timestamp - right.timestamp);
}

function mergeLiveTick(candles: Candle[], price: number, timestamp: number, timeframe: LevelTimeframe) {
  if (!candles.length || !Number.isFinite(price) || price <= 0) return candles;
  const duration = timeframeMs(timeframe);
  const bucket = Math.floor(timestamp / duration) * duration;
  const latest = candles.at(-1)!;
  if (bucket < latest.timestamp) return candles;
  if (bucket === latest.timestamp) {
    const next = [...candles];
    next[next.length - 1] = {
      ...latest,
      high: Math.max(latest.high, price),
      low: Math.min(latest.low, price),
      close: price,
    };
    return next;
  }
  return [...candles, {
    timestamp: bucket,
    open: latest.close,
    high: Math.max(latest.close, price),
    low: Math.min(latest.close, price),
    close: price,
    volume: 0,
  }].slice(-4_000);
}

async function fetchMarketCandles(instrument: LevelInstrument, timeframe: LevelTimeframe) {
  const symbol = marketSymbol(instrument);
  const key = `${symbol}:${timeframe}`;
  const cached = marketCache.get(key);
  if (cached && Date.now() - cached.updatedAt <= MARKET_CACHE_MS) return cached.candles;
  const existing = marketRequests.get(key);
  if (existing) return existing;
  const request = fetch(
    `/api/databento/market?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&days=${FIVE_DAY_HISTORY_DAYS}`,
    { cache: "no-store" },
  ).then(async (response) => {
    const payload = await response.json() as MarketPayload;
    if (!response.ok) throw new Error(payload.error || "CME chart history is unavailable.");
    const candles = sanitizeCandles(payload.candles);
    if (!candles.length) throw new Error("CME returned no chart history.");
    marketCache.set(key, { candles, updatedAt: Date.now() });
    return candles;
  }).finally(() => marketRequests.delete(key));
  marketRequests.set(key, request);
  return request;
}

function gammaColor(kind: ChartGammaSourceLevelKind, settings: ChartSettings) {
  if (kind === "CALL_WALL" || kind === "POSITIVE_GEX") return settings.upColor;
  if (kind === "PUT_WALL" || kind === "NEGATIVE_GEX") return settings.downColor;
  if (kind === "GAMMA_CENTRE") return "#22D3EE";
  if (kind === "ZERO_GAMMA") return "#F8FAFC";
  if (kind === "HIGH_VOL_LEVEL") return "#F59E0B";
  if (kind === "EXPECTED_MOVE_MAX" || kind === "EXPECTED_MOVE_MIN") return "#F59E0B";
  return "#A78BFA";
}

const GAMMA_EDUCATION: Record<ChartGammaSourceLevelKind, Pick<IntelligentLevel, "explanation" | "firstTouch" | "hold" | "break">> = {
  CALL_WALL: {
    explanation: "The strike with the strongest call-side gamma concentration in this snapshot. It can attract hedging activity and often acts as an upper decision area, but it is not guaranteed resistance.",
    firstTouch: "Watch whether price rejects promptly or begins accepting above the strike. A slow stall is different from a clean rejection.",
    hold: "Repeated failure below the wall supports a capped or pinning interpretation, especially in positive gamma.",
    break: "Sustained acceptance above weakens the cap. In negative gamma, hedge adjustment can amplify continuation instead of fading it.",
  },
  PUT_WALL: {
    explanation: "The strike with the strongest put-side gamma concentration in this snapshot. It is commonly monitored as a lower decision area where hedging flow may become meaningful.",
    firstTouch: "Look for immediate defence and the quality of the bounce. Repeated shallow responses can mean the available defence is being consumed.",
    hold: "Holding above keeps the strike support-like and favours rotation back into the active range.",
    break: "Acceptance below changes the role to resistance candidate and can increase downside hedge pressure in negative gamma.",
  },
  GAMMA_MAGNET: {
    explanation: "A concentrated gamma strike near price where hedging can repeatedly pull the market back toward balance. It is best treated as a pin or rotation candidate, not a directional target by itself.",
    firstTouch: "Expect two-way trade and test whether price can leave the level with expanding range and confirming flow.",
    hold: "Continued rotation around the strike confirms magnet behaviour and reduces the quality of breakout entries inside the area.",
    break: "A decisive departure with sustained tape imbalance suggests the pin has weakened and the next concentration matters more.",
  },
  GAMMA_CENTRE: {
    explanation: "The centre of the active gamma complex. It separates the nearest concentrations and is a decision reference for whether price is trading in the upper or lower half of positioning.",
    firstTouch: "Treat the first visit as a balance test. Direction is confirmed by acceptance on one side, not by a single wick.",
    hold: "Acceptance above makes the centre support-like; acceptance below makes it resistance-like.",
    break: "A clean cross can rotate price toward the next major call- or put-side concentration.",
  },
  HIGH_VOL_LEVEL: {
    explanation: "The High Volatility Level is the strongest nearby transition in the scenario gamma curve. It marks where the curve changes most aggressively, not where aggregate gamma is exactly zero.",
    firstTouch: "Watch whether realised range expands as price enters the transition. The reaction matters more than a single print through the line.",
    hold: "Holding on the positive-gamma side supports greater stability and mean reversion when the wider options tape agrees.",
    break: "Acceptance onto the negative-gamma side raises acceleration risk, particularly when 0DTE positioning and directional flow confirm.",
  },
  ZERO_GAMMA: {
    explanation: "Zero Gamma is the scenario price where repriced signed aggregate GEX crosses zero. It is the calculated boundary between positive- and negative-gamma positioning under the current chain assumptions.",
    firstTouch: "Treat the first test as a regime decision, not automatic support or resistance. Confirm which side gains acceptance.",
    hold: "Sustained trade on the positive-gamma side favours more counter-move hedging and local compression.",
    break: "Sustained trade on the negative-gamma side can make hedging more pro-cyclical and increase continuation risk.",
  },
  POSITIVE_GEX: {
    explanation: "A ranked strike carrying positive gamma exposure. Positive-gamma concentrations can encourage counter-move hedging and local mean reversion when the broader regime agrees.",
    firstTouch: "Watch for range compression and reduced follow-through as price reaches the strike.",
    hold: "Stable exposure and repeated rotation strengthen its pinning significance.",
    break: "If the exposure is unwinding or tape expands through it, the historical concentration may no longer control price.",
  },
  NEGATIVE_GEX: {
    explanation: "A ranked strike carrying negative gamma exposure. Negative-gamma concentrations can make hedge adjustments move with price, increasing acceleration risk after acceptance.",
    firstTouch: "Do not assume a reversal. Measure whether range and directional tape expand through the strike.",
    hold: "Failure to accept can still produce a reaction, but the level is structurally more sensitive to momentum.",
    break: "Acceptance with aligned flow raises the probability of continuation toward the next positioning level.",
  },
  EXPECTED_MOVE_MAX: {
    explanation: "The upper one-day expected-move boundary derived from the options distribution. It describes a statistical range edge, not a hard ceiling.",
    firstTouch: "Compare realised volatility and flow. A quiet first test can rotate; an expanding tape can reprice the distribution.",
    hold: "Trading back below preserves the boundary as an upper range reference.",
    break: "Acceptance above signals realised movement is outrunning the earlier implied range and invalidates a blind fade.",
  },
  EXPECTED_MOVE_MIN: {
    explanation: "The lower one-day expected-move boundary derived from the options distribution. It is a probability reference rather than guaranteed support.",
    firstTouch: "Check whether selling pressure contracts at the boundary or continues to expand.",
    hold: "Recovery above keeps the lower range edge intact and supports rotation back inward.",
    break: "Acceptance below means realised movement has exceeded the earlier implied range and downside continuation must be respected.",
  },
};

function gammaEducationForLevel(kind: ChartGammaSourceLevelKind, label: string) {
  const base = GAMMA_EDUCATION[kind];
  const details: string[] = [];
  if (/0\s*DTE/i.test(label)) {
    details.push("This is a same-day-expiry reference: its gamma can change rapidly near the money and it should be refreshed throughout New York trading rather than carried forward as a static level.");
  }
  if (/\bHVL\b/i.test(label)) {
    details.push("The HVL is a calculated high-volatility transition reference from the active gamma distribution. Its side of price and the current gamma regime determine whether it is functioning as a boundary, pivot, or acceleration reference.");
  }
  if (/\bGEX\s*\d+\b/i.test(label)) {
    details.push("The number is its concentration rank in the current exposure snapshot, not a promise of reaction strength. Stability, change through time, and tape confirmation decide whether the level remains relevant.");
  }
  return details.length ? { ...base, explanation: `${base.explanation} ${details.join(" ")}` } : base;
}

function makeGammaSnapshot(payload: ChartGammaLevelsPayload, settings: ChartSettings): LevelSnapshot {
  const source = payload.sources.find((item) => item.symbol === payload.requestedSource && item.levels.length)
    ?? payload.sources.find((item) => item.levels.length);
  const validLevels = (source?.levels ?? []).filter((level) =>
    Number.isFinite(level.price) && level.price > 0 && typeof level.label === "string" && level.label.length > 0,
  );
  if (!source || !validLevels.length) {
    throw new Error(`No usable ${payload.root} gamma levels were returned.`);
  }
  const levels = validLevels.slice(0, 24).map((level): IntelligentLevel => ({
    id: `levelz-gamma-${payload.root}-${level.id}`,
    price: level.price,
    color: gammaColor(level.kind, settings),
    label: level.label,
    lineStyle: level.kind === "CALL_WALL" || level.kind === "PUT_WALL" ? "solid" : "dashed",
    lineWidth: level.kind === "CALL_WALL" || level.kind === "PUT_WALL" ? 2 : 1,
    axisLabelVisible: true,
    family: "gamma",
    kind: level.kind,
    evidence: "CALCULATED",
    value: level.value,
    ...gammaEducationForLevel(level.kind, level.label),
  }));
  return {
    levels,
    zones: [],
    asOf: payload.checkedAt,
    source: payload.dataOrigin === "CASH_CALIBRATED_FALLBACK"
      ? `KwantData ${payload.calibrationSource ?? "cash-index"} gamma · CME calibrated`
      : `${payload.root} CME options gamma`,
    status: payload.marketOpen ? "LIVE" : "EOD",
    regime: payload.environment.gammaStateLabel,
    tape: "Loading session tape context",
    flowLean: null,
    note: payload.marketOpen
      ? "Gamma levels refresh from the active options snapshot."
      : "New York is closed; the completed New York snapshot remains the structural reference.",
  };
}

function mergeNativeGammaTransitions(base: LevelSnapshot, native: LevelSnapshot): LevelSnapshot {
  const isTransition = (level: IntelligentLevel) => level.kind === "ZERO_GAMMA" || level.kind === "HIGH_VOL_LEVEL";
  const transitions = native.levels.filter(isTransition);
  if (!transitions.length) return base;
  return {
    ...base,
    levels: [...base.levels.filter((level) => !isTransition(level)), ...transitions],
    asOf: base.asOf && native.asOf && Date.parse(base.asOf) > Date.parse(native.asOf) ? base.asOf : native.asOf,
    source: `${base.source} · native Zero Gamma/HVL`,
  };
}

function makeGameplanSnapshot(payload: GameplanPayload, settings: ChartSettings, marketOpen: boolean): LevelSnapshot {
  const roleColors = {
    magnet: settings.upColor,
    wall: settings.downColor,
    accelerant: "#F59E0B",
    decision: "#22D3EE",
  } as const;
  const levels = payload.plan.ladder.map((row, index): IntelligentLevel => {
    const price = (row.zone[0] + row.zone[1]) / 2;
    const color = roleColors[row.role];
    return {
      id: `levelz-gameplan-${payload.instrument}-${index}-${row.name}`,
      price,
      color,
      label: `${row.name} · ${row.role.toUpperCase()}`,
      lineStyle: row.role === "decision" ? "solid" : row.role === "accelerant" ? "dotted" : "dashed",
      lineWidth: row.strength >= 4 ? 2 : 1,
      axisLabelVisible: true,
      family: "gameplan",
      kind: row.role.toUpperCase(),
      evidence: "DERIVED",
      value: row.strength,
      explanation: row.why,
      firstTouch: row.if_visit,
      hold: row.if_hold,
      break: row.if_break,
    };
  });
  const zones = payload.plan.ladder.map((row, index): ChartZone => {
    const color = roleColors[row.role];
    return {
      id: `levelz-gameplan-zone-${payload.instrument}-${index}`,
      low: row.zone[0],
      high: row.zone[1],
      color,
      fillColor: `${color}18`,
      label: row.name,
    };
  });
  return {
    levels,
    zones,
    asOf: payload.generated_at,
    source: `${payload.source_symbol} positioning · ${payload.plan.edition.session}`,
    status: marketOpen && payload.status === "LIVE" ? "LIVE" : "EOD",
    regime: payload.plan.environment.tape.plain,
    tape: payload.plan.environment.tape.state.toUpperCase(),
    flowLean: payload.plan.environment.flow.lean,
    note: marketOpen
      ? payload.plan.one_liner
      : `New York is closed. This Gameplan is frozen from the latest completed New York edition. ${payload.plan.one_liner}`,
  };
}

function valueAreaEducation(prefix: "PD" | "PW", kind: "VAH" | "VAL" | "POC" | "VWAP") {
  const horizon = prefix === "PD" ? "previous completed session" : "previous completed week";
  if (kind === "VAH") return {
    explanation: `The value-area high is the upper boundary containing the central 70% of traded volume during the ${horizon}. It marks where auction acceptance previously began to thin.`,
    firstTouch: "Approach from below: test for responsive selling. Approach from above: test whether buyers defend it as reclaimed value.",
    hold: "Holding above supports acceptance above prior value and changes the boundary into a support candidate.",
    break: "Rejection back below returns price to prior value and makes the POC the next balance reference.",
  };
  if (kind === "VAL") return {
    explanation: `The value-area low is the lower boundary containing the central 70% of traded volume during the ${horizon}. It marks where lower-price acceptance previously thinned.`,
    firstTouch: "Approach from above: test for responsive buying. Approach from below: test whether sellers defend it as resistance.",
    hold: "Holding above preserves the lower edge as a support candidate and favours rotation through prior value.",
    break: "Acceptance below signals value migration lower; a retest can convert the boundary into resistance.",
  };
  if (kind === "POC") return {
    explanation: `The point of control is the price with the greatest traded volume in the ${horizon}. It is observed auction memory and often behaves as a fair-value magnet.`,
    firstTouch: "Expect two-way trade. Look for acceptance around the level rather than treating it as automatic support or resistance.",
    hold: "Repeated rotation confirms the market still recognises this historical fair-value area.",
    break: "A strong departure indicates value is migrating and shifts focus to the next value boundary.",
  };
  return {
    explanation: `This is the volume-weighted average transaction price from the ${horizon}. It is an observed cost-basis reference, not a forecast.`,
    firstTouch: "Watch whether price crosses freely or responds with initiative flow; the reaction reveals whether the old cost basis still matters.",
    hold: "Acceptance above makes the benchmark support-like; acceptance below makes it resistance-like.",
    break: "A clean cross without response reduces its immediate relevance until price revisits with stronger participation.",
  };
}

function makeValueAreaSnapshot(payload: ValueAreaPayload, settings: ChartSettings): LevelSnapshot {
  const build = (prefix: "PD" | "PW", profile: CompletedProfile, color: string) =>
    (["VAH", "VAL", "POC", "VWAP"] as const).map((kind): IntelligentLevel => {
      const price = kind === "VAH" ? profile.vah : kind === "VAL" ? profile.val : kind === "POC" ? profile.poc : profile.vwap;
      return {
        id: `levelz-${prefix.toLowerCase()}-${kind.toLowerCase()}-${profile.end}`,
        price,
        color,
        label: `${prefix} ${kind}`,
        lineStyle: kind === "POC" ? "solid" : kind === "VWAP" ? "dotted" : "dashed",
        lineWidth: kind === "POC" || kind === "VWAP" ? 2 : 1,
        axisLabelVisible: true,
        family: "value-area",
        kind: `${prefix}_${kind}`,
        evidence: "OBSERVED",
        value: profile.totalVolume,
        ...valueAreaEducation(prefix, kind),
      };
    });
  return {
    levels: [
      ...build("PD", payload.daily, "#38BDF8"),
      ...build("PW", payload.weekly, "#F59E0B"),
    ],
    zones: [],
    asOf: payload.generatedAt,
    source: "CME trade-by-trade volume profile",
    status: "READY",
    regime: "Prior accepted value",
    tape: "Observed completed periods",
    flowLean: null,
    note: `${payload.daily.label} and ${payload.weekly.label}. These profiles update only after their source period is complete.`,
  };
}

function emptyStructureSnapshot(): LevelSnapshot {
  return {
    levels: [],
    zones: [],
    asOf: null,
    source: "Historical structure engine",
    status: "UNAVAILABLE",
    regime: "Not connected",
    tape: "No structure data",
    flowLean: null,
    note: "Supply, demand, support and resistance are intentionally blank until the historical structure backend is validated. No placeholder levels are drawn.",
  };
}

async function requestJson<T extends { error?: string }>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json() as T;
  if (!response.ok) throw new Error(payload.error || "Level data is unavailable.");
  return payload;
}

async function buildLevelSnapshot(config: PanelConfig, settings: ChartSettings) {
  if (config.family === "structure") return emptyStructureSnapshot();
  const root = levelRoot(config.instrument);
  if (config.family === "gamma") {
    const gammaSource = root === "NQ" ? "QQQ" : "SPY";
    const [gamma, gameplan] = await Promise.all([
      requestJson<ChartGammaLevelsPayload & { error?: string }>(
        `/api/chart-gamma-levels?root=${root}&source=${gammaSource}&calibrated=1`,
      ),
      requestJson<GameplanPayload & { error?: string }>(`/api/gameplan?root=${root}&session=newyork`).catch(() => null),
    ]);
    const snapshot = makeGammaSnapshot(gamma, settings);
    if (gameplan) {
      snapshot.tape = gameplan.plan.environment.tape.plain;
      snapshot.flowLean = gameplan.plan.environment.flow.lean;
    }
    return snapshot;
  }
  if (config.family === "gameplan") {
    const payload = await requestJson<GameplanPayload & { error?: string }>(`/api/gameplan?root=${root}&session=newyork`);
    return makeGameplanSnapshot(payload, settings, isNewYorkOptionsOpen());
  }
  const payload = await requestJson<ValueAreaPayload>(`/api/databento/value-area?symbol=${encodeURIComponent(marketSymbol(config.instrument))}`);
  return makeValueAreaSnapshot(payload, settings);
}

function levelCacheMs(family: LevelFamily) {
  if (family === "gamma") return 5_000;
  if (family === "gameplan") return 60_000;
  if (family === "value-area") return 30 * 60_000;
  return 60_000;
}

async function fetchLevelSnapshot(config: PanelConfig, settings: ChartSettings, force = false) {
  const key = `${config.instrument}:${config.family}:${settings.upColor}:${settings.downColor}`;
  const cached = levelCache.get(key);
  if (!force && cached && Date.now() - cached.updatedAt <= levelCacheMs(config.family)) return cached.snapshot;
  const existing = levelRequests.get(key);
  if (existing) return existing;
  const request = buildLevelSnapshot(config, settings)
    .then((snapshot) => {
      levelCache.set(key, { snapshot, updatedAt: Date.now() });
      storeLevelSnapshot(config, snapshot);
      return snapshot;
    })
    .catch((error) => {
      const fallback = cached?.snapshot ?? readStoredLevelSnapshot(config, settings);
      if (!fallback?.levels.length) throw error;
      const retained = retainedNewYorkSnapshot(fallback, config.family, isNewYorkOptionsOpen());
      levelCache.set(key, { snapshot: retained, updatedAt: Date.now() });
      return retained;
    })
    .finally(() => levelRequests.delete(key));
  levelRequests.set(key, request);
  return request;
}

function useMarketSeries(config: PanelConfig) {
  const key = `${marketSymbol(config.instrument)}:${config.timeframe}`;
  const immediate = marketCache.get(key)?.candles ?? [];
  const [candles, setCandles] = useState<Candle[]>(immediate);
  const [loading, setLoading] = useState(immediate.length === 0);
  const [error, setError] = useState("");
  const [liveStatus, setLiveStatus] = useState<DatabentoLiveStatus | null>(() => readDatabentoLiveStatus());

  useEffect(() => {
    let cancelled = false;
    const cached = marketCache.get(key)?.candles ?? [];
    setCandles(cached);
    setLoading(cached.length === 0);
    setError("");
    void fetchMarketCandles(config.instrument, config.timeframe)
      .then((rows) => {
        if (cancelled) return;
        setCandles(rows);
        setLoading(false);
      })
      .catch((problem) => {
        if (cancelled) return;
        setLoading(false);
        setError(problem instanceof Error ? problem.message : "CME history is unavailable.");
      });
    return () => { cancelled = true; };
  }, [config.instrument, config.timeframe, key]);

  useEffect(() => {
    const receiveTick = (event: Event) => {
      const tick = (event as CustomEvent<LiveTick>).detail;
      if (tick?.instrument !== marketSymbol(config.instrument)) return;
      const price = Number(tick.mid);
      if (!Number.isFinite(price) || price <= 0) return;
      setCandles((current) => mergeLiveTick(current, price, timestampMs(tick.timestamp), config.timeframe));
      if (!tick.cached) setLiveStatus("live");
    };
    const receiveStatus = (event: Event) => setLiveStatus((event as CustomEvent<DatabentoLiveStatus>).detail);
    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
    window.addEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
    return () => {
      window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
      window.removeEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
    };
  }, [config.instrument, config.timeframe]);

  return { candles, loading, error, liveStatus };
}

function useLevelSnapshot(config: PanelConfig, settings: ChartSettings) {
  const [snapshot, setSnapshot] = useState<LevelSnapshot>(() => config.family === "structure" ? emptyStructureSnapshot() : {
    levels: [], zones: [], asOf: null, source: "Level engine", status: "UNAVAILABLE", regime: "Loading", tape: "Loading", flowLean: null, note: "",
  });
  const [loading, setLoading] = useState(config.family !== "structure");
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [newYorkOpen, setNewYorkOpen] = useState(() => isNewYorkOptionsOpen());

  useEffect(() => {
    let cancelled = false;
    const retained = readStoredLevelSnapshot(config, settings);
    if (retained) {
      setSnapshot(retainedNewYorkSnapshot(retained, config.family, isNewYorkOptionsOpen()));
      setLoading(false);
    } else {
      setLoading(config.family !== "structure");
    }
    setError("");
    void fetchLevelSnapshot(config, settings, refreshNonce > 0)
      .then((next) => {
        if (cancelled) return;
        setSnapshot(next);
        setLoading(false);
        if (config.family === "gamma") {
          const root = levelRoot(config.instrument);
          void requestJson<ChartGammaLevelsPayload & { error?: string }>(
            `/api/chart-gamma-levels?root=${root}&source=${root}`,
          ).then((nativePayload) => {
            if (cancelled) return;
            const merged = mergeNativeGammaTransitions(next, makeGammaSnapshot(nativePayload, settings));
            const key = `${config.instrument}:${config.family}:${settings.upColor}:${settings.downColor}`;
            levelCache.set(key, { snapshot: merged, updatedAt: Date.now() });
            storeLevelSnapshot(config, merged);
            setSnapshot(merged);
          }).catch(() => {
            // The calibrated cash map remains usable while native transition levels warm.
          });
        }
      })
      .catch((problem) => {
        if (cancelled) return;
        setLoading(false);
        setError(problem instanceof Error ? problem.message : "Level data is unavailable.");
      });
    return () => { cancelled = true; };
  }, [config, refreshNonce, settings]);

  useEffect(() => {
    const timer = window.setInterval(() => setNewYorkOpen(isNewYorkOptionsOpen()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const refreshMs = config.family === "gamma"
      ? newYorkOpen ? 15_000 : 5 * 60_000
      : config.family === "gameplan"
        ? newYorkOpen ? 15_000 : 5 * 60_000
        : config.family === "value-area"
          ? 5 * 60_000
          : null;
    if (refreshMs === null) return;
    const timer = window.setInterval(() => setRefreshNonce((value) => value + 1), refreshMs);
    return () => window.clearInterval(timer);
  }, [config.family, newYorkOpen]);

  return { snapshot, loading, error, refresh: () => setRefreshNonce((value) => value + 1) };
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAge(value: string | null) {
  if (!value) return "Waiting";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Waiting";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3_600)}h ago`;
}

function roleAtPrice(level: IntelligentLevel, currentPrice: number | null, candles: Candle[], instrument: LevelInstrument) {
  if (currentPrice === null) return { title: "Waiting for live price", detail: "Role cannot be classified without an observed futures price.", tone: "text-muted" };
  const nearDistance = levelRoot(instrument) === "NQ" ? 15 : 4;
  const distance = level.price - currentPrice;
  if (Math.abs(distance) <= nearDistance) {
    return {
      title: "IN PLAY · DECISION AREA",
      detail: `Price is ${Math.abs(distance).toFixed(2)} points from the level. Reaction quality and acceptance now matter more than the label.`,
      tone: "text-primary",
    };
  }
  const recent = candles.slice(-36, -1);
  const crossed = distance < 0
    ? recent.some((candle) => candle.close < level.price)
    : recent.some((candle) => candle.close > level.price);
  if (distance < 0) {
    return {
      title: crossed ? "RECLAIMED · SUPPORT CANDIDATE" : "BELOW PRICE · SUPPORT CANDIDATE",
      detail: `The level is ${Math.abs(distance).toFixed(2)} points below price. ${crossed ? "Recent closes traded below it, so this is a potential role flip rather than untouched support." : "It is the next lower reference if price rotates down."}`,
      tone: "text-accent",
    };
  }
  return {
    title: crossed ? "LOST · RESISTANCE CANDIDATE" : "ABOVE PRICE · RESISTANCE CANDIDATE",
    detail: `The level is ${Math.abs(distance).toFixed(2)} points above price. ${crossed ? "Recent closes traded above it, so this is a potential role flip after losing the level." : "It is the next upper reference if price continues higher."}`,
    tone: "text-danger",
  };
}

function LevelChartCard({
  config,
  index,
  settings,
  active,
  onActivate,
  onChange,
  onRuntime,
}: {
  config: PanelConfig;
  index: number;
  settings: ChartSettings;
  active: boolean;
  onActivate: () => void;
  onChange: (patch: Partial<PanelConfig>) => void;
  onRuntime: (panelId: string, runtime: PanelRuntime) => void;
}) {
  const market = useMarketSeries(config);
  const levels = useLevelSnapshot(config, settings);
  const price = market.candles.at(-1)?.close ?? null;

  useEffect(() => {
    onRuntime(config.id, {
      candles: market.candles,
      price,
      loading: market.loading || levels.loading,
      error: market.error || levels.error,
      liveStatus: market.liveStatus,
      snapshot: levels.snapshot,
    });
  }, [levels.error, levels.loading, levels.snapshot, market.candles, market.error, market.liveStatus, market.loading, onRuntime, price]);

  return (
    <section
      className={`group relative flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-panel transition-all ${active ? "border-primary/45 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_28%,transparent),0_0_24px_color-mix(in_srgb,var(--primary)_8%,transparent)]" : "border-border hover:border-primary/20"}`}
      onMouseDown={onActivate}
    >
      <div className="flex min-h-[68px] shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border bg-panel px-2.5 py-1.5">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg border text-[9px] font-semibold ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted"}`}>{index + 1}</span>
        <KwantSelect
          value={config.instrument}
          onChange={(event) => onChange({ instrument: event.target.value as LevelInstrument })}
          menuLabel="Instrument"
          className="h-7 min-w-[74px] rounded-lg border border-border bg-background px-2 text-[9px] font-semibold"
        >
          <option value="NQ">NQ</option><option value="MNQ">MNQ</option><option value="ES">ES</option><option value="MES">MES</option>
        </KwantSelect>
        <KwantSelect
          value={config.timeframe}
          onChange={(event) => onChange({ timeframe: event.target.value as LevelTimeframe })}
          menuLabel="Timeframe"
          className="h-7 min-w-[60px] rounded-lg border border-border bg-background px-2 text-[9px] font-semibold"
        >
          <option value="1m">1m</option><option value="5m">5m</option><option value="15m">15m</option>
        </KwantSelect>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); levels.refresh(); }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted hover:border-primary/30 hover:text-primary"
          title="Refresh selected levels"
        >
          <RefreshCw className={`h-3 w-3 ${levels.loading ? "animate-spin" : ""}`} />
        </button>
        <KwantSelect
          value={config.family}
          onChange={(event) => onChange({ family: event.target.value as LevelFamily })}
          menuLabel="Level family"
          className="order-last h-7 w-full basis-full rounded-lg border border-border bg-background px-2 text-[9px] font-semibold"
        >
          {(Object.keys(FAMILY_LABELS) as LevelFamily[]).map((family) => <option key={family} value={family}>{FAMILY_LABELS[family]}</option>)}
        </KwantSelect>
      </div>

      <div className="relative min-h-0 flex-1 bg-background">
        {market.loading && !market.candles.length ? (
          <KwantLoader className="h-full" compact title="Loading CME chart" detail={`${config.instrument} · ${config.timeframe} · five-day history`} />
        ) : market.error && !market.candles.length ? (
          <div className="flex h-full items-center justify-center px-5 text-center text-[9px] leading-5 text-danger">{market.error}</div>
        ) : (
          <Chart
            candles={market.candles}
            levels={config.family === "gameplan" ? [] : levels.snapshot.levels}
            backgroundLevels={config.family === "gameplan" ? levels.snapshot.levels : []}
            backgroundZones={levels.snapshot.zones}
            instrument={config.instrument}
            timeframe={config.timeframe}
            marketIsActive={market.liveStatus === "live"}
            settings={settings}
            toolbarEnabled={false}
          />
        )}

        {config.family === "structure" ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/72 p-5 backdrop-blur-[1px]">
            <div className="max-w-[320px] rounded-2xl border border-dashed border-border bg-panel/90 px-5 py-4 text-center shadow-xl">
              <Layers3 className="mx-auto h-5 w-5 text-muted" />
              <div className="mt-2 text-[10px] font-semibold">Historical structure is being plumbed in</div>
              <p className="mt-1 text-[8px] leading-4 text-muted">This panel remains deliberately blank until validated supply, demand, support and resistance zones are available.</p>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-2 left-2 z-30 flex max-w-[calc(100%-16px)] items-center gap-2 rounded-lg border border-border/80 bg-panel/90 px-2 py-1 text-[7px] backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${market.liveStatus === "live" ? "animate-pulse bg-primary" : "bg-muted"}`} />
          <span className="font-semibold text-foreground">{levels.snapshot.status}</span>
          <span className="truncate text-muted">{levels.error || levels.snapshot.source}</span>
        </div>
      </div>
    </section>
  );
}

function LevelEducationRail({ config, runtime }: { config: PanelConfig; runtime: PanelRuntime | null }) {
  const [selectedLevelId, setSelectedLevelId] = useState("");
  const snapshot = runtime?.snapshot ?? emptyStructureSnapshot();
  const sortedLevels = useMemo(() => [...snapshot.levels].sort((left, right) => {
    const price = runtime?.price ?? 0;
    return Math.abs(left.price - price) - Math.abs(right.price - price);
  }), [runtime?.price, snapshot.levels]);

  useEffect(() => {
    if (!sortedLevels.some((level) => level.id === selectedLevelId)) setSelectedLevelId(sortedLevels[0]?.id ?? "");
  }, [selectedLevelId, sortedLevels]);

  const selected = sortedLevels.find((level) => level.id === selectedLevelId) ?? sortedLevels[0] ?? null;
  const role = selected ? roleAtPrice(selected, runtime?.price ?? null, runtime?.candles ?? [], config.instrument) : null;
  const flowText = snapshot.flowLean === null
    ? "No live directional flow score attached"
    : snapshot.flowLean > 0.2
      ? `Bullish flow lean ${snapshot.flowLean.toFixed(2)}`
      : snapshot.flowLean < -0.2
        ? `Bearish flow lean ${snapshot.flowLean.toFixed(2)}`
        : `Balanced flow lean ${snapshot.flowLean.toFixed(2)}`;

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-panel">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary"><BookOpenCheck className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold">Level Intelligence</div>
            <div className="mt-0.5 truncate text-[8px] text-muted">Chart {Number(config.id.split("-").at(-1) ?? 1)} · {config.instrument} · {FAMILY_LABELS[config.family]}</div>
          </div>
          <span className="ml-auto flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[7px] font-semibold text-muted">
            <Radio className={`h-2.5 w-2.5 ${runtime?.liveStatus === "live" ? "animate-pulse text-primary" : ""}`} />
            {runtime?.liveStatus === "live" ? "LIVE" : "CONTEXT"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
          <div className="bg-background px-3 py-2"><div className="text-[7px] uppercase tracking-[0.12em] text-muted">Last</div><div className="mt-1 font-mono text-[12px] font-semibold">{formatPrice(runtime?.price ?? null)}</div></div>
          <div className="bg-background px-3 py-2"><div className="text-[7px] uppercase tracking-[0.12em] text-muted">Snapshot</div><div className="mt-1 text-[9px] font-semibold">{formatAge(snapshot.asOf)}</div></div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {config.family === "structure" ? (
          <div className="p-4">
            <div className="rounded-2xl border border-dashed border-border bg-background/35 p-4">
              <Database className="h-5 w-5 text-muted" />
              <div className="mt-3 text-[11px] font-semibold">No structural levels published</div>
              <p className="mt-2 text-[9px] leading-5 text-muted">Supply and demand, support and resistance will appear here only after the historical engine has validated each zone, its origin, retests, and invalidation. Nothing synthetic is displayed.</p>
            </div>
          </div>
        ) : selected ? (
          <>
            <div className="border-b border-border p-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color, boxShadow: `0 0 12px ${selected.color}` }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-foreground">{selected.label}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[9px] text-muted"><span className="text-foreground">{formatPrice(selected.price)}</span><span>·</span><span>{selected.evidence}</span></div>
                </div>
              </div>
              {role ? <div className="mt-3 rounded-xl border border-border bg-background px-3 py-2.5"><div className={`text-[9px] font-semibold ${role.tone}`}>{role.title}</div><p className="mt-1 text-[8px] leading-4 text-muted">{role.detail}</p></div> : null}
            </div>

            <div className="space-y-4 border-b border-border p-4">
              <div><div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted"><CircleDot className="h-3 w-3 text-primary" />What it is</div><p className="mt-2 text-[9px] leading-5 text-foreground/90">{selected.explanation}</p></div>
              <div><div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">When price arrives</div><p className="mt-2 text-[9px] leading-5 text-foreground/90">{selected.firstTouch}</p></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3"><div className="text-[8px] font-semibold text-primary">IF IT HOLDS</div><p className="mt-1.5 text-[8px] leading-4 text-muted">{selected.hold}</p></div>
                <div className="rounded-xl border border-danger/15 bg-danger/[0.04] p-3"><div className="text-[8px] font-semibold text-danger">IF IT BREAKS</div><p className="mt-1.5 text-[8px] leading-4 text-muted">{selected.break}</p></div>
              </div>
            </div>

            <div className="border-b border-border p-4">
              <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted"><Activity className="h-3 w-3 text-primary" />Live evidence</div>
              <div className="mt-3 space-y-2 text-[8px]">
                <div className="flex justify-between gap-3"><span className="text-muted">Gamma environment</span><span className="text-right font-medium text-foreground">{snapshot.regime}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Tape context</span><span className="text-right font-medium text-foreground">{snapshot.tape}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Directional pressure</span><span className="text-right font-medium text-foreground">{flowText}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Source</span><span className="text-right font-medium text-foreground">{snapshot.source}</span></div>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background/35 p-3 text-[8px] leading-4 text-muted"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span>{snapshot.note}</span></div>
            </div>

            <div className="p-4">
              <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Visible levels · nearest first</div>
              <div className="mt-2 space-y-1">
                {sortedLevels.map((level) => (
                  <button key={level.id} type="button" onClick={() => setSelectedLevelId(level.id)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${level.id === selected.id ? "border-primary/25 bg-primary/[0.07]" : "border-transparent bg-background/30 hover:border-border"}`}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: level.color }} />
                    <span className="min-w-0 flex-1 truncate text-[8px] font-medium">{level.label}</span>
                    <span className="font-mono text-[8px] text-muted">{formatPrice(level.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-5 text-center"><div><Sparkles className="mx-auto h-5 w-5 animate-pulse text-primary" /><div className="mt-3 text-[10px] font-semibold">Building level context</div><p className="mt-1 text-[8px] leading-4 text-muted">Waiting for the selected level source.</p></div></div>
        )}
      </div>
    </aside>
  );
}

export default function LevelzWorkspace() {
  const [panels, setPanels] = useState<PanelConfig[]>(DEFAULT_PANELS);
  const [activePanelId, setActivePanelId] = useState(DEFAULT_PANELS[0].id);
  const [runtimes, setRuntimes] = useState<Record<string, PanelRuntime>>({});
  const [settings, setSettings] = useState<ChartSettings>(defaultChartSettings);
  const [layoutReady, setLayoutReady] = useState(false);

  useEffect(() => {
    setSettings(loadStoredChartSettings());
    try {
      const stored = JSON.parse(window.localStorage.getItem(LEVELZ_LAYOUT_STORAGE_KEY) ?? "null") as PanelConfig[] | null;
      if (Array.isArray(stored) && stored.length === 4) {
        setPanels(DEFAULT_PANELS.map((fallback, index) => ({ ...fallback, ...stored[index], id: fallback.id })));
      }
    } catch {}
    setLayoutReady(true);
    const syncSettings = () => setSettings(loadStoredChartSettings());
    window.addEventListener("kwantdesk:preferences-changed", syncSettings);
    return () => window.removeEventListener("kwantdesk:preferences-changed", syncSettings);
  }, []);

  useEffect(() => {
    if (!layoutReady) return;
    window.localStorage.setItem(LEVELZ_LAYOUT_STORAGE_KEY, JSON.stringify(panels));
  }, [layoutReady, panels]);

  const updatePanel = (id: string, patch: Partial<PanelConfig>) => {
    setPanels((current) => current.map((panel) => panel.id === id ? { ...panel, ...patch } : panel));
  };
  const updateRuntime = useCallback((id: string, runtime: PanelRuntime) => {
    setRuntimes((current) => current[id] === runtime ? current : { ...current, [id]: runtime });
  }, []);
  const activeConfig = panels.find((panel) => panel.id === activePanelId) ?? panels[0];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex min-h-[54px] shrink-0 items-center gap-3 border-b border-border bg-panel px-4 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary"><Crosshair className="h-4 w-4" /></span>
        <div>
          <div className="text-[12px] font-semibold tracking-[0.12em]">LEVELZ</div>
          <div className="mt-0.5 text-[8px] text-muted">Four clean views · one level family per chart · live role intelligence</div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[8px] text-muted">
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Shared CME stream</span>
          <span className="rounded-full border border-border bg-background px-2.5 py-1">5-day history</span>
          <span className="rounded-full border border-border bg-background px-2.5 py-1">Evidence-labelled</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-3 p-3">
        <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-2.5">
          {panels.map((panel, index) => (
            <LevelChartCard
              key={panel.id}
              config={panel}
              index={index}
              settings={settings}
              active={panel.id === activePanelId}
              onActivate={() => setActivePanelId(panel.id)}
              onChange={(patch) => updatePanel(panel.id, patch)}
              onRuntime={updateRuntime}
            />
          ))}
        </div>
        <LevelEducationRail config={activeConfig} runtime={runtimes[activeConfig.id] ?? null} />
      </div>
    </div>
  );
}
