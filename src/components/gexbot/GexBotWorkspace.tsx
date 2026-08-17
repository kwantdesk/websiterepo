"use client";

import {
  Activity,
  BarChart3,
  BookOpen,
  CircleHelp,
  Dna,
  Gauge,
  Layers3,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ProfessionalOrderflowChart, ProfessionalProfileChart, ProfessionalStateChart } from "@/components/gexbot/GexBotCharts";
import KwantSelect from "@/components/ui/KwantSelect";
import { GEX_BOX_ORDERFLOW_METRICS, type OrderflowMetric } from "@/lib/gex-box/domain";
import { normalizeReplayFrames, replayFrameAtOrBefore, replayFramesAtOrBefore } from "@/lib/gex-box/replay";
import { parseGexResearchCommand, serializeGexResearchCommand, type GexResearchRequest } from "@/lib/gex-box/research";
import type {
  GexBotMaxChangeFrame,
  GexBotOrderflowFrame,
  GexBotProfileFrame,
  GexBotStrike,
  GexBotTerminalEnvelope,
} from "@/lib/gexBotTypes";
import { readWorkspaceData, writeWorkspaceData } from "@/lib/workspaceDataCache";

type View = "classic" | "state" | "orderflow" | "research";
type Expiry = "full" | "zero" | "one";
type Dataset = "volume" | "oi" | "both";
type StateMetric = "gex" | "gamma" | "delta" | "vanna" | "charm";
type LineStyle = "solid" | "short" | "dash" | "dot";
type ProfileEnvelope = GexBotTerminalEnvelope<GexBotProfileFrame | GexBotOrderflowFrame>;
type ReplayData = {
  key: string;
  date: string | null;
  frames: Array<GexBotProfileFrame | GexBotOrderflowFrame>;
  error: string | null;
};

type Appearance = {
  positive: string;
  negative: string;
  prior: string;
  spot: string;
  showPositive: boolean;
  showNegative: boolean;
  showPriors: boolean;
  showSpot: boolean;
  showZero: boolean;
  showMajors: boolean;
  lineStyle: LineStyle;
  dotSize: number;
  multiplier: number;
};

type SpotSample = { timestamp: number; spot: number; zeroGamma?: number | null };

const STORAGE_KEY = "kwantdesk:gex-box:workspace:v1";
const LEGACY_STORAGE_KEY = "kwantdesk:gexbot:workspace:v2";
const SPOT_STORAGE_KEY = "kwantdesk:gexbot:spot-tape:v1";
const ORDERFLOW_STORAGE_KEY = "kwantdesk:gexbot:orderflow-tape:v1";
const FRAME_STORAGE_PREFIX = "kwantdesk:gexbot:last-verified:v1:";
const DEFAULT_APPEARANCE: Appearance = {
  positive: "#6fe36a",
  negative: "#ff4f62",
  prior: "#8bcfff",
  spot: "#ffffff",
  showPositive: true,
  showNegative: true,
  showPriors: true,
  showSpot: true,
  showZero: true,
  showMajors: true,
  lineStyle: "dash",
  dotSize: 3.2,
  multiplier: 1,
};

const TICKERS = ["NQ_NDX", "ES_SPX", "NDX", "QQQ", "SPX", "SPY", "RUT", "IWM", "VIX"];
const VIEW_META = {
  classic: { label: "CLASSIC", icon: BarChart3, detail: "GEX profile by strike" },
  state: { label: "STATE", icon: Layers3, detail: "Exposure state profiles" },
  orderflow: { label: "ORDER FLOW", icon: Waves, detail: "Three synchronized flow panels" },
  research: { label: "RESEARCH", icon: BookOpen, detail: "Validated chart command builder" },
} satisfies Record<View, { label: string; icon: typeof BarChart3; detail: string }>;

const ORDERFLOW_METRICS = [
  { key: "dex_orderflow", id: "dexoflow", one: "one_dexoflow", label: "DEX orderflow", color: "#70e9ff", description: "Directional options pressure expressed in delta-weighted terms." },
  { key: "gex_orderflow", id: "gexoflow", one: "one_gexoflow", label: "GEX orderflow", color: "#8dff62", description: "The gamma sensitivity carried by current directional flow." },
  { key: "convexity_orderflow", id: "cvroflow", one: "one_cvroflow", label: "Convexity orderflow", color: "#bd8cff", description: "Whether participants are acquiring or supplying convexity." },
  { key: "net_gex", id: "zgr", one: "ogr", label: "Net GEX", color: "#ffdc5f", description: "Provider-native current and next-expiry net gamma state." },
  { key: "net_convexity", id: "zcvr", one: "ocvr", label: "Net convexity", color: "#ff79bf", description: "Current and next-expiry convexity state." },
  { key: "aggregate_dex", id: "agg_dex", one: "one_agg_dex", label: "Aggregate DEX", color: "#ffb347", description: "Cumulative underlying-equivalent delta exposure." },
  { key: "net_negative_vanna", id: "zvanna", one: "ovanna", label: "Net negative Vanna", color: "#59d9b4", description: "Provider-native negative-Vanna state by expiry bucket." },
  { key: "net_charm", id: "zcharm", one: "ocharm", label: "Net Charm", color: "#ff8b6b", description: "Provider-native Charm state by expiry bucket." },
] as const satisfies ReadonlyArray<{ key: OrderflowMetric; id: string; one: string; label: string; color: string; description: string }>;

function categoryFor(view: View, expiry: Expiry, metric: StateMetric) {
  if (view === "research") return "research";
  if (view === "orderflow") return "orderflow";
  if (view === "classic") return expiry === "full" ? "gex_full" : expiry === "zero" ? "gex_zero" : "gex_one";
  if (metric === "gex") return `gex_${expiry}`;
  return expiry === "full" ? metric : `${metric}_${expiry}`;
}

function cacheKey(view: View, ticker: string, category: string) {
  return `gexbot:${view}:${ticker}:${category}`;
}

function tickerLabel(ticker: string) {
  if (ticker === "NQ_NDX") return "NQ / NDX";
  if (ticker === "ES_SPX") return "ES / SPX";
  return ticker;
}

function newYorkReplayTime(timestamp: number | null) {
  if (!timestamp) return "--:--:-- ET";
  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp)} ET`;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compact(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (absolute >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  if (absolute >= 100) return value.toFixed(1);
  if (absolute >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}

function price(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeLabel(timestamp: number | undefined) {
  if (!timestamp) return "Waiting for frame";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

function dashArray(style: LineStyle) {
  if (style === "short") return "5 4";
  if (style === "dash") return "10 7";
  if (style === "dot") return "2 6";
  return undefined;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left text-[11px] text-muted transition hover:bg-surface hover:text-foreground"
    >
      <span>{label}</span>
      <span className={`relative h-4 w-7 rounded-full border transition ${checked ? "border-primary/50 bg-primary/25" : "border-border bg-background"}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition ${checked ? "left-[13px] bg-primary shadow-[0_0_8px_var(--primary)]" : "left-0.5 bg-muted"}`} />
      </span>
    </button>
  );
}

function EmptyState({ envelope, loading }: { envelope: ProfileEnvelope | null; loading: boolean }) {
  if (loading && !envelope) {
    return (
      <div className="flex min-h-[420px] flex-1 items-center justify-center bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--primary)_8%,transparent),transparent_42%)]">
        <div className="text-center">
          <Dna className="mx-auto h-8 w-8 animate-pulse text-primary drop-shadow-[0_0_18px_var(--primary)]" />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Loading GEX BOX</p>
          <p className="mt-1 text-[10px] text-muted">Restoring the latest verified options frame.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-[420px] flex-1 items-center justify-center px-6">
      <div className="max-w-md rounded-3xl border border-border bg-background/55 p-7 text-center shadow-[0_22px_80px_rgba(0,0,0,.28)]">
        <CircleHelp className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-4 text-sm font-semibold text-foreground">
          {envelope?.entitlementRequired ? "This provider package is not enabled" : "GEX BOX frame unavailable"}
        </h3>
        <p className="mt-2 text-[11px] leading-5 text-muted">
          {envelope?.entitlementRequired
            ? "The workspace is ready, but the connected provider entitlement does not include this product. Classic, State, and Order Flow access can be enabled independently."
            : envelope?.error ?? "The last verified frame will appear here as soon as the server reconnects."}
        </p>
      </div>
    </div>
  );
}

function ProfileChart({
  frame,
  dataset,
  appearance,
  spotTape,
  priorIndex,
  onHover,
}: {
  frame: GexBotProfileFrame;
  dataset: Dataset;
  appearance: Appearance;
  spotTape: SpotSample[];
  priorIndex: number;
  onHover: (strike: GexBotStrike | null) => void;
}) {
  const strikes = useMemo(() => {
    const ordered = [...frame.strikes].sort((a, b) => a[0] - b[0]);
    if (ordered.length <= 62) return ordered;
    const center = ordered.reduce((best, entry, index) => (
      Math.abs(entry[0] - frame.spot) < Math.abs(ordered[best][0] - frame.spot) ? index : best
    ), 0);
    const start = Math.max(0, Math.min(ordered.length - 62, center - 31));
    return ordered.slice(start, start + 62);
  }, [frame.spot, frame.strikes]);
  const minStrike = strikes[0]?.[0] ?? frame.spot - 1;
  const maxStrike = strikes.at(-1)?.[0] ?? frame.spot + 1;
  const span = Math.max(1, maxStrike - minStrike);
  const yFor = (value: number) => 728 - ((value - minStrike) / span) * 680;
  const centerX = 705;
  const maxExposure = Math.max(1, ...strikes.flatMap((entry) => {
    const values = dataset === "volume" ? [entry[1]] : dataset === "oi" ? [entry[2]] : [entry[1], entry[2]];
    return values.map((value) => Math.abs(value * appearance.multiplier));
  }));
  const widthFor = (value: number) => Math.min(400, Math.abs(value * appearance.multiplier) / maxExposure * 390);
  const visibleTape = spotTape.filter((entry) => entry.spot >= minStrike && entry.spot <= maxStrike).slice(-260);
  const pricePath = visibleTape.length > 1
    ? visibleTape.map((entry, index) => {
        const x = 36 + index / Math.max(1, visibleTape.length - 1) * 510;
        return `${index ? "L" : "M"}${x.toFixed(2)},${yFor(entry.spot).toFixed(2)}`;
      }).join(" ")
    : "";
  const zeroY = frame.zero_gamma === null ? null : yFor(frame.zero_gamma);
  const posMajor = dataset === "oi" ? frame.major_pos_oi : frame.major_pos_vol;
  const negMajor = dataset === "oi" ? frame.major_neg_oi : frame.major_neg_vol;

  return (
    <svg viewBox="0 0 1200 760" className="block h-auto w-full select-none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="gexbot-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="gexbot-price" x1="0" x2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity=".25" />
          <stop offset="1" stopColor="#99f7ff" />
        </linearGradient>
      </defs>
      <rect width="1200" height="760" fill="color-mix(in srgb, var(--background) 92%, black)" />
      {Array.from({ length: 13 }).map((_, index) => (
        <line key={`v-${index}`} x1={index * 100} x2={index * 100} y1="0" y2="760" stroke="var(--border)" strokeOpacity=".38" />
      ))}
      {strikes.map((entry) => (
        <line key={`grid-${entry[0]}`} x1="0" x2="1200" y1={yFor(entry[0])} y2={yFor(entry[0])} stroke="var(--border)" strokeOpacity=".24" />
      ))}
      <line x1={centerX} x2={centerX} y1="0" y2="760" stroke="var(--muted)" strokeOpacity=".55" strokeDasharray="3 4" />

      {zeroY !== null && appearance.showZero ? (
        <g>
          <line x1="0" x2="1200" y1={zeroY} y2={zeroY} stroke="#f0be36" strokeWidth="1.6" strokeDasharray={dashArray(appearance.lineStyle)} opacity=".8" />
          <rect x="1085" y={zeroY - 12} width="110" height="24" rx="6" fill="#d6a91f" />
          <text x="1140" y={zeroY + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#080808">ZERO {price(frame.zero_gamma)}</text>
        </g>
      ) : null}
      {appearance.showMajors && posMajor !== null ? (
        <line x1="0" x2="1200" y1={yFor(posMajor)} y2={yFor(posMajor)} stroke={appearance.positive} strokeWidth="1.5" strokeDasharray={dashArray(appearance.lineStyle)} opacity=".72" />
      ) : null}
      {appearance.showMajors && negMajor !== null ? (
        <line x1="0" x2="1200" y1={yFor(negMajor)} y2={yFor(negMajor)} stroke={appearance.negative} strokeWidth="1.5" strokeDasharray={dashArray(appearance.lineStyle)} opacity=".72" />
      ) : null}

      {pricePath ? <path d={pricePath} fill="none" stroke="url(#gexbot-price)" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null}

      {strikes.map((entry) => {
        const [strike, volume, oi, priors] = entry;
        const rowY = yFor(strike);
        const values = dataset === "volume" ? [{ value: volume, opacity: .92, height: 7 }]
          : dataset === "oi" ? [{ value: oi, opacity: .92, height: 7 }]
            : [{ value: volume, opacity: .9, height: 7 }, { value: oi, opacity: .35, height: 3 }];
        return (
          <g key={strike} onMouseEnter={() => onHover(entry)} onMouseLeave={() => onHover(null)} className="cursor-crosshair">
            <rect x="0" y={rowY - 7} width="1200" height="14" fill="transparent" />
            <text x="10" y={rowY + 4} fill="var(--muted)" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{price(strike)}</text>
            {values.map(({ value, opacity, height }, index) => {
              if (value >= 0 && !appearance.showPositive) return null;
              if (value < 0 && !appearance.showNegative) return null;
              const width = widthFor(value);
              return (
                <rect
                  key={`${strike}-${index}`}
                  x={value >= 0 ? centerX : centerX - width}
                  y={rowY - height / 2 + (index ? 2 : 0)}
                  width={width}
                  height={height}
                  rx="1.5"
                  fill={value >= 0 ? appearance.positive : appearance.negative}
                  opacity={opacity}
                />
              );
            })}
            {appearance.showPriors ? priors.map((prior, index) => {
              const x = centerX + Math.sign(prior || 1) * widthFor(prior);
              return (
                <circle
                  key={`${strike}-prior-${index}`}
                  cx={x}
                  cy={rowY}
                  r={index === priorIndex ? appearance.dotSize + 1.6 : appearance.dotSize}
                  fill={index === priorIndex ? "#ffffff" : appearance.prior}
                  opacity={index === priorIndex ? 1 : Math.max(.28, .9 - index * .11)}
                />
              );
            }) : null}
          </g>
        );
      })}

      {appearance.showSpot ? (
        <g filter="url(#gexbot-glow)">
          <line x1="0" x2="1200" y1={yFor(frame.spot)} y2={yFor(frame.spot)} stroke={appearance.spot} strokeWidth="1.4" opacity=".86" />
          <rect x="0" y={yFor(frame.spot) - 13} width="78" height="26" rx="6" fill={appearance.spot} />
          <text x="39" y={yFor(frame.spot) + 4} textAnchor="middle" fill="#080808" fontSize="10" fontWeight="800">{price(frame.spot)}</text>
        </g>
      ) : null}
      <text x="20" y="24" fill="var(--muted)" fontSize="10" fontWeight="700" letterSpacing="2">PRICE PATH</text>
      <text x={centerX + 10} y="24" fill="var(--muted)" fontSize="10" fontWeight="700" letterSpacing="2">EXPOSURE BY STRIKE</text>
      <text x={centerX - 24} y="748" textAnchor="end" fill={appearance.negative} fontSize="9" fontWeight="700">NEGATIVE / PUT</text>
      <text x={centerX + 24} y="748" fill={appearance.positive} fontSize="9" fontWeight="700">POSITIVE / CALL</text>
    </svg>
  );
}

function ProfileSummary({ envelope, dataset, hover }: { envelope: ProfileEnvelope; dataset: Dataset; hover: GexBotStrike | null }) {
  const frame = envelope.frame as GexBotProfileFrame;
  const majors = envelope.majors;
  const maxChange = envelope.maxChange;
  const rows: Array<[string, [number, number] | null | undefined]> = [
    ["1 min", maxChange?.one], ["5 min", maxChange?.five], ["10 min", maxChange?.ten],
    ["15 min", maxChange?.fifteen], ["30 min", maxChange?.thirty],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Spot" value={price(frame.spot)} />
        <Stat label="Zero gamma" value={price(frame.zero_gamma)} tone="amber" />
      </div>
      {hover ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/[.06] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-primary">Strike inspection</p>
          <p className="mt-2 font-mono text-sm font-semibold text-foreground">{price(hover[0])}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <span className="text-muted">Volume <b className="block text-foreground">{compact(hover[1])}</b></span>
            <span className="text-muted">Open interest <b className="block text-foreground">{compact(hover[2])}</b></span>
          </div>
        </div>
      ) : null}
      <SectionTitle>Volume</SectionTitle>
      <SummaryRow label="Major positive" value={price(majors?.mpos_vol ?? frame.major_pos_vol)} positive />
      <SummaryRow label="Major negative" value={price(majors?.mneg_vol ?? frame.major_neg_vol)} negative />
      <SummaryRow label="Net GEX" value={compact(majors?.net_gex_vol ?? frame.sum_gex_vol)} />
      <SectionTitle>Open interest</SectionTitle>
      <SummaryRow label="Major positive" value={price(majors?.mpos_oi ?? frame.major_pos_oi)} positive />
      <SummaryRow label="Major negative" value={price(majors?.mneg_oi ?? frame.major_neg_oi)} negative />
      <SummaryRow label="Net GEX" value={compact(majors?.net_gex_oi ?? frame.sum_gex_oi)} />
      {dataset !== "oi" && rows.some(([, value]) => value) ? (
        <>
          <SectionTitle>Max change GEX</SectionTitle>
          {rows.map(([label, value]) => value ? (
            <div key={label} className="grid grid-cols-[46px_1fr_1fr] gap-2 text-[10px]">
              <span className="text-muted">{label}</span>
              <span className="font-mono text-foreground">{price(value[0])}</span>
              <span className={value[1] >= 0 ? "text-emerald-400" : "text-rose-400"}>{compact(value[1])}</span>
            </div>
          ) : null)}
        </>
      ) : null}
    </div>
  );
}

function SourceDiagnostics({ envelope }: { envelope: ProfileEnvelope | null }) {
  const providerTimestamp = envelope?.frame?.timestamp;
  const freshnessMs = providerTimestamp && envelope
    ? Math.max(0, envelope.checkedAt - providerTimestamp)
    : null;
  const freshness = freshnessMs === null
    ? "Unavailable"
    : freshnessMs < 1_000
      ? "< 1 second"
      : freshnessMs < 60_000
        ? `${Math.round(freshnessMs / 1_000)} seconds`
        : `${Math.round(freshnessMs / 60_000)} minutes`;
  return (
    <div className="space-y-2">
      <SectionTitle>Source diagnostics</SectionTitle>
      <SummaryRow label="Provider" value="GEXBOT" />
      <SummaryRow label="Provider frame" value={timeLabel(providerTimestamp)} />
      <SummaryRow label="Received" value={timeLabel(envelope?.checkedAt)} />
      <SummaryRow label="Freshness" value={freshness} />
      <SummaryRow label="Session" value={envelope?.session ?? "UNAVAILABLE"} />
      <SummaryRow label="History" value={envelope?.historyStatus ?? "UNAVAILABLE"} />
      <SummaryRow label="Entitlement" value={envelope?.entitlementRequired ? "REQUIRED" : envelope?.ok ? "ACTIVE" : "UNKNOWN"} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="rounded-2xl border border-border bg-background/55 p-3">
      <p className="text-[8px] font-semibold uppercase tracking-[.15em] text-muted">{label}</p>
      <p className={`mt-1 font-mono text-xs font-semibold ${tone === "amber" ? "text-amber-400" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="border-b border-border pb-1 text-[9px] font-semibold uppercase tracking-[.18em] text-muted">{children}</p>;
}

function SummaryRow({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[10px]">
      <span className={positive ? "text-emerald-400" : negative ? "text-rose-400" : "text-muted"}>{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function OrderflowPanel({
  metric,
  points,
  hoverIndex,
  setHoverIndex,
}: {
  metric: typeof ORDERFLOW_METRICS[number];
  points: GexBotOrderflowFrame[];
  hoverIndex: number | null;
  setHoverIndex: (index: number | null) => void;
}) {
  const values = points.flatMap((point) => [number(point[metric.id]), number(point[metric.one])]).filter((value): value is number => value !== null);
  const max = Math.max(1, ...values.map(Math.abs));
  const x = (index: number) => 42 + index / Math.max(1, points.length - 1) * 1050;
  const y = (value: number) => 110 - value / max * 82;
  const line = (field: typeof metric.id | typeof metric.one) => points.flatMap((point, index) => {
    const value = number(point[field]);
    return value === null ? [] : [`${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`];
  }).join(" ");
  const active = hoverIndex === null ? null : points[hoverIndex];
  return (
    <div className="relative min-h-[230px] border-b border-border last:border-b-0">
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em]" style={{ color: metric.color }}>{metric.label}</p>
        <p className="mt-1 max-w-sm text-[9px] text-muted">{metric.description}</p>
      </div>
      <svg viewBox="0 0 1140 220" className="block h-auto w-full" preserveAspectRatio="xMidYMid meet">
        <rect width="1140" height="220" fill="color-mix(in srgb, var(--background) 94%, black)" />
        {Array.from({ length: 12 }).map((_, index) => <line key={index} x1={index * 104} x2={index * 104} y1="0" y2="220" stroke="var(--border)" opacity=".35" />)}
        <line x1="0" x2="1140" y1="110" y2="110" stroke="var(--border)" opacity=".85" />
        <path d={line(metric.id)} fill="none" stroke={metric.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={line(metric.one)} fill="none" stroke="var(--primary)" strokeWidth="1.4" strokeDasharray="6 5" opacity=".75" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => (
          <rect
            key={`${metric.id}-${point.timestamp}`}
            x={Math.max(0, x(index) - 8)} y="0" width="16" height="220" fill="transparent"
            onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex(null)}
          />
        ))}
        {hoverIndex !== null ? <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1="0" y2="220" stroke="white" strokeDasharray="3 4" opacity=".65" /> : null}
      </svg>
      <div className="pointer-events-none absolute bottom-3 right-4 flex gap-4 text-[9px]">
        <span style={{ color: metric.color }}>0DTE {compact(active ? number(active[metric.id]) : number(points.at(-1)?.[metric.id]))}</span>
        <span className="text-primary">1DTE {compact(active ? number(active[metric.one]) : number(points.at(-1)?.[metric.one]))}</span>
      </div>
    </div>
  );
}

function OrderflowSnapshot({ frame, visibleMetrics }: { frame: GexBotOrderflowFrame; visibleMetrics: string[] }) {
  const metrics = ORDERFLOW_METRICS.filter((metric) => visibleMetrics.includes(metric.key));
  const values = metrics.flatMap((metric) => [number(frame[metric.id]), number(frame[metric.one])]).filter((value): value is number => value !== null);
  const maximum = Math.max(1, ...values.map(Math.abs));
  return (
    <div className="mx-auto flex min-h-[620px] w-full max-w-[1500px] flex-col justify-center px-5 py-8">
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[.2em] text-primary">New York close</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-.02em] text-foreground">Final exposure state</h2>
          <p className="mt-1 text-[10px] text-muted">The completed RTH frame remains fixed until the next live New York session.</p>
        </div>
        <div className="rounded-xl border border-border bg-panel px-3 py-2 text-right">
          <p className="text-[8px] uppercase tracking-[.14em] text-muted">Underlying close</p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">{price(frame.spot)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {metrics.map((metric) => {
          const zero = number(frame[metric.id]) ?? 0;
          const one = number(frame[metric.one]) ?? 0;
          const zeroWidth = Math.min(48, Math.abs(zero) / maximum * 48);
          const oneWidth = Math.min(48, Math.abs(one) / maximum * 48);
          return (
            <div key={metric.id} className="rounded-2xl border border-border bg-panel/70 p-4 shadow-[0_18px_50px_rgba(0,0,0,.18)]">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.14em]" style={{ color: metric.color }}>{metric.label}</p><p className="mt-1 text-[9px] leading-4 text-muted">{metric.description}</p></div>
                <Activity className="h-4 w-4 shrink-0 text-muted" />
              </div>
              <div className="relative mt-5 h-10 rounded-xl border border-border bg-background/65">
                <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                <span className="absolute top-2 h-2 rounded-full" style={{ background: metric.color, left: zero >= 0 ? "50%" : `${50 - zeroWidth}%`, width: `${zeroWidth}%`, boxShadow: `0 0 12px ${metric.color}55` }} />
                <span className="absolute bottom-2 h-1.5 rounded-full bg-primary/75" style={{ left: one >= 0 ? "50%" : `${50 - oneWidth}%`, width: `${oneWidth}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[9px]">
                <span className="text-muted">0DTE <b className="ml-1 font-mono text-foreground">{compact(zero)}</b></span>
                <span className="text-right text-muted">1DTE <b className="ml-1 font-mono text-primary">{compact(one)}</b></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ResearchResponse = {
  ok: boolean;
  request?: GexResearchRequest;
  source?: { provider: string; providerTimestamp: number; checkedAt: number; session: string; simulated: boolean };
  spot?: number;
  rows?: Array<{ strike: number; volumeExposure: number; openInterestExposure: number; priors: number[] }>;
  error?: string;
};

function ResearchSurface({ ticker }: { ticker: string }) {
  const initialSymbol = ticker === "NQ_NDX" ? "NQ" : ticker === "ES_SPX" ? "ES" : ticker;
  const [builder, setBuilder] = useState<GexResearchRequest>({ chart: "gex", symbol: initialSymbol, strikes: 15, dteMin: 0, dteMax: 90, view: "profile", calls: "all", puts: "all", combine: true });
  const [command, setCommand] = useState(() => serializeGexResearchCommand({ chart: "gex", symbol: initialSymbol, strikes: 15, dteMin: 0, dteMax: 90, view: "profile", calls: "all", puts: "all", combine: true }));
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [working, setWorking] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([initialSymbol]);

  const patchBuilder = <K extends keyof GexResearchRequest>(key: K, value: GexResearchRequest[K]) => {
    const next = { ...builder, [key]: value };
    setBuilder(next);
    setCommand(serializeGexResearchCommand(next));
  };
  const run = async () => {
    setWorking(true);
    try {
      const parsed = parseGexResearchCommand(command);
      setBuilder(parsed);
      const response = await fetch(`/api/gex-box/research?command=${encodeURIComponent(serializeGexResearchCommand(parsed))}`, { cache: "no-store" });
      setResult(await response.json() as ResearchResponse);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Research request failed." });
    } finally {
      setWorking(false);
    }
  };
  const rows = result?.rows ?? [];
  const max = Math.max(1, ...rows.map((row) => Math.abs(builder.chart === "oi" ? row.openInterestExposure : row.volumeExposure)));

  return (
    <div className="grid min-h-full grid-cols-1 gap-3 p-3 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
      <aside className="border border-border bg-panel p-3">
        <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-muted">Watchlists</p>
        <div className="mt-3 space-y-1">
          {watchlist.map((symbol) => <button key={symbol} type="button" onClick={() => patchBuilder("symbol", symbol)} className={`flex w-full items-center justify-between border px-3 py-2 text-left font-mono text-[10px] ${builder.symbol === symbol ? "border-primary/45 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}><span>{symbol}</span><span>›</span></button>)}
        </div>
        <div className="mt-3 flex gap-1">
          <input aria-label="Add research symbol" className="h-8 min-w-0 flex-1 border border-border bg-background px-2 font-mono text-[9px] uppercase outline-none focus:border-primary" placeholder="SPX" onKeyDown={(event) => { if (event.key !== "Enter") return; const symbol = event.currentTarget.value.trim().toUpperCase(); if (/^[A-Z][A-Z0-9._-]{0,11}$/.test(symbol)) { setWatchlist((current) => [...new Set([...current, symbol])]); event.currentTarget.value = ""; } }} />
          <span className="flex h-8 items-center border border-border px-2 text-[8px] text-muted">ENTER</span>
        </div>
      </aside>
      <section className="min-w-0 border border-border bg-[#050607]">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Search className="h-3.5 w-3.5 text-primary" />
          <input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} className="h-9 min-w-[260px] flex-1 border border-border bg-background px-3 font-mono text-[10px] text-foreground outline-none focus:border-primary/55" aria-label="GEX BOX research command" />
          <button type="button" onClick={() => void run()} disabled={working} className="h-9 border border-primary/45 bg-primary/15 px-4 text-[9px] font-bold uppercase tracking-[.16em] text-primary disabled:opacity-50">{working ? "RUNNING" : "RUN"}</button>
        </div>
        {!result ? <div className="flex min-h-[500px] items-center justify-center text-center"><div><BookOpen className="mx-auto h-7 w-7 text-primary" /><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.18em]">Validated research workspace</p><p className="mt-2 max-w-md text-[9px] leading-5 text-muted">Commands are parsed into a strict structured request before any provider call. Unsupported tokens are rejected; no model calls the provider directly.</p></div></div>
          : !result.ok ? <div className="flex min-h-[500px] items-center justify-center px-8 text-center"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-400">Research unavailable</p><p className="mt-2 max-w-lg text-[9px] leading-5 text-muted">{result.error}</p></div></div>
            : <div className="min-h-[500px] p-4">
              <div className="mb-5 flex items-end justify-between border-b border-border pb-3"><div><p className="text-[8px] uppercase tracking-[.18em] text-muted">{result.request?.chart.toUpperCase()} · {result.request?.view.toUpperCase()}</p><h2 className="mt-1 font-mono text-lg text-foreground">{result.request?.symbol} <span className="text-primary">{price(result.spot)}</span></h2></div><p className="text-right text-[8px] uppercase tracking-[.13em] text-muted">{result.source?.provider}<br />{timeLabel(result.source?.providerTimestamp)}</p></div>
              <div className="space-y-1.5">{rows.map((row) => { const value = builder.chart === "oi" ? row.openInterestExposure : row.volumeExposure; return <div key={row.strike} className="grid grid-cols-[70px_1fr_90px] items-center gap-3"><span className="font-mono text-[9px] text-muted">{price(row.strike)}</span><div className="relative h-4 border border-border/60 bg-background"><span className="absolute bottom-0 top-0" style={{ width: `${Math.max(1, Math.abs(value) / max * 50)}%`, left: value >= 0 ? "50%" : `${50 - Math.abs(value) / max * 50}%`, background: value >= 0 ? "#67de66" : "#ed5264", opacity: .82 }} /><span className="absolute bottom-0 left-1/2 top-0 w-px bg-muted/50" /></div><span className={value >= 0 ? "text-right font-mono text-[9px] text-emerald-400" : "text-right font-mono text-[9px] text-rose-400"}>{compact(value)}</span></div>; })}</div>
            </div>}
      </section>
      <aside className="border border-border bg-panel p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[.17em]">Research builder</p>
        <p className="mt-1 text-[8px] leading-4 text-muted">Every control round-trips to the command grammar.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-[8px] uppercase tracking-[.14em] text-muted">Chart<KwantSelect value={builder.chart} onChange={(event) => patchBuilder("chart", event.target.value as GexResearchRequest["chart"])} className="mt-1 h-9 w-full border border-border bg-background px-2 text-[9px]"><option value="oi">Open interest</option><option value="gex">GEX</option><option value="dex">DEX</option><option value="vanna">Vanna</option><option value="charm">Charm</option></KwantSelect></label>
          <label className="block text-[8px] uppercase tracking-[.14em] text-muted">Symbol<input value={builder.symbol} onChange={(event) => patchBuilder("symbol", event.target.value.toUpperCase())} className="mt-1 h-9 w-full border border-border bg-background px-2 font-mono text-[9px] outline-none" /></label>
          <label className="block text-[8px] uppercase tracking-[.14em] text-muted">Strikes<input type="number" min="1" max="100" value={builder.strikes} onChange={(event) => patchBuilder("strikes", Math.max(1, Math.min(100, Number(event.target.value))))} className="mt-1 h-9 w-full border border-border bg-background px-2 font-mono text-[9px] outline-none" /></label>
          <div className="grid grid-cols-2 gap-2"><label className="block text-[8px] uppercase tracking-[.14em] text-muted">DTE min<input type="number" min="0" max="730" value={builder.dteMin} onChange={(event) => patchBuilder("dteMin", Number(event.target.value))} className="mt-1 h-9 w-full border border-border bg-background px-2 font-mono text-[9px]" /></label><label className="block text-[8px] uppercase tracking-[.14em] text-muted">DTE max<input type="number" min="0" max="730" value={builder.dteMax} onChange={(event) => patchBuilder("dteMax", Number(event.target.value))} className="mt-1 h-9 w-full border border-border bg-background px-2 font-mono text-[9px]" /></label></div>
          <Toggle checked={builder.combine} label="Combine expirations" onChange={(value) => patchBuilder("combine", value)} />
        </div>
      </aside>
    </div>
  );
}

function SettingsRail({
  view,
  expiry,
  setExpiry,
  metric,
  setMetric,
  dataset,
  setDataset,
  appearance,
  setAppearance,
  visibleMetrics,
  setVisibleMetrics,
}: {
  view: View;
  expiry: Expiry;
  setExpiry: (value: Expiry) => void;
  metric: StateMetric;
  setMetric: (value: StateMetric) => void;
  dataset: Dataset;
  setDataset: (value: Dataset) => void;
  appearance: Appearance;
  setAppearance: React.Dispatch<React.SetStateAction<Appearance>>;
  visibleMetrics: string[];
  setVisibleMetrics: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const update = <K extends keyof Appearance>(key: K, value: Appearance[K]) => setAppearance((current) => ({ ...current, [key]: value }));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Settings2 className="h-4 w-4 text-primary" />
        <div><p className="text-[11px] font-semibold uppercase tracking-[.15em] text-foreground">Adjustments</p><p className="text-[9px] text-muted">Visual and exposure controls</p></div>
      </div>
      {view === "research" ? (
        <div className="border border-border bg-background p-3 text-[9px] leading-5 text-muted">
          Research commands are validated before provider access. This surface does not expose visual profile controls.
        </div>
      ) : view !== "orderflow" ? (
        <>
          <div>
            <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[.16em] text-muted">Expiry set</label>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-background p-1">
              {(["full", "zero", "one"] as Expiry[]).map((item) => (
                <button key={item} type="button" onClick={() => setExpiry(item)} className={`rounded-lg px-2 py-2 text-[9px] font-semibold uppercase transition ${expiry === item ? "bg-primary/15 text-primary" : "text-muted hover:text-foreground"}`}>
                  {item === "full" ? "90D" : item === "zero" ? "0DTE" : "1DTE"}
                </button>
              ))}
            </div>
          </div>
          {view === "state" ? (
            <div>
              <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[.16em] text-muted">State profile</label>
              <KwantSelect value={metric} onChange={(event) => setMetric(event.target.value as StateMetric)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[10px] text-foreground" menuLabel="State profile">
                <option value="gex">GEX profile</option><option value="gamma">Gamma</option><option value="delta">Delta</option><option value="vanna">Vanna</option><option value="charm">Charm</option>
              </KwantSelect>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[.16em] text-muted">Exposure source</label>
              <KwantSelect value={dataset} onChange={(event) => setDataset(event.target.value as Dataset)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[10px] text-foreground" menuLabel="Exposure source">
                <option value="both">Volume + open interest</option><option value="volume">Current-session volume</option><option value="oi">Open interest</option>
              </KwantSelect>
            </div>
          )}
          <div className="space-y-0.5">
            <Toggle checked={appearance.showPositive} label="Positive / call exposure" onChange={(value) => update("showPositive", value)} />
            <Toggle checked={appearance.showNegative} label="Negative / put exposure" onChange={(value) => update("showNegative", value)} />
            <Toggle checked={appearance.showPriors} label="Lookback dots" onChange={(value) => update("showPriors", value)} />
            <Toggle checked={appearance.showSpot} label="Spot line" onChange={(value) => update("showSpot", value)} />
            <Toggle checked={appearance.showZero} label="Zero gamma" onChange={(value) => update("showZero", value)} />
            <Toggle checked={appearance.showMajors} label="Major levels" onChange={(value) => update("showMajors", value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["positive", "negative", "prior"] as const).map((color) => (
              <label key={color} className="rounded-xl border border-border bg-background p-2 text-center text-[8px] uppercase text-muted">
                <input type="color" value={appearance[color]} onChange={(event) => update(color, event.target.value)} className="mb-1 h-6 w-full cursor-pointer rounded-md border-0 bg-transparent" />
                {color}
              </label>
            ))}
          </div>
          <div>
            <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[.16em] text-muted">Line style</label>
            <KwantSelect value={appearance.lineStyle} onChange={(event) => update("lineStyle", event.target.value as LineStyle)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[10px] text-foreground" menuLabel="Line style">
              <option value="solid">Solid</option><option value="short">Short dash</option><option value="dash">Dashed</option><option value="dot">Dotted</option>
            </KwantSelect>
          </div>
          <label className="block text-[8px] font-semibold uppercase tracking-[.16em] text-muted">Lookback dot size
            <input type="range" min="1.5" max="7" step=".5" value={appearance.dotSize} onChange={(event) => update("dotSize", Number(event.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
          </label>
          <label className="block text-[8px] font-semibold uppercase tracking-[.16em] text-muted">Price multiplier
            <input type="number" min=".01" max="100" step=".01" value={appearance.multiplier} onChange={(event) => update("multiplier", Math.max(.01, Number(event.target.value) || 1))} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[10px] text-foreground outline-none focus:border-primary/40" />
          </label>
        </>
      ) : (
        <div className="space-y-1">
          <p className="mb-2 text-[8px] font-semibold uppercase tracking-[.16em] text-muted">Visible panels</p>
          {ORDERFLOW_METRICS.map((item) => (
            <Toggle
              key={item.key}
              checked={visibleMetrics.includes(item.key)}
              label={item.label}
              onChange={(checked) => setVisibleMetrics((current) => checked
                ? [...current.filter((id) => id !== item.key), item.key].slice(-3)
                : current.filter((id) => id !== item.key))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GexBotWorkspace() {
  const urlState = useMemo(() => {
    if (typeof window === "undefined") return null;
    const segments = window.location.pathname.split("/").filter(Boolean);
    const candidate = segments[0] === "gex-box" ? segments[1] : null;
    const params = new URLSearchParams(window.location.search);
    return {
      view: candidate && Object.prototype.hasOwnProperty.call(VIEW_META, candidate) ? candidate as View : null,
      ticker: params.get("ticker"),
    };
  }, []);
  const restored = useMemo(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? "null") as Record<string, unknown> | null; } catch { return null; }
  }, []);
  const restoredView = typeof restored?.view === "string" && Object.prototype.hasOwnProperty.call(VIEW_META, restored.view) ? restored.view as View : "classic";
  const restoredTicker = typeof restored?.ticker === "string" && TICKERS.includes(restored.ticker) ? restored.ticker : "NQ_NDX";
  const [view, setView] = useState<View>(urlState?.view ?? restoredView);
  const [ticker, setTicker] = useState<string>(urlState?.ticker && TICKERS.includes(urlState.ticker) ? urlState.ticker : restoredTicker);
  const [expiry, setExpiry] = useState<Expiry>((restored?.expiry as Expiry) || "full");
  const [stateMetric, setStateMetric] = useState<StateMetric>((restored?.stateMetric as StateMetric) || "gamma");
  const [dataset, setDataset] = useState<Dataset>((restored?.dataset as Dataset) || "both");
  const [appearance, setAppearance] = useState<Appearance>({ ...DEFAULT_APPEARANCE, ...(restored?.appearance as Partial<Appearance> | undefined) });
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>(() => {
    const restoredMetrics = Array.isArray(restored?.visibleMetrics) ? restored.visibleMetrics as string[] : [];
    const migrated = restoredMetrics.map((metric) => ORDERFLOW_METRICS.find((item) => item.key === metric || item.id === metric)?.key).filter((metric): metric is OrderflowMetric => Boolean(metric));
    return (migrated.length ? migrated : ["dex_orderflow", "gex_orderflow", "convexity_orderflow"]).slice(-3);
  });
  const [envelope, setEnvelope] = useState<ProfileEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<GexBotStrike | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [spotTape, setSpotTape] = useState<SpotSample[]>([]);
  const [orderflowTape, setOrderflowTape] = useState<GexBotOrderflowFrame[]>([]);
  const [replayActive, setReplayActive] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(60);
  const [replayTimestamp, setReplayTimestamp] = useState<number | null>(null);
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const category = categoryFor(view, expiry, stateMetric);
  const replayKey = `${ticker}:${view}:${category}`;
  const requestSequence = useRef(0);
  const replaySequence = useRef(0);
  const replayCache = useRef(new Map<string, ReplayData>());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, view, ticker, expiry, stateMetric, dataset, appearance, visibleMetrics }));
    if (window.location.pathname === "/gexbot" || window.location.pathname === "/gex-box" || window.location.pathname.startsWith("/gex-box/")) {
      const params = new URLSearchParams({
        ticker,
        mode: expiry === "full" ? "90d" : expiry === "zero" ? "0dte" : "1dte",
        metric: view === "state" ? stateMetric : dataset,
      });
      window.history.replaceState(window.history.state, "", `/gex-box/${view}?${params.toString()}`);
    }
  }, [appearance, dataset, expiry, stateMetric, ticker, view, visibleMetrics]);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(SPOT_STORAGE_KEY) ?? "{}") as Record<string, SpotSample[]>;
      setSpotTape(Array.isArray(stored[ticker]) ? stored[ticker] : []);
      const orderflowStored = JSON.parse(sessionStorage.getItem(ORDERFLOW_STORAGE_KEY) ?? "{}") as Record<string, GexBotOrderflowFrame[]>;
      setOrderflowTape(Array.isArray(orderflowStored[ticker]) ? orderflowStored[ticker] : []);
    } catch {
      setSpotTape([]); setOrderflowTape([]);
    }
  }, [ticker]);

  const applyEnvelope = useCallback((next: ProfileEnvelope) => {
    setEnvelope(next);
    if (!next.ok || !next.frame) return;
    try {
      localStorage.setItem(`${FRAME_STORAGE_PREFIX}${cacheKey(next.view, next.ticker, next.category)}`, JSON.stringify(next));
    } catch {}
    const historicalFrames = Array.isArray(next.history) ? next.history : [];
    const historicalSamples = historicalFrames.map((entry) => ({ timestamp: entry.timestamp, spot: entry.spot, zeroGamma: entry.zero_gamma }));
    const sample = { timestamp: next.frame.timestamp, spot: next.frame.spot, zeroGamma: next.frame.zero_gamma };
    setSpotTape((current) => {
      const source = historicalSamples.length ? historicalSamples : current;
      const merged = source.at(-1)?.timestamp === sample.timestamp ? [...source.slice(0, -1), sample] : [...source, sample];
      const limited = merged.slice(-480);
      try {
        const stored = JSON.parse(sessionStorage.getItem(SPOT_STORAGE_KEY) ?? "{}") as Record<string, SpotSample[]>;
        stored[ticker] = limited;
        sessionStorage.setItem(SPOT_STORAGE_KEY, JSON.stringify(stored));
      } catch {}
      return limited;
    });
    if (next.view === "orderflow") {
      const frame = next.frame as GexBotOrderflowFrame;
      setOrderflowTape((current) => {
        const historicalOrderflow = historicalFrames as GexBotOrderflowFrame[];
        const source = historicalOrderflow.length ? historicalOrderflow : current;
        const merged = source.at(-1)?.timestamp === frame.timestamp ? [...source.slice(0, -1), frame] : [...source, frame];
        const limited = merged.slice(-6_000);
        try {
          const stored = JSON.parse(sessionStorage.getItem(ORDERFLOW_STORAGE_KEY) ?? "{}") as Record<string, GexBotOrderflowFrame[]>;
          stored[ticker] = limited.slice(-900);
          sessionStorage.setItem(ORDERFLOW_STORAGE_KEY, JSON.stringify(stored));
        } catch {}
        return limited;
      });
    }
  }, [ticker]);

  useEffect(() => {
    if (view === "research") {
      setLoading(false);
      return;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sequence = ++requestSequence.current;
    const cached = readWorkspaceData<ProfileEnvelope>(cacheKey(view, ticker, category));
    let retained: ProfileEnvelope | null = null;
    if (!cached) {
      try {
        retained = JSON.parse(localStorage.getItem(`${FRAME_STORAGE_PREFIX}${cacheKey(view, ticker, category)}`) ?? "null") as ProfileEnvelope | null;
      } catch {}
    }
    const restored = cached ?? retained;
    if (restored && restored.historySimulated !== true) { applyEnvelope(restored); setLoading(false); } else setLoading(true);
    const poll = async () => {
      try {
        const query = new URLSearchParams({ ticker, category, view });
        const response = await fetch(`/api/gex-box/snapshot?${query}`, { cache: "no-store" });
        const result = await response.json() as { provider?: ProfileEnvelope; error?: string };
        const payload = result.provider ?? {
          ok: false, view, ticker, category, session: "DELAYED", marketOpen: false,
          checkedAt: Date.now(), frame: null, majors: null, maxChange: null,
          error: result.error ?? "GEX BOX provider frame was unavailable.",
        } satisfies ProfileEnvelope;
        if (disposed || requestSequence.current !== sequence) return;
        applyEnvelope(payload);
        if (payload.ok) writeWorkspaceData(cacheKey(view, ticker, category), payload);
        timer = setTimeout(poll, payload.marketOpen ? 3_000 : 60_000);
      } catch (error) {
        if (disposed || requestSequence.current !== sequence) return;
        setEnvelope((current) => current ?? {
          ok: false, view, ticker, category, session: "DELAYED", marketOpen: false,
          checkedAt: Date.now(), frame: null, majors: null, maxChange: null,
          error: error instanceof Error ? error.message : "GEXBot could not be reached.",
        });
        timer = setTimeout(poll, 12_000);
      } finally {
        if (!disposed && requestSequence.current === sequence) setLoading(false);
      }
    };
    void poll();
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [applyEnvelope, category, ticker, view]);

  const loadReplay = useCallback(async (resetClock: boolean) => {
    if (view === "research") return;
    const cached = replayCache.current.get(replayKey);
    if (cached) {
      setReplayData(cached);
      setReplayTimestamp((current) => {
        const start = cached.frames[0]?.timestamp;
        const end = cached.frames.at(-1)?.timestamp;
        if (start === undefined || end === undefined) return null;
        if (resetClock || current === null) return start;
        return Math.max(start, Math.min(end, current));
      });
      return;
    }
    const sequence = ++replaySequence.current;
    setReplayLoading(true);
    setReplayPlaying(false);
    setReplayData(null);
    try {
      const query = new URLSearchParams({ ticker, view, category });
      const response = await fetch(`/api/gex-box/history?${query}`, { cache: "no-store" });
      const result = await response.json() as {
        date?: string | null;
        frames?: Array<GexBotProfileFrame | GexBotOrderflowFrame>;
        error?: string;
      };
      if (sequence !== replaySequence.current) return;
      const frames = normalizeReplayFrames(Array.isArray(result.frames) ? result.frames : []);
      const data: ReplayData = {
        key: replayKey,
        date: result.date ?? null,
        frames,
        error: frames.length ? null : result.error ?? "The previous New York session archive is unavailable.",
      };
      if (frames.length) replayCache.current.set(replayKey, data);
      setReplayData(data);
      setReplayTimestamp((current) => {
        if (resetClock || current === null) return frames[0]?.timestamp ?? null;
        const start = frames[0]?.timestamp;
        const end = frames.at(-1)?.timestamp;
        return start === undefined || end === undefined ? null : Math.max(start, Math.min(end, current));
      });
    } catch (error) {
      if (sequence !== replaySequence.current) return;
      setReplayData({
        key: replayKey,
        date: null,
        frames: [],
        error: error instanceof Error ? error.message : "The previous New York session archive is unavailable.",
      });
      setReplayTimestamp(null);
    } finally {
      if (sequence === replaySequence.current) setReplayLoading(false);
    }
  }, [category, replayKey, ticker, view]);

  useEffect(() => {
    if (!replayActive || view === "research") return;
    void loadReplay(false);
  }, [loadReplay, replayActive, view]);

  useEffect(() => {
    if (!replayActive || !replayPlaying || !replayData?.frames.length) return;
    const end = replayData.frames.at(-1)?.timestamp ?? replayData.frames[0].timestamp;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - previous;
      previous = now;
      setReplayTimestamp((current) => {
        if (current === null) return replayData.frames[0]?.timestamp ?? null;
        const next = Math.min(end, current + elapsed * replaySpeed);
        if (next >= end) setReplayPlaying(false);
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [replayActive, replayData, replayPlaying, replaySpeed]);

  const liveFrame = envelope?.ok ? envelope.frame : null;
  const replayFrames = replayData?.key === replayKey ? replayData.frames : [];
  const replayFrame = replayActive && replayTimestamp !== null
    ? replayFrameAtOrBefore(replayFrames, replayTimestamp)
    : null;
  const frame = replayActive ? replayFrame : liveFrame;
  const replayVisibleFrames = replayActive && replayTimestamp !== null
    ? replayFramesAtOrBefore(replayFrames, replayTimestamp)
    : [];
  const displaySpotTape = replayActive
    ? replayVisibleFrames.map((entry) => ({ timestamp: entry.timestamp, spot: entry.spot, zeroGamma: entry.zero_gamma }))
    : spotTape;
  const displayOrderflowTape = replayActive
    ? replayVisibleFrames as GexBotOrderflowFrame[]
    : orderflowTape;
  const replayStart = replayFrames[0]?.timestamp ?? null;
  const replayEnd = replayFrames.at(-1)?.timestamp ?? null;
  const replayProgress = replayTimestamp !== null && replayStart !== null && replayEnd !== null && replayEnd > replayStart
    ? ((replayTimestamp - replayStart) / (replayEnd - replayStart)) * 100
    : 0;
  const isProfile = view !== "orderflow" && view !== "research" && frame;
  const sessionLabel = replayActive && view !== "research"
    ? "REPLAY · PREVIOUS NEW YORK"
    : view === "research"
    ? "VALIDATED REQUESTS"
    : envelope?.session === "LIVE_RTH"
      ? "LIVE · NEW YORK RTH"
      : envelope?.session === "DELAYED"
        ? "DELAYED FRAME"
        : "FROZEN · NEW YORK CLOSE";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-panel/95">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_12%,transparent)]"><Dna className="h-4 w-4 text-primary" /></div>
            <div><h1 className="text-[12px] font-bold uppercase tracking-[.2em]">GEX BOX</h1><p className="mt-0.5 text-[9px] text-muted">Options exposure workstation · verified provider frames</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <KwantSelect value={ticker} onChange={(event) => setTicker(event.target.value)} className="h-9 min-w-[112px] rounded-xl border border-border bg-background px-3 font-mono text-[10px] font-semibold" menuLabel="Options underlying">
              {TICKERS.map((item) => <option key={item} value={item}>{tickerLabel(item)}</option>)}
            </KwantSelect>
            <div className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[9px] font-semibold uppercase tracking-[.12em] ${envelope?.session === "LIVE_RTH" && view !== "research" ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-400" : "border-border bg-background text-muted"}`}>
              {envelope?.session === "LIVE_RTH" && view !== "research" ? <Radio className="h-3 w-3 animate-pulse" /> : view === "research" ? <ShieldCheck className="h-3 w-3 text-primary" /> : <Pause className="h-3 w-3" />}{sessionLabel}
            </div>
            <button type="button" onClick={() => setShowSettings((current) => !current)} className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[9px] font-semibold uppercase tracking-[.12em] transition ${showSettings ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}><SlidersHorizontal className="h-3.5 w-3.5" />Adjust</button>
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto px-4 pb-2 lg:px-6">
          {(Object.keys(VIEW_META) as View[]).map((item) => {
            const Icon = VIEW_META[item].icon;
            return <button key={item} type="button" onClick={() => setView(item)} className={`group flex min-w-[150px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${view === item ? "border-primary/30 bg-primary/10 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_10%,transparent)]" : "border-transparent text-muted hover:border-border hover:bg-surface hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" /><span><b className="block text-[10px] uppercase tracking-[.12em]">{VIEW_META[item].label}</b><small className="block text-[8px] font-normal opacity-70">{VIEW_META[item].detail}</small></span></button>;
          })}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-[radial-gradient(circle_at_55%_30%,color-mix(in_srgb,var(--primary)_3%,transparent),transparent_42%)]">
          <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
            <div className="flex items-center gap-3 text-[9px] text-muted"><span className="font-semibold uppercase tracking-[.15em] text-foreground">{tickerLabel(ticker)} · {VIEW_META[view].label}</span><span>{view === "research" ? "Strict builder · server-side provider access" : timeLabel(frame?.timestamp)}</span>{loading && envelope ? <RefreshCw className="h-3 w-3 animate-spin text-primary" /> : null}</div>
            {view !== "research" ? (
              <div className="flex min-w-0 items-center gap-2">
                {!replayActive ? (
                  <button type="button" onClick={() => { setReplayTimestamp(null); setReplayActive(true); }} className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[8px] font-semibold uppercase text-muted hover:border-primary/30 hover:text-primary"><Play className="h-3 w-3" />Replay previous NY</button>
                ) : (
                  <>
                    <button type="button" disabled={replayLoading || !replayFrames.length} onClick={() => setReplayPlaying((current) => !current)} className="flex h-7 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-[8px] font-semibold uppercase text-primary disabled:opacity-40">{replayPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{replayPlaying ? "Pause" : "Play"}</button>
                    <input aria-label="Previous New York session replay position" type="range" min="0" max="1000" value={Math.round(replayProgress * 10)} disabled={!replayFrames.length} onChange={(event) => {
                      if (replayStart === null || replayEnd === null) return;
                      setReplayPlaying(false);
                      setReplayTimestamp(replayStart + (Number(event.target.value) / 1000) * (replayEnd - replayStart));
                    }} className="h-1 w-28 accent-[var(--primary)]" />
                    <KwantSelect aria-label="Replay speed" value={String(replaySpeed)} onChange={(event) => setReplaySpeed(Number(event.target.value))} className="h-7 rounded-lg border border-border bg-background px-2 font-mono text-[8px] text-foreground">
                      {[1, 5, 15, 60, 120, 300].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
                    </KwantSelect>
                    <span className="whitespace-nowrap font-mono text-[9px] text-primary">{replayLoading ? "Loading session…" : replayData?.error ? "Replay unavailable" : `${replayData?.date ?? "Previous NY"} · ${newYorkReplayTime(replayTimestamp)}`}</span>
                    <button type="button" onClick={() => { setReplayActive(false); setReplayPlaying(false); }} className="h-7 rounded-lg border border-border bg-background px-2 text-[8px] font-semibold uppercase text-muted hover:text-foreground">Live</button>
                  </>
                )}
              </div>
            ) : <div className="flex items-center gap-2 text-[8px] uppercase tracking-[.14em] text-primary"><ShieldCheck className="h-3 w-3" />Validated grammar</div>}
          </div>
          {view === "research" ? <ResearchSurface ticker={ticker} /> : !frame ? (replayActive ? <div className="flex min-h-[420px] flex-1 items-center justify-center"><div className="rounded-xl border border-border bg-panel px-6 py-5 text-center">{replayLoading ? <RefreshCw className="mx-auto h-5 w-5 animate-spin text-primary" /> : null}<p className="mt-2 text-[10px] font-semibold uppercase tracking-[.16em] text-foreground">{replayLoading ? "Loading previous New York session" : "Replay unavailable"}</p><p className="mt-1 max-w-md text-[9px] text-muted">{replayData?.error ?? "Restoring the complete verified session archive."}</p>{!replayLoading ? <button type="button" onClick={() => void loadReplay(true)} className="mt-4 h-8 rounded-lg border border-primary/30 bg-primary/10 px-3 text-[8px] font-semibold uppercase tracking-[.14em] text-primary">Try again</button> : null}</div></div> : <EmptyState envelope={envelope} loading={loading} />) : view === "orderflow" ? (
            <div className="mx-auto w-full max-w-[1680px] overflow-x-auto px-3 py-3">
              {visibleMetrics.length ? (
                <div className="relative">
                  <ProfessionalOrderflowChart
                    metrics={ORDERFLOW_METRICS.filter((metric) => visibleMetrics.includes(metric.key)).slice(0, 3)}
                    points={displayOrderflowTape.length ? displayOrderflowTape : [frame as GexBotOrderflowFrame]}
                  />
                </div>
              ) : <div className="flex min-h-[420px] items-center justify-center text-[10px] text-muted">Choose at least one orderflow panel from Adjustments.</div>}
            </div>
          ) : (
            <div className="flex min-h-[560px] flex-1 items-start overflow-auto">
              <div className="mx-auto min-w-0 flex-1 p-2">
                {view === "state" ? (
                  <ProfessionalStateChart frame={frame as GexBotProfileFrame} metric={stateMetric} appearance={appearance} spotTape={displaySpotTape} priorIndex={0} onHover={setHover} />
                ) : (
                  <ProfessionalProfileChart frame={frame as GexBotProfileFrame} dataset={dataset} appearance={appearance} spotTape={displaySpotTape} priorIndex={0} onHover={setHover} />
                )}
              </div>
            </div>
          )}
        </main>
        {showSettings ? <aside className="w-[272px] shrink-0 overflow-y-auto border-l border-border bg-panel p-4">{isProfile ? <><ProfileSummary envelope={envelope!} dataset={dataset} hover={hover} /><div className="my-4 border-t border-border" /></> : null}{view !== "research" ? <><SourceDiagnostics envelope={envelope} /><div className="my-4 border-t border-border" /></> : null}<SettingsRail view={view} expiry={expiry} setExpiry={setExpiry} metric={stateMetric} setMetric={setStateMetric} dataset={dataset} setDataset={setDataset} appearance={appearance} setAppearance={setAppearance} visibleMetrics={visibleMetrics} setVisibleMetrics={setVisibleMetrics} /></aside> : null}
      </div>
      <footer className="flex min-h-8 shrink-0 items-center justify-between gap-4 border-t border-border bg-panel px-4 text-[8px] uppercase tracking-[.13em] text-muted">
        <span className="flex items-center gap-2"><Gauge className="h-3 w-3 text-primary" />{view === "research" ? "Structured research requests · provider access remains server-side." : "Values are rendered from verified provider frames; classified-flow methodology remains provider-calculated."}</span>
        <span>{view === "research" ? "Strict command grammar" : envelope?.marketOpen ? "Polling every 3 seconds" : "Frozen outside New York RTH"}</span>
      </footer>
    </div>
  );
}
