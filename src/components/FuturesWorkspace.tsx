"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Check, CirclePlus, Search, Settings2, X } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import Chart from "@/components/Chart";
import { DATABENTO_INSTRUMENTS, type DatabentoInstrument, type LevelOneQuote, type MarketBar } from "@/lib/databento";
import { defaultChartSettings } from "@/lib/chartSettings";

const DEFAULT_WATCHLIST = ["ES.v.0", "NQ.v.0", "MES.v.0", "MNQ.v.0", "YM.v.0", "RTY.v.0", "CL.v.0", "GC.v.0", "ZN.v.0", "6E.v.0"];
const INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1D"];

function label(symbol: string) {
  return DATABENTO_INSTRUMENTS.find((instrument) => instrument.symbol === symbol)?.label ?? symbol;
}

function compactSymbol(symbol: string) {
  return symbol.replace(".v.0", "");
}

function startFor(timeframe: string) {
  const hours = timeframe === "1m" ? 8 : timeframe === "5m" ? 36 : timeframe === "15m" ? 7 * 24 : timeframe === "1h" ? 30 * 24 : 120 * 24;
  return new Date(Date.now() - hours * 60 * 60_000).toISOString();
}

function formatPrice(value: number) {
  if (!Number.isFinite(value) || value === 0) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: value < 100 ? 3 : 2, maximumFractionDigits: value < 100 ? 4 : 2 });
}

export default function FuturesWorkspace({ email }: { email: string }) {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [selected, setSelected] = useState(DEFAULT_WATCHLIST[0]);
  const [timeframe, setTimeframe] = useState("5m");
  const [candles, setCandles] = useState<MarketBar[]>([]);
  const [quotes, setQuotes] = useState<Record<string, LevelOneQuote>>({});
  const [loadingChart, setLoadingChart] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("kwantdesk-futures-watchlist") ?? "null");
      if (Array.isArray(saved) && saved.every((item) => typeof item === "string")) {
        const permitted = saved.filter((item) => DATABENTO_INSTRUMENTS.some((instrument) => instrument.symbol === item && instrument.kind === "future"));
        if (permitted.length) {
          setWatchlist(permitted);
          setSelected(permitted[0]);
        }
      }
    } catch { /* use the liquid default universe */ }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kwantdesk-futures-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    let active = true;
    setLoadingChart(true);
    setFeedError(null);
    fetch(`/api/databento/market?kind=bars&symbols=${encodeURIComponent(selected)}&timeframe=${timeframe}&start=${encodeURIComponent(startFor(timeframe))}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load Databento bars.");
        return payload.candles as MarketBar[];
      })
      .then((next) => { if (active) setCandles(next); })
      .catch((error) => { if (active) { setCandles([]); setFeedError(error instanceof Error ? error.message : "Unable to load Databento bars."); } })
      .finally(() => { if (active) setLoadingChart(false); });
    return () => { active = false; };
  }, [selected, timeframe]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/databento/market?kind=snapshot&symbols=${encodeURIComponent(watchlist.join(","))}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Level 1 feed unavailable.");
        if (!active) return;
        setQuotes((current) => {
          const next = { ...current };
          for (const quote of payload.quotes as LevelOneQuote[]) next[quote.symbol] = quote;
          return next;
        });
        setFeedError(null);
      } catch (error) {
        if (active) setFeedError(error instanceof Error ? error.message : "Level 1 feed unavailable.");
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [watchlist]);

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return DATABENTO_INSTRUMENTS.filter((instrument) => instrument.kind === "future" && (!needle || `${instrument.symbol} ${instrument.label} ${instrument.group}`.toLowerCase().includes(needle)));
  }, [query]);

  const addInstrument = (instrument: DatabentoInstrument) => {
    setWatchlist((current) => current.includes(instrument.symbol) ? current : [...current, instrument.symbol]);
    setSelected(instrument.symbol);
    setShowAdd(false);
    setQuery("");
  };

  const selectedQuote = quotes[selected];

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar activeItem="charts" accountLabel="Profile" accountTitle={email} onAccountClick={() => { window.location.href = "/settings"; }} />
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-panel px-5">
          <div className="flex items-center gap-3"><span className="text-[11px] font-semibold tracking-[0.14em] text-muted">KWANT DESK</span><span className="h-4 w-px bg-border" /><span className="text-[13px] font-medium">Futures & Options</span></div>
          <div className="flex items-center gap-2 text-[11px]"><span className={`h-2 w-2 rounded-full ${feedError ? "bg-danger" : "bg-candle-up"}`} /><span className="text-muted">{feedError ? "Feed attention" : "Databento Level 1"}</span></div>
        </header>

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-3">
              <div><div className="flex items-baseline gap-3"><h1 className="text-xl font-semibold tracking-tight">{compactSymbol(selected)}</h1><span className="text-[13px] text-muted">{label(selected)}</span></div><p className="mt-1 text-[11px] text-muted">GLBX.MDP3 · volume-ranked front month · futures</p></div>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-panel p-1">{INTERVALS.map((interval) => <button key={interval} type="button" onClick={() => setTimeframe(interval)} className={`rounded-md px-2 py-1 text-[11px] ${timeframe === interval ? "bg-primary text-background" : "text-muted hover:bg-surface hover:text-foreground"}`}>{interval}</button>)}</div>
            </div>

            <div className="min-h-0 flex-1 p-3">
              {loadingChart ? <div className="grid h-full place-items-center text-[13px] text-muted">Loading Databento bars…</div> : feedError && !candles.length ? <div className="grid h-full place-items-center text-center"><div><p className="text-[13px] text-danger">{feedError}</p><p className="mt-2 text-[11px] text-muted">Check the Databento key and GLBX.MDP3 entitlement.</p></div></div> : <Chart candles={candles} instrument={compactSymbol(selected)} timeframe={timeframe} settings={defaultChartSettings} marketIsActive />}
            </div>
            <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border px-4 text-[10px] text-muted"><span>{selectedQuote ? `Bid ${formatPrice(selectedQuote.bid)} · Ask ${formatPrice(selectedQuote.ask)}` : "Awaiting top-of-book quote"}</span><span>Delayed polling every 15s · live streaming next</span></footer>
          </section>

          <aside className="w-[300px] shrink-0 border-l border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-[13px] font-semibold">Watchlist</h2><p className="mt-0.5 text-[10px] text-muted">Popular futures</p></div><button type="button" onClick={() => setShowAdd(true)} className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted hover:border-primary hover:text-primary" title="Add instrument"><CirclePlus className="h-4 w-4" /></button></div>
            <div className="max-h-[calc(100vh-105px)] overflow-y-auto">{watchlist.map((symbol) => { const quote = quotes[symbol]; const active = selected === symbol; return <button key={symbol} type="button" onClick={() => setSelected(symbol)} className={`grid w-full grid-cols-[42px_1fr_auto] items-center gap-2 border-b border-border/70 px-4 py-3 text-left transition-colors ${active ? "bg-surface/70" : "hover:bg-surface/40"}`}><span className="font-mono text-[12px] font-semibold text-primary">{compactSymbol(symbol)}</span><span className="min-w-0"><span className="block truncate text-[11px] font-medium">{label(symbol)}</span><span className="text-[10px] text-muted">{DATABENTO_INSTRUMENTS.find((instrument) => instrument.symbol === symbol)?.venue}</span></span><span className="text-right"><span className="block font-mono text-[11px]">{formatPrice(quote?.last ?? 0)}</span><span className={`text-[10px] ${quote?.changePercent && quote.changePercent < 0 ? "text-danger" : "text-candle-up"}`}>{quote ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "—"}</span></span></button>; })}</div>
          </aside>
        </div>
      </section>

      {showAdd && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-5 backdrop-blur-sm"><section className="flex max-h-[min(680px,90vh)] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"><header className="flex items-center justify-between border-b border-border p-5"><div><h2 className="text-lg font-semibold">Add futures instrument</h2><p className="mt-1 text-[12px] text-muted">CME, CBOT, NYMEX and COMEX · Databento GLBX.MDP3</p></div><button type="button" onClick={() => setShowAdd(false)} className="text-muted hover:text-foreground"><X className="h-5 w-5" /></button></header><div className="border-b border-border p-4"><label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"><Search className="h-4 w-4 text-muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ES, gold, crude, treasury…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted" /></label></div><div className="overflow-y-auto p-2">{searchResults.map((instrument) => { const added = watchlist.includes(instrument.symbol); return <button key={instrument.symbol} type="button" disabled={added} onClick={() => addInstrument(instrument)} className="grid w-full grid-cols-[66px_1fr_auto] items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-surface disabled:opacity-50"><span className="font-mono text-[12px] font-semibold text-primary">{compactSymbol(instrument.symbol)}</span><span><span className="block text-[13px] font-medium">{instrument.label}</span><span className="text-[11px] text-muted">{instrument.group} · {instrument.venue}</span></span>{added ? <Check className="h-4 w-4 text-candle-up" /> : <CirclePlus className="h-4 w-4 text-muted" />}</button>; })}</div><footer className="border-t border-border p-4 text-[11px] text-muted">Options-on-futures chains are next: they require selecting a specific expiry and strike before subscribing to Level 1.</footer></section></div>}
    </main>
  );
}
