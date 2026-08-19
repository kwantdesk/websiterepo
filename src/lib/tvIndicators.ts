import type { Candle } from "@/lib/backtester";

/**
 * TradingView-identical indicator engine.
 *
 * This is a self-contained study system, deliberately independent of the
 * existing KwantDesk indicator engine. Every study reproduces TradingView's
 * documented formula, default inputs, and default plot styling, and each
 * exposes an Inputs/Style schema so the settings dialog can be generated the
 * same way TradingView builds its own. New chart studies added from the top
 * toolbar run through here; nothing in this file reuses the older engine.
 */

export type TvPoint = { time: number; value: number };

export type TvPlot = {
  key: string;
  title: string;
  data: TvPoint[];
  kind?: "line" | "histogram";
  // Per-point colours (histograms). When absent the style colour is used.
  colors?: string[];
};

export type TvComputed = {
  plots: TvPlot[];
  // A separate lower pane is used when overlay is false.
  overlay: boolean;
  // Fixed 0..100 style scale (RSI, Stochastic) so the pane autoscale is stable.
  fixedScale?: { min: number; max: number; bands?: number[] };
};

export type TvInputField =
  | { key: string; label: string; type: "number"; default: number; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: "source"; default: TvSource }
  | { key: string; label: string; type: "select"; default: string; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "boolean"; default: boolean };

export type TvStyleField = {
  key: string;        // plot key this style controls
  label: string;
  defaultColor: string;
  defaultWidth: number;
  defaultVisible?: boolean;
};

export type TvIndicatorSpec = {
  id: string;
  name: string;
  short: string;
  overlay: boolean;
  inputs: TvInputField[];
  styles: TvStyleField[];
  compute: (candles: Candle[], inputs: Record<string, number | string | boolean>) => TvComputed;
};

export type TvSource = "close" | "open" | "high" | "low" | "hl2" | "hlc3" | "ohlc4";

export type TvIndicatorInstance = {
  instanceId: string;
  specId: string;
  inputs: Record<string, number | string | boolean>;
  style: Record<string, { color: string; width: number; visible: boolean }>;
};

// ---- price source helpers (TradingView `source` semantics) -----------------

function sourceValue(candle: Candle, source: TvSource): number {
  switch (source) {
    case "open": return candle.open;
    case "high": return candle.high;
    case "low": return candle.low;
    case "hl2": return (candle.high + candle.low) / 2;
    case "hlc3": return (candle.high + candle.low + candle.close) / 3;
    case "ohlc4": return (candle.open + candle.high + candle.low + candle.close) / 4;
    default: return candle.close;
  }
}

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "close", label: "Close" },
  { value: "open", label: "Open" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
  { value: "hl2", label: "HL2" },
  { value: "hlc3", label: "HLC3" },
  { value: "ohlc4", label: "OHLC4" },
];

// ---- moving averages (exact TradingView formulas) --------------------------

function sma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out[i] = sum / length;
  }
  return out;
}

function ema(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const alpha = 2 / (length + 1);
  let prev: number | null = null;
  // TradingView seeds EMA with the SMA of the first `length` values.
  const seed = sma(values, length);
  for (let i = 0; i < values.length; i += 1) {
    if (prev === null) {
      if (seed[i] !== null) { prev = seed[i]!; out[i] = prev; }
    } else {
      prev = alpha * values[i] + (1 - alpha) * prev;
      out[i] = prev;
    }
  }
  return out;
}

// Wilder's RMA (used by RSI, ATR) — alpha = 1/length, SMA-seeded.
function rma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const alpha = 1 / length;
  let prev: number | null = null;
  const seed = sma(values, length);
  for (let i = 0; i < values.length; i += 1) {
    if (prev === null) {
      if (seed[i] !== null) { prev = seed[i]!; out[i] = prev; }
    } else {
      prev = alpha * values[i] + (1 - alpha) * prev;
      out[i] = prev;
    }
  }
  return out;
}

function wma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const denom = (length * (length + 1)) / 2;
  for (let i = length - 1; i < values.length; i += 1) {
    let weighted = 0;
    for (let k = 0; k < length; k += 1) weighted += values[i - k] * (length - k);
    out[i] = weighted / denom;
  }
  return out;
}

function movingAverage(values: number[], length: number, type: string): (number | null)[] {
  if (type === "EMA") return ema(values, length);
  if (type === "WMA") return wma(values, length);
  if (type === "RMA") return rma(values, length);
  return sma(values, length);
}

function stdev(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const means = sma(values, length);
  for (let i = length - 1; i < values.length; i += 1) {
    const mean = means[i]!;
    let acc = 0;
    for (let k = 0; k < length; k += 1) { const d = values[i - k] - mean; acc += d * d; }
    // TradingView `ta.stdev` is a population standard deviation.
    out[i] = Math.sqrt(acc / length);
  }
  return out;
}

function seriesToPoints(candles: Candle[], values: (number | null)[]): TvPoint[] {
  const points: TvPoint[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const v = values[i];
    if (v !== null && Number.isFinite(v)) points.push({ time: Math.floor(candles[i].timestamp / 1000), value: v });
  }
  return points;
}

function num(inputs: Record<string, number | string | boolean>, key: string, fallback: number) {
  const v = Number(inputs[key]);
  return Number.isFinite(v) ? v : fallback;
}
function str(inputs: Record<string, number | string | boolean>, key: string, fallback: string) {
  const v = inputs[key];
  return typeof v === "string" && v ? v : fallback;
}

// ---- indicator specs -------------------------------------------------------

export const TV_INDICATOR_SPECS: TvIndicatorSpec[] = [
  {
    id: "tv-ma",
    name: "Moving Average",
    short: "MA",
    overlay: true,
    inputs: [
      { key: "length", label: "Length", type: "number", default: 9, min: 1, max: 5000, step: 1 },
      { key: "source", label: "Source", type: "source", default: "close" },
      { key: "type", label: "Method", type: "select", default: "SMA", options: [
        { value: "SMA", label: "Simple" }, { value: "EMA", label: "Exponential" },
        { value: "WMA", label: "Weighted" }, { value: "RMA", label: "Wilder (RMA)" },
      ] },
    ],
    styles: [{ key: "ma", label: "Plot", defaultColor: "#2962FF", defaultWidth: 2 }],
    compute: (candles, inputs) => {
      const length = Math.max(1, Math.round(num(inputs, "length", 9)));
      const source = str(inputs, "source", "close") as TvSource;
      const type = str(inputs, "type", "SMA");
      const values = candles.map((c) => sourceValue(c, source));
      return { overlay: true, plots: [{ key: "ma", title: `MA ${length}`, data: seriesToPoints(candles, movingAverage(values, length, type)) }] };
    },
  },
  {
    id: "tv-ema",
    name: "Exponential Moving Average",
    short: "EMA",
    overlay: true,
    inputs: [
      { key: "length", label: "Length", type: "number", default: 9, min: 1, max: 5000, step: 1 },
      { key: "source", label: "Source", type: "source", default: "close" },
    ],
    styles: [{ key: "ema", label: "Plot", defaultColor: "#F23645", defaultWidth: 2 }],
    compute: (candles, inputs) => {
      const length = Math.max(1, Math.round(num(inputs, "length", 9)));
      const source = str(inputs, "source", "close") as TvSource;
      const values = candles.map((c) => sourceValue(c, source));
      return { overlay: true, plots: [{ key: "ema", title: `EMA ${length}`, data: seriesToPoints(candles, ema(values, length)) }] };
    },
  },
  {
    id: "tv-bb",
    name: "Bollinger Bands",
    short: "BB",
    overlay: true,
    inputs: [
      { key: "length", label: "Length", type: "number", default: 20, min: 1, max: 5000, step: 1 },
      { key: "source", label: "Source", type: "source", default: "close" },
      { key: "mult", label: "StdDev", type: "number", default: 2, min: 0.001, max: 50, step: 0.1 },
    ],
    styles: [
      { key: "basis", label: "Basis", defaultColor: "#FF6D00", defaultWidth: 1 },
      { key: "upper", label: "Upper", defaultColor: "#2962FF", defaultWidth: 1 },
      { key: "lower", label: "Lower", defaultColor: "#2962FF", defaultWidth: 1 },
    ],
    compute: (candles, inputs) => {
      const length = Math.max(1, Math.round(num(inputs, "length", 20)));
      const mult = num(inputs, "mult", 2);
      const source = str(inputs, "source", "close") as TvSource;
      const values = candles.map((c) => sourceValue(c, source));
      const basis = movingAverage(values, length, "SMA");
      const dev = stdev(values, length);
      const upper = basis.map((b, i) => (b === null || dev[i] === null ? null : b + mult * dev[i]!));
      const lower = basis.map((b, i) => (b === null || dev[i] === null ? null : b - mult * dev[i]!));
      return {
        overlay: true,
        plots: [
          { key: "basis", title: "Basis", data: seriesToPoints(candles, basis) },
          { key: "upper", title: "Upper", data: seriesToPoints(candles, upper) },
          { key: "lower", title: "Lower", data: seriesToPoints(candles, lower) },
        ],
      };
    },
  },
  {
    id: "tv-vwap",
    name: "VWAP",
    short: "VWAP",
    overlay: true,
    inputs: [
      { key: "source", label: "Source", type: "source", default: "hlc3" },
      { key: "anchor", label: "Anchor", type: "select", default: "session", options: [
        { value: "session", label: "Session" }, { value: "week", label: "Week" },
      ] },
    ],
    styles: [{ key: "vwap", label: "VWAP", defaultColor: "#2962FF", defaultWidth: 2 }],
    compute: (candles, inputs) => {
      const source = str(inputs, "source", "hlc3") as TvSource;
      const anchor = str(inputs, "anchor", "session");
      const nyDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
      const points: TvPoint[] = [];
      let cumPV = 0;
      let cumV = 0;
      let anchorKey = "";
      const keyFor = (ts: number) => {
        if (anchor === "week") {
          const d = new Date(ts);
          const day = (d.getUTCDay() + 6) % 7;
          return `${d.getUTCFullYear()}-${Math.floor((d.getTime() - day * 86400000) / 604800000)}`;
        }
        return nyDate.format(ts);
      };
      for (const candle of candles) {
        const key = keyFor(candle.timestamp);
        if (key !== anchorKey) { anchorKey = key; cumPV = 0; cumV = 0; }
        const v = Math.max(0, Number(candle.volume ?? 0));
        const price = sourceValue(candle, source);
        if (v > 0) { cumPV += price * v; cumV += v; }
        if (cumV > 0) points.push({ time: Math.floor(candle.timestamp / 1000), value: cumPV / cumV });
      }
      return { overlay: true, plots: [{ key: "vwap", title: "VWAP", data: points }] };
    },
  },
];

export const TV_SPEC_BY_ID = new Map(TV_INDICATOR_SPECS.map((spec) => [spec.id, spec]));

export const TV_SOURCE_OPTIONS = SOURCE_OPTIONS;

export function defaultTvInputs(spec: TvIndicatorSpec): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {};
  for (const field of spec.inputs) out[field.key] = field.default;
  return out;
}

export function defaultTvStyle(spec: TvIndicatorSpec): Record<string, { color: string; width: number; visible: boolean }> {
  const out: Record<string, { color: string; width: number; visible: boolean }> = {};
  for (const field of spec.styles) out[field.key] = { color: field.defaultColor, width: field.defaultWidth, visible: field.defaultVisible !== false };
  return out;
}

export function createTvInstance(specId: string): TvIndicatorInstance | null {
  const spec = TV_SPEC_BY_ID.get(specId);
  if (!spec) return null;
  return {
    instanceId: `${specId}-${crypto.randomUUID()}`,
    specId,
    inputs: defaultTvInputs(spec),
    style: defaultTvStyle(spec),
  };
}

export function normalizeTvInstances(value: unknown): TvIndicatorInstance[] {
  if (!Array.isArray(value)) return [];
  const out: TvIndicatorInstance[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<TvIndicatorInstance>;
    const spec = candidate.specId ? TV_SPEC_BY_ID.get(candidate.specId) : null;
    if (!spec || typeof candidate.instanceId !== "string") continue;
    const inputs = { ...defaultTvInputs(spec), ...(candidate.inputs && typeof candidate.inputs === "object" ? candidate.inputs : {}) };
    const styleDefaults = defaultTvStyle(spec);
    const style = { ...styleDefaults };
    if (candidate.style && typeof candidate.style === "object") {
      for (const key of Object.keys(styleDefaults)) {
        const saved = (candidate.style as Record<string, unknown>)[key];
        if (saved && typeof saved === "object") {
          const s = saved as Partial<{ color: string; width: number; visible: boolean }>;
          style[key] = {
            color: typeof s.color === "string" ? s.color : styleDefaults[key].color,
            width: Number.isFinite(Number(s.width)) ? Number(s.width) : styleDefaults[key].width,
            visible: s.visible !== false,
          };
        }
      }
    }
    out.push({ instanceId: candidate.instanceId, specId: candidate.specId!, inputs, style });
  }
  return out;
}
