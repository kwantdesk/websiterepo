"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Newspaper, Pause, Play, Search } from "lucide-react";
import { financialInfoUnavailable, parseFinancialInfo, type FinancialInfoPayload } from "@/lib/financialInfo";
import TimeZoneSelect from "@/components/ui/TimeZoneSelect";
import KwantSelect from "@/components/ui/KwantSelect";
import { browserTimeZone } from "@/lib/timeZones";

export default function FinancialInfoWorkspace() {
  const [payload, setPayload] = useState<FinancialInfoPayload | null>(null);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [timeZone, setTimeZone] = useState("America/New_York");
  const [connectionError, setConnectionError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<FinancialInfoPayload | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const atTop = useRef(true);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => setTimeZone(browserTimeZone()), []);
  useEffect(() => {
    if (paused) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let busy = false;
    const load = async () => {
      if (disposed || document.hidden || busy) return;
      busy = true;
      controller = new AbortController();
      const deadline = setTimeout(() => controller?.abort(), 25_000);
      let delay = 60_000;
      try {
        const response = await fetch("/api/financial-info", { signal: controller.signal, cache: "default" });
        if (!response.ok) throw Error("News unavailable");
        const next = parseFinancialInfo(await response.json());
        delay = next.refreshAfterMs;
        if (!disposed) {
          if (atTop.current) { setPayload(next); setPendingPayload(null); }
          else setPendingPayload(next);
          setConnectionError(false);
          setNow(Date.now());
        }
      } catch {
        if (!disposed) { setConnectionError(true); setPayload(previous => previous ?? financialInfoUnavailable(true)); }
      } finally {
        clearTimeout(deadline); busy = false;
        if (!disposed) timer = setTimeout(() => { timer = undefined; void load(); }, delay);
      }
    };
    const visibility = () => { if (!document.hidden) { if (timer) clearTimeout(timer); timer = undefined; void load(); } else { if (timer) clearTimeout(timer); timer = undefined; } };
    document.addEventListener("visibilitychange", visibility);
    void load();
    return () => { disposed = true; if (timer) clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", visibility); };
  }, [paused]);
  const categories = useMemo(() => ["All", ...new Set((payload?.items ?? []).flatMap(item => item.categories))].slice(0, 50), [payload]);
  const visible = useMemo(() => (payload?.items ?? []).filter(item => (category === "All" || item.categories.includes(category)) && `${item.title} ${item.categories.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [payload, category, query]);
  const current = visible.find(item => item.id === selected);
  const clock = useMemo(() => new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }), [timeZone]);
  const date = useMemo(() => new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "2-digit", month: "short", year: "numeric" }), [timeZone]);
  const stale = Boolean(payload?.stale || connectionError || (payload?.collectedAt && now - Date.parse(payload.collectedAt) > 300_000));
  const status = paused ? "Paused" : !payload ? "Connecting" : !payload.configured ? "Not connected" : stale ? "Delayed / unavailable" : "Auto-updating RSS";
  return (
    <section className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Financial Info">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3"><Newspaper className="h-5 w-5 text-primary" /><div><h2 className="text-sm font-semibold">Financial Info</h2><p className="text-[10px] text-muted">FinancialJuice · headline wire</p></div></div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span role="status" className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${payload?.configured && !stale && !paused ? "bg-primary" : "bg-muted"}`} />{status}</span>
          <TimeZoneSelect value={timeZone} onChange={setTimeZone} className="max-w-56" />
          <button type="button" onClick={() => setPaused(value => !value)} className="flex items-center gap-2 border border-border px-3 py-2 hover:bg-surface" aria-pressed={paused}>{paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}{paused ? "Resume" : "Pause"}</button>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
        <label className="flex min-w-44 flex-1 items-center gap-2 border border-border bg-surface px-3 py-2"><Search className="h-3.5 w-3.5 text-muted" /><input aria-label="Search financial headlines" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search headlines or keywords…" className="w-full bg-transparent text-xs outline-none" /></label>
        <label className="flex items-center gap-2 text-xs text-muted">Category<KwantSelect aria-label="Headline category" value={category} onChange={event => setCategory(event.target.value)} className="max-w-48 border border-border bg-surface px-3 py-2 text-foreground">{categories.map(value => <option key={value}>{value}</option>)}</KwantSelect></label>
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-[10px] text-muted">
        <span>Newest first · original publication times · RSS is not an instant premium feed</span>
        <span className="shrink-0">Last collection: {payload?.collectedAt ? `${date.format(new Date(payload.collectedAt))} ${clock.format(new Date(payload.collectedAt))}` : "—"}</span>
      </div>
      {pendingPayload ? <button type="button" className="border-b border-primary/30 bg-primary/10 px-4 py-2 text-xs text-primary" onClick={() => { setPayload(pendingPayload); setPendingPayload(null); atTop.current = true; list.current?.scrollTo({ top: 0 }); }}>Latest update available — return to newest</button> : null}
      <div className="flex min-h-0 flex-1">
        <div ref={list} onScroll={event => { atTop.current = event.currentTarget.scrollTop < 24; }} className="min-w-0 flex-1 overflow-y-auto" aria-label="Financial headlines">
          {!payload ? <p className="p-6 text-sm text-muted" role="status">Connecting to the shared news feed…</p> : null}
          {payload && !payload.configured ? <div className="mx-auto max-w-xl px-6 py-12"><Newspaper className="mb-4 h-8 w-8 text-muted" /><h3 className="mb-2 text-base font-semibold">Your financial news wire is ready to connect</h3><p className="text-sm leading-relaxed text-muted">No news source is connected yet. The shared scraper needs an Apify account and a scheduled feed. Once connected, new headlines appear here automatically, even when collection runs without this page open.</p><p className="mt-3 text-xs text-muted">A spending limit and source usage permissions must be confirmed before enabling collection. This page never starts paid scraper runs.</p></div> : null}
          {payload?.configured && !visible.length ? <p className="p-6 text-sm text-muted">{payload.items.length ? "No headlines match your filters." : payload.note}</p> : null}
          {visible.map((item, index) => {
            const day = date.format(new Date(item.publishedAt));
            const previous = visible[index - 1];
            return <div key={item.id}>{!previous || date.format(new Date(previous.publishedAt)) !== day ? <div className="sticky top-0 z-10 border-y border-border bg-surface px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{day}</div> : null}<button type="button" onClick={() => setSelected(item.id === selected ? null : item.id)} className={`flex w-full items-start gap-4 border-b border-border/60 px-4 py-3 text-left hover:bg-surface ${selected === item.id ? "bg-primary/10" : ""}`}><time dateTime={item.publishedAt} className="w-16 shrink-0 pt-0.5 text-[11px] tabular-nums text-muted">{clock.format(new Date(item.publishedAt))}</time><span className="min-w-0"><span className="block text-[13px] leading-relaxed">{item.title}</span>{item.categories.length ? <span className="mt-1 block text-[10px] text-muted">{item.categories.join(" · ")}</span> : null}</span></button></div>;
          })}
        </div>
        {current ? <aside className="w-[30%] min-w-60 max-w-sm overflow-y-auto border-l border-border bg-surface p-4"><h3 className="text-sm font-semibold leading-relaxed">{current.title}</h3><p className="mt-3 text-xs text-muted">{date.format(new Date(current.publishedAt))} · {clock.format(new Date(current.publishedAt))}</p><p className="mt-4 text-xs leading-relaxed text-muted">Original FinancialJuice headline. Read the source for the full context.</p><a href={current.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs text-primary">Open original <ExternalLink className="h-3 w-3" /></a><button type="button" onClick={() => setSelected(null)} className="mt-6 block text-xs text-muted">Close details</button></aside> : null}
      </div>
      <footer className="border-t border-border px-4 py-2 text-[10px] text-muted">{connectionError ? "Connection unavailable. Retaining the last received headlines." : payload?.note ?? "Connecting…"}{paused ? " Display paused; background collection is independent." : ""}</footer>
    </section>
  );
}
