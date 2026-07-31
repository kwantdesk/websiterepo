"use client";

import {
  Activity,
  CirclePause,
  CirclePlay,
  Crosshair,
  Gauge,
  Radio,
  SkipBack,
  SkipForward,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import type {
  GexDeskHistoryPayload,
  GexDeskOptionPrint,
  GexDeskPayload,
  GexDeskRailPoint,
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";

type SourceFilter = "COMBINED" | GexDeskSourceSymbol;
type WindowFilter = 1 | 5 | 15 | 30 | "SESSION";
type ExpiryFilter = "ALL" | "0DTE" | "1DTE";
type ConfidenceFilter = "ALL" | "HIGH_MEDIUM" | "HIGH";
type ScaleMode = "LINEAR" | "SQRT" | "LOG";
type DisplayMode = "NET" | "GROSS";
type Perspective = "CUSTOMER" | "DEALER";
type GexUnit = "DOLLAR_1PCT" | "SHARE_EQ";
type StateScope = "FULL" | "0DTE" | "1DTE";
type StateMetric = "DEX" | "GEX" | "CONVEXITY" | "VANNA" | "CHARM";
type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

type ConfidenceGex = {
  high: number;
  medium: number;
  low: number;
  total: number;
};

type ClassifiedGexLevel = {
  price: number;
  longCall: ConfidenceGex;
  shortCall: ConfidenceGex;
  longPut: ConfidenceGex;
  shortPut: ConfidenceGex;
  callContracts: number;
  putContracts: number;
  weightedPrints: number;
  unweightedPrints: number;
  premium: number;
};

type StateValues = {
  dex: number;
  gex: number;
  convexity: number;
  vanna: number;
  charm: number;
  weightedPrints: number;
  totalPrints: number;
};

type StatePoint = StateValues & {
  timestamp: number;
};

const WINDOWS: readonly WindowFilter[] = [1, 5, 15, 30, "SESSION"];
const DOT_LOOKBACKS = [
  { minutes: 30, opacity: 0.3, radius: 3 },
  { minutes: 15, opacity: 0.48, radius: 3.2 },
  { minutes: 10, opacity: 0.64, radius: 3.4 },
  { minutes: 5, opacity: 0.82, radius: 3.8 },
  { minutes: 1, opacity: 1, radius: 4.1 },
] as const;
const SVG_WIDTH = 1_070;
const SVG_HEIGHT = 560;
const PLOT_TOP = 42;
const PLOT_BOTTOM = 534;
const ZERO_X = 465;
const SIDE_WIDTH = 360;
const SUMMARY_X = 850;
const CALL_COLOR = "#36d98a";
const PUT_COLOR = "#ff5367";

function emptyConfidenceGex(): ConfidenceGex {
  return { high: 0, medium: 0, low: 0, total: 0 };
}

function emptyLevel(price: number): ClassifiedGexLevel {
  return {
    price,
    longCall: emptyConfidenceGex(),
    shortCall: emptyConfidenceGex(),
    longPut: emptyConfidenceGex(),
    shortPut: emptyConfidenceGex(),
    callContracts: 0,
    putContracts: 0,
    weightedPrints: 0,
    unweightedPrints: 0,
    premium: 0,
  };
}

function emptyState(): StateValues {
  return {
    dex: 0,
    gex: 0,
    convexity: 0,
    vanna: 0,
    charm: 0,
    weightedPrints: 0,
    totalPrints: 0,
  };
}

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

function confidenceTier(value: number): ConfidenceTier {
  if (value >= 0.85) return "HIGH";
  if (value >= 0.5) return "MEDIUM";
  return "LOW";
}

function addGex(target: ConfidenceGex, tier: ConfidenceTier, amount: number) {
  target.total += amount;
  if (tier === "HIGH") target.high += amount;
  else if (tier === "MEDIUM") target.medium += amount;
  else target.low += amount;
}

function compact(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1e12) return `${(absolute / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${(absolute / 1e6).toFixed(1)}M`;
  if (absolute >= 1e3) return `${(absolute / 1e3).toFixed(1)}K`;
  return absolute.toFixed(0);
}

function compactSigned(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${compact(value)}`;
}

function formatPrice(value: number | null, digits = 0) {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function timeLabel(timestamp: number | undefined, seconds = false) {
  if (!timestamp) return "--:--";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hour12: false,
  }).format(new Date(timestamp));
}

function transformScale(value: number, mode: ScaleMode) {
  if (mode === "SQRT") return Math.sqrt(Math.max(0, value));
  if (mode === "LOG") return Math.log1p(Math.max(0, value));
  return Math.max(0, value);
}

function classifiableSide(print: GexDeskOptionPrint, perspective: Perspective) {
  if (print.side === "MID") return null;
  if (perspective === "CUSTOMER") return print.side;
  return print.side === "BOUGHT" ? "SOLD" : "BOUGHT";
}

function greekGex(print: GexDeskOptionPrint, unit: GexUnit) {
  const gamma = Number(print.optionGamma);
  const size = Number(print.size);
  const spot = Number(print.underlyingPrice);
  if (
    !Number.isFinite(gamma)
    || gamma <= 0
    || !Number.isFinite(size)
    || size <= 0
  ) return null;
  const shareEquivalent = gamma * size * 100;
  if (unit === "SHARE_EQ") return shareEquivalent;
  if (!Number.isFinite(spot) || spot <= 0) return null;
  return shareEquivalent * spot * spot * 0.01;
}

function expiryMatches(
  print: GexDeskOptionPrint,
  filter: ExpiryFilter | StateScope,
  sessionDate: string,
) {
  if (filter === "ALL" || filter === "FULL") return true;
  if (filter === "0DTE") return print.expiration === sessionDate;
  return print.expiration === nextBusinessDate(sessionDate);
}

function aggregateClassifiedGex(
  prints: GexDeskOptionPrint[],
  args: {
    sourceFilter: SourceFilter;
    expiryFilter: ExpiryFilter;
    confidenceFilter: ConfidenceFilter;
    minimumSize: number;
    perspective: Perspective;
    unit: GexUnit;
    sessionDate: string;
    startTime: number;
    endTime: number;
    bucketSize: number;
  },
) {
  const levels = new Map<number, ClassifiedGexLevel>();
  for (const print of prints) {
    const timestamp = safeTimestamp(Number(print.timestamp));
    if (timestamp === null || timestamp < args.startTime || timestamp > args.endTime) continue;
    if (args.sourceFilter !== "COMBINED" && print.source !== args.sourceFilter) continue;
    if (!expiryMatches(print, args.expiryFilter, args.sessionDate)) continue;
    if (Number(print.size) < args.minimumSize) continue;
    const tier = confidenceTier(Number(print.confidence));
    if (args.confidenceFilter === "HIGH" && tier !== "HIGH") continue;
    if (args.confidenceFilter === "HIGH_MEDIUM" && tier === "LOW") continue;
    const mappedPrice = Number(print.mappedPrice);
    if (!Number.isFinite(mappedPrice) || mappedPrice <= 0) continue;
    const price = Math.round(mappedPrice / args.bucketSize) * args.bucketSize;
    const level = levels.get(price) ?? emptyLevel(price);
    level.premium += Math.max(0, Number(print.premium));
    if (print.contractType === "CALL") level.callContracts += Math.max(0, Number(print.size));
    else level.putContracts += Math.max(0, Number(print.size));
    const gex = greekGex(print, args.unit);
    const side = classifiableSide(print, args.perspective);
    if (gex === null || side === null) {
      level.unweightedPrints += 1;
      levels.set(price, level);
      continue;
    }
    level.weightedPrints += 1;
    if (print.contractType === "CALL") {
      addGex(side === "BOUGHT" ? level.longCall : level.shortCall, tier, gex);
    } else {
      addGex(side === "BOUGHT" ? level.longPut : level.shortPut, tier, gex);
    }
    levels.set(price, level);
  }
  return [...levels.values()].sort((left, right) => right.price - left.price);
}

function levelNetCall(level: ClassifiedGexLevel) {
  return level.longCall.total - level.shortCall.total;
}

function levelNetPut(level: ClassifiedGexLevel) {
  return level.longPut.total - level.shortPut.total;
}

function levelLongGamma(level: ClassifiedGexLevel) {
  return level.longCall.total + level.longPut.total;
}

function levelShortGamma(level: ClassifiedGexLevel) {
  return level.shortCall.total + level.shortPut.total;
}

function minuteFrames(prints: GexDeskOptionPrint[]) {
  return [...new Set(prints.flatMap((print) => {
    const timestamp = safeTimestamp(Number(print.timestamp));
    return timestamp === null ? [] : [Math.floor(timestamp / 60_000) * 60_000];
  }))].sort((left, right) => left - right);
}

function nearestPriceAt(
  history: GexDeskHistoryPayload | null,
  timestamp: number,
  fallback: number,
) {
  if (!history?.timestamps.length) return fallback;
  let nearest = 0;
  let distance = Infinity;
  history.timestamps.forEach((candidate, index) => {
    const nextDistance = Math.abs(candidate - timestamp);
    if (nextDistance < distance) {
      nearest = index;
      distance = nextDistance;
    }
  });
  return history.nqPrices[nearest] ?? fallback;
}

function structuralAt(rail: GexDeskRailPoint[], price: number, bucketSize: number) {
  if (!rail.length) return null;
  const row = rail.reduce((nearest, candidate) => (
    Math.abs(candidate.price - price) < Math.abs(nearest.price - price) ? candidate : nearest
  ));
  return Math.abs(row.price - price) <= bucketSize * 0.6 ? row : null;
}

function stateForPrints(
  prints: GexDeskOptionPrint[],
  args: {
    sourceFilter: SourceFilter;
    stateScope: StateScope;
    perspective: Perspective;
    sessionDate: string;
    startTime: number;
    endTime: number;
  },
): StateValues {
  const state = emptyState();
  for (const print of prints) {
    const timestamp = safeTimestamp(Number(print.timestamp));
    if (timestamp === null || timestamp < args.startTime || timestamp > args.endTime) continue;
    if (args.sourceFilter !== "COMBINED" && print.source !== args.sourceFilter) continue;
    if (!expiryMatches(print, args.stateScope, args.sessionDate)) continue;
    state.totalPrints += 1;
    const side = classifiableSide(print, args.perspective);
    const size = Number(print.size);
    const spot = Number(print.underlyingPrice);
    const gamma = Number(print.optionGamma);
    const delta = Number(print.optionDelta);
    const vanna = Number(print.optionVannaPerVolPoint);
    const charm = Number(print.optionCharmPerDay);
    if (
      side === null
      || !Number.isFinite(size)
      || size <= 0
      || !Number.isFinite(spot)
      || spot <= 0
      || !Number.isFinite(gamma)
      || gamma <= 0
    ) continue;
    state.weightedPrints += 1;
    const sign = side === "BOUGHT" ? 1 : -1;
    const dollarGex = gamma * size * 100 * spot * spot * 0.01;
    const dollarDex = Number.isFinite(delta) ? Math.abs(delta) * size * 100 * spot : 0;
    const signedGex = sign * dollarGex;
    const signedDex = sign * dollarDex;
    if (print.contractType === "CALL") {
      state.dex += signedDex;
      state.gex += signedGex;
    } else {
      state.dex -= signedDex;
      state.gex -= signedGex;
    }
    state.convexity += signedGex;
    if (Number.isFinite(vanna)) state.vanna += sign * vanna * size * 100 * spot;
    if (Number.isFinite(charm)) state.charm += sign * charm * size * 100 * spot;
  }
  return state;
}

function stateMetricValue(state: StateValues, metric: StateMetric) {
  if (metric === "DEX") return state.dex;
  if (metric === "GEX") return state.gex;
  if (metric === "CONVEXITY") return state.convexity;
  if (metric === "VANNA") return state.vanna;
  return state.charm;
}

function stateUnit(metric: StateMetric) {
  if (metric === "DEX") return "$ delta equivalent";
  if (metric === "GEX" || metric === "CONVEXITY") return "$ gamma / 1%";
  if (metric === "VANNA") return "$ delta / +1 vol pt";
  return "$ delta / day";
}

function stateInterpretation(metric: StateMetric, value: number) {
  if (metric === "DEX") return value >= 0 ? "Call-delta classified flow dominates" : "Put-delta classified flow dominates";
  if (metric === "GEX") return value >= 0 ? "Call gamma is more concentrated" : "Put gamma is more concentrated";
  if (metric === "CONVEXITY") return value >= 0 ? "Net long-option / long-gamma flow" : "Net short-option / short-gamma flow";
  if (metric === "VANNA") return value >= 0 ? "Positive classified vanna sensitivity" : "Negative classified vanna sensitivity";
  return value >= 0 ? "Positive modeled daily delta decay" : "Negative modeled daily delta decay";
}

function GexConfidenceBar({
  volume,
  maximum,
  scaleMode,
  direction,
  y,
  color,
  patternId,
  shortGamma = false,
}: {
  volume: ConfidenceGex;
  maximum: number;
  scaleMode: ScaleMode;
  direction: "LEFT" | "RIGHT";
  y: number;
  color: string;
  patternId: string;
  shortGamma?: boolean;
}) {
  const totalWidth = transformScale(volume.total, scaleMode)
    / Math.max(1, transformScale(maximum, scaleMode))
    * SIDE_WIDTH;
  const segments = [
    { key: "high", value: volume.high, opacity: 0.95 },
    { key: "medium", value: volume.medium, opacity: 0.58 },
    { key: "low", value: volume.low, opacity: 0.25, pattern: false },
  ];
  let offset = 0;
  return (
    <g>
      {segments.map((segment) => {
        const width = volume.total > 0 ? totalWidth * segment.value / volume.total : 0;
        const x = direction === "RIGHT" ? ZERO_X + offset : ZERO_X - offset - width;
        offset += width;
        if (width <= 0.2) return null;
        return (
          <rect
            key={segment.key}
            x={x}
            y={y}
            width={width}
            height="5"
            rx="1.5"
            fill={shortGamma && segment.key !== "low" ? `url(#${patternId})` : color}
            fillOpacity={segment.opacity}
            stroke={segment.key === "low" ? color : "none"}
            strokeOpacity="0.55"
          />
        );
      })}
    </g>
  );
}

export default function ClassifiedGexLadder({
  payload,
  history,
  livePrice,
  sourceFilter,
  onSourceFilterChange,
}: {
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  livePrice: number | null;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (source: SourceFilter) => void;
}) {
  const [windowFilter, setWindowFilter] = useState<WindowFilter>(15);
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("ALL");
  const [minimumSize, setMinimumSize] = useState(0);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("LINEAR");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("NET");
  const [perspective, setPerspective] = useState<Perspective>("CUSTOMER");
  const [unit, setUnit] = useState<GexUnit>("DOLLAR_1PCT");
  const [stateScope, setStateScope] = useState<StateScope>("FULL");
  const [stateMetric, setStateMetric] = useState<StateMetric>("CONVEXITY");
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const followsLatest = useRef(true);
  const priorFrameLength = useRef(0);
  const prints = Array.isArray(payload.optionsTape) ? payload.optionsTape : [];
  const frames = useMemo(() => minuteFrames(prints), [prints]);
  const latestFrame = Math.max(0, frames.length - 1);

  useEffect(() => {
    const priorLatest = Math.max(0, priorFrameLength.current - 1);
    if (followsLatest.current || selectedFrame >= priorLatest) setSelectedFrame(latestFrame);
    priorFrameLength.current = frames.length;
  }, [frames.length, latestFrame, selectedFrame]);

  useEffect(() => {
    if (!playing || !frames.length) return;
    const timer = window.setInterval(() => {
      setSelectedFrame((current) => {
        if (current >= latestFrame) {
          followsLatest.current = true;
          setPlaying(false);
          return latestFrame;
        }
        followsLatest.current = false;
        return current + 1;
      });
    }, 420);
    return () => window.clearInterval(timer);
  }, [frames.length, latestFrame, playing]);

  const selectedTime = frames[selectedFrame]
    ?? safeTimestamp(Date.parse(payload.asOf))
    ?? Date.now();
  const replaying = selectedFrame < latestFrame;
  const endTime = replaying
    ? selectedTime + 59_999
    : payload.marketOpen
      ? Math.max(Date.now(), selectedTime + 59_999)
      : selectedTime + 59_999;
  const startTime = windowFilter === "SESSION" ? 0 : endTime - windowFilter * 60_000;
  const bucketSize = history?.bucketSize
    ?? (
      Math.abs((payload.rail[1]?.price ?? 0) - (payload.rail[0]?.price ?? 0))
      || 20
    );
  const aggregateArgs = {
    sourceFilter,
    expiryFilter,
    confidenceFilter,
    minimumSize,
    perspective,
    unit,
    sessionDate: payload.sessionDate,
    startTime,
    endTime,
    bucketSize,
  };
  const levels = useMemo(
    () => aggregateClassifiedGex(prints, aggregateArgs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      prints,
      sourceFilter,
      expiryFilter,
      confidenceFilter,
      minimumSize,
      perspective,
      unit,
      payload.sessionDate,
      startTime,
      endTime,
      bucketSize,
    ],
  );
  const referencePrice = replaying
    ? nearestPriceAt(history, selectedTime, payload.nqPrice ?? 0)
    : livePrice ?? payload.nqPrice ?? history?.nqPrices.at(-1) ?? 0;
  const visibleLevels = useMemo(() => {
    const ordered = [...levels].sort((left, right) => left.price - right.price);
    if (!ordered.length) return [];
    const nearestIndex = ordered.reduce((nearest, level, index) => (
      Math.abs(level.price - referencePrice) < Math.abs(ordered[nearest].price - referencePrice)
        ? index
        : nearest
    ), 0);
    const start = clamp(nearestIndex - 11, 0, Math.max(0, ordered.length - 23));
    const selected = ordered.slice(start, start + 23);
    const atm = Math.round(referencePrice / bucketSize) * bucketSize;
    if (!selected.some((level) => level.price === atm)) selected.push(emptyLevel(atm));
    return selected
      .sort((left, right) => Math.abs(left.price - referencePrice) - Math.abs(right.price - referencePrice))
      .slice(0, 23)
      .sort((left, right) => right.price - left.price);
  }, [bucketSize, levels, referencePrice]);

  const historicalProfiles = useMemo(() => {
    return new Map(DOT_LOOKBACKS.map((lookback) => {
      const lookbackEnd = endTime - lookback.minutes * 60_000;
      const lookbackStart = windowFilter === "SESSION"
        ? 0
        : lookbackEnd - windowFilter * 60_000;
      const profile = aggregateClassifiedGex(prints, {
        ...aggregateArgs,
        startTime: lookbackStart,
        endTime: lookbackEnd,
      });
      return [lookback.minutes, new Map(profile.map((level) => [level.price, level]))];
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prints,
    sourceFilter,
    expiryFilter,
    confidenceFilter,
    minimumSize,
    perspective,
    unit,
    payload.sessionDate,
    windowFilter,
    endTime,
    bucketSize,
  ]);

  const structuralMaximum = unit === "DOLLAR_1PCT"
    ? Math.max(0, ...visibleLevels.flatMap((level) => {
        const structural = structuralAt(payload.rail, level.price, bucketSize);
        return structural ? [Math.abs(structural.call), Math.abs(structural.put)] : [];
      }))
    : 0;
  const activeMaximum = Math.max(
    1,
    ...visibleLevels.flatMap((level) => displayMode === "NET"
      ? [Math.abs(levelNetCall(level)), Math.abs(levelNetPut(level))]
      : [
          level.longCall.total,
          level.shortCall.total,
          level.longPut.total,
          level.shortPut.total,
        ]),
    ...[...historicalProfiles.values()].flatMap((profile) => (
      visibleLevels.flatMap((level) => {
        const historical = profile.get(level.price);
        return historical ? [Math.abs(levelNetCall(historical)), Math.abs(levelNetPut(historical))] : [];
      })
    )),
  );
  const maximum = Math.max(activeMaximum, structuralMaximum);
  const lowest = visibleLevels.at(-1)?.price ?? referencePrice - 1;
  const highest = visibleLevels[0]?.price ?? referencePrice + 1;
  const yForPrice = (price: number) => clamp(
    PLOT_TOP + (highest - price) / Math.max(1, highest - lowest) * (PLOT_BOTTOM - PLOT_TOP),
    PLOT_TOP,
    PLOT_BOTTOM,
  );
  const xForCall = (value: number) => ZERO_X
    + transformScale(Math.abs(value), scaleMode) / Math.max(1, transformScale(maximum, scaleMode)) * SIDE_WIDTH;
  const xForPut = (value: number) => ZERO_X
    - transformScale(Math.abs(value), scaleMode) / Math.max(1, transformScale(maximum, scaleMode)) * SIDE_WIDTH;

  const majorCall = levels.length
    ? levels.reduce((best, level) => Math.abs(levelNetCall(level)) > Math.abs(levelNetCall(best)) ? level : best)
    : null;
  const majorPut = levels.length
    ? levels.reduce((best, level) => Math.abs(levelNetPut(level)) > Math.abs(levelNetPut(best)) ? level : best)
    : null;
  const largestLong = levels.length
    ? levels.reduce((best, level) => levelLongGamma(level) > levelLongGamma(best) ? level : best)
    : null;
  const largestShort = levels.length
    ? levels.reduce((best, level) => levelShortGamma(level) > levelShortGamma(best) ? level : best)
    : null;
  const currentTotals = levels.reduce((totals, level) => ({
    call: totals.call + levelNetCall(level),
    put: totals.put + levelNetPut(level),
    long: totals.long + levelLongGamma(level),
    short: totals.short + levelShortGamma(level),
    contracts: totals.contracts + level.callContracts + level.putContracts,
    weighted: totals.weighted + level.weightedPrints,
    unweighted: totals.unweighted + level.unweightedPrints,
  }), { call: 0, put: 0, long: 0, short: 0, contracts: 0, weighted: 0, unweighted: 0 });
  const weightedCoverage = currentTotals.weighted + currentTotals.unweighted > 0
    ? currentTotals.weighted / (currentTotals.weighted + currentTotals.unweighted)
    : 0;

  const fiveMinuteProfile = historicalProfiles.get(5) ?? new Map<number, ClassifiedGexLevel>();
  const changes = levels.map((level) => {
    const prior = fiveMinuteProfile.get(level.price) ?? emptyLevel(level.price);
    return {
      price: level.price,
      call: levelNetCall(level) - levelNetCall(prior),
      put: levelNetPut(level) - levelNetPut(prior),
      total: levelNetCall(level) + levelNetPut(level) - levelNetCall(prior) - levelNetPut(prior),
    };
  });
  const largestBuildCandidate = changes.length
    ? changes.reduce((best, change) => change.total > best.total ? change : best)
    : null;
  const largestLossCandidate = changes.length
    ? changes.reduce((best, change) => change.total < best.total ? change : best)
    : null;
  const largestBuild = largestBuildCandidate && largestBuildCandidate.total > 0
    ? largestBuildCandidate
    : null;
  const largestLoss = largestLossCandidate && largestLossCandidate.total < 0
    ? largestLossCandidate
    : null;

  const state = useMemo(
    () => stateForPrints(prints, {
      sourceFilter,
      stateScope,
      perspective,
      sessionDate: payload.sessionDate,
      startTime,
      endTime,
    }),
    [endTime, payload.sessionDate, perspective, prints, sourceFilter, startTime, stateScope],
  );
  const stateTimeline = useMemo(() => {
    const sampled = frames.filter((_, index) => (
      index === 0
      || index === frames.length - 1
      || index % Math.max(1, Math.ceil(frames.length / 34)) === 0
    ));
    return sampled.map((timestamp): StatePoint => {
      const frameEnd = timestamp + 59_999;
      const frameStart = windowFilter === "SESSION" ? 0 : frameEnd - windowFilter * 60_000;
      return {
        timestamp,
        ...stateForPrints(prints, {
          sourceFilter,
          stateScope,
          perspective,
          sessionDate: payload.sessionDate,
          startTime: frameStart,
          endTime: frameEnd,
        }),
      };
    });
  }, [frames, payload.sessionDate, perspective, prints, sourceFilter, stateScope, windowFilter]);
  const stateValues = stateTimeline.map((point) => stateMetricValue(point, stateMetric));
  const stateMaximum = Math.max(1, ...stateValues.map(Math.abs));
  const stateX = (index: number) => 18 + index / Math.max(1, stateTimeline.length - 1) * 268;
  const stateY = (value: number) => 74 - value / stateMaximum * 52;
  const statePath = stateTimeline.map((point, index) => (
    `${index ? "L" : "M"}${stateX(index).toFixed(2)},${stateY(stateMetricValue(point, stateMetric)).toFixed(2)}`
  )).join(" ");

  const selectedLevel = selectedPrice === null
    ? majorCall ?? majorPut
    : levels.find((level) => level.price === selectedPrice) ?? majorCall ?? majorPut;
  const selectFrame = (index: number) => {
    const next = clamp(index, 0, latestFrame);
    setSelectedFrame(next);
    followsLatest.current = next === latestFrame;
    setPlaying(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-panel">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary">
            <Crosshair className="h-3.5 w-3.5" />
          </span>
          <div className="mr-1">
            <div className="text-[9px] font-semibold">Classified GEX Ladder</div>
            <div className="text-[6px] uppercase tracking-[0.12em] text-muted">Gamma-weighted classified options activity</div>
          </div>
          <KwantSelect
            value={sourceFilter}
            onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)}
            menuLabel="Options source"
            className="h-8 min-w-28 rounded-xl border border-border bg-surface px-2 text-[7px]"
          >
            <option value="COMBINED">NDX + QQQ</option><option value="NDX">NDX</option><option value="QQQ">QQQ</option>
          </KwantSelect>
          <div className="flex items-center rounded-xl border border-border bg-surface p-0.5">
            {(["NET", "GROSS"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDisplayMode(option)}
                className={`h-7 rounded-[9px] px-2.5 text-[6px] font-semibold transition ${
                  displayMode === option ? "bg-primary/[0.11] text-primary" : "text-muted hover:text-foreground"
                }`}
              >
                {option === "NET" ? "NET GEX" : "GROSS LONG / SHORT"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPerspective((current) => current === "CUSTOMER" ? "DEALER" : "CUSTOMER")}
            className="h-8 rounded-xl border border-border bg-surface px-2.5 text-[6px] font-semibold text-muted hover:text-foreground"
          >
            {perspective === "CUSTOMER" ? "CUSTOMER GAMMA" : "EST. DEALER GAMMA"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[7px] font-semibold ${
              replaying
                ? "border-warning/25 bg-warning/[0.06] text-warning"
                : payload.marketOpen
                  ? "border-primary/25 bg-primary/[0.06] text-primary"
                  : "border-border bg-surface text-muted"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                replaying ? "bg-warning" : payload.marketOpen ? "animate-pulse bg-primary" : "bg-muted"
              }`} />
              {replaying ? "PLAYBACK" : payload.marketOpen ? "LIVE" : "EOD"}
            </span>
            <span className="hidden h-8 items-center rounded-xl border border-border bg-surface px-2.5 font-mono text-[6px] text-muted md:flex">
              {unit === "DOLLAR_1PCT" ? "UNIT: $ / 1% MOVE" : "UNIT: SHARE EQUIVALENT"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-3 py-1.5">
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
            {WINDOWS.map((window) => (
              <button
                key={window}
                type="button"
                onClick={() => setWindowFilter(window)}
                className={`h-6 rounded-md px-2 text-[6px] font-semibold ${
                  windowFilter === window ? "bg-primary/[0.11] text-primary" : "text-muted hover:text-foreground"
                }`}
              >
                {window === "SESSION" ? "SESSION" : `${window}m`}
              </button>
            ))}
          </div>
          <FilterSelect value={expiryFilter} onChange={(value) => setExpiryFilter(value as ExpiryFilter)} label="Expiry">
            <option value="ALL">All expiries</option><option value="0DTE">0DTE</option><option value="1DTE">1DTE</option>
          </FilterSelect>
          <FilterSelect value={confidenceFilter} onChange={(value) => setConfidenceFilter(value as ConfidenceFilter)} label="Confidence">
            <option value="ALL">All confidence</option><option value="HIGH_MEDIUM">High + medium</option><option value="HIGH">High only</option>
          </FilterSelect>
          <FilterSelect value={String(minimumSize)} onChange={(value) => setMinimumSize(Number(value))} label="Minimum size">
            <option value="0">All sizes</option><option value="50">50+</option><option value="100">100+</option><option value="500">500+</option>
          </FilterSelect>
          <FilterSelect value={scaleMode} onChange={(value) => setScaleMode(value as ScaleMode)} label="Bar scale">
            <option value="LINEAR">Linear scale</option><option value="SQRT">Square-root scale</option><option value="LOG">Log scale</option>
          </FilterSelect>
          <FilterSelect value={unit} onChange={(value) => setUnit(value as GexUnit)} label="GEX unit">
            <option value="DOLLAR_1PCT">Dollar gamma / 1%</option><option value="SHARE_EQ">Share equivalent</option>
          </FilterSelect>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-px bg-border xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-h-0 flex-col bg-background">
          <div className="relative min-h-0 flex-1">
            {!visibleLevels.length ? (
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <div>
                  <Radio className="mx-auto h-5 w-5 animate-pulse text-primary" />
                  <div className="mt-3 text-[8px] font-semibold">No gamma-weighted classified prints match</div>
                  <div className="mx-auto mt-1 max-w-sm text-[6px] leading-3 text-muted">
                    Prints without usable provider IV or a solvable option price are excluded from the GEX bars and retained in coverage.
                  </div>
                </div>
              </div>
            ) : (
              <svg
                className="h-full min-h-[410px] w-full"
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Gamma-weighted classified put and call activity by NQ mapped strike"
              >
                <defs>
                  <pattern id="classified-gex-call-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="3" height="6" fill={CALL_COLOR} fillOpacity="0.72" />
                  </pattern>
                  <pattern id="classified-gex-put-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="3" height="6" fill={PUT_COLOR} fillOpacity="0.72" />
                  </pattern>
                  <filter id="classified-gex-glow" x="-20%" y="-250%" width="140%" height="600%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="var(--background)" />
                <text x="255" y="21" textAnchor="middle" fill="var(--muted)" fontSize="7" fontWeight="600">PUT CLASSIFIED GEX</text>
                <text x="650" y="21" textAnchor="middle" fill="var(--muted)" fontSize="7" fontWeight="600">CALL CLASSIFIED GEX</text>
                <text x="958" y="21" textAnchor="middle" fill="var(--muted)" fontSize="7" fontWeight="600">STATE / CHANGE</text>
                <line x1={ZERO_X} x2={ZERO_X} y1={PLOT_TOP - 8} y2={PLOT_BOTTOM + 4} stroke="var(--border)" />
                <line x1={SUMMARY_X - 12} x2={SUMMARY_X - 12} y1={PLOT_TOP - 8} y2={PLOT_BOTTOM + 4} stroke="var(--border)" />

                {visibleLevels.map((level) => {
                  const y = yForPrice(level.price);
                  const call = levelNetCall(level);
                  const put = levelNetPut(level);
                  const nearAtm = Math.abs(level.price - referencePrice) <= bucketSize;
                  const structural = unit === "DOLLAR_1PCT"
                    ? structuralAt(payload.rail, level.price, bucketSize)
                    : null;
                  const prior = fiveMinuteProfile.get(level.price) ?? emptyLevel(level.price);
                  const fiveMinuteChange = call + put - levelNetCall(prior) - levelNetPut(prior);
                  const shortDominates = levelShortGamma(level) > levelLongGamma(level);
                  return (
                    <g key={level.price} className="cursor-pointer" onClick={() => setSelectedPrice(level.price)}>
                      {nearAtm ? <rect x="34" y={y - 10} width="1_006" height="20" rx="5" fill="var(--primary)" fillOpacity="0.035" /> : null}
                      <line x1="40" x2="1_044" y1={y + 10} y2={y + 10} stroke="var(--border)" strokeOpacity={nearAtm ? 0.48 : 0.22} />
                      {structural ? (
                        <>
                          <rect
                            x={xForPut(structural.put)}
                            y={y - 8}
                            width={ZERO_X - xForPut(structural.put)}
                            height="16"
                            rx="2"
                            fill="none"
                            stroke="var(--muted)"
                            strokeOpacity="0.24"
                          />
                          <rect
                            x={ZERO_X}
                            y={y - 8}
                            width={xForCall(structural.call) - ZERO_X}
                            height="16"
                            rx="2"
                            fill="none"
                            stroke="var(--muted)"
                            strokeOpacity="0.24"
                          />
                        </>
                      ) : null}

                      {displayMode === "GROSS" ? (
                        <>
                          <GexConfidenceBar volume={level.longPut} maximum={maximum} scaleMode={scaleMode} direction="LEFT" y={y - 7} color={PUT_COLOR} patternId="classified-gex-put-stripe" />
                          <GexConfidenceBar volume={level.shortPut} maximum={maximum} scaleMode={scaleMode} direction="LEFT" y={y + 1} color={PUT_COLOR} patternId="classified-gex-put-stripe" shortGamma />
                          <GexConfidenceBar volume={level.longCall} maximum={maximum} scaleMode={scaleMode} direction="RIGHT" y={y - 7} color={CALL_COLOR} patternId="classified-gex-call-stripe" />
                          <GexConfidenceBar volume={level.shortCall} maximum={maximum} scaleMode={scaleMode} direction="RIGHT" y={y + 1} color={CALL_COLOR} patternId="classified-gex-call-stripe" shortGamma />
                        </>
                      ) : (
                        <>
                          <rect
                            x={xForPut(put)}
                            y={y - 5}
                            width={ZERO_X - xForPut(put)}
                            height="10"
                            rx="2"
                            fill={put >= 0 ? PUT_COLOR : "url(#classified-gex-put-stripe)"}
                            fillOpacity={put >= 0 ? 0.9 : 0.66}
                          />
                          <rect
                            x={ZERO_X}
                            y={y - 5}
                            width={xForCall(call) - ZERO_X}
                            height="10"
                            rx="2"
                            fill={call >= 0 ? CALL_COLOR : "url(#classified-gex-call-stripe)"}
                            fillOpacity={call >= 0 ? 0.9 : 0.66}
                          />
                        </>
                      )}

                      {DOT_LOOKBACKS.map((dot) => {
                        const historical = historicalProfiles.get(dot.minutes)?.get(level.price);
                        if (!historical) return null;
                        const historicalPut = levelNetPut(historical);
                        const historicalCall = levelNetCall(historical);
                        return (
                          <g key={dot.minutes}>
                            <circle
                              cx={xForPut(historicalPut)}
                              cy={y}
                              r={dot.radius}
                              fill={historicalPut >= 0 ? PUT_COLOR : "var(--background)"}
                              fillOpacity={historicalPut >= 0 ? dot.opacity : 1}
                              stroke={PUT_COLOR}
                              strokeOpacity={dot.opacity}
                              strokeWidth="1.2"
                            />
                            <circle
                              cx={xForCall(historicalCall)}
                              cy={y}
                              r={dot.radius}
                              fill={historicalCall >= 0 ? CALL_COLOR : "var(--background)"}
                              fillOpacity={historicalCall >= 0 ? dot.opacity : 1}
                              stroke={CALL_COLOR}
                              strokeOpacity={dot.opacity}
                              strokeWidth="1.2"
                            />
                          </g>
                        );
                      })}
                      <rect x={ZERO_X - 38} y={y - 8} width="76" height="16" rx="4" fill="var(--background)" stroke={nearAtm ? "var(--primary)" : "var(--border)"} strokeOpacity={nearAtm ? 0.8 : 0.65} />
                      <text x={ZERO_X} y={y + 3} textAnchor="middle" fill={nearAtm ? "var(--primary)" : "var(--foreground)"} fontSize="6.8" fontFamily="monospace" fontWeight={nearAtm ? 700 : 500}>
                        {formatPrice(level.price)}{nearAtm ? " ATM" : ""}
                      </text>
                      {majorCall?.price === level.price ? <text x="730" y={y - 7} fill={CALL_COLOR} fontSize="5.4" fontWeight="700">MAJOR CALL GEX</text> : null}
                      {majorPut?.price === level.price ? <text x="44" y={y - 7} fill={PUT_COLOR} fontSize="5.4" fontWeight="700">MAJOR PUT GEX</text> : null}
                      <text x="858" y={y - 2} fill={shortDominates ? "var(--warning)" : "var(--primary)"} fontSize="6" fontWeight="700">
                        {shortDominates ? "SHORT-GAMMA FLOW" : "LONG-GAMMA FLOW"}
                      </text>
                      <text x="858" y={y + 6} fill={fiveMinuteChange >= 0 ? "var(--primary)" : "var(--danger)"} fontSize="5.2">
                        5m {compactSigned(fiveMinuteChange)}
                      </text>
                      <title>{[
                        `NQ ${formatPrice(level.price)}`,
                        `Long call GEX ${compact(level.longCall.total)}`,
                        `Short call GEX -${compact(level.shortCall.total)}`,
                        `Long put GEX ${compact(level.longPut.total)}`,
                        `Short put GEX -${compact(level.shortPut.total)}`,
                        `Net call ${compactSigned(call)}`,
                        `Net put ${compactSigned(put)}`,
                        `Contracts ${compact(level.callContracts + level.putContracts)}`,
                        `Greek coverage ${level.weightedPrints}/${level.weightedPrints + level.unweightedPrints}`,
                        `5m change ${compactSigned(fiveMinuteChange)}`,
                        "Opening/closing and ultimate dealer side are unconfirmed",
                      ].join(" | ")}</title>
                    </g>
                  );
                })}

                <g className={!replaying && payload.marketOpen ? "gexdesk-live-price" : ""} filter="url(#classified-gex-glow)">
                  <line x1="32" x2="1_048" y1={yForPrice(referencePrice)} y2={yForPrice(referencePrice)} stroke="var(--foreground)" strokeWidth="1.15" strokeDasharray="4 4" />
                  <rect x="394" y={yForPrice(referencePrice) - 10} width="142" height="20" rx="6" fill="var(--foreground)" />
                  <text x="465" y={yForPrice(referencePrice) + 3} textAnchor="middle" fill="var(--background)" fontSize="7" fontFamily="monospace" fontWeight="700">
                    NQ {formatPrice(referencePrice, 2)}
                  </text>
                </g>
              </svg>
            )}
            <div className="pointer-events-none absolute bottom-2 left-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-background/82 px-2.5 py-1.5 text-[5.5px] text-muted backdrop-blur-md">
              <span><strong className="text-foreground">LEFT</strong> put GEX</span>
              <span><strong className="text-foreground">RIGHT</strong> call GEX</span>
              <span><strong className="text-foreground">SOLID</strong> long gamma</span>
              <span><strong className="text-foreground">STRIPED</strong> short gamma</span>
              <span><strong className="text-foreground">OUTLINE</strong> structural OI GEX</span>
              {DOT_LOOKBACKS.map((dot) => <span key={dot.minutes} style={{ opacity: dot.opacity }}>● {dot.minutes}m</span>)}
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-panel px-3 py-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => selectFrame(selectedFrame - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground">
                <SkipBack className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => setPlaying((current) => !current)} className="flex h-7 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/[0.07] px-2.5 text-[7px] font-semibold text-primary">
                {playing ? <CirclePause className="h-3 w-3" /> : <CirclePlay className="h-3 w-3" />}
                {playing ? "PAUSE" : "PLAY"}
              </button>
              <button type="button" onClick={() => selectFrame(selectedFrame + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground">
                <SkipForward className="h-3 w-3" />
              </button>
              <input
                type="range"
                min={0}
                max={latestFrame}
                value={selectedFrame}
                onChange={(event) => selectFrame(Number(event.target.value))}
                className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--primary)]"
                aria-label="Classified GEX playback time"
              />
              <span className="font-mono text-[6px] text-muted">{timeLabel(selectedTime, true)} ET</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFrame(latestFrame);
                  followsLatest.current = true;
                  setPlaying(false);
                }}
                className={`h-7 rounded-lg border px-2.5 text-[7px] font-semibold ${
                  replaying ? "border-primary/25 bg-primary/[0.07] text-primary" : "border-border bg-surface text-muted"
                }`}
              >
                LATEST
              </button>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-px bg-border">
          <section className="bg-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Classified GEX summary</div>
                <div className="mt-1 text-[8px] font-semibold">ACTIVE GAMMA</div>
              </div>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SummaryMetric label="Net call GEX" value={currentTotals.call} tone="call" />
              <SummaryMetric label="Net put GEX" value={currentTotals.put} tone="put" />
              <SummaryMetric label="Long gamma" value={currentTotals.long} tone="primary" />
              <SummaryMetric label="Short gamma" value={-currentTotals.short} tone="warning" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <LevelMetric label="Major call" level={majorCall?.price ?? null} />
              <LevelMetric label="Major put" level={majorPut?.price ?? null} />
              <LevelMetric label="Largest long gamma" level={largestLong?.price ?? null} />
              <LevelMetric label="Largest short gamma" level={largestShort?.price ?? null} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[5.5px] text-muted">
              <span>Greek coverage {(weightedCoverage * 100).toFixed(0)}%</span>
              <span>{currentTotals.weighted} weighted</span>
              <span>{currentTotals.unweighted} excluded</span>
            </div>
          </section>

          <section className="bg-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Aggregate options complex</div>
                <div className="mt-1 text-[8px] font-semibold">STATE INDICATORS</div>
              </div>
              <Gauge className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex gap-1">
              {(["FULL", "0DTE", "1DTE"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setStateScope(scope)}
                  className={`h-6 flex-1 rounded-lg border text-[5.5px] font-semibold ${
                    stateScope === scope ? "border-primary/25 bg-primary/[0.08] text-primary" : "border-border bg-surface text-muted"
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1">
              {(["DEX", "GEX", "CONVEXITY", "VANNA", "CHARM"] as const).map((metric) => (
                <button
                  key={metric}
                  type="button"
                  onClick={() => setStateMetric(metric)}
                  className={`h-6 flex-1 rounded-md text-[5px] font-semibold ${
                    stateMetric === metric ? "bg-primary/[0.1] text-primary" : "text-muted hover:text-foreground"
                  }`}
                >
                  {metric === "CONVEXITY" ? "CONVEX" : metric}
                </button>
              ))}
            </div>
            <svg className="mt-2 h-[118px] w-full" viewBox="0 0 304 148" role="img" aria-label={`${stateMetric} classified state through the session`}>
              <rect width="304" height="148" rx="12" fill="var(--surface)" />
              <line x1="18" x2="286" y1="74" y2="74" stroke="var(--border)" strokeWidth="1" />
              <path d={statePath} fill="none" stroke="var(--primary)" strokeWidth="2" />
              {stateTimeline.map((point, index) => (
                <circle key={point.timestamp} cx={stateX(index)} cy={stateY(stateMetricValue(point, stateMetric))} r={index === stateTimeline.length - 1 ? 2.6 : 1.2} fill="var(--primary)" fillOpacity={index === stateTimeline.length - 1 ? 1 : 0.38} />
              ))}
              <text x="20" y="140" fill="var(--muted)" fontSize="6">{stateUnit(stateMetric)}</text>
              <text x="284" y="140" textAnchor="end" fill={stateMetricValue(state, stateMetric) >= 0 ? "var(--primary)" : "var(--danger)"} fontSize="7" fontWeight="700">
                {compactSigned(stateMetricValue(state, stateMetric))}
              </text>
            </svg>
            <div className="mt-1 text-[5.5px] leading-3 text-muted">{stateInterpretation(stateMetric, stateMetricValue(state, stateMetric))}</div>
          </section>

          <section className="min-h-0 flex-1 bg-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Volume versus gamma</div>
                <div className="mt-1 text-[8px] font-semibold">STRIKE COMPARISON</div>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            {selectedLevel ? (
              <div className="mt-3 rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] font-semibold text-foreground">{formatPrice(selectedLevel.price)}</span>
                  <span className="text-[5px] text-muted">{formatPrice(selectedLevel.price - referencePrice, 1)} pts from NQ</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                  <CompareMetric label="Classified contracts" value={compact(selectedLevel.callContracts + selectedLevel.putContracts)} />
                  <CompareMetric label="Classified GEX" value={compactSigned(levelNetCall(selectedLevel) + levelNetPut(selectedLevel))} />
                  <CompareMetric label="Call GEX" value={compactSigned(levelNetCall(selectedLevel))} />
                  <CompareMetric label="Put GEX" value={compactSigned(levelNetPut(selectedLevel))} />
                  <CompareMetric label="5m GEX change" value={compactSigned(
                    levelNetCall(selectedLevel)
                    + levelNetPut(selectedLevel)
                    - levelNetCall(fiveMinuteProfile.get(selectedLevel.price) ?? emptyLevel(selectedLevel.price))
                    - levelNetPut(fiveMinuteProfile.get(selectedLevel.price) ?? emptyLevel(selectedLevel.price))
                  )} />
                  <CompareMetric label="Greek coverage" value={`${selectedLevel.weightedPrints}/${selectedLevel.weightedPrints + selectedLevel.unweightedPrints}`} />
                </div>
              </div>
            ) : <div className="mt-3 text-[6px] text-muted">Select a strike to inspect it.</div>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ChangeMetric label="Largest 5m build" change={largestBuild} />
              <ChangeMetric label="Largest 5m loss" change={largestLoss} />
            </div>
          </section>

          <section className="bg-panel p-3">
            <div className="flex gap-2 rounded-xl border border-warning/20 bg-warning/[0.035] p-2.5">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <div>
                <div className="text-[6px] font-semibold">MODELED, NOT CONFIRMED INVENTORY</div>
                <div className="mt-1 text-[5.2px] leading-3 text-muted">
                  Greeks use provider IV or price-implied Black-Scholes at the print time with a zero-rate assumption. Classification, opening/closing and dealer counterparty remain estimates.
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-panel px-3 py-2 text-[6px] text-muted">
        <span><strong className="text-foreground">LEFT / RIGHT</strong> = put / call</span>
        <span><strong className="text-foreground">SOLID / STRIPED</strong> = long / short gamma</span>
        <span><strong className="text-foreground">BRIGHT / DIM / OUTLINE</strong> = high / medium / low confidence</span>
        <span><strong className="text-foreground">DOTS</strong> = exact prior window endpoints</span>
        <span><strong className="text-foreground">OI OUTLINE</strong> = structural profile, shown only in $/1% mode</span>
        <span className="ml-auto">{unit === "DOLLAR_1PCT" ? "Contracts x gamma x 100 x source spot² x 1%" : "Contracts x gamma x 100"}</span>
        <span className="w-full">State DEX = classified call delta minus put delta; State GEX = net classified call GEX minus put GEX; Convexity = long classified GEX minus short classified GEX.</span>
      </footer>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <KwantSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
      menuLabel={label}
      className="h-7 min-w-24 rounded-lg border border-border bg-background px-2 text-[6px]"
    >
      {children}
    </KwantSelect>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "call" | "put" | "primary" | "warning";
}) {
  const color = tone === "call"
    ? CALL_COLOR
    : tone === "put"
      ? PUT_COLOR
      : tone === "primary"
        ? "var(--primary)"
        : "var(--warning)";
  return (
    <div className="rounded-xl border border-border bg-surface px-2.5 py-2">
      <div className="text-[5px] uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="mt-1 font-mono text-[8px] font-semibold" style={{ color }}>{compactSigned(value)}</div>
    </div>
  );
}

function LevelMetric({ label, level }: { label: string; level: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2 py-1.5">
      <div className="text-[5px] text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[7px] font-semibold text-foreground">{formatPrice(level)}</div>
    </div>
  );
}

function CompareMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[5px] uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[7px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ChangeMetric({
  label,
  change,
}: {
  label: string;
  change: { price: number; total: number } | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2 py-1.5">
      <div className="text-[5px] text-muted">{label}</div>
      <div className={`mt-0.5 font-mono text-[7px] font-semibold ${
        (change?.total ?? 0) >= 0 ? "text-primary" : "text-danger"
      }`}>
        {formatPrice(change?.price ?? null)} {change ? compactSigned(change.total) : "--"}
      </div>
    </div>
  );
}
