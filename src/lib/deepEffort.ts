import type { Candle } from "@/lib/backtester";

export type EffortZone = {
  id: string;
  side: "ASK" | "BID";
  startIndex: number;
  endIndex: number;
  startTimestamp: number;
  top: number;
  bottom: number;
  score: number;
};

export type EffortAveragePoint = {
  time: number;
  value: number;
  bias: "ASK" | "BID";
};

export type DeepEffortResult = {
  average: EffortAveragePoint[];
  zones: EffortZone[];
  hasOrderFlow: boolean;
  instrumentRoot: string;
  profileLabel: string;
};

export type EffortInstrumentProfile = {
  root: string;
  label: string;
  tickSize: number;
  averageLength: number;
  lookback: number;
  cooldown: number;
  participationThreshold: number;
  scoreThreshold: number;
  minimumThicknessTicks: number;
  rangeThicknessFactor: number;
};

export type DeepEffortOptions = {
  zoneBars?: number;
  tickSize?: number;
  instrument?: string;
  minimumBars?: number;
  minimumDeltaPercent?: number;
  maximumDeltaPercent?: number;
  maximumDeltaEffort?: number;
  averageLength?: number;
  entryZoneRangePercent?: number;
};

const deepEffortCache = new WeakMap<Candle[], Map<string, DeepEffortResult>>();

function cacheDeepEffort(candles: Candle[], key: string, result: DeepEffortResult) {
  const entries = deepEffortCache.get(candles) ?? new Map<string, DeepEffortResult>();
  entries.set(key, result);
  deepEffortCache.set(candles, entries);
}

const finite = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const EFFORT_PROFILES: Record<string, Omit<EffortInstrumentProfile, "root">> = {
  NQ: { label: "NQ", tickSize: 0.25, averageLength: 21, lookback: 40, cooldown: 8, participationThreshold: 0.35, scoreThreshold: 0.48, minimumThicknessTicks: 4, rangeThicknessFactor: 0.28 },
  MNQ: { label: "MNQ", tickSize: 0.25, averageLength: 21, lookback: 40, cooldown: 6, participationThreshold: 0.3, scoreThreshold: 0.45, minimumThicknessTicks: 4, rangeThicknessFactor: 0.28 },
  ES: { label: "ES", tickSize: 0.25, averageLength: 24, lookback: 48, cooldown: 9, participationThreshold: 0.45, scoreThreshold: 0.52, minimumThicknessTicks: 3, rangeThicknessFactor: 0.24 },
  MES: { label: "MES", tickSize: 0.25, averageLength: 24, lookback: 42, cooldown: 7, participationThreshold: 0.32, scoreThreshold: 0.46, minimumThicknessTicks: 3, rangeThicknessFactor: 0.24 },
  YM: { label: "YM", tickSize: 1, averageLength: 21, lookback: 44, cooldown: 8, participationThreshold: 0.38, scoreThreshold: 0.49, minimumThicknessTicks: 4, rangeThicknessFactor: 0.26 },
  MYM: { label: "MYM", tickSize: 1, averageLength: 21, lookback: 40, cooldown: 6, participationThreshold: 0.28, scoreThreshold: 0.44, minimumThicknessTicks: 4, rangeThicknessFactor: 0.26 },
  RTY: { label: "RTY", tickSize: 0.1, averageLength: 21, lookback: 44, cooldown: 8, participationThreshold: 0.38, scoreThreshold: 0.49, minimumThicknessTicks: 4, rangeThicknessFactor: 0.27 },
  M2K: { label: "M2K", tickSize: 0.1, averageLength: 21, lookback: 40, cooldown: 6, participationThreshold: 0.28, scoreThreshold: 0.44, minimumThicknessTicks: 4, rangeThicknessFactor: 0.27 },
  GC: { label: "GC", tickSize: 0.1, averageLength: 24, lookback: 50, cooldown: 10, participationThreshold: 0.48, scoreThreshold: 0.54, minimumThicknessTicks: 5, rangeThicknessFactor: 0.23 },
  MGC: { label: "MGC", tickSize: 0.1, averageLength: 24, lookback: 44, cooldown: 8, participationThreshold: 0.34, scoreThreshold: 0.48, minimumThicknessTicks: 5, rangeThicknessFactor: 0.23 },
  SI: { label: "SI", tickSize: 0.005, averageLength: 24, lookback: 50, cooldown: 10, participationThreshold: 0.48, scoreThreshold: 0.54, minimumThicknessTicks: 5, rangeThicknessFactor: 0.23 },
  SIL: { label: "SIL", tickSize: 0.005, averageLength: 24, lookback: 44, cooldown: 8, participationThreshold: 0.34, scoreThreshold: 0.48, minimumThicknessTicks: 5, rangeThicknessFactor: 0.23 },
  CL: { label: "CL", tickSize: 0.01, averageLength: 18, lookback: 46, cooldown: 8, participationThreshold: 0.44, scoreThreshold: 0.51, minimumThicknessTicks: 5, rangeThicknessFactor: 0.25 },
  MCL: { label: "MCL", tickSize: 0.01, averageLength: 18, lookback: 40, cooldown: 6, participationThreshold: 0.3, scoreThreshold: 0.45, minimumThicknessTicks: 5, rangeThicknessFactor: 0.25 },
  BTC: { label: "BTC", tickSize: 5, averageLength: 18, lookback: 54, cooldown: 10, participationThreshold: 0.5, scoreThreshold: 0.56, minimumThicknessTicks: 3, rangeThicknessFactor: 0.3 },
  MBT: { label: "MBT", tickSize: 5, averageLength: 18, lookback: 46, cooldown: 8, participationThreshold: 0.36, scoreThreshold: 0.5, minimumThicknessTicks: 3, rangeThicknessFactor: 0.3 },
  ETH: { label: "ETH", tickSize: 0.5, averageLength: 18, lookback: 54, cooldown: 10, participationThreshold: 0.5, scoreThreshold: 0.56, minimumThicknessTicks: 3, rangeThicknessFactor: 0.3 },
  MET: { label: "MET", tickSize: 0.5, averageLength: 18, lookback: 46, cooldown: 8, participationThreshold: 0.36, scoreThreshold: 0.5, minimumThicknessTicks: 3, rangeThicknessFactor: 0.3 },
};

const DEFAULT_EFFORT_PROFILE: Omit<EffortInstrumentProfile, "root"> = {
  label: "Adaptive futures",
  tickSize: 0.01,
  averageLength: 21,
  lookback: 44,
  cooldown: 8,
  participationThreshold: 0.38,
  scoreThreshold: 0.49,
  minimumThicknessTicks: 4,
  rangeThicknessFactor: 0.27,
};

export function effortInstrumentRoot(instrument = "") {
  const normalized = instrument.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/^(MNQ|MES|MYM|M2K|MGC|SIL|MCL|MBT|MET|NQ|ES|YM|RTY|GC|SI|CL|BTC|ETH)/);
  return match?.[1] ?? (normalized.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "") || "FUT");
}

export function resolveEffortInstrumentProfile(instrument = "", tickSize?: number): EffortInstrumentProfile {
  const root = effortInstrumentRoot(instrument);
  const preset = EFFORT_PROFILES[root] ?? DEFAULT_EFFORT_PROFILE;
  return {
    root,
    ...preset,
    tickSize: Math.max(Number.EPSILON, finite(tickSize, preset.tickSize)),
  };
}

function kaufmanAverage(candles: Candle[], length = 21, fastLength = 2, slowLength = 30) {
  if (!candles.length) return [];
  const fast = 2 / (fastLength + 1);
  const slow = 2 / (slowLength + 1);
  let value = candles[0].close;
  return candles.map((candle, index) => {
    if (index > 0) {
      const anchor = candles[Math.max(0, index - length)].close;
      const change = Math.abs(candle.close - anchor);
      let volatility = 0;
      for (let offset = Math.max(1, index - length + 1); offset <= index; offset += 1) {
        volatility += Math.abs(candles[offset].close - candles[offset - 1].close);
      }
      const efficiency = volatility > 0 ? change / volatility : 0;
      const smoothing = (efficiency * (fast - slow) + slow) ** 2;
      value += smoothing * (candle.close - value);
    }
    return {
      time: candle.timestamp / 1_000,
      value,
      bias: candle.close >= value ? "ASK" as const : "BID" as const,
    };
  });
}

/**
 * Transparent effort-versus-result model for the KWANT overlay.
 *
 * Executed Ask/Bid dominance supplies the directional effort. Its significance
 * is normalized against recent volume, while candle displacement measures the
 * result. A zone is emitted only when both participation and directional
 * efficiency agree, then remains fixed to its originating price and chart bar.
 */
export function calculateDeepEffort(
  candles: Candle[],
  options: DeepEffortOptions = {},
): DeepEffortResult {
  const cacheKey = JSON.stringify(options);
  const cached = deepEffortCache.get(candles)?.get(cacheKey);
  if (cached) return cached;
  const profile = resolveEffortInstrumentProfile(options.instrument, options.tickSize);
  const zoneBars = Math.max(4, Math.min(120, Math.round(options.zoneBars ?? 22)));
  const minimumBars = Math.max(12, Math.min(200, Math.round(options.minimumBars ?? 20)));
  const minimumDeltaShare = clamp(finite(options.minimumDeltaPercent, 20) / 100, 0, 1);
  const maximumDeltaShare = clamp(finite(options.maximumDeltaPercent, 100) / 100, minimumDeltaShare, 1);
  const maximumDeltaEffort = Math.max(0, finite(options.maximumDeltaEffort));
  const averageLength = Math.max(2, Math.min(200, Math.round(options.averageLength ?? profile.averageLength)));
  const entryZoneRange = clamp(finite(options.entryZoneRangePercent, profile.rangeThicknessFactor * 100) / 100, 0.05, 1);
  const tickSize = profile.tickSize;
  const average = kaufmanAverage(candles, averageLength);
  const hasOrderFlow = candles.some((candle) => {
    const ask = finite(candle.askVolume);
    const bid = finite(candle.bidVolume);
    return ask + bid > 0;
  });
  if (!hasOrderFlow || candles.length < minimumBars) {
    const result = { average, zones: [], hasOrderFlow, instrumentRoot: profile.root, profileLabel: profile.label };
    cacheDeepEffort(candles, cacheKey, result);
    return result;
  }

  const lookback = profile.lookback;
  const cooldown = profile.cooldown;
  const zones: EffortZone[] = [];
  let lastSignalIndex = -cooldown;

  candles.forEach((candle, index) => {
    if (index < minimumBars - 1 || index - lastSignalIndex < cooldown) return;
    const windowStart = Math.max(0, index - lookback + 1);
    const window = candles.slice(windowStart, index + 1);
    const volumes = window.map((bar) => Math.max(0, finite(bar.volume)));
    const meanVolume = volumes.reduce((sum, value) => sum + value, 0) / Math.max(1, volumes.length);
    const volumeDeviation = Math.sqrt(
      volumes.reduce((sum, value) => sum + (value - meanVolume) ** 2, 0) / Math.max(1, volumes.length),
    );
    const volume = Math.max(0, finite(candle.volume));
    const participation = volumeDeviation > 0
      ? (volume - meanVolume) / volumeDeviation
      : volume >= meanVolume ? 1 : 0;
    if (participation < profile.participationThreshold || volume <= 0) return;

    const ask = Math.max(0, finite(candle.askVolume));
    const bid = Math.max(0, finite(candle.bidVolume));
    if (ask + bid <= 0) return;
    const delta = finite(candle.delta, ask - bid);
    const deltaShare = clamp(delta / Math.max(ask + bid, 1), -1, 1);
    const range = Math.max(tickSize, candle.high - candle.low);
    const absoluteDeltaShare = Math.abs(deltaShare);
    if (absoluteDeltaShare < minimumDeltaShare || absoluteDeltaShare > maximumDeltaShare) return;
    // Deep Charts defines Delta Effort as delta divided by bar width. Keep the
    // unit explicit (contracts per tick) so its exposed maximum is stable
    // across instruments instead of depending on a price-point convention.
    const deltaEffort = Math.abs(delta) / Math.max(1, range / tickSize);
    if (maximumDeltaEffort > 0 && deltaEffort > maximumDeltaEffort) return;
    const displacement = clamp((candle.close - candle.open) / range, -1, 1);
    const closeLocation = clamp(((candle.close - candle.low) / range) * 2 - 1, -1, 1);
    const directionalEffort = deltaShare * 0.58 + displacement * 0.24 + closeLocation * 0.18;
    const score = Math.abs(directionalEffort) * (1 + Math.max(0, participation) * 0.35);
    if (score < profile.scoreThreshold) return;

    const side: EffortZone["side"] = directionalEffort > 0 ? "ASK" : "BID";
    const recentRanges = window.slice(-14).map((bar) =>
      Math.max(tickSize, bar.high - bar.low));
    const averageRange = recentRanges.reduce((sum, value) => sum + value, 0)
      / Math.max(1, recentRanges.length);
    const minimumThickness = Math.max(
      tickSize * profile.minimumThicknessTicks,
      averageRange * entryZoneRange,
    );
    const bodyLow = Math.min(candle.open, candle.close);
    const bodyHigh = Math.max(candle.open, candle.close);
    const bottom = side === "ASK"
      ? candle.low
      : Math.min(bodyHigh, candle.high - minimumThickness);
    const top = side === "ASK"
      ? Math.max(bodyLow, candle.low + minimumThickness)
      : candle.high;
    const safeBottom = Math.min(bottom, top - tickSize);
    const safeTop = Math.max(top, safeBottom + tickSize);
    let endIndex = index + zoneBars;

    for (let future = index + 1; future < Math.min(candles.length, endIndex + 1); future += 1) {
      const invalidated = side === "ASK"
        ? candles[future].close < safeBottom - tickSize
        : candles[future].close > safeTop + tickSize;
      if (invalidated) {
        endIndex = future;
        break;
      }
    }

    zones.push({
      id: `effort-${candle.timestamp}-${side}`,
      side,
      startIndex: index,
      endIndex,
      startTimestamp: candle.timestamp,
      top: safeTop,
      bottom: safeBottom,
      score,
    });
    lastSignalIndex = index;
  });

  const result = {
    average,
    zones: zones.slice(-120),
    hasOrderFlow,
    instrumentRoot: profile.root,
    profileLabel: profile.label,
  };
  cacheDeepEffort(candles, cacheKey, result);
  return result;
}
