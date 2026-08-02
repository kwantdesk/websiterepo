"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Database,
  GitCompareArrows,
  Layers3,
  Radio,
  ShieldCheck,
  Waves,
} from "lucide-react";
import KwantLoader from "@/components/KwantLoader";
import type { DatabentoLiveStatus } from "@/lib/chartLiveEvents";
import type {
  GexDeskHistoryPayload,
  GexDeskHistoryInstrument,
  GexDeskPayload,
  GexDeskPressurePoint,
  GexDeskSourceSymbol,
  GexDeskZone,
} from "@/lib/gexDesk";

export type GexDeskPanel = "GEX_VIEW" | "MAP" | "HEATMAP" | "EXPIRIES" | "FLOW" | "SOURCES";
export type GexDeskTapeTick = { price: number; delta: number; timestamp: number };

type PanelProps = {
  panel: Exclude<GexDeskPanel, "GEX_VIEW" | "MAP" | "HEATMAP">;
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  historyLoading: boolean;
  historyError: string;
  sourceFilter: "COMBINED" | GexDeskSourceSymbol;
  livePrice: number | null;
  selectedZone: GexDeskZone | null;
  tapeTicks: GexDeskTapeTick[];
  feedStatus: DatabentoLiveStatus;
};

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function compact(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
}

function percent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function detailedTimeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

function evolutionRole(call: number, put: number, net: number, concentration: number) {
  const callMagnitude = Math.abs(call);
  const putMagnitude = Math.abs(put);
  const total = callMagnitude + putMagnitude;
  const callShare = total > 0 ? callMagnitude / total : 0.5;
  const dominant = concentration >= 0.64;

  if (dominant && callShare >= 0.62) {
    return {
      label: "Call wall",
      detail: "Call gamma is the dominant exposure at this mapped price and timestamp.",
      tone: "text-primary",
    };
  }
  if (dominant && callShare <= 0.38) {
    return {
      label: "Put support / put wall",
      detail: "Put gamma is the dominant exposure at this mapped price and timestamp.",
      tone: "text-accent",
    };
  }
  if (net > 0) {
    return {
      label: "Positive gamma node",
      detail: "Net mapped exposure is positive, consistent with more stabilising hedge pressure.",
      tone: "text-primary",
    };
  }
  if (net < 0) {
    return {
      label: "Negative gamma pocket",
      detail: "Net mapped exposure is negative, consistent with more amplifying hedge pressure.",
      tone: "text-accent",
    };
  }
  return {
    label: "Balanced node",
    detail: "Call and put exposure are currently offsetting at this mapped price.",
    tone: "text-muted",
  };
}

function dayDistance(sessionDate: string, expiration: string) {
  const start = Date.parse(`${sessionDate}T00:00:00Z`);
  const end = Date.parse(`${expiration}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.round((end - start) / 86_400_000))
    : 999;
}

function pathForSeries(
  values: number[],
  width: number,
  height: number,
  min: number,
  max: number,
) {
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : index / (values.length - 1) * width;
    const y = height - (value - min) / range * height;
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  detail,
  right,
}: {
  icon: typeof Activity;
  eyebrow: string;
  title: string;
  detail: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.06] text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[6px] font-semibold uppercase tracking-[0.15em] text-primary">{eyebrow}</div>
        <div className="mt-0.5 text-[10px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[7px] text-muted">{detail}</div>
      </div>
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}

function EmptyPanel({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-panel p-6 text-center">
      <div className="max-w-sm">
        <AlertTriangle className="mx-auto h-6 w-6 text-warning" />
        <div className="mt-3 text-[10px] font-semibold">{title}</div>
        <p className="mt-2 text-[7px] leading-5 text-muted">{detail}</p>
      </div>
    </div>
  );
}

export function EvolutionPanel({
  history,
  loading,
  error,
  livePrice,
  instrument = "NQ",
  onInstrumentChange,
  embedded = false,
}: {
  history: GexDeskHistoryPayload | null;
  loading: boolean;
  error: string;
  livePrice: number | null;
  instrument?: GexDeskHistoryInstrument;
  onInstrumentChange?: (instrument: GexDeskHistoryInstrument) => void;
  embedded?: boolean;
}) {
  const [mode, setMode] = useState<"EXPOSURE" | "CHANGE">("EXPOSURE");
  const [hoveredCell, setHoveredCell] = useState<{ columnIndex: number; rowIndex: number; x: number; y: number } | null>(null);
  const summary = useMemo(() => {
    if (!history?.rows.length || !history.timestamps.length) return null;
    const lastIndex = history.timestamps.length - 1;
    const candidates = history.rows.map((row) => ({
      price: row.price,
      net: row.net[lastIndex] ?? 0,
      gross: row.gross[lastIndex] ?? 0,
      change: row.change[lastIndex] ?? 0,
    }));
    return {
      strongest: [...candidates].sort((left, right) => right.gross - left.gross)[0] ?? null,
      building: [...candidates].sort((left, right) => Math.abs(right.change) - Math.abs(left.change))[0] ?? null,
    };
  }, [history]);
  const heatScale = useMemo(() => {
    const magnitudes = history?.rows.flatMap((row) => (
      mode === "EXPOSURE" ? row.gross : row.change.map(Math.abs)
    )).filter((value) => Number.isFinite(value) && value > 0) ?? [];
    return {
      maximum: Math.max(...magnitudes, 1),
    };
  }, [history, mode]);

  if (loading && !history) {
    return <KwantLoader className="min-h-[620px] rounded-2xl border border-border bg-panel" icon={Layers3} title="Building intraday exposure map" detail={`Timestamp-aligning ${instrument === "ES" ? "SPX/SPY" : "NDX/QQQ"} positioning with ${instrument} history.`} />;
  }
  if (!history) {
    return <EmptyPanel title="Intraday evolution is unavailable" detail={error || "No timestamp-aligned interval map is available for this source yet."} />;
  }

  const maximum = heatScale.maximum;
  const rowCount = history.rows.length;
  const columnCount = history.timestamps.length;
  const historyInstrument = history.instrument ?? instrument;
  const futuresPrices = history.futuresPrices?.length ? history.futuresPrices : history.nqPrices;
  const live = livePrice ?? futuresPrices.at(-1) ?? null;
  const yForPrice = (price: number) => rowCount - 1 - (price - history.priceLow) / Math.max(1, history.bucketSize);
  const primaryPath = futuresPrices.map((price, index) => (
    `${index ? "L" : "M"}${index.toFixed(2)},${yForPrice(price).toFixed(2)}`
  )).join(" ");
  const hovered = hoveredCell ? (() => {
    const row = history.rows[hoveredCell.rowIndex];
    const timestamp = history.timestamps[hoveredCell.columnIndex];
    if (!row || timestamp === undefined) return null;
    const call = row.call[hoveredCell.columnIndex] ?? 0;
    const put = row.put[hoveredCell.columnIndex] ?? 0;
    const net = row.net[hoveredCell.columnIndex] ?? 0;
    const gross = row.gross[hoveredCell.columnIndex] ?? 0;
    const change = row.change[hoveredCell.columnIndex] ?? 0;
    const heatMagnitude = mode === "EXPOSURE" ? gross : Math.abs(change);
    const columnPeak = Math.max(1, ...history.rows.map((candidate) => (
      mode === "EXPOSURE"
        ? candidate.gross[hoveredCell.columnIndex] ?? 0
        : Math.abs(candidate.change[hoveredCell.columnIndex] ?? 0)
    )));
    const concentration = clamp(heatMagnitude / columnPeak, 0, 1);
    const heatStrength = clamp(Math.pow(heatMagnitude / maximum, 0.55), 0, 1);
    const underliers = Object.entries(history.underlierPrices ?? {}).flatMap(([symbol, prices]) => {
      const price = prices?.[hoveredCell.columnIndex];
      return Number.isFinite(price) ? [{ symbol, price: Number(price) }] : [];
    });
    return {
      ...hoveredCell,
      row,
      timestamp,
      call,
      put,
      net,
      gross,
      change,
      concentration,
      futuresPrice: futuresPrices[hoveredCell.columnIndex] ?? null,
      underliers,
      heatStrength,
      role: evolutionRole(call, put, net, concentration),
    };
  })() : null;

  return (
    <div className={embedded ? "h-full min-h-0" : "space-y-3"}>
      <section className={`overflow-hidden bg-panel ${embedded ? "flex h-full min-h-0 flex-col" : "rounded-2xl border border-border"}`}>
        <SectionHeader
          icon={Layers3}
          eyebrow="MAP CHANGE"
          title="Intraday gamma evolution"
          detail={`Exposure is remapped with source and ${historyInstrument} prices from the same historical minute.`}
          right={(
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex rounded-xl border border-border bg-background p-1" aria-label="Evolution instrument">
                {(["NQ", "ES"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setHoveredCell(null);
                      onInstrumentChange?.(value);
                    }}
                    className={`rounded-lg px-3 py-1.5 font-mono text-[7px] font-semibold transition ${instrument === value ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="flex rounded-xl border border-border bg-background p-1">
                {(["EXPOSURE", "CHANGE"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-lg px-3 py-1.5 text-[7px] font-semibold ${mode === value ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}
                  >
                    {value === "EXPOSURE" ? "Exposure" : "Change"}
                  </button>
                ))}
              </div>
            </div>
          )}
        />
        <div className={embedded ? "flex min-h-0 flex-1 flex-col" : "min-h-[700px]"}>
          <aside className="grid shrink-0 gap-2 border-b border-border bg-background/15 p-3 md:grid-cols-3">
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
              <div className="flex items-center gap-2 text-[6px] font-semibold uppercase tracking-[0.13em] text-primary"><GitCompareArrows className="h-3.5 w-3.5" />What changed</div>
              <div className="mt-2 flex items-end gap-3"><span className="font-mono text-[16px] font-semibold">{summary?.building?.price.toFixed(0) ?? "--"}</span><span className="pb-0.5 font-mono text-[8px] text-muted">{summary?.building ? compact(summary.building.change) : "unavailable"}</span></div>
              <p className="mt-1 text-[7px] leading-4 text-muted">Largest latest sampled exposure change. Direction describes the map, not a trade signal.</p>
            </div>
            <div className="rounded-xl border border-border bg-background/35 px-4 py-3">
              <div className="flex items-center gap-2 text-[6px] font-semibold uppercase tracking-[0.13em] text-muted"><Activity className="h-3.5 w-3.5 text-primary" />Strongest current concentration</div>
              <div className="mt-2 flex items-end gap-3"><span className="font-mono text-[16px] font-semibold">{summary?.strongest?.price.toFixed(0) ?? "--"}</span><span className="pb-0.5 font-mono text-[8px] text-muted">{summary?.strongest ? compact(summary.strongest.gross) : "unavailable"}</span></div>
              <p className="mt-1 text-[7px] leading-4 text-muted">The strike carrying the greatest current gross mapped exposure.</p>
            </div>
            <div className="rounded-xl border border-border bg-background/35 px-4 py-3">
              <div className="flex items-center gap-2 text-[6px] font-semibold uppercase tracking-[0.13em] text-muted"><Clock3 className="h-3.5 w-3.5 text-primary" />How to read it</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[7px] leading-4 text-muted">
                <p><span className="block font-semibold text-primary">Primary</span>Stabilising</p>
                <p><span className="block font-semibold text-accent">Accent</span>Amplifying</p>
                <p><span className="block font-semibold text-foreground">White</span>{historyInstrument} price</p>
              </div>
              <p className="mt-1 text-[7px] leading-4 text-muted">Use Change to locate exposure building or fading through the session.</p>
            </div>
            {history.errors.length || error ? <div className="rounded-xl border border-warning/20 bg-warning/[0.04] px-4 py-2 text-[7px] leading-4 text-warning md:col-span-3">{[...history.errors, error].filter(Boolean).join(" · ")}</div> : null}
          </aside>
          <div className={`relative min-w-0 overflow-hidden bg-background/25 p-4 ${embedded ? "flex min-h-0 flex-1 flex-col" : ""}`}>
            <div className="mb-3 flex items-center justify-between gap-3 text-[6px] uppercase tracking-[0.11em] text-muted">
              <span>{history.source} / {history.expiration || "front expiry"}</span>
              <span>{history.status} · {percent(history.mappingCoverage)} timestamp coverage</span>
            </div>
            <div
              className={`relative overflow-hidden rounded-xl border border-border bg-background ${embedded ? "min-h-[420px] flex-1" : "h-[620px]"}`}
              onMouseLeave={() => setHoveredCell(null)}
            >
              <div
                className="absolute bottom-7 left-0 right-[72px] top-0 cursor-crosshair overflow-hidden"
                onMouseMove={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  if (!bounds.width || !bounds.height || !columnCount || !rowCount) return;
                  const xRatio = clamp((event.clientX - bounds.left) / bounds.width, 0, 0.999999);
                  const yRatio = clamp((event.clientY - bounds.top) / bounds.height, 0, 0.999999);
                  const columnIndex = Math.min(columnCount - 1, Math.floor(xRatio * columnCount));
                  const rowIndex = clamp(rowCount - 1 - Math.floor(yRatio * rowCount), 0, rowCount - 1);
                  setHoveredCell((current) => (
                    current?.columnIndex === columnIndex && current.rowIndex === rowIndex
                      ? current
                      : {
                          columnIndex,
                          rowIndex,
                          x: (columnIndex + 0.5) / columnCount * 100,
                          y: (rowCount - 1 - rowIndex + 0.5) / rowCount * 100,
                        }
                  ));
                }}
              >
                <svg className="pointer-events-none h-full w-full" viewBox={`0 0 ${Math.max(1, columnCount)} ${Math.max(1, rowCount)}`} preserveAspectRatio="none" aria-label="Intraday mapped gamma exposure heatmap">
                  {history.rows.map((row, rowIndex) => {
                    const y = rowCount - 1 - rowIndex;
                    return history.timestamps.map((timestamp, columnIndex) => {
                      const net = mode === "EXPOSURE" ? row.net[columnIndex] ?? 0 : row.change[columnIndex] ?? 0;
                      const magnitude = mode === "EXPOSURE" ? row.gross[columnIndex] ?? 0 : Math.abs(net);
                      if (magnitude <= 0) return null;
                      const opacity = clamp(Math.pow(magnitude / maximum, 0.55), 0.025, 0.92);
                      return (
                        <rect
                          key={`${timestamp}:${row.price}`}
                          x={columnIndex}
                          y={y}
                          width="1.05"
                          height="1.05"
                          fill={net >= 0 ? "var(--primary)" : "var(--accent)"}
                          opacity={opacity}
                        />
                      );
                    });
                  })}
                  <path d={primaryPath} fill="none" stroke="var(--foreground)" strokeWidth="0.22" strokeOpacity="0.86" vectorEffect="non-scaling-stroke" />
                  {live !== null ? (
                    <line
                      x1="0"
                      x2={columnCount}
                      y1={yForPrice(live)}
                      y2={yForPrice(live)}
                      stroke="var(--primary)"
                      strokeWidth="0.28"
                      strokeDasharray="1 1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                </svg>

                {hovered ? (
                  <>
                    <span className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary/70 shadow-[0_0_8px_var(--primary)]" style={{ left: `${hovered.x}%` }} />
                    <span className="pointer-events-none absolute inset-x-0 z-10 h-px bg-primary/70 shadow-[0_0_8px_var(--primary)]" style={{ top: `${hovered.y}%` }} />
                    <span
                      className="pointer-events-none absolute z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary shadow-[0_0_12px_var(--primary)]"
                      style={{ left: `${hovered.x}%`, top: `${hovered.y}%` }}
                    />
                    <div
                      className="pointer-events-none absolute z-30 w-[270px] rounded-xl border border-primary/30 bg-panel/95 p-3 shadow-[0_14px_40px_rgba(0,0,0,.55),0_0_22px_color-mix(in_srgb,var(--primary)_18%,transparent)] backdrop-blur-md"
                      style={{
                        left: `${hovered.x}%`,
                        top: `${hovered.y}%`,
                        transform: `translate(${hovered.x > 62 ? "calc(-100% - 12px)" : "12px"}, ${hovered.y > 58 ? "calc(-100% - 12px)" : "12px"})`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                        <div>
                          <div className={`text-[8px] font-semibold uppercase tracking-[0.12em] ${hovered.role.tone}`}>{hovered.role.label}</div>
                          <div className="mt-1 font-mono text-[11px] font-semibold text-foreground">{historyInstrument} {hovered.row.price.toFixed(0)}</div>
                        </div>
                        <div className="text-right font-mono text-[7px] text-muted">{detailedTimeLabel(hovered.timestamp)}</div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[7px]">
                        <div><span className="block uppercase tracking-[0.1em] text-muted">Call GEX</span><span className="mt-0.5 block font-mono font-semibold text-primary">{compact(hovered.call)}</span></div>
                        <div><span className="block uppercase tracking-[0.1em] text-muted">Put GEX</span><span className="mt-0.5 block font-mono font-semibold text-accent">{compact(hovered.put)}</span></div>
                        <div><span className="block uppercase tracking-[0.1em] text-muted">Net GEX</span><span className={`mt-0.5 block font-mono font-semibold ${hovered.net >= 0 ? "text-primary" : "text-accent"}`}>{compact(hovered.net)}</span></div>
                        <div><span className="block uppercase tracking-[0.1em] text-muted">Gross exposure</span><span className="mt-0.5 block font-mono font-semibold text-foreground">{compact(hovered.gross)}</span></div>
                        <div><span className="block uppercase tracking-[0.1em] text-muted">Frame change</span><span className={`mt-0.5 block font-mono font-semibold ${hovered.change >= 0 ? "text-primary" : "text-accent"}`}>{compact(hovered.change)}</span></div>
                        <div><span className="block uppercase tracking-[0.1em] text-muted">Heat strength</span><span className="mt-0.5 block font-mono font-semibold text-foreground">{percent(hovered.heatStrength, 1)}</span></div>
                        <div><span className="block uppercase tracking-[0.1em] text-muted">{historyInstrument} at time</span><span className="mt-0.5 block font-mono font-semibold text-foreground">{hovered.futuresPrice?.toFixed(2) ?? "--"}</span></div>
                        {hovered.underliers.map((underlier) => (
                          <div key={underlier.symbol}><span className="block uppercase tracking-[0.1em] text-muted">{underlier.symbol} at time</span><span className="mt-0.5 block font-mono font-semibold text-foreground">{underlier.price.toFixed(2)}</span></div>
                        ))}
                        <div><span className="block uppercase tracking-[0.1em] text-muted">Heat input</span><span className="mt-0.5 block font-semibold text-foreground">{mode === "EXPOSURE" ? "Gross GEX" : "|Net GEX change|"}</span></div>
                      </div>
                      <p className="mt-2 border-t border-border pt-2 text-[7px] leading-4 text-muted">{hovered.role.detail}</p>
                      <div className="mt-2 flex justify-between gap-3 font-mono text-[6px] uppercase tracking-[0.09em] text-muted"><span>{history.source}</span><span className="truncate">{history.expiration || "Front expiry"}</span></div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="pointer-events-none absolute bottom-0 left-0 right-[72px] h-7 border-t border-border bg-panel/95">
                <div className="absolute inset-x-3 inset-y-0 flex items-center justify-between font-mono text-[7px] text-foreground/70">
                  <span>{timeLabel(history.timestamps[0])}</span>
                  <span>{timeLabel(history.timestamps[Math.floor(history.timestamps.length / 2)])}</span>
                  <span>{timeLabel(history.timestamps.at(-1)!)}</span>
                </div>
                {hovered ? <span className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md border border-primary/40 bg-primary px-2 py-1 font-mono text-[7px] font-semibold text-background shadow-[0_0_12px_var(--primary)]" style={{ left: `clamp(30px, ${hovered.x}%, calc(100% - 30px))` }}>{timeLabel(hovered.timestamp)}</span> : null}
              </div>

              <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[72px] border-l border-border bg-panel/95">
                <div className="absolute bottom-7 inset-x-0 top-0">
                  <div className="absolute inset-x-0 inset-y-2 flex flex-col items-center justify-between font-mono text-[7px] text-foreground/75">
                    <span>{history.priceHigh.toFixed(0)}</span>
                    <span>{((history.priceHigh + history.priceLow) / 2).toFixed(0)}</span>
                    <span>{history.priceLow.toFixed(0)}</span>
                  </div>
                  {hovered ? <span className="absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md border border-primary/40 bg-primary px-2 py-1 font-mono text-[7px] font-semibold text-background shadow-[0_0_12px_var(--primary)]" style={{ top: `clamp(12px, ${hovered.y}%, calc(100% - 12px))` }}>{hovered.row.price.toFixed(0)}</span> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ExpiryPanel({
  payload,
  selectedZone,
}: {
  payload: GexDeskPayload;
  selectedZone: GexDeskZone | null;
}) {
  const buckets = useMemo(() => {
    const definitions = [
      { label: "0DTE", min: 0, max: 0 },
      { label: "1DTE", min: 1, max: 1 },
      { label: "2-5DTE", min: 2, max: 5 },
      { label: "6-30DTE", min: 6, max: 30 },
      { label: "30+DTE", min: 31, max: Number.POSITIVE_INFINITY },
    ];
    return definitions.map((definition) => {
      const rows = payload.expiries.filter((row) => {
        const dte = dayDistance(payload.sessionDate, row.expiration);
        return dte >= definition.min && dte <= definition.max;
      });
      return {
        label: definition.label,
        call: rows.reduce((sum, row) => sum + row.call, 0),
        put: rows.reduce((sum, row) => sum + row.put, 0),
        net: rows.reduce((sum, row) => sum + row.net, 0),
        gross: rows.reduce((sum, row) => sum + row.gross, 0),
        rows: rows.length,
      };
    });
  }, [payload.expiries, payload.sessionDate]);
  const totalGross = Math.max(1, buckets.reduce((sum, bucket) => sum + bucket.gross, 0));

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-border bg-panel">
        <SectionHeader icon={BarChart3} eyebrow="EXPIRY STRUCTURE" title="How durable is the map?" detail="Gross contribution is separated by time-to-expiry so fast-decaying 0DTE exposure cannot hide inside the total." />
        <div className="p-4">
          <div className="flex h-5 overflow-hidden rounded-lg border border-border bg-background">
            {buckets.map((bucket, index) => (
              <div
                key={bucket.label}
                className={index % 2 === 0 ? "bg-primary" : "bg-primary/45"}
                style={{ width: `${bucket.gross / totalGross * 100}%` }}
                title={`${bucket.label}: ${percent(bucket.gross / totalGross)}`}
              />
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {buckets.map((bucket) => (
              <div key={bucket.label} className="rounded-xl border border-border bg-background/30 p-3">
                <div className="flex items-center justify-between text-[6px] uppercase tracking-[0.11em] text-muted">
                  <span>{bucket.label}</span>
                  <span>{percent(bucket.gross / totalGross)}</span>
                </div>
                <div className={`mt-2 font-mono text-[13px] font-semibold ${bucket.net >= 0 ? "text-primary" : "text-accent"}`}>{compact(bucket.net)}</div>
                <div className="mt-1 text-[6px] text-muted">{bucket.rows} source-expiry rows · {compact(bucket.gross)} gross</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-panel">
          <SectionHeader icon={Database} eyebrow="EXPIRY MATRIX" title="Source × expiration contribution" detail="Detailed analyst table; calls and puts remain signed exposures, not bullish/bearish labels." />
          <div className="max-h-[430px] overflow-y-auto">
            <div className="sticky top-0 z-10 grid grid-cols-[105px_60px_55px_1fr_88px_88px] border-b border-border bg-panel px-4 py-2 text-[6px] uppercase tracking-[0.1em] text-muted">
              <span>Expiration</span><span>Source</span><span>DTE</span><span>Net balance</span><span className="text-right">Net</span><span className="text-right">Gross</span>
            </div>
            {payload.expiries.map((row) => {
              const ratio = row.gross > 0 ? clamp(row.net / row.gross, -1, 1) : 0;
              return (
                <div key={`${row.source}:${row.expiration}`} className="grid grid-cols-[105px_60px_55px_1fr_88px_88px] items-center border-b border-border/45 px-4 py-2.5 text-[7px]">
                  <span className="font-mono">{row.expiration}</span>
                  <span className="text-muted">{row.source}</span>
                  <span className="font-mono text-muted">{dayDistance(payload.sessionDate, row.expiration)}</span>
                  <div className="relative h-1.5 rounded-full bg-surface">
                    <div className={`absolute inset-y-0 rounded-full ${ratio >= 0 ? "left-1/2 bg-primary" : "right-1/2 bg-accent"}`} style={{ width: `${Math.abs(ratio) * 50}%` }} />
                  </div>
                  <span className={`text-right font-mono ${row.net >= 0 ? "text-primary" : "text-accent"}`}>{compact(row.net)}</span>
                  <span className="text-right font-mono text-muted">{compact(row.gross)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-panel">
          <SectionHeader icon={Layers3} eyebrow="LEVEL COMPOSITION" title={selectedZone ? `NQ ${selectedZone.center.toFixed(0)}` : "Select a map zone"} detail="The selected zone keeps source, expiry, call and put contribution separate." />
          {selectedZone ? (
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-2 flex justify-between text-[6px] uppercase tracking-[0.11em] text-muted"><span>Calls</span><span>Puts</span></div>
                <div className="flex h-3 overflow-hidden rounded-full bg-surface">
                  <div className="bg-foreground/75" style={{ width: `${selectedZone.callShare * 100}%` }} />
                  <div className="bg-muted/50" style={{ width: `${(1 - selectedZone.callShare) * 100}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[6px] text-muted"><span>{percent(selectedZone.callShare)}</span><span>{percent(1 - selectedZone.callShare)}</span></div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-[6px] uppercase tracking-[0.11em] text-muted"><span>0DTE</span><span>Longer dated</span></div>
                <div className="flex h-3 overflow-hidden rounded-full bg-surface">
                  <div className="bg-primary" style={{ width: `${selectedZone.zeroDteShare * 100}%` }} />
                  <div className="bg-primary/25" style={{ width: `${(1 - selectedZone.zeroDteShare) * 100}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[6px] text-muted"><span>{percent(selectedZone.zeroDteShare)}</span><span>{percent(1 - selectedZone.zeroDteShare)}</span></div>
              </div>
              <div className="rounded-xl border border-border bg-background/30 p-3">
                <div className="text-[6px] uppercase tracking-[0.11em] text-muted">Original source strikes</div>
                <div className="mt-3 space-y-2 text-[7px]">
                  <div><span className="mr-2 text-primary">NDX</span><span className="font-mono">{selectedZone.ndxStrikes.length ? selectedZone.ndxStrikes.map((value) => value.toFixed(0)).join(", ") : "No local contribution"}</span></div>
                  <div><span className="mr-2 text-accent">QQQ</span><span className="font-mono">{selectedZone.qqqStrikes.length ? selectedZone.qqqStrikes.map((value) => value.toFixed(1)).join(", ") : "No local contribution"}</span></div>
                </div>
              </div>
              <p className="text-[7px] leading-5 text-muted">Call and put exposure describe composition. They do not automatically mean bullish and bearish.</p>
            </div>
          ) : <div className="p-5 text-[7px] text-muted">Return to Map and select a behavioural zone.</div>}
        </div>
      </section>
    </div>
  );
}

function MiniSeries({
  values,
  tone,
  height = 84,
}: {
  values: number[];
  tone: string;
  height?: number;
}) {
  const maximum = Math.max(1, ...values.map(Math.abs));
  const path = pathForSeries(values, 500, height, -maximum, maximum);
  return (
    <svg className="h-full w-full" viewBox={`0 0 500 ${height}`} preserveAspectRatio="none">
      <line x1="0" x2="500" y1={height / 2} y2={height / 2} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
      <path d={path} fill="none" stroke={tone} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function FlowPanel({
  payload,
  tapeTicks,
  feedStatus,
}: {
  payload: GexDeskPayload;
  tapeTicks: GexDeskTapeTick[];
  feedStatus: DatabentoLiveStatus;
}) {
  const pressureSeries = payload.pressure.series;
  const tapeSeries = useMemo(() => {
    if (!tapeTicks.length) return [];
    const buckets = new Map<number, number>();
    for (const tick of tapeTicks) {
      const timestamp = Math.floor(tick.timestamp / 5_000) * 5_000;
      buckets.set(timestamp, (buckets.get(timestamp) ?? 0) + tick.delta);
    }
    return [...buckets.entries()].sort(([left], [right]) => left - right).slice(-45);
  }, [tapeTicks]);
  const latestPressureSign = Math.sign(pressureSeries.at(-1)?.score ?? payload.pressure.score);
  const latestTapeSign = Math.sign(tapeSeries.at(-1)?.[1] ?? 0);
  const confirmation = latestPressureSign === 0 || latestTapeSign === 0
    ? "LEADING / UNCONFIRMED"
    : latestPressureSign === latestTapeSign
      ? "CONFIRMING"
      : "DIVERGING";
  const confirmationTone = confirmation === "CONFIRMING" ? "text-primary" : confirmation === "DIVERGING" ? "text-accent" : "text-warning";

  return (
    <div className="space-y-3">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-panel">
          <SectionHeader icon={Waves} eyebrow="PRESSURE" title="Estimated options delta demand" detail="Confidence-weighted options activity, normalized to a relative -100 to +100 index." />
          <div className="p-4">
            <div className="h-40 rounded-xl border border-border bg-background/30 p-3">
              {pressureSeries.length > 1 ? <MiniSeries values={pressureSeries.map((point) => point.score)} tone="var(--primary)" height={120} /> : <div className="flex h-full items-center justify-center text-[7px] text-muted">Waiting for enough timestamped options activity.</div>}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[6px] text-muted">
              <span>{pressureSeries[0] ? timeLabel(pressureSeries[0].timestamp) : "--"}</span>
              <span>ZERO</span>
              <span>{pressureSeries.at(-1) ? timeLabel(pressureSeries.at(-1)!.timestamp) : "--"}</span>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-panel">
          <SectionHeader icon={GitCompareArrows} eyebrow="RELATIONSHIP" title="Options estimate vs NQ" detail="The two layers stay separate; agreement is a state, not a mysterious blended score." />
          <div className="p-4">
            <div className={`text-[18px] font-semibold tracking-[-0.03em] ${confirmationTone}`}>{confirmation}</div>
            <p className="mt-3 text-[7px] leading-5 text-muted">
              {confirmation === "CONFIRMING"
                ? "The latest options-pressure direction and observed NQ trade delta currently agree."
                : confirmation === "DIVERGING"
                  ? "The latest NQ trade delta is moving against the estimated options-pressure direction."
                  : "Options pressure has a direction, but NQ does not yet provide enough signed-flow confirmation."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-background/30 p-3">
                <div className="text-[6px] uppercase tracking-[0.11em] text-muted">Pressure</div>
                <div className={`mt-2 font-mono text-[13px] font-semibold ${payload.pressure.score >= 0 ? "text-primary" : "text-accent"}`}>{payload.pressure.score >= 0 ? "+" : ""}{payload.pressure.score.toFixed(1)}</div>
              </div>
              <div className="rounded-xl border border-border bg-background/30 p-3">
                <div className="text-[6px] uppercase tracking-[0.11em] text-muted">NQ tape</div>
                <div className={`mt-2 font-mono text-[13px] font-semibold ${latestTapeSign >= 0 ? "text-primary" : "text-accent"}`}>{tapeSeries.at(-1)?.[1]?.toFixed(0) ?? "--"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-panel">
          <SectionHeader icon={Activity} eyebrow="TAPE" title="Observed NQ futures response" detail="Five-second signed-delta buckets from the shared CME stream; no second connection is opened." right={<span className={`rounded-lg border px-2 py-1 text-[6px] font-semibold ${feedStatus === "live" ? "border-primary/25 text-primary" : "border-border text-muted"}`}>{feedStatus.toUpperCase()}</span>} />
          <div className="p-4">
            <div className="h-40 rounded-xl border border-border bg-background/30 p-3">
              {tapeSeries.length > 1 ? <MiniSeries values={tapeSeries.map(([, value]) => value)} tone="var(--foreground)" height={120} /> : <div className="flex h-full items-center justify-center text-[7px] text-muted">Waiting for shared NQ prints.</div>}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-panel">
          <SectionHeader icon={ShieldCheck} eyebrow="INPUT QUALITY" title="Pressure evidence" detail="Ambiguous and complex prints receive lower classification confidence." />
          <div className="space-y-2 p-4">
            {payload.pressure.sources.map((source) => (
              <div key={source.symbol} className="rounded-xl border border-border bg-background/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-semibold">{source.symbol}</span>
                  <span className={`font-mono text-[11px] font-semibold ${source.score >= 0 ? "text-primary" : "text-accent"}`}>{source.score >= 0 ? "+" : ""}{source.score.toFixed(0)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface"><div className="h-full bg-primary" style={{ width: `${source.confidence * 100}%` }} /></div>
                  <span className="font-mono text-[6px] text-muted">{percent(source.confidence)}</span>
                </div>
                <div className="mt-2 text-[6px] text-muted">{source.tradeCount} prints · {percent(source.callShare)} call activity · {source.series.length} time buckets</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SourceProfile({
  payload,
  symbol,
}: {
  payload: GexDeskPayload;
  symbol: GexDeskSourceSymbol;
}) {
  const values = payload.rail.map((row) => symbol === "NDX" ? row.ndxNet : row.qqqNet);
  const maximum = Math.max(1, ...values.map(Math.abs));
  return (
    <div className="rounded-xl border border-border bg-background/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-semibold">{symbol} mapped profile</span>
        <span className="text-[6px] uppercase tracking-[0.11em] text-muted">{values.filter((value) => value !== 0).length} active buckets</span>
      </div>
      <div className="mt-3 flex h-28 items-end gap-px overflow-hidden">
        {values.map((value, index) => (
          <div key={`${symbol}:${payload.rail[index].price}`} className="relative h-full min-w-0 flex-1">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <div
              className={`absolute inset-x-0 ${value >= 0 ? "bottom-1/2 bg-primary" : "top-1/2 bg-accent"}`}
              style={{ height: `${Math.max(1, Math.abs(value) / maximum * 48)}%` }}
              title={`${payload.rail[index].price}: ${compact(value)}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcesPanel({ payload }: { payload: GexDeskPayload }) {
  const strongestRows = [...payload.rail].sort((left, right) => right.gross - left.gross).slice(0, 24);
  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-border bg-panel">
        <SectionHeader icon={GitCompareArrows} eyebrow="SOURCE AGREEMENT" title={`${payload.agreement.label} · ${payload.agreement.score}%`} detail="Regime sign, normalized mapped-profile correlation and nearby-zone overlap remain inspectable." />
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          <SourceProfile payload={payload} symbol="NDX" />
          <SourceProfile payload={payload} symbol="QQQ" />
        </div>
        <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/30 p-3"><div className="text-[6px] uppercase tracking-[0.11em] text-muted">Regime sign</div><div className={`mt-2 text-[10px] font-semibold ${payload.agreement.regimeAligned ? "text-primary" : "text-accent"}`}>{payload.agreement.regimeAligned ? "ALIGNED" : "OPPOSED"}</div></div>
          <div className="rounded-xl border border-border bg-background/30 p-3"><div className="text-[6px] uppercase tracking-[0.11em] text-muted">Profile correlation</div><div className="mt-2 font-mono text-[10px] font-semibold">{payload.agreement.profileCorrelation.toFixed(3)}</div></div>
          <div className="rounded-xl border border-border bg-background/30 p-3"><div className="text-[6px] uppercase tracking-[0.11em] text-muted">Combined interpretation</div><div className="mt-2 text-[8px] font-semibold">{payload.agreement.label === "HIGH" ? "Economic map is mutually supported" : payload.agreement.label === "MIXED" ? "Inspect each source before acting" : "Do not trust the combined shape alone"}</div></div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-panel">
          <SectionHeader icon={Database} eyebrow="RAW MAP INSPECTOR" title="Strongest mapped strike buckets" detail="Original NDX and QQQ strikes remain attached after NQ-equivalent mapping." />
          <div className="max-h-[430px] overflow-y-auto">
            <div className="sticky top-0 z-10 grid grid-cols-[86px_1fr_1fr_90px_90px] border-b border-border bg-panel px-4 py-2 text-[6px] uppercase tracking-[0.1em] text-muted">
              <span>NQ equiv.</span><span>NDX strikes</span><span>QQQ strikes</span><span className="text-right">Net</span><span className="text-right">Gross</span>
            </div>
            {strongestRows.map((row) => (
              <div key={row.price} className="grid grid-cols-[86px_1fr_1fr_90px_90px] items-center border-b border-border/45 px-4 py-2.5 text-[7px]">
                <span className="font-mono font-semibold">{row.price.toFixed(0)}</span>
                <span className="truncate font-mono text-muted">{row.ndxStrikes.length ? row.ndxStrikes.map((value) => value.toFixed(0)).join(", ") : "—"}</span>
                <span className="truncate font-mono text-muted">{row.qqqStrikes.length ? row.qqqStrikes.map((value) => value.toFixed(1)).join(", ") : "—"}</span>
                <span className={`text-right font-mono ${row.net >= 0 ? "text-primary" : "text-accent"}`}>{compact(row.net)}</span>
                <span className="text-right font-mono text-muted">{compact(row.gross)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border bg-panel">
            <SectionHeader icon={Radio} eyebrow="FRESHNESS" title="Source integrity" detail="Missing data remains unknown; it is never replaced with zero." />
            <div className="space-y-2 p-4">
              {payload.sources.map((source) => (
                <div key={source.symbol} className="flex items-center gap-3 rounded-xl border border-border bg-background/30 p-3">
                  <span className={`h-2 w-2 rounded-full ${source.status === "LIVE" ? "bg-primary shadow-[0_0_8px_var(--primary)]" : source.status === "LAST_GOOD" ? "bg-warning" : "bg-danger"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[8px] font-semibold">{source.symbol} positioning</div>
                    <div className="mt-1 truncate text-[6px] text-muted">{source.error || `${source.spot?.toLocaleString("en-US") ?? "No spot"} source reference`}</div>
                  </div>
                  <span className="text-[6px] font-semibold text-muted">{source.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-panel p-4">
            <div className="flex items-center gap-2 text-[8px] font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Model boundaries</div>
            <div className="mt-3 space-y-2 text-[7px] leading-5 text-muted">
              <p>Mapped prices are NQ-equivalent levels, not resting liquidity.</p>
              <p>Pressure is estimated options delta demand, not exact dealer inventory.</p>
              <p>A precise zero-gamma line stays hidden until repricing is validated.</p>
              <p>Open interest remains an analyst context layer because it is delayed and does not reveal who is long or short.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function GexDeskDepthPanels(props: PanelProps) {
  if (props.panel === "EXPIRIES") {
    return <ExpiryPanel payload={props.payload} selectedZone={props.selectedZone} />;
  }
  if (props.panel === "FLOW") {
    return <FlowPanel payload={props.payload} tapeTicks={props.tapeTicks} feedStatus={props.feedStatus} />;
  }
  return <SourcesPanel payload={props.payload} />;
}
