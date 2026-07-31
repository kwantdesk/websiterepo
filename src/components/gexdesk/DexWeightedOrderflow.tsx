"use client";

import {
  Activity,
  Crosshair,
  Gauge,
  Radio,
  Sparkles,
  TriangleAlert,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import type {
  GexDeskHistoryPayload,
  GexDeskOptionPrint,
  GexDeskPayload,
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";

type SourceFilter = "COMBINED" | GexDeskSourceSymbol;
type Aggregation = 1_000 | 5_000 | 15_000 | 30_000 | 60_000 | 300_000;
type ExpiryFilter = "ALL" | "0DTE" | "1DTE" | "LATER";
type ConfidenceFilter = "ALL" | "HIGH_MEDIUM" | "HIGH";
type ViewMode = "COMPOSITION" | "NET";
type ValueMode = "RAW" | "Z_SCORE" | "PERCENTILE";
type Smoothing = 0 | 5 | 10 | 20;
type WeightingMode = "DEX" | "GEX" | "CONVEXITY";
type GexUnit = "DOLLAR_1PCT" | "SHARE_POINT";
type Structure = "LONG_CALL" | "SHORT_PUT" | "LONG_PUT" | "SHORT_CALL";
type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

type DexContribution = {
  id: string;
  timestamp: number;
  strike: number;
  expiration: string | null;
  delta: number;
  contracts: number;
  dex: number;
  signedDex: number;
  directionalDex: number;
  signedDirectionalDex: number;
  gamma: number;
  confidence: number;
  tier: ConfidenceTier;
  structure: Structure;
  source: GexDeskSourceSymbol;
  complexTrade: boolean;
  greekMethod: GexDeskOptionPrint["greekMethod"];
  moneyness: string;
};

type DexBucket = {
  timestamp: number;
  longCall: number;
  shortPut: number;
  longPut: number;
  shortCall: number;
  bullish: number;
  bearish: number;
  net: number;
  cumulative: number;
  convexity: number;
  directionalDex: number;
  dexZScore: number;
  dexPercentile: number;
  confidence: number;
  high: number;
  medium: number;
  low: number;
  complex: number;
  contracts: number;
  prints: number;
  price: number | null;
  zScore: number;
  percentile: number;
  ema: number;
  strikes: Array<{ label: string; value: number }>;
  expiries: Array<{ label: string; value: number }>;
  deltaBuckets: Array<{ label: string; value: number }>;
  moneynessBuckets: Array<{ label: string; value: number }>;
  dominant: Structure | null;
};

type MutableBucket = {
  timestamp: number;
  metricNet: number;
  longCall: number;
  shortPut: number;
  longPut: number;
  shortCall: number;
  convexity: number;
  directionalDex: number;
  weightedConfidence: number;
  high: number;
  medium: number;
  low: number;
  complex: number;
  contracts: number;
  prints: number;
  strikes: Map<string, number>;
  expiries: Map<string, number>;
  deltaBuckets: Map<string, number>;
  moneynessBuckets: Map<string, number>;
};

const AGGREGATIONS: Array<{ value: Aggregation; label: string }> = [
  { value: 1_000, label: "1s" },
  { value: 5_000, label: "5s" },
  { value: 15_000, label: "15s" },
  { value: 30_000, label: "30s" },
  { value: 60_000, label: "1m" },
  { value: 300_000, label: "5m" },
];
const VISIBLE_BARS = 72;
const SVG_WIDTH = 1_180;
const SVG_HEIGHT = 600;
const PLOT_LEFT = 58;
const PLOT_RIGHT = 866;
const SIDE_LEFT = 894;
const PRICE_TOP = 32;
const PRICE_BOTTOM = 170;
const DEX_TOP = 205;
const DEX_ZERO = 306;
const DEX_BOTTOM = 407;
const CUM_TOP = 455;
const CUM_BOTTOM = 560;

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function safeTimestamp(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 1e18) return Math.floor(value / 1e6);
  if (value >= 1e15) return Math.floor(value / 1e3);
  if (value >= 1e12) return Math.floor(value);
  if (value >= 1e9) return Math.floor(value * 1_000);
  return null;
}

function nextBusinessDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  do value.setUTCDate(value.getUTCDate() + 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

function expiryMatches(print: GexDeskOptionPrint, filter: ExpiryFilter, sessionDate: string) {
  if (filter === "ALL") return true;
  if (filter === "0DTE") return print.expiration === sessionDate;
  if (filter === "1DTE") return print.expiration === nextBusinessDate(sessionDate);
  return Boolean(print.expiration && print.expiration > nextBusinessDate(sessionDate));
}

function confidenceTier(value: number): ConfidenceTier {
  if (value >= 0.85) return "HIGH";
  if (value >= 0.5) return "MEDIUM";
  return "LOW";
}

function structureFor(print: GexDeskOptionPrint): Structure | null {
  if (print.side === "MID") return null;
  if (print.contractType === "CALL") {
    return print.side === "BOUGHT" ? "LONG_CALL" : "SHORT_CALL";
  }
  return print.side === "BOUGHT" ? "LONG_PUT" : "SHORT_PUT";
}

function signedDirection(structure: Structure) {
  return structure === "LONG_CALL" || structure === "SHORT_PUT" ? 1 : -1;
}

function structureLabel(structure: Structure | null) {
  if (structure === "LONG_CALL") return "Long calls";
  if (structure === "SHORT_PUT") return "Short puts";
  if (structure === "LONG_PUT") return "Long puts";
  if (structure === "SHORT_CALL") return "Short calls";
  return "No classified flow";
}

function compact(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${(absolute / 1e6).toFixed(2)}M`;
  if (absolute >= 1e3) return `${(absolute / 1e3).toFixed(1)}K`;
  return absolute.toFixed(0);
}

function signedCompact(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${compact(value)}`;
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function timeLabel(timestamp: number, seconds = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hour12: false,
  }).format(new Date(timestamp));
}

function expiryLabel(expiration: string | null, sessionDate: string) {
  if (!expiration) return "Unknown";
  if (expiration === sessionDate) return "0DTE";
  if (expiration === nextBusinessDate(sessionDate)) return "1DTE";
  return "Later";
}

function deltaBucketLabel(delta: number) {
  const absolute = Math.abs(delta);
  if (absolute < 0.2) return "0.00–0.20";
  if (absolute < 0.4) return "0.20–0.40";
  if (absolute < 0.6) return "0.40–0.60";
  if (absolute < 0.8) return "0.60–0.80";
  return "0.80–1.00";
}

function moneynessLabel(print: GexDeskOptionPrint) {
  const spot = Number(print.underlyingPrice);
  const strike = Number(print.strike);
  if (!Number.isFinite(spot) || spot <= 0 || !Number.isFinite(strike) || strike <= 0) {
    return "Unknown";
  }
  const distance = Math.abs(strike / spot - 1);
  if (distance <= 0.005) return "Near ATM";
  const inTheMoney = print.contractType === "CALL" ? strike < spot : strike > spot;
  if (inTheMoney) return distance >= 0.03 ? "Deep ITM" : "ITM";
  return distance >= 0.03 ? "Deep OTM" : "OTM";
}

function emptyMutableBucket(timestamp: number): MutableBucket {
  return {
    timestamp,
    metricNet: 0,
    longCall: 0,
    shortPut: 0,
    longPut: 0,
    shortCall: 0,
    convexity: 0,
    directionalDex: 0,
    weightedConfidence: 0,
    high: 0,
    medium: 0,
    low: 0,
    complex: 0,
    contracts: 0,
    prints: 0,
    strikes: new Map(),
    expiries: new Map(),
    deltaBuckets: new Map(),
    moneynessBuckets: new Map(),
  };
}

function mapEntries(
  values: Map<string, number>,
  limit = 5,
) {
  return [...values.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
    .slice(0, limit);
}

function nearestHistoryPrice(
  history: GexDeskHistoryPayload | null,
  timestamp: number,
) {
  if (!history?.timestamps.length || !history.nqPrices.length) return null;
  let low = 0;
  let high = history.timestamps.length - 1;
  let nearestIndex = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = safeTimestamp(Number(history.timestamps[middle]));
    if (candidate === null) {
      low = middle + 1;
      continue;
    }
    nearestIndex = middle;
    if (candidate < timestamp) low = middle + 1;
    else if (candidate > timestamp) high = middle - 1;
    else break;
  }
  const candidates = [nearestIndex, nearestIndex - 1, nearestIndex + 1]
    .filter((index) => index >= 0 && index < history.timestamps.length);
  const best = candidates.reduce((selected, index) => {
    const selectedTimestamp = safeTimestamp(Number(history.timestamps[selected])) ?? 0;
    const candidateTimestamp = safeTimestamp(Number(history.timestamps[index])) ?? 0;
    return Math.abs(candidateTimestamp - timestamp) < Math.abs(selectedTimestamp - timestamp)
      ? index
      : selected;
  }, candidates[0] ?? 0);
  const price = Number(history.nqPrices[best]);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function contributionsFromPrints(
  prints: GexDeskOptionPrint[],
  args: {
    sourceFilter: SourceFilter;
    expiryFilter: ExpiryFilter;
    confidenceFilter: ConfidenceFilter;
    minimumSize: number;
    sessionDate: string;
    weighting: WeightingMode;
    gexUnit: GexUnit;
  },
) {
  const rows: DexContribution[] = [];
  let midPrints = 0;
  let unweightedPrints = 0;
  for (const print of prints) {
    const timestamp = safeTimestamp(Number(print.timestamp));
    if (timestamp === null) continue;
    if (args.sourceFilter !== "COMBINED" && print.source !== args.sourceFilter) continue;
    if (!expiryMatches(print, args.expiryFilter, args.sessionDate)) continue;
    const contracts = Number(print.size);
    if (!Number.isFinite(contracts) || contracts < args.minimumSize || contracts <= 0) continue;
    const structure = structureFor(print);
    if (structure === null) {
      midPrints += 1;
      continue;
    }
    const confidence = clamp(Number(print.confidence) || 0, 0, 1);
    const tier = confidenceTier(confidence);
    if (args.confidenceFilter === "HIGH" && tier !== "HIGH") continue;
    if (args.confidenceFilter === "HIGH_MEDIUM" && tier === "LOW") continue;
    const delta = Number(print.optionDelta);
    const validDelta = Number.isFinite(delta) && Math.abs(delta) > 0 && Math.abs(delta) <= 1.001;
    const directionalDex = validDelta ? Math.abs(delta) * contracts * 100 : 0;
    const gamma = Number(print.optionGamma);
    const shareGamma = Number.isFinite(gamma) && gamma > 0
      ? gamma * contracts * 100
      : 0;
    const spot = Number(print.underlyingPrice);
    const dollarGamma = shareGamma > 0 && Number.isFinite(spot) && spot > 0
      ? shareGamma * spot * spot * 0.01
      : 0;
    const weightedValue = args.weighting === "DEX"
      ? directionalDex
      : args.gexUnit === "DOLLAR_1PCT" ? dollarGamma : shareGamma;
    if (!Number.isFinite(weightedValue) || weightedValue <= 0) {
      unweightedPrints += 1;
      continue;
    }
    rows.push({
      id: print.id,
      timestamp,
      strike: Number(print.strike),
      expiration: print.expiration,
      delta,
      contracts,
      dex: weightedValue,
      signedDex: weightedValue * (
        args.weighting === "CONVEXITY"
          ? print.side === "BOUGHT" ? 1 : -1
          : signedDirection(structure)
      ),
      directionalDex,
      signedDirectionalDex: directionalDex * signedDirection(structure),
      gamma: (args.weighting === "DEX"
        ? shareGamma
        : args.gexUnit === "DOLLAR_1PCT" ? dollarGamma : shareGamma)
        * (print.side === "BOUGHT" ? 1 : -1),
      confidence,
      tier,
      structure,
      source: print.source,
      complexTrade: Boolean(print.complexTrade),
      greekMethod: print.greekMethod,
      moneyness: moneynessLabel(print),
    });
  }
  return { rows, midPrints, unweightedPrints };
}

function aggregateContributions(
  rows: DexContribution[],
  aggregation: Aggregation,
  history: GexDeskHistoryPayload | null,
  livePrice: number | null,
  fallbackPrice: number | null,
  marketOpen: boolean,
) {
  const grouped = new Map<number, MutableBucket>();
  for (const row of rows) {
    const timestamp = Math.floor(row.timestamp / aggregation) * aggregation;
    const bucket = grouped.get(timestamp) ?? emptyMutableBucket(timestamp);
    if (row.structure === "LONG_CALL") bucket.longCall += row.dex;
    else if (row.structure === "SHORT_PUT") bucket.shortPut += row.dex;
    else if (row.structure === "LONG_PUT") bucket.longPut += row.dex;
    else bucket.shortCall += row.dex;
    bucket.metricNet += row.signedDex;
    bucket.convexity += row.gamma;
    bucket.directionalDex += row.signedDirectionalDex;
    bucket.weightedConfidence += row.dex * row.confidence;
    bucket[row.tier.toLowerCase() as "high" | "medium" | "low"] += row.dex;
    if (row.complexTrade) bucket.complex += row.dex;
    bucket.contracts += row.contracts;
    bucket.prints += 1;
    const signed = row.signedDex;
    const strikeKey = `${Number.isFinite(row.strike) ? row.strike.toLocaleString("en-US") : "Unknown"} ${row.structure.includes("CALL") ? "C" : "P"}`;
    bucket.strikes.set(strikeKey, (bucket.strikes.get(strikeKey) ?? 0) + signed);
    const expiration = row.expiration ?? "Unknown";
    bucket.expiries.set(expiration, (bucket.expiries.get(expiration) ?? 0) + Math.abs(row.dex));
    const deltaLabel = deltaBucketLabel(row.delta);
    bucket.deltaBuckets.set(deltaLabel, (bucket.deltaBuckets.get(deltaLabel) ?? 0) + Math.abs(row.dex));
    bucket.moneynessBuckets.set(
      row.moneyness,
      (bucket.moneynessBuckets.get(row.moneyness) ?? 0) + Math.abs(row.dex),
    );
    grouped.set(timestamp, bucket);
  }

  const groupedTimes = [...grouped.keys()].sort((left, right) => left - right);
  const latestHistoryTime = history?.timestamps.length
    ? safeTimestamp(Number(history.timestamps.at(-1))) ?? 0
    : 0;
  const latestPrintTime = groupedTimes.at(-1) ?? 0;
  const wallClock = marketOpen ? Date.now() : 0;
  const endTime = Math.floor(Math.max(latestPrintTime, latestHistoryTime, wallClock) / aggregation) * aggregation;
  const visibleStart = Math.max(0, endTime - (VISIBLE_BARS - 1) * aggregation);
  const visibleTimes = Array.from(
    { length: VISIBLE_BARS },
    (_, index) => visibleStart + index * aggregation,
  );
  let cumulative = groupedTimes
    .filter((timestamp) => timestamp < visibleStart)
    .reduce((sum, timestamp) => {
      const row = grouped.get(timestamp)!;
      return sum + row.metricNet;
    }, 0);

  const activeNets = groupedTimes.map((timestamp) => {
    const row = grouped.get(timestamp)!;
    return row.metricNet;
  });
  const activeDexNets = groupedTimes.map((timestamp) => grouped.get(timestamp)!.directionalDex);
  const mean = activeNets.length
    ? activeNets.reduce((sum, value) => sum + value, 0) / activeNets.length
    : 0;
  const deviation = Math.sqrt(
    activeNets.reduce((sum, value) => sum + (value - mean) ** 2, 0)
    / Math.max(1, activeNets.length - 1),
  );
  const sortedMagnitude = activeNets.map(Math.abs).sort((left, right) => left - right);
  const dexMean = activeDexNets.length
    ? activeDexNets.reduce((sum, value) => sum + value, 0) / activeDexNets.length
    : 0;
  const dexDeviation = Math.sqrt(
    activeDexNets.reduce((sum, value) => sum + (value - dexMean) ** 2, 0)
    / Math.max(1, activeDexNets.length - 1),
  );
  const sortedDexMagnitude = activeDexNets.map(Math.abs).sort((left, right) => left - right);
  const base: DexBucket[] = visibleTimes.map((timestamp, index) => {
    const row = grouped.get(timestamp) ?? emptyMutableBucket(timestamp);
    const bullish = row.longCall + row.shortPut;
    const bearish = row.longPut + row.shortCall;
    const net = row.metricNet;
    cumulative += net;
    const gross = bullish + bearish;
    const magnitudeRank = sortedMagnitude.length
      ? sortedMagnitude.filter((value) => value <= Math.abs(net)).length / sortedMagnitude.length
      : 0;
    const dexMagnitudeRank = sortedDexMagnitude.length
      ? sortedDexMagnitude.filter((value) => value <= Math.abs(row.directionalDex)).length / sortedDexMagnitude.length
      : 0;
    const structures: Array<[Structure, number]> = [
      ["LONG_CALL", row.longCall],
      ["SHORT_PUT", row.shortPut],
      ["LONG_PUT", row.longPut],
      ["SHORT_CALL", row.shortCall],
    ];
    const dominant = structures.sort((left, right) => right[1] - left[1])[0];
    const historyPrice = nearestHistoryPrice(history, timestamp + aggregation / 2);
    const price = index === visibleTimes.length - 1 && livePrice !== null
      ? livePrice
      : historyPrice ?? (index === visibleTimes.length - 1 ? fallbackPrice : null);
    return {
      timestamp,
      longCall: row.longCall,
      shortPut: row.shortPut,
      longPut: row.longPut,
      shortCall: row.shortCall,
      bullish,
      bearish,
      net,
      cumulative,
      convexity: row.convexity,
      directionalDex: row.directionalDex,
      dexZScore: dexDeviation > 0 ? (row.directionalDex - dexMean) / dexDeviation : 0,
      dexPercentile: (row.directionalDex < 0 ? -1 : row.directionalDex > 0 ? 1 : 0) * dexMagnitudeRank * 100,
      confidence: gross > 0 ? row.weightedConfidence / gross : 0,
      high: row.high,
      medium: row.medium,
      low: row.low,
      complex: row.complex,
      contracts: row.contracts,
      prints: row.prints,
      price,
      zScore: deviation > 0 ? (net - mean) / deviation : 0,
      percentile: (net < 0 ? -1 : net > 0 ? 1 : 0) * magnitudeRank * 100,
      ema: 0,
      strikes: mapEntries(row.strikes, 4),
      expiries: mapEntries(row.expiries, 4),
      deltaBuckets: mapEntries(row.deltaBuckets, 5),
      moneynessBuckets: mapEntries(row.moneynessBuckets, 5),
      dominant: dominant && dominant[1] > 0 ? dominant[0] : null,
    };
  });
  return { buckets: base, distribution: { mean, deviation }, groupedTimes };
}

function withEma(buckets: DexBucket[], smoothing: Smoothing) {
  if (!smoothing) return buckets.map((bucket) => ({ ...bucket, ema: bucket.net }));
  const alpha = 2 / (smoothing + 1);
  let ema = buckets[0]?.net ?? 0;
  return buckets.map((bucket, index) => {
    ema = index === 0 ? bucket.net : bucket.net * alpha + ema * (1 - alpha);
    return { ...bucket, ema };
  });
}

function linePath(
  points: Array<{ x: number; y: number | null }>,
) {
  let started = false;
  return points.map((point) => {
    if (point.y === null || !Number.isFinite(point.y)) {
      started = false;
      return "";
    }
    const command = started ? "L" : "M";
    started = true;
    return `${command}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).filter(Boolean).join(" ");
}

function selectedFlowLabel(bucket: DexBucket, weighting: WeightingMode) {
  if (!bucket.prints) return "No classified flow";
  if (weighting === "CONVEXITY") {
    const dexStrong = Math.abs(bucket.dexPercentile) >= 55;
    const convexityStrong = Math.abs(bucket.percentile) >= 55;
    if (!dexStrong && !convexityStrong) return "Balanced gamma demand and supply";
    if (bucket.directionalDex > 0 && bucket.net > 0) return "Long-call-driven rally";
    if (bucket.directionalDex > 0 && bucket.net < 0) return "Short-put-driven rally";
    if (bucket.directionalDex < 0 && bucket.net > 0) return "Long-put-driven selloff";
    if (bucket.directionalDex < 0 && bucket.net < 0) return "Short-call-driven weakness";
    return bucket.net >= 0 ? "Long-gamma demand" : "Short-gamma supply";
  }
  if (weighting === "GEX") {
    const dexStrong = Math.abs(bucket.dexPercentile) >= 70;
    const gexStrong = Math.abs(bucket.percentile) >= 70;
    if (!dexStrong && !gexStrong) return "Low directional and gamma pressure";
    if (bucket.directionalDex > 0 && bucket.net > 0) {
      return dexStrong && gexStrong
        ? "Bullish flow + high gamma urgency"
        : dexStrong ? "Bullish size / lower gamma urgency" : "Lower size / high positive gamma";
    }
    if (bucket.directionalDex < 0 && bucket.net < 0) {
      return dexStrong && gexStrong
        ? "Bearish flow + high gamma urgency"
        : dexStrong ? "Bearish size / lower gamma urgency" : "Lower size / high negative gamma";
    }
    if (bucket.directionalDex < 0 && bucket.net > 0) return "Mixed: bearish DEX / positive GEX";
    if (bucket.directionalDex > 0 && bucket.net < 0) return "Mixed: bullish DEX / negative GEX";
    return bucket.net >= 0 ? "Positive gamma sensitivity" : "Negative gamma sensitivity";
  }
  if (Math.abs(bucket.net) < Math.max(bucket.bullish, bucket.bearish) * 0.08) return "Balanced two-way flow";
  if (bucket.net > 0 && bucket.convexity >= 0) return "Long-call-led bullish flow";
  if (bucket.net > 0) return "Short-put-led bullish flow";
  if (bucket.convexity >= 0) return "Long-put-led bearish flow";
  return "Short-call-led bearish flow";
}

type OrderflowProps = {
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  livePrice: number | null;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (source: SourceFilter) => void;
};

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background/35 px-3 py-2.5">
      <div className="text-[6px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 truncate font-mono text-[12px] font-semibold text-foreground">{value}</div>
      <div className="mt-1 truncate text-[6px] text-muted">{detail}</div>
    </div>
  );
}

function TinyMeter({
  label,
  value,
  maximum,
  tone = "bg-primary",
}: {
  label: string;
  value: number;
  maximum: number;
  tone?: string;
}) {
  const width = maximum > 0 ? clamp(Math.abs(value) / maximum * 100, 0, 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[6px]">
        <span className="truncate text-muted">{label}</span>
        <span className="font-mono text-foreground">{compact(value)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function DexWeightedOrderflow({
  payload,
  history,
  livePrice,
  sourceFilter,
  onSourceFilterChange,
  weighting = "DEX",
}: OrderflowProps & { weighting?: WeightingMode }) {
  const [aggregation, setAggregation] = useState<Aggregation>(15_000);
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("HIGH_MEDIUM");
  const [minimumSize, setMinimumSize] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("COMPOSITION");
  const [valueMode, setValueMode] = useState<ValueMode>("RAW");
  const [smoothing, setSmoothing] = useState<Smoothing>(10);
  const [gexUnit, setGexUnit] = useState<GexUnit>("DOLLAR_1PCT");
  const [selectedIndex, setSelectedIndex] = useState(VISIBLE_BARS - 1);
  const metricName = weighting === "CONVEXITY" ? "CONVEXITY" : weighting;
  const displayTitle = weighting === "CONVEXITY" ? "Convexity Orderflow" : `${metricName}-Weighted Orderflow`;
  const unitLabel = weighting !== "DEX"
    ? gexUnit === "DOLLAR_1PCT" ? "dollar gamma / 1% move" : "share gamma / point"
    : "underlying-equivalent shares";

  const tape = Array.isArray(payload.optionsTape) ? payload.optionsTape : [];
  const classified = useMemo(
    () => contributionsFromPrints(tape, {
      sourceFilter,
      expiryFilter,
      confidenceFilter,
      minimumSize,
      sessionDate: payload.sessionDate,
      weighting,
      gexUnit,
    }),
    [
      confidenceFilter,
      expiryFilter,
      minimumSize,
      payload.sessionDate,
      sourceFilter,
      tape,
      weighting,
      gexUnit,
    ],
  );
  const aggregationResult = useMemo(
    () => aggregateContributions(
      classified.rows,
      aggregation,
      history,
      livePrice,
      payload.nqPrice,
      payload.marketOpen,
    ),
    [aggregation, classified.rows, history, livePrice, payload.marketOpen, payload.nqPrice],
  );
  const buckets = useMemo(
    () => withEma(aggregationResult.buckets, smoothing),
    [aggregationResult.buckets, smoothing],
  );

  useEffect(() => {
    setSelectedIndex(VISIBLE_BARS - 1);
  }, [aggregation, confidenceFilter, expiryFilter, gexUnit, minimumSize, sourceFilter, weighting]);

  useEffect(() => {
    if (selectedIndex >= buckets.length) setSelectedIndex(Math.max(0, buckets.length - 1));
  }, [buckets.length, selectedIndex]);

  const selected = buckets[selectedIndex] ?? buckets.at(-1)!;
  const displayValue = (bucket: DexBucket) => (
    valueMode === "Z_SCORE" ? bucket.zScore
      : valueMode === "PERCENTILE" ? bucket.percentile
        : bucket.net
  );
  const positiveComposition = (bucket: DexBucket) => (
    weighting === "CONVEXITY" ? bucket.longCall + bucket.longPut : bucket.bullish
  );
  const negativeComposition = (bucket: DexBucket) => (
    weighting === "CONVEXITY" ? bucket.shortCall + bucket.shortPut : bucket.bearish
  );
  const maximumDex = Math.max(
    1,
    ...buckets.map((bucket) => (
      viewMode === "COMPOSITION" && valueMode === "RAW"
        ? Math.max(positiveComposition(bucket), negativeComposition(bucket))
        : Math.abs(displayValue(bucket))
    )),
    ...buckets.map((bucket) => valueMode === "RAW" ? Math.abs(bucket.ema) : 0),
  );
  const maximumCumulative = Math.max(1, ...buckets.map((bucket) => Math.abs(bucket.cumulative)));
  const prices = buckets.flatMap((bucket) => bucket.price === null ? [] : [bucket.price]);
  const fallbackPrice = livePrice ?? payload.nqPrice ?? 0;
  const rawPriceLow = prices.length ? Math.min(...prices) : fallbackPrice - 1;
  const rawPriceHigh = prices.length ? Math.max(...prices) : fallbackPrice + 1;
  const pricePadding = Math.max(4, (rawPriceHigh - rawPriceLow) * 0.18);
  const priceLow = rawPriceLow - pricePadding;
  const priceHigh = rawPriceHigh + pricePadding;
  const xFor = (index: number) => PLOT_LEFT
    + index / Math.max(1, buckets.length - 1) * (PLOT_RIGHT - PLOT_LEFT);
  const priceY = (price: number) => PRICE_TOP
    + (priceHigh - price) / Math.max(1, priceHigh - priceLow) * (PRICE_BOTTOM - PRICE_TOP);
  const dexY = (value: number) => DEX_ZERO
    - value / maximumDex * (DEX_ZERO - DEX_TOP);
  const boundedDexY = (value: number) => clamp(dexY(value), DEX_TOP, DEX_BOTTOM);
  const cumulativeY = (value: number) => (CUM_TOP + CUM_BOTTOM) / 2
    - value / maximumCumulative * ((CUM_BOTTOM - CUM_TOP) / 2 - 4);
  const barCell = (PLOT_RIGHT - PLOT_LEFT) / Math.max(1, buckets.length);
  const barWidth = Math.max(2, barCell * 0.7);
  const pricePath = linePath(
    buckets.map((bucket, index) => ({
      x: xFor(index),
      y: bucket.price === null ? null : priceY(bucket.price),
    })),
  );
  const emaPath = valueMode === "RAW" && smoothing
    ? linePath(buckets.map((bucket, index) => ({ x: xFor(index), y: dexY(bucket.ema) })))
    : "";
  const cumulativePath = linePath(
    buckets.map((bucket, index) => ({ x: xFor(index), y: cumulativeY(bucket.cumulative) })),
  );
  const selectedX = xFor(selectedIndex);
  const latestActive = [...buckets].reverse().find((bucket) => bucket.prints > 0) ?? selected;
  const recent = buckets.slice(-10);
  const recentActive = recent.filter((bucket) => bucket.prints > 0);
  const previousActive = recentActive.at(-2);
  const metricVelocity = latestActive.net - (previousActive?.net ?? latestActive.net);
  const flowTypeShift = Boolean(
    weighting === "CONVEXITY"
    && previousActive
    && Math.sign(previousActive.net) !== 0
    && Math.sign(latestActive.net) !== 0
    && Math.sign(previousActive.net) !== Math.sign(latestActive.net)
    && Math.sign(previousActive.directionalDex) === Math.sign(latestActive.directionalDex),
  );
  const positiveBars = recent.filter((bucket) => bucket.net > 0).length;
  const negativeBars = recent.filter((bucket) => bucket.net < 0).length;
  const persistenceDirection = positiveBars === negativeBars
    ? "balanced"
    : positiveBars > negativeBars ? "bullish" : "bearish";
  const persistence = Math.max(positiveBars, negativeBars) / Math.max(1, recent.length);
  const totalBullish = classified.rows.reduce(
    (sum, row) => sum + (row.signedDex > 0 ? row.dex : 0),
    0,
  );
  const totalBearish = classified.rows.reduce(
    (sum, row) => sum + (row.signedDex < 0 ? row.dex : 0),
    0,
  );
  const sessionNet = totalBullish - totalBearish;
  const sessionDirectionalDex = classified.rows.reduce(
    (sum, row) => sum + row.signedDirectionalDex,
    0,
  );
  const currentEnd = Math.max(
    classified.rows.at(-1)?.timestamp ?? 0,
    payload.marketOpen ? Date.now() : 0,
  );
  const netSince = (duration: number) => classified.rows
    .filter((row) => row.timestamp >= currentEnd - duration)
    .reduce((sum, row) => sum + row.signedDex, 0);
  const dexSince = (duration: number) => classified.rows
    .filter((row) => row.timestamp >= currentEnd - duration)
    .reduce((sum, row) => sum + row.signedDirectionalDex, 0);
  const currentOneMinute = netSince(60_000);
  const currentFiveMinutes = netSince(300_000);
  const currentDexOneMinute = dexSince(60_000);
  const currentDexFiveMinutes = dexSince(300_000);
  const sessionGross = totalBullish + totalBearish;
  const bullishShare = sessionGross > 0 ? totalBullish / sessionGross : 0.5;
  const quality = classified.rows.reduce(
    (result, row) => {
      result[row.tier.toLowerCase() as "high" | "medium" | "low"] += row.dex;
      if (row.complexTrade) result.complex += row.dex;
      if (row.greekMethod === "PROVIDER_IV_BLACK_SCHOLES") result.provider += row.dex;
      else if (row.greekMethod === "PRICE_IMPLIED_BLACK_SCHOLES") result.solved += row.dex;
      return result;
    },
    { high: 0, medium: 0, low: 0, complex: 0, provider: 0, solved: 0 },
  );
  const qualityGross = quality.high + quality.medium + quality.low;
  const qualityPercent = (value: number) => qualityGross > 0 ? value / qualityGross : 0;
  const selectedMagnitudePercentile = Math.abs(selected.percentile);
  const spike = selected.prints > 0 && (
    selectedMagnitudePercentile >= 99 || Math.abs(selected.zScore) >= 3
  );
  const priceChange = (recent.at(-1)?.price ?? 0) - (recent.find((bucket) => bucket.price !== null)?.price ?? 0);
  const metricChange = (recent.at(-1)?.cumulative ?? 0) - (recent[0]?.cumulative ?? 0);
  const divergence = Math.abs(priceChange) < Math.max(1, (priceHigh - priceLow) * 0.03)
    || Math.abs(metricChange) < maximumCumulative * 0.04
    ? "NONE"
    : priceChange > 0 && metricChange < 0
      ? "BEARISH"
      : priceChange < 0 && metricChange > 0
        ? "BULLISH"
        : "CONFIRMING";
  const nearestZones = payload.zones
    .filter((zone) => zone.center >= priceLow && zone.center <= priceHigh)
    .sort((left, right) => Math.abs(left.center - fallbackPrice) - Math.abs(right.center - fallbackPrice))
    .slice(0, 3);
  const strikeMaximum = Math.max(1, ...selected.strikes.map((row) => Math.abs(row.value)));
  const expiryMaximum = Math.max(1, ...selected.expiries.map((row) => Math.abs(row.value)));
  const attributionBuckets = weighting !== "DEX" ? selected.moneynessBuckets : selected.deltaBuckets;
  const attributionMaximum = Math.max(1, ...attributionBuckets.map((row) => Math.abs(row.value)));
  const quadrantDexMaximum = Math.max(1, ...recent.map((bucket) => Math.abs(bucket.directionalDex)));
  const quadrantGexMaximum = Math.max(1, ...recent.map((bucket) => Math.abs(bucket.net)));
  const quadrantPoints = recent.map((bucket) => ({
    x: 100 + bucket.directionalDex / quadrantDexMaximum * 82,
    y: 40 - bucket.net / quadrantGexMaximum * 31,
  }));
  const quadrantPath = linePath(quadrantPoints);

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_10%,transparent)]">
            <Waves className="h-3.5 w-3.5" />
          </span>
          <div className="hidden min-w-0 sm:block">
            <div className="text-[8px] font-semibold">{displayTitle}</div>
            <div className="text-[6px] uppercase tracking-[0.12em] text-muted">
              {weighting === "GEX"
                ? "Gamma sensitivity + potential hedge acceleration"
                : weighting === "CONVEXITY"
                  ? "Long-option gamma demand vs short-option gamma supply"
                  : "NDX / QQQ options → NQ price context"}
            </div>
          </div>
        </div>

        <KwantSelect
          value={sourceFilter}
          onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)}
          menuLabel="Options source"
          className="h-8 min-w-28 rounded-xl border border-border bg-surface px-2.5 text-[7px] font-semibold"
        >
          <option value="COMBINED">NDX + QQQ</option>
          <option value="NDX">NDX</option>
          <option value="QQQ">QQQ</option>
        </KwantSelect>

        <div className="flex items-center rounded-xl border border-border bg-surface p-0.5">
          {AGGREGATIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setAggregation(option.value)}
              className={`h-7 rounded-[9px] px-2 text-[6px] font-semibold transition ${
                aggregation === option.value
                  ? "bg-primary/[0.12] text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <KwantSelect
          value={expiryFilter}
          onChange={(event) => setExpiryFilter(event.target.value as ExpiryFilter)}
          menuLabel="Expiry scope"
          className="h-8 min-w-20 rounded-xl border border-border bg-surface px-2.5 text-[7px] font-semibold"
        >
          <option value="ALL">All expiry</option>
          <option value="0DTE">0DTE</option>
          <option value="1DTE">1DTE</option>
          <option value="LATER">Weekly + later</option>
        </KwantSelect>

        <KwantSelect
          value={confidenceFilter}
          onChange={(event) => setConfidenceFilter(event.target.value as ConfidenceFilter)}
          menuLabel="Classification confidence"
          className="h-8 min-w-28 rounded-xl border border-border bg-surface px-2.5 text-[7px] font-semibold"
        >
          <option value="ALL">All confidence</option>
          <option value="HIGH_MEDIUM">High + medium</option>
          <option value="HIGH">High only</option>
        </KwantSelect>

        {weighting !== "DEX" ? (
          <KwantSelect
            value={gexUnit}
            onChange={(event) => setGexUnit(event.target.value as GexUnit)}
            menuLabel={`${weighting === "CONVEXITY" ? "Convexity" : "GEX"} display unit`}
            className="h-8 min-w-32 rounded-xl border border-border bg-surface px-2.5 text-[7px] font-semibold"
          >
            <option value="DOLLAR_1PCT">Dollar GEX / 1%</option>
            <option value="SHARE_POINT">Share gamma / point</option>
          </KwantSelect>
        ) : null}

        <label className="flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 text-[6px] text-muted">
          Min
          <input
            type="number"
            min="0"
            step="10"
            value={minimumSize}
            onChange={(event) => setMinimumSize(Math.max(0, Number(event.target.value) || 0))}
            className="w-10 bg-transparent font-mono text-[7px] text-foreground outline-none"
          />
        </label>

        <span className={`ml-auto flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[6px] font-semibold ${
          payload.marketOpen
            ? "border-primary/25 bg-primary/[0.06] text-primary"
            : "border-border bg-surface text-muted"
        }`}>
          <Radio className={`h-3 w-3 ${payload.marketOpen ? "animate-pulse" : ""}`} />
          {payload.marketOpen ? "LIVE OPTIONS" : "EOD FROZEN"}
        </span>
      </div>

      <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
        <div className="flex items-center rounded-xl border border-border bg-surface p-0.5">
          {(["COMPOSITION", "NET"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`h-7 rounded-[9px] px-2.5 text-[6px] font-semibold transition ${
                viewMode === mode ? "bg-primary/[0.12] text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              {mode === "COMPOSITION" ? "4-part composition" : "Net flow"}
            </button>
          ))}
        </div>
        <div className="flex items-center rounded-xl border border-border bg-surface p-0.5">
          {(["RAW", "Z_SCORE", "PERCENTILE"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setValueMode(mode)}
              className={`h-7 rounded-[9px] px-2.5 text-[6px] font-semibold transition ${
                valueMode === mode ? "bg-primary/[0.12] text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              {mode === "Z_SCORE" ? "Z-score" : mode === "PERCENTILE" ? "Percentile" : `Raw ${metricName}`}
            </button>
          ))}
        </div>
        <KwantSelect
          value={String(smoothing)}
          onChange={(event) => setSmoothing(Number(event.target.value) as Smoothing)}
          menuLabel={`${metricName} smoothing`}
          className="h-8 min-w-24 rounded-xl border border-border bg-surface px-2.5 text-[7px] font-semibold"
        >
          <option value="0">EMA off</option>
          <option value="5">EMA 5</option>
          <option value="10">EMA 10</option>
          <option value="20">EMA 20</option>
        </KwantSelect>
        <div className="ml-auto flex items-center gap-3 text-[6px] text-muted">
          <span><strong className="text-primary">PRIMARY</strong> calls</span>
          <span><strong className="text-accent">ACCENT</strong> puts</span>
          <span><strong className="text-primary">SOLID</strong> bought / long volatility</span>
          <span><strong className="text-accent">STRIPED</strong> sold / short volatility</span>
          <span>Unit: {unitLabel}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-2.5">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="h-full w-full rounded-2xl border border-border bg-background/55"
          role="img"
          aria-label={`NQ price aligned with ${metricName}-weighted classified options orderflow`}
        >
          <defs>
            <pattern id="dex-call-sold" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="color-mix(in_srgb,var(--primary)_14%,transparent)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--primary)" strokeWidth="1.5" />
            </pattern>
            <pattern id="dex-put-sold" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="color-mix(in_srgb,var(--accent)_14%,transparent)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--accent)" strokeWidth="1.5" />
            </pattern>
            <linearGradient id="dex-price-glow" x1="0" x2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity="0.22" />
              <stop offset="0.65" stopColor="var(--primary)" stopOpacity="0.95" />
              <stop offset="1" stopColor="var(--foreground)" stopOpacity="0.7" />
            </linearGradient>
            <filter id="dex-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect x={PLOT_LEFT} y={PRICE_TOP} width={PLOT_RIGHT - PLOT_LEFT} height={PRICE_BOTTOM - PRICE_TOP} rx="10" fill="var(--panel)" fillOpacity="0.32" />
          <rect x={PLOT_LEFT} y={DEX_TOP} width={PLOT_RIGHT - PLOT_LEFT} height={DEX_BOTTOM - DEX_TOP} rx="10" fill="var(--panel)" fillOpacity="0.32" />
          <rect x={PLOT_LEFT} y={CUM_TOP} width={PLOT_RIGHT - PLOT_LEFT} height={CUM_BOTTOM - CUM_TOP} rx="10" fill="var(--panel)" fillOpacity="0.32" />
          <rect x={SIDE_LEFT} y="20" width="266" height="560" rx="14" fill="var(--panel)" fillOpacity="0.45" stroke="var(--border)" />
          {weighting === "CONVEXITY" && valueMode === "Z_SCORE" ? (
            <>
              <rect x={PLOT_LEFT} y={boundedDexY(2.5)} width={PLOT_RIGHT - PLOT_LEFT} height={Math.max(0, boundedDexY(1) - boundedDexY(2.5))} fill="var(--primary)" fillOpacity="0.045" />
              <rect x={PLOT_LEFT} y={boundedDexY(1)} width={PLOT_RIGHT - PLOT_LEFT} height={Math.max(0, boundedDexY(-1) - boundedDexY(1))} fill="var(--foreground)" fillOpacity="0.018" />
              <rect x={PLOT_LEFT} y={boundedDexY(-1)} width={PLOT_RIGHT - PLOT_LEFT} height={Math.max(0, boundedDexY(-2.5) - boundedDexY(-1))} fill="var(--accent)" fillOpacity="0.045" />
              <text x={PLOT_RIGHT - 8} y={boundedDexY(1) - 3} textAnchor="end" fill="var(--primary)" fillOpacity="0.7" fontSize="5">LONG VOL</text>
              <text x={PLOT_RIGHT - 8} y={boundedDexY(-1) + 8} textAnchor="end" fill="var(--accent)" fillOpacity="0.7" fontSize="5">SHORT VOL</text>
            </>
          ) : null}

          {[0, 1, 2, 3, 4, 5].map((index) => {
            const x = PLOT_LEFT + index / 5 * (PLOT_RIGHT - PLOT_LEFT);
            const bucketIndex = Math.round(index / 5 * (buckets.length - 1));
            return (
              <g key={index}>
                <line x1={x} x2={x} y1={PRICE_TOP} y2={CUM_BOTTOM} stroke="var(--border)" strokeOpacity="0.55" />
                <text x={x} y="587" textAnchor={index === 0 ? "start" : index === 5 ? "end" : "middle"} fill="var(--muted)" fontSize="7">
                  {timeLabel(buckets[bucketIndex]?.timestamp ?? Date.now(), aggregation < 60_000)}
                </text>
              </g>
            );
          })}

          <text x={PLOT_LEFT + 10} y="49" fill="var(--muted)" fontSize="7" letterSpacing="1.2">NQ PRICE CONTEXT</text>
          <text x={PLOT_RIGHT - 10} y="49" textAnchor="end" fill="var(--foreground)" fontSize="8" fontFamily="monospace">
            {formatPrice(livePrice ?? buckets.at(-1)?.price ?? payload.nqPrice)}
          </text>
          {nearestZones.map((zone) => {
            const y = priceY(zone.center);
            return (
              <g key={zone.id}>
                <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke="var(--primary)" strokeOpacity="0.28" strokeDasharray="4 5" />
                <text x={PLOT_RIGHT - 8} y={y - 3} textAnchor="end" fill="var(--primary)" fillOpacity="0.78" fontSize="6">
                  GAMMA {zone.behaviour} · {formatPrice(zone.center)}
                </text>
              </g>
            );
          })}
          {pricePath ? <path d={pricePath} fill="none" stroke="url(#dex-price-glow)" strokeWidth="2.2" /> : null}
          {buckets.at(-1)?.price !== null ? (
            <circle
              cx={xFor(buckets.length - 1)}
              cy={priceY(buckets.at(-1)?.price ?? fallbackPrice)}
              r="3.6"
              fill="var(--primary)"
              filter="url(#dex-soft-glow)"
            >
              {payload.marketOpen ? <animate attributeName="r" values="2.6;4.4;2.6" dur="2.2s" repeatCount="indefinite" /> : null}
            </circle>
          ) : null}

          <text x={PLOT_LEFT + 10} y={DEX_TOP + 17} fill="var(--muted)" fontSize="7" letterSpacing="1.2">
            {viewMode === "COMPOSITION" && valueMode === "RAW"
              ? `CLASSIFIED ${metricName} COMPOSITION`
              : `NET ${metricName} ORDERFLOW`}
          </text>
          <text x={PLOT_RIGHT - 10} y={DEX_TOP + 17} textAnchor="end" fill="var(--muted)" fontSize="6">
            {valueMode === "RAW" ? unitLabel.toUpperCase() : valueMode === "Z_SCORE" ? "SESSION Z-SCORE" : "SIGNED SESSION PERCENTILE"}
          </text>
          <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={DEX_ZERO} y2={DEX_ZERO} stroke="var(--foreground)" strokeOpacity="0.68" strokeWidth="1.25" />
          <text x={PLOT_LEFT - 6} y={DEX_ZERO + 2} textAnchor="end" fill="var(--foreground)" fontSize="7">0</text>
          <text x={PLOT_LEFT - 6} y={DEX_TOP + 7} textAnchor="end" fill="var(--primary)" fontSize="6">
            +{valueMode === "RAW" ? compact(maximumDex) : maximumDex.toFixed(1)}
          </text>
          <text x={PLOT_LEFT - 6} y={DEX_BOTTOM - 2} textAnchor="end" fill="var(--accent)" fontSize="6">
            −{valueMode === "RAW" ? compact(maximumDex) : maximumDex.toFixed(1)}
          </text>

          {buckets.map((bucket, index) => {
            const x = xFor(index) - barWidth / 2;
            const active = selectedIndex === index;
            const confidenceOpacity = bucket.confidence >= 0.85 ? 0.92 : bucket.confidence >= 0.5 ? 0.62 : 0.3;
            if (viewMode === "COMPOSITION" && valueMode === "RAW") {
              const positiveCall = bucket.longCall;
              const positivePut = weighting === "CONVEXITY" ? bucket.longPut : bucket.shortPut;
              const negativePut = weighting === "CONVEXITY" ? bucket.shortPut : bucket.longPut;
              const negativeCall = bucket.shortCall;
              const positiveCallHeight = positiveCall / maximumDex * (DEX_ZERO - DEX_TOP);
              const positivePutHeight = positivePut / maximumDex * (DEX_ZERO - DEX_TOP);
              const negativePutHeight = negativePut / maximumDex * (DEX_BOTTOM - DEX_ZERO);
              const negativeCallHeight = negativeCall / maximumDex * (DEX_BOTTOM - DEX_ZERO);
              return (
                <g
                  key={bucket.timestamp}
                  onPointerEnter={() => setSelectedIndex(index)}
                  onClick={() => setSelectedIndex(index)}
                  className="cursor-crosshair"
                >
                  {positiveCall > 0 ? (
                    <rect x={x} y={DEX_ZERO - positiveCallHeight} width={barWidth} height={positiveCallHeight} rx="1.5" fill="var(--primary)" fillOpacity={confidenceOpacity} />
                  ) : null}
                  {positivePut > 0 ? (
                    <rect
                      x={x}
                      y={DEX_ZERO - positiveCallHeight - positivePutHeight}
                      width={barWidth}
                      height={positivePutHeight}
                      rx="1.5"
                      fill={weighting === "CONVEXITY" ? "var(--accent)" : "url(#dex-put-sold)"}
                      fillOpacity={confidenceOpacity}
                    />
                  ) : null}
                  {negativePut > 0 ? (
                    <rect
                      x={x}
                      y={DEX_ZERO}
                      width={barWidth}
                      height={negativePutHeight}
                      rx="1.5"
                      fill={weighting === "CONVEXITY" ? "url(#dex-put-sold)" : "var(--accent)"}
                      fillOpacity={confidenceOpacity}
                    />
                  ) : null}
                  {negativeCall > 0 ? (
                    <rect x={x} y={DEX_ZERO + negativePutHeight} width={barWidth} height={negativeCallHeight} rx="1.5" fill="url(#dex-call-sold)" fillOpacity={confidenceOpacity} />
                  ) : null}
                  <rect x={x - barCell * 0.15} y={DEX_TOP} width={barCell} height={DEX_BOTTOM - DEX_TOP} fill="transparent" />
                  {active ? <rect x={x - 2} y={DEX_TOP} width={barWidth + 4} height={DEX_BOTTOM - DEX_TOP} rx="3" fill="none" stroke="var(--foreground)" strokeOpacity="0.35" /> : null}
                </g>
              );
            }
            const value = displayValue(bucket);
            const y = value >= 0 ? dexY(value) : DEX_ZERO;
            const height = Math.abs(value) / maximumDex * (DEX_ZERO - DEX_TOP);
            const soldDominant = bucket.dominant === "SHORT_CALL" || bucket.dominant === "SHORT_PUT";
            const callDominant = bucket.dominant === "LONG_CALL" || bucket.dominant === "SHORT_CALL";
            const fill = soldDominant
              ? callDominant ? "url(#dex-call-sold)" : "url(#dex-put-sold)"
              : callDominant ? "var(--primary)" : "var(--accent)";
            return (
              <g
                key={bucket.timestamp}
                onPointerEnter={() => setSelectedIndex(index)}
                onClick={() => setSelectedIndex(index)}
                className="cursor-crosshair"
              >
                {height > 0 ? <rect x={x} y={y} width={barWidth} height={height} rx="1.5" fill={fill} fillOpacity={confidenceOpacity} /> : null}
                <rect x={x - barCell * 0.15} y={DEX_TOP} width={barCell} height={DEX_BOTTOM - DEX_TOP} fill="transparent" />
                {active ? <rect x={x - 2} y={DEX_TOP} width={barWidth + 4} height={DEX_BOTTOM - DEX_TOP} rx="3" fill="none" stroke="var(--foreground)" strokeOpacity="0.35" /> : null}
              </g>
            );
          })}
          {emaPath ? <path d={emaPath} fill="none" stroke="var(--foreground)" strokeWidth="1.5" strokeOpacity="0.82" /> : null}
          {spike ? (
            <g transform={`translate(${clamp(selectedX - 45, PLOT_LEFT + 4, PLOT_RIGHT - 98)},${selected.net >= 0 ? DEX_TOP + 26 : DEX_BOTTOM - 13})`}>
              <rect width="94" height="15" rx="7.5" fill="var(--primary)" fillOpacity="0.1" stroke="var(--primary)" strokeOpacity="0.42" />
              <text x="47" y="10.5" textAnchor="middle" fill="var(--primary)" fontSize="6" fontWeight="700">
                {weighting === "CONVEXITY"
                  ? selected.net >= 0 ? "OPTION BUYING SURGE" : "OPTION SELLING SURGE"
                  : `${metricName} SPIKE · ${selectedMagnitudePercentile.toFixed(0)}TH`}
              </text>
            </g>
          ) : null}

          <text x={PLOT_LEFT + 10} y={CUM_TOP + 17} fill="var(--muted)" fontSize="7" letterSpacing="1.2">SESSION CUMULATIVE {metricName}</text>
          <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={(CUM_TOP + CUM_BOTTOM) / 2} y2={(CUM_TOP + CUM_BOTTOM) / 2} stroke="var(--border)" />
          {cumulativePath ? <path d={cumulativePath} fill="none" stroke="var(--primary)" strokeWidth="2" filter="url(#dex-soft-glow)" /> : null}
          <line x1={selectedX} x2={selectedX} y1={PRICE_TOP} y2={CUM_BOTTOM} stroke="var(--foreground)" strokeOpacity="0.24" strokeDasharray="3 5" />

          <g transform={`translate(${SIDE_LEFT + 16},42)`}>
            <text fill="var(--muted)" fontSize="7" letterSpacing="1.2">CURRENT STATE</text>
            <text y="27" fill={latestActive.net >= 0 ? "var(--primary)" : "var(--accent)"} fontSize="19" fontFamily="monospace" fontWeight="700">
              {signedCompact(latestActive.net)}
            </text>
            <text y="43" fill="var(--muted)" fontSize="6">latest active {AGGREGATIONS.find((row) => row.value === aggregation)?.label} window</text>
            <text x="234" y="43" textAnchor="end" fill="var(--muted)" fontSize="6">{Math.abs(latestActive.percentile).toFixed(0)}th percentile</text>

            <text y="72" fill="var(--muted)" fontSize="6">1M {metricName}</text>
            <text x="104" y="72" fill="var(--muted)" fontSize="6">5M {metricName}</text>
            <text y="88" fill="var(--foreground)" fontSize="10" fontFamily="monospace">{signedCompact(currentOneMinute)}</text>
            <text x="104" y="88" fill="var(--foreground)" fontSize="10" fontFamily="monospace">{signedCompact(currentFiveMinutes)}</text>

            <line x1="0" x2="234" y1="108" y2="108" stroke="var(--border)" />
            <text y="128" fill="var(--muted)" fontSize="6">SESSION NET {metricName}</text>
            <text x="234" y="128" textAnchor="end" fill={sessionNet >= 0 ? "var(--primary)" : "var(--accent)"} fontSize="9" fontFamily="monospace">{signedCompact(sessionNet)}</text>
            <text y="148" fill="var(--muted)" fontSize="6">
              {weighting === "CONVEXITY" ? "LONG GAMMA SHARE" : "BULLISH SHARE"}
            </text>
            <text x="234" y="148" textAnchor="end" fill="var(--foreground)" fontSize="9" fontFamily="monospace">{(bullishShare * 100).toFixed(0)}%</text>
            <rect y="158" width="234" height="5" rx="2.5" fill="var(--surface)" />
            <rect y="158" width={234 * bullishShare} height="5" rx="2.5" fill="var(--primary)" />

            <text y="190" fill="var(--muted)" fontSize="7" letterSpacing="1.2">FLOW TYPE</text>
            <text y="210" fill="var(--foreground)" fontSize="9" fontWeight="700">{selectedFlowLabel(latestActive, weighting)}</text>
            {weighting === "GEX" ? (
              <>
                <text y="226" fill="var(--muted)" fontSize="6">DEX: {signedCompact(latestActive.directionalDex)} · {Math.abs(latestActive.dexPercentile).toFixed(0)}th percentile</text>
                <text y="241" fill="var(--muted)" fontSize="6">GEX: {signedCompact(latestActive.net)} · {Math.abs(latestActive.percentile).toFixed(0)}th percentile</text>
              </>
            ) : weighting === "CONVEXITY" ? (
              <>
                <text y="226" fill="var(--muted)" fontSize="6">
                  DEX {signedCompact(latestActive.directionalDex)} · Convexity {signedCompact(latestActive.net)}
                </text>
                <text y="241" fill="var(--muted)" fontSize="6">
                  {latestActive.net >= 0 ? "Gamma being acquired · volatility demand" : "Gamma being supplied · volatility selling"}
                </text>
              </>
            ) : (
              <>
                <text y="226" fill="var(--muted)" fontSize="6">Dominant: {structureLabel(latestActive.dominant)}</text>
                <text y="241" fill="var(--muted)" fontSize="6">Persistence: {(persistence * 100).toFixed(0)}% {persistenceDirection}</text>
              </>
            )}

            <line x1="0" x2="234" y1="262" y2="262" stroke="var(--border)" />
            <text y="282" fill="var(--muted)" fontSize="7" letterSpacing="1.2">PRICE / {metricName} READ</text>
            <text y="304" fill={divergence === "BULLISH" ? "var(--primary)" : divergence === "BEARISH" ? "var(--accent)" : "var(--foreground)"} fontSize="10" fontWeight="700">
              {weighting === "CONVEXITY"
                ? divergence === "BEARISH" ? "Price up / convexity down"
                  : divergence === "BULLISH" ? "Price down / convexity up"
                    : divergence === "CONFIRMING" ? "Price / convexity aligned" : "Not established"
                : divergence === "NONE" ? "Not established"
                  : divergence === "CONFIRMING" ? "Flow confirming price" : `${divergence} divergence`}
            </text>
            <text y="321" fill="var(--muted)" fontSize="6">
              {weighting === "CONVEXITY"
                ? divergence === "BEARISH" ? "Rally becoming more short-volatility driven"
                  : divergence === "BULLISH" ? "Down move gaining long-volatility demand"
                    : divergence === "CONFIRMING" ? "Price and gamma ownership are moving together"
                      : "Insufficient directional separation"
                : divergence === "BEARISH" ? `Price higher · cumulative ${metricName} lower`
                  : divergence === "BULLISH" ? `Price lower · cumulative ${metricName} higher`
                    : divergence === "CONFIRMING" ? `Price and cumulative ${metricName} agree`
                      : "Insufficient directional separation"}
            </text>

            <line x1="0" x2="234" y1="342" y2="342" stroke="var(--border)" />
            <text y="362" fill="var(--muted)" fontSize="7" letterSpacing="1.2">CLASSIFICATION QUALITY</text>
            {[
              ["High", qualityPercent(quality.high), "var(--primary)"],
              ["Medium", qualityPercent(quality.medium), "var(--foreground)"],
              ["Low", qualityPercent(quality.low), "var(--accent)"],
            ].map(([label, value, color], index) => (
              <g key={String(label)} transform={`translate(0,${383 + index * 25})`}>
                <text fill="var(--muted)" fontSize="6">{label}</text>
                <rect x="55" y="-6" width="145" height="5" rx="2.5" fill="var(--surface)" />
                <rect x="55" y="-6" width={145 * Number(value)} height="5" rx="2.5" fill={String(color)} />
                <text x="234" textAnchor="end" fill="var(--foreground)" fontSize="6">{(Number(value) * 100).toFixed(0)}%</text>
              </g>
            ))}
            <text y="468" fill="var(--muted)" fontSize="6">Complex / spread-linked: {(qualityPercent(quality.complex) * 100).toFixed(0)}%</text>
            <text y="483" fill="var(--muted)" fontSize="6">Provider IV weighted: {(qualityPercent(quality.provider) * 100).toFixed(0)}%</text>
            <text y="498" fill="var(--muted)" fontSize="6">Price-implied IV weighted: {(qualityPercent(quality.solved) * 100).toFixed(0)}%</text>

            <g transform="translate(0,518)">
              <rect width="234" height="24" rx="8" fill="var(--primary)" fillOpacity="0.055" stroke="var(--primary)" strokeOpacity="0.22" />
              <text x="117" y="10" textAnchor="middle" fill="var(--primary)" fontSize="6" fontWeight="700">
                SOURCE: {sourceFilter === "COMBINED" ? "NDX + QQQ OPTIONS" : `${sourceFilter} OPTIONS`}
              </text>
              <text x="117" y="18" textAnchor="middle" fill="var(--muted)" fontSize="5.5">Mapped to NQ price · not NQ contracts</text>
            </g>
          </g>
        </svg>
      </div>

      <div className="grid min-h-[142px] grid-cols-1 gap-2 border-t border-border p-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-background/35 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.13em] text-muted">
              <Activity className="h-3 w-3 text-primary" />
              Selected window
            </div>
            <span className="font-mono text-[7px] text-foreground">{timeLabel(selected.timestamp, aggregation < 60_000)}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <Metric label={`Net ${metricName}`} value={signedCompact(selected.net)} detail={`${selected.prints} prints`} />
            <Metric
              label={weighting === "CONVEXITY" ? "Long gamma" : "Bullish"}
              value={compact(positiveComposition(selected))}
              detail={weighting === "CONVEXITY" ? "Long calls + puts" : "LC + short puts"}
            />
            <Metric
              label={weighting === "CONVEXITY" ? "Short gamma" : "Bearish"}
              value={compact(negativeComposition(selected))}
              detail={weighting === "CONVEXITY" ? "Short calls + puts" : "LP + short calls"}
            />
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1 text-center font-mono text-[6px]">
            <span className="rounded-md bg-primary/[0.08] px-1 py-1 text-primary">LC {compact(selected.longCall)}</span>
            <span className="rounded-md bg-accent/[0.08] px-1 py-1 text-accent">SP {compact(selected.shortPut)}</span>
            <span className="rounded-md bg-accent/[0.08] px-1 py-1 text-accent">LP {compact(selected.longPut)}</span>
            <span className="rounded-md bg-primary/[0.08] px-1 py-1 text-primary">SC {compact(selected.shortCall)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/35 p-3">
          <div className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.13em] text-muted">
            <Gauge className="h-3 w-3 text-primary" />
            Strike attribution
          </div>
          <div className="mt-2 space-y-2">
            {selected.strikes.length ? selected.strikes.slice(0, 3).map((row) => (
              <TinyMeter
                key={row.label}
                label={row.label}
                value={row.value}
                maximum={strikeMaximum}
                tone={row.value >= 0 ? "bg-primary" : "bg-accent"}
              />
            )) : <div className="pt-4 text-center text-[7px] text-muted">No classified strikes in this window.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/35 p-3">
          <div className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.13em] text-muted">
            <Sparkles className="h-3 w-3 text-primary" />
            Expiry + {weighting !== "DEX" ? "moneyness" : "delta"} mix
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              {selected.expiries.slice(0, 3).map((row) => (
                <TinyMeter
                  key={row.label}
                  label={expiryLabel(row.label === "Unknown" ? null : row.label, payload.sessionDate)}
                  value={row.value}
                  maximum={expiryMaximum}
                />
              ))}
            </div>
            <div className="space-y-1.5">
              {attributionBuckets.slice(0, 3).map((row) => (
                <TinyMeter
                  key={row.label}
                  label={weighting !== "DEX" ? row.label : `Δ ${row.label}`}
                  value={row.value}
                  maximum={attributionMaximum}
                  tone="bg-accent"
                />
              ))}
            </div>
          </div>
        </div>

        {weighting !== "DEX" ? (
          <div className="rounded-2xl border border-border bg-background/35 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.13em] text-muted">
                <Crosshair className="h-3 w-3 text-primary" />
                DEX / {weighting === "CONVEXITY" ? "Convexity" : "GEX"} matrix
              </div>
              <span className="font-mono text-[6px] text-primary">
                {flowTypeShift ? "FLOW TYPE SHIFT" : selectedFlowLabel(latestActive, weighting)}
              </span>
            </div>
            <svg
              className="mt-1.5 h-[62px] w-full overflow-visible"
              viewBox="0 0 200 80"
              role="img"
              aria-label={`Recent DEX and ${weighting === "CONVEXITY" ? "convexity" : "GEX"} orderflow quadrant path`}
            >
              <rect x="0" y="0" width="200" height="80" rx="9" fill="var(--surface)" fillOpacity="0.52" />
              <rect x="100" y="0" width="100" height="40" fill="var(--primary)" fillOpacity="0.035" />
              <rect x="0" y="40" width="100" height="40" fill="var(--accent)" fillOpacity="0.035" />
              <line x1="100" x2="100" y1="5" y2="75" stroke="var(--border)" />
              <line x1="6" x2="194" y1="40" y2="40" stroke="var(--border)" />
              {weighting === "CONVEXITY" ? (
                <>
                  <text x="105" y="9" fill="var(--primary)" fontSize="4.8">LONG CALL · BULL + LONG VOL</text>
                  <text x="5" y="74" fill="var(--accent)" fontSize="4.8">SHORT CALL · BEAR + SHORT VOL</text>
                  <text x="5" y="9" fill="var(--muted)" fontSize="4.5">LONG PUT · BEAR + LONG VOL</text>
                  <text x="105" y="74" fill="var(--muted)" fontSize="4.5">SHORT PUT · BULL + SHORT VOL</text>
                </>
              ) : (
                <>
                  <text x="105" y="9" fill="var(--primary)" fontSize="4.8">BULLISH + CONVEX</text>
                  <text x="5" y="74" fill="var(--accent)" fontSize="4.8">BEARISH + PUT GAMMA</text>
                  <text x="5" y="9" fill="var(--muted)" fontSize="4.5">MIXED: DEX- / GEX+</text>
                  <text x="105" y="74" fill="var(--muted)" fontSize="4.5">MIXED: DEX+ / GEX-</text>
                </>
              )}
              {quadrantPath ? (
                <path d={quadrantPath} fill="none" stroke="var(--foreground)" strokeOpacity="0.44" strokeWidth="1" />
              ) : null}
              {quadrantPoints.map((point, index) => {
                const isLatest = index === quadrantPoints.length - 1;
                const pointBucket = recent[index];
                const pointMagnitude = Math.abs(pointBucket?.net ?? 0) / quadrantGexMaximum;
                const pointConfidence = pointBucket?.confidence ?? 0;
                return (
                  <g key={`${point.x}-${point.y}-${index}`}>
                    {isLatest ? <circle cx={point.x} cy={point.y} r="7" fill="var(--primary)" fillOpacity="0.1" /> : null}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={isLatest ? 3.6 : 1.2 + pointMagnitude * 1.5}
                      fill={isLatest ? "var(--primary)" : "var(--foreground)"}
                      fillOpacity={isLatest ? 1 : 0.18 + pointConfidence * 0.52}
                    />
                  </g>
                );
              })}
              <text x="194" y="38" textAnchor="end" fill="var(--muted)" fontSize="4.5">DEX →</text>
              <text x="102" y="8" fill="var(--muted)" fontSize="4.5" transform="rotate(-90 102 8)">
                {weighting === "CONVEXITY" ? "CONVEXITY" : "GEX"} →
              </text>
            </svg>
            <div className="mt-1 grid grid-cols-3 gap-1 font-mono text-[5.5px]">
              <span className="rounded-md bg-surface px-1.5 py-1 text-muted">1M DEX <b className="text-foreground">{signedCompact(currentDexOneMinute)}</b></span>
              <span className="rounded-md bg-surface px-1.5 py-1 text-muted">
                {weighting === "CONVEXITY" ? "VELOCITY" : "5M DEX"}{" "}
                <b className="text-foreground">{signedCompact(weighting === "CONVEXITY" ? metricVelocity : currentDexFiveMinutes)}</b>
              </span>
              <span className="rounded-md bg-surface px-1.5 py-1 text-muted">
                {weighting === "CONVEXITY" ? "PERSIST" : "SESSION"}{" "}
                <b className="text-foreground">
                  {weighting === "CONVEXITY" ? `${(persistence * 100).toFixed(0)}%` : signedCompact(sessionDirectionalDex)}
                </b>
              </span>
            </div>
          </div>
        ) : (
        <div className="rounded-2xl border border-border bg-background/35 p-3">
          <div className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.13em] text-muted">
            <TriangleAlert className="h-3 w-3 text-accent" />
            Model boundary
          </div>
          <p className="mt-2 text-[7px] leading-4 text-muted">
            DEX = classified contracts × |delta| × 100. It is an options-derived underlying-equivalent estimate, not literal NQ futures volume, audited dealer inventory or proof that a trade opened a position.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[6px]">
            <span className="rounded-lg border border-border bg-surface px-2 py-1 text-muted">{classified.midPrints} midpoint prints excluded</span>
            <span className="rounded-lg border border-border bg-surface px-2 py-1 text-muted">{classified.unweightedPrints} missing-delta prints excluded</span>
            <span className="rounded-lg border border-border bg-surface px-2 py-1 text-muted">Multi-leg flow shown gross unless linked upstream</span>
          </div>
        </div>
        )}
      </div>
      {weighting !== "DEX" ? (
        <div className="border-t border-border px-3 py-1.5 text-[6px] leading-3 text-muted">
          {weighting === "CONVEXITY"
            ? "Convexity is estimated as bought-option GEX minus sold-option GEX using contracts × gamma × 100"
            : "GEX is estimated from classified directional option flow using contracts × gamma × 100"}
          {gexUnit === "DOLLAR_1PCT" ? " × spot² × 1%." : " per underlying point."}
          {" "}DEX, GEX and convexity remain separate measures; prints without defensible gamma are excluded, and linked multi-leg intent may not be recoverable from the public tape.
          {" "}{classified.midPrints} midpoint and {classified.unweightedPrints} missing-gamma prints are outside the weighted series.
        </div>
      ) : null}
    </div>
  );
}

export function GexWeightedOrderflow(props: OrderflowProps) {
  return <DexWeightedOrderflow {...props} weighting="GEX" />;
}

export function ConvexityOrderflow(props: OrderflowProps) {
  return <DexWeightedOrderflow {...props} weighting="CONVEXITY" />;
}
