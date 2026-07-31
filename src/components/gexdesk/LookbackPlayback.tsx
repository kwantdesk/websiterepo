"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  CirclePause,
  CirclePlay,
  Clock3,
  FastForward,
  History,
  Radio,
  Rewind,
  Route,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import type {
  GexDeskHistoryPayload,
  GexDeskHistoryRow,
  GexDeskPayload,
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";

type SourceFilter = "COMBINED" | GexDeskSourceSymbol;
type ExposureMode = "NET" | "CALL" | "PUT";
type LookbackMinute = 1 | 5 | 10 | 15 | 30;
type Mover = {
  price: number;
  value: number;
  change: number;
};
type MoverPair = {
  minutes: 0 | LookbackMinute;
  build: Mover | null;
  loss: Mover | null;
};
type TrailPoint = {
  timestamp: number;
  spot: number;
  positive: number | null;
  negative: number | null;
};

const LOOKBACKS: readonly LookbackMinute[] = [1, 5, 10, 15, 30];
const DOTS: readonly { minutes: LookbackMinute; radius: number; opacity: number }[] = [
  { minutes: 30, radius: 3.2, opacity: 0.35 },
  { minutes: 15, radius: 3.4, opacity: 0.55 },
  { minutes: 10, radius: 3.6, opacity: 0.7 },
  { minutes: 5, radius: 4, opacity: 0.85 },
  { minutes: 1, radius: 4.3, opacity: 1 },
];
const SVG_WIDTH = 1_050;
const SVG_HEIGHT = 520;
const PLOT_TOP = 42;
const PLOT_BOTTOM = 494;
const ZERO_X = 525;
const SIDE_WIDTH = 405;

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function valueAt(row: GexDeskHistoryRow, index: number, mode: ExposureMode) {
  const net = Number(row.net?.[index] ?? 0);
  const call = Number(row.call?.[index]);
  const put = Number(row.put?.[index]);
  if (mode === "CALL") return Number.isFinite(call) ? call : Math.max(0, net);
  if (mode === "PUT") return Number.isFinite(put) ? put : Math.min(0, net);
  if (Number.isFinite(net)) return net;
  return (Number.isFinite(call) ? call : 0) + (Number.isFinite(put) ? put : 0);
}

function indexAtOrBefore(timestamps: number[], target: number, ceiling: number) {
  let result = 0;
  for (let index = 0; index <= ceiling; index += 1) {
    if ((timestamps[index] ?? Infinity) <= target) result = index;
    else break;
  }
  return result;
}

function indexForLookback(
  history: GexDeskHistoryPayload,
  selectedIndex: number,
  minutes: LookbackMinute,
) {
  const selectedTimestamp = history.timestamps[selectedIndex] ?? history.timestamps.at(-1) ?? 0;
  return indexAtOrBefore(
    history.timestamps,
    selectedTimestamp - minutes * 60_000,
    selectedIndex,
  );
}

function formatPrice(value: number | null, digits = 0) {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function compactSigned(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  const absolute = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
}

function timestampLabel(timestamp: number | undefined, seconds = true) {
  if (!timestamp) return "--:--";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hour12: false,
  }).format(new Date(timestamp));
}

function percentageChange(current: number, previous: number, scale: number) {
  const denominator = Math.max(Math.abs(previous), scale * 0.015, 1);
  return (Math.abs(current) - Math.abs(previous)) / denominator * 100;
}

function stateLabel(current: number, previous: number, scale: number) {
  const change = percentageChange(current, previous, scale);
  const smallNow = Math.abs(current) < scale * 0.24;
  if (change > 35 && smallNow) return current >= 0 ? "NEW +GEX" : "NEW -GEX";
  if (change > 8) return current >= 0 ? "+GEX BUILDING" : "-GEX EXPANDED";
  if (change < -8) return current >= 0 ? "+GEX WEAKENING" : "-GEX CONTRACTED";
  return current >= 0 ? "STRUCTURAL +GEX" : "STRUCTURAL -GEX";
}

function majorAt(
  history: GexDeskHistoryPayload,
  index: number,
  mode: ExposureMode,
  positive: boolean,
) {
  const candidates = history.rows
    .map((row) => ({ price: row.price, value: valueAt(row, index, mode) }))
    .filter((row) => positive ? row.value > 0 : row.value < 0);
  if (!candidates.length) return null;
  return candidates.reduce((best, candidate) => (
    positive
      ? candidate.value > best.value ? candidate : best
      : candidate.value < best.value ? candidate : best
  ));
}

function moversAt(
  history: GexDeskHistoryPayload,
  selectedIndex: number,
  mode: ExposureMode,
  minutes: 0 | LookbackMinute,
): MoverPair {
  if (minutes === 0) {
    const positive = majorAt(history, selectedIndex, mode, true);
    const negative = majorAt(history, selectedIndex, mode, false);
    return {
      minutes,
      build: positive ? { ...positive, change: positive.value } : null,
      loss: negative ? { ...negative, change: negative.value } : null,
    };
  }
  const priorIndex = indexForLookback(history, selectedIndex, minutes);
  const rows = history.rows.map((row): Mover => {
    const value = valueAt(row, selectedIndex, mode);
    return {
      price: row.price,
      value,
      change: value - valueAt(row, priorIndex, mode),
    };
  });
  if (!rows.length) return { minutes, build: null, loss: null };
  return {
    minutes,
    build: rows.reduce((best, row) => row.change > best.change ? row : best),
    loss: rows.reduce((best, row) => row.change < best.change ? row : best),
  };
}

function trailFor(history: GexDeskHistoryPayload, mode: ExposureMode): TrailPoint[] {
  return history.timestamps.map((timestamp, index) => ({
    timestamp,
    spot: history.nqPrices[index] ?? 0,
    positive: majorAt(history, index, mode, true)?.price ?? null,
    negative: majorAt(history, index, mode, false)?.price ?? null,
  }));
}

function lastMigrationIndex(
  trail: TrailPoint[],
  selectedIndex: number,
  key: "positive" | "negative",
) {
  for (let index = selectedIndex; index > 0; index -= 1) {
    if (trail[index]?.[key] !== trail[index - 1]?.[key]) return index;
  }
  return 0;
}

function largestSessionChangeIndex(
  history: GexDeskHistoryPayload,
  selectedIndex: number,
  mode: ExposureMode,
  positive: boolean,
) {
  let result = 0;
  let resultValue = positive ? -Infinity : Infinity;
  for (let index = 1; index <= selectedIndex; index += 1) {
    const priorIndex = indexAtOrBefore(
      history.timestamps,
      (history.timestamps[index] ?? 0) - 5 * 60_000,
      index,
    );
    for (const row of history.rows) {
      const change = valueAt(row, index, mode) - valueAt(row, priorIndex, mode);
      if ((positive && change > resultValue) || (!positive && change < resultValue)) {
        result = index;
        resultValue = change;
      }
    }
  }
  return result;
}

export default function LookbackPlayback({
  payload,
  history,
  historyLoading,
  historyError,
  livePrice,
  sourceFilter,
  onSourceFilterChange,
}: {
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  historyLoading: boolean;
  historyError: string;
  livePrice: number | null;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (source: SourceFilter) => void;
}) {
  const [mode, setMode] = useState<ExposureMode>("NET");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const followsLatest = useRef(true);
  const previousLength = useRef(0);
  const latestIndex = Math.max(0, (history?.timestamps.length ?? 1) - 1);

  useEffect(() => {
    const previousLatest = Math.max(0, previousLength.current - 1);
    if (followsLatest.current || selectedIndex >= previousLatest) {
      setSelectedIndex(latestIndex);
    }
    previousLength.current = history?.timestamps.length ?? 0;
  }, [history?.timestamps.length, latestIndex, selectedIndex]);

  useEffect(() => {
    if (!playing || !history?.timestamps.length) return;
    const timer = window.setInterval(() => {
      setSelectedIndex((current) => {
        if (current >= latestIndex) {
          followsLatest.current = true;
          setPlaying(false);
          return latestIndex;
        }
        followsLatest.current = false;
        return current + 1;
      });
    }, Math.max(80, 520 / speed));
    return () => window.clearInterval(timer);
  }, [history?.timestamps.length, latestIndex, playing, speed]);

  const playback = Boolean(history?.timestamps.length && selectedIndex < latestIndex);
  const selectedTimestamp = history?.timestamps[selectedIndex];
  const referencePrice = playback
    ? history?.nqPrices[selectedIndex] ?? payload.nqPrice ?? 0
    : livePrice ?? payload.nqPrice ?? history?.nqPrices.at(-1) ?? 0;

  const lookbackIndices = useMemo(() => {
    if (!history) return new Map<LookbackMinute, number>();
    return new Map(LOOKBACKS.map((minutes) => [
      minutes,
      indexForLookback(history, selectedIndex, minutes),
    ]));
  }, [history, selectedIndex]);

  const visibleRows = useMemo(() => {
    if (!history?.rows.length) return [];
    const ordered = [...history.rows].sort((left, right) => left.price - right.price);
    if (ordered.length <= 37) return ordered.reverse();
    const nearestIndex = ordered.reduce((nearest, row, index) => (
      Math.abs(row.price - referencePrice) < Math.abs(ordered[nearest].price - referencePrice)
        ? index
        : nearest
    ), 0);
    const start = clamp(nearestIndex - 18, 0, ordered.length - 37);
    return ordered.slice(start, start + 37).reverse();
  }, [history, referencePrice]);

  const scale = useMemo(() => {
    if (!history) return 1;
    return Math.max(
      1,
      ...visibleRows.flatMap((row) => [
        Math.abs(valueAt(row, selectedIndex, mode)),
        ...DOTS.map((dot) => Math.abs(valueAt(
          row,
          lookbackIndices.get(dot.minutes) ?? selectedIndex,
          mode,
        ))),
      ]),
    );
  }, [history, lookbackIndices, mode, selectedIndex, visibleRows]);

  const movers = useMemo(() => {
    if (!history) return [];
    return ([0, ...LOOKBACKS] as const).map((minutes) => (
      moversAt(history, selectedIndex, mode, minutes)
    ));
  }, [history, mode, selectedIndex]);
  const fiveMinuteMover = movers.find((mover) => mover.minutes === 5);
  const fifteenMinuteMover = movers.find((mover) => mover.minutes === 15);

  const trail = useMemo(
    () => history ? trailFor(history, mode) : [],
    [history, mode],
  );
  const eventIndices = useMemo(() => {
    if (!history) return null;
    return {
      positiveMigration: lastMigrationIndex(trail, selectedIndex, "positive"),
      negativeMigration: lastMigrationIndex(trail, selectedIndex, "negative"),
      build: largestSessionChangeIndex(history, selectedIndex, mode, true),
      loss: largestSessionChangeIndex(history, selectedIndex, mode, false),
    };
  }, [history, mode, selectedIndex, trail]);

  const currentPositive = trail[selectedIndex]?.positive ?? null;
  const currentNegative = trail[selectedIndex]?.negative ?? null;
  const thirtyIndex = lookbackIndices.get(30) ?? selectedIndex;
  const priorPositive = trail[thirtyIndex]?.positive ?? null;
  const priorNegative = trail[thirtyIndex]?.negative ?? null;
  const positiveMigration = currentPositive !== null && priorPositive !== null
    ? currentPositive - priorPositive
    : null;
  const negativeMigration = currentNegative !== null && priorNegative !== null
    ? currentNegative - priorNegative
    : null;
  const strongestBuild = fifteenMinuteMover?.build ?? null;
  const strongestLoss = fifteenMinuteMover?.loss ?? null;

  const lowest = visibleRows.at(-1)?.price ?? referencePrice - 1;
  const highest = visibleRows[0]?.price ?? referencePrice + 1;
  const yForPrice = (price: number) => PLOT_TOP
    + (highest - price) / Math.max(1, highest - lowest) * (PLOT_BOTTOM - PLOT_TOP);
  const rowHeight = Math.max(
    5,
    Math.min(13, (PLOT_BOTTOM - PLOT_TOP) / Math.max(1, visibleRows.length)),
  );
  const xForValue = (value: number) => ZERO_X
    + clamp(value / scale, -1, 1) * SIDE_WIDTH;

  const trailPrices = trail
    .slice(0, selectedIndex + 1)
    .flatMap((point) => [
      ...(point.positive === null ? [] : [point.positive]),
      ...(point.negative === null ? [] : [point.negative]),
    ]);
  const trailLow = trailPrices.length ? Math.min(...trailPrices) : referencePrice - 1;
  const trailHigh = trailPrices.length ? Math.max(...trailPrices) : referencePrice + 1;
  const trailX = (index: number) => 22 + index / Math.max(1, selectedIndex) * 260;
  const trailY = (price: number) => 20
    + (trailHigh - price) / Math.max(1, trailHigh - trailLow) * 120;
  const positiveTrail = trail
    .slice(0, selectedIndex + 1)
    .flatMap((point, index) => point.positive === null
      ? []
      : [`${trailX(index)},${trailY(point.positive)}`])
    .join(" ");
  const negativeTrail = trail
    .slice(0, selectedIndex + 1)
    .flatMap((point, index) => point.negative === null
      ? []
      : [`${trailX(index)},${trailY(point.negative)}`])
    .join(" ");

  const selectFrame = (index: number) => {
    const next = clamp(index, 0, latestIndex);
    setSelectedIndex(next);
    followsLatest.current = next === latestIndex;
    setPlaying(false);
  };
  const goLive = () => {
    setSelectedIndex(latestIndex);
    followsLatest.current = true;
    setPlaying(false);
  };

  if (!history?.timestamps.length || !history.rows.length) {
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden bg-background">
        <div className="absolute h-56 w-56 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="relative text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.07] text-primary shadow-[0_0_42px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
            {historyLoading ? <Radio className="h-4 w-4 animate-pulse" /> : <History className="h-4 w-4" />}
          </span>
          <div className="mt-4 text-[9px] font-semibold">
            {historyLoading ? "Loading gamma history" : "Historical gamma frames are unavailable"}
          </div>
          <div className="mx-auto mt-2 max-w-sm text-[7px] leading-4 text-muted">
            {historyError || "The lookback view requires intraday gamma snapshots before it can draw real historical endpoints."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary">
          <History className="h-3.5 w-3.5" />
        </span>
        <div className="mr-1">
          <div className="text-[9px] font-semibold">Lookback & Playback</div>
          <div className="text-[6px] uppercase tracking-[0.12em] text-muted">Location + change + rate of change</div>
        </div>
        <KwantSelect
          value={sourceFilter}
          onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)}
          menuLabel="Options source"
          className="h-8 min-w-32 rounded-xl border border-border bg-surface px-2.5 text-[8px]"
        >
          <option value="COMBINED">NDX + QQQ</option>
          <option value="NDX">NDX</option>
          <option value="QQQ">QQQ</option>
        </KwantSelect>
        <div className="flex items-center rounded-xl border border-border bg-surface p-0.5">
          {(["NET", "CALL", "PUT"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`h-7 rounded-[9px] px-2.5 text-[7px] font-semibold transition ${
                mode === option ? "bg-primary/[0.11] text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[7px] font-semibold ${
            playback
              ? "border-warning/25 bg-warning/[0.06] text-warning"
              : payload.marketOpen
                ? "border-primary/25 bg-primary/[0.06] text-primary"
                : "border-border bg-surface text-muted"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              playback ? "bg-warning" : payload.marketOpen ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted"
            }`} />
            {playback ? "PLAYBACK" : payload.marketOpen ? "LIVE" : "EOD"}
          </span>
          <span className="hidden h-8 items-center rounded-xl border border-border bg-surface px-2.5 font-mono text-[7px] text-muted sm:flex">
            {timestampLabel(selectedTimestamp)} ET
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-px bg-border xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="flex min-h-0 flex-col bg-background">
          <div className="relative min-h-0 flex-1">
            <svg
              className="h-full min-h-[390px] w-full"
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Historical gamma endpoints and current signed exposure by mapped NQ strike"
            >
              <defs>
                <linearGradient id="lookback-positive" x1="0" x2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="lookback-negative" x1="1" x2="0">
                  <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.3" />
                </linearGradient>
                <filter id="lookback-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="var(--background)" />
              <text x="275" y="22" textAnchor="middle" fill="var(--muted)" fontSize="8" fontWeight="600">NEGATIVE GEX / LEFT</text>
              <text x="775" y="22" textAnchor="middle" fill="var(--muted)" fontSize="8" fontWeight="600">POSITIVE GEX / RIGHT</text>
              <line x1={ZERO_X} x2={ZERO_X} y1={PLOT_TOP - 8} y2={PLOT_BOTTOM + 5} stroke="var(--border)" />

              {visibleRows.map((row) => {
                const y = yForPrice(row.price);
                const current = valueAt(row, selectedIndex, mode);
                const currentX = xForValue(current);
                const thirtyValue = valueAt(row, lookbackIndices.get(30) ?? selectedIndex, mode);
                const status = stateLabel(current, thirtyValue, scale);
                const change30 = percentageChange(current, thirtyValue, scale);
                const isFiveBuild = fiveMinuteMover?.build?.price === row.price;
                const isFifteenLoss = fifteenMinuteMover?.loss?.price === row.price;
                const barX = Math.min(ZERO_X, currentX);
                const barWidth = Math.abs(currentX - ZERO_X);
                return (
                  <g key={row.price}>
                    <line x1="74" x2="976" y1={y + rowHeight / 2} y2={y + rowHeight / 2} stroke="var(--border)" strokeOpacity="0.24" />
                    {barWidth > 0.5 ? (
                      <rect
                        x={barX}
                        y={y - rowHeight * 0.34}
                        width={barWidth}
                        height={Math.max(3.2, rowHeight * 0.68)}
                        rx="2"
                        fill={current >= 0 ? "url(#lookback-positive)" : "url(#lookback-negative)"}
                      />
                    ) : null}
                    {DOTS.map((dot) => {
                      const historicalIndex = lookbackIndices.get(dot.minutes) ?? selectedIndex;
                      const historical = valueAt(row, historicalIndex, mode);
                      return (
                        <circle
                          key={dot.minutes}
                          cx={xForValue(historical)}
                          cy={y}
                          r={dot.radius}
                          fill="var(--foreground)"
                          fillOpacity={dot.opacity}
                          stroke="var(--background)"
                          strokeWidth="1.1"
                        />
                      );
                    })}
                    <rect x={ZERO_X - 40} y={y - 7} width="80" height="14" rx="4" fill="var(--background)" stroke="var(--border)" strokeOpacity="0.72" />
                    <text x={ZERO_X} y={y + 3} textAnchor="middle" fill="var(--foreground)" fontSize="7" fontFamily="monospace">{formatPrice(row.price)}</text>
                    {isFiveBuild ? (
                      <g filter="url(#lookback-glow)">
                        <rect x="866" y={y - 8} width="110" height="16" rx="5" fill="var(--primary)" fillOpacity="0.13" stroke="var(--primary)" strokeOpacity="0.65" />
                        <text x="921" y={y + 3} textAnchor="middle" fill="var(--primary)" fontSize="6" fontWeight="700">UP 5M MAX BUILD</text>
                      </g>
                    ) : null}
                    {isFifteenLoss ? (
                      <g filter="url(#lookback-glow)">
                        <rect x="74" y={y - 8} width="112" height="16" rx="5" fill="var(--danger)" fillOpacity="0.13" stroke="var(--danger)" strokeOpacity="0.65" />
                        <text x="130" y={y + 3} textAnchor="middle" fill="var(--danger)" fontSize="6" fontWeight="700">DOWN 15M MAX LOSS</text>
                      </g>
                    ) : null}
                    <title>{[
                      `NQ ${formatPrice(row.price)}`,
                      `Current ${compactSigned(current)}`,
                      ...DOTS.slice().reverse().map((dot) => (
                        `${dot.minutes}m ${compactSigned(valueAt(row, lookbackIndices.get(dot.minutes) ?? selectedIndex, mode))}`
                      )),
                      `${status} (${change30 > 0 ? "+" : ""}${change30.toFixed(1)}% by magnitude over 30m)`,
                    ].join(" | ")}</title>
                  </g>
                );
              })}

              <g className={!playback && payload.marketOpen ? "gexdesk-live-price" : ""}>
                <line
                  x1="62"
                  x2="988"
                  y1={yForPrice(referencePrice)}
                  y2={yForPrice(referencePrice)}
                  stroke="var(--foreground)"
                  strokeWidth="1.1"
                  strokeDasharray="4 4"
                />
                <rect x="449" y={yForPrice(referencePrice) - 10} width="152" height="20" rx="6" fill="var(--foreground)" />
                <text x="525" y={yForPrice(referencePrice) + 3} textAnchor="middle" fill="var(--background)" fontSize="7" fontFamily="monospace" fontWeight="700">
                  NQ {formatPrice(referencePrice, 2)} {playback ? "REPLAY" : "CURRENT"}
                </text>
              </g>
            </svg>

            <div className="pointer-events-none absolute bottom-2 left-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/80 px-2.5 py-1.5 text-[6px] text-muted backdrop-blur-md">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-full bg-primary" />current bar</span>
              {DOTS.map((dot) => (
                <span key={dot.minutes} className="flex items-center gap-1">
                  <span className="rounded-full bg-foreground" style={{ width: dot.radius * 1.6, height: dot.radius * 1.6, opacity: dot.opacity }} />
                  {dot.minutes}m
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-panel px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => selectFrame(selectedIndex - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:text-foreground"
                title="Previous historical frame"
              >
                <SkipBack className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setPlaying((current) => !current)}
                className="flex h-7 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/[0.07] px-2.5 text-[7px] font-semibold text-primary"
              >
                {playing ? <CirclePause className="h-3 w-3" /> : <CirclePlay className="h-3 w-3" />}
                {playing ? "PAUSE" : "PLAY"}
              </button>
              <button
                type="button"
                onClick={() => selectFrame(selectedIndex + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:text-foreground"
                title="Next historical frame"
              >
                <SkipForward className="h-3 w-3" />
              </button>
              <input
                type="range"
                min={0}
                max={latestIndex}
                value={selectedIndex}
                onChange={(event) => selectFrame(Number(event.target.value))}
                className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--primary)]"
                aria-label="Historical gamma playback time"
              />
              <KwantSelect
                value={String(speed)}
                onChange={(event) => setSpeed(Number(event.target.value))}
                menuLabel="Playback speed"
                className="h-7 min-w-16 rounded-lg border border-border bg-surface px-2 text-[7px]"
              >
                {[0.5, 1, 2, 5, 10].map((value) => <option key={value} value={value}>{value}x</option>)}
              </KwantSelect>
              <button
                type="button"
                onClick={goLive}
                className={`h-7 rounded-lg border px-2.5 text-[7px] font-semibold transition ${
                  playback
                    ? "border-primary/25 bg-primary/[0.07] text-primary"
                    : "border-border bg-surface text-muted"
                }`}
              >
                LATEST
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[6px] text-muted">
              <span>{timestampLabel(history.timestamps[0])} ET</span>
              <span className={playback ? "text-warning" : "text-primary"}>{timestampLabel(selectedTimestamp)} ET</span>
              <span>{timestampLabel(history.timestamps.at(-1))} ET</span>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-px bg-border">
          <section className="bg-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Gamma change state</div>
                <div className="mt-1 text-[8px] font-semibold">ACTIVE STRUCTURE</div>
              </div>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SummaryMetric label="Strongest build / 15m" price={strongestBuild?.price ?? null} value={strongestBuild?.change ?? null} tone="primary" />
              <SummaryMetric label="Strongest loss / 15m" price={strongestLoss?.price ?? null} value={strongestLoss?.change ?? null} tone="danger" />
              <SummaryMetric label="Major +GEX move / 30m" price={currentPositive} value={positiveMigration} suffix=" pts" tone="primary" />
              <SummaryMetric label="Major -GEX move / 30m" price={currentNegative} value={negativeMigration} suffix=" pts" tone="danger" />
            </div>
          </section>

          <section className="bg-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Major-level migration</div>
                <div className="mt-1 text-[8px] font-semibold">SESSION TRAIL</div>
              </div>
              <Route className="h-4 w-4 text-primary" />
            </div>
            <svg className="mt-2 h-[155px] w-full" viewBox="0 0 304 160" role="img" aria-label="Positive and negative gamma major migration through the selected session">
              <rect width="304" height="160" rx="12" fill="var(--surface)" />
              {[0, 1, 2, 3].map((index) => (
                <line key={index} x1="20" x2="284" y1={20 + index * 40} y2={20 + index * 40} stroke="var(--border)" strokeOpacity="0.5" />
              ))}
              {positiveTrail ? <polyline points={positiveTrail} fill="none" stroke="var(--primary)" strokeWidth="2" /> : null}
              {negativeTrail ? <polyline points={negativeTrail} fill="none" stroke="var(--danger)" strokeWidth="2" /> : null}
              <text x="22" y="153" fill="var(--primary)" fontSize="6.5">+GEX MAJOR</text>
              <text x="282" y="153" textAnchor="end" fill="var(--danger)" fontSize="6.5">-GEX MAJOR</text>
            </svg>
          </section>

          <section className="min-h-0 flex-1 bg-panel p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Signed gamma change</div>
                <div className="mt-1 text-[8px] font-semibold">TOP MOVERS</div>
              </div>
              <FastForward className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[44px_1fr_1fr] gap-px bg-border text-[5px] uppercase tracking-[0.08em] text-muted">
                <span className="bg-surface px-2 py-1.5">Period</span>
                <span className="bg-surface px-2 py-1.5">Up change</span>
                <span className="bg-surface px-2 py-1.5">Down change</span>
              </div>
              {movers.map((mover) => (
                <div key={mover.minutes} className="grid grid-cols-[44px_1fr_1fr] gap-px border-t border-border bg-border">
                  <span className="bg-panel px-2 py-1.5 font-mono text-[6px] text-muted">{mover.minutes === 0 ? "NOW" : `${mover.minutes}m`}</span>
                  <MoverCell mover={mover.build} tone="primary" current={mover.minutes === 0} />
                  <MoverCell mover={mover.loss} tone="danger" current={mover.minutes === 0} />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-panel p-3">
            <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Jump to structural event</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <EventButton label="+ major moved" icon={<ArrowUp className="h-3 w-3" />} onClick={() => selectFrame(eventIndices?.positiveMigration ?? 0)} />
              <EventButton label="- major moved" icon={<ArrowDown className="h-3 w-3" />} onClick={() => selectFrame(eventIndices?.negativeMigration ?? 0)} />
              <EventButton label="Largest build" icon={<Rewind className="h-3 w-3" />} onClick={() => selectFrame(eventIndices?.build ?? 0)} />
              <EventButton label="Largest loss" icon={<Clock3 className="h-3 w-3" />} onClick={() => selectFrame(eventIndices?.loss ?? 0)} />
            </div>
          </section>
        </aside>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-panel px-3 py-2 text-[6px] text-muted">
        <span><strong className="text-foreground">BAR</strong> = exposure at selected frame</span>
        <span><strong className="text-foreground">DOT</strong> = exact earlier bar endpoint</span>
        <span><strong className="text-foreground">UP / DOWN CHANGE</strong> = signed change, not support or resistance</span>
        <span className="ml-auto">Front-expiry intraday gamma snapshots mapped to NQ</span>
        <span className="w-full">Historical change describes options positioning estimates. It does not guarantee a price reaction or identify who owns the position.</span>
        {historyError ? <span className="w-full text-warning">Historical feed: {historyError}</span> : null}
      </footer>
    </div>
  );
}

function SummaryMetric({
  label,
  price,
  value,
  suffix = "",
  tone,
}: {
  label: string;
  price: number | null;
  value: number | null;
  suffix?: string;
  tone: "primary" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2.5 py-2">
      <div className="text-[5px] uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[8px] font-semibold ${tone === "primary" ? "text-primary" : "text-danger"}`}>
        {formatPrice(price)}
      </div>
      <div className="mt-0.5 font-mono text-[6px] text-muted">
        {value === null ? "--" : suffix ? `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}` : compactSigned(value)}
      </div>
    </div>
  );
}

function MoverCell({
  mover,
  tone,
  current,
}: {
  mover: Mover | null;
  tone: "primary" | "danger";
  current: boolean;
}) {
  return (
    <span className="bg-panel px-2 py-1.5">
      <span className={`block font-mono text-[6px] font-semibold ${tone === "primary" ? "text-primary" : "text-danger"}`}>
        {formatPrice(mover?.price ?? null)}
      </span>
      <span className="mt-0.5 block font-mono text-[5px] text-muted">
        {compactSigned(current ? mover?.value ?? null : mover?.change ?? null)}
      </span>
    </span>
  );
}

function EventButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2 text-[6px] font-semibold text-muted transition hover:border-primary/25 hover:bg-primary/[0.05] hover:text-primary"
    >
      {icon}
      {label}
    </button>
  );
}
