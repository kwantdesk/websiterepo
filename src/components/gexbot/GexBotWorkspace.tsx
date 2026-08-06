"use client";

import {
  Activity,
  BarChart3,
  CircleHelp,
  Dna,
  Gauge,
  Layers3,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import KwantSelect from "@/components/ui/KwantSelect";
import type {
  GexBotMaxChangeFrame,
  GexBotOrderflowFrame,
  GexBotProfileFrame,
  GexBotStrike,
  GexBotTerminalEnvelope,
} from "@/lib/gexBotTypes";
import { readWorkspaceData, writeWorkspaceData } from "@/lib/workspaceDataCache";

type View = "classic" | "state" | "orderflow";
type Expiry = "full" | "zero" | "one";
type Dataset = "volume" | "oi" | "both";
type StateMetric = "gamma" | "delta" | "vanna" | "charm";
type LineStyle = "solid" | "short" | "dash" | "dot";
type ProfileEnvelope = GexBotTerminalEnvelope<GexBotProfileFrame | GexBotOrderflowFrame>;

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

type SpotSample = { timestamp: number; spot: number };

const STORAGE_KEY = "kwantdesk:gexbot:workspace:v1";
const SPOT_STORAGE_KEY = "kwantdesk:gexbot:spot-tape:v1";
const ORDERFLOW_STORAGE_KEY = "kwantdesk:gexbot:orderflow-tape:v1";
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

const TICKERS = ["NDX", "QQQ", "SPX", "SPY", "RUT", "IWM"];
const VIEW_META = {
  classic: { label: "Classic", icon: BarChart3, detail: "GEX profile by strike" },
  state: { label: "State", icon: Layers3, detail: "Classified exposure state" },
  orderflow: { label: "Orderflow", icon: Waves, detail: "Live exposure flow" },
} satisfies Record<View, { label: string; icon: typeof BarChart3; detail: string }>;

const ORDERFLOW_METRICS = [
  { id: "dexoflow", one: "one_dexoflow", label: "DEX orderflow", color: "#70e9ff", description: "Directional options pressure expressed in delta-weighted terms." },
  { id: "gexoflow", one: "one_gexoflow", label: "GEX orderflow", color: "#8dff62", description: "The gamma sensitivity carried by current directional flow." },
  { id: "cvroflow", one: "one_cvroflow", label: "Convexity orderflow", color: "#bd8cff", description: "Whether participants are acquiring or supplying convexity." },
  { id: "agg_dex", one: "one_agg_dex", label: "Aggregate DEX", color: "#ffb347", description: "Cumulative underlying-equivalent delta exposure." },
  { id: "zgr", one: "ogr", label: "Gamma ratio", color: "#ffdc5f", description: "Current 0DTE and 1DTE gamma balance." },
  { id: "zcvr", one: "ocvr", label: "Net convexity", color: "#ff79bf", description: "Customer long-versus-short convexity state." },
] as const;

function categoryFor(view: View, expiry: Expiry, metric: StateMetric) {
  if (view === "orderflow") return "orderflow";
  if (view === "classic") return expiry === "full" ? "gex_full" : expiry === "zero" ? "gex_zero" : "gex_one";
  return expiry === "full" ? metric : `${metric}_${expiry}`;
}

function cacheKey(view: View, ticker: string, category: string) {
  return `gexbot:${view}:${ticker}:${category}`;
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
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Loading GEX BOT</p>
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
          {envelope?.entitlementRequired ? "This GEXBot package is not enabled" : "GEXBot frame unavailable"}
        </h3>
        <p className="mt-2 text-[11px] leading-5 text-muted">
          {envelope?.entitlementRequired
            ? "The navigation and visual engine are ready, but the current GEXBot key does not include this product. Classic, State, and Orderflow access can be enabled independently."
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
    <svg viewBox="0 0 1200 760" className="h-full min-h-[520px] w-full select-none" preserveAspectRatio="none">
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
      <svg viewBox="0 0 1140 220" className="h-[230px] w-full" preserveAspectRatio="none">
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
      {view !== "orderflow" ? (
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
                <option value="gamma">Gamma</option><option value="delta">Delta</option><option value="vanna">Vanna</option><option value="charm">Charm</option>
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
              key={item.id}
              checked={visibleMetrics.includes(item.id)}
              label={item.label}
              onChange={(checked) => setVisibleMetrics((current) => checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GexBotWorkspace() {
  const restored = useMemo(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Record<string, unknown> | null; } catch { return null; }
  }, []);
  const [view, setView] = useState<View>((restored?.view as View) || "classic");
  const [ticker, setTicker] = useState<string>(typeof restored?.ticker === "string" ? restored.ticker : "NDX");
  const [expiry, setExpiry] = useState<Expiry>((restored?.expiry as Expiry) || "full");
  const [stateMetric, setStateMetric] = useState<StateMetric>((restored?.stateMetric as StateMetric) || "gamma");
  const [dataset, setDataset] = useState<Dataset>((restored?.dataset as Dataset) || "both");
  const [appearance, setAppearance] = useState<Appearance>({ ...DEFAULT_APPEARANCE, ...(restored?.appearance as Partial<Appearance> | undefined) });
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>(Array.isArray(restored?.visibleMetrics) ? restored.visibleMetrics as string[] : ["dexoflow", "gexoflow", "cvroflow", "agg_dex"]);
  const [envelope, setEnvelope] = useState<ProfileEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<GexBotStrike | null>(null);
  const [priorIndex, setPriorIndex] = useState(0);
  const [playingHistory, setPlayingHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [spotTape, setSpotTape] = useState<SpotSample[]>([]);
  const [orderflowTape, setOrderflowTape] = useState<GexBotOrderflowFrame[]>([]);
  const [orderflowHover, setOrderflowHover] = useState<number | null>(null);
  const category = categoryFor(view, expiry, stateMetric);
  const requestSequence = useRef(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ view, ticker, expiry, stateMetric, dataset, appearance, visibleMetrics }));
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
    const historicalFrames = Array.isArray(next.history) ? next.history : [];
    const historicalSamples = historicalFrames.map((entry) => ({ timestamp: entry.timestamp, spot: entry.spot }));
    const sample = { timestamp: next.frame.timestamp, spot: next.frame.spot };
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
        const limited = merged.slice(-900);
        try {
          const stored = JSON.parse(sessionStorage.getItem(ORDERFLOW_STORAGE_KEY) ?? "{}") as Record<string, GexBotOrderflowFrame[]>;
          stored[ticker] = limited;
          sessionStorage.setItem(ORDERFLOW_STORAGE_KEY, JSON.stringify(stored));
        } catch {}
        return limited;
      });
    }
  }, [ticker]);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sequence = ++requestSequence.current;
    const cached = readWorkspaceData<ProfileEnvelope>(cacheKey(view, ticker, category));
    if (cached) { applyEnvelope(cached); setLoading(false); } else setLoading(true);
    const poll = async () => {
      try {
        const query = new URLSearchParams({ view, ticker, category, history: "1" });
        const response = await fetch(`/api/gexbot-terminal?${query}`, { cache: "no-store" });
        const payload = await response.json() as ProfileEnvelope;
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

  useEffect(() => {
    if (!playingHistory) return;
    const maximum = Math.max(0, Math.min(5, ...((envelope?.frame as GexBotProfileFrame | undefined)?.strikes.map((entry) => entry[3].length - 1) ?? [0])));
    if (maximum <= 0) { setPlayingHistory(false); return; }
    const timer = setInterval(() => setPriorIndex((current) => current >= maximum ? 0 : current + 1), 900);
    return () => clearInterval(timer);
  }, [envelope?.frame, playingHistory]);

  const frame = envelope?.ok ? envelope.frame : null;
  const isProfile = view !== "orderflow" && frame;
  const sessionLabel = envelope?.session === "LIVE_RTH" ? "LIVE · NEW YORK RTH" : envelope?.session === "DELAYED" ? "DELAYED FRAME" : "FROZEN · NEW YORK CLOSE";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-panel/95">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_12%,transparent)]"><Dna className="h-4 w-4 text-primary" /></div>
            <div><h1 className="text-[12px] font-bold uppercase tracking-[.2em]">GEX BOT</h1><p className="mt-0.5 text-[9px] text-muted">Options exposure terminal · official API frames</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <KwantSelect value={ticker} onChange={(event) => setTicker(event.target.value)} className="h-9 min-w-[112px] rounded-xl border border-border bg-background px-3 font-mono text-[10px] font-semibold" menuLabel="Options underlying">
              {TICKERS.map((item) => <option key={item} value={item}>{item}</option>)}
            </KwantSelect>
            <div className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[9px] font-semibold uppercase tracking-[.12em] ${envelope?.session === "LIVE_RTH" ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-400" : "border-border bg-background text-muted"}`}>
              {envelope?.session === "LIVE_RTH" ? <Radio className="h-3 w-3 animate-pulse" /> : <Pause className="h-3 w-3" />}{sessionLabel}
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
            <div className="flex items-center gap-3 text-[9px] text-muted"><span className="font-semibold uppercase tracking-[.15em] text-foreground">{ticker} · {VIEW_META[view].label}</span><span>{timeLabel(frame?.timestamp)}</span>{loading && envelope ? <RefreshCw className="h-3 w-3 animate-spin text-primary" /> : null}</div>
            {view !== "orderflow" ? <div className="flex items-center gap-2"><button type="button" onClick={() => setPlayingHistory((value) => !value)} className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[8px] font-semibold uppercase text-muted hover:text-foreground">{playingHistory ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}Playback</button><span className="font-mono text-[9px] text-primary">Lookback {priorIndex === 0 ? "now" : `-${priorIndex}`}</span></div> : <div className="flex items-center gap-3 text-[8px] uppercase tracking-[.14em] text-muted"><span className="text-primary">0DTE</span><span>1DTE dashed</span></div>}
          </div>
          {!frame ? <EmptyState envelope={envelope} loading={loading} /> : view === "orderflow" ? (
            <div className="min-w-[720px]">
              {visibleMetrics.length ? ORDERFLOW_METRICS.filter((metric) => visibleMetrics.includes(metric.id)).map((metric) => (
                <OrderflowPanel key={metric.id} metric={metric} points={orderflowTape.length ? orderflowTape : [frame as GexBotOrderflowFrame]} hoverIndex={orderflowHover} setHoverIndex={setOrderflowHover} />
              )) : <div className="flex min-h-[420px] items-center justify-center text-[10px] text-muted">Choose at least one orderflow panel from Adjustments.</div>}
            </div>
          ) : (
            <div className="flex min-h-[560px] flex-1 overflow-hidden">
              <div className="min-w-[760px] flex-1"><ProfileChart frame={frame as GexBotProfileFrame} dataset={dataset} appearance={appearance} spotTape={spotTape} priorIndex={priorIndex} onHover={setHover} /></div>
              <aside className="hidden w-56 shrink-0 overflow-y-auto border-l border-border bg-panel/65 p-4 xl:block"><ProfileSummary envelope={envelope!} dataset={dataset} hover={hover} /></aside>
            </div>
          )}
        </main>
        {showSettings ? <aside className="w-[272px] shrink-0 overflow-y-auto border-l border-border bg-panel p-4"><SettingsRail view={view} expiry={expiry} setExpiry={setExpiry} metric={stateMetric} setMetric={setStateMetric} dataset={dataset} setDataset={setDataset} appearance={appearance} setAppearance={setAppearance} visibleMetrics={visibleMetrics} setVisibleMetrics={setVisibleMetrics} /></aside> : null}
      </div>
      <footer className="flex min-h-8 shrink-0 items-center justify-between gap-4 border-t border-border bg-panel px-4 text-[8px] uppercase tracking-[.13em] text-muted">
        <span className="flex items-center gap-2"><Gauge className="h-3 w-3 text-primary" />Values are rendered directly from GEXBot API frames; classified-flow methodology remains provider-calculated.</span>
        <span>{envelope?.marketOpen ? "Polling every 3 seconds" : "Frozen outside New York RTH"}</span>
      </footer>
    </div>
  );
}
