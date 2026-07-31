"use client";

import { Activity, Radio, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import type {
  GreekMode,
  IntradayExposureSeries,
  OptionsPositioningPulsePayload,
} from "@/lib/optionsFlow";
import type {
  GexDeskPayload,
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";

type FlowStatus = "CONNECTING" | "LIVE" | "DELAYED" | "LAST_SESSION" | "WAITING" | "RECONNECTING";

const MODES: GreekMode[] = ["GAMMA", "DELTA", "VANNA", "CHARM"];
const MODE_META: Record<GreekMode, { short: string; title: string; detail: string }> = {
  GAMMA: { short: "GEX", title: "Gamma exposure", detail: "Hedge acceleration" },
  DELTA: { short: "DEX", title: "Delta exposure", detail: "Directional inventory" },
  VANNA: { short: "VEX", title: "Vanna exposure", detail: "Volatility sensitivity" },
  CHARM: { short: "CHEX", title: "Charm exposure", detail: "Time-decay pressure" },
};

const EMPTY_SERIES: Record<GreekMode, IntradayExposureSeries | null> = {
  GAMMA: null,
  DELTA: null,
  VANNA: null,
  CHARM: null,
};

const EMPTY_STATUS: Record<GreekMode, FlowStatus> = {
  GAMMA: "CONNECTING",
  DELTA: "CONNECTING",
  VANNA: "CONNECTING",
  CHARM: "CONNECTING",
};

function compact(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}

function timeLabel(timestamp: number | null, seconds = false) {
  if (!timestamp) return "Waiting for provider";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(new Date(timestamp));
}

function mergeSeries(
  current: IntradayExposureSeries | null,
  incoming: IntradayExposureSeries,
) {
  if (
    !current
    || current.mode !== incoming.mode
    || current.expiration !== incoming.expiration
  ) return incoming;

  const points = new Map(current.points.map((point) => [point.timestamp, point]));
  incoming.points.forEach((point) => points.set(point.timestamp, point));
  return {
    ...incoming,
    points: [...points.values()]
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(-420),
    latestStrikes: incoming.latestStrikes.length ? incoming.latestStrikes : current.latestStrikes,
    lookbacks: incoming.lookbacks.length ? incoming.lookbacks : current.lookbacks,
  };
}

function statusTone(status: FlowStatus) {
  if (status === "LIVE") return "border-primary/25 bg-primary/10 text-primary";
  if (status === "DELAYED" || status === "RECONNECTING") return "border-danger/25 bg-danger/10 text-danger";
  return "border-border bg-surface text-muted";
}

function ExposureStrip({
  mode,
  series,
  status,
  showTimeAxis,
}: {
  mode: GreekMode;
  series: IntradayExposureSeries | null;
  status: FlowStatus;
  showTimeAxis: boolean;
}) {
  const geometry = useMemo(() => {
    const width = 1_100;
    const height = 126;
    const left = 10;
    const right = 12;
    const top = 11;
    const bottom = showTimeAxis ? 22 : 10;
    const points = series?.points ?? [];
    if (points.length < 2) {
      return {
        width,
        height,
        zeroY: height / 2,
        callPath: "",
        putPath: "",
        netPath: "",
        netArea: "",
        ticks: [] as Array<{ x: number; label: string }>,
      };
    }

    const maxAbsolute = Math.max(
      1,
      ...points.flatMap((point) => [Math.abs(point.call), Math.abs(point.put), Math.abs(point.net)]),
    );
    const x = (index: number) => left + index / (points.length - 1) * (width - left - right);
    const y = (value: number) => top + (maxAbsolute - value) / (maxAbsolute * 2) * (height - top - bottom);
    const path = (key: "call" | "put" | "net") => points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`)
      .join(" ");
    const netPath = path("net");
    const zeroY = y(0);
    const netArea = `${netPath} L${x(points.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${x(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
    const tickIndexes = [0, 0.25, 0.5, 0.75, 1]
      .map((ratio) => Math.round((points.length - 1) * ratio));
    return {
      width,
      height,
      zeroY,
      callPath: path("call"),
      putPath: path("put"),
      netPath,
      netArea,
      ticks: tickIndexes.map((index) => ({
        x: x(index),
        label: timeLabel(points[index]?.timestamp ?? null),
      })),
    };
  }, [series, showTimeAxis]);

  const latest = series?.points.at(-1) ?? null;
  const first = series?.points[0] ?? null;
  const change = latest && first ? latest.net - first.net : null;
  const statusLabel = status === "LAST_SESSION" ? "LAST SESSION" : status;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[160px_minmax(0,1fr)] border-b border-border last:border-b-0">
      <div className="flex min-h-0 flex-col justify-center border-r border-border bg-panel/65 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[14px] font-semibold text-foreground">{MODE_META[mode].short}</span>
          <span className={`rounded-md border px-1.5 py-0.5 text-[6px] font-semibold ${statusTone(status)}`}>
            {statusLabel}
          </span>
        </div>
        <div className="mt-0.5 text-[7px] text-muted">{MODE_META[mode].detail}</div>
        <div className={`mt-2 font-mono text-[12px] font-semibold ${(latest?.net ?? 0) >= 0 ? "text-primary" : "text-danger"}`}>
          {compact(latest?.net ?? null)}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[6px] text-muted">
          <span>OPEN</span>
          <span className={`font-mono ${(change ?? 0) >= 0 ? "text-primary" : "text-danger"}`}>{compact(change)}</span>
        </div>
      </div>

      <div className="relative min-h-0 overflow-hidden bg-background">
        <div className="pointer-events-none absolute left-3 top-2 z-10 flex items-center gap-3 text-[6px] font-semibold">
          <span className="flex items-center gap-1 text-primary"><i className="h-1 w-1 rounded-full bg-primary" />CALL {compact(latest?.call ?? null)}</span>
          <span className="flex items-center gap-1 text-danger"><i className="h-1 w-1 rounded-full bg-danger" />PUT {compact(latest?.put ?? null)}</span>
          <span className="flex items-center gap-1 text-accent"><i className="h-1 w-1 rounded-full bg-accent" />NET</span>
        </div>
        {series?.points.length && series.points.length >= 2 ? (
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            preserveAspectRatio="none"
            className="h-full min-h-[110px] w-full"
            role="img"
            aria-label={`${MODE_META[mode].title} live session flow`}
          >
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line key={ratio} x1="0" x2={geometry.width} y1={ratio * geometry.height} y2={ratio * geometry.height} stroke="var(--grid-color)" strokeWidth="1" />
            ))}
            <line x1="0" x2={geometry.width} y1={geometry.zeroY} y2={geometry.zeroY} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 5" />
            <path d={geometry.netArea} fill="var(--accent)" fillOpacity="0.055" />
            <path d={geometry.callPath} fill="none" stroke="var(--primary)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <path d={geometry.putPath} fill="none" stroke="var(--danger)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <path d={geometry.netPath} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {showTimeAxis ? geometry.ticks.map((tick) => (
              <text key={`${tick.x}-${tick.label}`} x={tick.x} y={geometry.height - 5} textAnchor="middle" fill="var(--muted)" fontSize="7">{tick.label}</text>
            )) : null}
          </svg>
        ) : (
          <div className="flex h-full min-h-[110px] items-center justify-center text-[8px] text-muted">
            {status === "RECONNECTING" ? "Reconnecting to exposure flow" : "Waiting for completed one-minute exposure buckets"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveExposureFlowStack({
  payload,
  sourceFilter,
  onSourceFilterChange,
}: {
  payload: GexDeskPayload;
  sourceFilter: "COMBINED" | GexDeskSourceSymbol;
  onSourceFilterChange: (source: "COMBINED" | GexDeskSourceSymbol) => void;
}) {
  const [symbol, setSymbol] = useState<GexDeskSourceSymbol>(sourceFilter === "QQQ" ? "QQQ" : "NDX");
  const [seriesByMode, setSeriesByMode] = useState<Record<GreekMode, IntradayExposureSeries | null>>(EMPTY_SERIES);
  const [statusByMode, setStatusByMode] = useState<Record<GreekMode, FlowStatus>>(EMPTY_STATUS);
  const [lastProviderUpdate, setLastProviderUpdate] = useState<number | null>(null);
  const requestRevision = useRef(0);

  const source = payload.sources.find((item) => item.symbol === symbol) ?? null;
  const expiration = source?.zeroDteExposure?.expiries[0]?.expiration
    ?? source?.exposure?.expiries[0]?.expiration
    ?? null;
  const marketOpen = payload.marketOpen;

  useEffect(() => {
    if (sourceFilter === "NDX" || sourceFilter === "QQQ") setSymbol(sourceFilter);
  }, [sourceFilter]);

  useEffect(() => {
    setSeriesByMode(EMPTY_SERIES);
    setStatusByMode(Object.fromEntries(MODES.map((mode) => [mode, expiration ? "CONNECTING" : "WAITING"])) as Record<GreekMode, FlowStatus>);
    setLastProviderUpdate(null);
    if (!expiration) return;

    let cancelled = false;
    let timer: number | null = null;
    const revision = requestRevision.current + 1;
    requestRevision.current = revision;

    const poll = async () => {
      let nextDelay = marketOpen ? 10_000 : 60_000;
      const settled = await Promise.allSettled(MODES.map(async (mode) => {
        const params = new URLSearchParams({ symbol, mode, expiration });
        const response = await fetch(`/api/options-flow/positioning?${params}`, { cache: "no-store" });
        const body = await response.json() as OptionsPositioningPulsePayload & { error?: string };
        if (!response.ok) throw new Error(body.error || `${MODE_META[mode].short} flow is unavailable.`);
        return body;
      }));

      if (cancelled || requestRevision.current !== revision) return;
      settled.forEach((result, index) => {
        const mode = MODES[index];
        if (result.status === "fulfilled") {
          const incoming = result.value;
          if (incoming.symbol !== symbol || incoming.expiration !== expiration || incoming.mode !== mode) return;
          setSeriesByMode((current) => ({
            ...current,
            [mode]: mergeSeries(current[mode], incoming.series),
          }));
          setStatusByMode((current) => ({ ...current, [mode]: incoming.status }));
          setLastProviderUpdate((current) => Math.max(current ?? 0, Date.parse(incoming.asOf)));
          nextDelay = Math.max(nextDelay, incoming.refreshAfterMs);
        } else {
          const message = result.reason instanceof Error ? result.reason.message.toLowerCase() : "";
          const waiting = message.includes("first completed") || message.includes("no completed");
          setStatusByMode((current) => ({ ...current, [mode]: waiting ? "WAITING" : "RECONNECTING" }));
        }
      });

      if (!cancelled) timer = window.setTimeout(() => void poll(), nextDelay);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [expiration, marketOpen, symbol]);

  const aggregateStatus = MODES.some((mode) => statusByMode[mode] === "LIVE")
    ? "LIVE"
    : MODES.some((mode) => statusByMode[mode] === "RECONNECTING")
      ? "RECONNECTING"
      : marketOpen
        ? "CONNECTING"
        : "LAST SESSION";

  const handleInstrument = (next: GexDeskSourceSymbol) => {
    setSymbol(next);
    onSourceFilterChange(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-panel px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary">
          <Waves className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[9px] font-semibold">Flow Regime</div>
          <div className="mt-0.5 text-[6px] uppercase tracking-[0.12em] text-muted">Live exposure flow - four-Greek session stack</div>
        </div>

        <KwantSelect
          value={symbol}
          onChange={(event) => handleInstrument(event.target.value as GexDeskSourceSymbol)}
          menuLabel="Options instrument"
          className="ml-2 h-8 min-w-36 rounded-xl border border-border bg-surface px-2.5 text-[8px] font-semibold"
        >
          <option value="NDX">NDX options</option>
          <option value="QQQ">QQQ options</option>
        </KwantSelect>

        <span className={`ml-auto flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[7px] font-semibold ${aggregateStatus === "LIVE" ? "border-primary/25 bg-primary/10 text-primary" : aggregateStatus === "RECONNECTING" ? "border-danger/25 bg-danger/10 text-danger" : "border-border bg-surface text-muted"}`}>
          <Radio className={`h-2.5 w-2.5 ${aggregateStatus === "LIVE" ? "animate-pulse" : ""}`} />
          {aggregateStatus}
        </span>
        <span className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[7px] text-muted">
          FRONT {expiration ?? "--"}
        </span>
        <span className="flex items-center gap-1.5 text-[7px] text-muted">
          <Activity className="h-3 w-3 text-accent" />
          {timeLabel(lastProviderUpdate, true)} ET
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {MODES.map((mode, index) => (
          <ExposureStrip
            key={mode}
            mode={mode}
            series={seriesByMode[mode]}
            status={statusByMode[mode]}
            showTimeAxis={index === MODES.length - 1}
          />
        ))}
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-panel px-3 text-[6px] text-muted">
        <span>Call, put and net exposure by completed provider minute - session baseline retained while live buckets merge.</span>
        <span className="font-mono">KwantData - {symbol} - 1m</span>
      </div>
    </div>
  );
}
