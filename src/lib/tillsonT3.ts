import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import { indicatorInstrumentKind } from "./indicatorInstrumentCompatibility";
import { resolveVolumeProfileGradient } from "./volumeProfileGradients";

export const TILLSON_T3_DEFAULTS = {
  length: 14, volumeFactor: 0.618, inputData: "close", colorMode: "slope",
  displayStyle: "line", lineStyle: "solid", lineWidth: 1, shortName: "T3",
  useSecondaryAxis: false, useThemeColors: true,
};

export function tillsonT3Name(settings: Record<string, unknown> = {}): string {
  return typeof settings.shortName === "string" ? settings.shortName.trim().slice(0, 40) || "T3" : "T3";
}

/** T3 = three generalized double-EMA stages, expanded over six EMA states.
 * Each EMA seeds with its own complete N-sample mean. First output index is
 * 6*(N-1); this explicit convention is not a recovered DeepCharts seed.
 */
export function calculateTillsonT3(
  candles: readonly Candle[], settings: Record<string, unknown>, theme: IndicatorTheme,
  instanceId: string, instrument?: string,
): CalculatedIndicatorSeries[] {
  const bounded = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Number(value ?? fallback);
    return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
  };
  const length = Math.floor(bounded(settings.length, 14, 1, 1000));
  const factor = bounded(settings.volumeFactor, 0.618, 0, 1);
  const source = String(settings.inputData ?? "close");
  if (!["close", "open", "high", "low", "volume"].includes(source)) return [];
  if (source === "volume" && instrument && indicatorInstrumentKind(instrument) === "cash-index") return [];
  const gradient = resolveVolumeProfileGradient(settings.gradientPreset);
  const pick = (key: string, fallback: string) => settings.useThemeColors === false
    && typeof settings[key] === "string" && String(settings[key]).trim() ? String(settings[key]) : fallback;
  const primary = gradient?.from ?? pick("plotColor", theme.primary);
  const secondary = gradient?.to ?? pick("secondaryColor", theme.secondary);
  const state = new Float64Array(6), count = new Uint32Array(6);
  const alpha = 2 / (length + 1);
  const data: CalculatedIndicatorSeries["data"] = [];
  let origin = 0, lastTimestamp = -Infinity, previousValue: number | null = null, breakPending = false;
  for (const candle of candles) {
    const raw = candle[source as "close" | "open" | "high" | "low" | "volume"];
    if (!Number.isFinite(candle.timestamp) || candle.timestamp <= lastTimestamp
      || typeof raw !== "number" || !Number.isFinite(raw) || (source === "volume" && raw < 0)) {
      state.fill(0); count.fill(0); previousValue = null; breakPending = true;
      continue;
    }
    lastTimestamp = candle.timestamp;
    if (count[0] === 0) origin = raw;
    let value = raw - origin, ready = true;
    for (let stage = 0; stage < 6; stage++) {
      if (count[stage] < length) {
        state[stage] += value;
        if (++count[stage] < length) { ready = false; break; }
        state[stage] /= length;
      } else state[stage] += alpha * (value - state[stage]);
      value = state[stage];
    }
    if (!ready) continue;
    const e3 = state[2], e4 = state[3], e5 = state[4], e6 = state[5];
    // Difference form preserves constants and reduces cancellation on prices
    // with large offsets. N=1 is exactly the input, not a rounded near-copy.
    value = length === 1 ? raw : origin + e3 + 3 * factor * (e3 - e4)
      + 3 * factor ** 2 * (e3 - 2 * e4 + e5)
      + factor ** 3 * (e3 - 3 * e4 + 3 * e5 - e6);
    if (!Number.isFinite(value)) { breakPending = true; continue; }
    data.push({ time: candle.timestamp / 1000, value,
      color: settings.colorMode !== "none" && previousValue !== null && value < previousValue ? secondary : primary,
      ...(breakPending ? { breakBefore: true } : {}),
    });
    previousValue = value; breakPending = false;
  }
  if (!data.length) return [];
  const independent = source === "volume" || settings.useSecondaryAxis === true;
  const style = settings.displayStyle ?? "line";
  return [{ key: "tillson-t3", label: tillsonT3Name(settings), kind: "line", placement: "overlay", color: primary,
    lineWidth: Math.round(bounded(settings.lineWidth, 1, 1, 4)) as 1 | 2 | 3 | 4,
    lineStyle: settings.lineStyle === "dashed" || settings.lineStyle === "dotted" ? settings.lineStyle : "solid",
    pointMarkersVisible: style !== "line", lineVisible: style !== "points", lastValueVisible: false,
    independentScale: independent, priceScaleId: independent ? `t3-${instanceId}` : "right", data,
  }];
}
