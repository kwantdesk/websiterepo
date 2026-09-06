import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import { resolveVolumeProfileGradient } from "./volumeProfileGradients";

export const PARABOLIC_SAR_DEFAULTS = {
  accelerationStep: 0.02, accelerationMaximum: 0.2, lineWidth: 1,
  displayStyle: "points", lineStyle: "solid", secondaryColorEnabled: false,
  useSecondaryAxis: false, useThemeColors: true,
};

/** Explicit seed: first directional move, ties long; first prior extreme.
 * No value is emitted for the first bar. A reversal resets acceleration.
 * The projected next stop is constrained by the two most recent extremes.
 * This is documented Wilder-style SAR, not recovered DeepCharts IL.
 */
export function calculateParabolicSar(
  candles: readonly Candle[], settings: Record<string, unknown>, theme: IndicatorTheme,
  instanceId: string,
): CalculatedIndicatorSeries[] {
  const bounded = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Number(value ?? fallback);
    return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
  };
  const maximum = bounded(settings.accelerationMaximum, 0.2, 0, 1);
  const step = Math.min(maximum, bounded(settings.accelerationStep, 0.02, 0, 1));
  const gradient = resolveVolumeProfileGradient(settings.gradientPreset);
  const custom = (key: string, fallback: string) => settings.useThemeColors === false
    && typeof settings[key] === "string" && String(settings[key]).trim() ? String(settings[key]) : fallback;
  const primary = gradient?.from ?? custom("plotColor", theme.primary);
  const secondary = gradient?.to ?? custom("secondaryColor", theme.secondary);
  const data: CalculatedIndicatorSeries["data"] = [];
  let previous: Candle | null = null;
  let initialized = false, long = true, stop = 0, extreme = 0, acceleration = step;
  let lastTimestamp = -Infinity, breakPending = false;
  for (const candle of candles) {
    if (![candle.timestamp, candle.high, candle.low].every(Number.isFinite)
      || candle.high < candle.low || candle.timestamp <= lastTimestamp) {
      previous = null; initialized = false; breakPending = true;
      continue;
    }
    lastTimestamp = candle.timestamp;
    if (!previous) { previous = candle; continue; }
    let clampBar = previous;
    if (!initialized) {
      const up = candle.high - previous.high, down = previous.low - candle.low;
      long = !(down > 0 && down > up);
      stop = long ? previous.low : previous.high;
      extreme = long ? candle.high : candle.low;
      acceleration = step;
      initialized = true;
      // The second bar establishes the initial trend; subsequent projections
      // use both available extremes without looking ahead to the next bar.
      clampBar = candle;
    }
    const reversal = long ? candle.low <= stop : candle.high >= stop;
    if (reversal) {
      long = !long;
      stop = long ? Math.min(extreme, clampBar.low, candle.low)
        : Math.max(extreme, clampBar.high, candle.high);
      extreme = long ? candle.high : candle.low;
      acceleration = step;
    }
    data.push({ time: candle.timestamp / 1000, value: stop,
      color: settings.secondaryColorEnabled === true && !long ? secondary : primary,
      ...(breakPending ? { breakBefore: true } : {}),
    });
    breakPending = false;
    if (!reversal && (long ? candle.high > extreme : candle.low < extreme)) {
      extreme = long ? candle.high : candle.low;
      acceleration = Math.min(maximum, acceleration + step);
    }
    const projected = stop + acceleration * (extreme - stop);
    stop = long ? Math.min(projected, clampBar.low, candle.low)
      : Math.max(projected, clampBar.high, candle.high);
    previous = candle;
  }
  if (!data.length) return [];
  const style = settings.displayStyle ?? "points";
  return [{ key: "parabolic-sar", label: "Parabolic SAR", kind: "line", placement: "overlay",
    color: primary, lineWidth: Math.round(bounded(settings.lineWidth, 1, 1, 4)) as 1 | 2 | 3 | 4,
    lineStyle: settings.lineStyle === "dashed" || settings.lineStyle === "dotted" ? settings.lineStyle : "solid",
    pointMarkersVisible: style !== "line", lineVisible: style !== "points",
    lastValueVisible: false,
    priceScaleId: settings.useSecondaryAxis === true ? `sar-${instanceId}` : "right",
    independentScale: settings.useSecondaryAxis === true,
    data,
  }];
}
