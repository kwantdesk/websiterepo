import {
  Activity,
  BarChart3,
  CircleGauge,
  Radar,
  Scale,
  Waves,
} from "lucide-react";
import type {
  DteGammaBucket,
  OptionsFlowPayload,
  VolatilitySkewSummary,
  VolatilityTermPoint,
} from "@/lib/optionsFlow";

function compact(value: number | null, currency = false, signed = true) {
  if (value === null || !Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  const prefix = currency ? "$" : "";
  if (absolute >= 1_000_000_000_000) return `${sign}${prefix}${(absolute / 1_000_000_000_000).toFixed(2)}T`;
  if (absolute >= 1_000_000_000) return `${sign}${prefix}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${prefix}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${prefix}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${prefix}${absolute.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function price(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number | null, digits = 1, signed = false) {
  if (value === null || !Number.isFinite(value)) return "—";
  const result = value * 100;
  return `${signed && result > 0 ? "+" : ""}${result.toFixed(digits)}%`;
}

function timeLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "No intraday flip detected";
  return `Last flip ${new Date(value).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`;
}

function tone(value: number | null) {
  if (value === null || value === 0) return "text-muted";
  return value > 0 ? "text-primary" : "text-danger";
}

function SourceBadge({ kind }: { kind: "DIRECT" | "DERIVED" }) {
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.12em] ${kind === "DIRECT" ? "border-primary/20 bg-primary/[0.07] text-primary" : "border-accent/20 bg-accent/[0.07] text-accent"}`}>
      {kind}
    </span>
  );
}

function Card({
  title,
  subtitle,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  icon: typeof Activity;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-2xl border border-border bg-background/35 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-[9px] leading-4 text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

function DealerMetric({ label, value, frontValue, change }: { label: string; value: number | null; frontValue: number | null; change: number | null }) {
  return (
    <div className="rounded-xl border border-border bg-panel/70 p-3">
      <div className="flex items-center justify-between gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>{label}</span>
        <SourceBadge kind="DIRECT" />
      </div>
      <div className={`mt-2 font-mono text-[18px] font-semibold ${tone(value)}`}>{compact(value, true)}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2 text-[8px] text-muted">
        <span><span className="block">Front expiry</span><span className={`mt-0.5 block font-mono font-semibold ${tone(frontValue)}`}>{compact(frontValue, true)}</span></span>
        <span className="text-right"><span className="block">1H change</span><span className={`mt-0.5 block font-mono font-semibold ${tone(change)}`}>{compact(change, true)}</span></span>
      </div>
    </div>
  );
}

function DteRow({ bucket, maximum }: { bucket: DteGammaBucket; maximum: number }) {
  const positive = Math.max(0, bucket.net) / maximum * 50;
  const negative = Math.max(0, -bucket.net) / maximum * 50;
  return (
    <div className="grid grid-cols-[60px_minmax(90px,1fr)_78px_66px] items-center gap-2 text-[9px]">
      <span className="font-semibold text-muted">{bucket.label}</span>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface">
        <span className="absolute bottom-0 right-1/2 top-0 bg-danger" style={{ width: `${negative}%` }} />
        <span className="absolute bottom-0 left-1/2 top-0 bg-primary" style={{ width: `${positive}%` }} />
        <span className="absolute bottom-0 left-1/2 top-0 w-px bg-border" />
      </div>
      <span className={`text-right font-mono font-semibold ${tone(bucket.net)}`}>{compact(bucket.net, true)}</span>
      <span className="text-right font-mono text-muted">{compact(bucket.gross, true, false)}</span>
    </div>
  );
}

function SkewReadout({ label, skew }: { label: string; skew: VolatilitySkewSummary | null }) {
  const title = skew?.state === "PUT_BIAS" ? "Put bias" : skew?.state === "CALL_BIAS" ? "Call bias" : skew?.state === "BALANCED" ? "Balanced" : "Unavailable";
  return (
    <div className="rounded-xl border border-border bg-panel/70 p-3">
      <div className="flex items-center justify-between gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>{label}</span>
        <SourceBadge kind="DERIVED" />
      </div>
      <div className={`mt-2 text-[16px] font-semibold ${skew?.state === "PUT_BIAS" ? "text-danger" : skew?.state === "CALL_BIAS" ? "text-primary" : "text-foreground"}`}>{title}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[8px] text-muted">
        <span>25Δ put − call IV</span>
        <span className="font-mono text-foreground">{percent(skew?.difference ?? null, 1, true)}</span>
      </div>
      {skew ? <div className="mt-1 text-[8px] text-muted">{skew.expiration} · {skew.dte} DTE</div> : <div className="mt-1 text-[8px] text-muted">No reliable 25Δ call / put pair</div>}
    </div>
  );
}

function TermStructureChart({ points }: { points: VolatilityTermPoint[] }) {
  const regularExpiries = points.filter((point) => point.dte >= 1);
  const selected = regularExpiries.length <= 12
    ? regularExpiries
    : Array.from({ length: 12 }, (_, index) => regularExpiries[Math.round(index * (regularExpiries.length - 1) / 11)]);
  if (selected.length < 2) {
    return <div className="flex h-[82px] items-center justify-center text-[9px] text-muted">Term structure unavailable</div>;
  }

  const width = 460;
  const height = 82;
  const paddingX = 8;
  const paddingY = 10;
  const values = selected.map((point) => point.atmIv);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(0.001, maximum - minimum);
  const x = (index: number) => paddingX + index / (selected.length - 1) * (width - paddingX * 2);
  const y = (value: number) => paddingY + (maximum - value) / range * (height - paddingY * 2);
  const path = selected.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.atmIv).toFixed(1)}`).join(" ");

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[82px] w-full" preserveAspectRatio="none" role="img" aria-label="KwantData at-the-money implied volatility term structure">
        {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="var(--grid-color)" strokeWidth="1" />)}
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {selected.map((point, index) => <circle key={point.expiration} cx={x(index)} cy={y(point.atmIv)} r="2.25" fill="var(--panel)" stroke="var(--primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="flex items-center justify-between font-mono text-[8px] text-muted">
        <span>{selected[0].dte}D · {percent(selected[0].atmIv)}</span>
        <span>{selected[Math.floor(selected.length / 2)].dte}D</span>
        <span>{selected.at(-1)?.dte}D · {percent(selected.at(-1)?.atmIv ?? null)}</span>
      </div>
    </div>
  );
}

export default function MarketMapIntelligence({ data }: { data: OptionsFlowPayload }) {
  const { marketMap } = data;
  const expected = marketMap.expectedMove;
  const dealer = marketMap.dealerPositioning;
  const volumes = marketMap.putCallVolume;
  const volatility = marketMap.volatility;
  const dteMaximum = Math.max(1, ...dealer.dteGamma.map((bucket) => Math.abs(bucket.net)));
  const callShare = volumes && volumes.totalVolume > 0 ? volumes.callVolume / volumes.totalVolume : null;
  const putShare = callShare === null ? null : 1 - callShare;
  const vrpState = volatility.volatilityState === "RICH"
    ? "IV rich"
    : volatility.volatilityState === "DISCOUNTED"
      ? "IV discounted"
      : volatility.volatilityState === "FAIR"
        ? "Fair"
        : "Unavailable";

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-border bg-panel">
      <header className="flex min-h-[52px] items-center gap-3 border-b border-border px-4 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Radar className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-foreground">Market map</h2>
          <p className="mt-0.5 text-[9px] text-muted">Live options structure powered by Kwant Data&apos;s proprietary model</p>
        </div>
        <div className="ml-auto hidden items-center gap-1.5 text-[8px] text-muted sm:flex">
          <SourceBadge kind="DIRECT" /><span>vendor field</span><SourceBadge kind="DERIVED" /><span>documented formula</span>
        </div>
      </header>

      <div className="grid gap-3 p-3 xl:grid-cols-12">
        <Card title="Gamma regime" subtitle="Full-chain dealer-signed GEX" icon={CircleGauge} className="xl:col-span-3">
          <div className={`mt-5 text-[23px] font-semibold leading-none ${data.environment.gammaRegime === "POSITIVE" ? "text-primary" : data.environment.gammaRegime === "NEGATIVE" ? "text-danger" : "text-foreground"}`}>
            {data.environment.gammaStateLabel}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-[9px] text-muted">
            <span>{timeLabel(dealer.lastFrontExpiryGammaFlipAt)}</span>
            <SourceBadge kind="DERIVED" />
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface">
            <div className={data.environment.gammaRegime === "NEGATIVE" ? "h-full bg-danger" : "h-full bg-primary"} style={{ width: `${Math.max(4, Math.min(100, data.environment.regimeStrength * 100))}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[8px] text-muted"><span>Neutral</span><span>{percent(data.environment.regimeStrength)} strength</span></div>
        </Card>

        <Card title="Expected daily range" subtitle="Prior-session 30-day ATM IV ÷ √365 · session open" icon={Scale} className="xl:col-span-5">
          {expected ? (
            <>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div><div className="font-mono text-[25px] font-semibold text-foreground">{percent(expected.movePercent, 2)}</div><div className="mt-1 text-[9px] text-muted">±{price(expected.moveDollars)} points</div></div>
                <div className="flex items-center gap-1.5"><SourceBadge kind="DERIVED" /><span className="rounded-md border border-warning/20 bg-warning/[0.07] px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.1em] text-warning">{expected.approximate ? "APPROX" : "QD 1σ"}</span></div>
              </div>
              <div className="relative mt-5 h-1.5 rounded-full bg-surface">
                <span className="absolute inset-y-0 left-[12%] right-[12%] rounded-full bg-primary/40" />
                <span className="absolute -top-1 left-1/2 h-3.5 w-px bg-foreground" />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div><div className="text-[8px] uppercase tracking-[0.12em] text-muted">1D Min</div><div className="mt-1 font-mono text-[11px] font-semibold text-danger">{price(expected.min)}</div></div>
                <div className="text-center"><div className="text-[8px] uppercase tracking-[0.12em] text-muted">{expected.anchorLabel.replaceAll("_", " ")}</div><div className="mt-1 font-mono text-[11px] font-semibold text-foreground">{price(expected.anchorPrice)}</div></div>
                <div className="text-right"><div className="text-[8px] uppercase tracking-[0.12em] text-muted">1D Max</div><div className="mt-1 font-mono text-[11px] font-semibold text-primary">{price(expected.max)}</div></div>
              </div>
              <p className="mt-3 border-t border-border pt-2 text-[8px] leading-4 text-muted">{expected.approximate ? "Prior-session realized-range fallback; approximate because the prior-session IV input was unavailable." : "One-sigma range from prior-session KwantData IV with no lookahead."}</p>
            </>
          ) : <div className="flex h-36 items-center justify-center text-[10px] text-muted">Expected range unavailable</div>}
        </Card>

        <Card title="Put / call volume" subtitle="Aggregated option-contract volume" icon={Activity} className="xl:col-span-4">
          <div className="mt-4 flex items-end justify-between gap-4">
            <div><div className="text-[8px] uppercase tracking-[0.12em] text-muted">P/C ratio</div><div className={`mt-1 font-mono text-[23px] font-semibold ${(volumes?.putCallRatio ?? 0) > 1 ? "text-danger" : "text-primary"}`}>{volumes?.putCallRatio?.toFixed(2) ?? "—"}</div></div>
            <SourceBadge kind="DIRECT" />
          </div>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface">
            <span className="bg-danger" style={{ width: `${(putShare ?? 0) * 100}%` }} />
            <span className="bg-primary" style={{ width: `${(callShare ?? 0) * 100}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-[9px]">
            <div><span className="font-semibold text-danger">Puts</span><div className="mt-1 font-mono text-foreground">{compact(volumes?.putVolume ?? null, false, false)}</div><div className="mt-0.5 text-muted">{percent(putShare)} share</div></div>
            <div className="text-right"><span className="font-semibold text-primary">Calls</span><div className="mt-1 font-mono text-foreground">{compact(volumes?.callVolume ?? null, false, false)}</div><div className="mt-0.5 text-muted">{percent(callShare)} share</div></div>
          </div>
        </Card>

        <Card title="Dealer positioning" subtitle="Full chain totals · front-expiry intraday change" icon={BarChart3} className="xl:col-span-7">
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <DealerMetric label="Net GEX" value={dealer.netGex} frontValue={dealer.frontExpiryNetGex} change={dealer.frontExpiryGexChange1h} />
            <DealerMetric label="Net DEX" value={dealer.netDex} frontValue={dealer.frontExpiryNetDex} change={dealer.frontExpiryDexChange1h} />
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 grid grid-cols-[60px_minmax(90px,1fr)_78px_66px] gap-2 text-[8px] uppercase tracking-[0.1em] text-muted"><span>DTE</span><span>Net direction</span><span className="text-right">Net GEX</span><span className="text-right">Gross</span></div>
            <div className="space-y-2.5">{dealer.dteGamma.map((bucket) => <DteRow key={bucket.label} bucket={bucket} maximum={dteMaximum} />)}</div>
          </div>
        </Card>

        <Card title="Volatility intelligence" subtitle="ATM IV, realized volatility, rank and risk premium" icon={Waves} className="xl:col-span-5">
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-panel/70 p-3"><div className="text-[8px] uppercase tracking-[0.12em] text-muted">ATM IV · ~30D</div><div className="mt-2 font-mono text-[18px] font-semibold text-foreground">{percent(volatility.atmIv30d)}</div><div className="mt-1 text-[8px] text-muted">KwantData IV</div></div>
            <div className="rounded-xl border border-border bg-panel/70 p-3"><div className="text-[8px] uppercase tracking-[0.12em] text-muted">Historical vol · 21D</div><div className="mt-2 font-mono text-[18px] font-semibold text-foreground">{percent(volatility.historicalVol21d)}</div><div className="mt-1 text-[8px] text-muted">Close-to-close annualized</div></div>
            <div className="rounded-xl border border-border bg-panel/70 p-3"><div className="text-[8px] uppercase tracking-[0.12em] text-muted">IV rank</div><div className="mt-2 font-mono text-[18px] font-semibold text-foreground">{percent(volatility.ivRank)}</div><div className="mt-1 text-[8px] text-muted">Percentile {percent(volatility.ivPercentile)} · {volatility.ivHistorySessions} sessions</div></div>
            <div className="rounded-xl border border-border bg-panel/70 p-3"><div className="text-[8px] uppercase tracking-[0.12em] text-muted">Vol risk premium</div><div className={`mt-2 font-mono text-[18px] font-semibold ${tone(volatility.vrp)}`}>{percent(volatility.vrp, 1, true)}</div><div className="mt-1 text-[8px] text-muted">{vrpState} · NVRP {volatility.normalizedVrp?.toFixed(2) ?? "—"}</div></div>
          </div>
        </Card>

        <Card title="Skew and term structure" subtitle="25-delta relative skew · ATM IV by expiration" icon={Waves} className="xl:col-span-12">
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <SkewReadout label="0DTE skew" skew={volatility.skew0Dte} />
            <SkewReadout label="~30D skew" skew={volatility.skew30Dte} />
          </div>
          <div className="mt-3 rounded-xl border border-border bg-panel/70 p-3">
            <div className="flex items-center justify-between gap-3"><div><div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Term structure</div><div className={`mt-1 text-[14px] font-semibold ${volatility.termStructureState === "BACKWARDATION" ? "text-danger" : volatility.termStructureState === "CONTANGO" ? "text-primary" : "text-foreground"}`}>{volatility.termStructureState.toLowerCase().replace(/^./, (character) => character.toUpperCase())}</div></div><SourceBadge kind="DERIVED" /></div>
            <TermStructureChart points={volatility.termStructure} />
          </div>
        </Card>

      </div>
    </section>
  );
}

