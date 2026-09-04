import type { Candle } from "@/lib/backtester";
import type { FootprintBar } from "@/lib/footprint";

export const DEEP_PATTERN_BUILDER_SETTINGS_VERSION = 1;

export const PATTERN_REFERENCE_OPTIONS = [
  "open", "high", "low", "close", "volume", "range-ticks", "body-ticks",
  "bid-volume", "ask-volume", "total-volume", "bid-trades", "ask-trades",
  "total-trades", "delta-volume", "delta-trades", "poc-percent", "poc-volume",
  "poc-shadow", "cumulative-delta", "sma", "ema", "vwap", "constant", "unused",
] as const;
export type PatternReference = typeof PATTERN_REFERENCE_OPTIONS[number];
export type PatternMathOperator = "+" | "-" | "*" | "/";
export type PatternComparator = ">" | ">=" | "=" | "<>" | "<" | "<=";

export type PatternConditionSettings = {
  enabled: boolean;
  aSource: PatternReference; aOffset: number; aValue: number;
  bSource: PatternReference; bOffset: number; bValue: number;
  leftMath: PatternMathOperator;
  comparator: PatternComparator;
  cSource: PatternReference; cOffset: number; cValue: number;
  dSource: PatternReference; dOffset: number; dValue: number;
  rightMath: PatternMathOperator;
};

export type DeepPatternBuilderSettings = {
  conditions: PatternConditionSettings[];
  combineMode: "and" | "or" | "advanced";
  advancedExpression: string;
  calculateOnClose: boolean;
  minImbalancePercent: number;
  maxImbalancePercent: number;
  plotMode: "marker" | "background" | "both";
  markerPosition: "high" | "low" | "current" | "middle";
  markerSize: number;
  backgroundOpacity: number;
  daysToShow: number;
  alertsEnabled: boolean;
  useThemeColors: boolean;
  markerColor: string;
  backgroundColor: string;
};

export type PatternSignal = {
  id: string;
  timestamp: number;
  price: number;
  conditionResults: boolean[];
};

const finite = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const reference = (value: unknown, fallback: PatternReference): PatternReference =>
  PATTERN_REFERENCE_OPTIONS.includes(value as PatternReference) ? value as PatternReference : fallback;
const math = (value: unknown): PatternMathOperator => ["+", "-", "*", "/"].includes(String(value)) ? value as PatternMathOperator : "+";
const comparator = (value: unknown): PatternComparator => [">", ">=", "=", "<>", "<", "<="].includes(String(value)) ? value as PatternComparator : ">";

function defaultCondition(index: number): PatternConditionSettings {
  return {
    enabled: index === 0,
    aSource: "close", aOffset: 0, aValue: 0,
    bSource: "unused", bOffset: 0, bValue: 0, leftMath: "+",
    comparator: ">",
    cSource: "open", cOffset: 0, cValue: 0,
    dSource: "unused", dOffset: 0, dValue: 0, rightMath: "+",
  };
}

export function normalizeDeepPatternBuilderSettings(input: Record<string, unknown> | null | undefined, theme?: { accent: string; background: string }): DeepPatternBuilderSettings {
  const conditions = Array.from({ length: 4 }, (_, index) => {
    const fallback = defaultCondition(index);
    const prefix = `condition${index + 1}`;
    return {
      enabled: input?.[`${prefix}Enabled`] === undefined ? fallback.enabled : input?.[`${prefix}Enabled`] === true,
      aSource: reference(input?.[`${prefix}ASource`], fallback.aSource),
      aOffset: Math.round(finite(input?.[`${prefix}AOffset`], 0, 0, 100)),
      aValue: finite(input?.[`${prefix}AValue`], 0, -1e12, 1e12),
      bSource: reference(input?.[`${prefix}BSource`], fallback.bSource),
      bOffset: Math.round(finite(input?.[`${prefix}BOffset`], 0, 0, 100)),
      bValue: finite(input?.[`${prefix}BValue`], 0, -1e12, 1e12),
      leftMath: math(input?.[`${prefix}LeftMath`]),
      comparator: comparator(input?.[`${prefix}Comparator`]),
      cSource: reference(input?.[`${prefix}CSource`], fallback.cSource),
      cOffset: Math.round(finite(input?.[`${prefix}COffset`], 0, 0, 100)),
      cValue: finite(input?.[`${prefix}CValue`], 0, -1e12, 1e12),
      dSource: reference(input?.[`${prefix}DSource`], fallback.dSource),
      dOffset: Math.round(finite(input?.[`${prefix}DOffset`], 0, 0, 100)),
      dValue: finite(input?.[`${prefix}DValue`], 0, -1e12, 1e12),
      rightMath: math(input?.[`${prefix}RightMath`]),
    };
  });
  const combineMode = ["and", "or", "advanced"].includes(String(input?.combineMode)) ? input?.combineMode as DeepPatternBuilderSettings["combineMode"] : "and";
  const plotMode = ["marker", "background", "both"].includes(String(input?.plotMode)) ? input?.plotMode as DeepPatternBuilderSettings["plotMode"] : "marker";
  const markerPosition = ["high", "low", "current", "middle"].includes(String(input?.markerPosition)) ? input?.markerPosition as DeepPatternBuilderSettings["markerPosition"] : "high";
  return {
    conditions, combineMode,
    advancedExpression: typeof input?.advancedExpression === "string" ? input.advancedExpression.slice(0, 120) : "C1 AND C2",
    calculateOnClose: input?.calculateOnClose !== false,
    minImbalancePercent: finite(input?.minImbalancePercent, 0, 0, 100000),
    maxImbalancePercent: finite(input?.maxImbalancePercent, 0, 0, 100000),
    plotMode, markerPosition,
    markerSize: finite(input?.markerSize, 7, 3, 24),
    backgroundOpacity: finite(input?.backgroundOpacity, 8, 0, 40),
    daysToShow: Math.round(finite(input?.daysToShow, 10, 1, 365)),
    alertsEnabled: input?.alertsEnabled === true,
    useThemeColors: input?.useThemeColors !== false,
    markerColor: typeof input?.markerColor === "string" ? input.markerColor : theme?.accent ?? "#22C55E",
    backgroundColor: typeof input?.patternBackgroundColor === "string" ? input.patternBackgroundColor : theme?.accent ?? "#22C55E",
  };
}

function applyMath(left: number, right: number | null, operator: PatternMathOperator): number | null {
  if (right === null) return left;
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  return right === 0 ? null : left / right;
}
function compare(left: number, right: number, operator: PatternComparator) {
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  if (operator === "<=") return left <= right;
  if (operator === "<>") return left !== right;
  return Math.abs(left - right) <= Math.max(1e-9, Math.abs(left) * 1e-9);
}

function technical(candles: Candle[], index: number, source: "sma" | "ema" | "vwap", length: number) {
  const start = Math.max(0, index - length + 1);
  const slice = candles.slice(start, index + 1);
  if (!slice.length) return null;
  if (source === "sma") return slice.reduce((sum, candle) => sum + candle.close, 0) / slice.length;
  if (source === "vwap") {
    const volume = slice.reduce((sum, candle) => sum + Math.max(0, candle.volume ?? 0), 0);
    return volume > 0 ? slice.reduce((sum, candle) => sum + ((candle.high + candle.low + candle.close) / 3) * Math.max(0, candle.volume ?? 0), 0) / volume : null;
  }
  const alpha = 2 / (length + 1); let value = slice[0].close;
  for (let offset = 1; offset < slice.length; offset += 1) value = alpha * slice[offset].close + (1 - alpha) * value;
  return value;
}

function resolveOperand(candles: Candle[], bars: Map<number, FootprintBar>, cumulativeDelta: number[], index: number, source: PatternReference, offset: number, value: number, tickSize: number): number | null {
  if (source === "unused") return null;
  if (source === "constant") return value;
  const target = index - offset; if (target < 0) return null;
  const candle = candles[target]; const bar = bars.get(candle.timestamp);
  if (["sma", "ema", "vwap"].includes(source)) return technical(candles, target, source as "sma" | "ema" | "vwap", Math.max(1, Math.round(Math.abs(value) || 20)));
  if (source === "open" || source === "high" || source === "low" || source === "close") return candle[source];
  if (source === "volume") return candle.volume ?? 0;
  if (source === "range-ticks") return (candle.high - candle.low) / tickSize;
  if (source === "body-ticks") return Math.abs(candle.close - candle.open) / tickSize;
  if (!bar) return null;
  if (source === "bid-volume") return bar.bidVolume;
  if (source === "ask-volume") return bar.askVolume;
  if (source === "total-volume") return bar.volume;
  if (source === "bid-trades") return bar.bidTrades;
  if (source === "ask-trades") return bar.askTrades;
  if (source === "total-trades") return bar.trades;
  if (source === "delta-volume") return bar.delta;
  if (source === "delta-trades") return bar.askTrades - bar.bidTrades;
  if (source === "cumulative-delta") return cumulativeDelta[target] ?? null;
  const poc = bar.rows.find((row) => row.price === bar.pocPrice);
  if (source === "poc-volume") return poc?.volume ?? null;
  if (source === "poc-percent") return poc && bar.volume > 0 ? poc.volume / bar.volume * 100 : null;
  if (source === "poc-shadow") return bar.pocPrice === null ? null : Math.min(Math.abs(bar.pocPrice - candle.high), Math.abs(bar.pocPrice - candle.low)) / tickSize;
  return null;
}

function advancedResult(expression: string, results: boolean[]): boolean {
  const tokens = expression.toUpperCase().match(/C[1-4]|AND|OR|NOT|\(|\)/g);
  if (!tokens?.length) return false;
  let cursor = 0;
  const primary = (): boolean => {
    const token = tokens[cursor++];
    if (token === "NOT") return !primary();
    if (token === "(") { const value = or(); if (tokens[cursor++] !== ")") return false; return value; }
    return /^C[1-4]$/.test(token ?? "") ? Boolean(results[Number(token.slice(1)) - 1]) : false;
  };
  const and = (): boolean => { let value = primary(); while (tokens[cursor] === "AND") { cursor += 1; const next = primary(); value = value && next; } return value; };
  const or = (): boolean => { let value = and(); while (tokens[cursor] === "OR") { cursor += 1; const next = and(); value = value || next; } return value; };
  const value = or(); return cursor === tokens.length && value;
}

export function buildDeepPatternSignals(candlesInput: Candle[], footprintBars: FootprintBar[], settings: DeepPatternBuilderSettings, tickSizeInput: number, nowMs = Date.now()): PatternSignal[] {
  const candles = [...candlesInput].sort((a, b) => a.timestamp - b.timestamp);
  const bars = new Map(footprintBars.map((bar) => [bar.startTime, bar]));
  const cumulativeDelta: number[] = []; let runningDelta = 0;
  for (const candle of candles) { runningDelta += bars.get(candle.timestamp)?.delta ?? 0; cumulativeDelta.push(runningDelta); }
  const tickSize = Math.max(1e-9, tickSizeInput);
  const cutoff = nowMs - settings.daysToShow * 86_400_000;
  const lastIndex = settings.calculateOnClose ? candles.length - 1 : candles.length;
  const signals: PatternSignal[] = [];
  for (let index = 0; index < lastIndex; index += 1) {
    const candle = candles[index]; if (candle.timestamp < cutoff) continue;
    const conditionResults = settings.conditions.map((condition) => {
      if (!condition.enabled) return false;
      const a = resolveOperand(candles, bars, cumulativeDelta, index, condition.aSource, condition.aOffset, condition.aValue, tickSize);
      const b = resolveOperand(candles, bars, cumulativeDelta, index, condition.bSource, condition.bOffset, condition.bValue, tickSize);
      const c = resolveOperand(candles, bars, cumulativeDelta, index, condition.cSource, condition.cOffset, condition.cValue, tickSize);
      const d = resolveOperand(candles, bars, cumulativeDelta, index, condition.dSource, condition.dOffset, condition.dValue, tickSize);
      if (a === null || c === null) return false;
      const left = applyMath(a, b, condition.leftMath); const right = applyMath(c, d, condition.rightMath);
      if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right)) return false;
      const bar = bars.get(candle.timestamp);
      if (settings.minImbalancePercent > 0 || settings.maxImbalancePercent > 0) {
        if (!bar) return false;
        const larger = Math.max(bar.askVolume, bar.bidVolume); const smaller = Math.min(bar.askVolume, bar.bidVolume);
        const imbalance = smaller > 0 ? larger / smaller * 100 : larger > 0 ? Number.POSITIVE_INFINITY : 0;
        if (imbalance < settings.minImbalancePercent || (settings.maxImbalancePercent > 0 && imbalance > settings.maxImbalancePercent)) return false;
      }
      return compare(left, right, condition.comparator);
    });
    const enabled = settings.conditions.map((condition, conditionIndex) => condition.enabled ? conditionResults[conditionIndex] : null).filter((value): value is boolean => value !== null);
    const matched = settings.combineMode === "advanced" ? advancedResult(settings.advancedExpression, conditionResults) : settings.combineMode === "or" ? enabled.some(Boolean) : enabled.length > 0 && enabled.every(Boolean);
    if (!matched) continue;
    const price = settings.markerPosition === "low" ? candle.low : settings.markerPosition === "current" ? candle.close : settings.markerPosition === "middle" ? (candle.high + candle.low) / 2 : candle.high;
    signals.push({ id: `pattern:${candle.timestamp}`, timestamp: candle.timestamp, price, conditionResults });
  }
  return signals;
}
