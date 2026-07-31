"use client";

import {
  Activity,
  AlertTriangle,
  CircleDot,
  Crosshair,
  Database,
  Radio,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import type {
  GexDeskHistoryPayload,
  GexDeskPayload,
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";

type SourceFilter = "COMBINED" | GexDeskSourceSymbol;
type ExecutionInstrument = "NQ" | "MNQ";
type SignAdapter = "DEALER_NET" | "CALL_MINUS_PUT";

type ProfilePoint = {
  timestamp: number;
  price: number;
  call: number;
  put: number;
  net: number;
  gross: number;
  callChange: number;
  putChange: number;
  flow: number;
};

type Contributor = {
  price: number;
  callChange: number;
  putChange: number;
  netChange: number;
  magnitude: number;
};

type GammaEvent = {
  id: string;
  pointIndex: number;
  endIndex: number;
  price: number;
  side: "CALL" | "PUT";
  state: "BUILD" | "UNWIND";
  score: number;
  magnitude: number;
};

const SVG_WIDTH = 1_180;
const SVG_HEIGHT = 620;
const PLOT_LEFT = 68;
const PLOT_RIGHT = 1_104;
const PLOT_TOP = 28;
const PLOT_BOTTOM = 584;
const FLOW_ZERO_Y = 372;

function compact(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  if (absolute >= 1_000_000_000_000) return `${sign}${(absolute / 1_000_000_000_000).toFixed(2)}T`;
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTimestamp(timestamp: number | null, seconds = false) {
  if (!timestamp) return "--";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(new Date(timestamp));
}

function ageLabel(value: string | null | undefined) {
  if (!value) return "unavailable";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "unavailable";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 1;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.floor((ordered.length - 1) * ratio)))] ?? 1;
}

function buildProfilePoints(
  history: GexDeskHistoryPayload | null,
  livePrice: number | null,
  signAdapter: SignAdapter,
) {
  if (!history?.timestamps.length || !history.rows.length) return [];
  return history.timestamps.map((timestamp, index): ProfilePoint => {
    const call = history.rows.reduce((sum, row) => sum + (row.call[index] ?? 0), 0);
    const put = history.rows.reduce((sum, row) => sum + (row.put[index] ?? 0), 0);
    const gross = history.rows.reduce((sum, row) => sum + (row.gross[index] ?? 0), 0);
    const previousCall = index > 0
      ? history.rows.reduce((sum, row) => sum + (row.call[index - 1] ?? 0), 0)
      : call;
    const previousPut = index > 0
      ? history.rows.reduce((sum, row) => sum + (row.put[index - 1] ?? 0), 0)
      : put;
    const callChange = call - previousCall;
    const putChange = put - previousPut;
    return {
      timestamp,
      price: index === history.timestamps.length - 1 && livePrice !== null
        ? livePrice
        : history.nqPrices[index] ?? livePrice ?? 0,
      call,
      put,
      net: call + put,
      gross,
      callChange,
      putChange,
      flow: index === 0
        ? 0
        : signAdapter === "DEALER_NET"
          ? callChange + putChange
          : callChange - putChange,
    };
  }).filter((point) => point.price > 0);
}

function contributorsAt(history: GexDeskHistoryPayload | null, index: number): Contributor[] {
  if (!history || index < 1 || index >= history.timestamps.length) return [];
  return history.rows.map((row) => {
    const callChange = (row.call[index] ?? 0) - (row.call[index - 1] ?? 0);
    const putChange = (row.put[index] ?? 0) - (row.put[index - 1] ?? 0);
    return {
      price: row.price,
      callChange,
      putChange,
      netChange: callChange + putChange,
      magnitude: Math.abs(callChange) + Math.abs(putChange),
    };
  }).filter((row) => row.magnitude > 0)
    .sort((left, right) => right.magnitude - left.magnitude);
}

function buildEvents(history: GexDeskHistoryPayload | null) {
  if (!history || history.timestamps.length < 2 || !history.rows.length) return [];
  const candidates = history.timestamps.slice(1).flatMap((_, offset) => {
    const pointIndex = offset + 1;
    const contributor = contributorsAt(history, pointIndex)[0];
    if (!contributor) return [];
    const side: GammaEvent["side"] = Math.abs(contributor.callChange) >= Math.abs(contributor.putChange)
      ? "CALL"
      : "PUT";
    const change = side === "CALL" ? contributor.callChange : contributor.putChange;
    const baseline = history.rows.find((row) => row.price === contributor.price)?.net[pointIndex - 1] ?? 0;
    const initialDistance = Math.abs(
      (history.rows.find((row) => row.price === contributor.price)?.net[pointIndex] ?? baseline) - baseline,
    );
    let endIndex = Math.min(history.timestamps.length - 1, pointIndex + 8);
    const sourceRow = history.rows.find((row) => row.price === contributor.price);
    if (sourceRow && initialDistance > 0) {
      for (let index = pointIndex + 1; index <= endIndex; index += 1) {
        if (Math.abs((sourceRow.net[index] ?? baseline) - baseline) < initialDistance * 0.4) {
          endIndex = index;
          break;
        }
      }
    }
    return [{
      id: `${history.timestamps[pointIndex]}:${contributor.price}`,
      pointIndex,
      endIndex,
      price: contributor.price,
      side,
      state: change >= 0 ? "BUILD" as const : "UNWIND" as const,
      score: 0,
      magnitude: contributor.magnitude,
    }];
  });
  const magnitudes = candidates.map((event) => event.magnitude).sort((left, right) => left - right);
  return candidates.map((event) => {
    const rank = magnitudes.findIndex((value) => value >= event.magnitude);
    const score = magnitudes.length <= 1 ? 100 : 70 + Math.round(rank / (magnitudes.length - 1) * 30);
    return { ...event, score };
  }).filter((event) => event.score >= 80)
    .sort((left, right) => right.score - left.score)
    .slice(0, 14)
    .sort((left, right) => left.pointIndex - right.pointIndex);
}

function sourceExposureLabel(payload: GexDeskPayload, sourceFilter: SourceFilter, scope: "0DTE" | "1DTE") {
  const selected = payload.sources.filter((source) => sourceFilter === "COMBINED" || source.symbol === sourceFilter);
  if (!selected.length) return "--";
  const rows = selected.map((source) => ({
    symbol: source.symbol,
    value: scope === "0DTE" ? source.zeroDteExposure?.net ?? null : source.oneDteExposure?.net ?? null,
  }));
  if (rows.length === 1) return compact(rows[0].value);
  return rows.map((row) => `${row.symbol} ${compact(row.value)}`).join(" / ");
}

function confirmationLabel(points: ProfilePoint[], index: number) {
  const point = points[index];
  if (!point) return { label: "UNAVAILABLE", tone: "text-muted", detail: "No aligned observation" };
  const comparisonIndex = index < points.length - 1 ? index + 1 : Math.max(0, index - 1);
  const comparison = points[comparisonIndex];
  const priceMove = index < points.length - 1
    ? comparison.price - point.price
    : point.price - comparison.price;
  if (Math.abs(priceMove) < 0.5) {
    return { label: "NO FOLLOW-THROUGH", tone: "text-muted", detail: `${priceMove >= 0 ? "+" : ""}${priceMove.toFixed(2)} NQ pts` };
  }
  const aligned = Math.sign(priceMove) === Math.sign(point.flow);
  return aligned
    ? { label: "PRICE CONFIRMED", tone: "text-primary", detail: `${priceMove >= 0 ? "+" : ""}${priceMove.toFixed(2)} NQ pts` }
    : { label: "PRICE DIVERGENT", tone: "text-danger", detail: `${priceMove >= 0 ? "+" : ""}${priceMove.toFixed(2)} NQ pts` };
}

export default function GammaOrderflowTerminal({
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
  const [execution, setExecution] = useState<ExecutionInstrument>("NQ");
  const [signAdapter, setSignAdapter] = useState<SignAdapter>("DEALER_NET");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showEvents, setShowEvents] = useState(true);

  const profilePoints = useMemo(
    () => buildProfilePoints(history, livePrice, signAdapter),
    [history, livePrice, signAdapter],
  );
  const events = useMemo(() => buildEvents(history), [history]);

  useEffect(() => {
    setSelectedIndex(profilePoints.length ? profilePoints.length - 1 : -1);
  }, [history?.source, history?.sessionDate, profilePoints.length, signAdapter]);

  const geometry = useMemo(() => {
    if (profilePoints.length < 2) return null;
    const prices = profilePoints.map((point) => point.price);
    const rawPriceLow = Math.min(...prices);
    const rawPriceHigh = Math.max(...prices);
    const pricePadding = Math.max(8, (rawPriceHigh - rawPriceLow) * 0.12);
    const priceLow = rawPriceLow - pricePadding;
    const priceHigh = rawPriceHigh + pricePadding;
    const magnitudes = profilePoints.slice(1).map((point) => Math.abs(point.flow)).filter((value) => value > 0);
    const flowScale = Math.max(1, percentile(magnitudes, 0.98));
    const x = (index: number) => PLOT_LEFT + index / (profilePoints.length - 1) * (PLOT_RIGHT - PLOT_LEFT);
    const priceY = (price: number) => PLOT_TOP + (priceHigh - price) / Math.max(1, priceHigh - priceLow) * (PLOT_BOTTOM - PLOT_TOP);
    const flowY = (value: number) => {
      const clipped = Math.max(-flowScale, Math.min(flowScale, value));
      return FLOW_ZERO_Y - clipped / flowScale * 165;
    };
    const pricePath = profilePoints.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${priceY(point.price).toFixed(1)}`).join(" ");
    const barWidth = Math.max(1.5, Math.min(5, (PLOT_RIGHT - PLOT_LEFT) / profilePoints.length * 0.55));
    const timeIndexes = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round((profilePoints.length - 1) * ratio));
    const priceTicks = Array.from({ length: 7 }, (_, index) => priceLow + (priceHigh - priceLow) * index / 6).reverse();
    return { priceLow, priceHigh, flowScale, x, priceY, flowY, pricePath, barWidth, timeIndexes, priceTicks };
  }, [profilePoints]);

  const selectedPoint = profilePoints[selectedIndex] ?? profilePoints.at(-1) ?? null;
  const selectedContributors = useMemo(
    () => contributorsAt(history, selectedIndex).slice(0, 5),
    [history, selectedIndex],
  );
  const selectedEvent = events.find((event) => event.pointIndex === selectedIndex) ?? null;
  const confirmation = confirmationLabel(profilePoints, selectedIndex);
  const sourceMatches = history?.source === sourceFilter;
  const latest = profilePoints.at(-1) ?? null;
  const status = historyLoading && history ? "UPDATING" : history?.status ?? "WAITING";
  const statusTone = status === "LIVE"
    ? "border-primary/25 bg-primary/10 text-primary"
    : status === "PARTIAL" || status === "DELAYED"
      ? "border-danger/25 bg-danger/10 text-danger"
      : "border-border bg-surface text-muted";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-[58px] shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary">
          <Waves className="h-3.5 w-3.5" />
        </span>
        <div className="mr-1 min-w-0">
          <div className="text-xs font-semibold">Gamma Orderflow Terminal</div>
          <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted">Explainable profile change - mapped futures response</div>
        </div>

        <KwantSelect
          value={sourceFilter}
          onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)}
          menuLabel="Options source"
          className="h-8 min-w-32 rounded-xl border border-border bg-surface px-2.5 text-[10px] font-semibold"
        >
          <option value="COMBINED">NDX + QQQ</option>
          <option value="NDX">NDX options</option>
          <option value="QQQ">QQQ options</option>
        </KwantSelect>

        <KwantSelect
          value={execution}
          onChange={(event) => setExecution(event.target.value as ExecutionInstrument)}
          menuLabel="Execution instrument"
          className="h-8 min-w-24 rounded-xl border border-border bg-surface px-2.5 text-[10px] font-semibold"
        >
          <option value="NQ">NQ</option>
          <option value="MNQ">MNQ</option>
        </KwantSelect>

        <KwantSelect
          value="PROFILE"
          onChange={() => undefined}
          menuLabel="Flow model"
          className="h-8 min-w-44 rounded-xl border border-border bg-surface px-2.5 text-[10px] font-semibold"
        >
          <option value="PROFILE">Profile GEX orderflow</option>
          <option value="CLASSIFIED" disabled>Classified GEX - OPRA required</option>
          <option value="DEALER" disabled>Estimated dealer GEX - OPRA required</option>
        </KwantSelect>

        <KwantSelect
          value={signAdapter}
          onChange={(event) => setSignAdapter(event.target.value as SignAdapter)}
          menuLabel="Sign convention"
          className="h-8 min-w-36 rounded-xl border border-border bg-surface px-2.5 text-[10px] font-semibold"
        >
          <option value="DEALER_NET">Dealer-signed net</option>
          <option value="CALL_MINUS_PUT">Call minus put</option>
        </KwantSelect>

        <button
          type="button"
          onClick={() => setShowEvents((current) => !current)}
          className={`h-8 rounded-xl border px-2.5 text-[9px] font-semibold transition ${showEvents ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-surface text-muted"}`}
        >
          Events {showEvents ? "ON" : "OFF"}
        </button>

        <span className={`ml-auto flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-semibold ${statusTone}`}>
          <Radio className={`h-2.5 w-2.5 ${status === "LIVE" ? "animate-pulse" : ""}`} />
          {status}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_268px]">
        <div className="relative min-h-0 overflow-hidden border-r border-border bg-background">
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="text-[8px] font-semibold text-muted">OPTIONS SOURCE <strong className="ml-1 text-foreground">{sourceFilter === "COMBINED" ? "NDX + QQQ" : sourceFilter}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-[8px] font-semibold text-muted">DISPLAY <strong className="ml-1 text-foreground">{execution}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-[8px] font-semibold text-muted">EXPIRY <strong className="ml-1 text-foreground">FRONT - {history?.expiration ?? "--"}</strong></span>
          </div>

          {geometry && sourceMatches ? (
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="h-full w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label="Gamma profile orderflow histogram with mapped NQ price and significant call and put events"
            >
              <defs>
                <linearGradient id="gexPriceGlow" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--foreground)" stopOpacity="0.16" />
                  <stop offset="1" stopColor="var(--foreground)" stopOpacity="0" />
                </linearGradient>
                <filter id="gexMarkerGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {geometry.priceTicks.map((price) => {
                const y = geometry.priceY(price);
                return (
                  <g key={price}>
                    <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke="var(--grid-color)" strokeWidth="1" />
                    <text x={PLOT_RIGHT + 10} y={y + 3} fill="var(--muted)" fontSize="8" fontFamily="var(--font-mono)">{price.toFixed(0)}</text>
                  </g>
                );
              })}
              {geometry.timeIndexes.map((index) => {
                const x = geometry.x(index);
                return (
                  <g key={`${index}:${profilePoints[index]?.timestamp}`}>
                    <line x1={x} x2={x} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="var(--grid-color)" strokeWidth="1" />
                    <text x={x} y={SVG_HEIGHT - 14} textAnchor="middle" fill="var(--muted)" fontSize="8" fontFamily="var(--font-mono)">{formatTimestamp(profilePoints[index]?.timestamp ?? null)}</text>
                  </g>
                );
              })}

              <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={FLOW_ZERO_Y} y2={FLOW_ZERO_Y} stroke="var(--muted)" strokeOpacity="0.65" strokeWidth="1" strokeDasharray="4 5" />
              <text x={PLOT_LEFT - 8} y={FLOW_ZERO_Y + 3} textAnchor="end" fill="var(--muted)" fontSize="7" fontFamily="var(--font-mono)">0</text>
              <text x={PLOT_LEFT - 8} y={geometry.flowY(geometry.flowScale) + 3} textAnchor="end" fill="var(--primary)" fontSize="7" fontFamily="var(--font-mono)">{compact(geometry.flowScale)}</text>
              <text x={PLOT_LEFT - 8} y={geometry.flowY(-geometry.flowScale) + 3} textAnchor="end" fill="var(--primary)" fontSize="7" fontFamily="var(--font-mono)">{compact(-geometry.flowScale)}</text>

              {profilePoints.map((point, index) => {
                const x = geometry.x(index);
                const y = geometry.flowY(point.flow);
                const height = Math.max(1, Math.abs(FLOW_ZERO_Y - y));
                const selected = index === selectedIndex;
                return (
                  <rect
                    key={point.timestamp}
                    x={x - geometry.barWidth / 2}
                    y={point.flow >= 0 ? y : FLOW_ZERO_Y}
                    width={geometry.barWidth}
                    height={height}
                    rx="0.6"
                    fill="var(--primary)"
                    fillOpacity={selected ? 1 : 0.66}
                    stroke={selected ? "var(--foreground)" : "none"}
                    strokeWidth={selected ? 0.8 : 0}
                    className="cursor-pointer"
                    onClick={() => setSelectedIndex(index)}
                  >
                    <title>{formatTimestamp(point.timestamp, true)} ET - GEXOF {compact(point.flow)}</title>
                  </rect>
                );
              })}

              {showEvents ? events.map((event) => {
                const startX = geometry.x(event.pointIndex);
                const endX = geometry.x(event.endIndex);
                const y = geometry.priceY(event.price);
                const color = event.side === "CALL" ? "var(--accent)" : "var(--danger)";
                const opacity = Math.min(1, 0.35 + event.score / 150);
                return (
                  <g key={event.id} className="cursor-pointer" onClick={() => setSelectedIndex(event.pointIndex)}>
                    <line x1={startX} x2={endX} y1={y} y2={y} stroke={color} strokeWidth={event.score >= 90 ? 2.2 : 1.1} strokeOpacity={opacity} filter={event.score >= 90 ? "url(#gexMarkerGlow)" : undefined} />
                    <circle cx={startX} cy={y} r={event.score >= 90 ? 3 : 2} fill={color} fillOpacity={opacity} />
                    {event.score >= 90 ? <text x={Math.min(endX + 4, PLOT_RIGHT - 74)} y={y - 4} fill={color} fontSize="6.5" fontWeight="600">{event.side} {event.state} - {event.score}</text> : null}
                  </g>
                );
              }) : null}

              <path d={`${geometry.pricePath} L${geometry.x(profilePoints.length - 1)},${PLOT_BOTTOM} L${geometry.x(0)},${PLOT_BOTTOM} Z`} fill="url(#gexPriceGlow)" opacity="0.28" />
              <path d={geometry.pricePath} fill="none" stroke="var(--foreground)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />

              {selectedPoint ? (
                <g pointerEvents="none">
                  <line x1={geometry.x(selectedIndex)} x2={geometry.x(selectedIndex)} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.65" strokeDasharray="3 4" />
                  <circle cx={geometry.x(selectedIndex)} cy={geometry.priceY(selectedPoint.price)} r="3" fill="var(--background)" stroke="var(--foreground)" strokeWidth="1.5" />
                </g>
              ) : null}
            </svg>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div>
                <CircleDot className={`mx-auto h-6 w-6 text-primary ${historyLoading ? "animate-pulse" : ""}`} />
                <div className="mt-3 text-[10px] font-semibold">{historyLoading ? "Aligning gamma profile and futures history" : "Profile history unavailable"}</div>
                <div className="mt-2 max-w-sm text-[8px] leading-5 text-muted">{historyError || "The terminal is waiting for real timestamped profile frames. No synthetic flow will be drawn."}</div>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 text-[8px] backdrop-blur-sm">
            <span className="flex items-center gap-1 text-foreground"><i className="h-px w-3 bg-foreground" />{execution} PRICE</span>
            <span className="flex items-center gap-1 text-primary"><i className="h-2 w-1 bg-primary" />PROFILE GEXOF</span>
            <span className="flex items-center gap-1 text-accent"><i className="h-px w-3 bg-accent" />CALL EVENT</span>
            <span className="flex items-center gap-1 text-danger"><i className="h-px w-3 bg-danger" />PUT EVENT</span>
          </div>
        </div>

        <aside className="min-h-0 overflow-y-auto bg-panel">
          <div className="border-b border-border px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Current state</div>
                <div className="mt-1 font-mono text-[17px] font-semibold text-foreground">{formatPrice(livePrice ?? latest?.price ?? null)}</div>
              </div>
              <span className="rounded-lg border border-border bg-background px-2 py-1 font-mono text-[9px] text-muted">{execution}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
              {[
                ["0DTE NET", sourceExposureLabel(payload, sourceFilter, "0DTE")],
                ["1DTE NET", sourceExposureLabel(payload, sourceFilter, "1DTE")],
                ["GEXOF", compact(latest?.flow ?? null)],
                ["NET PROFILE", compact(latest?.net ?? null)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 bg-background px-2.5 py-2">
                  <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
                  <div className="mt-1 truncate font-mono text-[10px] font-semibold text-foreground" title={value}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-3 py-3">
            <div className="flex items-center gap-2">
              <Crosshair className="h-3.5 w-3.5 text-primary" />
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Selected spike</div>
              <span className="ml-auto font-mono text-[9px] text-muted">{formatTimestamp(selectedPoint?.timestamp ?? null, true)} ET</span>
            </div>
            <div className={`mt-3 font-mono text-[18px] font-semibold ${(selectedPoint?.flow ?? 0) >= 0 ? "text-primary" : "text-danger"}`}>{compact(selectedPoint?.flow ?? null)}</div>
            <div className="mt-1 text-[9px] text-muted">Profile GEX orderflow - {signAdapter === "DEALER_NET" ? "delta call + delta put" : "delta call - delta put"}</div>
            <div className="mt-3 space-y-1.5 text-[9px]">
              <div className="flex justify-between gap-3"><span className="text-muted">Call GEX change</span><span className="font-mono text-primary">{compact(selectedPoint?.callChange ?? null)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted">Put GEX change</span><span className="font-mono text-danger">{compact(selectedPoint?.putChange ?? null)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted">Mapped futures</span><span className="font-mono text-foreground">{formatPrice(selectedPoint?.price ?? null)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted">Event significance</span><span className="font-mono text-foreground">{selectedEvent ? `${selectedEvent.score}/100` : "Below marker threshold"}</span></div>
            </div>
            <div className="mt-3 rounded-lg border border-border bg-background px-2.5 py-2">
              <div className={`text-[9px] font-semibold ${confirmation.tone}`}>{confirmation.label}</div>
              <div className="mt-1 text-[8px] leading-4 text-muted">Aligned next-bucket price response - {confirmation.detail}. This is not MBO absorption.</div>
            </div>
          </div>

          <div className="border-b border-border px-3 py-3">
            <div className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-accent" /><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Dominant mapped strikes</span></div>
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[54px_1fr_1fr] bg-background px-2 py-1.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted"><span>Price</span><span className="text-right">Call change</span><span className="text-right">Put change</span></div>
              {selectedContributors.length ? selectedContributors.map((row) => (
                <div key={row.price} className="grid grid-cols-[54px_1fr_1fr] border-t border-border bg-panel px-2 py-1.5 font-mono text-[9px]">
                  <span className="text-foreground">{row.price.toFixed(0)}</span>
                  <span className="truncate text-right text-primary">{compact(row.callChange)}</span>
                  <span className="truncate text-right text-danger">{compact(row.putChange)}</span>
                </div>
              )) : <div className="border-t border-border px-2 py-4 text-center text-[9px] text-muted">No strike changes in this bucket</div>}
            </div>
          </div>

          <div className="px-3 py-3">
            <div className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-primary" /><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Data health</span></div>
            <div className="mt-2 space-y-1.5 text-[9px]">
              <div className="flex justify-between gap-2"><span className="text-muted">KwantData profile</span><span className="font-mono text-foreground">{ageLabel(history?.asOf)} old</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Databento futures</span><span className="font-mono text-foreground">{history?.nqPrices.length ?? 0} aligned bars</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">Mapping coverage</span><span className={`font-mono ${(history?.mappingCoverage ?? 0) >= 0.8 ? "text-primary" : "text-danger"}`}>{((history?.mappingCoverage ?? 0) * 100).toFixed(0)}%</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted">OPRA classification</span><span className="font-mono text-muted">NOT VERIFIED</span></div>
            </div>
            <div className="mt-3 flex items-start gap-2 border-t border-border pt-2 text-[8px] leading-4 text-muted">
              {history?.errors.length ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-danger" /> : <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary" />}
              <span>{history?.errors.length ? history.errors.join(" | ") : "Observed price and calculated profile change remain separated. No dealer identity or transaction intent is claimed."}</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex min-h-7 shrink-0 items-center justify-between gap-3 border-t border-border bg-panel px-3 py-1 text-[8px] text-muted">
        <span>PROFILE GEX ORDERFLOW - changes in calculated exposure snapshots, not exact transaction intent.</span>
        <span className="font-mono">{history?.sessionDate ?? payload.sessionDate} - {profilePoints.length} frames - {events.length} significant events</span>
      </div>
    </div>
  );
}
