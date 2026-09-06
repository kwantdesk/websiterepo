import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";

export type InverseCyberCycleSettings = {
  smoothingAlpha: number;
  cycleALength: number;
  cycleBLength: number;
  middleLevel: number;
  lowLevel: number;
  highLevel: number;
  levelWidth: 1 | 2 | 3 | 4;
  cycleALineWidth: 1 | 2 | 3 | 4;
  cycleBLineWidth: 1 | 2 | 3 | 4;
  cycleALineStyle: "solid" | "dashed" | "dotted";
  cycleBLineStyle: "solid" | "dashed" | "dotted";
  cycleAAutoColor: "none" | "slope" | "middle";
  cycleBAutoColor: "none" | "slope" | "middle";
  cycleAShortName: string;
  cycleBShortName: string;
  cycleANameLabel: boolean;
  cycleAValueLabel: boolean;
  cycleBNameLabel: boolean;
  cycleBValueLabel: boolean;
  cycleAIncludeOnAutoCenter: boolean;
  cycleBIncludeOnAutoCenter: boolean;
  useSecondaryAxis: boolean;
  useThemeColors: boolean;
  cycleAColor: string;
  cycleASecondaryColor: string;
  cycleBColor: string;
  cycleBSecondaryColor: string;
  middleLevelColor: string;
  lowLevelColor: string;
  highLevelColor: string;
};

export const INVERSE_CYBER_CYCLE_SETTINGS_VERSION = 1;

export const INVERSE_CYBER_CYCLE_DEFAULTS = {
  smoothingAlpha: 0.01,
  cycleALength: 21,
  cycleBLength: 84,
  middleLevel: 0,
  lowLevel: -0.6,
  highLevel: 0.6,
  levelWidth: 1,
  cycleALineWidth: 2,
  cycleBLineWidth: 2,
  cycleALineStyle: "solid",
  cycleBLineStyle: "solid",
  cycleAAutoColor: "none",
  cycleBAutoColor: "none",
  cycleAShortName: "CycA",
  cycleBShortName: "CycB",
  cycleANameLabel: false,
  cycleAValueLabel: false,
  cycleAIncludeOnAutoCenter: true,
  cycleBNameLabel: false,
  cycleBValueLabel: false,
  cycleBIncludeOnAutoCenter: true,
  useSecondaryAxis: false,
  useThemeColors: true,
  cycleAColor: "#FDE047",
  cycleASecondaryColor: "#CA8A04",
  cycleBColor: "#D946EF",
  cycleBSecondaryColor: "#BE185D",
  middleLevelColor: "#71717A",
  lowLevelColor: "#71717A",
  highLevelColor: "#71717A",
  inverseCyberCycleSettingsVersion: INVERSE_CYBER_CYCLE_SETTINGS_VERSION,
} as const;

const finite = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value: unknown, fallback: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, finite(value, fallback)));

const width = (value: unknown, fallback: number) =>
  Math.round(clamp(value, fallback, 1, 4)) as 1 | 2 | 3 | 4;

const lineStyle = (value: unknown, fallback: "solid" | "dashed" | "dotted") =>
  value === "dashed" || value === "dotted" || value === "solid" ? value : fallback;

const autoColor = (value: unknown) =>
  value === "slope" || value === "middle" ? value : "none";

const color = (value: unknown, fallback: string) =>
  /^#[\da-f]{6}$/i.test(String(value ?? "")) ? String(value).toUpperCase() : fallback;

export function normalizeInverseCyberCycleSettings(
  raw: Record<string, unknown> = {},
): InverseCyberCycleSettings & { inverseCyberCycleSettingsVersion: number } {
  const merged: Record<string, unknown> = { ...INVERSE_CYBER_CYCLE_DEFAULTS, ...raw };
  let lowLevel = clamp(merged.lowLevel, -0.6, -1, 1);
  let middleLevel = clamp(merged.middleLevel, 0, -1, 1);
  let highLevel = clamp(merged.highLevel, 0.6, -1, 1);
  if (!(lowLevel < middleLevel && middleLevel < highLevel)) {
    lowLevel = -0.6;
    middleLevel = 0;
    highLevel = 0.6;
  }
  return {
    smoothingAlpha: clamp(merged.smoothingAlpha, 0.01, 0.001, 1),
    cycleALength: Math.round(clamp(merged.cycleALength, 21, 5, 2_000)),
    cycleBLength: Math.round(clamp(merged.cycleBLength, 84, 5, 2_000)),
    middleLevel,
    lowLevel,
    highLevel,
    levelWidth: width(merged.levelWidth, 1),
    cycleALineWidth: width(merged.cycleALineWidth, 2),
    cycleBLineWidth: width(merged.cycleBLineWidth, 2),
    cycleALineStyle: lineStyle(merged.cycleALineStyle, "solid"),
    cycleBLineStyle: lineStyle(merged.cycleBLineStyle, "solid"),
    cycleAAutoColor: autoColor(merged.cycleAAutoColor),
    cycleBAutoColor: autoColor(merged.cycleBAutoColor),
    cycleAShortName: String(merged.cycleAShortName || "CycA").trim().slice(0, 32) || "CycA",
    cycleBShortName: String(merged.cycleBShortName || "CycB").trim().slice(0, 32) || "CycB",
    cycleANameLabel: merged.cycleANameLabel === true,
    cycleAValueLabel: merged.cycleAValueLabel === true,
    cycleBNameLabel: merged.cycleBNameLabel === true,
    cycleBValueLabel: merged.cycleBValueLabel === true,
    cycleAIncludeOnAutoCenter: merged.cycleAIncludeOnAutoCenter !== false,
    cycleBIncludeOnAutoCenter: merged.cycleBIncludeOnAutoCenter !== false,
    useSecondaryAxis: merged.useSecondaryAxis === true,
    useThemeColors: merged.useThemeColors !== false,
    cycleAColor: color(merged.cycleAColor, INVERSE_CYBER_CYCLE_DEFAULTS.cycleAColor),
    cycleASecondaryColor: color(merged.cycleASecondaryColor, INVERSE_CYBER_CYCLE_DEFAULTS.cycleASecondaryColor),
    cycleBColor: color(merged.cycleBColor, INVERSE_CYBER_CYCLE_DEFAULTS.cycleBColor),
    cycleBSecondaryColor: color(merged.cycleBSecondaryColor, INVERSE_CYBER_CYCLE_DEFAULTS.cycleBSecondaryColor),
    middleLevelColor: color(merged.middleLevelColor, INVERSE_CYBER_CYCLE_DEFAULTS.middleLevelColor),
    lowLevelColor: color(merged.lowLevelColor, INVERSE_CYBER_CYCLE_DEFAULTS.lowLevelColor),
    highLevelColor: color(merged.highLevelColor, INVERSE_CYBER_CYCLE_DEFAULTS.highLevelColor),
    inverseCyberCycleSettingsVersion: INVERSE_CYBER_CYCLE_SETTINGS_VERSION,
  };
}

/**
 * John Ehlers' four-bar smoothed Cyber Cycle followed by a rolling
 * normalization and inverse Fisher transform.  The two documented lengths
 * own independent normalization windows over the same cycle, producing the
 * faster A and slower B plots while keeping both bounded and comparable.
 */
export function inverseCyberCycleValues(
  candles: Candle[],
  rawSettings: Record<string, unknown> = {},
): { cycleA: Array<number | null>; cycleB: Array<number | null> } {
  const settings = normalizeInverseCyberCycleSettings(rawSettings);
  const prices = candles.map((candle) => {
    const high = finite(candle.high, finite(candle.close, 0));
    const low = finite(candle.low, high);
    return (high + low) / 2;
  });
  const smooth = Array<number>(prices.length).fill(0);
  const cycle = Array<number>(prices.length).fill(0);
  const alpha = settings.smoothingAlpha;
  const feedForward = (1 - 0.5 * alpha) ** 2;
  const feedbackOne = 2 * (1 - alpha);
  const feedbackTwo = (1 - alpha) ** 2;

  for (let index = 0; index < prices.length; index += 1) {
    smooth[index] = index >= 3
      ? (prices[index] + 2 * prices[index - 1] + 2 * prices[index - 2] + prices[index - 3]) / 6
      : prices[index];
    if (index < 2) continue;
    cycle[index] = index < 7
      ? (prices[index] - 2 * prices[index - 1] + prices[index - 2]) / 4
      : feedForward * (smooth[index] - 2 * smooth[index - 1] + smooth[index - 2])
        + feedbackOne * cycle[index - 1] - feedbackTwo * cycle[index - 2];
  }

  const transform = (length: number) => {
    const output = Array<number | null>(cycle.length).fill(null);
    const maxima: number[] = [];
    const minima: number[] = [];
    let maximumHead = 0;
    let minimumHead = 0;
    for (let index = 0; index < cycle.length; index += 1) {
      const first = index - length + 1;
      while (maximumHead < maxima.length && maxima[maximumHead] < first) maximumHead += 1;
      while (minimumHead < minima.length && minima[minimumHead] < first) minimumHead += 1;
      while (maxima.length > maximumHead && cycle[maxima[maxima.length - 1]] <= cycle[index]) maxima.pop();
      while (minima.length > minimumHead && cycle[minima[minima.length - 1]] >= cycle[index]) minima.pop();
      maxima.push(index);
      minima.push(index);
      if (index < length - 1) continue;
      const highest = cycle[maxima[maximumHead]];
      const lowest = cycle[minima[minimumHead]];
      const normalized = highest > lowest
        ? Math.max(-1, Math.min(1, 2 * ((cycle[index] - lowest) / (highest - lowest) - 0.5)))
        : 0;
      output[index] = Math.tanh(normalized);
      // Bound queue storage during deep histories instead of retaining every
      // expired index behind a growing head pointer.
      if (maximumHead > 2_048) { maxima.splice(0, maximumHead); maximumHead = 0; }
      if (minimumHead > 2_048) { minima.splice(0, minimumHead); minimumHead = 0; }
    }
    return output;
  };

  return { cycleA: transform(settings.cycleALength), cycleB: transform(settings.cycleBLength) };
}

function displayLabel(name: string, showName: boolean, showValue: boolean, value: number | null | undefined) {
  const parts = [showName ? name : "", showValue && value != null ? value.toFixed(3) : ""].filter(Boolean);
  return parts.join(" ");
}

export function calculateInverseCyberCycle(
  candles: Candle[],
  rawSettings: Record<string, unknown>,
  theme: IndicatorTheme,
  instanceId: string,
): CalculatedIndicatorSeries[] {
  const settings = normalizeInverseCyberCycleSettings(rawSettings);
  const { cycleA, cycleB } = inverseCyberCycleValues(candles, settings);
  const useTheme = settings.useThemeColors;
  const cycleAColor = useTheme ? theme.primary : settings.cycleAColor;
  const cycleASecondary = useTheme ? theme.secondary : settings.cycleASecondaryColor;
  const cycleBColor = useTheme ? theme.negative : settings.cycleBColor;
  const cycleBSecondary = useTheme ? theme.positive : settings.cycleBSecondaryColor;
  const middleColor = useTheme ? theme.muted : settings.middleLevelColor;
  const lowColor = useTheme ? theme.negative : settings.lowLevelColor;
  const highColor = useTheme ? theme.positive : settings.highLevelColor;

  const data = (
    values: Array<number | null>,
    mode: InverseCyberCycleSettings["cycleAAutoColor"],
    primary: string,
    secondary: string,
  ) => values.flatMap((value, index) => {
    if (value == null || !Number.isFinite(value)) return [];
    const previous = index > 0 ? values[index - 1] : null;
    const pointColor = mode === "middle"
      ? value >= settings.middleLevel ? primary : secondary
      : mode === "slope" && previous != null && value < previous ? secondary : primary;
    return [{ time: candles[index].timestamp / 1_000, value, ...(mode === "none" ? {} : { color: pointColor }) }];
  });
  const cycleAData = data(cycleA, settings.cycleAAutoColor, cycleAColor, cycleASecondary);
  const cycleBData = data(cycleB, settings.cycleBAutoColor, cycleBColor, cycleBSecondary);
  const firstTime = candles.length ? candles[0].timestamp / 1_000 : Number.NaN;
  const reference = (
    key: string,
    label: string,
    value: number,
    plotColor: string,
  ): CalculatedIndicatorSeries => ({
    key: `${instanceId}-${key}`,
    groupKey: instanceId,
    label,
    kind: "line",
    placement: "pane",
    color: plotColor,
    lineWidth: settings.levelWidth,
    lineStyle: "dashed",
    horizontalPriceLine: true,
    lastValueVisible: false,
    data: Number.isFinite(firstTime) ? [{ time: firstTime, value }] : [],
  });

  return [
    {
      key: `${instanceId}-cycle-a`, groupKey: instanceId,
      label: displayLabel(settings.cycleAShortName, settings.cycleANameLabel, settings.cycleAValueLabel, cycleA.at(-1)),
      kind: "line", placement: "pane", color: cycleAColor,
      lineWidth: settings.cycleALineWidth, lineStyle: settings.cycleALineStyle,
      excludeFromAutoScale: !settings.cycleAIncludeOnAutoCenter,
      data: cycleAData,
    },
    {
      key: `${instanceId}-cycle-b`, groupKey: instanceId,
      label: displayLabel(settings.cycleBShortName, settings.cycleBNameLabel, settings.cycleBValueLabel, cycleB.at(-1)),
      kind: "line", placement: "pane", color: cycleBColor,
      lineWidth: settings.cycleBLineWidth, lineStyle: settings.cycleBLineStyle,
      independentScale: settings.useSecondaryAxis,
      excludeFromAutoScale: !settings.cycleBIncludeOnAutoCenter,
      data: cycleBData,
    },
    reference("middle-level", "Middle", settings.middleLevel, middleColor),
    reference("low-level", "Low", settings.lowLevel, lowColor),
    reference("high-level", "High", settings.highLevel, highColor),
  ];
}
