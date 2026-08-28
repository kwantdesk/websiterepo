"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Crosshair,
  Layers3,
  Radio,
  Route,
} from "lucide-react";
import { useMemo } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import type {
  GexDeskHistoryPayload,
  GexDeskPayload,
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";

type SourceFilter = "COMBINED" | GexDeskSourceSymbol;
type MajorKind = "POSITIVE_VOLUME" | "NEGATIVE_VOLUME" | "POSITIVE_OI" | "NEGATIVE_OI";

type ProfileRow = {
  price: number;
  oiNet: number;
  volumeNet: number;
};

type MajorLevel = {
  kind: MajorKind;
  price: number;
  value: number;
};

type MajorTrailPoint = {
  timestamp: number;
  positive: number | null;
  negative: number | null;
};

const SVG_WIDTH = 930;
const SVG_HEIGHT = 510;
const PLOT_TOP = 38;
const PLOT_BOTTOM = 472;
const ZERO_X = 465;
const SIDE_WIDTH = 382;

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function formatPrice(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function compactSigned(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
}

function formatPointChange(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)} pts`;
}

function timestampLabel(timestamp: number | undefined) {
  if (!timestamp) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function volumeRatios(payload: GexDeskPayload, sourceFilter: SourceFilter) {
  const allowedSources = new Set<GexDeskSourceSymbol>(
    sourceFilter === "COMBINED" ? ["NDX", "QQQ"] : [sourceFilter],
  );
  const snapshots = new Map<string, {
    source: GexDeskSourceSymbol;
    strike: number;
    contractType: "CALL" | "PUT";
    expiration: string;
    volume: number;
    openInterest: number;
  }>();

  for (const print of payload.optionsTape) {
    if (!allowedSources.has(print.source)) continue;
    const key = `${print.source}:${print.expiration ?? "unknown"}:${print.strike}:${print.contractType}`;
    const volume = Number.isFinite(Number(print.volume)) ? Number(print.volume) : 0;
    const openInterest = Number.isFinite(Number(print.openInterest)) ? Number(print.openInterest) : 0;
    const current = snapshots.get(key);
    if (!current || volume > current.volume || openInterest > current.openInterest) {
      snapshots.set(key, {
        source: print.source,
        strike: print.strike,
        contractType: print.contractType,
        expiration: print.expiration ?? "unknown",
        volume,
        openInterest,
      });
    }
  }

  const totals = new Map<string, {
    callVolume: number;
    callOi: number;
    putVolume: number;
    putOi: number;
  }>();
  for (const snapshot of snapshots.values()) {
    const key = `${snapshot.source}:${snapshot.strike}`;
    const total = totals.get(key) ?? {
      callVolume: 0,
      callOi: 0,
      putVolume: 0,
      putOi: 0,
    };
    if (snapshot.contractType === "CALL") {
      total.callVolume += snapshot.volume;
      total.callOi += snapshot.openInterest;
    } else {
      total.putVolume += snapshot.volume;
      total.putOi += snapshot.openInterest;
    }
    totals.set(key, total);
  }

  return new Map(
    [...totals.entries()].map(([key, total]) => [key, {
      call: total.callOi > 0 ? clamp(total.callVolume / total.callOi, 0, 8) : 0,
      put: total.putOi > 0 ? clamp(total.putVolume / total.putOi, 0, 8) : 0,
    }]),
  );
}

function buildProfile(
  payload: GexDeskPayload,
  history: GexDeskHistoryPayload | null,
  sourceFilter: SourceFilter,
  referencePrice: number,
) {
  const inferredBucket = Math.abs((payload.rail[1]?.price ?? 0) - (payload.rail[0]?.price ?? 0));
  const bucketSize = history?.bucketSize
    ?? (inferredBucket || Math.max(10, Math.round(referencePrice * 0.0007 / 5) * 5));
  const ratios = volumeRatios(payload, sourceFilter);
  const rows = new Map<number, ProfileRow>();

  for (const source of payload.sources) {
    if (sourceFilter !== "COMBINED" && source.symbol !== sourceFilter) continue;
    if (!source.spot || !source.exposure) continue;
    for (const strike of source.exposure.strikes) {
      const mappedPrice = referencePrice * strike.strike / source.spot;
      if (!Number.isFinite(mappedPrice) || Math.abs(mappedPrice / referencePrice - 1) > 0.09) continue;
      const price = Math.round(mappedPrice / bucketSize) * bucketSize;
      const current = rows.get(price) ?? { price, oiNet: 0, volumeNet: 0 };
      const ratio = ratios.get(`${source.symbol}:${strike.strike}`) ?? { call: 0, put: 0 };
      current.oiNet += strike.call + strike.put;
      current.volumeNet += strike.call * ratio.call + strike.put * ratio.put;
      rows.set(price, current);
    }
  }
  return [...rows.values()].sort((left, right) => left.price - right.price);
}

function major(rows: ProfileRow[], kind: MajorKind): MajorLevel | null {
  const volume = kind.endsWith("VOLUME");
  const positive = kind.startsWith("POSITIVE");
  const candidates = rows
    .map((row) => ({ price: row.price, value: volume ? row.volumeNet : row.oiNet }))
    .filter((row) => positive ? row.value > 0 : row.value < 0);
  if (!candidates.length) return null;
  const selected = candidates.reduce((best, candidate) => (
    positive
      ? candidate.value > best.value ? candidate : best
      : candidate.value < best.value ? candidate : best
  ));
  return { kind, ...selected };
}

function historyTrails(history: GexDeskHistoryPayload | null): MajorTrailPoint[] {
  if (!history?.timestamps.length || !history.rows.length) return [];
  return history.timestamps.map((timestamp, timeIndex) => {
    let positive: { price: number; value: number } | null = null;
    let negative: { price: number; value: number } | null = null;
    for (const row of history.rows) {
      const value = row.call?.[timeIndex] !== undefined || row.put?.[timeIndex] !== undefined
        ? (row.call?.[timeIndex] ?? 0) + (row.put?.[timeIndex] ?? 0)
        : row.net?.[timeIndex] ?? 0;
      if (value > 0 && (!positive || value > positive.value)) positive = { price: row.price, value };
      if (value < 0 && (!negative || value < negative.value)) negative = { price: row.price, value };
    }
    return {
      timestamp,
      positive: positive?.price ?? null,
      negative: negative?.price ?? null,
    };
  });
}

function indexAtOrBefore(timestamps: number[], target: number) {
  let result = 0;
  for (let index = 0; index < timestamps.length; index += 1) {
    if (timestamps[index] <= target) result = index;
    else break;
  }
  return result;
}

function kindLabel(kind: MajorKind) {
  if (kind === "POSITIVE_VOLUME") return "+GEX VOL EST.";
  if (kind === "NEGATIVE_VOLUME") return "−GEX VOL EST.";
  if (kind === "POSITIVE_OI") return "+GEX OI";
  return "−GEX OI";
}

export default function MajorGamma({
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
  const spot = livePrice ?? payload.nqPrice ?? history?.nqPrices.at(-1) ?? 0;
  const rows = useMemo(
    () => buildProfile(payload, history, sourceFilter, spot),
    [history, payload, sourceFilter, spot],
  );
  const levels = useMemo(() => [
    major(rows, "POSITIVE_VOLUME"),
    major(rows, "NEGATIVE_VOLUME"),
    major(rows, "POSITIVE_OI"),
    major(rows, "NEGATIVE_OI"),
  ].filter((level): level is MajorLevel => level !== null), [rows]);
  const positiveVolume = levels.find((level) => level.kind === "POSITIVE_VOLUME") ?? null;
  const negativeVolume = levels.find((level) => level.kind === "NEGATIVE_VOLUME") ?? null;
  const positiveOi = levels.find((level) => level.kind === "POSITIVE_OI") ?? null;
  const negativeOi = levels.find((level) => level.kind === "NEGATIVE_OI") ?? null;
  const sumVolume = rows.reduce((sum, row) => sum + row.volumeNet, 0);
  const sumOi = rows.reduce((sum, row) => sum + row.oiNet, 0);
  const trails = useMemo(() => historyTrails(history), [history]);
  const latestTimestamp = history?.timestamps.at(-1);
  const fifteenMinuteIndex = history?.timestamps.length && latestTimestamp
    ? indexAtOrBefore(history.timestamps, latestTimestamp - 15 * 60_000)
    : 0;
  const latestTrail = trails.at(-1) ?? null;
  const priorTrail = trails[fifteenMinuteIndex] ?? null;
  const positiveMigration = latestTrail?.positive !== null && priorTrail?.positive !== null
    && latestTrail?.positive !== undefined && priorTrail?.positive !== undefined
    ? latestTrail.positive - priorTrail.positive
    : null;
  const negativeMigration = latestTrail?.negative !== null && priorTrail?.negative !== null
    && latestTrail?.negative !== undefined && priorTrail?.negative !== undefined
    ? latestTrail.negative - priorTrail.negative
    : null;
  const nearest = levels.length
    ? levels.reduce((best, level) => (
        Math.abs(level.price - spot) < Math.abs(best.price - spot) ? level : best
      ))
    : null;

  const keyPrices = [spot, ...levels.map((level) => level.price)];
  const rawLow = keyPrices.length ? Math.min(...keyPrices) : spot - 1;
  const rawHigh = keyPrices.length ? Math.max(...keyPrices) : spot + 1;
  const padding = Math.max(40, (rawHigh - rawLow) * 0.14);
  const priceLow = rawLow - padding;
  const priceHigh = rawHigh + padding;
  const visibleRows = rows.filter((row) => row.price >= priceLow && row.price <= priceHigh);
  const maximum = Math.max(
    1,
    ...visibleRows.flatMap((row) => [Math.abs(row.oiNet), Math.abs(row.volumeNet)]),
  );
  const yForPrice = (price: number) => PLOT_TOP + (
    (priceHigh - price) / Math.max(1, priceHigh - priceLow)
  ) * (PLOT_BOTTOM - PLOT_TOP);
  const rowHeight = Math.max(5, Math.min(16, (PLOT_BOTTOM - PLOT_TOP) / Math.max(1, visibleRows.length)));

  const trailPrices = trails.flatMap((point) => [
    ...(point.positive === null ? [] : [point.positive]),
    ...(point.negative === null ? [] : [point.negative]),
  ]);
  const trailLow = trailPrices.length ? Math.min(...trailPrices) : priceLow;
  const trailHigh = trailPrices.length ? Math.max(...trailPrices) : priceHigh;
  const trailX = (index: number) => 24 + index / Math.max(1, trails.length - 1) * 252;
  const trailY = (price: number) => 24 + (
    (trailHigh - price) / Math.max(1, trailHigh - trailLow)
  ) * 160;
  const positiveTrailPoints = trails.flatMap((point, index) => (
    point.positive === null ? [] : [`${trailX(index)},${trailY(point.positive)}`]
  )).join(" ");
  const negativeTrailPoints = trails.flatMap((point, index) => (
    point.negative === null ? [] : [`${trailX(index)},${trailY(point.negative)}`]
  )).join(" ");

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-panel px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary">
          <Crosshair className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[9px] font-semibold">Major Gamma</div>
          <div className="text-[6px] uppercase tracking-[0.12em] text-muted">Positive / negative · volume estimate / open interest</div>
        </div>
        <KwantSelect
          value={sourceFilter}
          onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)}
          menuLabel="Options source"
          className="h-8 min-w-36 rounded-xl border border-border bg-surface px-2.5 text-[8px]"
        >
          <option value="COMBINED">NDX + QQQ</option>
          <option value="NDX">NDX</option>
          <option value="QQQ">QQQ</option>
        </KwantSelect>
        <div className="ml-auto flex items-center gap-2">
          <span className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[7px] font-semibold ${
            payload.marketOpen
              ? "border-primary/25 bg-primary/[0.06] text-primary"
              : "border-border bg-surface text-muted"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${payload.marketOpen ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted"}`} />
            {payload.marketOpen ? "LIVE" : "EOD"}
          </span>
          <span className="hidden h-8 items-center rounded-xl border border-border bg-surface px-2.5 font-mono text-[7px] text-muted sm:flex">
            {timestampLabel(latestTimestamp ?? Date.parse(payload.asOf))} ET
          </span>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        <Metric label="Major +GEX · vol est." level={positiveVolume} tone="primary" />
        <Metric label="Major −GEX · vol est." level={negativeVolume} tone="danger" />
        <Metric label="Major +GEX · OI" level={positiveOi} tone="primary" />
        <Metric label="Major −GEX · OI" level={negativeOi} tone="danger" />
      </div>

      <div className="grid min-h-0 flex-1 gap-px bg-border xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="relative min-h-[470px] overflow-hidden bg-background">
          {!visibleRows.length ? (
            <div className="absolute inset-0 flex items-center justify-center text-center">
              <div>
                <Activity className="mx-auto h-5 w-5 text-muted" />
                <div className="mt-3 text-[8px] font-semibold">No major gamma profile is available</div>
              </div>
            </div>
          ) : (
            <svg
              className="h-full w-full"
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Major positive and negative gamma ladder with volume and open-interest layers"
            >
              <defs>
                <linearGradient id="major-negative" x1="1" x2="0">
                  <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.25" />
                </linearGradient>
                <linearGradient id="major-positive" x1="0" x2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.25" />
                </linearGradient>
                <filter id="major-line-glow" x="-20%" y="-250%" width="140%" height="600%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="var(--background)" />
              <text x="252" y="22" textAnchor="middle" fill="var(--muted)" fontSize="8" fontWeight="600">NEGATIVE / ACCELERATION POTENTIAL</text>
              <text x="678" y="22" textAnchor="middle" fill="var(--muted)" fontSize="8" fontWeight="600">POSITIVE / DAMPENING POTENTIAL</text>
              <line x1={ZERO_X} x2={ZERO_X} y1={PLOT_TOP - 8} y2={PLOT_BOTTOM + 6} stroke="var(--border)" />

              {visibleRows.map((row) => {
                const y = yForPrice(row.price);
                const oiWidth = Math.abs(row.oiNet) / maximum * SIDE_WIDTH;
                const volumeWidth = Math.abs(row.volumeNet) / maximum * SIDE_WIDTH;
                const oiPositive = row.oiNet >= 0;
                const volumePositive = row.volumeNet >= 0;
                return (
                  <g key={row.price}>
                    <line x1="52" x2="878" y1={y + rowHeight / 2} y2={y + rowHeight / 2} stroke="var(--border)" strokeOpacity="0.23" />
                    {oiWidth > 0 ? (
                      <rect
                        x={oiPositive ? ZERO_X : ZERO_X - oiWidth}
                        y={y - rowHeight * 0.42}
                        width={oiWidth}
                        height={Math.max(3, rowHeight * 0.84)}
                        rx="2"
                        fill={oiPositive ? "var(--primary)" : "var(--danger)"}
                        fillOpacity="0.14"
                        stroke={oiPositive ? "var(--primary)" : "var(--danger)"}
                        strokeOpacity="0.34"
                      />
                    ) : null}
                    {volumeWidth > 0 ? (
                      <rect
                        x={volumePositive ? ZERO_X : ZERO_X - volumeWidth}
                        y={y - rowHeight * 0.2}
                        width={volumeWidth}
                        height={Math.max(2, rowHeight * 0.4)}
                        rx="2"
                        fill={volumePositive ? "url(#major-positive)" : "url(#major-negative)"}
                      />
                    ) : null}
                    <rect x={ZERO_X - 39} y={y - 7} width="78" height="14" rx="4" fill="var(--background)" stroke="var(--border)" strokeOpacity="0.55" />
                    <text x={ZERO_X} y={y + 3} textAnchor="middle" fill="var(--muted)" fontSize="7" fontFamily="monospace">{formatPrice(row.price, 0)}</text>
                    <title>{`${formatPrice(row.price)} · OI GEX ${compactSigned(row.oiNet)} · Session-volume GEX estimate ${compactSigned(row.volumeNet)}`}</title>
                  </g>
                );
              })}

              {levels.map((level) => {
                const volume = level.kind.endsWith("VOLUME");
                const positive = level.kind.startsWith("POSITIVE");
                const y = yForPrice(level.price);
                const overlap = levels.some((candidate) => (
                  candidate.kind !== level.kind
                  && candidate.kind.startsWith("POSITIVE") === positive
                  && candidate.kind.endsWith("VOLUME") !== volume
                  && candidate.price === level.price
                ));
                const labelY = y + (overlap ? volume ? -12 : 12 : 0);
                return (
                  <g key={level.kind} filter={volume ? "url(#major-line-glow)" : undefined}>
                    <line
                      x1="46"
                      x2="884"
                      y1={y}
                      y2={y}
                      stroke={positive ? "var(--primary)" : "var(--danger)"}
                      strokeWidth={volume ? 1.8 : 1.1}
                      strokeDasharray={volume ? undefined : "7 6"}
                      strokeOpacity={volume ? 0.95 : 0.68}
                    />
                    <rect
                      x={positive ? 682 : 48}
                      y={labelY - 11}
                      width="200"
                      height="22"
                      rx="6"
                      fill={positive ? "var(--primary)" : "var(--danger)"}
                      fillOpacity={volume ? 0.92 : 0.2}
                      stroke={positive ? "var(--primary)" : "var(--danger)"}
                      strokeOpacity="0.7"
                    />
                    <text
                      x={positive ? 782 : 148}
                      y={labelY + 3}
                      textAnchor="middle"
                      fill={volume ? "var(--background)" : positive ? "var(--primary)" : "var(--danger)"}
                      fontSize="7"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      {kindLabel(level.kind)}{overlap && volume ? " · OI OVERLAP" : ""} · {formatPrice(level.price, 0)} · {compactSigned(level.value)}
                    </text>
                  </g>
                );
              })}

              <g className={payload.marketOpen ? "gexdesk-live-price" : ""}>
                <line x1="42" x2="888" y1={yForPrice(spot)} y2={yForPrice(spot)} stroke="var(--foreground)" strokeWidth="1.2" />
                <rect x="391" y={yForPrice(spot) - 11} width="148" height="22" rx="6" fill="var(--foreground)" />
                <text x="465" y={yForPrice(spot) + 3} textAnchor="middle" fill="var(--background)" fontSize="8" fontFamily="monospace" fontWeight="700">NQ · {formatPrice(spot)}</text>
              </g>
            </svg>
          )}
          <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap items-center gap-4 text-[6px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-full border border-primary/35 bg-primary/15" />OI structure</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-full bg-primary" />Session-volume estimate</span>
            <span>Solid bright line = volume major · dashed line = OI major</span>
          </div>
          {historyLoading ? (
            <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-lg border border-border bg-background/85 px-2.5 py-1.5 text-[6px] text-muted backdrop-blur-md">
              <Radio className="h-3 w-3 animate-pulse text-primary" />Updating major-level trails
            </div>
          ) : null}
        </section>

        <aside className="flex min-h-0 flex-col gap-px bg-border">
          <div className="bg-panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Total gamma environment</div>
                <div className="mt-1 text-[9px] font-semibold">PROFILE BALANCE</div>
              </div>
              <Layers3 className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <SmallMetric label="Volume GEX estimate" value={compactSigned(sumVolume)} tone={sumVolume >= 0 ? "primary" : "danger"} />
              <SmallMetric label="OI GEX" value={compactSigned(sumOi)} tone={sumOi >= 0 ? "primary" : "danger"} />
              <SmallMetric label="+ major · 15m move" value={formatPointChange(positiveMigration)} />
              <SmallMetric label="− major · 15m move" value={formatPointChange(negativeMigration)} />
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Active major migration</div>
                <div className="mt-1 text-[8px] font-semibold">SESSION TRAILS</div>
              </div>
              <Route className="h-4 w-4 text-primary" />
            </div>
            <svg className="mt-3 h-[205px] w-full" viewBox="0 0 300 210" role="img" aria-label="Historical positive and negative active gamma major trails">
              <rect width="300" height="210" rx="12" fill="var(--surface)" />
              {Array.from({ length: 5 }, (_, index) => {
                const y = 24 + index / 4 * 160;
                return <line key={index} x1="20" x2="280" y1={y} y2={y} stroke="var(--border)" strokeOpacity="0.45" />;
              })}
              {positiveTrailPoints ? <polyline points={positiveTrailPoints} fill="none" stroke="var(--primary)" strokeWidth="2" /> : null}
              {negativeTrailPoints ? <polyline points={negativeTrailPoints} fill="none" stroke="var(--danger)" strokeWidth="2" /> : null}
              <text x="24" y="202" fill="var(--primary)" fontSize="7">ACTIVE +GEX MAJOR</text>
              <text x="276" y="202" textAnchor="end" fill="var(--danger)" fontSize="7">ACTIVE −GEX MAJOR</text>
            </svg>
          </div>

          <div className="bg-panel p-4">
            <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Nearest major</div>
            {nearest ? (
              <div className="mt-2 flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                  nearest.kind.startsWith("POSITIVE")
                    ? "border-primary/25 bg-primary/[0.07] text-primary"
                    : "border-danger/25 bg-danger/[0.07] text-danger"
                }`}>
                  {nearest.price >= spot ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </span>
                <div>
                  <div className="text-[8px] font-semibold">{kindLabel(nearest.kind)} · {formatPrice(nearest.price, 0)}</div>
                  <div className="mt-1 text-[6px] text-muted">{formatPointChange(nearest.price - spot)} from NQ · monitor the futures response at contact</div>
                </div>
              </div>
            ) : <div className="mt-2 text-[7px] text-muted">No major is available.</div>}
          </div>
        </aside>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-panel px-3 py-2 text-[6px] text-muted">
        <span><strong className="text-foreground">VOLUME</strong> · current cumulative-contract volume/OI estimate · dynamic</span>
        <span><strong className="text-foreground">OPEN INTEREST</strong> · carried positioning · structural</span>
        <span className="ml-auto">Major = signed argmax / argmin by mapped NQ strike</span>
        <span className="w-full">These are estimated gamma concentrations and regime references—not guaranteed support, resistance, or trade signals.</span>
        {historyError ? <span className="w-full text-warning">Major-level history: {historyError}</span> : null}
      </div>
    </div>
  );
}

function Metric({
  label,
  level,
  tone,
}: {
  label: string;
  level: MajorLevel | null;
  tone: "primary" | "danger";
}) {
  return (
    <div className="bg-panel px-3 py-2">
      <div className="text-[5px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[9px] font-semibold ${tone === "primary" ? "text-primary" : "text-danger"}`}>
        {formatPrice(level?.price ?? null)}
      </div>
      <div className="mt-0.5 font-mono text-[6px] text-muted">{compactSigned(level?.value ?? null)}</div>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2.5 py-2">
      <div className="text-[5px] uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[8px] font-semibold ${
        tone === "primary" ? "text-primary" : tone === "danger" ? "text-danger" : "text-foreground"
      }`}>{value}</div>
    </div>
  );
}
