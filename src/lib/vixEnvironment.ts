import type { MarketIndexLiveSnapshot } from "@/lib/marketIndexLiveClient";

export type VixEnvironmentRegime = "CALM" | "NORMAL" | "ELEVATED" | "HIGH" | "EXTREME";

export type VixEnvironmentThresholds = {
  normal: number;
  elevated: number;
  high: number;
  extreme: number;
};

export type VixHistoryCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type VixEnvironmentSnapshot = {
  symbol: "VIX" | "VXN";
  value: number;
  open: number | null;
  change: number | null;
  changePercent: number | null;
  sessionHigh: number | null;
  sessionLow: number | null;
  sessionPositionPercent: number | null;
  rank52Week: number | null;
  percentile52Week: number | null;
  regime: VixEnvironmentRegime;
  checkedAt: string;
  sourceLabel: string;
  stale: boolean;
  delayed: boolean;
  marketOpen: boolean;
};

export const DEFAULT_VIX_ENVIRONMENT_THRESHOLDS: VixEnvironmentThresholds = {
  normal: 15,
  elevated: 20,
  high: 25,
  extreme: 30,
};

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampMs(value: unknown): number | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  const parsed = finite(value);
  if (parsed === null) return null;
  return parsed < 10_000_000_000 ? parsed * 1_000 : parsed;
}

export function normalizeVixHistoryCandles(value: unknown): VixHistoryCandle[] {
  if (!Array.isArray(value)) return [];
  const rows = value.flatMap((entry): VixHistoryCandle[] => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const timestamp = timestampMs(row.timestamp ?? row.time ?? row.date ?? row.t);
    const close = finite(row.close ?? row.c);
    const open = finite(row.open ?? row.o) ?? close;
    const high = finite(row.high ?? row.h) ?? close;
    const low = finite(row.low ?? row.l) ?? close;
    if (timestamp === null || close === null || open === null || high === null || low === null || close <= 0) return [];
    return [{ timestamp, open, high, low, close }];
  });
  rows.sort((left, right) => left.timestamp - right.timestamp);
  return rows.filter((row, index) => index === 0 || row.timestamp !== rows[index - 1].timestamp);
}

export function normalizeVixEnvironmentThresholds(
  value: Partial<VixEnvironmentThresholds> | null | undefined,
): VixEnvironmentThresholds {
  const normal = Math.max(5, Math.min(50, finite(value?.normal) ?? 15));
  const elevated = Math.max(normal + 1, Math.min(60, finite(value?.elevated) ?? 20));
  const high = Math.max(elevated + 1, Math.min(70, finite(value?.high) ?? 25));
  const extreme = Math.max(high + 1, Math.min(100, finite(value?.extreme) ?? 30));
  return { normal, elevated, high, extreme };
}

export function classifyVixEnvironment(
  value: number,
  thresholds: Partial<VixEnvironmentThresholds> = DEFAULT_VIX_ENVIRONMENT_THRESHOLDS,
): VixEnvironmentRegime {
  const normalized = normalizeVixEnvironmentThresholds(thresholds);
  if (value < normalized.normal) return "CALM";
  if (value < normalized.elevated) return "NORMAL";
  if (value < normalized.high) return "ELEVATED";
  if (value < normalized.extreme) return "HIGH";
  return "EXTREME";
}

export function resolveVixEnvironmentSymbol(
  instrument: string,
  sourceSetting: unknown,
): "VIX" | "VXN" {
  const requested = String(sourceSetting ?? "VIX").trim().toUpperCase();
  if (requested === "VXN") return "VXN";
  if (requested !== "AUTO") return "VIX";
  const root = instrument.trim().toUpperCase().replace(/[!.]/g, "");
  return /^(MNQ|NQ|NDX|QQQ)/.test(root) ? "VXN" : "VIX";
}

export function calculateVixHistoryStats(
  candles: VixHistoryCandle[],
  currentValue: number,
  asOfMs: number,
) {
  const eligible = candles.filter((row) => row.timestamp <= asOfMs).slice(-252);
  const latest = eligible.at(-1) ?? null;
  if (!eligible.length) {
    return {
      latest,
      previous: null,
      rank52Week: null,
      percentile52Week: null,
    };
  }
  const closes = eligible.map((row) => row.close).filter((value) => Number.isFinite(value) && value > 0);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const rank52Week = high > low ? ((currentValue - low) / (high - low)) * 100 : 50;
  const percentile52Week = closes.length
    ? (closes.filter((value) => value <= currentValue).length / closes.length) * 100
    : null;
  return {
    latest,
    previous: eligible.at(-2) ?? null,
    rank52Week: Math.max(0, Math.min(100, rank52Week)),
    percentile52Week: percentile52Week === null ? null : Math.max(0, Math.min(100, percentile52Week)),
  };
}

export function buildVixEnvironmentSnapshot(options: {
  symbol: "VIX" | "VXN";
  live: MarketIndexLiveSnapshot | null;
  history: VixHistoryCandle[];
  asOfMs: number;
  thresholds?: Partial<VixEnvironmentThresholds>;
  replay?: boolean;
}): VixEnvironmentSnapshot | null {
  const historyAtClock = options.history.filter((row) => row.timestamp <= options.asOfMs);
  const historical = historyAtClock.at(-1) ?? null;
  const previous = historyAtClock.at(-2) ?? null;
  const liveValue = options.live && options.live.timestamp <= options.asOfMs + 60_000
    ? finite(options.live.lastPrice)
    : null;
  const value = liveValue ?? historical?.close ?? null;
  if (value === null || value <= 0) return null;

  const stats = calculateVixHistoryStats(options.history, value, options.asOfMs);
  const open = finite(options.live?.openPrice) ?? historical?.open ?? null;
  const change = finite(options.live?.change)
    ?? (historical && previous ? historical.close - previous.close : open !== null ? value - open : null);
  const changePercent = finite(options.live?.changePercent)
    ?? (change !== null && value - change > 0 ? (change / (value - change)) * 100 : null);
  const sessionHigh = historical ? Math.max(historical.high, value) : value;
  const sessionLow = historical ? Math.min(historical.low, value) : value;
  const sessionPositionPercent = sessionHigh > sessionLow
    ? ((value - sessionLow) / (sessionHigh - sessionLow)) * 100
    : 50;
  const marketOpen = !options.replay && options.live?.marketOpen === true;
  const timestamp = options.live?.timestamp ?? historical?.timestamp ?? options.asOfMs;
  const provider = options.live?.provider?.trim() || (historical ? "official daily history" : "server market-index feed");

  return {
    symbol: options.symbol,
    value,
    open,
    change,
    changePercent,
    sessionHigh,
    sessionLow,
    sessionPositionPercent: Math.max(0, Math.min(100, sessionPositionPercent)),
    rank52Week: stats.rank52Week,
    percentile52Week: stats.percentile52Week,
    regime: classifyVixEnvironment(value, options.thresholds),
    checkedAt: new Date(timestamp).toISOString(),
    sourceLabel: `${options.symbol} · ${provider}`,
    stale: options.replay === true || !marketOpen || options.live?.delayed === true,
    delayed: options.replay === true || options.live?.delayed === true,
    marketOpen,
  };
}
