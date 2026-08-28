"use client";

import {
  Activity,
  BarChart3,
  CirclePause,
  CirclePlay,
  Clock3,
  Layers3,
  Radio,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import type {
  GexDeskHistoryPayload,
  GexDeskPayload,
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";
import type { ExposureSummary } from "@/lib/optionsFlow";

type SourceFilter = "COMBINED" | GexDeskSourceSymbol;
type ExpiryScope = "ALL" | "0DTE" | "1DTE";
type LayerMode = "BOTH" | "OI" | "VOLUME";

type StepRow = {
  price: number;
  callOi: number;
  putOi: number;
  callVolume: number;
  putVolume: number;
  historicalCall: number[];
  historicalPut: number[];
};

type VolumeRatio = {
  call: number;
  put: number;
};

const SVG_WIDTH = 1_200;
const SVG_HEIGHT = 740;
const PLOT_TOP = 46;
const PLOT_BOTTOM = 700;
const PUT_ZERO = 550;
const CALL_ZERO = 650;
const SIDE_WIDTH = 475;
const LOOKBACK_MINUTES = [30, 15, 5, 1] as const;

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function compact(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(absolute / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(absolute / 1_000).toFixed(1)}K`;
  return absolute.toFixed(0);
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
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

function exposureForScope(
  exposure: {
    exposure: ExposureSummary | null;
    zeroDteExposure: ExposureSummary | null;
    oneDteExposure: ExposureSummary | null;
  },
  scope: ExpiryScope,
) {
  if (scope === "0DTE") return exposure.zeroDteExposure;
  if (scope === "1DTE") return exposure.oneDteExposure;
  return exposure.exposure;
}

function expirationForScope(
  exposure: {
    zeroDteExposure: ExposureSummary | null;
    oneDteExposure: ExposureSummary | null;
  },
  scope: ExpiryScope,
) {
  if (scope === "0DTE") return exposure.zeroDteExposure?.expiries[0]?.expiration ?? null;
  if (scope === "1DTE") return exposure.oneDteExposure?.expiries[0]?.expiration ?? null;
  return null;
}

function buildVolumeRatios(
  payload: GexDeskPayload,
  sourceFilter: SourceFilter,
  expiryScope: ExpiryScope,
) {
  const contractSnapshots = new Map<string, {
    source: GexDeskSourceSymbol;
    strike: number;
    contractType: "CALL" | "PUT";
    volume: number;
    openInterest: number;
  }>();
  const allowedSources = new Set<GexDeskSourceSymbol>(
    sourceFilter === "COMBINED" ? ["NDX", "QQQ"] : [sourceFilter],
  );
  const expirations = new Map(
    payload.sources.map((source) => [source.symbol, expirationForScope(source, expiryScope)]),
  );

  for (const print of payload.optionsTape) {
    if (!allowedSources.has(print.source)) continue;
    const requiredExpiration = expirations.get(print.source);
    if (requiredExpiration && print.expiration !== requiredExpiration) continue;
    const key = `${print.source}:${print.expiration ?? "all"}:${print.strike}:${print.contractType}`;
    const current = contractSnapshots.get(key);
    const volume = Number.isFinite(Number(print.volume)) ? Number(print.volume) : 0;
    const openInterest = Number.isFinite(Number(print.openInterest)) ? Number(print.openInterest) : 0;
    if (
      !current
      || volume > current.volume
      || openInterest > current.openInterest
    ) {
      contractSnapshots.set(key, {
        source: print.source,
        strike: print.strike,
        contractType: print.contractType,
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
  for (const snapshot of contractSnapshots.values()) {
    const key = `${snapshot.source}:${snapshot.strike}`;
    const current = totals.get(key) ?? {
      callVolume: 0,
      callOi: 0,
      putVolume: 0,
      putOi: 0,
    };
    if (snapshot.contractType === "CALL") {
      current.callVolume += snapshot.volume;
      current.callOi += snapshot.openInterest;
    } else {
      current.putVolume += snapshot.volume;
      current.putOi += snapshot.openInterest;
    }
    totals.set(key, current);
  }

  return new Map<string, VolumeRatio>(
    [...totals.entries()].map(([key, total]) => [key, {
      call: total.callOi > 0 ? clamp(total.callVolume / total.callOi, 0, 8) : 0,
      put: total.putOi > 0 ? clamp(total.putVolume / total.putOi, 0, 8) : 0,
    }]),
  );
}

function nearestHistoryRow(history: GexDeskHistoryPayload | null, price: number) {
  if (!history?.rows.length) return null;
  const row = history.rows.reduce((nearest, candidate) => (
    Math.abs(candidate.price - price) < Math.abs(nearest.price - price) ? candidate : nearest
  ));
  return Math.abs(row.price - price) <= history.bucketSize * 0.6 ? row : null;
}

function lookbackIndices(history: GexDeskHistoryPayload | null, selectedIndex: number) {
  if (!history?.timestamps.length) return [];
  const selectedTimestamp = history.timestamps[selectedIndex] ?? history.timestamps.at(-1)!;
  return LOOKBACK_MINUTES.map((minutes) => {
    const target = selectedTimestamp - minutes * 60_000;
    let bestIndex = 0;
    for (let index = 0; index <= selectedIndex; index += 1) {
      if (history.timestamps[index] <= target) bestIndex = index;
      else break;
    }
    return bestIndex;
  });
}

function currentProfileRows(
  payload: GexDeskPayload,
  history: GexDeskHistoryPayload | null,
  sourceFilter: SourceFilter,
  expiryScope: ExpiryScope,
  selectedIndex: number,
  replayingHistory: boolean,
  referencePrice: number,
) {
  if (replayingHistory && history?.rows.length) {
    return history.rows.map((row): StepRow => ({
      price: row.price,
      callOi: row.call?.[selectedIndex] ?? Math.max(0, row.net?.[selectedIndex] ?? 0),
      putOi: row.put?.[selectedIndex] ?? Math.min(0, row.net?.[selectedIndex] ?? 0),
      callVolume: 0,
      putVolume: 0,
      historicalCall: row.call ?? [],
      historicalPut: row.put ?? [],
    }));
  }

  const ratioByStrike = buildVolumeRatios(payload, sourceFilter, expiryScope);
  const inferredBucketSize = Math.abs(
    (payload.rail[1]?.price ?? 0) - (payload.rail[0]?.price ?? 0),
  );
  const bucketSize = history?.bucketSize
    ?? (inferredBucketSize || Math.max(10, Math.round((referencePrice * 0.0007) / 5) * 5));
  const rows = new Map<number, StepRow>();
  const sources = payload.sources.filter((source) => (
    sourceFilter === "COMBINED" || source.symbol === sourceFilter
  ));

  for (const source of sources) {
    if (!source.spot || source.spot <= 0) continue;
    const exposure = exposureForScope(source, expiryScope);
    if (!exposure) continue;
    for (const strike of exposure.strikes) {
      const mappedPrice = referencePrice * strike.strike / source.spot;
      if (!Number.isFinite(mappedPrice) || Math.abs(mappedPrice / referencePrice - 1) > 0.075) continue;
      const price = Math.round(mappedPrice / bucketSize) * bucketSize;
      const current = rows.get(price) ?? {
        price,
        callOi: 0,
        putOi: 0,
        callVolume: 0,
        putVolume: 0,
        historicalCall: [],
        historicalPut: [],
      };
      const ratio = ratioByStrike.get(`${source.symbol}:${strike.strike}`) ?? { call: 0, put: 0 };
      current.callOi += strike.call;
      current.putOi += strike.put;
      current.callVolume += strike.call * ratio.call;
      current.putVolume += strike.put * ratio.put;
      rows.set(price, current);
    }
  }

  for (const row of rows.values()) {
    const historical = nearestHistoryRow(history, row.price);
    row.historicalCall = historical?.call ?? [];
    row.historicalPut = historical?.put ?? [];
  }
  return [...rows.values()];
}

function zeroGammaLevel(rows: StepRow[]) {
  const ordered = [...rows].sort((left, right) => left.price - right.price);
  let cumulative = 0;
  let nearest: { price: number; distance: number } | null = null;
  for (const row of ordered) {
    cumulative += row.callOi + row.putOi;
    const distance = Math.abs(cumulative);
    if (!nearest || distance < nearest.distance) nearest = { price: row.price, distance };
  }
  return nearest?.price ?? null;
}

export default function KwantSteps({
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
  const [expiryScope, setExpiryScope] = useState<ExpiryScope>("ALL");
  const [layerMode, setLayerMode] = useState<LayerMode>("BOTH");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const followLatestRef = useRef(true);
  const historyLengthRef = useRef(0);
  const latestIndex = Math.max(0, (history?.timestamps.length ?? 1) - 1);
  const historySupported = expiryScope !== "1DTE";

  useEffect(() => {
    const priorLatest = Math.max(0, historyLengthRef.current - 1);
    if (followLatestRef.current || selectedIndex >= priorLatest) {
      setSelectedIndex(latestIndex);
    }
    historyLengthRef.current = history?.timestamps.length ?? 0;
  }, [history?.timestamps.length, latestIndex, selectedIndex]);

  useEffect(() => {
    if (!playing || !historySupported || !history?.timestamps.length) return;
    const timer = window.setInterval(() => {
      setSelectedIndex((current) => {
        if (current >= latestIndex) {
          setPlaying(false);
          followLatestRef.current = true;
          return latestIndex;
        }
        return current + 1;
      });
    }, 380);
    return () => window.clearInterval(timer);
  }, [history?.timestamps.length, historySupported, latestIndex, playing]);

  const replayingHistory = Boolean(
    historySupported
    &&
    history?.timestamps.length
    && selectedIndex < latestIndex,
  );
  const referencePrice = replayingHistory
    ? history?.nqPrices[selectedIndex] ?? payload.nqPrice ?? 0
    : livePrice ?? payload.nqPrice ?? history?.nqPrices.at(-1) ?? 0;
  const rows = useMemo(
    () => currentProfileRows(
      payload,
      history,
      sourceFilter,
      expiryScope,
      selectedIndex,
      replayingHistory,
      referencePrice,
    ),
    [expiryScope, history, payload, referencePrice, replayingHistory, selectedIndex, sourceFilter],
  );
  const visibleRows = useMemo(() => {
    const ordered = [...rows].sort((left, right) => left.price - right.price);
    if (ordered.length <= 39) return ordered.reverse();
    const nearestIndex = ordered.reduce((nearest, row, index) => (
      Math.abs(row.price - referencePrice) < Math.abs(ordered[nearest].price - referencePrice)
        ? index
        : nearest
    ), 0);
    const start = clamp(nearestIndex - 19, 0, ordered.length - 39);
    return ordered.slice(start, start + 39).reverse();
  }, [referencePrice, rows]);
  const lookbacks = useMemo(
    () => historySupported
      ? lookbackIndices(history, replayingHistory ? selectedIndex : latestIndex)
      : [],
    [history, historySupported, latestIndex, replayingHistory, selectedIndex],
  );
  const maximum = Math.max(
    1,
    ...visibleRows.flatMap((row) => [
      layerMode !== "VOLUME" ? Math.abs(row.callOi) : 0,
      layerMode !== "VOLUME" ? Math.abs(row.putOi) : 0,
      layerMode !== "OI" ? Math.abs(row.callVolume) : 0,
      layerMode !== "OI" ? Math.abs(row.putVolume) : 0,
      ...lookbacks.flatMap((index) => [
        Math.abs(row.historicalCall[index] ?? 0),
        Math.abs(row.historicalPut[index] ?? 0),
      ]),
    ]),
  );
  const callWall = visibleRows.reduce<StepRow | null>((best, row) => (
    !best || Math.abs(row.callOi) > Math.abs(best.callOi) ? row : best
  ), null);
  const putWall = visibleRows.reduce<StepRow | null>((best, row) => (
    !best || Math.abs(row.putOi) > Math.abs(best.putOi) ? row : best
  ), null);
  const zeroGamma = zeroGammaLevel(visibleRows);
  const priceHigh = visibleRows[0]?.price ?? referencePrice + 1;
  const priceLow = visibleRows.at(-1)?.price ?? referencePrice - 1;
  const yForPrice = (price: number) => PLOT_TOP + (
    (priceHigh - price) / Math.max(1, priceHigh - priceLow)
  ) * (PLOT_BOTTOM - PLOT_TOP);
  const rowHeight = visibleRows.length
    ? (PLOT_BOTTOM - PLOT_TOP) / visibleRows.length
    : 18;
  const priceTrace = history?.nqPrices.length
    ? history.nqPrices
        .slice(0, (replayingHistory ? selectedIndex : latestIndex) + 1)
        .slice(-90)
    : [];
  const priceTracePoints = priceTrace.map((price, index) => {
    const x = 70 + index / Math.max(1, priceTrace.length - 1) * 1_060;
    return `${x},${clamp(yForPrice(price), PLOT_TOP, PLOT_BOTTOM)}`;
  }).join(" ");
  const selectedTimestamp = history?.timestamps[
    replayingHistory ? selectedIndex : latestIndex
  ];
  const status = replayingHistory
    ? "REPLAY"
    : payload.marketOpen
      ? "LIVE"
      : "EOD";
  const statusTone = status === "LIVE"
    ? "text-primary border-primary/25 bg-primary/[0.06]"
    : status === "REPLAY"
      ? "text-warning border-warning/25 bg-warning/[0.06]"
      : "text-muted border-border bg-surface";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary">
            <Layers3 className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[9px] font-semibold">Kwant Steps</div>
            <div className="text-[6px] uppercase tracking-[0.12em] text-muted">NQ-mapped gamma ladder</div>
          </div>
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
        <KwantSelect
          value={expiryScope}
          onChange={(event) => setExpiryScope(event.target.value as ExpiryScope)}
          menuLabel="Expiry scope"
          className="h-8 min-w-24 rounded-xl border border-border bg-surface px-2.5 text-[8px]"
        >
          <option value="ALL">Full chain</option>
          <option value="0DTE">0DTE</option>
          <option value="1DTE">1DTE</option>
        </KwantSelect>
        <KwantSelect
          value={layerMode}
          onChange={(event) => setLayerMode(event.target.value as LayerMode)}
          menuLabel="Gamma layer"
          className="h-8 min-w-28 rounded-xl border border-border bg-surface px-2.5 text-[8px]"
        >
          <option value="BOTH">OI + volume</option>
          <option value="OI">Open interest</option>
          <option value="VOLUME">Session volume</option>
        </KwantSelect>
        <div className="ml-auto flex items-center gap-2">
          <span className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[7px] font-semibold ${statusTone}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === "LIVE" ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : status === "REPLAY" ? "bg-warning" : "bg-muted"}`} />
            {status}
          </span>
          <span className="hidden h-8 items-center rounded-xl border border-border bg-surface px-2.5 font-mono text-[7px] text-muted sm:flex">
            {timestampLabel(selectedTimestamp ?? Date.parse(payload.asOf))} ET
          </span>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
        <div className="bg-panel px-3 py-2">
          <div className="text-[5px] uppercase tracking-[0.12em] text-muted">NQ price</div>
          <div className="mt-1 font-mono text-[9px] font-semibold">{formatPrice(referencePrice)}</div>
        </div>
        <div className="bg-panel px-3 py-2">
          <div className="text-[5px] uppercase tracking-[0.12em] text-muted">Call wall</div>
          <div className="mt-1 font-mono text-[9px] font-semibold text-primary">{formatPrice(callWall?.price ?? null)}</div>
        </div>
        <div className="bg-panel px-3 py-2">
          <div className="text-[5px] uppercase tracking-[0.12em] text-muted">Put wall</div>
          <div className="mt-1 font-mono text-[9px] font-semibold text-accent">{formatPrice(putWall?.price ?? null)}</div>
        </div>
        <div className="bg-panel px-3 py-2">
          <div className="text-[5px] uppercase tracking-[0.12em] text-muted">Zero gamma</div>
          <div className="mt-1 font-mono text-[9px] font-semibold">{formatPrice(zeroGamma)}</div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {!visibleRows.length ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Activity className="mx-auto h-5 w-5 text-muted" />
              <div className="mt-3 text-[8px] font-semibold">No gamma strikes are available for this scope</div>
            </div>
          </div>
        ) : (
          <svg
            className="h-full w-full"
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Kwant Steps gamma exposure ladder with puts left and calls right"
          >
            <defs>
              <linearGradient id="kwant-steps-put" x1="1" x2="0">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.28" />
              </linearGradient>
              <linearGradient id="kwant-steps-call" x1="0" x2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.28" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="var(--background)" />
            <text x="305" y="24" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="600">NEGATIVE / PUT GEX</text>
            <text x="600" y="24" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="600">NQ STRIKE</text>
            <text x="895" y="24" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="600">POSITIVE / CALL GEX</text>
            <line x1={PUT_ZERO} x2={PUT_ZERO} y1={PLOT_TOP - 10} y2={PLOT_BOTTOM + 5} stroke="var(--border)" strokeWidth="1" />
            <line x1={CALL_ZERO} x2={CALL_ZERO} y1={PLOT_TOP - 10} y2={PLOT_BOTTOM + 5} stroke="var(--border)" strokeWidth="1" />

            {visibleRows.map((row, index) => {
              const y = PLOT_TOP + (index + 0.5) * rowHeight;
              const oiPutWidth = layerMode === "VOLUME" ? 0 : Math.abs(row.putOi) / maximum * SIDE_WIDTH;
              const oiCallWidth = layerMode === "VOLUME" ? 0 : Math.abs(row.callOi) / maximum * SIDE_WIDTH;
              const volumePutWidth = layerMode === "OI" ? 0 : Math.abs(row.putVolume) / maximum * SIDE_WIDTH;
              const volumeCallWidth = layerMode === "OI" ? 0 : Math.abs(row.callVolume) / maximum * SIDE_WIDTH;
              const major = row.price === callWall?.price || row.price === putWall?.price;
              return (
                <g key={row.price}>
                  <line x1="56" x2="1144" y1={y + rowHeight / 2} y2={y + rowHeight / 2} stroke="var(--border)" strokeOpacity="0.28" strokeWidth="1" />
                  {oiPutWidth > 0 ? <rect x={PUT_ZERO - oiPutWidth} y={y - rowHeight * 0.31} width={oiPutWidth} height={Math.max(2, rowHeight * 0.62)} rx="2" fill="var(--accent)" fillOpacity="0.18" stroke="var(--accent)" strokeOpacity="0.38" /> : null}
                  {oiCallWidth > 0 ? <rect x={CALL_ZERO} y={y - rowHeight * 0.31} width={oiCallWidth} height={Math.max(2, rowHeight * 0.62)} rx="2" fill="var(--primary)" fillOpacity="0.18" stroke="var(--primary)" strokeOpacity="0.38" /> : null}
                  {volumePutWidth > 0 ? <rect x={PUT_ZERO - volumePutWidth} y={y - rowHeight * 0.16} width={volumePutWidth} height={Math.max(2, rowHeight * 0.32)} rx="2" fill="url(#kwant-steps-put)" /> : null}
                  {volumeCallWidth > 0 ? <rect x={CALL_ZERO} y={y - rowHeight * 0.16} width={volumeCallWidth} height={Math.max(2, rowHeight * 0.32)} rx="2" fill="url(#kwant-steps-call)" /> : null}
                  {lookbacks.map((lookbackIndex, dotIndex) => {
                    const call = Math.abs(row.historicalCall[lookbackIndex] ?? 0);
                    const put = Math.abs(row.historicalPut[lookbackIndex] ?? 0);
                    const opacity = 0.25 + dotIndex * 0.18;
                    return (
                      <g key={`${row.price}:${lookbackIndex}:${dotIndex}`}>
                        {put > 0 ? <circle cx={PUT_ZERO - put / maximum * SIDE_WIDTH} cy={y} r="2.2" fill="var(--foreground)" opacity={opacity} /> : null}
                        {call > 0 ? <circle cx={CALL_ZERO + call / maximum * SIDE_WIDTH} cy={y} r="2.2" fill="var(--foreground)" opacity={opacity} /> : null}
                      </g>
                    );
                  })}
                  <rect x="555" y={y - rowHeight * 0.4} width="90" height={Math.max(8, rowHeight * 0.8)} rx="4" fill={major ? "var(--surface)" : "var(--background)"} stroke={major ? "var(--primary)" : "var(--border)"} strokeOpacity={major ? 0.55 : 0.35} />
                  <text x="600" y={y + 3} textAnchor="middle" fill={major ? "var(--foreground)" : "var(--muted)"} fontSize="9" fontFamily="monospace" fontWeight={major ? "700" : "500"}>{formatPrice(row.price)}</text>
                  <title>{`${formatPrice(row.price)} · Call OI GEX ${compact(row.callOi)} · Put OI GEX ${compact(row.putOi)} · Call volume GEX ${compact(row.callVolume)} · Put volume GEX ${compact(row.putVolume)}`}</title>
                </g>
              );
            })}

            {priceTracePoints ? <polyline points={priceTracePoints} fill="none" stroke="var(--foreground)" strokeOpacity="0.42" strokeWidth="1.4" vectorEffect="non-scaling-stroke" /> : null}
            {zeroGamma !== null ? (
              <g>
                <line x1="56" x2="1144" y1={yForPrice(zeroGamma)} y2={yForPrice(zeroGamma)} stroke="var(--foreground)" strokeOpacity="0.38" strokeDasharray="4 5" />
                <text x="70" y={yForPrice(zeroGamma) - 5} fill="var(--muted)" fontSize="7" fontWeight="600">ZERO GAMMA · {formatPrice(zeroGamma)}</text>
              </g>
            ) : null}
            <g className={status === "LIVE" ? "gexdesk-live-price" : ""}>
              <line x1="46" x2="1154" y1={yForPrice(referencePrice)} y2={yForPrice(referencePrice)} stroke="var(--foreground)" strokeWidth="1.3" />
              <rect x="1027" y={yForPrice(referencePrice) - 11} width="127" height="22" rx="6" fill="var(--primary)" />
              <text x="1090" y={yForPrice(referencePrice) + 3.5} textAnchor="middle" fill="var(--background)" fontSize="9" fontFamily="monospace" fontWeight="700">NQ {formatPrice(referencePrice)}</text>
            </g>
          </svg>
        )}
        {historyLoading ? (
          <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-lg border border-border bg-background/85 px-2.5 py-1.5 text-[6px] text-muted backdrop-blur-md">
            <Radio className="h-3 w-3 animate-pulse text-primary" />Updating session history
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border bg-panel px-3 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!historySupported) return;
              if (selectedIndex >= latestIndex) setSelectedIndex(0);
              followLatestRef.current = false;
              setPlaying((current) => !current);
            }}
            disabled={!historySupported || !history?.timestamps.length}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:text-primary disabled:opacity-35"
            title={playing ? "Pause playback" : "Play session"}
          >
            {playing ? <CirclePause className="h-3.5 w-3.5" /> : <CirclePlay className="h-3.5 w-3.5" />}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted" />
            <input
              type="range"
              min={0}
              max={latestIndex}
              value={Math.min(selectedIndex, latestIndex)}
              onChange={(event) => {
                const next = Number(event.target.value);
                followLatestRef.current = next >= latestIndex;
                setSelectedIndex(next);
                setPlaying(false);
              }}
              disabled={!historySupported || !history?.timestamps.length}
              className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--primary)] disabled:opacity-35"
              aria-label="Kwant Steps session playback"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-[7px] text-muted">{timestampLabel(selectedTimestamp)} ET</span>
            <button
              type="button"
              onClick={() => {
                followLatestRef.current = true;
                setSelectedIndex(latestIndex);
                setPlaying(false);
              }}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-[6px] font-semibold text-muted hover:text-primary"
            >
              Latest
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[6px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-full border border-primary/40 bg-primary/15" />Open-interest GEX</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-full bg-primary" />Session-volume GEX estimate</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-foreground/60" />Front-expiry readings · 30m / 15m / 5m / 1m</span>
          <span className="ml-auto flex items-center gap-1.5"><BarChart3 className="h-3 w-3" />Options positioning · CME NQ mapping</span>
        </div>
        {!historySupported ? <div className="mt-1 text-[6px] text-muted">1DTE shows the current structural profile; intraday replay is available for the front expiry.</div> : null}
        {historyError ? <div className="mt-1 text-[6px] text-warning">Playback history: {historyError}</div> : null}
      </div>
    </div>
  );
}
