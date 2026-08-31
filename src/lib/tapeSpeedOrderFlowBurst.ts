import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries } from "@/lib/chartIndicatorEngine";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export const TAPE_SPEED_ORDER_FLOW_BURST_SETTINGS_VERSION = 1;

export type TapeSpeedWindowMode = "rolling" | "fixed" | "chart-bar" | "event-burst";
export type TapeSpeedPreset =
  | "balanced-futures"
  | "nq-scalper"
  | "tape-acceleration"
  | "delta-burst"
  | "large-trade-burst"
  | "sweep-focus"
  | "absorbed-burst"
  | "churn-rotation"
  | "minimal"
  | "research"
  | "custom";
export type TapeBurstDirection = "buy" | "sell" | "neutral";
export type TapeBurstClassification =
  | "high-speed"
  | "buy-burst"
  | "sell-burst"
  | "two-sided-churn"
  | "large-trade"
  | "sweep-linked"
  | "vacuum-assisted"
  | "absorbed"
  | "refresh-opposed";
export type TapeBurstResponse = "developing" | "continuation" | "rejection" | "exhaustion" | "decelerating";
export type TapeSpeedStatus = "LIVE" | "HISTORICAL" | "WARMING UP" | "STALE" | "UNAVAILABLE";

export interface TapeSpeedSettings {
  schemaVersion: number;
  preset: TapeSpeedPreset;
  windowMode: TapeSpeedWindowMode;
  rollingWindowMs: number;
  updateStepMs: number;
  fixedBucketMs: number;
  maximumInterTradeGapMs: number;
  maximumEventDurationMs: number;
  dynamicBaselineEnabled: boolean;
  baselineWindowMs: number;
  baselineSampleLimit: number;
  minimumBaselineSamples: number;
  selectedPercentile: number;
  relativeSpeedMultiplier: number;
  relativeDeltaMultiplier: number;
  minimumContractsPerSecond: number;
  minimumTradesPerSecond: number;
  minimumAbsoluteDeltaPerSecond: number;
  minimumQuantity: number;
  minimumTradeCount: number;
  minimumDirectionalShare: number;
  minimumDirectionalDelta: number;
  minimumQualityScore: number;
  minimumMarkerScore: number;
  largeTradeThreshold: number;
  continuationWindowMs: number;
  continuationTicks: number;
  rejectionTicks: number;
  historySeconds: number;
  maximumBuckets: number;
  maximumEvents: number;
  staleAfterMs: number;
  showPane: boolean;
  paneMode: "contracts-per-second" | "trades-per-second" | "delta-per-second";
  showBuySpeed: boolean;
  showSellSpeed: boolean;
  showTotalSpeed: boolean;
  showDeltaSpeed: boolean;
  showMarkers: boolean;
  showPriceTimeBands: boolean;
  showLabels: boolean;
  showTooltips: boolean;
  showActiveLane: boolean;
  alertsEnabled: boolean;
  alertMinimumScore: number;
  useThemeColors: boolean;
  buyColor: string;
  sellColor: string;
  totalColor: string;
  neutralColor: string;
  warningColor: string;
  opacity: number;
  markerSize: number;
  paneHeight: number;
}

export const DEFAULT_TAPE_SPEED_SETTINGS: TapeSpeedSettings = {
  schemaVersion: TAPE_SPEED_ORDER_FLOW_BURST_SETTINGS_VERSION,
  preset: "balanced-futures",
  windowMode: "rolling",
  rollingWindowMs: 1_000,
  updateStepMs: 100,
  fixedBucketMs: 1_000,
  maximumInterTradeGapMs: 75,
  maximumEventDurationMs: 2_000,
  dynamicBaselineEnabled: true,
  baselineWindowMs: 120_000,
  baselineSampleLimit: 5_000,
  minimumBaselineSamples: 30,
  selectedPercentile: 0.9,
  relativeSpeedMultiplier: 2,
  relativeDeltaMultiplier: 2,
  minimumContractsPerSecond: 100,
  minimumTradesPerSecond: 5,
  minimumAbsoluteDeltaPerSecond: 50,
  minimumQuantity: 100,
  minimumTradeCount: 3,
  minimumDirectionalShare: 0.7,
  minimumDirectionalDelta: 25,
  minimumQualityScore: 60,
  minimumMarkerScore: 70,
  largeTradeThreshold: 100,
  continuationWindowMs: 3_000,
  continuationTicks: 3,
  rejectionTicks: 3,
  historySeconds: 3_600,
  maximumBuckets: 5_000,
  maximumEvents: 2_000,
  staleAfterMs: 5_000,
  showPane: true,
  paneMode: "contracts-per-second",
  showBuySpeed: true,
  showSellSpeed: true,
  showTotalSpeed: true,
  showDeltaSpeed: false,
  showMarkers: true,
  showPriceTimeBands: true,
  showLabels: true,
  showTooltips: true,
  showActiveLane: false,
  alertsEnabled: false,
  alertMinimumScore: 80,
  useThemeColors: true,
  buyColor: "#22D3A7",
  sellColor: "#FF3B78",
  totalColor: "#F8FAFC",
  neutralColor: "#94A3B8",
  warningColor: "#F59E0B",
  opacity: 100,
  markerSize: 7,
  paneHeight: 190,
};

export const TAPE_SPEED_PRESETS: Record<Exclude<TapeSpeedPreset, "custom">, Partial<TapeSpeedSettings>> = {
  "balanced-futures": { preset: "balanced-futures" },
  "nq-scalper": { preset: "nq-scalper", rollingWindowMs: 500, updateStepMs: 50, minimumContractsPerSecond: 60, minimumQuantity: 40, minimumTradeCount: 2, minimumMarkerScore: 65, historySeconds: 900 },
  "tape-acceleration": { preset: "tape-acceleration", relativeSpeedMultiplier: 1.5, minimumContractsPerSecond: 50, minimumMarkerScore: 60, showDeltaSpeed: true },
  "delta-burst": { preset: "delta-burst", minimumAbsoluteDeltaPerSecond: 80, minimumDirectionalDelta: 40, minimumDirectionalShare: 0.75, showDeltaSpeed: true },
  "large-trade-burst": { preset: "large-trade-burst", largeTradeThreshold: 200, minimumQuantity: 200, minimumContractsPerSecond: 200 },
  "sweep-focus": { preset: "sweep-focus", minimumTradeCount: 3, minimumDirectionalShare: 0.82, minimumDirectionalDelta: 50, minimumMarkerScore: 75 },
  "absorbed-burst": { preset: "absorbed-burst", continuationTicks: 2, rejectionTicks: 2, continuationWindowMs: 5_000 },
  "churn-rotation": { preset: "churn-rotation", minimumDirectionalShare: 0.58, minimumDirectionalDelta: 10, showDeltaSpeed: true },
  minimal: { preset: "minimal", showPriceTimeBands: false, showLabels: false, showDeltaSpeed: false, minimumMarkerScore: 85, opacity: 60 },
  research: { preset: "research", windowMode: "event-burst", maximumEvents: 5_000, maximumBuckets: 10_000, historySeconds: 7_200, showDeltaSpeed: true, minimumMarkerScore: 50 },
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const quantile = (values: number[], q: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * clamp(q, 0, 1);
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (at - low);
};

const insertionIndex = (values: number[], target: number, afterEqual = false) => {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] < target || (afterEqual && values[middle] === target)) low = middle + 1;
    else high = middle;
  }
  return low;
};

const insertSorted = (values: number[], value: number) => values.splice(insertionIndex(values, value, true), 0, value);
const removeSorted = (values: number[], value: number) => {
  const index = insertionIndex(values, value);
  if (index < values.length && values[index] === value) values.splice(index, 1);
};
const sortedQuantile = (values: number[], q: number) => {
  if (!values.length) return 0;
  const at = (values.length - 1) * clamp(q, 0, 1);
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return low === high ? values[low] : values[low] + (values[high] - values[low]) * (at - low);
};

export function normalizeTapeSpeedSettings(input?: Partial<TapeSpeedSettings> | Record<string, unknown> | null): TapeSpeedSettings {
  const source = (input ?? {}) as Record<string, unknown>;
  const result = { ...DEFAULT_TAPE_SPEED_SETTINGS, ...source, schemaVersion: TAPE_SPEED_ORDER_FLOW_BURST_SETTINGS_VERSION } as TapeSpeedSettings;
  const numbers: Array<[keyof TapeSpeedSettings, number, number, boolean?]> = [
    ["rollingWindowMs", 50, 60_000, true], ["updateStepMs", 16, 10_000, true], ["fixedBucketMs", 50, 60_000, true], ["maximumInterTradeGapMs", 1, 10_000, true], ["maximumEventDurationMs", 50, 60_000, true],
    ["baselineWindowMs", 1_000, 3_600_000, true], ["baselineSampleLimit", 30, 50_000, true], ["minimumBaselineSamples", 1, 10_000, true], ["selectedPercentile", 0.5, 0.999], ["relativeSpeedMultiplier", 0.1, 50], ["relativeDeltaMultiplier", 0.1, 50],
    ["minimumContractsPerSecond", 0, 10_000_000], ["minimumTradesPerSecond", 0, 1_000_000], ["minimumAbsoluteDeltaPerSecond", 0, 10_000_000], ["minimumQuantity", 1, 10_000_000, true], ["minimumTradeCount", 1, 1_000_000, true],
    ["minimumDirectionalShare", 0.5, 1], ["minimumDirectionalDelta", 0, 10_000_000], ["minimumQualityScore", 0, 100], ["minimumMarkerScore", 0, 100], ["largeTradeThreshold", 1, 10_000_000, true], ["continuationWindowMs", 100, 300_000, true], ["continuationTicks", 1, 10_000, true], ["rejectionTicks", 1, 10_000, true],
    ["historySeconds", 30, 86_400, true], ["maximumBuckets", 100, 50_000, true], ["maximumEvents", 10, 50_000, true], ["staleAfterMs", 250, 300_000, true], ["alertMinimumScore", 0, 100], ["opacity", 0, 100], ["markerSize", 4, 18], ["paneHeight", 120, 520, true],
  ];
  for (const [key, minimum, maximum, integer] of numbers) {
    const value = clamp(finite(source[key], Number(DEFAULT_TAPE_SPEED_SETTINGS[key])), minimum, maximum);
    (result as unknown as Record<string, unknown>)[key] = integer ? Math.round(value) : value;
  }
  if (!(["rolling", "fixed", "chart-bar", "event-burst"] as string[]).includes(String(result.windowMode))) result.windowMode = "rolling";
  if (!(["contracts-per-second", "trades-per-second", "delta-per-second"] as string[]).includes(String(result.paneMode))) result.paneMode = "contracts-per-second";
  if (![...Object.keys(TAPE_SPEED_PRESETS), "custom"].includes(String(result.preset))) result.preset = "balanced-futures";
  result.updateStepMs = Math.min(result.updateStepMs, result.rollingWindowMs);
  return result;
}

export interface TapeSpeedBucket {
  id: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  firstPrice: number;
  lastPrice: number;
  lowPrice: number;
  highPrice: number;
  totalQuantity: number;
  buyQuantity: number;
  sellQuantity: number;
  unknownQuantity: number;
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  contractsPerSecond: number;
  tradesPerSecond: number;
  buyContractsPerSecond: number;
  sellContractsPerSecond: number;
  delta: number;
  deltaPerSecond: number;
  averageTradeSize: number;
  medianTradeSize: number;
  largestTrade: number;
  buyShare: number;
  sellShare: number;
  rangeTicks: number;
  progressTicks: number;
  contractsPerProgressTick: number;
  priceImpactPerHundredContracts: number;
  acceleration: number;
  baselineContractsPerSecond: number;
  baselineDeltaPerSecond: number;
  speedPercentile: number;
  qualityScore: number;
}

export interface TapeBurstEvent {
  id: string;
  bucketId: string;
  startMs: number;
  endMs: number;
  direction: TapeBurstDirection;
  classifications: TapeBurstClassification[];
  response: TapeBurstResponse;
  lowPrice: number;
  highPrice: number;
  anchorPrice: number;
  totalQuantity: number;
  delta: number;
  tradeCount: number;
  contractsPerSecond: number;
  tradesPerSecond: number;
  deltaPerSecond: number;
  acceleration: number;
  largestTrade: number;
  directionalShare: number;
  score: number;
  qualityScore: number;
  contextTags: string[];
  warnings: string[];
}

export interface TapeSharedContextEvent {
  startMs: number;
  endMs: number;
  lowPrice?: number;
  highPrice?: number;
  tag: "sweep-linked" | "vacuum-assisted" | "absorbed" | "refresh-opposed";
}

export interface TapeSpeedFrame {
  status: TapeSpeedStatus;
  statusMessage: string;
  tickSize: number;
  buckets: TapeSpeedBucket[];
  events: TapeBurstEvent[];
  latest: TapeSpeedBucket | null;
  dataQualityScore: number;
  warnings: string[];
}

type TapeSpeedFrameInput = {
  trades: InstitutionalTrade[];
  settings?: Record<string, unknown> | TapeSpeedSettings;
  instrumentId: string;
  tickSize: number;
  nowMs?: number;
  chartBars?: Candle[];
  contextEvents?: TapeSharedContextEvent[];
};

type NormalizedTrade = { id: string; timestampMs: number; price: number; quantity: number; side: "buy" | "sell" | "unknown" };
type RawWindow = { startMs: number; endMs: number; trades: NormalizedTrade[] };

function normalizeTrades(trades: InstitutionalTrade[], historyStartMs: number): NormalizedTrade[] {
  const seen = new Set<string>();
  const normalized: NormalizedTrade[] = [];
  let ordered = true;
  let priorTimestamp = Number.NEGATIVE_INFINITY;
  for (const trade of trades) {
    if (trade.flowOnly || trade.timestamp < historyStartMs || !Number.isFinite(trade.timestamp) || !Number.isFinite(trade.close) || trade.volume <= 0) continue;
    const id = String(trade.eventId ?? `${trade.timestamp}:${trade.recordIndex}:${trade.close}:${trade.volume}:${trade.aggressor}`);
    if (seen.has(id)) continue;
    seen.add(id);
    const normalizedTrade: NormalizedTrade = {
      id,
      timestampMs: trade.timestamp,
      price: trade.close,
      quantity: trade.volume,
      side: trade.aggressor === "BUY" ? "buy" : trade.aggressor === "SELL" ? "sell" : "unknown",
    };
    if (normalizedTrade.timestampMs < priorTimestamp) ordered = false;
    priorTimestamp = normalizedTrade.timestampMs;
    normalized.push(normalizedTrade);
  }
  if (!ordered) normalized.sort((left, right) => left.timestampMs - right.timestampMs || left.id.localeCompare(right.id));
  return normalized;
}

function buildWindows(trades: NormalizedTrade[], settings: TapeSpeedSettings, chartBars: Candle[]): RawWindow[] {
  if (!trades.length) return [];
  if (settings.windowMode === "chart-bar" && chartBars.length) {
    let tradeIndex = 0;
    return chartBars.flatMap((bar, index) => {
      const startMs = bar.timestamp;
      const endMs = chartBars[index + 1]?.timestamp ?? Math.max(startMs + 1, trades.at(-1)!.timestampMs + 1);
      while (tradeIndex < trades.length && trades[tradeIndex].timestampMs < startMs) tradeIndex += 1;
      const startIndex = tradeIndex;
      while (tradeIndex < trades.length && trades[tradeIndex].timestampMs < endMs) tradeIndex += 1;
      return tradeIndex > startIndex ? [{ startMs, endMs, trades: trades.slice(startIndex, tradeIndex) }] : [];
    }).slice(-settings.maximumBuckets);
  }
  if (settings.windowMode === "event-burst") {
    const windows: RawWindow[] = [];
    let current: NormalizedTrade[] = [];
    for (const trade of trades) {
      const prior = current.at(-1);
      if (prior && (trade.timestampMs - prior.timestampMs > settings.maximumInterTradeGapMs || trade.timestampMs - current[0].timestampMs > settings.maximumEventDurationMs)) {
        windows.push({ startMs: current[0].timestampMs, endMs: Math.max(current.at(-1)!.timestampMs + 1, current[0].timestampMs + 1), trades: current });
        current = [];
      }
      current.push(trade);
    }
    if (current.length) windows.push({ startMs: current[0].timestampMs, endMs: Math.max(current.at(-1)!.timestampMs + 1, current[0].timestampMs + 1), trades: current });
    return windows.slice(-settings.maximumBuckets);
  }
  const stepMs = settings.windowMode === "fixed" ? settings.fixedBucketMs : settings.updateStepMs;
  const windowMs = settings.windowMode === "fixed" ? settings.fixedBucketMs : settings.rollingWindowMs;
  const naturalFirstEnd = settings.windowMode === "fixed"
    ? (Math.floor(trades[0].timestampMs / stepMs) + 1) * stepMs
    : Math.ceil(trades[0].timestampMs / stepMs) * stepMs;
  const lastEnd = Math.ceil((trades.at(-1)!.timestampMs + 1) / stepMs) * stepMs;
  // Never construct tens of thousands of discarded high-frequency windows.
  // The visible/replay contract is the latest `maximumBuckets`, so begin at
  // that bounded horizon and advance the trade pointers from there.
  const firstEnd = Math.max(naturalFirstEnd, lastEnd - (settings.maximumBuckets - 1) * stepMs);
  const windows: RawWindow[] = [];
  let left = 0;
  let right = 0;
  for (let endMs = firstEnd; endMs <= lastEnd; endMs += stepMs) {
    const startMs = endMs - windowMs;
    while (left < trades.length && trades[left].timestampMs < startMs) left += 1;
    while (right < trades.length && trades[right].timestampMs < endMs) right += 1;
    if (right > left) windows.push({ startMs, endMs, trades: trades.slice(left, right) });
  }
  return windows;
}

function firstTradeAfter(trades: NormalizedTrade[], timestampMs: number) {
  let low = 0;
  let high = trades.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (trades[middle].timestampMs <= timestampMs) low = middle + 1;
    else high = middle;
  }
  return low;
}

function calculateBucket(window: RawWindow, instrumentId: string, tickSize: number, previous: TapeSpeedBucket | null): TapeSpeedBucket {
  const durationMs = Math.max(1, window.endMs - window.startMs);
  const seconds = durationMs / 1_000;
  let buyQuantity = 0; let sellQuantity = 0; let unknownQuantity = 0; let buyTrades = 0; let sellTrades = 0;
  let lowPrice = Number.POSITIVE_INFINITY; let highPrice = Number.NEGATIVE_INFINITY; let largestTrade = 0;
  const sizes: number[] = [];
  for (const trade of window.trades) {
    sizes.push(trade.quantity); largestTrade = Math.max(largestTrade, trade.quantity); lowPrice = Math.min(lowPrice, trade.price); highPrice = Math.max(highPrice, trade.price);
    if (trade.side === "buy") { buyQuantity += trade.quantity; buyTrades += 1; }
    else if (trade.side === "sell") { sellQuantity += trade.quantity; sellTrades += 1; }
    else unknownQuantity += trade.quantity;
  }
  const totalQuantity = buyQuantity + sellQuantity + unknownQuantity;
  const classifiedQuantity = buyQuantity + sellQuantity;
  const delta = buyQuantity - sellQuantity;
  const firstPrice = window.trades[0].price;
  const lastPrice = window.trades.at(-1)!.price;
  const progressTicks = (lastPrice - firstPrice) / tickSize;
  const rangeTicks = (highPrice - lowPrice) / tickSize;
  const contractsPerSecond = totalQuantity / seconds;
  const deltaPerSecond = delta / seconds;
  const qualityScore = Math.round(clamp((classifiedQuantity / Math.max(1, totalQuantity)) * 80 + (window.trades.some((trade) => trade.id) ? 20 : 0), 0, 100));
  return {
    id: `${instrumentId}:${window.startMs}:${window.endMs}`,
    startMs: window.startMs, endMs: window.endMs, durationMs, firstPrice, lastPrice, lowPrice, highPrice, totalQuantity, buyQuantity, sellQuantity, unknownQuantity,
    totalTrades: window.trades.length, buyTrades, sellTrades, contractsPerSecond, tradesPerSecond: window.trades.length / seconds,
    buyContractsPerSecond: buyQuantity / seconds, sellContractsPerSecond: sellQuantity / seconds, delta, deltaPerSecond,
    averageTradeSize: totalQuantity / Math.max(1, window.trades.length), medianTradeSize: quantile(sizes, 0.5), largestTrade,
    buyShare: buyQuantity / Math.max(1, classifiedQuantity), sellShare: sellQuantity / Math.max(1, classifiedQuantity), rangeTicks, progressTicks,
    contractsPerProgressTick: totalQuantity / Math.max(1, Math.abs(progressTicks)), priceImpactPerHundredContracts: Math.abs(progressTicks) / Math.max(1, totalQuantity) * 100,
    acceleration: previous ? contractsPerSecond - previous.contractsPerSecond : 0,
    baselineContractsPerSecond: 0, baselineDeltaPerSecond: 0, speedPercentile: 0, qualityScore,
  };
}

function overlapsContext(bucket: TapeSpeedBucket, context: TapeSharedContextEvent) {
  if (context.endMs < bucket.startMs || context.startMs > bucket.endMs) return false;
  if (context.lowPrice === undefined || context.highPrice === undefined) return true;
  return !(context.highPrice < bucket.lowPrice || context.lowPrice > bucket.highPrice);
}

function calculateTapeSpeedFrame(input: TapeSpeedFrameInput, settings: TapeSpeedSettings, nowMs: number): TapeSpeedFrame {
  const tickSize = Math.max(1e-9, input.tickSize);
  const newestAvailableMs = input.trades.reduce((latest, trade) => !trade.flowOnly && Number.isFinite(trade.timestamp) ? Math.max(latest, trade.timestamp) : latest, 0);
  // Historical/weekend charts still need a real execution window. Anchor the
  // retained history to the latest available print, while keeping `nowMs` for
  // the honest LIVE/STALE/HISTORICAL status below.
  const historyAnchorMs = newestAvailableMs > 0 ? Math.min(nowMs, newestAvailableMs + Math.max(settings.updateStepMs, 1_000)) : nowMs;
  const historyStartMs = historyAnchorMs - settings.historySeconds * 1_000;
  const trades = normalizeTrades(input.trades, historyStartMs);
  if (!trades.length) return { status: "UNAVAILABLE", statusMessage: "Waiting for direct Rithmic executions.", tickSize, buckets: [], events: [], latest: null, dataQualityScore: 0, warnings: ["OHLCV is not used as a tape-speed substitute."] };
  const windows = buildWindows(trades, settings, input.chartBars ?? []).slice(-settings.maximumBuckets);
  const buckets: TapeSpeedBucket[] = [];
  const baseline: TapeSpeedBucket[] = [];
  const sortedBaselineSpeeds: number[] = [];
  const sortedBaselineDeltas: number[] = [];
  for (const window of windows) {
    const bucket = calculateBucket(window, input.instrumentId, tickSize, buckets.at(-1) ?? null);
    while (baseline.length && baseline[0].endMs < bucket.endMs - settings.baselineWindowMs) {
      const removed = baseline.shift()!;
      removeSorted(sortedBaselineSpeeds, removed.contractsPerSecond);
      removeSorted(sortedBaselineDeltas, Math.abs(removed.deltaPerSecond));
    }
    while (baseline.length >= settings.baselineSampleLimit) {
      const removed = baseline.shift()!;
      removeSorted(sortedBaselineSpeeds, removed.contractsPerSecond);
      removeSorted(sortedBaselineDeltas, Math.abs(removed.deltaPerSecond));
    }
    bucket.baselineContractsPerSecond = sortedQuantile(sortedBaselineSpeeds, 0.5);
    bucket.baselineDeltaPerSecond = sortedQuantile(sortedBaselineDeltas, 0.5);
    bucket.speedPercentile = sortedBaselineSpeeds.length
      ? insertionIndex(sortedBaselineSpeeds, bucket.contractsPerSecond, true) / sortedBaselineSpeeds.length
      : 0;
    buckets.push(bucket);
    baseline.push(bucket);
    insertSorted(sortedBaselineSpeeds, bucket.contractsPerSecond);
    insertSorted(sortedBaselineDeltas, Math.abs(bucket.deltaPerSecond));
  }
  const events: TapeBurstEvent[] = [];
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    const baselineReady = !settings.dynamicBaselineEnabled || index >= settings.minimumBaselineSamples;
    const speedGate = bucket.contractsPerSecond >= settings.minimumContractsPerSecond
      && (!settings.dynamicBaselineEnabled || bucket.contractsPerSecond >= Math.max(1, bucket.baselineContractsPerSecond) * settings.relativeSpeedMultiplier || bucket.speedPercentile >= settings.selectedPercentile);
    const deltaGate = Math.abs(bucket.deltaPerSecond) >= settings.minimumAbsoluteDeltaPerSecond
      && (!settings.dynamicBaselineEnabled || Math.abs(bucket.deltaPerSecond) >= Math.max(1, bucket.baselineDeltaPerSecond) * settings.relativeDeltaMultiplier);
    if (!baselineReady || !speedGate || bucket.totalQuantity < settings.minimumQuantity || bucket.totalTrades < settings.minimumTradeCount || bucket.qualityScore < settings.minimumQualityScore) continue;
    const direction: TapeBurstDirection = bucket.buyShare >= settings.minimumDirectionalShare && bucket.delta >= settings.minimumDirectionalDelta
      ? "buy"
      : bucket.sellShare >= settings.minimumDirectionalShare && bucket.delta <= -settings.minimumDirectionalDelta
        ? "sell"
        : "neutral";
    const classifications: TapeBurstClassification[] = ["high-speed"];
    if (direction === "buy" && deltaGate) classifications.push("buy-burst");
    if (direction === "sell" && deltaGate) classifications.push("sell-burst");
    if (direction === "neutral") classifications.push("two-sided-churn");
    if (bucket.largestTrade >= settings.largeTradeThreshold) classifications.push("large-trade");
    const contextTags = (input.contextEvents ?? []).filter((context) => overlapsContext(bucket, context)).map((context) => context.tag);
    for (const tag of contextTags) if (!classifications.includes(tag)) classifications.push(tag);
    const responseEnd = bucket.endMs + settings.continuationWindowMs;
    const responseStartIndex = firstTradeAfter(trades, bucket.endMs);
    const responseEndIndex = firstTradeAfter(trades, responseEnd);
    const later = trades.slice(responseStartIndex, responseEndIndex);
    const latestPrice = later.at(-1)?.price ?? bucket.lastPrice;
    const extensionTicks = direction === "buy" ? (latestPrice - bucket.lastPrice) / tickSize : direction === "sell" ? (bucket.lastPrice - latestPrice) / tickSize : 0;
    const reversalTicks = direction === "buy" ? (bucket.lastPrice - latestPrice) / tickSize : direction === "sell" ? (latestPrice - bucket.lastPrice) / tickSize : 0;
    const response: TapeBurstResponse = direction === "neutral" ? "exhaustion" : extensionTicks >= settings.continuationTicks ? "continuation" : reversalTicks >= settings.rejectionTicks ? "rejection" : later.length ? "decelerating" : "developing";
    const directionalShare = Math.max(bucket.buyShare, bucket.sellShare);
    const score = Math.round(clamp(
      25 + Math.min(25, bucket.contractsPerSecond / Math.max(1, settings.minimumContractsPerSecond) * 10)
      + Math.min(15, bucket.tradesPerSecond / Math.max(1, settings.minimumTradesPerSecond) * 5)
      + (deltaGate ? 15 : 0) + (directionalShare >= settings.minimumDirectionalShare ? 10 : 0) + Math.min(10, contextTags.length * 4),
      0, 100,
    ));
    events.push({
      id: `${input.instrumentId}:${bucket.startMs}:${bucket.endMs}:${direction}`,
      bucketId: bucket.id, startMs: bucket.startMs, endMs: bucket.endMs, direction, classifications, response,
      lowPrice: bucket.lowPrice, highPrice: bucket.highPrice, anchorPrice: direction === "sell" ? bucket.lowPrice : bucket.highPrice,
      totalQuantity: bucket.totalQuantity, delta: bucket.delta, tradeCount: bucket.totalTrades, contractsPerSecond: bucket.contractsPerSecond,
      tradesPerSecond: bucket.tradesPerSecond, deltaPerSecond: bucket.deltaPerSecond, acceleration: bucket.acceleration,
      largestTrade: bucket.largestTrade, directionalShare, score, qualityScore: bucket.qualityScore, contextTags,
      warnings: bucket.unknownQuantity > 0 ? [`${Math.round(bucket.unknownQuantity)} unknown-side contracts excluded from directional metrics.`] : [],
    });
  }
  const latest = buckets.at(-1) ?? null;
  const newestTradeMs = trades.at(-1)!.timestampMs;
  const latestQuality = latest?.qualityScore ?? 0;
  const status: TapeSpeedStatus = settings.dynamicBaselineEnabled && buckets.length < settings.minimumBaselineSamples
    ? "WARMING UP"
    : nowMs - newestTradeMs <= settings.staleAfterMs
      ? "LIVE"
      : nowMs - newestTradeMs > Math.max(settings.staleAfterMs * 12, 60_000)
        ? "HISTORICAL"
        : "STALE";
  const statusMessage = status === "LIVE" ? "Shared Rithmic execution tape is current." : status === "WARMING UP" ? `Building dynamic baseline (${buckets.length}/${settings.minimumBaselineSamples}).` : status === "STALE" ? "Execution tape is delayed; the last valid frame remains visible." : "Showing recorded execution history; waiting for the next live print.";
  return { status, statusMessage, tickSize, buckets, events: events.slice(-settings.maximumEvents), latest, dataQualityScore: latestQuality, warnings: [] };
}

const tapeFrameCache = new Map<string, TapeSpeedFrame>();

export function buildTapeSpeedFrame(input: TapeSpeedFrameInput): TapeSpeedFrame {
  const settings = normalizeTapeSpeedSettings(input.settings);
  const nowMs = input.nowMs ?? Date.now();
  const firstTrade = input.trades[0];
  const lastTrade = input.trades.at(-1);
  const lastBar = input.chartBars?.at(-1);
  const lastContext = input.contextEvents?.at(-1);
  // Live updates are intentionally coalesced to the configured display step.
  // Every chart still consumes the same execution tape, but identical panels
  // no longer rebuild thousands of rolling buckets several times per frame.
  const liveRevision = input.nowMs === undefined
    ? `${Math.floor(nowMs / settings.updateStepMs)}:${Math.floor((lastTrade?.timestamp ?? 0) / settings.updateStepMs)}`
    : `${input.trades.length}:${firstTrade?.eventId ?? firstTrade?.timestamp ?? 0}:${lastTrade?.eventId ?? lastTrade?.timestamp ?? 0}`;
  const cacheKey = [
    input.instrumentId,
    input.tickSize,
    liveRevision,
    lastBar?.timestamp ?? 0,
    input.contextEvents?.length ?? 0,
    lastContext?.endMs ?? 0,
    JSON.stringify(settings),
  ].join("|");
  const cached = tapeFrameCache.get(cacheKey);
  if (cached) return cached;
  const frame = calculateTapeSpeedFrame(input, settings, nowMs);
  tapeFrameCache.set(cacheKey, frame);
  while (tapeFrameCache.size > 24) tapeFrameCache.delete(tapeFrameCache.keys().next().value!);
  return frame;
}

export function tapeSpeedPaneSeries(frame: TapeSpeedFrame, instanceId: string, settingsInput: Record<string, unknown> | TapeSpeedSettings): CalculatedIndicatorSeries[] {
  const settings = normalizeTapeSpeedSettings(settingsInput);
  const pointValue = (bucket: TapeSpeedBucket, side: "buy" | "sell" | "total" | "delta") => {
    if (settings.paneMode === "trades-per-second") return side === "buy" ? bucket.buyTrades / (bucket.durationMs / 1_000) : side === "sell" ? bucket.sellTrades / (bucket.durationMs / 1_000) : side === "delta" ? (bucket.buyTrades - bucket.sellTrades) / (bucket.durationMs / 1_000) : bucket.tradesPerSecond;
    if (settings.paneMode === "delta-per-second") return side === "buy" ? Math.max(0, bucket.deltaPerSecond) : side === "sell" ? Math.max(0, -bucket.deltaPerSecond) : side === "delta" ? bucket.deltaPerSecond : Math.abs(bucket.deltaPerSecond);
    return side === "buy" ? bucket.buyContractsPerSecond : side === "sell" ? bucket.sellContractsPerSecond : side === "delta" ? bucket.deltaPerSecond : bucket.contractsPerSecond;
  };
  const data = (side: "buy" | "sell" | "total" | "delta", sign = 1) => frame.buckets.map((bucket) => ({ time: Math.floor(bucket.endMs / 1_000), value: pointValue(bucket, side) * sign }));
  return [
    ...(settings.showBuySpeed ? [{ key: `${instanceId}-buy-speed`, label: "Buy speed", kind: "histogram" as const, placement: "pane" as const, color: settings.buyColor, includeZeroInScale: true, showZeroLine: true, data: data("buy") }] : []),
    ...(settings.showSellSpeed ? [{ key: `${instanceId}-sell-speed`, label: "Sell speed", kind: "histogram" as const, placement: "pane" as const, color: settings.sellColor, includeZeroInScale: true, showZeroLine: true, data: data("sell", -1) }] : []),
    ...(settings.showTotalSpeed ? [{ key: `${instanceId}-total-speed`, label: "Total speed", kind: "line" as const, placement: "pane" as const, color: settings.totalColor, lineWidth: 2 as const, includeZeroInScale: true, data: data("total") }] : []),
    ...(settings.showDeltaSpeed ? [{ key: `${instanceId}-delta-speed`, label: "Delta / sec", kind: "line" as const, placement: "pane" as const, color: settings.neutralColor, lineWidth: 1 as const, includeZeroInScale: true, data: data("delta") }] : []),
  ];
}
