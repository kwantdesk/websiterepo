"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Flame,
  Radio,
  Waves,
} from "lucide-react";
import type { DatabentoLiveStatus } from "@/lib/chartLiveEvents";
import type {
  GexDeskHistoryPayload,
  GexDeskOptionPrint,
  GexDeskPayload,
} from "@/lib/gexDesk";

type HeatWindow = 15 | 30 | 60 | 120;
type HeatMetric = "PREMIUM" | "CONTRACTS";
type PriceTick = { price: number; delta: number; timestamp: number };
type HeatCell = {
  timestamp: number;
  price: number;
  callPremium: number;
  putPremium: number;
  callContracts: number;
  putContracts: number;
  calls: number;
  puts: number;
};
type TapeLevel = Omit<HeatCell, "timestamp">;

const PLOT_LEFT = 24;
const PLOT_RIGHT = 918;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 522;
const HEAT_WINDOWS: HeatWindow[] = [15, 30, 60, 120];

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `$${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `$${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `$${(absolute / 1_000).toFixed(1)}K`;
  return `$${absolute.toFixed(0)}`;
}

function compactContracts(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatPrice(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "--"
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function percentile(values: number[], amount: number) {
  if (!values.length) return 1;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * amount))] || 1;
}

function sideValue(cell: HeatCell | TapeLevel, side: "CALL" | "PUT", metric: HeatMetric) {
  if (metric === "CONTRACTS") {
    return side === "CALL" ? cell.callContracts : cell.putContracts;
  }
  return side === "CALL" ? cell.callPremium : cell.putPremium;
}

function aggregateTape(
  prints: GexDeskOptionPrint[],
  bucketSize: number,
  startTime: number,
) {
  const cells = new Map<string, HeatCell>();
  const levels = new Map<number, TapeLevel>();
  for (const print of prints) {
    if (print.timestamp < startTime) continue;
    const timestamp = Math.floor(print.timestamp / 60_000) * 60_000;
    const price = Math.round(print.mappedPrice / bucketSize) * bucketSize;
    const key = `${timestamp}:${price}`;
    const cell = cells.get(key) ?? {
      timestamp,
      price,
      callPremium: 0,
      putPremium: 0,
      callContracts: 0,
      putContracts: 0,
      calls: 0,
      puts: 0,
    };
    const level = levels.get(price) ?? {
      price,
      callPremium: 0,
      putPremium: 0,
      callContracts: 0,
      putContracts: 0,
      calls: 0,
      puts: 0,
    };
    const confidenceWeight = clamp(print.confidence, 0.2, 1);
    if (print.contractType === "CALL") {
      cell.callPremium += print.premium * confidenceWeight;
      cell.callContracts += print.size * confidenceWeight;
      cell.calls += 1;
      level.callPremium += print.premium * confidenceWeight;
      level.callContracts += print.size * confidenceWeight;
      level.calls += 1;
    } else {
      cell.putPremium += print.premium * confidenceWeight;
      cell.putContracts += print.size * confidenceWeight;
      cell.puts += 1;
      level.putPremium += print.premium * confidenceWeight;
      level.putContracts += print.size * confidenceWeight;
      level.puts += 1;
    }
    cells.set(key, cell);
    levels.set(price, level);
  }
  return {
    cells: [...cells.values()].sort((left, right) => left.timestamp - right.timestamp),
    levels: [...levels.values()],
  };
}

export default function GexDeskOptionsHeatmap({
  payload,
  history,
  historyLoading,
  historyError,
  livePrice,
  priceTicks,
  feedStatus,
  liveInstrument,
}: {
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  historyLoading: boolean;
  historyError: string;
  livePrice: number | null;
  priceTicks: PriceTick[];
  feedStatus: DatabentoLiveStatus;
  liveInstrument: "MNQ" | "NQ";
}) {
  const [windowMinutes, setWindowMinutes] = useState<HeatWindow>(60);
  const [metric, setMetric] = useState<HeatMetric>("PREMIUM");
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const model = useMemo(() => {
    const currentPrice = livePrice ?? payload.nqPrice;
    const latestDataTimestamp = Math.max(
      payload.optionsTape.at(-1)?.timestamp ?? 0,
      history?.timestamps.at(-1) ?? 0,
      priceTicks.at(-1)?.timestamp ?? 0,
      Date.parse(payload.asOf),
    );
    const endTime = payload.marketOpen ? Math.max(Date.now(), latestDataTimestamp) : latestDataTimestamp;
    const startTime = endTime - windowMinutes * 60_000;
    const bucketSize = currentPrice
      ? Math.max(10, Math.round((currentPrice * 0.0007) / 5) * 5)
      : 20;
    const aggregate = aggregateTape(payload.optionsTape, bucketSize, startTime);
    const activePrintPrices = aggregate.levels.map((level) => level.price);
    const center = currentPrice
      ?? activePrintPrices[Math.floor(activePrintPrices.length / 2)]
      ?? 0;
    const rawLow = activePrintPrices.length ? Math.min(...activePrintPrices, center) : center - 350;
    const rawHigh = activePrintPrices.length ? Math.max(...activePrintPrices, center) : center + 350;
    const minimumSpan = 700;
    const low = Math.floor(Math.max(center - 900, Math.min(rawLow - bucketSize, center - minimumSpan / 2)) / bucketSize) * bucketSize;
    const high = Math.ceil(Math.min(center + 900, Math.max(rawHigh + bucketSize, center + minimumSpan / 2)) / bucketSize) * bucketSize;
    const xForTime = (timestamp: number) => PLOT_LEFT + clamp(
      (timestamp - startTime) / Math.max(1, endTime - startTime),
      0,
      1,
    ) * (PLOT_RIGHT - PLOT_LEFT);
    const yForPrice = (price: number) => PLOT_TOP + (high - price) / Math.max(1, high - low) * (PLOT_BOTTOM - PLOT_TOP);

    const historicalPricePoints = history
      ? history.timestamps.map((timestamp, index) => ({
          timestamp,
          price: history.nqPrices[index],
        }))
      : [];
    const combinedPoints = [...historicalPricePoints, ...priceTicks]
      .filter((point) => (
        point.timestamp >= startTime
        && point.timestamp <= endTime
        && Number.isFinite(point.price)
        && point.price >= low - bucketSize
        && point.price <= high + bucketSize
      ))
      .sort((left, right) => left.timestamp - right.timestamp);
    const pointBuckets = new Map<number, { timestamp: number; price: number }>();
    for (const point of combinedPoints) {
      pointBuckets.set(Math.floor(point.timestamp / 5_000), point);
    }
    const pricePoints = [...pointBuckets.values()];
    const pricePath = pricePoints.map((point, index) => (
      `${index ? "L" : "M"}${xForTime(point.timestamp).toFixed(2)},${yForPrice(point.price).toFixed(2)}`
    )).join(" ");
    const sideValues = aggregate.cells.flatMap((cell) => [
      sideValue(cell, "CALL", metric),
      sideValue(cell, "PUT", metric),
    ]).filter((value) => value > 0);
    const heatCeiling = Math.max(1, percentile(sideValues, 0.94));
    const visibleLevels = aggregate.levels
      .filter((level) => level.price >= low && level.price <= high)
      .sort((left, right) => Math.abs(left.price - center) - Math.abs(right.price - center))
      .slice(0, 38)
      .sort((left, right) => right.price - left.price);
    const totalCallPremium = aggregate.levels.reduce((sum, level) => sum + level.callPremium, 0);
    const totalPutPremium = aggregate.levels.reduce((sum, level) => sum + level.putPremium, 0);
    const totalPremium = totalCallPremium + totalPutPremium;
    const hottest = [...aggregate.levels].sort((left, right) => (
      sideValue(right, "CALL", metric) + sideValue(right, "PUT", metric)
      - sideValue(left, "CALL", metric) - sideValue(left, "PUT", metric)
    ))[0] ?? null;
    return {
      currentPrice,
      startTime,
      endTime,
      bucketSize,
      low,
      high,
      xForTime,
      yForPrice,
      cells: aggregate.cells,
      levels: visibleLevels,
      pricePath,
      heatCeiling,
      totalCallPremium,
      totalPutPremium,
      totalPremium,
      hottest,
    };
  }, [history, livePrice, metric, payload, priceTicks, windowMinutes]);

  const maximumLevelValue = Math.max(
    1,
    ...model.levels.flatMap((level) => [
      sideValue(level, "CALL", metric),
      sideValue(level, "PUT", metric),
    ]),
  );
  const callShare = model.totalPremium > 0 ? model.totalCallPremium / model.totalPremium : 0.5;
  const selected = selectedPrice === null
    ? model.hottest
    : model.levels.find((level) => level.price === selectedPrice) ?? model.hottest;

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-border bg-panel">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.06] text-primary">
            <Flame className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[6px] font-semibold uppercase tracking-[0.15em] text-primary">CALL / PUT TAPE</div>
            <div className="mt-0.5 text-[10px] font-semibold">Options activity heatmap</div>
            <div className="mt-0.5 text-[7px] text-muted">NDX and QQQ prints mapped onto NQ-equivalent levels with a live {liveInstrument} price path.</div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-border bg-background p-1">
              {HEAT_WINDOWS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setWindowMinutes(minutes)}
                  className={`rounded-lg px-2.5 py-1.5 text-[7px] font-semibold transition-colors ${windowMinutes === minutes ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}
                >
                  {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl border border-border bg-background p-1">
              {(["PREMIUM", "CONTRACTS"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMetric(value)}
                  className={`rounded-lg px-2.5 py-1.5 text-[7px] font-semibold transition-colors ${metric === value ? "bg-primary/15 text-primary" : "text-muted hover:text-foreground"}`}
                >
                  {value === "PREMIUM" ? "Premium" : "Contracts"}
                </button>
              ))}
            </div>
            <span className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[6px] font-semibold ${feedStatus === "live" ? "border-primary/25 bg-primary/[0.05] text-primary" : "border-border text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${feedStatus === "live" ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted"}`} />
              {liveInstrument} {feedStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="grid min-h-[650px] xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="relative min-w-0 overflow-hidden border-b border-border bg-background xl:border-b-0 xl:border-r">
            {!payload.optionsTape.length ? (
              <div className="flex h-[650px] items-center justify-center p-6 text-center">
                <div className="max-w-sm">
                  <Waves className="mx-auto h-7 w-7 text-muted" />
                  <div className="mt-3 text-[10px] font-semibold">Waiting for mapped options prints</div>
                  <p className="mt-2 text-[7px] leading-5 text-muted">The heatmap appears from real NDX and QQQ consolidated call/put activity. No synthetic heat is drawn when the tape is unavailable.</p>
                </div>
              </div>
            ) : (
              <div className="relative h-[650px] overflow-hidden bg-[radial-gradient(circle_at_68%_42%,color-mix(in_srgb,var(--primary)_6%,transparent),transparent_42%)]">
                <svg className="h-full w-full" viewBox="0 0 1000 560" preserveAspectRatio="none" role="img" aria-label="Mapped options call and put activity heatmap with live MNQ price">
                  <defs>
                    <filter id="gexdesk-heat-glow" x="-70%" y="-70%" width="240%" height="240%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <linearGradient id="gexdesk-heat-fade" x1="0" x2="1">
                      <stop offset="0%" stopColor="var(--background)" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="var(--background)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="1000" height="560" fill="var(--background)" />
                  {Array.from({ length: 9 }, (_, index) => {
                    const ratio = index / 8;
                    const y = PLOT_TOP + ratio * (PLOT_BOTTOM - PLOT_TOP);
                    const price = model.high - ratio * (model.high - model.low);
                    return (
                      <g key={`price-grid-${index}`}>
                        <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke="var(--border)" strokeOpacity="0.36" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
                        <text x="930" y={y + 3} fill="var(--muted)" fontSize="9" fontFamily="monospace">{price.toFixed(0)}</text>
                      </g>
                    );
                  })}
                  {Array.from({ length: 7 }, (_, index) => {
                    const ratio = index / 6;
                    const timestamp = model.startTime + ratio * (model.endTime - model.startTime);
                    const x = PLOT_LEFT + ratio * (PLOT_RIGHT - PLOT_LEFT);
                    return (
                      <g key={`time-grid-${index}`}>
                        <line x1={x} x2={x} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="var(--border)" strokeOpacity="0.24" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
                        <text x={x} y="546" textAnchor={index === 0 ? "start" : index === 6 ? "end" : "middle"} fill="var(--muted)" fontSize="8" fontFamily="monospace">{timeLabel(timestamp)}</text>
                      </g>
                    );
                  })}
                  {model.cells.map((cell) => {
                    const x = model.xForTime(cell.timestamp);
                    const nextX = model.xForTime(cell.timestamp + 60_000);
                    const centerY = model.yForPrice(cell.price);
                    const rowHeight = Math.max(3.5, Math.abs(model.yForPrice(cell.price - model.bucketSize / 2) - model.yForPrice(cell.price + model.bucketSize / 2)));
                    const callValue = sideValue(cell, "CALL", metric);
                    const putValue = sideValue(cell, "PUT", metric);
                    const callIntensity = callValue > 0 ? clamp(Math.pow(callValue / model.heatCeiling, 0.42), 0.08, 1) : 0;
                    const putIntensity = putValue > 0 ? clamp(Math.pow(putValue / model.heatCeiling, 0.42), 0.08, 1) : 0;
                    return (
                      <g key={`${cell.timestamp}:${cell.price}`}>
                        {callIntensity ? <rect x={x} y={centerY - rowHeight / 2} width={Math.max(2, nextX - x + 0.6)} height={rowHeight / 2 + 0.2} fill="var(--primary)" opacity={0.08 + callIntensity * 0.84} filter={callIntensity > 0.72 ? "url(#gexdesk-heat-glow)" : undefined} /> : null}
                        {putIntensity ? <rect x={x} y={centerY} width={Math.max(2, nextX - x + 0.6)} height={rowHeight / 2 + 0.2} fill="var(--accent)" opacity={0.08 + putIntensity * 0.84} filter={putIntensity > 0.72 ? "url(#gexdesk-heat-glow)" : undefined} /> : null}
                      </g>
                    );
                  })}
                  {selected ? (
                    <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={model.yForPrice(selected.price)} y2={model.yForPrice(selected.price)} stroke="var(--foreground)" strokeOpacity="0.26" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
                  ) : null}
                  {model.pricePath ? (
                    <>
                      <path d={model.pricePath} fill="none" stroke="var(--background)" strokeOpacity="0.9" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                      <path d={model.pricePath} fill="none" stroke="var(--foreground)" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </>
                  ) : null}
                  {model.currentPrice !== null ? (
                    <g className="gexdesk-live-price">
                      <line x1={PLOT_LEFT} x2="956" y1={model.yForPrice(model.currentPrice)} y2={model.yForPrice(model.currentPrice)} stroke="var(--foreground)" strokeOpacity="0.72" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                      <rect x="922" y={model.yForPrice(model.currentPrice) - 10} width="70" height="20" rx="5" fill="var(--primary)" />
                      <text x="957" y={model.yForPrice(model.currentPrice) + 3.5} textAnchor="middle" fill="var(--background)" fontSize="8.5" fontFamily="monospace" fontWeight="700">{formatPrice(model.currentPrice)}</text>
                    </g>
                  ) : null}
                  <rect x={PLOT_LEFT} y={PLOT_TOP} width="84" height={PLOT_BOTTOM - PLOT_TOP} fill="url(#gexdesk-heat-fade)" />
                  <text x="34" y="38" fill="var(--primary)" fontSize="8" fontFamily="monospace">CALL HEAT</text>
                  <text x="34" y="52" fill="var(--accent)" fontSize="8" fontFamily="monospace">PUT HEAT</text>
                </svg>
                {historyLoading && !history ? (
                  <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-xl border border-border bg-background/85 px-3 py-2 text-[6px] text-muted backdrop-blur">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                    Restoring session path · live feed remains active
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <aside className="flex min-h-0 flex-col bg-panel">
            <div className="border-b border-border px-3 py-3">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <div>
                  <div className="text-[8px] font-semibold">Call / put level tape</div>
                  <div className="mt-0.5 text-[6px] text-muted">Confidence-weighted mapped activity</div>
                </div>
                <span className="ml-auto font-mono text-[8px] font-semibold text-foreground">{formatPrice(model.currentPrice)}</span>
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface">
                <div className="bg-primary" style={{ width: `${callShare * 100}%` }} />
                <div className="bg-accent" style={{ width: `${(1 - callShare) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[6px] text-muted">
                <span className="text-primary">Calls {compactMoney(model.totalCallPremium)}</span>
                <span>{(callShare * 100).toFixed(0)} / {((1 - callShare) * 100).toFixed(0)}</span>
                <span className="text-accent">Puts {compactMoney(model.totalPutPremium)}</span>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_74px_1fr] border-b border-border px-3 py-2 text-[6px] font-semibold uppercase tracking-[0.1em] text-muted">
              <span>Calls</span><span className="text-center">{liveInstrument}</span><span className="text-right">Puts</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {model.levels.map((level) => {
                const callValue = sideValue(level, "CALL", metric);
                const putValue = sideValue(level, "PUT", metric);
                const nearLive = model.currentPrice !== null && Math.abs(level.price - model.currentPrice) <= model.bucketSize / 2;
                const active = selected?.price === level.price;
                return (
                  <button
                    key={level.price}
                    type="button"
                    onClick={() => setSelectedPrice(level.price)}
                    className={`relative grid h-9 w-full grid-cols-[1fr_74px_1fr] items-center overflow-hidden border-b border-border/45 px-3 font-mono text-[7px] transition-colors ${active ? "bg-foreground/[0.045]" : "hover:bg-surface/60"}`}
                  >
                    <span className="absolute inset-y-1 left-0 bg-primary/[0.13]" style={{ width: `${callValue / maximumLevelValue * 42}%` }} />
                    <span className="absolute inset-y-1 right-0 bg-accent/[0.13]" style={{ width: `${putValue / maximumLevelValue * 42}%` }} />
                    <span className="relative z-10 text-left text-primary">
                      {metric === "PREMIUM" ? compactMoney(level.callPremium) : compactContracts(level.callContracts)}
                      <small className="ml-1 text-[5px] text-muted">{level.calls}</small>
                    </span>
                    <span className={`relative z-10 rounded-md px-1.5 py-1 text-center font-semibold ${nearLive ? "bg-primary text-background shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_35%,transparent)]" : active ? "border border-foreground/20 text-foreground" : "text-foreground"}`}>{level.price.toFixed(0)}</span>
                    <span className="relative z-10 text-right text-accent">
                      {metric === "PREMIUM" ? compactMoney(level.putPremium) : compactContracts(level.putContracts)}
                      <small className="ml-1 text-[5px] text-muted">{level.puts}</small>
                    </span>
                  </button>
                );
              })}
              {!model.levels.length ? <div className="p-5 text-center text-[7px] leading-5 text-muted">No mapped prints fall inside this time and price window.</div> : null}
            </div>

            <div className="space-y-2 border-t border-border p-3">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                <div className="flex items-center gap-2 text-[6px] font-semibold uppercase tracking-[0.11em] text-primary"><Flame className="h-3 w-3" />Hottest mapped level</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="font-mono text-[15px] font-semibold">{selected?.price.toFixed(0) ?? "--"}</span>
                  <span className="text-right text-[6px] leading-4 text-muted">{selected ? `${selected.calls + selected.puts} prints · ${compactMoney(selected.callPremium + selected.putPremium)}` : "Waiting for activity"}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3 text-[6px] leading-4 text-muted">
                <Radio className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span>Brightness measures actual consolidated call/put premium or contracts at each mapped level. It is options activity, not resting futures liquidity.</span>
              </div>
              {historyError ? <div className="text-[6px] leading-4 text-warning">{historyError}</div> : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
