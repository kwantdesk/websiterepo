import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";
import type { IchimokuCloudOptions } from "@/lib/ichimokuCloudPrimitive";

export type IchimokuLineStyle = "solid" | "dashed" | "dotted";

export const ICHIMOKU_SETTINGS_VERSION = 1;
export const ICHIMOKU_DEFAULTS = {
  conversionLinePeriod: 9,
  baseLinePeriod: 26,
  laggingSpanPeriod: 52,
  tenkanLineWidth: 1,
  kijunLineWidth: 1,
  chikouLineWidth: 1,
  senkouLineWidth: 1,
  tenkanLineStyle: "solid",
  kijunLineStyle: "solid",
  chikouLineStyle: "solid",
  senkouLineStyle: "solid",
  tenkanShortName: "Tenkan Sen",
  kijunShortName: "Kijun Sen",
  chikouShortName: "Chikou Span",
  senkouShortName: "Senkou Span",
  tenkanNameLabel: false,
  tenkanValueLabel: false,
  kijunNameLabel: false,
  kijunValueLabel: false,
  chikouNameLabel: false,
  chikouValueLabel: false,
  senkouNameLabel: false,
  senkouValueLabel: false,
  tenkanIncludeOnAutoCenter: true,
  kijunIncludeOnAutoCenter: true,
  chikouIncludeOnAutoCenter: true,
  senkouIncludeOnAutoCenter: true,
  showCloud: true,
  cloudOpacity: 14,
  useSecondaryAxis: false,
  useThemeColors: true,
  tenkanColor: "#2563EB",
  kijunColor: "#EF4444",
  chikouColor: "#22C55E",
  senkouColor: "#22C55E",
  senkouSecondaryColor: "#EF4444",
  bullishCloudColor: "#22C55E",
  bearishCloudColor: "#EF4444",
  ichimokuSettingsVersion: ICHIMOKU_SETTINGS_VERSION,
} as const;

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const integer = (value: unknown, fallback: number, min = 1, max = 1_000) =>
  Math.round(Math.min(max, Math.max(min, finite(value, fallback))));
const width = (value: unknown) => integer(value, 1, 1, 4) as 1 | 2 | 3 | 4;
const style = (value: unknown): IchimokuLineStyle =>
  value === "dashed" || value === "dotted" ? value : "solid";
const color = (value: unknown, fallback: string) =>
  /^#[\da-f]{6}$/i.test(String(value ?? "")) ? String(value).toUpperCase() : fallback;
const shortName = (value: unknown, fallback: string) => String(value || fallback).trim().slice(0, 40) || fallback;

export function normalizeIchimokuSettings(raw: Record<string, unknown> = {}) {
  const merged: Record<string, unknown> = { ...ICHIMOKU_DEFAULTS, ...raw };
  return {
    conversionLinePeriod: integer(merged.conversionLinePeriod, 9),
    baseLinePeriod: integer(merged.baseLinePeriod, 26),
    laggingSpanPeriod: integer(merged.laggingSpanPeriod, 52),
    tenkanLineWidth: width(merged.tenkanLineWidth),
    kijunLineWidth: width(merged.kijunLineWidth),
    chikouLineWidth: width(merged.chikouLineWidth),
    senkouLineWidth: width(merged.senkouLineWidth),
    tenkanLineStyle: style(merged.tenkanLineStyle),
    kijunLineStyle: style(merged.kijunLineStyle),
    chikouLineStyle: style(merged.chikouLineStyle),
    senkouLineStyle: style(merged.senkouLineStyle),
    tenkanShortName: shortName(merged.tenkanShortName, "Tenkan Sen"),
    kijunShortName: shortName(merged.kijunShortName, "Kijun Sen"),
    chikouShortName: shortName(merged.chikouShortName, "Chikou Span"),
    senkouShortName: shortName(merged.senkouShortName, "Senkou Span"),
    tenkanNameLabel: merged.tenkanNameLabel === true,
    tenkanValueLabel: merged.tenkanValueLabel === true,
    kijunNameLabel: merged.kijunNameLabel === true,
    kijunValueLabel: merged.kijunValueLabel === true,
    chikouNameLabel: merged.chikouNameLabel === true,
    chikouValueLabel: merged.chikouValueLabel === true,
    senkouNameLabel: merged.senkouNameLabel === true,
    senkouValueLabel: merged.senkouValueLabel === true,
    tenkanIncludeOnAutoCenter: merged.tenkanIncludeOnAutoCenter !== false,
    kijunIncludeOnAutoCenter: merged.kijunIncludeOnAutoCenter !== false,
    chikouIncludeOnAutoCenter: merged.chikouIncludeOnAutoCenter !== false,
    senkouIncludeOnAutoCenter: merged.senkouIncludeOnAutoCenter !== false,
    showCloud: merged.showCloud !== false,
    cloudOpacity: integer(merged.cloudOpacity, 14, 0, 100),
    useSecondaryAxis: merged.useSecondaryAxis === true,
    useThemeColors: merged.useThemeColors !== false,
    tenkanColor: color(merged.tenkanColor, ICHIMOKU_DEFAULTS.tenkanColor),
    kijunColor: color(merged.kijunColor, ICHIMOKU_DEFAULTS.kijunColor),
    chikouColor: color(merged.chikouColor, ICHIMOKU_DEFAULTS.chikouColor),
    senkouColor: color(merged.senkouColor, ICHIMOKU_DEFAULTS.senkouColor),
    senkouSecondaryColor: color(merged.senkouSecondaryColor, ICHIMOKU_DEFAULTS.senkouSecondaryColor),
    bullishCloudColor: color(merged.bullishCloudColor, ICHIMOKU_DEFAULTS.bullishCloudColor),
    bearishCloudColor: color(merged.bearishCloudColor, ICHIMOKU_DEFAULTS.bearishCloudColor),
    ichimokuSettingsVersion: ICHIMOKU_SETTINGS_VERSION,
  };
}

function rollingMidpoint(candles: Candle[], length: number) {
  const output = Array<number | null>(candles.length).fill(null);
  const highs: number[] = [];
  const lows: number[] = [];
  let highHead = 0;
  let lowHead = 0;
  for (let index = 0; index < candles.length; index += 1) {
    const first = index - length + 1;
    while (highHead < highs.length && highs[highHead] < first) highHead += 1;
    while (lowHead < lows.length && lows[lowHead] < first) lowHead += 1;
    while (highs.length > highHead && candles[highs.at(-1)!].high <= candles[index].high) highs.pop();
    while (lows.length > lowHead && candles[lows.at(-1)!].low >= candles[index].low) lows.pop();
    highs.push(index);
    lows.push(index);
    if (index >= length - 1) output[index] = (candles[highs[highHead]].high + candles[lows[lowHead]].low) / 2;
    if (highHead > 2_048) { highs.splice(0, highHead); highHead = 0; }
    if (lowHead > 2_048) { lows.splice(0, lowHead); lowHead = 0; }
  }
  return output;
}

const medianInterval = (candles: Candle[]) => {
  const differences = candles.slice(Math.max(1, candles.length - 101)).map((candle, index, tail) =>
    index ? candle.timestamp - tail[index - 1].timestamp : 0).filter(value => value > 0).sort((a, b) => a - b);
  return differences.length ? differences[Math.floor(differences.length / 2)] : 60_000;
};

export function ichimokuValues(candles: Candle[], raw: Record<string, unknown> = {}) {
  const settings = normalizeIchimokuSettings(raw);
  const tenkan = rollingMidpoint(candles, settings.conversionLinePeriod);
  const kijun = rollingMidpoint(candles, settings.baseLinePeriod);
  const spanBSource = rollingMidpoint(candles, settings.laggingSpanPeriod);
  const interval = medianInterval(candles);
  const lastTime = candles.at(-1)?.timestamp ?? 0;
  const projectedTime = (targetIndex: number) => targetIndex < candles.length
    ? candles[targetIndex].timestamp
    : lastTime + (targetIndex - candles.length + 1) * interval;
  const spanA: Array<{ time: number; value: number }> = [];
  const spanB: Array<{ time: number; value: number }> = [];
  const chikou: Array<{ time: number; value: number }> = [];
  for (let index = 0; index < candles.length; index += 1) {
    if (tenkan[index] != null && kijun[index] != null) {
      spanA.push({ time: projectedTime(index + settings.baseLinePeriod), value: (tenkan[index]! + kijun[index]!) / 2 });
    }
    if (spanBSource[index] != null) {
      spanB.push({ time: projectedTime(index + settings.baseLinePeriod), value: spanBSource[index]! });
    }
    if (index >= settings.baseLinePeriod) {
      chikou.push({ time: candles[index - settings.baseLinePeriod].timestamp, value: candles[index].close });
    }
  }
  return { tenkan, kijun, chikou, spanA, spanB };
}

const label = (name: string, showName: boolean) => showName ? name : "";
const lineData = (candles: Candle[], values: Array<number | null>) => values.flatMap((value, index) =>
  value == null || !Number.isFinite(value) ? [] : [{ time: candles[index].timestamp / 1_000, value }]);

export function calculateIchimoku(
  candles: Candle[], raw: Record<string, unknown>, theme: IndicatorTheme, instanceId: string,
): CalculatedIndicatorSeries[] {
  const settings = normalizeIchimokuSettings(raw);
  const values = ichimokuValues(candles, settings);
  const secondary = settings.useSecondaryAxis ? `ichimoku-${instanceId}` : undefined;
  const colors = settings.useThemeColors ? {
    tenkan: theme.primary, kijun: theme.negative, chikou: theme.secondary,
    senkou: theme.positive, senkouB: theme.negative,
    bull: theme.positive, bear: theme.negative,
  } : {
    tenkan: settings.tenkanColor, kijun: settings.kijunColor, chikou: settings.chikouColor,
    senkou: settings.senkouColor, senkouB: settings.senkouSecondaryColor,
    bull: settings.bullishCloudColor, bear: settings.bearishCloudColor,
  };
  const spanBByTime = new Map(values.spanB.map((point) => [point.time, point.value]));
  const cloud: IchimokuCloudOptions = {
    points: values.spanA.map((point) => ({
      time: point.time / 1_000,
      spanA: point.value,
      spanB: spanBByTime.get(point.time) ?? Number.NaN,
    })).filter(point => Number.isFinite(point.spanB)),
    bullishColor: colors.bull,
    bearishColor: colors.bear,
    opacity: settings.showCloud ? settings.cloudOpacity / 100 : 0,
  };
  return [
    { key: `${instanceId}-tenkan`, groupKey: instanceId, label: label(settings.tenkanShortName, settings.tenkanNameLabel), kind: "line", placement: "overlay", color: colors.tenkan, lineWidth: settings.tenkanLineWidth, lineStyle: settings.tenkanLineStyle, lastValueVisible: settings.tenkanValueLabel, excludeFromAutoScale: !settings.tenkanIncludeOnAutoCenter, priceScaleId: secondary, data: lineData(candles, values.tenkan) },
    { key: `${instanceId}-kijun`, groupKey: instanceId, label: label(settings.kijunShortName, settings.kijunNameLabel), kind: "line", placement: "overlay", color: colors.kijun, lineWidth: settings.kijunLineWidth, lineStyle: settings.kijunLineStyle, lastValueVisible: settings.kijunValueLabel, excludeFromAutoScale: !settings.kijunIncludeOnAutoCenter, priceScaleId: secondary, data: lineData(candles, values.kijun) },
    { key: `${instanceId}-chikou`, groupKey: instanceId, label: label(settings.chikouShortName, settings.chikouNameLabel), kind: "line", placement: "overlay", color: colors.chikou, lineWidth: settings.chikouLineWidth, lineStyle: settings.chikouLineStyle, lastValueVisible: settings.chikouValueLabel, excludeFromAutoScale: !settings.chikouIncludeOnAutoCenter, priceScaleId: secondary, data: values.chikou.map(point => ({ time: point.time / 1_000, value: point.value })) },
    { key: `${instanceId}-senkou-a`, groupKey: instanceId, label: label(`${settings.senkouShortName} A`, settings.senkouNameLabel), kind: "line", placement: "overlay", color: colors.senkou, lineWidth: settings.senkouLineWidth, lineStyle: settings.senkouLineStyle, lastValueVisible: settings.senkouValueLabel, excludeFromAutoScale: !settings.senkouIncludeOnAutoCenter, priceScaleId: secondary, ichimokuCloud: cloud, data: values.spanA.map(point => ({ time: point.time / 1_000, value: point.value })) },
    { key: `${instanceId}-senkou-b`, groupKey: instanceId, label: label(`${settings.senkouShortName} B`, settings.senkouNameLabel), kind: "line", placement: "overlay", color: colors.senkouB, lineWidth: settings.senkouLineWidth, lineStyle: settings.senkouLineStyle, lastValueVisible: settings.senkouValueLabel, excludeFromAutoScale: !settings.senkouIncludeOnAutoCenter, priceScaleId: secondary, data: values.spanB.map(point => ({ time: point.time / 1_000, value: point.value })) },
  ];
}
