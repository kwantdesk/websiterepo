"use client";

import { useMemo } from "react";
import { Clock, TrendingDown, TrendingUp, X, Zap } from "lucide-react";
import type { GexMapFrame } from "@/lib/gexMap";
import {
  GEX_NODE_CHANGE_WINDOWS,
  buildGexNodeSeries,
  gexNodeBias,
  gexNodeChangeOver,
  gexNodeCoverageMs,
  gexNodeTrend,
  type GexNodeChange,
} from "@/lib/gexMapNodeDetail";

type Props = {
  strike: number;
  frames: readonly GexMapFrame[];
  /** Replay clock, so a node can never show exposure the trader has not reached. */
  throughMs?: number;
  greekLabel: string;
  sessionDate: string;
  onClose: () => void;
};

function formatCompact(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "+";
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
}

function formatPercent(value: number) {
  const sign = value < 0 ? "−" : "+";
  const absolute = Math.abs(value);
  return `${sign}${absolute >= 100 ? absolute.toFixed(0) : absolute.toFixed(1)}%`;
}

function relativeLabel(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = minutes / 60;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}h ago`;
}

/** One row of the rate-of-change table. */
function ChangeRow({ label, change }: { label: string; change: GexNodeChange }) {
  if (!change.available) {
    // A window the retained frames do not span has no honest answer. The panel
    // says so, instead of quietly measuring from the oldest sample it happens
    // to hold and printing that under a "1 day" label.
    return (
      <div className="flex items-baseline justify-between py-[3px] font-mono text-[10px]">
        <span className="text-muted">{label}</span>
        <span className="text-muted/60" title="Not enough recorded history to measure this window">
          no history
        </span>
      </div>
    );
  }
  const rising = (change.absolute ?? 0) >= 0;
  const tone = rising ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px] font-mono text-[10px]">
      <span className="text-muted">{label}</span>
      <span className="flex items-baseline gap-3">
        <span className={tone}>{formatCompact(change.absolute ?? 0)}</span>
        <span className={`${change.percent === null ? "text-muted/60" : tone} min-w-[54px] text-right`}>
          {change.percent === null ? (
            // A ratio against a baseline near zero reads in the thousands of
            // percent and tells the trader nothing the absolute figure did not.
            <span title="Baseline too small for a meaningful percentage">n/a</span>
          ) : formatPercent(change.percent)}
        </span>
      </span>
    </div>
  );
}

export default function GexMapNodePanel({
  strike, frames, throughMs, greekLabel, sessionDate, onClose,
}: Props) {
  const series = useMemo(
    () => buildGexNodeSeries(frames, strike, throughMs),
    [frames, strike, throughMs],
  );
  const nowMs = throughMs ?? series[series.length - 1]?.timestamp;
  const current = series[series.length - 1]?.value ?? null;
  const bias = gexNodeBias(current);
  const trend = gexNodeTrend(series, nowMs);
  const coverageMs = gexNodeCoverageMs(series);
  const changes = useMemo(
    () => GEX_NODE_CHANGE_WINDOWS.map((window) => ({
      ...window,
      change: gexNodeChangeOver(series, window.ms, nowMs),
    })),
    [nowMs, series],
  );

  // The sparkline plots the whole retained history rather than a fixed span,
  // so its axis never implies more coverage than the panel actually holds.
  const spark = useMemo(() => {
    if (series.length < 2) return null;
    const values = series.map((sample) => sample.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const first = series[0].timestamp;
    const width = series[series.length - 1].timestamp - first || 1;
    const points = series.map((sample) => {
      const x = ((sample.timestamp - first) / width) * 100;
      const y = 100 - ((sample.value - min) / span) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { points: points.join(" "), min, max, rising: values[values.length - 1] >= values[0] };
  }, [series]);

  const biasTone = bias === "POSITIVE"
    ? "border-emerald-500/40 text-emerald-400"
    : bias === "NEGATIVE"
      ? "border-rose-500/40 text-rose-400"
      : "border-border text-muted";
  const trendTone = trend === "INCREASING"
    ? "text-emerald-400"
    : trend === "DECREASING"
      ? "text-rose-400"
      : "text-muted";
  const TrendIcon = trend === "DECREASING" ? TrendingDown : TrendingUp;

  return (
    <section className="w-full max-w-[340px] border border-border bg-panel shadow-[0_24px_90px_rgba(0,0,0,0.65)]">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2.5">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-foreground">Strike {strike}</div>
          <div className="font-mono text-[9px] text-muted">{sessionDate} · {greekLabel}</div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-semibold tracking-[0.1em] ${biasTone}`}>
          {bias}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close node detail"
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center border border-border text-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </header>

      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.1em] text-muted">
          <span>Current value</span>
          {trend === "UNKNOWN" ? null : (
            <span className={`flex items-center gap-1 text-[10px] normal-case tracking-normal ${trendTone}`}>
              <TrendIcon className="h-3 w-3" />
              {trend === "STEADY"
                ? "Exposure steady"
                : `Exposure ${trend === "INCREASING" ? "increasing" : "decreasing"}`}
            </span>
          )}
        </div>
        <div className="mt-1 font-mono text-[20px] font-semibold text-foreground">
          {current === null ? "—" : formatCompact(current)}
        </div>
      </div>

      <div className="border-b border-border px-3 py-2.5">
        <div className="text-[9px] uppercase tracking-[0.1em] text-muted">Value over time</div>
        {spark ? (
          <>
            <div className="mt-1.5 flex gap-2">
              <div className="flex w-14 shrink-0 flex-col justify-between py-0.5 text-right font-mono text-[8px] text-muted">
                <span>{formatCompact(spark.max)}</span>
                <span>{formatCompact(spark.min)}</span>
              </div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 flex-1" aria-hidden="true">
                <polyline
                  points={spark.points}
                  fill="none"
                  stroke={spark.rising ? "#34D399" : "#FB7185"}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div className="mt-1 flex justify-between pl-16 font-mono text-[8px] text-muted">
              <span>{relativeLabel(coverageMs)}</span>
              <span>Now</span>
            </div>
          </>
        ) : (
          <div className="mt-2 font-mono text-[9px] text-muted">
            Not enough recorded frames to plot this node yet.
          </div>
        )}
      </div>

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.1em] text-muted">
          <Clock className="h-3 w-3" /> Rate of change
        </div>
        <div className="mt-1.5">
          {changes.filter((entry) => !entry.extended).map((entry) => (
            <ChangeRow key={entry.id} label={entry.label} change={entry.change} />
          ))}
        </div>
        <div className="mt-2 border-t border-border pt-2">
          <div className="text-[9px] uppercase tracking-[0.1em] text-muted">Extended</div>
          <div className="mt-1">
            {changes.filter((entry) => entry.extended).map((entry) => (
              <ChangeRow key={entry.id} label={entry.label} change={entry.change} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
