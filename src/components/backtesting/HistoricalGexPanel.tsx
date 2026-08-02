"use client";

import { useMemo, useRef, useEffect } from "react";
import { Activity, Crosshair, Layers3, ShieldCheck, X } from "lucide-react";
import type {
  ChartGammaLevelsPayload,
  ChartGammaPositioningStrike,
  ChartGammaSourceLevelKind,
} from "@/lib/chartGammaLevels";

const IMPORTANT_LEVELS = new Set<ChartGammaSourceLevelKind>([
  "CALL_WALL",
  "PUT_WALL",
  "HIGH_VOL_LEVEL",
  "ZERO_GAMMA",
  "GAMMA_CENTRE",
  "GAMMA_MAGNET",
  "MAJOR_POSITIVE_OI",
  "MAJOR_POSITIVE_VOLUME",
]);

function compact(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}

function price(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clock(value: string | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function nearestStrike(rows: ChartGammaPositioningStrike[], futuresPrice: number) {
  if (!rows.length) return null;
  return rows.reduce((best, row) => (
    Math.abs(row.futuresEquivalent - futuresPrice) < Math.abs(best.futuresEquivalent - futuresPrice)
      ? row
      : best
  ));
}

export default function HistoricalGexPanel({
  snapshot,
  loading,
  error,
  paired = false,
  onClose,
}: {
  snapshot: ChartGammaLevelsPayload | null;
  loading: boolean;
  error: string;
  paired?: boolean;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const positioning = snapshot?.positioning ?? null;
  const source = snapshot?.sources[0] ?? null;
  const levels = useMemo(() => (source?.levels ?? [])
    .filter((level) => IMPORTANT_LEVELS.has(level.kind))
    .sort((left, right) => Math.abs(left.price - (positioning?.futuresPrice ?? source?.stockPrice ?? 0)) - Math.abs(right.price - (positioning?.futuresPrice ?? source?.stockPrice ?? 0)))
    .slice(0, 8), [positioning?.futuresPrice, source]);
  const visibleStrikes = useMemo(() => {
    if (!positioning?.strikes.length) return [];
    const ordered = [...positioning.strikes].sort((left, right) => right.sourceStrike - left.sourceStrike);
    const nearest = nearestStrike(ordered, positioning.futuresPrice);
    const centre = nearest ? ordered.findIndex((row) => row.sourceStrike === nearest.sourceStrike) : 0;
    return ordered.slice(Math.max(0, centre - 14), Math.min(ordered.length, centre + 15));
  }, [positioning]);
  const nearest = useMemo(() => positioning ? nearestStrike(visibleStrikes, positioning.futuresPrice) : null, [positioning, visibleStrikes]);
  const maximum = Math.max(1, ...visibleStrikes.flatMap((row) => [Math.abs(row.call), Math.abs(row.put)]));
  const lookbacks = useMemo(() => (positioning?.lookbacks ?? []).map((lookback) => ({
    minutes: lookback.minutes,
    strikes: new Map(lookback.strikes.map((row) => [row.sourceStrike, row])),
  })), [positioning?.lookbacks]);

  useEffect(() => {
    const container = scrollRef.current;
    const target = container?.querySelector<HTMLElement>("[data-replay-gex-current='true']");
    if (!container || !target) return;
    container.scrollTop = Math.max(0, target.offsetTop - container.offsetTop - container.clientHeight / 2);
  }, [nearest?.sourceStrike, snapshot?.checkedAt]);

  return (
    <aside className={`absolute inset-y-0 right-0 z-40 flex flex-col border-l border-border bg-panel/98 shadow-[-20px_0_60px_rgba(0,0,0,0.38)] backdrop-blur-xl ${paired ? "w-[min(430px,48vw)]" : "w-[min(430px,calc(100%-24px))]"}`}>
      <div className="flex min-h-14 items-center gap-3 border-b border-border px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Activity className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-foreground">Historical GEX</span>
            <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[7px] font-semibold text-primary">NO LOOKAHEAD</span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[8px] text-muted">{clock(snapshot?.checkedAt)} NY · {positioning?.status === "HISTORICAL_INTRADAY" ? "intraday frame" : "prior New York EOD"}</div>
        </div>
        <button type="button" onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground" aria-label="Close historical GEX"><X className="h-4 w-4" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading && !snapshot ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><Layers3 className="h-4 w-4" /></span>
            <div className="mt-3 text-[11px] font-semibold text-foreground">Restoring point-in-time GEX</div>
            <div className="mt-1 text-[9px] text-muted">Only frames at or before the replay clock are eligible.</div>
          </div>
        ) : !positioning ? (
          <div className="rounded-2xl border border-border bg-surface/30 p-5 text-center">
            <ShieldCheck className="mx-auto h-5 w-5 text-muted" />
            <div className="mt-3 text-[11px] font-semibold text-foreground">Historical structure unavailable</div>
            <div className="mt-1 text-[9px] leading-4 text-muted">{error || "No validated GEX frame exists for this replay timestamp."}</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-surface/35 p-3">
                <div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-muted">Gamma environment</div>
                <div className={`mt-1 text-[11px] font-semibold ${snapshot?.environment.gammaRegime === "POSITIVE" ? "text-primary" : snapshot?.environment.gammaRegime === "NEGATIVE" ? "text-danger" : "text-foreground"}`}>{snapshot?.environment.gammaStateLabel ?? "—"}</div>
                <div className="mt-1 font-mono text-[8px] text-muted">strength {(snapshot?.environment.regimeStrength ?? 0).toLocaleString("en-US", { style: "percent", maximumFractionDigits: 1 })}</div>
              </div>
              <div className="rounded-xl border border-border bg-surface/35 p-3">
                <div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-muted">Conversion</div>
                <div className="mt-1 text-[11px] font-semibold text-foreground">{positioning.sourceSymbol} → {positioning.futuresRoot}</div>
                <div className="mt-1 font-mono text-[8px] text-muted">{positioning.priceScale.toFixed(6)}× · {price(positioning.sourcePrice)} → {price(positioning.futuresPrice)}</div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-2"><div className="text-[7px] uppercase tracking-[0.1em] text-primary">Call GEX</div><div className="mt-1 truncate font-mono text-[10px] font-semibold text-foreground">{compact(positioning.totals.call)}</div></div>
              <div className="rounded-xl border border-danger/20 bg-danger/[0.06] p-2"><div className="text-[7px] uppercase tracking-[0.1em] text-danger">Put GEX</div><div className="mt-1 truncate font-mono text-[10px] font-semibold text-foreground">{compact(positioning.totals.put)}</div></div>
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-[7px] uppercase tracking-[0.1em] text-muted">Net GEX</div><div className="mt-1 truncate font-mono text-[10px] font-semibold text-foreground">{compact(positioning.totals.net)}</div></div>
              <div className="rounded-xl border border-border bg-surface/35 p-2"><div className="text-[7px] uppercase tracking-[0.1em] text-muted">Gross</div><div className="mt-1 truncate font-mono text-[10px] font-semibold text-foreground">{compact(positioning.totals.gross)}</div></div>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface/20">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Crosshair className="h-3.5 w-3.5 text-primary" />
                <div><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground">GEX structure</div><div className="mt-0.5 text-[7px] text-muted">Put exposure ← source strike / futures equivalent → call exposure</div></div>
                <div className="ml-auto flex gap-1.5 text-[7px] text-muted">{lookbacks.map((row) => <span key={row.minutes}>{row.minutes}m</span>)}</div>
              </div>
              <div className="grid grid-cols-[1fr_94px_1fr] border-b border-border px-2 py-2 text-[7px] font-semibold uppercase tracking-[0.1em] text-muted"><span className="text-right">Put GEX</span><span className="text-center">Strike / {positioning.futuresRoot}</span><span>Call GEX</span></div>
              <div ref={scrollRef} className="max-h-[390px] overflow-y-auto p-2">
                {visibleStrikes.map((row) => {
                  const current = row.sourceStrike === nearest?.sourceStrike;
                  return (
                    <div key={row.sourceStrike} data-replay-gex-current={current ? "true" : undefined} className={`grid min-h-[34px] grid-cols-[1fr_94px_1fr] items-center rounded-lg ${current ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/20" : "hover:bg-surface/50"}`}>
                      <div className="relative flex h-3 justify-end border-r border-border/70">
                        <span className="h-full rounded-l-sm bg-danger/75" style={{ width: `${Math.max(1, Math.abs(row.put) / maximum * 100)}%` }} />
                        {lookbacks.map((lookback, index) => {
                          const value = Math.abs(lookback.strikes.get(row.sourceStrike)?.put ?? 0);
                          return value ? <i key={lookback.minutes} className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ring-1 ring-panel" style={{ right: `${Math.min(100, value / maximum * 100)}%`, background: index === 0 ? "var(--muted)" : index === 1 ? "var(--accent)" : "var(--secondary)" }} /> : null;
                        })}
                      </div>
                      <div className="px-1 text-center">
                        <div className={`font-mono text-[9px] ${current ? "font-semibold text-primary" : "text-foreground"}`}>{price(row.sourceStrike)}</div>
                        <div className="font-mono text-[7px] text-muted">{price(row.futuresEquivalent)}</div>
                      </div>
                      <div className="relative flex h-3 border-l border-border/70">
                        <span className="h-full rounded-r-sm bg-primary/75" style={{ width: `${Math.max(1, Math.abs(row.call) / maximum * 100)}%` }} />
                        {lookbacks.map((lookback, index) => {
                          const value = Math.abs(lookback.strikes.get(row.sourceStrike)?.call ?? 0);
                          return value ? <i key={lookback.minutes} className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ring-1 ring-panel" style={{ left: `${Math.min(100, value / maximum * 100)}%`, background: index === 0 ? "var(--muted)" : index === 1 ? "var(--accent)" : "var(--secondary)" }} /> : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-border bg-surface/20 p-3">
              <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-foreground">Important Gamma levels</div>
              <div className="mt-2 space-y-1">
                {levels.map((level) => (
                  <div key={level.id} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/30 px-2.5 py-2">
                    <span className="min-w-0 flex-1 truncate text-[8px] font-semibold text-foreground">{level.label.replace(" · intraday", "").replace(" · EOD", "")}</span>
                    <span className="font-mono text-[9px] text-primary">{price(level.price)}</span>
                    <span className="w-[54px] text-right font-mono text-[7px] text-muted">{price(level.price / positioning.priceScale)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-[8px] leading-4 text-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>The panel selects the last completed options frame at or before the replay clock. Outside New York options hours it freezes the previous completed New York EOD structure.</span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
