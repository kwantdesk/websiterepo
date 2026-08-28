"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  ExternalLink,
  Gauge,
  Globe2,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import type {
  MacroChatResponse,
  MacroDevelopment,
  MacroDirection,
  MacroEventBrief,
  MacroEventReceipt,
  MacroIntelligencePayload,
  MacroScenario,
} from "@/lib/macroIntelligence";
import { writeProtectedItem } from "@/lib/browserStorageQuota";

export type MacroNewsView = "macro" | "developments";

type ChatLine = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: MacroChatResponse["sources"];
};

const MACRO_CACHE_KEY = "kwantdesk:macro-intelligence:v1";
const MACRO_CHAT_KEY = "kwantdesk:macro-analyst-chat:v1";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function age(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return "";
  if (delta < 60_000) return "now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function directionClasses(direction: MacroDirection) {
  if (direction === "UP") return "border-primary/25 bg-primary/10 text-primary";
  if (direction === "DOWN") return "border-danger/25 bg-danger/10 text-danger";
  return "border-border bg-surface text-muted";
}

function DirectionIcon({ direction }: { direction: MacroDirection }) {
  if (direction === "UP") return <ArrowUpRight className="h-3.5 w-3.5" />;
  if (direction === "DOWN") return <ArrowDownRight className="h-3.5 w-3.5" />;
  return <ArrowRight className="h-3.5 w-3.5" />;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted">{children}</div>;
}

function CausalChain({ items }: { items: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {items.map((item, index) => (
        <div key={`${index}:${item}`} className="contents">
          <span className="rounded-lg border border-border bg-surface/70 px-2.5 py-1.5 text-[8px] font-semibold text-foreground">{item}</span>
          {index < items.length - 1 ? <ArrowRight className="h-3 w-3 shrink-0 text-primary" /> : null}
        </div>
      ))}
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: MacroScenario }) {
  const positive = scenario.label === "COOL / DOVISH" || scenario.label === "DE-ESCALATION";
  const danger = scenario.label === "HOT / HAWKISH" || scenario.label === "ESCALATION";
  return (
    <div className={`rounded-xl border p-3 ${positive ? "border-primary/20 bg-primary/[0.035]" : danger ? "border-danger/20 bg-danger/[0.035]" : "border-border bg-background/35"}`}>
      <div className={`text-[8px] font-bold tracking-[0.12em] ${positive ? "text-primary" : danger ? "text-danger" : "text-muted"}`}>{scenario.label}</div>
      <p className="mt-2 text-[9px] leading-4 text-foreground">{scenario.condition}</p>
      <div className="mt-2 rounded-lg border border-border/70 bg-surface/50 p-2.5 text-[8px] leading-4 text-muted">{scenario.likelyReaction}</div>
      <div className="mt-2 space-y-1">
        {scenario.confirmation.map((item) => <div key={item} className="flex items-start gap-1.5 text-[8px] leading-4 text-muted"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{item}</div>)}
      </div>
      <div className="mt-2 flex items-start gap-1.5 text-[8px] leading-4 text-danger"><XCircle className="mt-0.5 h-3 w-3 shrink-0" />{scenario.invalidation}</div>
    </div>
  );
}

function EventBriefCard({ event }: { event: MacroEventBrief }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-panel">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-surface/30">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${event.impact === "High" ? "border-danger/25 bg-danger/10 text-danger" : "border-primary/20 bg-primary/10 text-primary"}`}><Activity className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[8px] font-bold">{event.currency}</span>
            <span className="text-[8px] font-bold tracking-[0.1em] text-primary">{event.topic}</span>
            <span className="text-[8px] text-muted">{formatDateTime(event.date)}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[7px] font-bold ${event.impact === "High" ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"}`}>{event.impact.toUpperCase()}</span>
          </div>
          <h3 className="mt-1.5 text-[12px] font-semibold text-foreground">{event.name}</h3>
          <p className="mt-1 text-[9px] leading-4 text-muted">{event.plainEnglish}</p>
        </div>
        <ChevronDown className={`mt-2 h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="border-t border-border bg-background/25 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div>
              <Eyebrow>Why the market cares</Eyebrow>
              <p className="mt-2 max-w-4xl text-[10px] leading-5 text-foreground">{event.whyMarketsCare}</p>
              <CausalChain items={event.causalChain} />
            </div>
            <div className="flex gap-2 lg:flex-col">
              {[['Forecast', event.forecast || '—'], ['Previous', event.previous || '—']].map(([label, value]) => (
                <div key={label} className="min-w-[100px] rounded-xl border border-border bg-card p-3"><Eyebrow>{label}</Eyebrow><div className="mt-2 font-mono text-[12px] font-semibold">{value}</div></div>
              ))}
            </div>
          </div>
          <div className={`mt-4 grid gap-2 ${event.scenarios.length === 2 ? "md:grid-cols-2" : "xl:grid-cols-3"}`}>
            {event.scenarios.map((scenario) => <ScenarioCard key={scenario.label} scenario={scenario} />)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {event.assets.map((asset) => <span key={asset} className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[8px] text-muted">{asset}</span>)}
            {event.source ? <a href={event.source.url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-[8px] font-semibold text-primary">{event.source.publisher}<ExternalLink className="h-3 w-3" /></a> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ReceiptCard({ receipt }: { receipt: MacroEventReceipt }) {
  return (
    <article className="rounded-2xl border border-border bg-panel p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><CircleGauge className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[8px] text-muted"><span className="font-bold text-primary">POST-EVENT RECEIPT</span><span>{formatDateTime(receipt.releasedAt)}</span><span className="rounded-md bg-surface px-1.5 py-0.5 font-semibold">{receipt.evidenceStatus}</span></div>
          <h3 className="mt-1 text-[12px] font-semibold">{receipt.eventName}</h3>
          <p className="mt-1 text-[9px] leading-4 text-muted">{receipt.surprise}</p>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-center ${receipt.reasoningScore === null ? "border-border bg-surface" : receipt.reasoningScore >= 70 ? "border-primary/25 bg-primary/10" : "border-danger/25 bg-danger/10"}`}>
          <div className="text-[7px] font-bold uppercase tracking-[0.12em] text-muted">Reasoning score</div>
          <div className={`mt-1 font-mono text-[18px] font-bold ${receipt.reasoningScore === null ? "text-muted" : receipt.reasoningScore >= 70 ? "text-primary" : "text-danger"}`}>{receipt.reasoningScore ?? "—"}{receipt.reasoningScore !== null ? "%" : ""}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {receipt.observedMoves.map((move) => (
          <div key={move.symbol} className="rounded-xl border border-border bg-background/35 p-3">
            <div className="flex items-center justify-between"><span className="font-mono text-[9px] font-bold">{move.symbol}</span><span className={`flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[8px] ${directionClasses(move.direction)}`}><DirectionIcon direction={move.direction} />{move.percent >= 0 ? "+" : ""}{move.percent}%</span></div>
            <div className="mt-2 font-mono text-[12px] font-semibold">{move.points >= 0 ? "+" : ""}{move.points}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-xl border border-border bg-surface/45 px-3 py-2.5 text-[8px] leading-4 text-muted">{receipt.scoreExplanation}</p>
      {(receipt.gotRight.length || receipt.missed.length) ? <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3"><Eyebrow>What held</Eyebrow>{receipt.gotRight.map((item) => <div key={item} className="mt-2 flex gap-2 text-[8px] leading-4 text-muted"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{item}</div>)}</div>
        <div className="rounded-xl border border-danger/20 bg-danger/[0.035] p-3"><Eyebrow>What missed</Eyebrow>{receipt.missed.length ? receipt.missed.map((item) => <div key={item} className="mt-2 flex gap-2 text-[8px] leading-4 text-muted"><XCircle className="mt-0.5 h-3 w-3 shrink-0 text-danger" />{item}</div>) : <p className="mt-2 text-[8px] text-muted">No contradiction was verified in the scored evidence.</p>}</div>
      </div> : null}
    </article>
  );
}

function DevelopmentCard({ item }: { item: MacroDevelopment }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-panel">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-surface/30">
        <span className={`mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full ${item.urgency === "CRITICAL" ? "bg-danger" : "bg-primary"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2 text-[7px] font-bold tracking-[0.11em]"><span className="text-primary">{item.topic}</span><span className="text-muted">{item.status}</span><span className={item.urgency === "CRITICAL" ? "text-danger" : "text-muted"}>{item.urgency}</span><span className="font-normal tracking-normal text-muted">{age(item.publishedAt)}</span></div>
          <h3 className="mt-1.5 text-[12px] font-semibold leading-5 text-foreground">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-muted">{item.summary}</p>
        </div>
        <ChevronDown className={`mt-2 h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-border bg-background/25 p-4">
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-3"><Eyebrow>Economic channel</Eyebrow><p className="mt-2 text-[9px] leading-5 text-foreground">{item.economicChannel}</p><CausalChain items={item.economicChannel.split(" -> ")} /></div>
          <div className="rounded-xl border border-border bg-card p-3"><Eyebrow>Potential reaction</Eyebrow><p className="mt-2 text-[9px] leading-5 text-foreground">{item.potentialReaction}</p><div className="mt-3 flex flex-wrap gap-1.5">{item.assetsAffected.map((asset) => <span key={asset} className="rounded-md bg-surface px-2 py-1 font-mono text-[8px] text-muted">{asset}</span>)}</div></div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3"><Eyebrow>Confirmation required</Eyebrow>{item.confirmation.map((entry) => <div key={entry} className="mt-2 flex gap-2 text-[8px] leading-4 text-muted"><Target className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{entry}</div>)}</div>
          <div className="rounded-xl border border-danger/20 bg-danger/[0.035] p-3"><Eyebrow>Invalidation</Eyebrow><p className="mt-2 text-[8px] leading-4 text-muted">{item.invalidation}</p></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[8px] font-semibold text-primary">{source.publisher}{source.official ? " · OFFICIAL" : ""}<ExternalLink className="h-3 w-3" /></a>)}</div>
      </div> : null}
    </article>
  );
}

function MacroChatPanel() {
  const [instrument, setInstrument] = useState<"NQ" | "ES">("NQ");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(MACRO_CHAT_KEY) ?? "[]") as ChatLine[];
      if (Array.isArray(stored)) setMessages(stored.slice(-30));
    } catch {}
  }, []);
  useEffect(() => {
    writeProtectedItem(MACRO_CHAT_KEY, JSON.stringify(messages.slice(-30)));
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);
  const send = async () => {
    const message = input.trim();
    if (!message || sending) return;
    const userLine: ChatLine = { id: crypto.randomUUID(), role: "user", content: message };
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userLine]);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/macro-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, instrument, history }),
      });
      const payload = await response.json() as MacroChatResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Macro analyst could not respond.");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: payload.answer, sources: payload.sources }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Macro analyst could not respond.");
    } finally {
      setSending(false);
    }
  };
  return (
    <aside className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-primary/20 bg-panel xl:h-full xl:min-h-0">
      <div className="flex items-center gap-3 border-b border-border bg-primary/[0.045] p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Bot className="h-4 w-4" /></span>
        <div><div className="text-[11px] font-semibold">Macro Analyst</div><div className="text-[8px] text-muted">Live researched causal reasoning</div></div>
        <div className="ml-auto flex rounded-lg border border-border bg-background/50 p-0.5">{(["NQ", "ES"] as const).map((item) => <button key={item} type="button" onClick={() => setInstrument(item)} className={`rounded-md px-2 py-1 font-mono text-[8px] font-bold ${instrument === item ? "bg-primary text-background" : "text-muted"}`}>{item}</button>)}</div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!messages.length ? <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-4 text-center"><Sparkles className="h-6 w-6 text-primary" /><h3 className="mt-3 text-[11px] font-semibold">Ask what changed and why it matters</h3><p className="mt-2 text-[9px] leading-5 text-muted">Try: “How would a Strait of Hormuz disruption transmit into NQ?” or “What must confirm a dovish FOMC reaction?”</p></div> : null}
        {messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-[9px] leading-5 ${message.role === "user" ? "bg-primary text-background" : "border border-border bg-surface text-foreground"}`}><div className="whitespace-pre-wrap">{message.content}</div>{message.sources?.length ? <div className="mt-2 flex flex-wrap gap-1">{message.sources.slice(0, 5).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[7px] font-semibold text-primary">{source.title}</a>)}</div> : null}</div></div>)}
        {sending ? <div className="flex items-center gap-2 text-[8px] text-muted"><RefreshCw className="h-3 w-3 animate-spin text-primary" />Researching primary sources and market transmission…</div> : null}
        {error ? <div className="rounded-xl border border-danger/20 bg-danger/10 p-2.5 text-[8px] text-danger">{error}</div> : null}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background/55 p-2 focus-within:border-primary/35">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder="Ask the macro analyst…" className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-1 py-1 text-[9px] leading-5 text-foreground outline-none placeholder:text-muted" />
          <button type="button" onClick={() => void send()} disabled={!input.trim() || sending} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-background disabled:opacity-35"><Send className="h-3.5 w-3.5" /></button>
        </div>
        <p className="mt-2 text-center text-[7px] leading-3 text-muted">Research and decision support only. Verify live facts and price confirmation before acting.</p>
      </div>
    </aside>
  );
}

export default function MacroWorkspace({ view }: { view: MacroNewsView }) {
  const [payload, setPayload] = useState<MacroIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch(`/api/macro-intelligence${manual ? "?refresh=1" : ""}`, { cache: "no-store" });
      const next = await response.json() as MacroIntelligencePayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "Macro intelligence could not be loaded.");
      setPayload(next);
      setError(null);
      window.localStorage.setItem(MACRO_CACHE_KEY, JSON.stringify(next));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Macro intelligence could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    try {
      const cached = JSON.parse(window.localStorage.getItem(MACRO_CACHE_KEY) ?? "null") as MacroIntelligencePayload | null;
      if (cached?.generatedAt) { setPayload(cached); setLoading(false); }
    } catch {}
    void load();
    const timer = window.setInterval(() => void load(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [load]);
  const developmentGroups = useMemo(() => payload?.developments ?? [], [payload]);
  if (loading && !payload) return <KwantLoader page icon={BrainCircuit} title="Building macro intelligence" detail="Official evidence, causal chains and market receipts" />;
  if (!payload) return <div className="flex h-full items-center justify-center p-6"><div className="max-w-md rounded-2xl border border-danger/20 bg-panel p-6 text-center"><ShieldAlert className="mx-auto h-6 w-6 text-danger" /><h2 className="mt-3 text-[13px] font-semibold">Macro intelligence unavailable</h2><p className="mt-2 text-[9px] leading-5 text-muted">{error}</p><button type="button" onClick={() => void load(true)} className="mt-4 rounded-xl bg-primary px-4 py-2 text-[9px] font-semibold text-background">Retry</button></div></div>;
  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex min-h-[58px] shrink-0 flex-wrap items-center gap-3 border-b border-border bg-panel px-3 py-2 lg:px-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">{view === "macro" ? <BrainCircuit className="h-[17px] w-[17px]" /> : <Radio className="h-[17px] w-[17px]" />}</span>
        <div className="mr-auto"><div className="text-[12px] font-semibold">{view === "macro" ? "Macroeconomics" : "Live Macro Developments"}</div><div className="text-[9px] text-muted">{view === "macro" ? "What is happening, why markets care, and what must confirm" : "Policy and geopolitical shocks translated into tradable causal chains"}</div></div>
        <div className="hidden rounded-xl border border-border bg-surface px-3 py-2 text-[8px] text-muted md:block"><span className="font-mono font-semibold text-foreground">{payload.officialSourceCount}</span> official evidence points · <span className="font-mono font-semibold text-foreground">{payload.sourceCount}</span> total</div>
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-[8px] text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />{payload.status}</div>
        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-foreground disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /></button>
      </header>
      {error ? <div className="shrink-0 border-b border-danger/20 bg-danger/10 px-4 py-2 text-center text-[8px] text-danger">Refresh delayed: {error}. Showing the last good macro map.</div> : null}
      <div className="grid min-h-0 flex-1 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:p-4">
        <main className="min-h-0 overflow-y-auto pr-0 xl:pr-1">
          {view === "macro" ? <>
            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{payload.pulse.map((item) => <div key={item.label} className="rounded-2xl border border-border bg-panel p-3.5"><div className="flex items-center justify-between"><Eyebrow>{item.label}</Eyebrow><span className={`flex items-center rounded-md border px-1.5 py-0.5 text-[7px] font-bold ${directionClasses(item.direction)}`}><DirectionIcon direction={item.direction} />{item.state}</span></div><p className="mt-3 text-[8px] leading-4 text-muted">{item.explanation}</p><div className="mt-2 font-mono text-[7px] text-primary">{item.evidenceCount} verified release{item.evidenceCount === 1 ? "" : "s"}</div></div>)}</section>
            <section className="mt-3 rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_90%_0%,color-mix(in_srgb,var(--color-primary)_10%,transparent),transparent_40%)] p-4"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Gauge className="h-4 w-4" /></span><div><Eyebrow>How to read this page</Eyebrow><p className="mt-2 max-w-5xl text-[10px] leading-5 text-foreground">The forecast is not “market up” or “market down.” It is a conditional transmission map. First identify the surprise, then require the directly affected asset, rates, USD and index futures to confirm the same story. A headline without transmission is not a trade.</p></div></div></section>
            <div className="mt-4 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><div><h2 className="text-[12px] font-semibold">Upcoming event maps</h2><p className="text-[8px] text-muted">Pre-event scenarios are locked before the release</p></div></div>
            <section className="mt-2 space-y-2">{payload.upcoming.length ? payload.upcoming.map((event) => <EventBriefCard key={event.id} event={event} />) : <div className="rounded-2xl border border-border bg-panel p-8 text-center text-[9px] text-muted">No upcoming USD event currently meets the medium/high-impact filter.</div>}</section>
            <div className="mt-5 flex items-center gap-2"><CircleGauge className="h-4 w-4 text-primary" /><div><h2 className="text-[12px] font-semibold">Post-event receipts</h2><p className="text-[8px] text-muted">The original conditional map versus verified 30-minute futures evidence</p></div></div>
            <section className="mt-2 space-y-2">{payload.receipts.length ? payload.receipts.map((receipt) => <ReceiptCard key={receipt.id} receipt={receipt} />) : <div className="rounded-2xl border border-border bg-panel p-8 text-center text-[9px] text-muted">Receipts appear after releases contain comparable actual/forecast values and CME response evidence.</div>}</section>
          </> : <>
            <section className="rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_90%_0%,color-mix(in_srgb,var(--color-primary)_12%,transparent),transparent_42%)] p-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Globe2 className="h-4 w-4" /></span><div><Eyebrow>Live development standard</Eyebrow><h2 className="mt-1 text-[13px] font-semibold">A dramatic headline is not automatically economically important</h2><p className="mt-2 max-w-5xl text-[9px] leading-5 text-muted">Each item must identify the transmission channel, affected assets, possible response, confirmation and invalidation. Official statements establish facts; wider reporting is labelled developing until corroborated.</p></div></div></section>
            <div className="mt-4 flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /><div><h2 className="text-[12px] font-semibold">Development tape</h2><p className="text-[8px] text-muted">Newest verified and developing macro evidence first</p></div></div>
            <section className="mt-2 space-y-2">{developmentGroups.length ? developmentGroups.map((item) => <DevelopmentCard key={item.id} item={item} />) : <div className="rounded-2xl border border-border bg-panel p-8 text-center"><Radio className="mx-auto h-5 w-5 text-muted" /><p className="mt-3 text-[9px] text-muted">No classified development is available from the connected evidence sources.</p></div>}</section>
          </>}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-panel px-4 py-3 text-[8px] leading-4 text-muted"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span>{payload.note} Updated {formatDateTime(payload.generatedAt)}.</span></div>
        </main>
        <MacroChatPanel />
      </div>
    </div>
  );
}
