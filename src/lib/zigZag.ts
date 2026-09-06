import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";
import type { ZigZagRetracementOptions } from "@/lib/zigZagRetracementPrimitive";

export type ZigZagMode = "highest-lowest" | "absolute-reversal" | "tick-reversal";

export const ZIG_ZAG_DEFAULTS = {
  zigZagMode: "highest-lowest" as ZigZagMode,
  absoluteReversalPercent: 0.5,
  tickReversalOrLookback: 10,
  lineWidth: 2,
  lineStyle: "solid",
  shortName: "Zig Zag",
  useThemeColors: true,
  upColor: "#4ADE80",
  downColor: "#EF4444",
  retracementBackgroundColor: "#5f6425",
  retracementFontSize: 11,
  retracementTextColor: "#FFFFFF",
  retracementLineWidth: 1,
  retracementLineColor: "#9CA3AF",
  showRetracement38: true,
  showRetracement50: true,
  showRetracement62: true,
  showRetracement75: false,
  extendRight: false,
} as const;

export const ZIG_ZAG_NUMERIC_SETTINGS = [
  { key: "absoluteReversalPercent", label: "Absolute reversal (%)", defaultValue: 0.5, min: 0.01, max: 100, step: 0.01 },
  { key: "tickReversalOrLookback", label: "Tick reversal / highest-lowest", defaultValue: 10, min: 1, max: 10000, step: 1 },
  { key: "lineWidth", label: "Zig Zag line width", defaultValue: 2, min: 1, max: 4, step: 1 },
  { key: "retracementFontSize", label: "Retracement font size", defaultValue: 11, min: 6, max: 40, step: 0.5 },
  { key: "retracementLineWidth", label: "Retracement line width", defaultValue: 1, min: 1, max: 4, step: 1 },
] as const;

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  Math.min(max, Math.max(min, finite(value, fallback)));

export function normalizeZigZagSettings(raw: Record<string, unknown> = {}) {
  const mode = String(raw.zigZagMode ?? ZIG_ZAG_DEFAULTS.zigZagMode);
  const lineStyle = String(raw.lineStyle ?? ZIG_ZAG_DEFAULTS.lineStyle);
  return {
    ...ZIG_ZAG_DEFAULTS,
    ...raw,
    zigZagMode: (["highest-lowest", "absolute-reversal", "tick-reversal"].includes(mode)
      ? mode : ZIG_ZAG_DEFAULTS.zigZagMode) as ZigZagMode,
    absoluteReversalPercent: clamp(raw.absoluteReversalPercent, 0.01, 100, 0.5),
    tickReversalOrLookback: Math.round(clamp(raw.tickReversalOrLookback, 1, 10000, 10)),
    lineWidth: Math.round(clamp(raw.lineWidth, 1, 4, 2)) as 1 | 2 | 3 | 4,
    retracementFontSize: clamp(raw.retracementFontSize, 6, 40, 11),
    retracementLineWidth: Math.round(clamp(raw.retracementLineWidth, 1, 4, 1)) as 1 | 2 | 3 | 4,
    lineStyle: (["solid", "dashed", "dotted"].includes(lineStyle) ? lineStyle : "solid") as "solid" | "dashed" | "dotted",
    shortName: typeof raw.shortName === "string" ? raw.shortName.slice(0, 80) : "Zig Zag",
    useThemeColors: raw.useThemeColors !== false,
    showRetracement38: raw.showRetracement38 !== false,
    showRetracement50: raw.showRetracement50 !== false,
    showRetracement62: raw.showRetracement62 !== false,
    showRetracement75: raw.showRetracement75 === true,
    extendRight: raw.extendRight === true,
  };
}

export type ZigZagPivot = { index: number; time: number; value: number; kind: "high" | "low"; provisional?: boolean };

function reversalPivots(candles: Candle[], amount: (candidate: number) => number): ZigZagPivot[] {
  if (candles.length < 2) return [];
  let highest = 0, lowest = 0;
  let direction: "up" | "down" | null = null;
  const pivots: ZigZagPivot[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    if (candles[i].high >= candles[highest].high) highest = i;
    if (candles[i].low <= candles[lowest].low) lowest = i;
    if (direction === null) {
      if (candles[highest].high - candles[i].low >= amount(candles[highest].high)) {
        const start = lowest < highest ? lowest : 0;
        if (start < highest) pivots.push({ index: start, time: candles[start].timestamp / 1000, value: candles[start].low, kind: "low" });
        pivots.push({ index: highest, time: candles[highest].timestamp / 1000, value: candles[highest].high, kind: "high" });
        direction = "down"; lowest = i;
      } else if (candles[i].high - candles[lowest].low >= amount(candles[lowest].low)) {
        const start = highest < lowest ? highest : 0;
        if (start < lowest) pivots.push({ index: start, time: candles[start].timestamp / 1000, value: candles[start].high, kind: "high" });
        pivots.push({ index: lowest, time: candles[lowest].timestamp / 1000, value: candles[lowest].low, kind: "low" });
        direction = "up"; highest = i;
      }
      continue;
    }
    if (direction === "up" && candles[highest].high - candles[i].low >= amount(candles[highest].high)) {
      pivots.push({ index: highest, time: candles[highest].timestamp / 1000, value: candles[highest].high, kind: "high" });
      direction = "down"; lowest = i; highest = i;
    } else if (direction === "down" && candles[i].high - candles[lowest].low >= amount(candles[lowest].low)) {
      pivots.push({ index: lowest, time: candles[lowest].timestamp / 1000, value: candles[lowest].low, kind: "low" });
      direction = "up"; highest = i; lowest = i;
    }
  }
  if (direction) {
    const index = direction === "up" ? highest : lowest;
    const kind = direction === "up" ? "high" : "low";
    pivots.push({ index, time: candles[index].timestamp / 1000, value: kind === "high" ? candles[index].high : candles[index].low, kind, provisional: true });
  }
  return pivots;
}

function highestLowestPivots(candles: Candle[], confirmationBars: number): ZigZagPivot[] {
  if (candles.length < 2) return [];
  let high = 0, low = 0;
  let direction: "up" | "down" | null = null;
  const pivots: ZigZagPivot[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    if (candles[i].high >= candles[high].high) high = i;
    if (candles[i].low <= candles[low].low) low = i;
    if (direction === null) {
      if (i - high >= confirmationBars) {
        if (low < high) pivots.push({ index: low, time: candles[low].timestamp / 1000, value: candles[low].low, kind: "low" });
        pivots.push({ index: high, time: candles[high].timestamp / 1000, value: candles[high].high, kind: "high" });
        direction = "down"; low = i;
      } else if (i - low >= confirmationBars) {
        if (high < low) pivots.push({ index: high, time: candles[high].timestamp / 1000, value: candles[high].high, kind: "high" });
        pivots.push({ index: low, time: candles[low].timestamp / 1000, value: candles[low].low, kind: "low" });
        direction = "up"; high = i;
      }
    } else if (direction === "up" && i - high >= confirmationBars) {
      pivots.push({ index: high, time: candles[high].timestamp / 1000, value: candles[high].high, kind: "high" });
      direction = "down"; low = i;
    } else if (direction === "down" && i - low >= confirmationBars) {
      pivots.push({ index: low, time: candles[low].timestamp / 1000, value: candles[low].low, kind: "low" });
      direction = "up"; high = i;
    }
  }
  const index = direction === "down" ? low : high;
  const kind = direction === "down" ? "low" : "high";
  if (!pivots.length || pivots.at(-1)?.index !== index) {
    pivots.push({ index, time: candles[index].timestamp / 1000, value: kind === "high" ? candles[index].high : candles[index].low, kind, provisional: true });
  }
  return pivots.filter((pivot, i) => i === 0 || pivot.index > pivots[i - 1].index);
}

export function calculateZigZagPivots(candles: Candle[], raw: Record<string, unknown>, tickSize?: number) {
  const settings = normalizeZigZagSettings(raw);
  if (settings.zigZagMode === "highest-lowest") return highestLowestPivots(candles, settings.tickReversalOrLookback);
  if (settings.zigZagMode === "tick-reversal") {
    const validTick = Number.isFinite(tickSize) && (tickSize ?? 0) > 0 ? tickSize! : 0;
    if (!validTick) return [];
    return reversalPivots(candles, () => settings.tickReversalOrLookback * validTick);
  }
  return reversalPivots(candles, candidate => Math.abs(candidate) * settings.absoluteReversalPercent / 100);
}

export function calculateZigZag(
  candles: Candle[], raw: Record<string, unknown>, theme: IndicatorTheme, tickSize: number | undefined, instanceId: string,
): CalculatedIndicatorSeries[] {
  const settings = normalizeZigZagSettings(raw);
  const pivots = calculateZigZagPivots(candles, settings, tickSize);
  if (pivots.length < 2) return [];
  const useTheme = settings.useThemeColors;
  const upColor = useTheme ? theme.positive : String(settings.upColor);
  const downColor = useTheme ? theme.negative : String(settings.downColor);
  const up: CalculatedIndicatorSeries["data"] = [];
  const down: CalculatedIndicatorSeries["data"] = [];
  for (let i = 1; i < pivots.length; i += 1) {
    const from = pivots[i - 1], to = pivots[i];
    const target = to.value >= from.value ? up : down;
    target.push({ time: from.time, value: from.value, breakBefore: target.length > 0 }, { time: to.time, value: to.value });
  }
  const from = pivots.at(-2)!, to = pivots.at(-1)!;
  const levels = [
    settings.showRetracement38 && { ratio: 0.382, label: "38.2" },
    settings.showRetracement50 && { ratio: 0.5, label: "50" },
    settings.showRetracement62 && { ratio: 0.618, label: "61.8" },
    settings.showRetracement75 && { ratio: 0.75, label: "75" },
  ].filter(Boolean).map(level => ({ ...level as { ratio: number; label: string }, value: to.value + (from.value - to.value) * (level as { ratio: number }).ratio }));
  const retracements: ZigZagRetracementOptions = {
    startTime: from.time, endTime: to.time, levels, extendRight: settings.extendRight,
    fontSize: settings.retracementFontSize, lineWidth: settings.retracementLineWidth,
    lineColor: useTheme ? theme.secondary : String(settings.retracementLineColor),
    textColor: useTheme ? theme.primary : String(settings.retracementTextColor),
    backgroundColor: useTheme ? theme.muted : String(settings.retracementBackgroundColor),
  };
  const common = { label: settings.shortName || "Zig Zag", kind: "line" as const, placement: "overlay" as const,
    lineWidth: settings.lineWidth, lineStyle: settings.lineStyle, pointMarkersVisible: false, lastValueVisible: false };
  return [
    { ...common, key: `${instanceId}-zig-zag-up`, color: upColor, data: up },
    { ...common, key: `${instanceId}-zig-zag-down`, color: downColor, data: down },
    { ...common, key: `${instanceId}-zig-zag-retracement`, color: useTheme ? theme.secondary : String(settings.retracementLineColor),
      lineVisible: false, excludeFromAutoScale: true, data: [{ time: to.time, value: to.value }], zigZagRetracements: retracements },
  ];
}
