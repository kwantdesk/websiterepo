"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleDot,
  RefreshCw,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import type {
  GexDeskHistoryPayload,
  GexDeskPayload,
  GexDeskZeroGammaPayload,
} from "@/lib/gexDesk";
import {
  fetchWorkspaceData,
  readWorkspaceData,
} from "@/lib/workspaceDataCache";

const ZERO_GAMMA_CACHE_KEY = "gexdesk:zero-gamma";
const SVG_WIDTH = 920;
const SVG_HEIGHT = 470;
const PLOT_LEFT = 62;
const PLOT_RIGHT = 882;
const PLOT_TOP = 34;
const PLOT_BOTTOM = 426;

function formatPrice(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function compactSigned(value: number) {
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

function activeGammaCentres(history: GexDeskHistoryPayload | null) {
  if (!history?.timestamps.length || !history.rows.length) return [];
  return history.timestamps.map((_, timeIndex) => {
    let weightedPrice = 0;
    let totalWeight = 0;
    for (const row of history.rows) {
      const call = row.call?.[timeIndex] ?? Math.max(0, row.net?.[timeIndex] ?? 0);
      const put = row.put?.[timeIndex] ?? Math.min(0, row.net?.[timeIndex] ?? 0);
      const weight = Math.abs(call) + Math.abs(put);
      weightedPrice += row.price * weight;
      totalWeight += weight;
    }
    return totalWeight > 0 ? weightedPrice / totalWeight : null;
  });
}

function indexAtOrBefore(timestamps: number[], target: number) {
  let index = 0;
  for (let cursor = 0; cursor < timestamps.length; cursor += 1) {
    if (timestamps[cursor] <= target) index = cursor;
    else break;
  }
  return index;
}

function linePoints(
  values: Array<number | null>,
  xForIndex: (index: number) => number,
  yForPrice: (price: number) => number,
) {
  return values.flatMap((value, index) => (
    value === null || !Number.isFinite(value)
      ? []
      : [`${xForIndex(index)},${yForPrice(value)}`]
  )).join(" ");
}

export default function ZeroGamma({
  payload,
  history,
  historyLoading,
  historyError,
  livePrice,
}: {
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  historyLoading: boolean;
  historyError: string;
  livePrice: number | null;
}) {
  const [zeroGamma, setZeroGamma] = useState<GexDeskZeroGammaPayload | null>(
    () => readWorkspaceData<GexDeskZeroGammaPayload>(ZERO_GAMMA_CACHE_KEY),
  );
  const [loading, setLoading] = useState(!zeroGamma);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetchWorkspaceData<GexDeskZeroGammaPayload>(
        ZERO_GAMMA_CACHE_KEY,
        "/api/gexdesk/zero-gamma",
        { force: true },
      );
      setZeroGamma(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Zero Gamma could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(Boolean(zeroGamma));
  }, [load]);

  useEffect(() => {
    if (!zeroGamma?.marketOpen) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load, zeroGamma?.marketOpen]);

  const centres = useMemo(() => activeGammaCentres(history), [history]);
  const spot = livePrice ?? zeroGamma?.spot ?? payload.nqPrice ?? null;
  const flip = zeroGamma?.trueGammaFlip ?? null;
  const latestCentre = centres.at(-1) ?? null;
  const latestTimestamp = history?.timestamps.at(-1);
  const fiveMinuteIndex = history?.timestamps.length && latestTimestamp
    ? indexAtOrBefore(history.timestamps, latestTimestamp - 5 * 60_000)
    : 0;
  const fiveMinuteCentre = centres[fiveMinuteIndex] ?? null;
  const sessionOpenCentre = centres.find((value) => value !== null) ?? null;
  const fiveMinuteChange = latestCentre !== null && fiveMinuteCentre !== null
    ? latestCentre - fiveMinuteCentre
    : null;
  const sessionChange = latestCentre !== null && sessionOpenCentre !== null
    ? latestCentre - sessionOpenCentre
    : null;
  const distance = spot !== null && flip !== null ? spot - flip : null;
  const regime = distance === null
    ? "UNAVAILABLE"
    : distance >= 0
      ? "POSITIVE-GAMMA-LIKE"
      : "NEGATIVE-GAMMA-LIKE";
  const direction = fiveMinuteChange === null || Math.abs(fiveMinuteChange) < 0.5
    ? "STEADY"
    : fiveMinuteChange > 0
      ? "RISING"
      : "FALLING";

  const timelineValues = useMemo(() => {
    const prices = history?.nqPrices ?? [];
    if (!prices.length) return spot === null ? [] : [spot];
    if (spot === null) return prices;
    return prices.map((price, index) => index === prices.length - 1 ? spot : price);
  }, [history?.nqPrices, spot]);
  const visiblePrices = [
    ...timelineValues,
    ...centres.filter((value): value is number => value !== null),
    ...(flip === null ? [] : [flip]),
  ].filter(Number.isFinite);
  const rawLow = visiblePrices.length ? Math.min(...visiblePrices) : 0;
  const rawHigh = visiblePrices.length ? Math.max(...visiblePrices) : 1;
  const pricePadding = Math.max(25, (rawHigh - rawLow) * 0.16);
  const priceLow = rawLow - pricePadding;
  const priceHigh = rawHigh + pricePadding;
  const xForIndex = (index: number) => PLOT_LEFT + (
    index / Math.max(1, timelineValues.length - 1)
  ) * (PLOT_RIGHT - PLOT_LEFT);
  const yForPrice = (price: number) => PLOT_TOP + (
    (priceHigh - price) / Math.max(1, priceHigh - priceLow)
  ) * (PLOT_BOTTOM - PLOT_TOP);
  const pricePoints = linePoints(timelineValues, xForIndex, yForPrice);
  const centrePoints = linePoints(centres, xForIndex, yForPrice);
  const flipY = flip === null ? null : yForPrice(flip);

  const curve = useMemo(() => {
    const source = zeroGamma?.curve ?? [];
    if (!source.length || spot === null) return source;
    const lowerBound = Math.min(spot * 0.94, (flip ?? spot) - 200);
    const upperBound = Math.max(spot * 1.06, (flip ?? spot) + 200);
    return source.filter((point) => (
      point.price >= lowerBound && point.price <= upperBound
    ));
  }, [flip, spot, zeroGamma?.curve]);
  const curveMagnitude = Math.max(1, ...curve.map((point) => Math.abs(point.netGex)));
  const curveLow = curve[0]?.price ?? 0;
  const curveHigh = curve.at(-1)?.price ?? 1;
  const curveX = (netGex: number) => 150 + netGex / curveMagnitude * 126;
  const curveY = (price: number) => 22 + (
    (curveHigh - price) / Math.max(1, curveHigh - curveLow)
  ) * 216;
  const curvePoints = curve.map((point) => `${curveX(point.netGex)},${curveY(point.price)}`).join(" ");

  if (!zeroGamma && loading) {
    return (
      <KwantLoader
        className="h-full min-h-0"
        icon={CircleDot}
        title="Opening Zero Gamma"
        detail="Repricing the native NQ options chain across hypothetical futures prices."
      />
    );
  }

  if (!zeroGamma) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-3xl border border-danger/25 bg-panel p-6 text-center">
          <Activity className="mx-auto h-6 w-6 text-danger" />
          <h2 className="mt-4 text-[12px] font-semibold">Zero Gamma could not open</h2>
          <p className="mt-2 text-[8px] leading-5 text-muted">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background"
          >
            <RefreshCw className="h-3.5 w-3.5" />Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-panel px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary">
          <CircleDot className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[9px] font-semibold">Zero Gamma</div>
          <div className="text-[6px] uppercase tracking-[0.12em] text-muted">True scenario gamma flip · NQ</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[7px] font-semibold ${
            zeroGamma.marketOpen
              ? "border-primary/25 bg-primary/[0.06] text-primary"
              : "border-border bg-surface text-muted"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${zeroGamma.marketOpen ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted"}`} />
            {zeroGamma.status}
          </span>
          <span className="hidden h-8 items-center rounded-xl border border-border bg-surface px-2.5 font-mono text-[7px] text-muted sm:flex">
            {timestampLabel(Date.parse(zeroGamma.asOf))} ET
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:text-primary disabled:opacity-40"
            title="Refresh Zero Gamma"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-5">
        <Metric label="True OI gamma flip" value={formatPrice(flip)} tone="primary" />
        <Metric label="NQ price" value={formatPrice(spot)} />
        <Metric label="Distance" value={formatPointChange(distance)} tone={distance !== null && distance >= 0 ? "primary" : "danger"} />
        <Metric label="Active centre · 5m" value={formatPointChange(fiveMinuteChange)} />
        <Metric label="Gamma-centre trend" value={direction} tone={direction === "RISING" ? "primary" : direction === "FALLING" ? "danger" : "muted"} />
      </div>

      <div className="grid min-h-0 flex-1 gap-px bg-border xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="relative min-h-[440px] overflow-hidden bg-background">
          <svg
            className="h-full w-full"
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="NQ price and active gamma centre around the true open-interest gamma flip"
          >
            <defs>
              <linearGradient id="positive-regime" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.025" />
              </linearGradient>
              <linearGradient id="negative-regime" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.025" />
                <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.12" />
              </linearGradient>
              <filter id="zero-gamma-glow" x="-20%" y="-200%" width="140%" height="500%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="var(--background)" />
            {flipY !== null ? (
              <>
                <rect x={PLOT_LEFT} y={PLOT_TOP} width={PLOT_RIGHT - PLOT_LEFT} height={Math.max(0, flipY - PLOT_TOP)} fill="url(#positive-regime)" />
                <rect x={PLOT_LEFT} y={flipY} width={PLOT_RIGHT - PLOT_LEFT} height={Math.max(0, PLOT_BOTTOM - flipY)} fill="url(#negative-regime)" />
              </>
            ) : null}
            {Array.from({ length: 6 }, (_, index) => {
              const y = PLOT_TOP + index / 5 * (PLOT_BOTTOM - PLOT_TOP);
              const price = priceHigh - index / 5 * (priceHigh - priceLow);
              return (
                <g key={index}>
                  <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke="var(--border)" strokeOpacity="0.48" />
                  <text x={PLOT_LEFT - 8} y={y + 3} textAnchor="end" fill="var(--muted)" fontSize="8" fontFamily="monospace">{formatPrice(price, 0)}</text>
                </g>
              );
            })}
            <text x={PLOT_LEFT + 12} y={PLOT_TOP + 18} fill="var(--primary)" fontSize="8" fontWeight="700">POSITIVE-GAMMA-LIKE · DAMPENING / ROTATION</text>
            <text x={PLOT_LEFT + 12} y={PLOT_BOTTOM - 12} fill="var(--danger)" fontSize="8" fontWeight="700">NEGATIVE-GAMMA-LIKE · AMPLIFICATION / MOMENTUM</text>
            {flipY !== null ? (
              <g filter="url(#zero-gamma-glow)">
                <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={flipY} y2={flipY} stroke="var(--foreground)" strokeWidth="1.5" strokeDasharray="8 5" />
                <rect x={PLOT_RIGHT - 236} y={flipY - 13} width="236" height="26" rx="7" fill="var(--foreground)" />
                <text x={PLOT_RIGHT - 118} y={flipY + 3.5} textAnchor="middle" fill="var(--background)" fontSize="8" fontFamily="monospace" fontWeight="700">
                  TRUE GAMMA FLIP · {formatPrice(flip)}
                </text>
              </g>
            ) : null}
            {centrePoints ? (
              <polyline points={centrePoints} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            ) : null}
            {pricePoints ? (
              <polyline points={pricePoints} fill="none" stroke="var(--primary)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
            ) : null}
            {spot !== null ? (
              <g className={zeroGamma.marketOpen ? "gexdesk-live-price" : ""}>
                <circle cx={PLOT_RIGHT} cy={yForPrice(spot)} r="4.5" fill="var(--primary)" stroke="var(--background)" strokeWidth="2" />
                <rect x={PLOT_RIGHT - 118} y={yForPrice(spot) - 10} width="108" height="20" rx="6" fill="var(--primary)" />
                <text x={PLOT_RIGHT - 64} y={yForPrice(spot) + 3} textAnchor="middle" fill="var(--background)" fontSize="8" fontFamily="monospace" fontWeight="700">
                  NQ {formatPrice(spot)}
                </text>
              </g>
            ) : null}
          </svg>
          <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap items-center gap-4 text-[6px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-primary" />NQ futures</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dashed border-accent" />KwantData active gamma centre</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dashed border-foreground" />True OI gamma flip</span>
          </div>
          {historyLoading ? (
            <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-lg border border-border bg-background/85 px-2.5 py-1.5 text-[6px] text-muted backdrop-blur-md">
              <Waves className="h-3 w-3 animate-pulse text-primary" />Updating active centre
            </div>
          ) : null}
        </section>

        <aside className="flex min-h-0 flex-col gap-px bg-border">
          <div className="bg-panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Gamma regime</div>
                <div className={`mt-1 text-[9px] font-semibold ${distance !== null && distance >= 0 ? "text-primary" : "text-danger"}`}>{regime}</div>
              </div>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                distance === null
                  ? "border-border bg-surface text-muted"
                  : distance >= 0
                    ? "border-primary/25 bg-primary/[0.07] text-primary"
                    : "border-danger/25 bg-danger/[0.07] text-danger"
              }`}>
                {distance === null
                  ? <ArrowRight className="h-4 w-4" />
                  : distance >= 0
                    ? <ArrowUpRight className="h-4 w-4" />
                    : <ArrowDownRight className="h-4 w-4" />}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <SmallMetric label="Session-open centre" value={formatPrice(sessionOpenCentre)} />
              <SmallMetric label="Current active centre" value={formatPrice(latestCentre)} />
              <SmallMetric label="Session change" value={formatPointChange(sessionChange)} />
              <SmallMetric label="Net structural GEX" value={compactSigned(zeroGamma.netGex)} />
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[6px] uppercase tracking-[0.14em] text-muted">Scenario curve</div>
                <div className="mt-1 text-[8px] font-semibold">NET GEX × HYPOTHETICAL NQ</div>
              </div>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <svg className="mt-3 h-[245px] w-full" viewBox="0 0 300 260" role="img" aria-label="Net gamma exposure scenario curve and zero crossing">
              <rect x="0" y="0" width="300" height="260" rx="12" fill="var(--surface)" />
              <line x1="150" x2="150" y1="18" y2="242" stroke="var(--foreground)" strokeOpacity="0.45" strokeDasharray="4 4" />
              <line x1="18" x2="282" y1="238" y2="238" stroke="var(--border)" />
              <text x="24" y="252" fill="var(--danger)" fontSize="7">NEGATIVE GEX</text>
              <text x="276" y="252" textAnchor="end" fill="var(--primary)" fontSize="7">POSITIVE GEX</text>
              {curvePoints ? <polyline points={curvePoints} fill="none" stroke="var(--primary)" strokeWidth="2" /> : null}
              {flip !== null ? (
                <g>
                  <line x1="18" x2="282" y1={curveY(flip)} y2={curveY(flip)} stroke="var(--foreground)" strokeOpacity="0.6" strokeDasharray="3 4" />
                  <circle cx="150" cy={curveY(flip)} r="5" fill="var(--foreground)" stroke="var(--background)" strokeWidth="2" />
                  <text x="158" y={curveY(flip) - 7} fill="var(--foreground)" fontSize="7" fontFamily="monospace">X {formatPrice(flip)}</text>
                </g>
              ) : null}
            </svg>
          </div>

          <div className="bg-panel p-4 text-[6px] leading-4 text-muted">
            <div className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <span>Above the flip describes a positive-gamma-like hedging regime; below describes a negative-gamma-like regime. It is a regime filter—not an automatic long, short, support or resistance signal.</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-panel px-3 py-2 text-[6px] text-muted">
        <span><strong className="text-foreground">TRUE GAMMA FLIP</strong> · included native CME NQ structural + current 0DTE OI chains · Black-76 scenario repricing · nearest interpolated zero crossing</span>
        <span className="ml-auto">Active centre · KwantData {history?.source ?? "COMBINED"} intraday gamma profile</span>
        {historyError ? <span className="w-full text-warning">Active-centre history: {historyError}</span> : null}
        {error ? <span className="w-full text-warning">True flip refresh: {error}</span> : null}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "danger" | "muted";
}) {
  const toneClass = tone === "primary"
    ? "text-primary"
    : tone === "danger"
      ? "text-danger"
      : tone === "muted"
        ? "text-muted"
        : "text-foreground";
  return (
    <div className="bg-panel px-3 py-2">
      <div className="text-[5px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[9px] font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2.5 py-2">
      <div className="text-[5px] uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="mt-1 font-mono text-[8px] font-semibold text-foreground">{value}</div>
    </div>
  );
}
