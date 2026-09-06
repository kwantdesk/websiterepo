import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import { indicatorInstrumentKind } from "./indicatorInstrumentCompatibility";
import { resolveVolumeProfileGradient } from "./volumeProfileGradients";

export const LINEAR_REGRESSION_DEFAULTS = {
  length: 21, inputData: "close", displayStyle: "line", lineStyle: "solid",
  lineWidth: 1, secondaryColorEnabled: false, useSecondaryAxis: false, useThemeColors: true,
};

/** Rolling least-squares endpoint, not a future forecast or whole-window repaint.
 * Ring-buffer sums are centered and rebuilt once per length slides, bounding
 * floating point drift while retaining amortized O(n) work and O(length) state.
 */
export function calculateLinearRegression(
  candles: readonly Candle[], settings: Record<string, unknown>, theme: IndicatorTheme,
  instanceId: string, instrument?: string,
): CalculatedIndicatorSeries[] {
  const requestedLength = Number(settings.length ?? 21);
  const length = Math.min(10000, Math.max(1, Math.floor(Number.isFinite(requestedLength) ? requestedLength : 21)));
  const input = String(settings.inputData ?? "close");
  if (!["close", "open", "high", "low", "volume"].includes(input)) return [];
  if (input === "volume" && instrument && indicatorInstrumentKind(instrument) === "cash-index") return [];
  const gradient = resolveVolumeProfileGradient(settings.gradientPreset);
  const pick = (key: string, fallback: string) => settings.useThemeColors === false
    && typeof settings[key] === "string" && String(settings[key]).trim() ? String(settings[key]) : fallback;
  const primary = gradient?.from ?? pick("plotColor", theme.primary);
  const secondary = gradient?.to ?? pick("secondaryColor", theme.secondary);
  const ring = new Float64Array(length);
  const data: CalculatedIndicatorSeries["data"] = [];
  const meanX = (length - 1) / 2;
  const xVarianceSum = length * (length * length - 1) / 12;
  let count = 0, cursor = 0, slides = 0, base = 0, sum = 0, weighted = 0;
  let lastTimestamp = -Infinity, breakPending = false;
  for (const candle of candles) {
    const raw = candle[input as "close" | "open" | "high" | "low" | "volume"];
    if (!Number.isFinite(candle.timestamp) || candle.timestamp <= lastTimestamp
      || typeof raw !== "number" || !Number.isFinite(raw) || (input === "volume" && raw < 0)) {
      count = 0; cursor = 0; slides = 0; sum = 0; weighted = 0; breakPending = true;
      continue;
    }
    lastTimestamp = candle.timestamp;
    if (!count) base = raw;
    const centered = raw - base;
    if (count < length) {
      ring[count] = raw;
      sum += centered; weighted += count * centered; count++;
    } else {
      const old = ring[cursor] - base;
      weighted = weighted - (sum - old) + (length - 1) * centered;
      sum += centered - old;
      ring[cursor] = raw;
      cursor = (cursor + 1) % length;
      if (++slides >= length) {
        base = ring[cursor]; sum = 0; weighted = 0; slides = 0;
        for (let j = 0; j < length; j++) {
          const value = ring[(cursor + j) % length] - base;
          sum += value; weighted += j * value;
        }
      }
    }
    if (count < length) continue;
    const slope = length === 1 ? 0 : (weighted - meanX * sum) / xVarianceSum;
    const value = base + sum / length + slope * meanX;
    if (!Number.isFinite(value) || !Number.isFinite(slope)) { breakPending = true; continue; }
    data.push({ time: candle.timestamp / 1000, value,
      color: settings.secondaryColorEnabled === true && slope < 0 ? secondary : primary,
      ...(breakPending ? { breakBefore: true } : {}),
    });
    breakPending = false;
  }
  if (!data.length) return [];
  const requestedWidth = Number(settings.lineWidth ?? 1);
  const independent = input === "volume" || settings.useSecondaryAxis === true;
  const style = settings.displayStyle ?? "line";
  return [{ key: "linear-regression", label: `Linear Regression (${input})`, kind: "line", placement: "overlay",
    color: primary, lineWidth: Math.max(1, Math.min(4, Math.round(Number.isFinite(requestedWidth) ? requestedWidth : 1))) as 1 | 2 | 3 | 4,
    lineStyle: settings.lineStyle === "dashed" || settings.lineStyle === "dotted" ? settings.lineStyle : "solid",
    pointMarkersVisible: style !== "line", lineVisible: style !== "points", lastValueVisible: false,
    independentScale: independent, priceScaleId: independent ? `regression-${instanceId}` : "right", data,
  }];
}
