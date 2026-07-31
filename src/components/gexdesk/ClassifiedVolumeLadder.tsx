"use client";

import {
  Activity,
  CirclePause,
  CirclePlay,
  Radio,
  ScanLine,
  ShieldCheck,
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
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";

type SourceFilter = "COMBINED" | GexDeskSourceSymbol;
type WindowFilter = 1 | 5 | 15 | 30 | "SESSION";
type ExpiryFilter = "ALL" | "0DTE" | "1DTE";
type OptionFilter = "BOTH" | "CALL" | "PUT";
type SideFilter = "BOTH" | "BOUGHT" | "SOLD";
type ConfidenceFilter = "ALL" | "HIGH_MEDIUM" | "HIGH";
type ScaleMode = "LINEAR" | "SQRT" | "LOG";
type DisplayMode = "GROSS" | "DIRECTION" | "GAMMA";
type Perspective = "CUSTOMER" | "DEALER";
type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";
type ClassifiedCategory = "LONG_CALL" | "SHORT_CALL" | "LONG_PUT" | "SHORT_PUT";

type ConfidenceVolume = {
  high: number;
  medium: number;
  low: number;
  total: number;
};

type ClassifiedLevel = {
  price: number;
  longCall: ConfidenceVolume;
  shortCall: ConfidenceVolume;
  longPut: ConfidenceVolume;
  shortPut: ConfidenceVolume;
  uncertainCall: number;
  uncertainPut: number;
  premium: number;
  prints: number;
  largePrints: number;
  latestTimestamp: number;
};

type FlowTotals = {
  longCall: number;
  shortCall: number;
  longPut: number;
  shortPut: number;
  uncertain: number;
  high: number;
  medium: number;
  low: number;
  premium: number;
  prints: number;
};

type TimelinePoint = FlowTotals & {
  timestamp: number;
};

const WINDOWS: readonly WindowFilter[] = [1, 5, 15, 30, "SESSION"];
const SVG_WIDTH = 1_100;
const SVG_HEIGHT = 560;
const PLOT_TOP = 42;
const PLOT_BOTTOM = 534;
const ZERO_X = 470;
const SIDE_WIDTH = 360;
const SUMMARY_X = 858;
const CALL_COLOR = "#36d98a";
const PUT_COLOR = "#ff5367";

function emptyConfidenceVolume(): ConfidenceVolume {
  return { high: 0, medium: 0, low: 0, total: 0 };
}

function emptyLevel(price: number): ClassifiedLevel {
  return {
    price,
    longCall: emptyConfidenceVolume(),
    shortCall: emptyConfidenceVolume(),
    longPut: emptyConfidenceVolume(),
    shortPut: emptyConfidenceVolume(),
    uncertainCall: 0,
    uncertainPut: 0,
    premium: 0,
    prints: 0,
    largePrints: 0,
    latestTimestamp: 0,
  };
}

function emptyTotals(): FlowTotals {
  return {
    longCall: 0,
    shortCall: 0,
    longPut: 0,
    shortPut: 0,
    uncertain: 0,
    high: 0,
    medium: 0,
    low: 0,
    premium: 0,
    prints: 0,
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

function confidenceTier(value: number): ConfidenceTier {
  if (value >= 0.85) return "HIGH";
  if (value >= 0.5) return "MEDIUM";
  return "LOW";
}

function categoryFor(
  contractType: "CALL" | "PUT",
  side: "BOUGHT" | "SOLD",
): ClassifiedCategory {
  if (contractType === "CALL") return side === "BOUGHT" ? "LONG_CALL" : "SHORT_CALL";
  return side === "BOUGHT" ? "LONG_PUT" : "SHORT_PUT";
}

function categoryVolume(level: ClassifiedLevel, category: ClassifiedCategory) {
  if (category === "LONG_CALL") return level.longCall;
  if (category === "SHORT_CALL") return level.shortCall;
  if (category === "LONG_PUT") return level.longPut;
  return level.shortPut;
}

function addConfidenceVolume(target: ConfidenceVolume, tier: ConfidenceTier, amount: number) {
  target.total += amount;
  if (tier === "HIGH") target.high += amount;
  else if (tier === "MEDIUM") target.medium += amount;
  else target.low += amount;
}

function compact(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${(absolute / 1_000).toFixed(1)}K`;
  return absolute.toFixed(0);
}

function compactSigned(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${compact(value)}`;
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `$${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `$${(absolute / 1_000).toFixed(1)}K`;
  return `$${absolute.toFixed(0)}`;
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

function nextBusinessDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  do value.setUTCDate(value.getUTCDate() + 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

function transformScale(value: number, mode: ScaleMode) {
  if (mode === "SQRT") return Math.sqrt(Math.max(0, value));
  if (mode === "LOG") return Math.log1p(Math.max(0, value));
  return Math.max(0, value);
}

function classifiableSide(
  print: GexDeskOptionPrint,
  perspective: Perspective,
) {
  if (print.side === "MID") return null;
  if (perspective === "CUSTOMER") return print.side;
  return print.side === "BOUGHT" ? "SOLD" : "BOUGHT";
}

function printAllowed(
  print: GexDeskOptionPrint,
  args: {
    sourceFilter: SourceFilter;
    expiryFilter: ExpiryFilter;
    optionFilter: OptionFilter;
    sideFilter: SideFilter;
    confidenceFilter: ConfidenceFilter;
    minimumSize: number;
    perspective: Perspective;
    sessionDate: string;
    startTime: number;
    endTime: number;
  },
) {
  const timestamp = safeTimestamp(Number(print.timestamp));
  if (timestamp === null || timestamp < args.startTime || timestamp > args.endTime) return false;
  if (args.sourceFilter !== "COMBINED" && print.source !== args.sourceFilter) return false;
  if (args.expiryFilter === "0DTE" && print.expiration !== args.sessionDate) return false;
  if (args.expiryFilter === "1DTE" && print.expiration !== nextBusinessDate(args.sessionDate)) return false;
  if (args.optionFilter !== "BOTH" && print.contractType !== args.optionFilter) return false;
  const side = classifiableSide(print, args.perspective);
  if (args.sideFilter !== "BOTH" && side !== args.sideFilter) return false;
  const tier = confidenceTier(Number(print.confidence));
  if (args.confidenceFilter === "HIGH" && tier !== "HIGH") return false;
  if (args.confidenceFilter === "HIGH_MEDIUM" && tier === "LOW") return false;
  return Number(print.size) >= args.minimumSize;
}

function aggregatePrints(
  prints: GexDeskOptionPrint[],
  args: {
    sourceFilter: SourceFilter;
    expiryFilter: ExpiryFilter;
    optionFilter: OptionFilter;
    sideFilter: SideFilter;
    confidenceFilter: ConfidenceFilter;
    minimumSize: number;
    perspective: Perspective;
    sessionDate: string;
    startTime: number;
    endTime: number;
    bucketSize: number;
    largeThreshold: number;
  },
) {
  const levels = new Map<number, ClassifiedLevel>();
  for (const print of prints) {
    if (!printAllowed(print, args)) continue;
    const mappedPrice = Number(print.mappedPrice);
    const size = Math.max(0, Number(print.size));
    const timestamp = safeTimestamp(Number(print.timestamp));
    if (
      timestamp === null
      || !Number.isFinite(mappedPrice)
      || mappedPrice <= 0
      || !Number.isFinite(size)
      || size <= 0
    ) continue;
    const price = Math.round(mappedPrice / args.bucketSize) * args.bucketSize;
    const level = levels.get(price) ?? emptyLevel(price);
    const side = classifiableSide(print, args.perspective);
    if (side === null) {
      if (print.contractType === "CALL") level.uncertainCall += size;
      else level.uncertainPut += size;
    } else {
      addConfidenceVolume(
        categoryVolume(level, categoryFor(print.contractType, side)),
        confidenceTier(Number(print.confidence)),
        size,
      );
    }
    level.premium += Math.max(0, Number(print.premium));
    level.prints += 1;
    if (size >= args.largeThreshold) level.largePrints += 1;
    level.latestTimestamp = Math.max(level.latestTimestamp, timestamp);
    levels.set(price, level);
  }
  return [...levels.values()].sort((left, right) => right.price - left.price);
}

function totalsFor(levels: ClassifiedLevel[]) {
  return levels.reduce((totals, level) => {
    totals.longCall += level.longCall.total;
    totals.shortCall += level.shortCall.total;
    totals.longPut += level.longPut.total;
    totals.shortPut += level.shortPut.total;
    totals.uncertain += level.uncertainCall + level.uncertainPut;
    for (const category of [level.longCall, level.shortCall, level.longPut, level.shortPut]) {
      totals.high += category.high;
      totals.medium += category.medium;
      totals.low += category.low;
    }
    totals.premium += level.premium;
    totals.prints += level.prints;
    return totals;
  }, emptyTotals());
}

function dominantFor(level: ClassifiedLevel) {
  const categories: Array<{ category: ClassifiedCategory; value: number }> = [
    { category: "LONG_CALL", value: level.longCall.total },
    { category: "SHORT_CALL", value: level.shortCall.total },
    { category: "LONG_PUT", value: level.longPut.total },
    { category: "SHORT_PUT", value: level.shortPut.total },
  ];
  const total = categories.reduce((sum, row) => sum + row.value, 0);
  const dominant = categories.reduce((best, row) => row.value > best.value ? row : best);
  return {
    category: dominant.category,
    share: total > 0 ? dominant.value / total : 0,
    gross: total,
  };
}

function categoryShortLabel(category: ClassifiedCategory) {
  if (category === "LONG_CALL") return "LC";
  if (category === "SHORT_CALL") return "SC";
  if (category === "LONG_PUT") return "LP";
  return "SP";
}

function categoryLabel(category: ClassifiedCategory) {
  if (category === "LONG_CALL") return "LONG CALL";
  if (category === "SHORT_CALL") return "SHORT CALL";
  if (category === "LONG_PUT") return "LONG PUT";
  return "SHORT PUT";
}

function categoryContext(category: ClassifiedCategory) {
  if (category === "LONG_CALL") return "BULLISH / LONG VOL";
  if (category === "SHORT_CALL") return "BEARISH-NEUTRAL / SHORT VOL";
  if (category === "LONG_PUT") return "BEARISH / LONG VOL";
  return "BULLISH-NEUTRAL / SHORT VOL";
}

function nearestPriceAt(
  history: GexDeskHistoryPayload | null,
  timestamp: number,
  fallback: number,
) {
  if (!history?.timestamps.length || !history.nqPrices.length) return fallback;
  let nearestIndex = 0;
  let distance = Infinity;
  history.timestamps.forEach((candidate, index) => {
    const nextDistance = Math.abs(candidate - timestamp);
    if (nextDistance < distance) {
      nearestIndex = index;
      distance = nextDistance;
    }
  });
  return history.nqPrices[nearestIndex] ?? fallback;
}

function minuteFrames(prints: GexDeskOptionPrint[]) {
  return [...new Set(prints.flatMap((print) => {
    const timestamp = safeTimestamp(Number(print.timestamp));
    return timestamp === null ? [] : [Math.floor(timestamp / 60_000) * 60_000];
  }))].sort((left, right) => left - right);
}

function ConfidenceBar({
  volume,
  maximum,
  scaleMode,
  direction,
  y,
  color,
  patternId,
}: {
  volume: ConfidenceVolume;
  maximum: number;
  scaleMode: ScaleMode;
  direction: "LEFT" | "RIGHT";
  y: number;
  color: string;
  patternId: string;
}) {
  const scaleMaximum = Math.max(1, transformScale(maximum, scaleMode));
  const totalWidth = transformScale(volume.total, scaleMode) / scaleMaximum * SIDE_WIDTH;
  const widths = [
    { key: "high", value: volume.high, opacity: 0.95, pattern: false },
    { key: "medium", value: volume.medium, opacity: 0.72, pattern: true },
    { key: "low", value: volume.low, opacity: 0.28, pattern: false },
  ].map((segment) => ({
    ...segment,
    width: volume.total > 0 ? totalWidth * segment.value / volume.total : 0,
  }));
  let offset = 0;
  return (
    <g>
      {widths.map((segment) => {
        const x = direction === "RIGHT" ? ZERO_X + offset : ZERO_X - offset - segment.width;
        offset += segment.width;
        if (segment.width <= 0.2) return null;
        return (
          <rect
            key={segment.key}
            x={x}
            y={y}
            width={segment.width}
            height="5"
            rx="1.5"
            fill={segment.pattern ? `url(#${patternId})` : color}
            fillOpacity={segment.opacity}
            stroke={segment.key === "low" ? color : "none"}
            strokeOpacity="0.6"
            strokeWidth={segment.key === "low" ? "0.8" : "0"}
          />
        );
      })}
    </g>
  );
}

export default function ClassifiedVolumeLadder({
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
  const [optionFilter, setOptionFilter] = useState<OptionFilter>("BOTH");
  const [sideFilter, setSideFilter] = useState<SideFilter>("BOTH");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("ALL");
  const [minimumSize, setMinimumSize] = useState(0);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("LINEAR");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("GROSS");
  const [perspective, setPerspective] = useState<Perspective>("CUSTOMER");
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
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
  const startTime = windowFilter === "SESSION"
    ? 0
    : endTime - windowFilter * 60_000;
  const bucketSize = history?.bucketSize
    ?? (
      Math.abs((payload.rail[1]?.price ?? 0) - (payload.rail[0]?.price ?? 0))
      || 20
    );
  const largeThreshold = useMemo(() => {
    const sizes = prints
      .map((print) => Number(print.size))
      .filter((size) => Number.isFinite(size) && size > 0)
      .sort((left, right) => left - right);
    return Math.max(100, sizes[Math.floor(sizes.length * 0.9)] ?? 100);
  }, [prints]);

  const filterArgs = {
    sourceFilter,
    expiryFilter,
    optionFilter,
    sideFilter,
    confidenceFilter,
    minimumSize,
    perspective,
    sessionDate: payload.sessionDate,
    startTime,
    endTime,
    bucketSize,
    largeThreshold,
  };
  const levels = useMemo(
    () => aggregatePrints(prints, filterArgs),
    // The scalar filter dependencies intentionally define this aggregation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      prints,
      sourceFilter,
      expiryFilter,
      optionFilter,
      sideFilter,
      confidenceFilter,
      minimumSize,
      perspective,
      payload.sessionDate,
      startTime,
      endTime,
      bucketSize,
      largeThreshold,
    ],
  );
  const totals = useMemo(() => totalsFor(levels), [levels]);

  const referencePrice = replaying
    ? nearestPriceAt(history, selectedTime, payload.nqPrice ?? 0)
    : livePrice ?? payload.nqPrice ?? history?.nqPrices.at(-1) ?? 0;
  const visibleLevels = useMemo(() => {
    const existing = new Map(levels.map((level) => [level.price, level]));
    const sorted = [...levels].sort((left, right) => left.price - right.price);
    if (!sorted.length) return [];
    const nearestIndex = sorted.reduce((nearest, level, index) => (
      Math.abs(level.price - referencePrice) < Math.abs(sorted[nearest].price - referencePrice)
        ? index
        : nearest
    ), 0);
    const start = clamp(nearestIndex - 11, 0, Math.max(0, sorted.length - 23));
    const selected = sorted.slice(start, start + 23);
    const atm = Math.round(referencePrice / bucketSize) * bucketSize;
    if (!existing.has(atm) && !selected.some((level) => level.price === atm)) {
      selected.push(emptyLevel(atm));
    }
    return selected
      .sort((left, right) => Math.abs(left.price - referencePrice) - Math.abs(right.price - referencePrice))
      .slice(0, 23)
      .sort((left, right) => right.price - left.price);
  }, [bucketSize, levels, referencePrice]);

  const maximum = Math.max(
    1,
    ...visibleLevels.flatMap((level) => (
      displayMode === "GROSS"
        ? [level.longCall.total, level.shortCall.total, level.longPut.total, level.shortPut.total]
        : displayMode === "DIRECTION"
          ? [
              level.longCall.total + level.shortPut.total,
              level.shortCall.total + level.longPut.total,
            ]
          : [
              level.longCall.total + level.longPut.total,
              level.shortCall.total + level.shortPut.total,
            ]
    )),
  );
  const lowest = visibleLevels.at(-1)?.price ?? referencePrice - 1;
  const highest = visibleLevels[0]?.price ?? referencePrice + 1;
  const yForPrice = (price: number) => clamp(
    PLOT_TOP + (highest - price) / Math.max(1, highest - lowest) * (PLOT_BOTTOM - PLOT_TOP),
    PLOT_TOP,
    PLOT_BOTTOM,
  );
  const barWidth = (value: number) => transformScale(value, scaleMode)
    / Math.max(1, transformScale(maximum, scaleMode)) * SIDE_WIDTH;

  const directionalBullish = totals.longCall + totals.shortPut;
  const directionalBearish = totals.shortCall + totals.longPut;
  const netDirection = directionalBullish - directionalBearish;
  const longOptions = totals.longCall + totals.longPut;
  const shortOptions = totals.shortCall + totals.shortPut;
  const netConvexity = longOptions - shortOptions;
  const classifiedTotal = longOptions + shortOptions;
  const qualityTotal = totals.high + totals.medium + totals.low;

  const timeline = useMemo(() => {
    if (!frames.length) return [];
    const sampledFrames = frames.filter((_, index) => (
      index === 0
      || index === frames.length - 1
      || index % Math.max(1, Math.ceil(frames.length / 32)) === 0
    ));
    return sampledFrames.map((timestamp): TimelinePoint => {
      const frameEnd = timestamp + 59_999;
      const frameStart = windowFilter === "SESSION"
        ? 0
        : frameEnd - windowFilter * 60_000;
      const frameLevels = aggregatePrints(prints, {
        ...filterArgs,
        startTime: frameStart,
        endTime: frameEnd,
      });
      return { timestamp, ...totalsFor(frameLevels) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    frames,
    prints,
    sourceFilter,
    expiryFilter,
    optionFilter,
    sideFilter,
    confidenceFilter,
    minimumSize,
    perspective,
    payload.sessionDate,
    windowFilter,
    bucketSize,
    largeThreshold,
  ]);
  const timelineMaximum = Math.max(
    1,
    ...timeline.flatMap((point) => [point.longCall, point.shortCall, point.longPut, point.shortPut]),
  );
  const timelineX = (index: number) => 20 + index / Math.max(1, timeline.length - 1) * 264;
  const timelineY = (value: number) => 126 - value / timelineMaximum * 102;
  const timelinePoints = (field: keyof Pick<FlowTotals, "longCall" | "shortCall" | "longPut" | "shortPut">) => (
    timeline.map((point, index) => `${timelineX(index)},${timelineY(point[field])}`).join(" ")
  );

  const selectFrame = (index: number) => {
    const next = clamp(index, 0, latestFrame);
    setSelectedFrame(next);
    followsLatest.current = next === latestFrame;
    setPlaying(false);
  };
  const goLatest = () => {
    setSelectedFrame(latestFrame);
    followsLatest.current = true;
    setPlaying(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-panel">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary">
            <ScanLine className="h-3.5 w-3.5" />
          </span>
          <div className="mr-1">
            <div className="text-[9px] font-semibold">Classified Volume Ladder</div>
            <div className="text-[6px] uppercase tracking-[0.12em] text-muted">Call / put x classified bought / sold</div>
          </div>
          <KwantSelect
            value={sourceFilter}
            onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)}
            menuLabel="Options source"
            className="h-8 min-w-28 rounded-xl border border-border bg-surface px-2 text-[7px]"
          >
            <option value="COMBINED">NDX + QQQ</option>
            <option value="NDX">NDX</option>
            <option value="QQQ">QQQ</option>
          </KwantSelect>
          <div className="flex items-center rounded-xl border border-border bg-surface p-0.5">
            {(["GROSS", "DIRECTION", "GAMMA"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDisplayMode(option)}
                className={`h-7 rounded-[9px] px-2 text-[6px] font-semibold transition ${
                  displayMode === option ? "bg-primary/[0.11] text-primary" : "text-muted hover:text-foreground"
                }`}
              >
                {option === "GROSS" ? "GROSS" : option === "DIRECTION" ? "NET DIRECTION" : "NET GAMMA"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPerspective((current) => current === "CUSTOMER" ? "DEALER" : "CUSTOMER")}
              className="h-8 rounded-xl border border-border bg-surface px-2.5 text-[6px] font-semibold text-muted transition hover:text-foreground"
            >
              {perspective === "CUSTOMER" ? "CUSTOMER FLOW" : "EST. DEALER OPPOSITE"}
            </button>
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-3 py-1.5">
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
            {WINDOWS.map((window) => (
              <button
                key={window}
                type="button"
                onClick={() => setWindowFilter(window)}
                className={`h-6 rounded-md px-2 text-[6px] font-semibold transition ${
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
          <FilterSelect value={optionFilter} onChange={(value) => setOptionFilter(value as OptionFilter)} label="Option type">
            <option value="BOTH">Calls + puts</option><option value="CALL">Calls</option><option value="PUT">Puts</option>
          </FilterSelect>
          <FilterSelect value={sideFilter} onChange={(value) => setSideFilter(value as SideFilter)} label="Classified side">
            <option value="BOTH">Bought + sold</option><option value="BOUGHT">Bought</option><option value="SOLD">Sold</option>
          </FilterSelect>
          <FilterSelect value={confidenceFilter} onChange={(value) => setConfidenceFilter(value as ConfidenceFilter)} label="Confidence">
            <option value="ALL">All confidence</option><option value="HIGH_MEDIUM">High + medium</option><option value="HIGH">High only</option>
          </FilterSelect>
          <FilterSelect value={String(minimumSize)} onChange={(value) => setMinimumSize(Number(value))} label="Minimum size">
            <option value="0">All sizes</option><option value="50">50+</option><option value="100">100+</option><option value="500">500+</option><option value="1000">1000+</option>
          </FilterSelect>
          <FilterSelect value={scaleMode} onChange={(value) => setScaleMode(value as ScaleMode)} label="Bar scale">
            <option value="LINEAR">Linear scale</option><option value="SQRT">Square-root scale</option><option value="LOG">Log scale</option>
          </FilterSelect>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-px bg-border xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="flex min-h-0 flex-col bg-background">
          <div className="relative min-h-0 flex-1">
            {!visibleLevels.length ? (
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <div>
                  <Radio className="mx-auto h-5 w-5 animate-pulse text-primary" />
                  <div className="mt-3 text-[8px] font-semibold">No classified prints match these filters</div>
                  <div className="mt-1 text-[6px] text-muted">Widen the window or reduce the confidence and size filters.</div>
                </div>
              </div>
            ) : (
              <svg
                className="h-full min-h-[410px] w-full"
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Classified bought and sold call and put volume by mapped NQ strike"
              >
                <defs>
                  <pattern id="classified-call-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="3" height="6" fill={CALL_COLOR} fillOpacity="0.72" />
                  </pattern>
                  <pattern id="classified-put-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="3" height="6" fill={PUT_COLOR} fillOpacity="0.72" />
                  </pattern>
                  <filter id="classified-spot-glow" x="-20%" y="-250%" width="140%" height="600%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="var(--background)" />
                <text x="255" y="21" textAnchor="middle" fill="var(--muted)" fontSize="7" fontWeight="600">SHORT / CLASSIFIED SOLD</text>
                <text x="655" y="21" textAnchor="middle" fill="var(--muted)" fontSize="7" fontWeight="600">LONG / CLASSIFIED BOUGHT</text>
                <text x="968" y="21" textAnchor="middle" fill="var(--muted)" fontSize="7" fontWeight="600">DOMINANT FLOW</text>
                <line x1={ZERO_X} x2={ZERO_X} y1={PLOT_TOP - 8} y2={PLOT_BOTTOM + 4} stroke="var(--border)" />
                <line x1={SUMMARY_X - 14} x2={SUMMARY_X - 14} y1={PLOT_TOP - 8} y2={PLOT_BOTTOM + 4} stroke="var(--border)" />

                {visibleLevels.map((level) => {
                  const y = yForPrice(level.price);
                  const nearAtm = Math.abs(level.price - referencePrice) <= bucketSize;
                  const dominance = dominantFor(level);
                  const directionalPositive = level.longCall.total + level.shortPut.total;
                  const directionalNegative = level.shortCall.total + level.longPut.total;
                  const gammaLong = level.longCall.total + level.longPut.total;
                  const gammaShort = level.shortCall.total + level.shortPut.total;
                  return (
                    <g key={level.price}>
                      {nearAtm ? <rect x="36" y={y - 10} width="1_028" height="20" rx="5" fill="var(--primary)" fillOpacity="0.035" /> : null}
                      <line x1="42" x2="1_064" y1={y + 10} y2={y + 10} stroke="var(--border)" strokeOpacity={nearAtm ? 0.48 : 0.22} />

                      {displayMode === "GROSS" ? (
                        <>
                          <ConfidenceBar volume={level.shortCall} maximum={maximum} scaleMode={scaleMode} direction="LEFT" y={y - 7} color={CALL_COLOR} patternId="classified-call-stripe" />
                          <ConfidenceBar volume={level.shortPut} maximum={maximum} scaleMode={scaleMode} direction="LEFT" y={y + 1} color={PUT_COLOR} patternId="classified-put-stripe" />
                          <ConfidenceBar volume={level.longCall} maximum={maximum} scaleMode={scaleMode} direction="RIGHT" y={y - 7} color={CALL_COLOR} patternId="classified-call-stripe" />
                          <ConfidenceBar volume={level.longPut} maximum={maximum} scaleMode={scaleMode} direction="RIGHT" y={y + 1} color={PUT_COLOR} patternId="classified-put-stripe" />
                        </>
                      ) : displayMode === "DIRECTION" ? (
                        <>
                          <rect x={ZERO_X - barWidth(directionalNegative)} y={y - 5} width={barWidth(directionalNegative)} height="10" rx="2" fill={PUT_COLOR} fillOpacity="0.8" />
                          <rect x={ZERO_X} y={y - 5} width={barWidth(directionalPositive)} height="10" rx="2" fill={CALL_COLOR} fillOpacity="0.8" />
                        </>
                      ) : (
                        <>
                          <rect x={ZERO_X - barWidth(gammaShort)} y={y - 5} width={barWidth(gammaShort)} height="10" rx="2" fill="var(--warning)" fillOpacity="0.76" />
                          <rect x={ZERO_X} y={y - 5} width={barWidth(gammaLong)} height="10" rx="2" fill="var(--primary)" fillOpacity="0.84" />
                        </>
                      )}

                      <rect x={ZERO_X - 38} y={y - 8} width="76" height="16" rx="4" fill="var(--background)" stroke={nearAtm ? "var(--primary)" : "var(--border)"} strokeOpacity={nearAtm ? 0.8 : 0.65} />
                      <text x={ZERO_X} y={y + 3} textAnchor="middle" fill={nearAtm ? "var(--primary)" : "var(--foreground)"} fontSize="6.8" fontFamily="monospace" fontWeight={nearAtm ? 700 : 500}>
                        {formatPrice(level.price)}{nearAtm ? " ATM" : ""}
                      </text>
                      {displayMode === "GROSS" ? (
                        <>
                          <text x="44" y={y - 2} fill={CALL_COLOR} fontSize="5.5">SC {compact(level.shortCall.total)}</text>
                          <text x="44" y={y + 7} fill={PUT_COLOR} fontSize="5.5">SP {compact(level.shortPut.total)}</text>
                          <text x="828" y={y - 2} textAnchor="end" fill={CALL_COLOR} fontSize="5.5">{compact(level.longCall.total)} LC</text>
                          <text x="828" y={y + 7} textAnchor="end" fill={PUT_COLOR} fontSize="5.5">{compact(level.longPut.total)} LP</text>
                        </>
                      ) : null}
                      {level.uncertainCall + level.uncertainPut > 0 ? (
                        <g>
                          <rect x={ZERO_X - 23} y={y + 9} width="46" height="9" rx="3" fill="var(--background)" stroke="var(--foreground)" strokeOpacity="0.35" />
                          <text x={ZERO_X} y={y + 16} textAnchor="middle" fill="var(--muted)" fontSize="4.8">U {compact(level.uncertainCall + level.uncertainPut)}</text>
                        </g>
                      ) : null}
                      {level.largePrints > 0 ? (
                        <g>
                          <path d={`M 836 ${y - 5} l 4 4 l -4 4 l -4 -4 z`} fill="var(--primary)" />
                          <text x="845" y={y + 2} fill="var(--primary)" fontSize="5.2">{level.largePrints} LARGE</text>
                        </g>
                      ) : null}
                      <text x="862" y={y - 2} fill={dominance.category.includes("CALL") ? CALL_COLOR : PUT_COLOR} fontSize="6.2" fontWeight="700">
                        {categoryShortLabel(dominance.category)} {dominance.share >= 0.6 ? "DOMINANT" : "MIXED"}
                      </text>
                      <text x="862" y={y + 6} fill="var(--muted)" fontSize="5.2">{categoryContext(dominance.category)}</text>
                      <title>{[
                        `NQ ${formatPrice(level.price)}`,
                        `Long calls ${compact(level.longCall.total)}`,
                        `Short calls ${compact(level.shortCall.total)}`,
                        `Long puts ${compact(level.longPut.total)}`,
                        `Short puts ${compact(level.shortPut.total)}`,
                        `Uncertain / midpoint ${compact(level.uncertainCall + level.uncertainPut)}`,
                        `Gross classified ${compact(dominance.gross)}`,
                        `Dominant ${categoryLabel(dominance.category)} ${(dominance.share * 100).toFixed(0)}%`,
                        `Prints ${level.prints}`,
                        `Premium ${compactMoney(level.premium)}`,
                        "Opening or closing status unknown",
                      ].join(" | ")}</title>
                    </g>
                  );
                })}

                <g className={!replaying && payload.marketOpen ? "gexdesk-live-price" : ""} filter="url(#classified-spot-glow)">
                  <line x1="34" x2="1_070" y1={yForPrice(referencePrice)} y2={yForPrice(referencePrice)} stroke="var(--foreground)" strokeWidth="1.15" strokeDasharray="4 4" />
                  <rect x="400" y={yForPrice(referencePrice) - 10} width="140" height="20" rx="6" fill="var(--foreground)" />
                  <text x="470" y={yForPrice(referencePrice) + 3} textAnchor="middle" fill="var(--background)" fontSize="7" fontFamily="monospace" fontWeight="700">
                    NQ {formatPrice(referencePrice, 2)}
                  </text>
                </g>
              </svg>
            )}
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
                aria-label="Classified volume playback time"
              />
              <span className="font-mono text-[6px] text-muted">{timeLabel(selectedTime, true)} ET</span>
              <button type="button" onClick={goLatest} className={`h-7 rounded-lg border px-2.5 text-[7px] font-semibold ${
                replaying ? "border-primary/25 bg-primary/[0.07] text-primary" : "border-border bg-surface text-muted"
              }`}>
                LATEST
              </button>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-px bg-border">
          <section className="bg-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Options flow state</div>
                <div className="mt-1 text-[8px] font-semibold">CLASSIFIED CONTRACTS</div>
              </div>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FlowMetric label="Long calls" value={totals.longCall} color={CALL_COLOR} solid />
              <FlowMetric label="Short calls" value={totals.shortCall} color={CALL_COLOR} />
              <FlowMetric label="Long puts" value={totals.longPut} color={PUT_COLOR} solid />
              <FlowMetric label="Short puts" value={totals.shortPut} color={PUT_COLOR} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <BiasMetric label="Net direction" value={netDirection} positiveLabel="bullish" negativeLabel="bearish" />
              <BiasMetric label="Net option ownership" value={netConvexity} positiveLabel="long gamma" negativeLabel="short gamma" />
            </div>
          </section>

          <section className="bg-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Classification quality</div>
                <div className="mt-1 text-[8px] font-semibold">CONFIDENCE MIX</div>
              </div>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
              <div className="flex h-full">
                <span className="bg-primary" style={{ width: `${qualityTotal ? totals.high / qualityTotal * 100 : 0}%` }} />
                <span className="bg-warning" style={{ width: `${qualityTotal ? totals.medium / qualityTotal * 100 : 0}%` }} />
                <span className="bg-muted" style={{ width: `${qualityTotal ? totals.low / qualityTotal * 100 : 0}%` }} />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <QualityMetric label="High" value={qualityTotal ? totals.high / qualityTotal : 0} tone="primary" />
              <QualityMetric label="Medium" value={qualityTotal ? totals.medium / qualityTotal : 0} tone="warning" />
              <QualityMetric label="Uncertain" value={(qualityTotal + totals.uncertain) ? (totals.low + totals.uncertain) / (qualityTotal + totals.uncertain) : 0} tone="muted" />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[6px] text-muted">
              <span>{totals.prints} prints</span>
              <span>{compactMoney(totals.premium)} premium</span>
              <span>{compact(totals.uncertain)} midpoint</span>
            </div>
          </section>

          <section className="min-h-0 flex-1 bg-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Window evolution</div>
                <div className="mt-1 text-[8px] font-semibold">SESSION TIMELINE</div>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <svg className="mt-2 h-[142px] w-full" viewBox="0 0 304 146" role="img" aria-label="Classified options flow by category through the session">
              <rect width="304" height="146" rx="12" fill="var(--surface)" />
              {[0, 1, 2].map((index) => <line key={index} x1="20" x2="284" y1={24 + index * 50} y2={24 + index * 50} stroke="var(--border)" strokeOpacity="0.46" />)}
              {timeline.length ? (
                <>
                  <polyline points={timelinePoints("longCall")} fill="none" stroke={CALL_COLOR} strokeWidth="2" />
                  <polyline points={timelinePoints("shortCall")} fill="none" stroke={CALL_COLOR} strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.58" />
                  <polyline points={timelinePoints("longPut")} fill="none" stroke={PUT_COLOR} strokeWidth="2" />
                  <polyline points={timelinePoints("shortPut")} fill="none" stroke={PUT_COLOR} strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.58" />
                </>
              ) : null}
            </svg>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[5px] text-muted">
              <LegendSwatch color={CALL_COLOR} label="Long call" />
              <LegendSwatch color={CALL_COLOR} label="Short call" dashed />
              <LegendSwatch color={PUT_COLOR} label="Long put" />
              <LegendSwatch color={PUT_COLOR} label="Short put" dashed />
            </div>
          </section>

          <section className="bg-panel p-3">
            <div className="flex gap-2 rounded-xl border border-warning/20 bg-warning/[0.035] p-2.5">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <div>
                <div className="text-[6px] font-semibold text-foreground">CLASSIFIED VOLUME IS ESTIMATED</div>
                <div className="mt-1 text-[5.5px] leading-3 text-muted">
                  Aggressor side is inferred. Opening/closing status, ultimate counterparty and multi-leg intent are not confirmed. Medium-confidence volume can include likely complex activity.
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-panel px-3 py-2 text-[6px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full" style={{ background: CALL_COLOR }} /><strong className="text-foreground">GREEN</strong> = call</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full" style={{ background: PUT_COLOR }} /><strong className="text-foreground">RED</strong> = put</span>
        <span><strong className="text-foreground">RIGHT</strong> = classified bought</span>
        <span><strong className="text-foreground">LEFT</strong> = classified sold</span>
        <span><strong className="text-foreground">SOLID / HATCHED / OUTLINE</strong> = high / medium / low confidence</span>
        <span className="ml-auto">Scale: {scaleMode.toLowerCase()} | Contract size is counted per print, not cumulative daily volume</span>
        <span className="w-full">Estimated customer-side flow by default. “Estimated dealer opposite” reverses the inferred side and must not be read as confirmed dealer inventory.</span>
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

function FlowMetric({
  label,
  value,
  color,
  solid = false,
}: {
  label: string;
  value: number;
  color: string;
  solid?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[5px] uppercase tracking-[0.08em] text-muted">
        <span
          className={`h-1.5 w-4 rounded-full ${solid ? "" : "opacity-45"}`}
          style={{ backgroundColor: color }}
        />
        {label}
      </div>
      <div className="mt-1 font-mono text-[8px] font-semibold" style={{ color }}>{compact(value)}</div>
    </div>
  );
}

function BiasMetric({
  label,
  value,
  positiveLabel,
  negativeLabel,
}: {
  label: string;
  value: number;
  positiveLabel: string;
  negativeLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2.5 py-2">
      <div className="text-[5px] uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[8px] font-semibold ${value >= 0 ? "text-primary" : "text-danger"}`}>{compactSigned(value)}</div>
      <div className="mt-0.5 text-[5px] text-muted">{value >= 0 ? positiveLabel : negativeLabel}</div>
    </div>
  );
}

function QualityMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "warning" | "muted";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2 py-1.5">
      <div className="text-[5px] text-muted">{label}</div>
      <div className={`mt-0.5 font-mono text-[7px] font-semibold ${
        tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : "text-muted"
      }`}>{(value * 100).toFixed(0)}%</div>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-px w-5"
        style={{
          backgroundImage: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : undefined,
          backgroundColor: dashed ? undefined : color,
          opacity: dashed ? 0.65 : 1,
        }}
      />
      {label}
    </span>
  );
}
