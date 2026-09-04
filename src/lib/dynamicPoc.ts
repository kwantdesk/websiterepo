import { cmeSessionDateKey } from "./chartHistoryWindow.ts";
import type { FootprintBar } from "./footprint.ts";
import { exchangeMinuteOfDay } from "./volumeProfileSessions.ts";

export const DYNAMIC_POC_SETTINGS_VERSION = 1;
export type DynamicPocSettings = {
  schemaVersion: number;
  periodMode: "daily" | "minute" | "bars" | "last-days" | "last-minutes";
  periodValue: number;
  envelopeMode: "standard-deviation" | "price-percentage";
  firstEnvelope: number;
  secondEnvelope: number;
  thirdEnvelope: number;
  showPoc: boolean;
  showFirstEnvelope: boolean;
  showSecondEnvelope: boolean;
  showThirdEnvelope: boolean;
  pocColor: string;
  firstEnvelopeColor: string;
  secondEnvelopeColor: string;
  thirdEnvelopeColor: string;
  lineWidth: number;
  envelopeLineWidth: number;
  useThemeColors: boolean;
};

export type DynamicPocPoint = {
  timestamp: number;
  pocTick: number | null;
  envelopes: [number, number, number] | null;
};

export type DynamicPocFrame = {
  instrument: string;
  tickSize: number;
  status: "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE";
  points: DynamicPocPoint[];
};

export const DEFAULT_DYNAMIC_POC_SETTINGS: DynamicPocSettings = {
  schemaVersion: DYNAMIC_POC_SETTINGS_VERSION,
  periodMode: "bars",
  periodValue: 20,
  envelopeMode: "standard-deviation",
  firstEnvelope: 1,
  secondEnvelope: 2,
  thirdEnvelope: 3,
  showPoc: true,
  showFirstEnvelope: true,
  showSecondEnvelope: true,
  showThirdEnvelope: true,
  pocColor: "#22D3EE",
  firstEnvelopeColor: "#A3E635",
  secondEnvelopeColor: "#F59E0B",
  thirdEnvelopeColor: "#EF4444",
  lineWidth: 2,
  envelopeLineWidth: 1,
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function normalizeDynamicPocSettings(input?: Record<string, unknown> | null): DynamicPocSettings {
  const source = input ?? {};
  const settings = { ...DEFAULT_DYNAMIC_POC_SETTINGS, ...source } as DynamicPocSettings;
  settings.schemaVersion = DYNAMIC_POC_SETTINGS_VERSION;
  settings.periodValue = Math.round(clamp(finite(source.periodValue, 20), 1, 10_000));
  settings.firstEnvelope = clamp(finite(source.firstEnvelope, 1), 0.25, 100);
  settings.secondEnvelope = clamp(finite(source.secondEnvelope, 2), 0.25, 100);
  settings.thirdEnvelope = clamp(finite(source.thirdEnvelope, 3), 0.25, 100);
  settings.lineWidth = clamp(finite(source.lineWidth, 2), 0.5, 8);
  settings.envelopeLineWidth = clamp(finite(source.envelopeLineWidth, 1), 0.5, 8);
  if (!(new Set(["daily", "minute", "bars", "last-days", "last-minutes"]) as Set<unknown>).has(settings.periodMode)) settings.periodMode = "bars";
  if (!(new Set(["standard-deviation", "price-percentage"]) as Set<unknown>).has(settings.envelopeMode)) settings.envelopeMode = "standard-deviation";
  return settings;
}

type WindowState = { volumes: Map<number, number>; total: number; weighted: number; weightedSquare: number };
const state = (): WindowState => ({ volumes: new Map(), total: 0, weighted: 0, weightedSquare: 0 });
function applyBar(target: WindowState, bar: FootprintBar, sign: 1 | -1) {
  for (const row of bar.rows) {
    const volume = row.bidVolume + row.askVolume + row.unknownVolume;
    if (!(volume > 0)) continue;
    const next = (target.volumes.get(row.tickIndex) ?? 0) + sign * volume;
    if (next > 0.000001) target.volumes.set(row.tickIndex, next); else target.volumes.delete(row.tickIndex);
    target.total += sign * volume;
    target.weighted += sign * volume * row.tickIndex;
    target.weightedSquare += sign * volume * row.tickIndex * row.tickIndex;
  }
}

function values(target: WindowState, closeTick: number, settings: DynamicPocSettings): { poc: number; envelopes: [number, number, number] } | null {
  if (!(target.total > 0) || !target.volumes.size) return null;
  const max = Math.max(...target.volumes.values());
  const meanTick = target.weighted / target.total;
  const tied = [...target.volumes.entries()].filter(([, value]) => value === max)
    .sort((a, b) => Math.abs(a[0] - meanTick) - Math.abs(b[0] - meanTick) || Math.abs(a[0] - closeTick) - Math.abs(b[0] - closeTick) || a[0] - b[0]);
  const poc = tied[0][0];
  const offsets = [settings.firstEnvelope, settings.secondEnvelope, settings.thirdEnvelope] as const;
  if (settings.envelopeMode === "price-percentage") return { poc, envelopes: offsets.map((offset) => poc * offset / 100) as [number, number, number] };
  const varianceAboutPoc = Math.max(0, (target.weightedSquare - 2 * poc * target.weighted + poc * poc * target.total) / target.total);
  const deviation = Math.sqrt(varianceAboutPoc);
  return { poc, envelopes: offsets.map((offset) => deviation * offset) as [number, number, number] };
}

export function buildDynamicPocFrame(barsInput: FootprintBar[], instrument: string, tickSize: number, input?: Record<string, unknown> | null): DynamicPocFrame {
  const settings = normalizeDynamicPocSettings(input);
  const bars = [...barsInput].sort((a, b) => a.startTime - b.startTime);
  if (!bars.some((bar) => bar.hasPriceLevelFlow)) return { instrument, tickSize, status: "WAITING_FOR_VOLUME_AT_PRICE", points: [] };
  let window = state();
  let left = 0;
  let previousBucket = "";
  const points: DynamicPocPoint[] = [];
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    let bucket = "";
    if (settings.periodMode === "daily") bucket = cmeSessionDateKey(bar.startTime) ?? new Date(bar.startTime).toISOString().slice(0, 10);
    else if (settings.periodMode === "minute") bucket = `${cmeSessionDateKey(bar.startTime) ?? "session"}:${Math.floor(exchangeMinuteOfDay(bar.startTime) / settings.periodValue)}`;
    if (bucket && bucket !== previousBucket) { window = state(); left = index; previousBucket = bucket; }
    applyBar(window, bar, 1);
    if (settings.periodMode === "bars") {
      while (left < index - settings.periodValue + 1) { applyBar(window, bars[left], -1); left += 1; }
    } else if (settings.periodMode === "last-minutes" || settings.periodMode === "last-days") {
      const duration = settings.periodValue * (settings.periodMode === "last-minutes" ? 60_000 : 86_400_000);
      while (left < index && bars[left].endTime < bar.endTime - duration) { applyBar(window, bars[left], -1); left += 1; }
    }
    const result = values(window, bar.closeTick, settings);
    points.push({ timestamp: bar.endTime, pocTick: result?.poc ?? null, envelopes: result?.envelopes ?? null });
  }
  const latest = bars.at(-1);
  return { instrument, tickSize, status: latest && !latest.isClosed ? "LIVE" : "HISTORICAL", points };
}
