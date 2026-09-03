"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Braces,
  CircleGauge,
  Crosshair,
  Info,
  Radio,
  Sparkles,
  Waves,
} from "lucide-react";
import type {
  ExposureStrike,
  GreekMode,
  IntradayExposureSeries,
  OptionsFlowPayload,
  OptionsPositioningPulsePayload,
  PremiumDriftPoint,
} from "@/lib/optionsFlow";
import {
  fetchPositioningPulse,
  readPositioningPulse,
  subscribePositioningPulse,
} from "@/lib/liveExposureFlowClient";

const MODE_META: Record<GreekMode, { short: string; title: string; detail: string }> = {
  GAMMA: { short: "GEX", title: "Net gamma", detail: "Dealer-signed gamma exposure" },
  DELTA: { short: "DEX", title: "Delta inventory", detail: "Dealer-signed directional exposure" },
  VANNA: { short: "VEX", title: "Vanna pressure", detail: "Delta sensitivity to implied volatility" },
  CHARM: { short: "CHEX", title: "Charm pressure", detail: "Delta sensitivity to time decay" },
};

function formatCompact(value: number | null, currency = false) {
  if (value === null || !Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const prefix = currency ? "$" : "";
  if (absolute >= 1_000_000_000) return `${sign}${prefix}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${prefix}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${prefix}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${prefix}${absolute.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}

function formatPrice(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatExpiry(value: string | null) {
  if (!value) return "No front expiry";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function nearestStrike(strikes: ExposureStrike[], spot: number | null) {
  if (!strikes.length || spot === null) return null;
  return strikes.reduce((best, row) => Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best).strike;
}

function StructureLadder({ data }: { data: OptionsFlowPayload }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const series = data.positioning.history.GAMMA;
  const strikes = useMemo(() => [...(series?.latestStrikes ?? [])].sort((a, b) => b.strike - a.strike), [series]);
  const spotStrike = nearestStrike(strikes, data.stockPrice);
  const skew = useMemo(() => new Map(data.positioning.volatilitySkew.map((row) => [row.strike, row])), [data.positioning.volatilitySkew]);
  const lookbacks = useMemo(() => (series?.lookbacks ?? []).map((lookback) => ({
    minutes: lookback.minutes,
    strikes: new Map(lookback.strikes.map((row) => [row.strike, row])),
  })), [series]);
  const maximum = Math.max(1, ...strikes.flatMap((row) => [Math.abs(row.call), Math.abs(row.put)]));

  useEffect(() => {
    const container = scrollRef.current;
    const target = container?.querySelector<HTMLElement>("[data-positioning-spot='true']");
    if (!container || !target) return;
    container.scrollTop = Math.max(0, target.offsetTop - container.offsetTop - container.clientHeight / 2 + target.clientHeight / 2);
  }, [spotStrike]);

  if (!series || !strikes.length) {
    return <div className="flex h-[520px] items-center justify-center text-[12px] text-muted">Front-expiry GEX history is unavailable</div>;
  }

  const positiveStrike = data.positioning.majorPositiveGamma?.strike ?? null;
  const negativeStrike = data.positioning.majorNegativeGamma?.strike ?? null;
  const dotColors = ["var(--muted)", "var(--accent)", "var(--secondary)"];

  return (
    <div ref={scrollRef} className="h-[520px] overflow-y-auto px-4 pb-4">
      <div className="sticky top-0 z-20 grid grid-cols-[minmax(120px,1fr)_82px_minmax(120px,1fr)_84px] items-center border-b border-border bg-panel py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
        <span className="text-right">Put GEX</span>
        <span className="text-center">Strike</span>
        <span>Call GEX</span>
        <span className="text-right">IV skew</span>
      </div>
      <div className="space-y-[2px] pt-2">
        {strikes.map((row) => {
          const nearSpot = row.strike === spotStrike;
          const isPositiveMajor = row.strike === positiveStrike;
          const isNegativeMajor = row.strike === negativeStrike;
          const iv = skew.get(row.strike);
          return (
            <div
              key={row.strike}
              data-positioning-spot={nearSpot ? "true" : undefined}
              className={`group grid h-[28px] grid-cols-[minmax(120px,1fr)_82px_minmax(120px,1fr)_84px] items-center rounded-md transition-colors ${nearSpot ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/15" : "hover:bg-surface/60"}`}
            >
              <div className="relative flex h-3.5 justify-end border-r border-border/80">
                <div className="h-full rounded-l-sm bg-danger/75" style={{ width: `${Math.max(1, Math.abs(row.put) / maximum * 100)}%` }} />
                {lookbacks.map((lookback, index) => {
                  const value = Math.abs(lookback.strikes.get(row.strike)?.put ?? 0);
                  return value ? <span key={lookback.minutes} className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ring-1 ring-panel" style={{ right: `${value / maximum * 100}%`, background: dotColors[index] }} title={`${lookback.minutes}m lookback · ${formatCompact(value)}`} /> : null;
                })}
              </div>
              <div className="relative flex items-center justify-center gap-1 px-1">
                <span className={`font-mono text-[10px] ${nearSpot ? "font-semibold text-primary" : "text-foreground"}`}>{row.strike.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                {isPositiveMajor ? <span className="rounded bg-primary/10 px-1 py-0.5 text-[7px] font-bold text-primary">+G</span> : null}
                {isNegativeMajor ? <span className="rounded bg-danger/10 px-1 py-0.5 text-[7px] font-bold text-danger">−G</span> : null}
              </div>
              <div className="relative flex h-3.5 border-l border-border/80">
                <div className="h-full rounded-r-sm bg-primary/75" style={{ width: `${Math.max(1, Math.abs(row.call) / maximum * 100)}%` }} />
                {lookbacks.map((lookback, index) => {
                  const value = Math.abs(lookback.strikes.get(row.strike)?.call ?? 0);
                  return value ? <span key={lookback.minutes} className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ring-1 ring-panel" style={{ left: `${value / maximum * 100}%`, background: dotColors[index] }} title={`${lookback.minutes}m lookback · ${formatCompact(value)}`} /> : null;
                })}
              </div>
              <div className="flex items-center justify-end gap-1.5 pr-1 font-mono text-[8px]">
                <span className="text-primary">{iv?.callIv === null || iv?.callIv === undefined ? "—" : `${(iv.callIv * 100).toFixed(0)}c`}</span>
                <span className="text-danger">{iv?.putIv === null || iv?.putIv === undefined ? "—" : `${(iv.putIv * 100).toFixed(0)}p`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChangeTable({ data }: { data: OptionsFlowPayload }) {
  return (
    <div className="h-full overflow-hidden rounded-xl border border-border bg-surface/35">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Activity className="h-3.5 w-3.5 text-accent" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">Largest GEX change</span>
        <span className="ml-auto rounded-md bg-accent/10 px-1.5 py-0.5 text-[8px] font-semibold text-accent">LIVE</span>
      </div>
      <div className="grid grid-cols-[42px_1fr_88px] border-b border-border px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>Window</span><span>Strike / state</span><span className="text-right">Δ GEX</span>
      </div>
      {data.positioning.gammaChange.length ? data.positioning.gammaChange.map((row) => {
        const positive = row.change >= 0;
        return (
          <div key={row.minutes} className="grid grid-cols-[42px_1fr_88px] items-center border-b border-border/70 px-3 py-2.5 text-[9px] last:border-0">
            <span className="font-mono text-muted">{row.minutes}m</span>
            <span className="min-w-0">
              <span className="block font-mono font-semibold text-foreground">{formatPrice(row.strike)}</span>
              <span className={`block truncate text-[8px] ${positive ? "text-primary" : "text-danger"}`}>{row.state.replaceAll("_", " ")}</span>
            </span>
            <span className={`text-right font-mono font-semibold ${positive ? "text-primary" : "text-danger"}`}>{formatCompact(row.change, true)}</span>
          </div>
        );
      }) : <div className="px-3 py-8 text-center text-[10px] text-muted">Change history unavailable</div>}
    </div>
  );
}

function StateLadder({ data }: { data: OptionsFlowPayload }) {
  const mode: GreekMode = "GAMMA";
  const series = data.positioning.history[mode];
  const rows = useMemo(() => [...(series?.latestStrikes ?? [])]
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, 14)
    .sort((a, b) => b.strike - a.strike), [series]);
  const maximum = Math.max(1, ...rows.map((row) => Math.abs(row.net)));
  const near = nearestStrike(rows, data.stockPrice);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface/25">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <Crosshair className="h-3.5 w-3.5 text-primary" />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">State map</div>
          <div className="mt-0.5 text-[8px] text-muted">Highest-concentration front-expiry nodes</div>
        </div>
        <span className="ml-auto rounded-md border border-primary/20 bg-primary/[0.07] px-2 py-1 font-mono text-[8px] font-semibold text-primary">GEX STATE</span>
      </div>
      <div className="grid grid-cols-[72px_1fr_92px] border-b border-border px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>Strike</span><span>Concentration</span><span className="text-right">State</span>
      </div>
      <div className="min-h-[390px] flex-1">
        {rows.length ? rows.map((row) => {
          const positive = row.net >= 0;
          const width = Math.max(2, Math.abs(row.net) / maximum * 50);
          const gammaState = positive ? "STABILISING" : "ACCELERATING";
          const genericState = positive ? "POSITIVE" : "NEGATIVE";
          return (
            <div key={row.strike} className={`grid h-[28px] grid-cols-[72px_1fr_92px] items-center border-b border-border/50 px-3 ${row.strike === near ? "bg-primary/[0.07]" : "hover:bg-surface/50"}`}>
              <span className={`font-mono text-[9px] ${row.strike === near ? "font-semibold text-primary" : "text-foreground"}`}>{row.strike.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
              <span className="relative flex h-2 items-center">
                <span className="absolute left-1/2 h-3 w-px bg-border" />
                <span className={`absolute h-2 rounded-sm ${positive ? "left-1/2 bg-primary/80" : "right-1/2 bg-danger/80"}`} style={{ width: `${width}%` }} />
              </span>
              <span className={`text-right text-[8px] font-semibold ${positive ? "text-primary" : "text-danger"}`}>{mode === "GAMMA" ? gammaState : genericState}</span>
            </div>
          );
        }) : <div className="flex h-[390px] items-center justify-center text-[10px] text-muted">{MODE_META[mode].short} state unavailable</div>}
      </div>
      <div className="border-t border-border px-3 py-2 text-[9px] leading-4 text-muted"><span className="font-semibold text-foreground">{MODE_META[mode].title}:</span> {MODE_META[mode].detail}. Gamma state names describe expected hedging behavior, not a guaranteed support or resistance signal.</div>
    </div>
  );
}

function DemandPanel({ data }: { data: OptionsFlowPayload }) {
  const premium = data.positioning.tradeSidePremium;
  if (!premium) return <div className="flex h-full min-h-[460px] items-center justify-center rounded-xl border border-border bg-surface/25 text-[10px] text-muted">Trade-side premium is unavailable</div>;
  const longShare = premium.longShare ?? 0.5;
  const state = longShare >= 0.55 ? "VOLATILITY BID" : longShare <= 0.45 ? "VOLATILITY OFFERED" : "BALANCED DEMAND";
  const gammaNet = data.positioning.history.GAMMA?.points.at(-1)?.net ?? 0;
  const composite = gammaNet < 0 && longShare >= 0.55
    ? "EXPANSION PRESSURE"
    : gammaNet > 0 && longShare <= 0.45
      ? "COMPRESSION SUPPORTED"
      : "MIXED / TRANSITION";
  const totalCall = premium.callBought + premium.callSold;
  const totalPut = premium.putBought + premium.putSold;

  return (
    <div className="h-full overflow-hidden rounded-xl border border-border bg-surface/25">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <CircleGauge className="h-3.5 w-3.5 text-accent" />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">Options demand regime</div>
          <div className="mt-0.5 text-[8px] text-muted">At/through bid and ask · front expiry</div>
        </div>
        <span className="ml-auto rounded-md border border-amber-400/20 bg-amber-400/[0.08] px-1.5 py-1 text-[8px] font-semibold text-amber-300">KWANT DATA MODEL</span>
      </div>
      <div className="p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-muted">Aggressor read</div>
            <div className={`mt-1 text-[17px] font-semibold ${state === "VOLATILITY BID" ? "text-accent" : state === "VOLATILITY OFFERED" ? "text-primary" : "text-foreground"}`}>{state}</div>
          </div>
          <div className="text-right font-mono text-[20px] font-semibold text-foreground">{(longShare * 100).toFixed(1)}%</div>
        </div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-panel ring-1 ring-border">
          <span className="bg-accent" style={{ width: `${longShare * 100}%` }} />
          <span className="bg-secondary" style={{ width: `${(1 - longShare) * 100}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[8px] font-semibold uppercase tracking-[0.1em] text-muted"><span>Options bought</span><span>Options sold</span></div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {[
            ["Calls bought", premium.callBought, totalCall ? premium.callBought / totalCall : 0, "text-primary"],
            ["Calls sold", premium.callSold, totalCall ? premium.callSold / totalCall : 0, "text-secondary"],
            ["Puts bought", premium.putBought, totalPut ? premium.putBought / totalPut : 0, "text-danger"],
            ["Puts sold", premium.putSold, totalPut ? premium.putSold / totalPut : 0, "text-accent"],
          ].map(([label, value, share, tone]) => (
            <div key={String(label)} className="rounded-lg border border-border bg-panel p-3">
              <div className="text-[8px] uppercase tracking-[0.1em] text-muted">{label}</div>
              <div className={`mt-1 font-mono text-[12px] font-semibold ${tone}`}>{formatCompact(Number(value), true)}</div>
              <div className="mt-0.5 font-mono text-[8px] text-muted">{(Number(share) * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-border bg-panel p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Kwantify composite</span>
            <span className={`text-[9px] font-semibold ${composite === "EXPANSION PRESSURE" ? "text-danger" : composite === "COMPRESSION SUPPORTED" ? "text-primary" : "text-accent"}`}>{composite}</span>
          </div>
          <div className="mt-2 text-[9px] leading-4 text-muted">Combines dealer-signed net GEX with option buy/sell premium. This is a transparent regime inference, not a trade recommendation.</div>
        </div>
      </div>
    </div>
  );
}

function nearestPrice(points: PremiumDriftPoint[], timestamp: number) {
  if (!points.length) return null;
  let best = points[0];
  for (const point of points) {
    if (Math.abs(point.timestamp - timestamp) < Math.abs(best.timestamp - timestamp)) best = point;
  }
  return best.stockPrice;
}

function ExposureFlowChart({ series, drift }: { series: IntradayExposureSeries | null; drift: PremiumDriftPoint[] }) {
  const geometry = useMemo(() => {
    const width = 980;
    const height = 330;
    const left = 52;
    const right = 58;
    const top = 24;
    const bottom = 34;
    const points = series?.points ?? [];
    if (points.length < 2) return { width, height, paths: { call: "", put: "", net: "", price: "" }, ticks: [] as Array<{ x: number; label: string }>, labels: [] as Array<{ y: number; label: string }>, priceLabels: [] as Array<{ y: number; label: string }> };
    const values = points.flatMap((point) => [point.call, point.put, point.net]);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const span = Math.max(1, max - min);
    const prices = points.map((point) => nearestPrice(drift, point.timestamp)).filter((value): value is number => value !== null);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 1;
    const priceSpan = Math.max(0.01, maxPrice - minPrice);
    const x = (index: number) => left + index / (points.length - 1) * (width - left - right);
    const y = (value: number) => top + (max - value) / span * (height - top - bottom);
    const priceY = (value: number) => top + (maxPrice - value) / priceSpan * (height - top - bottom);
    const path = (key: "call" | "put" | "net") => points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(" ");
    const pricePath = points.flatMap((point, index) => {
      const price = nearestPrice(drift, point.timestamp);
      return price === null ? [] : [`${index ? "L" : "M"}${x(index).toFixed(1)},${priceY(price).toFixed(1)}`];
    }).join(" ");
    const tickIndexes = [0, .25, .5, .75, 1].map((ratio) => Math.round((points.length - 1) * ratio));
    return {
      width,
      height,
      paths: { call: path("call"), put: path("put"), net: path("net"), price: pricePath },
      ticks: tickIndexes.map((index) => ({ x: x(index), label: new Date(points[index].timestamp).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) })),
      labels: [max, (max + min) / 2, min].map((value) => ({ y: y(value), label: formatCompact(value) })),
      priceLabels: prices.length ? [maxPrice, minPrice].map((value) => ({ y: priceY(value), label: value.toLocaleString("en-US", { maximumFractionDigits: 1 }) })) : [],
    };
  }, [drift, series]);

  if (!series || series.points.length < 2) return <div className="flex min-h-[330px] flex-1 items-center justify-center text-[10px] text-muted">Intraday exposure history is unavailable</div>;
  const latest = series.points.at(-1)!;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px]">
        <span className="flex items-center gap-1.5 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Call {formatCompact(latest.call, true)}</span>
        <span className="flex items-center gap-1.5 text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" />Put {formatCompact(latest.put, true)}</span>
        <span className="flex items-center gap-1.5 text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Net {formatCompact(latest.net, true)}</span>
        <span className="flex items-center gap-1.5 text-foreground"><span className="h-px w-3 bg-foreground" />Spot</span>
      </div>
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} className="min-h-[330px] flex-1 w-full" preserveAspectRatio="none" role="img" aria-label={`${MODE_META[series.mode].title} intraday history with spot`}>
        {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1="52" x2={geometry.width - 58} y1={24 + ratio * (geometry.height - 58)} y2={24 + ratio * (geometry.height - 58)} stroke="var(--grid-color)" strokeWidth="1" />)}
        {geometry.ticks.map((tick) => <g key={tick.x}><line x1={tick.x} x2={tick.x} y1="24" y2={geometry.height - 34} stroke="var(--grid-color)" strokeWidth="1" /><text x={tick.x} y={geometry.height - 10} textAnchor="middle" fill="var(--muted)" fontSize="9">{tick.label}</text></g>)}
        {geometry.labels.map((label) => <text key={`${label.y}-${label.label}`} x="48" y={label.y + 3} textAnchor="end" fill="var(--muted)" fontSize="9">{label.label}</text>)}
        {geometry.priceLabels.map((label) => <text key={`${label.y}-${label.label}`} x={geometry.width - 54} y={label.y + 3} fill="var(--muted)" fontSize="9">{label.label}</text>)}
        <path d={geometry.paths.call} fill="none" stroke="var(--primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={geometry.paths.put} fill="none" stroke="var(--danger)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={geometry.paths.net} fill="none" stroke="var(--accent)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
        <path d={geometry.paths.price} fill="none" stroke="var(--foreground)" strokeOpacity="0.72" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function mergeExposureSeries(
  current: IntradayExposureSeries | null,
  incoming: IntradayExposureSeries | null,
) {
  if (!incoming) return current;
  if (
    !current
    || current.mode !== incoming.mode
    || current.expiration !== incoming.expiration
  ) {
    return incoming;
  }
  const points = new Map(current.points.map((point) => [point.timestamp, point]));
  incoming.points.forEach((point) => points.set(point.timestamp, point));
  return {
    ...incoming,
    points: [...points.values()]
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(-420),
    latestStrikes: incoming.latestStrikes.length
      ? incoming.latestStrikes
      : current.latestStrikes,
    lookbacks: incoming.lookbacks.length ? incoming.lookbacks : current.lookbacks,
  };
}

type ExposureLiveStatus = "CONNECTING" | "LIVE" | "DELAYED" | "WAITING" | "LAST_SESSION" | "RECONNECTING";

function FlowView({ data }: { data: OptionsFlowPayload }) {
  const [mode, setMode] = useState<GreekMode>("GAMMA");
  const baseSeries = data.positioning.history[mode];
  const [series, setSeries] = useState<IntradayExposureSeries | null>(baseSeries);
  const [liveStatus, setLiveStatus] = useState<ExposureLiveStatus>(
    data.session.marketOpen ? "CONNECTING" : "LAST_SESSION",
  );
  const [lastProviderUpdate, setLastProviderUpdate] = useState<string | null>(
    baseSeries?.points.length
      ? new Date(baseSeries.points.at(-1)!.timestamp).toISOString()
      : null,
  );

  useEffect(() => {
    setSeries((current) => mergeExposureSeries(current, baseSeries));
    if (baseSeries?.points.length) {
      const incomingUpdate = new Date(baseSeries.points.at(-1)!.timestamp).toISOString();
      setLastProviderUpdate((current) =>
        current && Date.parse(current) > Date.parse(incomingUpdate)
          ? current
          : incomingUpdate);
    }
  }, [baseSeries]);

  useEffect(() => {
    const expiration = data.positioning.expiration;
    if (!expiration) {
      setLiveStatus("WAITING");
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let polling = false;
    const strikeRange = data.positioning.strikeRange;
    const request = {
      symbol: data.symbol,
      mode,
      expiration,
      strikeRange,
    };
    const cached = readPositioningPulse(request);
    setSeries((current) => mergeExposureSeries(current, cached?.series ?? data.positioning.history[mode]));
    setLiveStatus(cached?.status ?? (data.session.marketOpen ? "CONNECTING" : "LAST_SESSION"));
    if (cached?.asOf) setLastProviderUpdate(cached.asOf);

    const poll = async () => {
      if (polling || cancelled) return;
      polling = true;
      let nextDelay = data.session.marketOpen ? 5_000 : 60_000;
      try {
        const payload = await fetchPositioningPulse(request);
        if (
          cancelled
          || payload.symbol !== data.symbol
          || payload.mode !== mode
          || payload.expiration !== expiration
        ) {
          return;
        }
        setSeries((current) => mergeExposureSeries(current, payload.series));
        setLastProviderUpdate(payload.asOf);
        setLiveStatus(payload.status);
        nextDelay = Math.max(5_000, payload.refreshAfterMs);
      } catch (error) {
        if (cancelled) return;
        const waitingForFirstBucket =
          error instanceof Error
          && error.message.toLowerCase().includes("first completed one-minute bucket");
        setLiveStatus(waitingForFirstBucket ? "WAITING" : "RECONNECTING");
      } finally {
        polling = false;
        if (!cancelled) timer = window.setTimeout(() => void poll(), nextDelay);
      }
    };

    const unsubscribe = subscribePositioningPulse(request, (payload) => {
      if (cancelled) return;
      setSeries((current) => mergeExposureSeries(current, payload.series));
      setLastProviderUpdate(payload.asOf);
      setLiveStatus(payload.status);
    });
    const refreshVisible = () => {
      if (document.visibilityState !== "visible" || polling) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      void poll();
    };

    timer = window.setTimeout(() => void poll(), 25);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [
    data.positioning.expiration,
    data.positioning.strikeRange?.max,
    data.positioning.strikeRange?.min,
    data.session.marketOpen,
    data.symbol,
    mode,
  ]);

  const latest = series?.points.at(-1) ?? null;
  const first = series?.points[0] ?? null;
  const change = latest && first ? latest.net - first.net : null;
  const liveLabel = liveStatus === "LAST_SESSION"
    ? "LAST SESSION"
    : liveStatus === "RECONNECTING"
      ? "RECONNECTING"
      : liveStatus === "WAITING"
        ? "WAITING FOR 1M"
        : liveStatus;
  const liveTone = liveStatus === "LIVE"
    ? "border-primary/20 bg-primary/10 text-primary"
    : liveStatus === "RECONNECTING" || liveStatus === "DELAYED"
      ? "border-danger/20 bg-danger/10 text-danger"
      : "border-border bg-panel text-muted";

  return (
    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-[568px]">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface/25">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          <Waves className="h-3.5 w-3.5 text-primary" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">Flow regime</div>
            <div className="mt-0.5 text-[8px] text-muted">Session baseline + live one-minute front-expiry buckets · price overlay</div>
          </div>
          <span className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[7px] font-semibold ${liveTone}`}>
            <Radio className={`h-2.5 w-2.5 ${liveStatus === "LIVE" ? "animate-pulse" : ""}`} />
            {liveLabel}
          </span>
          <div className="ml-auto flex rounded-lg border border-border bg-panel p-0.5">
            {(Object.keys(MODE_META) as GreekMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-md px-2.5 py-1 text-[8px] font-semibold ${mode === item ? "bg-primary text-on-primary" : "text-muted hover:text-foreground"}`}>{MODE_META[item].short}</button>)}
          </div>
        </div>
        <ExposureFlowChart series={series} drift={data.drift} />
      </div>
      <div className="grid h-full gap-3 xl:grid-rows-3">
        <div className="rounded-xl border border-border bg-surface/25 p-4">
          <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">{MODE_META[mode].title}</div>
          <div className={`mt-2 font-mono text-[23px] font-semibold ${latest && latest.net >= 0 ? "text-primary" : "text-danger"}`}>{formatCompact(latest?.net ?? null, true)}</div>
          <div className="mt-1 text-[9px] text-muted">{MODE_META[mode].detail}</div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[9px]"><span className="text-muted">Versus opening bucket</span><span className={`font-mono font-semibold ${(change ?? 0) >= 0 ? "text-primary" : "text-danger"}`}>{formatCompact(change, true)}</span></div>
        </div>
        <div className="rounded-xl border border-border bg-surface/25 p-4">
          <div className="flex items-center gap-2"><Braces className="h-3.5 w-3.5 text-accent" /><span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-foreground">How to read it</span></div>
          <p className="mt-3 text-[9px] leading-[1.55] text-muted">Each point is the provider&apos;s completed one-minute exposure bucket. The first bucket is retained as the session baseline; new call, put and net observations are merged by provider timestamp. This identifies positioning change, not the owner or intent of an individual trade.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface/25 p-4">
          <div className="text-[8px] font-semibold uppercase tracking-[0.13em] text-muted">Coverage</div>
          <div className="mt-2 font-mono text-[12px] font-semibold text-foreground">{formatExpiry(data.positioning.expiration)}</div>
          <div className="mt-1 text-[9px] text-muted">{series?.points.length ?? 0} one-minute buckets · {series?.latestStrikes.length ?? 0} latest strike nodes</div>
          <div className="mt-2 border-t border-border pt-2 text-[8px] text-muted">
            Provider bucket {lastProviderUpdate
              ? new Date(lastProviderUpdate).toLocaleTimeString("en-AU", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "pending"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PositioningIntelligence({ data }: { data: OptionsFlowPayload }) {
  const gammaSeries = data.positioning.history.GAMMA;
  const frontCenter = useMemo(() => {
    const strikes = gammaSeries?.latestStrikes ?? [];
    const weight = strikes.reduce((sum, row) => sum + Math.abs(row.net), 0);
    return weight > 0 ? strikes.reduce((sum, row) => sum + row.strike * Math.abs(row.net), 0) / weight : null;
  }, [gammaSeries]);

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-border bg-panel">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h2 className="truncate text-[13px] font-semibold text-foreground">Positioning intelligence</h2><span className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[8px] font-semibold text-primary"><Radio className="h-2.5 w-2.5" />LIVE</span></div>
            <p className="mt-0.5 truncate text-[9px] text-muted">Strike concentration · moving Greek exposure · classified trade-side pressure</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[8px] text-muted lg:ml-auto">
          <span className="rounded-md border border-border bg-surface px-2 py-1 font-mono">1m</span>
          <span className="rounded-md border border-border bg-surface px-2 py-1 font-mono">FRONT · {formatExpiry(data.positioning.expiration)}</span>
        </div>
      </div>

      <div className="border-b border-border">
        <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-[568px]">
          <div className="h-full overflow-hidden rounded-xl border border-border bg-surface/25">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2.5">
              <div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">GEX structure</div><div className="mt-0.5 text-[8px] text-muted">Current call/put exposure with 5m, 15m and 30m lookback dots · IV skew at right</div></div>
              <div className="ml-auto flex items-center gap-3 text-[8px] text-muted"><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-muted" />5m</span><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-accent" />15m</span><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-secondary" />30m</span></div>
            </div>
            <StructureLadder data={data} />
          </div>
          <div className="grid h-full gap-3 xl:grid-rows-[auto_minmax(0,1fr)_auto]">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3"><div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-primary">Major +GEX</div><div className="mt-2 font-mono text-[14px] font-semibold text-foreground">{formatPrice(data.positioning.majorPositiveGamma?.strike ?? null)}</div><div className="mt-1 truncate font-mono text-[8px] text-primary">{formatCompact(data.positioning.majorPositiveGamma?.value ?? null, true)}</div></div>
              <div className="rounded-xl border border-danger/20 bg-danger/[0.06] p-3"><div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-danger">Major −GEX</div><div className="mt-2 font-mono text-[14px] font-semibold text-foreground">{formatPrice(data.positioning.majorNegativeGamma?.strike ?? null)}</div><div className="mt-1 truncate font-mono text-[8px] text-danger">{formatCompact(data.positioning.majorNegativeGamma?.value ?? null, true)}</div></div>
              <div className="rounded-xl border border-accent/20 bg-accent/[0.06] p-3"><div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-accent">KWANT center</div><div className="mt-2 font-mono text-[14px] font-semibold text-foreground">{formatPrice(frontCenter)}</div><div className="mt-1 truncate text-[8px] text-muted">abs-net weighted</div></div>
            </div>
            <ChangeTable data={data} />
            <div className="rounded-xl border border-border bg-surface/35 p-3">
              <div className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-muted" /><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground">Signal contract</span></div>
              <p className="mt-2 text-[9px] leading-[1.55] text-muted">Major levels and the GEX concentration centre are interpreted by Kwant Data&apos;s proprietary model using the front-expiry exposure structure and live one-minute Interval Map snapshots.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-surface/[0.06]">
        <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-[568px]"><StateLadder data={data} /><DemandPanel data={data} /></div>
      </div>

      <FlowView data={data} />

      <div className="flex flex-col gap-2 border-t border-border bg-surface/20 px-4 py-3 text-[9px] leading-4 text-muted lg:flex-row lg:items-center lg:justify-between">
        <span>{data.positioning.methodology.note}</span>
        <span className="shrink-0 font-mono">{data.positioning.methodology.exposureSource} · {data.positioning.methodology.classificationConfidence}</span>
      </div>
    </section>
  );
}
