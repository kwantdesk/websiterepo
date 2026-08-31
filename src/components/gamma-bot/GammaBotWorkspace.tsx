"use client";

import {
  Activity,
  Bot,
  ChevronDown,
  CirclePause,
  CirclePlay,
  ExternalLink,
  Gauge,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import KwantLoader from "@/components/KwantLoader";
import type {
  GammaBotInstrument,
  GammaBotLevel,
  GammaBotMessage,
  GammaBotPayload,
} from "@/lib/gammaBot";
import type { OptionsMarketPulsePayload } from "@/lib/optionsFlow";

type FeedItem = GammaBotMessage & {
  id: string;
  timestamp: string;
};

type ReactionState = "DISTANT" | "APPROACHING" | "CONTACT";

const FEED_LIMIT = 80;

function formatCompact(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value);
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeLabel(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

function nearestLevel(levels: GammaBotLevel[], price: number | null) {
  if (price === null || !levels.length) return null;
  return levels.reduce((nearest, level) => (
    Math.abs(level.price - price) < Math.abs(nearest.price - price) ? level : nearest
  ));
}

function reactionState(level: GammaBotLevel | null, price: number | null): ReactionState {
  if (!level || price === null || price <= 0) return "DISTANT";
  const distanceRatio = Math.abs(level.price - price) / price;
  if (distanceRatio <= 0.00035) return "CONTACT";
  if (distanceRatio <= 0.0015) return "APPROACHING";
  return "DISTANT";
}

function metricTone(value: number | null) {
  if (value === null || Math.abs(value) < 1e-9) return "text-muted";
  return value > 0 ? "text-primary" : "text-danger";
}

function sentenceCase(value: string) {
  const normalized = value.trim();
  return normalized.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
}

function FeedCard({ item }: { item: FeedItem }) {
  const categoryIcon = item.category === "LEVEL"
    ? Target
    : item.category === "FLOW"
      ? Waves
      : item.category === "VOLATILITY"
        ? Gauge
        : item.category === "POSITIONING"
          ? Activity
          : Sparkles;
  const Icon = categoryIcon;
  return (
    <article className={`rounded-2xl border bg-card/75 p-4 transition-colors ${item.importance === "IMPORTANT" ? "border-primary/35" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.importance === "IMPORTANT" ? "bg-primary/15 text-primary" : "bg-surface text-muted"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{item.category}</span>
              {item.importance === "IMPORTANT" ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-primary">Watch</span> : null}
            </div>
            <time className="font-mono text-[10px] text-muted">{timeLabel(item.timestamp)}</time>
          </div>
          <h3 className="mt-2 text-[14px] font-semibold text-foreground">{sentenceCase(item.headline)}</h3>
          <p className="mt-1.5 text-[12px] leading-5 text-muted">{sentenceCase(item.body)}</p>
        </div>
      </div>
    </article>
  );
}

export default function GammaBotWorkspace() {
  const router = useRouter();
  const [instrument, setInstrument] = useState<GammaBotInstrument>("NQ");
  const [data, setData] = useState<GammaBotPayload | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const lastStructuralKeysRef = useRef(new Set<string>());
  const lastReactionRef = useRef<{ levelId: string; state: ReactionState; side: number } | null>(null);
  const previousPriceRef = useRef<number | null>(null);
  const structureTimerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const appendMessages = useCallback((messages: GammaBotMessage[], timestamp: string) => {
    setFeed((current) => [
      ...current,
      ...messages.map((message, index) => ({
        ...message,
        id: `${message.key}:${Date.now()}:${index}`,
        timestamp,
      })),
    ].slice(-FEED_LIMIT));
  }, []);

  const loadStructure = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/gamma-bot?instrument=${instrument}`, { cache: "no-store" });
      const payload = await response.json() as GammaBotPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gamma Bot could not load its options context.");
      setData(payload);
      setLivePrice((current) => current ?? payload.price);
      setError("");

      const fresh = payload.messages.filter((message) => !lastStructuralKeysRef.current.has(message.key));
      lastStructuralKeysRef.current = new Set(payload.messages.map((message) => message.key));
      if (!pausedRef.current && fresh.length) appendMessages(fresh, payload.asOf);

      if (structureTimerRef.current !== null) window.clearTimeout(structureTimerRef.current);
      structureTimerRef.current = window.setTimeout(
        () => void loadStructure(true),
        payload.refreshAfterMs,
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Gamma Bot could not load.");
      if (structureTimerRef.current !== null) window.clearTimeout(structureTimerRef.current);
      structureTimerRef.current = window.setTimeout(() => void loadStructure(true), 10_000);
    } finally {
      setLoading(false);
    }
  }, [appendMessages, instrument]);

  useEffect(() => {
    setData(null);
    setLivePrice(null);
    setFeed([]);
    setError("");
    lastStructuralKeysRef.current = new Set();
    lastReactionRef.current = null;
    previousPriceRef.current = null;
    void loadStructure();
    return () => {
      if (structureTimerRef.current !== null) window.clearTimeout(structureTimerRef.current);
    };
  }, [instrument, loadStructure]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      let delay = 2_000;
      try {
        const response = await fetch(`/api/options-flow/market-data?symbol=${data.sourceSymbol}&priceMode=FUTURES`, { cache: "no-store" });
        const payload = await response.json() as OptionsMarketPulsePayload & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Live price pulse failed.");
        if (cancelled) return;
        const next = payload.marketData.lastPrice;
        if (next !== null && Number.isFinite(next)) {
          setLivePrice((current) => {
            previousPriceRef.current = current;
            return next;
          });
        }
        delay = Math.max(250, payload.refreshAfterMs);
      } catch {
        delay = 2_000;
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void poll(), delay);
      }
    };
    timer = window.setTimeout(() => void poll(), 0);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [data?.sourceSymbol]);

  const closest = useMemo(() => nearestLevel(data?.levels ?? [], livePrice), [data?.levels, livePrice]);
  const upper = useMemo(() => data?.levels.find((level) => livePrice !== null && level.price > livePrice) ?? null, [data?.levels, livePrice]);
  const lower = useMemo(() => [...(data?.levels ?? [])].reverse().find((level) => livePrice !== null && level.price < livePrice) ?? null, [data?.levels, livePrice]);
  const currentReaction = reactionState(closest, livePrice);

  useEffect(() => {
    if (paused || !closest || livePrice === null || previousPriceRef.current === null) return;
    const side = Math.sign(livePrice - closest.price);
    const previous = lastReactionRef.current;
    if (previous?.levelId === closest.id && previous.state === currentReaction && previous.side === side) return;

    const messages: GammaBotMessage[] = [];
    if (previous?.levelId === closest.id && previous.side !== 0 && side !== 0 && previous.side !== side) {
      messages.push({
        key: `cross:${closest.id}:${side}:${Date.now()}`,
        category: "LEVEL",
        headline: `Price crossed ${closest.label}`,
        body: `${instrument} moved ${side > 0 ? "above" : "below"} ${formatPrice(closest.price)}. A cross is not acceptance yet; watch whether price can hold on this side or immediately rotates back through.`,
        importance: "IMPORTANT",
      });
    } else if (currentReaction === "CONTACT" && previous?.state !== "CONTACT") {
      messages.push({
        key: `contact:${closest.id}:${Date.now()}`,
        category: "LEVEL",
        headline: `${closest.label} is being tested`,
        body: `Price is now at the ${closest.label} near ${formatPrice(closest.price)}. Watch the reaction: holding and rotating away suggests rejection; sustained trade through it suggests acceptance.`,
        importance: "IMPORTANT",
      });
    } else if (currentReaction === "APPROACHING" && previous?.state === "DISTANT") {
      messages.push({
        key: `approach:${closest.id}:${Date.now()}`,
        category: "LEVEL",
        headline: `Price is approaching ${closest.label}`,
        body: `${closest.label} is ${Math.abs(closest.price - livePrice).toFixed(2)} points away. Prepare for the reaction rather than assuming the level must hold.`,
        importance: "STANDARD",
      });
    } else if (previous?.levelId === closest.id && previous.state === "CONTACT" && currentReaction !== "CONTACT") {
      messages.push({
        key: `leave:${closest.id}:${side}:${Date.now()}`,
        category: "LEVEL",
        headline: `Price moved away from ${closest.label}`,
        body: `${instrument} is moving ${side > 0 ? "above" : "below"} the level after contact. The reaction is developing, but follow-through is still needed before calling it accepted or rejected.`,
        importance: "STANDARD",
      });
    }
    lastReactionRef.current = { levelId: closest.id, state: currentReaction, side };
    if (messages.length) appendMessages(messages, new Date().toISOString());
  }, [appendMessages, closest, currentReaction, instrument, livePrice, paused]);

  if (loading && !data) {
    return <KwantLoader page compact icon={Bot} title="Opening Gamma Bot" detail="Translating the latest GEX, DEX and level structure." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_12%,transparent)]">
          <Bot className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.12em]">Gamma Bot</h1>
          <p className="hidden text-[10px] text-muted sm:block">Live options structure, explained in plain language</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-surface/60 p-1">
            {(["NQ", "ES"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setInstrument(value)} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${instrument === value ? "bg-primary/15 text-primary" : "text-muted hover:text-foreground"}`}>{value}</button>
            ))}
          </div>
          <button type="button" onClick={() => setPaused((value) => !value)} className="flex h-9 items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 text-[11px] font-medium text-muted hover:text-foreground">
            {paused ? <CirclePlay className="h-4 w-4" /> : <CirclePause className="h-4 w-4" />}
            <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
          </button>
          <button type="button" onClick={() => void loadStructure()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface/60 text-muted hover:text-foreground" aria-label="Refresh Gamma Bot">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {error ? <div className="shrink-0 border-b border-danger/25 bg-danger/5 px-4 py-2 text-[11px] text-danger">{error} Showing the last good Gamma Bot state where available.</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-[1540px] gap-4 p-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
          <main className="min-w-0 space-y-4">
            <section className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-[0_0_35px_color-mix(in_srgb,var(--primary)_7%,transparent)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${data?.priceStatus === "LIVE" ? "animate-pulse bg-primary" : "bg-muted"}`} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{data?.marketOpen ? "Live market read" : "Last completed options session"}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] text-muted">
                  <span>{data?.sourceSymbol} OPTIONS → {instrument}</span>
                  <span>{data ? timeLabel(data.asOf) : "—"}</span>
                </div>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">What this means now</div>
                  <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-foreground sm:text-[28px]">
                    {data ? sentenceCase(data.regime.label.toLowerCase().replace("·", "—")) : "Gamma context unavailable"}
                  </h2>
                  <p className="mt-3 max-w-3xl text-[13px] leading-6 text-muted">{data?.regime.plainEnglish}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams({
                      market: instrument,
                      source: data?.sourceSymbol ?? (instrument === "NQ" ? "QQQ" : "SPY"),
                    });
                    router.push(`/gexmap?${params.toString()}`);
                  }}
                  onMouseEnter={() => router.prefetch("/gexmap")}
                  className="group rounded-2xl border border-border bg-surface/45 px-5 py-4 text-right transition-colors hover:border-primary/35 hover:bg-primary/[0.055] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={`Open ${instrument} options strikes in GEX Map`}
                  title={`Open ${instrument === "NQ" ? "QQQ and NDX" : "SPY and SPX"} in GEX Map`}
                >
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">{instrument} live</div>
                  <div className="mt-1 font-mono text-[24px] font-semibold text-foreground">{formatPrice(livePrice)}</div>
                  <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-primary">
                    <Radio className="h-3 w-3" /> {data?.priceStatus ?? "UNAVAILABLE"}
                    <ExternalLink className="ml-1 h-3 w-3 opacity-65 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "NET GEX", value: data?.metrics.netGex ?? null, hint: "Hedge acceleration" },
                { label: "NET DEX", value: data?.metrics.netDex ?? null, hint: "Directional delta" },
                { label: "VANNA", value: data?.metrics.netVanna ?? null, hint: "IV sensitivity" },
                { label: "CHARM", value: data?.metrics.netCharm ?? null, hint: "Time-decay pressure" },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-border bg-card p-4">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">{metric.label}</div>
                  <div className={`mt-2 font-mono text-[17px] font-semibold ${metricTone(metric.value)}`}>{formatCompact(metric.value)}</div>
                  <div className="mt-1 text-[10px] text-muted">{metric.hint}</div>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-[13px] font-semibold">Live Gamma translation</h2>
                  <p className="mt-0.5 text-[10px] text-muted">New messages appear only when the measured state changes.</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted"><span className={`h-2 w-2 rounded-full ${paused ? "bg-warning" : "animate-pulse bg-primary"}`} /> {paused ? "PAUSED" : "LISTENING"}</div>
              </div>
              <div className="space-y-3 p-3 sm:p-4">
                {feed.length ? [...feed].reverse().map((item) => <FeedCard key={item.id} item={item} />) : (
                  <div className="flex min-h-48 flex-col items-center justify-center text-center">
                    <Bot className="h-6 w-6 text-primary" />
                    <p className="mt-3 text-[12px] text-muted">Waiting for the first measured Gamma state.</p>
                  </div>
                )}
              </div>
            </section>
          </main>

          <aside className="min-w-0 space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h2 className="text-[12px] font-semibold">Level reaction monitor</h2></div>
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">Closest level</div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${currentReaction === "CONTACT" ? "bg-primary/15 text-primary" : currentReaction === "APPROACHING" ? "bg-warning/15 text-warning" : "bg-surface text-muted"}`}>{currentReaction}</span>
                </div>
                <div className="mt-2 text-[14px] font-semibold text-foreground">{closest?.label ?? "No mapped level"}</div>
                <div className="mt-1 font-mono text-[18px] text-primary">{formatPrice(closest?.price ?? null)}</div>
                {closest && livePrice !== null ? <div className="mt-2 text-[10px] text-muted">{Math.abs(closest.price - livePrice).toFixed(2)} points {closest.price >= livePrice ? "above" : "below"} current price</div> : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-surface/40 p-3"><div className="text-[9px] uppercase tracking-[0.14em] text-muted">Below price</div><div className="mt-1 truncate text-[11px] font-semibold">{lower?.label ?? "—"}</div><div className="mt-1 font-mono text-[11px] text-muted">{formatPrice(lower?.price ?? null)}</div></div>
                <div className="rounded-xl border border-border bg-surface/40 p-3"><div className="text-[9px] uppercase tracking-[0.14em] text-muted">Above price</div><div className="mt-1 truncate text-[11px] font-semibold">{upper?.label ?? "—"}</div><div className="mt-1 font-mono text-[11px] text-muted">{formatPrice(upper?.price ?? null)}</div></div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" /><h2 className="text-[12px] font-semibold">Structure at a glance</h2></div>
              <div className="mt-4 space-y-3">
                {[
                  ["Gamma strength", data ? `${Math.round(data.regime.score * 100)}% · ${data.regime.strength}` : "—"],
                  ["Bullish premium", data?.metrics.bullishShare === null || data?.metrics.bullishShare === undefined ? "—" : `${Math.round(data.metrics.bullishShare * 100)}%`],
                  ["Put / call volume", data?.metrics.putCallRatio === null || data?.metrics.putCallRatio === undefined ? "—" : data.metrics.putCallRatio.toFixed(2)],
                  ["Net premium", formatCompact(data?.metrics.netPremium ?? null)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0"><span className="text-[11px] text-muted">{label}</span><span className="font-mono text-[11px] font-semibold text-foreground">{value}</span></div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2"><Waves className="h-4 w-4 text-primary" /><h2 className="text-[12px] font-semibold">Mapped gamma structure</h2></div>
              <p className="mt-1 text-[10px] leading-4 text-muted">The closest live levels, translated from {data?.sourceSymbol ?? "the options source"} into {instrument} price.</p>
              <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {(data?.levels ?? [])
                  .slice()
                  .sort((a, b) => Math.abs(a.price - (livePrice ?? a.price)) - Math.abs(b.price - (livePrice ?? b.price)))
                  .slice(0, 10)
                  .map((level) => (
                    <details key={level.id} className="group rounded-xl border border-border bg-surface/35">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5">
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">{level.label}</span>
                        <span className="font-mono text-[10px] text-primary">{formatPrice(level.price)}</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="border-t border-border px-3 py-3 text-[10px] leading-5 text-muted">{sentenceCase(level.explanation)}</p>
                    </details>
                  ))}
              </div>
            </section>

            <details className="group rounded-2xl border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-4"><ShieldCheck className="h-4 w-4 text-primary" /><span className="text-[12px] font-semibold">Plain-English glossary</span><ChevronDown className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" /></summary>
              <div className="space-y-3 border-t border-border p-4 text-[11px] leading-5 text-muted">
                <p><strong className="text-foreground">GEX</strong> describes how quickly option delta changes as price moves. It helps explain whether hedging may dampen or amplify movement.</p>
                <p><strong className="text-foreground">DEX</strong> is the directional delta carried by the options complex. Positive or negative is context, not a guaranteed direction.</p>
                <p><strong className="text-foreground">HVL</strong> is the high-volatility transition level. <strong className="text-foreground">Zero Gamma</strong> is the modelled price where aggregate GEX crosses zero; they are related but not the same.</p>
                <p><strong className="text-foreground">MPO</strong> is the largest positive gamma concentration by open interest. <strong className="text-foreground">MPV</strong> is the largest positive concentration built from current-session volume.</p>
                <p><strong className="text-foreground">Vanna</strong> tracks sensitivity to implied-volatility changes. <strong className="text-foreground">Charm</strong> tracks how delta changes as time passes.</p>
              </div>
            </details>

            <p className="px-2 text-[9px] leading-4 text-muted">{data?.disclosure}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
