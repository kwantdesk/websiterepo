import type { FootprintBar } from "./footprint.ts";

export const RATIO_HIGHLIGHT_SETTINGS_VERSION = 1;

export type RatioHighlightSettings = {
  schemaVersion: number;
  ratioMode: "bar" | "high" | "low";
  minRatio: number;
  maxRatio: number;
  bidColor: string;
  askColor: string;
  opacity: number;
  useThemeColors: boolean;
};

export type RatioHighlightMarker = {
  id: string;
  startTime: number;
  endTime: number;
  side: "high" | "low";
  ratio: number;
};

export type RatioHighlightFrame = {
  instrument: string;
  status: "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE";
  markers: RatioHighlightMarker[];
};

export const DEFAULT_RATIO_HIGHLIGHT_SETTINGS: RatioHighlightSettings = {
  schemaVersion: RATIO_HIGHLIGHT_SETTINGS_VERSION,
  ratioMode: "bar",
  minRatio: 10,
  maxRatio: 20,
  bidColor: "#D5006D",
  askColor: "#007C7A",
  opacity: 70,
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function normalizeRatioHighlightSettings(input?: Record<string, unknown> | null): RatioHighlightSettings {
  const source = input ?? {};
  const settings = { ...DEFAULT_RATIO_HIGHLIGHT_SETTINGS, ...source } as RatioHighlightSettings;
  settings.schemaVersion = RATIO_HIGHLIGHT_SETTINGS_VERSION;
  settings.minRatio = clamp(finite(source.minRatio, 10), 0, 100);
  settings.maxRatio = clamp(finite(source.maxRatio, 20), 0, 100);
  settings.opacity = Math.round(clamp(finite(source.opacity, 70), 0, 100));
  if (!(new Set(["bar", "high", "low"]) as Set<unknown>).has(settings.ratioMode)) settings.ratioMode = "bar";
  return settings;
}

function ratioAtExtreme(bar: FootprintBar, side: "high" | "low") {
  const lastTick = side === "high" ? bar.highTick : bar.lowTick;
  const penultimateTick = side === "high" ? lastTick - 1 : lastTick + 1;
  const last = bar.rows.find((row) => row.tickIndex === lastTick);
  const penultimate = bar.rows.find((row) => row.tickIndex === penultimateTick);
  if (!last || !penultimate) return null;
  const denominator = side === "high" ? last.askVolume : last.bidVolume;
  const numerator = side === "high" ? penultimate.askVolume : penultimate.bidVolume;
  if (!(denominator > 0) || !(numerator >= 0)) return null;
  const ratio = numerator / denominator;
  return Number.isFinite(ratio) ? ratio : null;
}

function accepted(ratio: number | null, settings: RatioHighlightSettings) {
  if (ratio === null || ratio < settings.minRatio) return false;
  return settings.maxRatio <= 0 || ratio <= settings.maxRatio;
}

/**
 * DeepCharts' standalone Ratio Highlight is an auction-extreme exhaustion
 * study, not the diagonal imbalance ratio shown inside Footprint cells.
 * Ratio High compares Ask at high-1 tick with Ask at the high; Ratio Low does
 * the matching Bid comparison at low+1 and the low. Exact one-tick execution
 * rows are therefore mandatory and OHLC data is never used as a substitute.
 */
export function buildRatioHighlightFrame(
  barsInput: FootprintBar[],
  instrument: string,
  input?: Record<string, unknown> | null,
): RatioHighlightFrame {
  const settings = normalizeRatioHighlightSettings(input);
  const bars = [...barsInput].sort((left, right) => left.startTime - right.startTime);
  if (!bars.some((bar) => bar.hasPriceLevelFlow)) {
    return { instrument, status: "WAITING_FOR_VOLUME_AT_PRICE", markers: [] };
  }

  const markers: RatioHighlightMarker[] = [];
  for (const bar of bars) {
    if (!bar.hasPriceLevelFlow) continue;
    const highRatio = ratioAtExtreme(bar, "high");
    const lowRatio = ratioAtExtreme(bar, "low");
    const sides: Array<["high" | "low", number | null]> = settings.ratioMode === "high"
      ? [["high", highRatio]]
      : settings.ratioMode === "low"
        ? [["low", lowRatio]]
        : bar.close < bar.open
          ? [["high", highRatio]]
          : bar.close > bar.open
            ? [["low", lowRatio]]
            : [];
    for (const [side, ratio] of sides) {
      if (!accepted(ratio, settings)) continue;
      markers.push({
        id: `ratio-highlight:${bar.id}:${side}`,
        startTime: bar.startTime,
        endTime: bar.endTime,
        side,
        ratio: ratio!,
      });
    }
  }

  const latest = bars.at(-1);
  return {
    instrument,
    status: latest && !latest.isClosed ? "LIVE" : "HISTORICAL",
    markers,
  };
}
