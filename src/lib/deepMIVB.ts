import type { Candle } from "@/lib/backtester";

export const DEEP_M_IVB_SETTINGS_VERSION = 1;

export type DeepMIVBSettings = {
  openingRangeMinutes: 15 | 30 | 60;
  lookbackSessions: number;
  showRange: boolean;
  showProtection: boolean;
  showAverage: boolean;
  showStandardDeviation: boolean;
  showZones: boolean;
  showSummary: boolean;
  extendToLiveEdge: boolean;
  zoneWidthTicks: number;
  lineWidth: 1 | 2 | 3 | 4;
  zoneOpacity: number;
  useThemeColors: boolean;
  positiveColor: string;
  negativeColor: string;
  neutralColor: string;
};

export type DeepMIVBFrame = {
  sessionKey: string;
  startMs: number;
  rangeEndMs: number;
  endMs: number;
  high: number;
  middle: number;
  low: number;
  protectionHigh: number;
  protectionLow: number;
  averageHigh: number;
  averageLow: number;
  deviationHigh: number;
  deviationLow: number;
  state: "positive" | "negative" | "neutral";
  sampleSessions: number;
};

const chicago = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

function parts(timestamp: number) {
  const values = Object.fromEntries(chicago.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return { key: `${values.year}-${values.month}-${values.day}`, minute: Number(values.hour) * 60 + Number(values.minute) };
}

const finite = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export function normalizeDeepMIVBSettings(input: Record<string, unknown> | null | undefined, theme?: { upColor: string; downColor: string; neutralColor: string }): DeepMIVBSettings {
  const rawRange = Number(input?.openingRangeMinutes ?? 30);
  const openingRangeMinutes = (rawRange <= 15 ? 15 : rawRange >= 60 ? 60 : 30) as 15 | 30 | 60;
  return {
    openingRangeMinutes,
    lookbackSessions: Math.round(finite(input?.lookbackSessions, 20, 3, 120)),
    showRange: input?.showRange !== false,
    showProtection: input?.showProtection !== false,
    showAverage: input?.showAverage !== false,
    showStandardDeviation: input?.showStandardDeviation !== false,
    showZones: input?.showZones !== false,
    showSummary: input?.showSummary !== false,
    extendToLiveEdge: input?.extendToLiveEdge !== false,
    zoneWidthTicks: Math.round(finite(input?.zoneWidthTicks, 4, 1, 40)),
    lineWidth: Math.round(finite(input?.lineWidth, 1, 1, 4)) as 1 | 2 | 3 | 4,
    zoneOpacity: finite(input?.zoneOpacity, 14, 0, 60),
    useThemeColors: input?.useThemeColors !== false,
    positiveColor: typeof input?.positiveColor === "string" ? input.positiveColor : theme?.upColor ?? "#22C55E",
    negativeColor: typeof input?.negativeColor === "string" ? input.negativeColor : theme?.downColor ?? "#EF4444",
    neutralColor: typeof input?.neutralColor === "string" ? input.neutralColor : theme?.neutralColor ?? "#94A3B8",
  };
}

function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

export function calculateDeepMIVB(candles: Candle[], settings: DeepMIVBSettings): DeepMIVBFrame[] {
  const sessions = new Map<string, Candle[]>();
  [...candles].sort((a, b) => a.timestamp - b.timestamp).forEach((candle) => {
    const local = parts(candle.timestamp);
    if (local.minute < 8 * 60 + 30 || local.minute > 15 * 60) return;
    sessions.set(local.key, [...(sessions.get(local.key) ?? []), candle]);
  });
  const history: number[] = [];
  const frames: DeepMIVBFrame[] = [];
  for (const [sessionKey, bars] of sessions) {
    const openingEndMinute = 8 * 60 + 30 + settings.openingRangeMinutes;
    const opening = bars.filter((bar) => parts(bar.timestamp).minute < openingEndMinute);
    if (!opening.length) continue;
    const after = bars.filter((bar) => parts(bar.timestamp).minute >= openingEndMinute);
    const high = Math.max(...opening.map((bar) => bar.high));
    const low = Math.min(...opening.map((bar) => bar.low));
    const sessionRange = Math.max(Number.EPSILON, high - low);
    const samples = history.slice(-settings.lookbackSessions);
    const averageExtension = samples.length ? mean(samples) : sessionRange;
    const variance = samples.length ? mean(samples.map((value) => (value - averageExtension) ** 2)) : (sessionRange * 0.25) ** 2;
    const deviation = Math.sqrt(variance);
    const protection = samples.length
      ? [...samples].sort((a, b) => a - b)[Math.floor((samples.length - 1) * 0.25)]
      : sessionRange * 0.5;
    const latest = bars[bars.length - 1];
    const middle = (high + low) / 2;
    frames.push({
      sessionKey,
      startMs: opening[0].timestamp,
      rangeEndMs: after[0]?.timestamp ?? opening[opening.length - 1].timestamp,
      endMs: latest.timestamp,
      high, middle, low,
      protectionHigh: high + protection,
      protectionLow: low - protection,
      averageHigh: high + averageExtension,
      averageLow: low - averageExtension,
      deviationHigh: high + averageExtension + deviation,
      deviationLow: low - averageExtension - deviation,
      state: latest.close > high ? "positive" : latest.close < low ? "negative" : "neutral",
      sampleSessions: samples.length,
    });
    if (after.length) {
      const up = Math.max(0, Math.max(...after.map((bar) => bar.high)) - high);
      const down = Math.max(0, low - Math.min(...after.map((bar) => bar.low)));
      history.push(Math.max(up, down));
    }
  }
  return frames;
}
