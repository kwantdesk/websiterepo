"use client";

import KwantSelect from "@/components/ui/KwantSelect";

import { useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import {
  ArrowDown,
  ArrowDownToLine,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Copy,
  Eye,
  FlaskConical,
  Flame,
  Plus,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Star,
  Store,
  Trophy,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";

type Strategy = {
  id: string;
  title: string;
  author: string;
  verified: boolean;
  description: string;
  language: string;
  pf: number;
  wr: number;
  trades: string;
  clones: string;
  instrument: string;
  timeframe: string;
  price: string;
  rating: number;
  reviews: number;
  type: string;
  paid: boolean;
  activeUsers?: string;
  favourites?: string;
  views?: string;
  weekClones?: string;
  clones24h?: number;
  weeklyGrowth?: number;
  downloads30d?: number[];
};

const featured: Strategy[] = [
  { id: "silver", title: "ICT Silver Bullet NAS100", author: "@quantmaster", verified: true, description: "NY session liquidity sweep and FVG continuation model for NAS100.", language: "TS", pf: 2.34, wr: 48.2, trades: "1,247", clones: "3,421", instrument: "NAS100", timeframe: "5m", price: "Free", rating: 4.8, reviews: 342, type: "ICT", paid: false },
  { id: "gold", title: "Gold Scalper Pro", author: "@goldfx", verified: true, description: "London gold scalper using VWAP, volatility expansion, and structure stops.", language: "Pine", pf: 1.89, wr: 52.1, trades: "2,890", clones: "1,203", instrument: "XAUUSD", timeframe: "1m", price: "$49.99/month", rating: 4.6, reviews: 189, type: "Scalping", paid: true },
  { id: "btc", title: "BTC Momentum Hunter", author: "@cryptoalgo", verified: true, description: "Crypto momentum breakout strategy for high-liquidity BTC sessions.", language: "Python", pf: 2.12, wr: 44.5, trades: "892", clones: "2,156", instrument: "BTCUSD", timeframe: "5m", price: "$29.99", rating: 4.7, reviews: 267, type: "Momentum", paid: true },
];

const strategies: Strategy[] = [
  { id: "ema", title: "EMA Cross Strategy", author: "@guest", verified: true, description: "Example EMA crossover strategy for demo and backtesting.", language: "TS", pf: 1.78, wr: 43, trades: "1,120", clones: "2,341", instrument: "NAS100", timeframe: "5m", price: "Free", rating: 4.5, reviews: 122, type: "Trend Following", paid: false },
  { id: "fvg", title: "FVG Scalper London", author: "@goldsniper", verified: true, description: "London session fair value gap scalper built for fast XAUUSD reversals.", language: "Pine", pf: 2.1, wr: 38, trades: "842", clones: "1,892", instrument: "XAUUSD", timeframe: "1m", price: "$19.99", rating: 4.7, reviews: 98, type: "Scalping", paid: true },
  { id: "rsi", title: "Mean Reversion RSI", author: "@fxlab", verified: false, description: "RSI exhaustion and mean reversion framework with volatility filters.", language: "Python", pf: 1.54, wr: 55, trades: "1,604", clones: "3,102", instrument: "EURUSD", timeframe: "15m", price: "Free", rating: 4.3, reviews: 211, type: "Mean Reversion", paid: false },
  { id: "liq", title: "Liquidity Sweep Hunter", author: "@icttrader", verified: true, description: "Targets stop runs into displacement candles and structure-confirmed continuation.", language: "TS", pf: 2.45, wr: 41, trades: "701", clones: "987", instrument: "NAS100", timeframe: "5m", price: "$39.99", rating: 4.8, reviews: 76, type: "SMC", paid: true },
  { id: "bb", title: "Bollinger Squeeze Breakout", author: "@eurotrader", verified: false, description: "Volatility compression breakout model using Bollinger width and ATR expansion.", language: "MQL5", pf: 1.62, wr: 47, trades: "934", clones: "1,567", instrument: "GER40", timeframe: "15m", price: "Free", rating: 4.2, reviews: 88, type: "Breakout", paid: false },
  { id: "ob", title: "SMC Order Block Entry", author: "@smcmaster", verified: true, description: "Order block retest strategy with trend bias and BTC liquidity filters.", language: "Pine", pf: 1.93, wr: 44, trades: "1,022", clones: "2,234", instrument: "BTCUSD", timeframe: "5m", price: "$14.99/mo", rating: 4.6, reviews: 154, type: "Order Block", paid: true },
  { id: "atr", title: "ATR Trailing Stop System", author: "@quantdev", verified: true, description: "Multi-instrument trend system with ATR trailing exits and regime filters.", language: "TS", pf: 1.71, wr: 51, trades: "2,452", clones: "4,521", instrument: "Multiple", timeframe: "1h", price: "Free", rating: 4.4, reviews: 302, type: "Trend", paid: false },
  { id: "session", title: "Session Momentum Scalper", author: "@algopro", verified: false, description: "NinjaScript session breakout strategy for NAS100 open volatility.", language: "C#", pf: 2.08, wr: 39, trades: "566", clones: "756", instrument: "NAS100", timeframe: "1m", price: "$24.99", rating: 4.5, reviews: 54, type: "Momentum", paid: true },
  { id: "vwap", title: "VWAP Reversal Strategy", author: "@vwapking", verified: false, description: "VWAP deviation reversal strategy for S&P500 intraday mean reversion.", language: "Python", pf: 1.48, wr: 53, trades: "1,308", clones: "2,890", instrument: "S&P500", timeframe: "5m", price: "Free", rating: 4.1, reviews: 133, type: "Reversal", paid: false },
  { id: "mtf", title: "Multi-TF Trend Follower", author: "@trendmaster", verified: true, description: "Higher-timeframe trend filter with lower-timeframe continuation entries.", language: "TS", pf: 2.67, wr: 36, trades: "744", clones: "1,123", instrument: "Multiple", timeframe: "4h", price: "$59.99", rating: 4.9, reviews: 91, type: "Swing", paid: true },
  { id: "news", title: "News Fade System", author: "@newstrader", verified: false, description: "Fades overextended post-news spikes after volatility normalizes.", language: "Pine", pf: 1.55, wr: 48, trades: "640", clones: "1,345", instrument: "XAUUSD", timeframe: "5m", price: "Free", rating: 4.0, reviews: 62, type: "News", paid: false },
  { id: "harmonic", title: "Harmonic Pattern Bot", author: "@harmonicfx", verified: true, description: "MQL5 harmonic pattern scanner with confluence-based entries.", language: "MQL5", pf: 1.82, wr: 42, trades: "489", clones: "678", instrument: "GBPUSD", timeframe: "1h", price: "$34.99/mo", rating: 4.3, reviews: 47, type: "Pattern", paid: true },
];

const langClass: Record<string, string> = {
  TS: "bg-primary/10 text-primary",
  Pine: "bg-purple-500/10 text-purple-400",
  Python: "bg-blue-500/10 text-blue-400",
  "C#": "bg-orange-500/10 text-orange-400",
  MQL5: "bg-cyan-500/10 text-cyan-400",
};

function strategySocial(strategy: Strategy) {
  const seed = strategy.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const activeUsers = strategy.activeUsers ?? `${420 + (seed % 730)} active`;
  const favourites = strategy.favourites ?? (850 + seed * 3).toLocaleString();
  const views = strategy.views ?? `${(8 + (seed % 90) / 10).toFixed(1)}K`;
  const weekClones = strategy.weekClones ?? (180 + (seed % 900)).toLocaleString();
  const clones24h = strategy.clones24h ?? 70 + (seed % 150);
  const weeklyGrowth = strategy.weeklyGrowth ?? 38 + (seed % 54);
  const downloads30d = strategy.downloads30d ?? Array.from({ length: 18 }, (_, index) => 10 + ((seed + index * 17) % 48));
  return { activeUsers, favourites, views, weekClones, clones24h, weeklyGrowth, downloads30d };
}

function Sidebar() {
  return <AppSidebar activeItem="vault" />;
}

function Rating({ rating, small = false }: { rating: number; small?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, index) => <Star key={index} className={`${small ? "h-3 w-3" : "h-4 w-4"} ${index < Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted"}`} />)}
    </div>
  );
}

function Author({ strategy }: { strategy: Strategy }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-[10px] font-semibold">{strategy.author.slice(1, 3).toUpperCase()}</div>
      <span className="text-[12px] text-muted">{strategy.author}</span>
      {/* No fabricated verification marks: the catalog below is illustrative
          placeholder content, so a "verified author" badge would be a lie. */}
    </div>
  );
}

function StrategyCard({ strategy, onClick }: { strategy: Strategy; onClick: () => void }) {
  const social = strategySocial(strategy);
  return (
    <button onClick={onClick} className="rounded-2xl border border-border bg-panel p-5 text-left transition-all hover:border-primary/20">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className={`rounded-lg px-2 py-0.5 text-[10px] ${langClass[strategy.language] ?? "bg-surface text-muted"}`}>{strategy.language}</span>
        <span className={strategy.paid ? "rounded-lg bg-primary/10 px-2 py-1 text-[11px] text-primary" : "text-[12px] font-semibold text-primary"}>{strategy.price}</span>
      </div>
      <h3 className="text-[15px] font-semibold text-foreground">{strategy.title}</h3>
      <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted">{strategy.description}</p>
      <div className="mt-4"><Author strategy={strategy} /></div>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-background/40 p-3 text-[12px]">
        <div><span className="text-muted">PF</span><div className={strategy.pf > 1.5 ? "font-mono text-primary" : "font-mono"}>{strategy.pf}</div></div>
        <div><span className="text-muted">Win Rate</span><div className="font-mono">{strategy.wr}%</div></div>
        <div><span className="text-muted">Trades</span><div className="font-mono">{strategy.trades}</div></div>
        <div><span className="text-muted">Clones</span><div className="flex items-center gap-1 font-mono"><ArrowDown className="h-3 w-3 text-primary" />{strategy.clones}</div></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Rating rating={strategy.rating} small /><span className="text-[11px] text-muted">{strategy.reviews}</span></div>
        <div className="flex gap-1"><span className="rounded-lg bg-surface px-2 py-1 text-[10px] text-muted">{strategy.instrument}</span><span className="rounded-lg bg-surface px-2 py-1 text-[10px] text-muted">{strategy.timeframe}</span></div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border pt-3 text-[10px] text-muted">
        <span className="flex items-center gap-1"><ArrowDownToLine className="h-3 w-3 text-primary" />{strategy.clones}</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3 text-primary" />{social.activeUsers}</span>
        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400" />{social.favourites}</span>
        <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-muted" />{social.views}</span>
      </div>
      <div className="mt-4 flex justify-end">{strategy.paid ? <span className="rounded-xl bg-primary px-3 py-1.5 text-[12px] font-semibold text-background">Buy</span> : <span className="text-[12px] font-semibold text-primary">Clone</span>}</div>
    </button>
  );
}

export default function VaultPage() {
  const [selected, setSelected] = useState<Strategy | null>(null);
  const [detailTab, setDetailTab] = useState("Overview");
  const [showPublish, setShowPublish] = useState(false);
  const [publishStep, setPublishStep] = useState(1);
  const [showMine, setShowMine] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mr-auto flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Store className="h-5 w-5" /></div>
            <div><h1 className="text-[20px] font-semibold">The Vault</h1><p className="text-[13px] text-muted">Discover, share & sell trading strategies</p></div>
          </div>
          <button onClick={() => setShowPublish(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background"><Plus className="h-4 w-4" />Publish Strategy</button>
          <button onClick={() => setShowMine((value) => !value)} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">My Published</button>
          <div className="flex w-[300px] items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"><Search className="h-4 w-4 text-muted" /><input placeholder="Search strategies..." className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted" /></div>
        </header>

        <div className="space-y-6 p-6">
          <div className="rounded-2xl border border-amber-400/40 bg-amber-950/30 px-4 py-3 text-[13px] text-amber-200">
            <span className="font-semibold uppercase tracking-[0.08em]">Preview catalog</span>
            {" — the strategies, authors, performance figures, ratings and engagement counts on this page are illustrative placeholders, not a live marketplace."}
          </div>
          <section className="space-y-3 rounded-2xl border border-border bg-panel p-4">
            {[
              ["Category", "All", "Free", "Paid", "Most Popular", "Newest", "Top Rated", "Most Cloned"],
              ["Instrument", "All", "NAS100", "XAUUSD", "BTCUSD", "EURUSD", "GER40", "Forex", "Crypto", "Indices", "Futures"],
              ["Language", "All", "TypeScript", "Pine Script", "Python", "C#", "MQL5"],
              ["Profit Factor", "All", ">1.5", ">2.0", ">3.0"],
              ["Win Rate", "All", ">40%", ">50%", ">60%"],
              ["Timeframe", "All", "Scalping (1m-5m)", "Intraday (15m-1h)", "Swing (4h-1D)"],
            ].map((row) => <div key={row[0]} className="flex flex-wrap items-center gap-2"><span className="w-24 text-[12px] font-semibold text-muted">{row[0]}</span>{row.slice(1).map((item, index) => <button key={item} className={`rounded-xl px-3 py-1.5 text-[12px] transition-all ${index === 0 ? "border border-border bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>{item}</button>)}</div>)}
          </section>

          {showMine && (
            <section className="rounded-2xl border border-border bg-panel p-5">
              <h2 className="text-[18px] font-semibold">My Published</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-4">
                {["Total earned $8,420", "This month $1,140", "Pending payout $620", "Avg rating 4.7"].map((stat) => <div key={stat} className="rounded-xl border border-border bg-background/40 p-4 font-mono text-[13px] text-primary">{stat}</div>)}
              </div>
              <div className="mt-4 space-y-2">{featured.map((strategy) => <div key={strategy.id} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3 text-[13px]"><span>{strategy.title}</span><span className="text-muted">views 12.4K · clones {strategy.clones} · revenue $2,140 · rating {strategy.rating}</span><div className="flex gap-2"><button className="text-muted hover:text-foreground">Edit</button><button className="text-danger">Unpublish</button><button className="text-primary">Push Update</button></div></div>)}</div>
            </section>
          )}

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-[18px] font-semibold"><Flame className="h-5 w-5 text-orange-400" />Trending Now</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[...featured, ...strategies].slice(0, 6).map((strategy) => {
                const social = strategySocial(strategy);
                return (
                  <button key={strategy.id} onClick={() => setSelected(strategy)} className="min-w-[220px] rounded-2xl border border-border bg-panel p-4 text-left transition-all hover:border-primary/20">
                    <div className="mb-3 flex items-center justify-between"><Flame className="h-4 w-4 text-orange-400" /><span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] text-primary">+{social.weeklyGrowth}%</span></div>
                    <div className="truncate text-[13px] font-semibold">{strategy.title}</div>
                    <div className="mt-1 text-[12px] text-muted">{strategy.author}</div>
                    <div className="mt-3 flex items-center gap-1 font-mono text-[12px] text-primary"><ArrowDown className="h-3.5 w-3.5" />{social.weekClones} clones this week</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-[18px] font-semibold"><Sparkles className="h-5 w-5 text-primary" />Featured Strategies</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {featured.map((strategy, index) => (
                <button key={strategy.id} onClick={() => setSelected(strategy)} className="overflow-hidden rounded-2xl border border-border bg-panel text-left transition-all hover:border-primary/20">
                  <div className={`h-28 p-4 ${index === 0 ? "bg-gradient-to-br from-primary/30 to-secondary/20" : index === 1 ? "bg-gradient-to-br from-yellow-500/30 to-orange-500/20" : "bg-gradient-to-br from-purple-500/30 to-blue-500/20"}`}><span className="rounded-lg bg-background/60 px-2 py-1 text-[11px] text-foreground">{strategy.type}</span></div>
                  <div className="p-5">
                    <h3 className="text-[18px] font-semibold">{strategy.title}</h3>
                    <div className="mt-3"><Author strategy={strategy} /></div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] text-muted"><div>PF <div className="font-mono text-primary">{strategy.pf}</div></div><div>WR <div className="font-mono">{strategy.wr}%</div></div><div>Trades <div className="font-mono">{strategy.trades}</div></div><div>Clones <div className="font-mono">{strategy.clones}</div></div></div>
                    <div className="mt-4 flex items-center justify-between"><span className={strategy.paid ? "font-semibold text-foreground" : "font-semibold text-primary"}>{strategy.price}</span><div className="flex items-center gap-2"><Rating rating={strategy.rating} /><span className="text-[12px] text-muted">({strategy.reviews})</span></div></div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-[18px] font-semibold">All Strategies <span className="text-muted">(2,847 strategies)</span></h2>
            <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-4">{strategies.map((strategy) => <StrategyCard key={strategy.id} strategy={strategy} onClick={() => { setSelected(strategy); setDetailTab("Overview"); }} />)}</div>
          </section>

          {selected && (
            <section className="rounded-2xl border border-border bg-panel p-6">
              {(() => {
                const social = strategySocial(selected);
                const maxDownloads = Math.max(...social.downloads30d);
                return (
                  <div className="mb-6 rounded-2xl border border-border bg-background/40 p-5">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <h3 className="mr-auto text-[16px] font-semibold">Social Proof</h3>
                      {social.weeklyGrowth > 50 && <span className="rounded-lg bg-primary/10 px-2 py-1 text-[11px] text-primary">Trending</span>}
                      {social.clones24h > 100 && <span className="rounded-lg bg-orange-500/10 px-2 py-1 text-[11px] text-orange-400">Hot</span>}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-4">
                      {[
                        ["Downloads", selected.clones, ArrowDownToLine],
                        ["Currently running", social.activeUsers, Users],
                        ["Favourites", social.favourites, Star],
                        ["Views", social.views, Eye],
                      ].map(([label, value, Icon]) => (
                        <div key={label as string} className="rounded-xl border border-border bg-panel p-3">
                          <div className="mb-2 flex items-center gap-2 text-[11px] text-muted"><Icon className="h-3.5 w-3.5 text-primary" />{label as string}</div>
                          <div className="font-mono text-[16px] font-semibold">{value as string}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex h-20 items-end gap-1 rounded-xl border border-border bg-panel p-3">
                      {social.downloads30d.map((value, index) => <div key={index} className="flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(12, (value / maxDownloads) * 56)}px` }} />)}
                    </div>
                  </div>
                );
              })()}
              <div className="flex flex-wrap items-start gap-4">
                <div className="mr-auto"><h2 className="text-2xl font-semibold">{selected.title}</h2><div className="mt-2 flex items-center gap-3"><Author strategy={selected} /><button className="rounded-xl border border-border bg-surface px-3 py-1.5 text-[12px] text-muted hover:text-foreground">Follow</button></div></div>
                <div className="flex items-center gap-2"><Rating rating={selected.rating} /><span className="text-[13px] text-muted">{selected.reviews} reviews</span></div>
                <button className="rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-background">{selected.paid ? `Buy for ${selected.price}` : "Clone for Free"}</button>
              </div>
              <div className="mt-6 flex gap-2 border-b border-border">{["Overview", "Backtest Results", "Code", "Reviews", "Versions"].map((tab) => <button key={tab} onClick={() => setDetailTab(tab)} className={`px-4 py-2 text-[13px] ${detailTab === tab ? "border-b-2 border-primary text-foreground" : "text-muted hover:text-foreground"}`}>{tab}</button>)}</div>
              <div className="mt-5">
                {detailTab === "Overview" && <div className="grid gap-5 lg:grid-cols-2"><div><p className="text-[13px] leading-6 text-muted">{selected.description} It is designed for {selected.instrument} on the {selected.timeframe} timeframe and combines execution filters with robust risk controls.</p><div className="mt-4 flex flex-wrap gap-2">{[selected.type, selected.instrument, selected.timeframe].map((tag) => <span key={tag} className="rounded-lg bg-surface px-2 py-1 text-[11px] text-muted">{tag}</span>)}</div></div><div className="space-y-3 text-[13px] text-muted"><h3 className="font-semibold text-primary">What makes this strategy work</h3><p>It filters low-quality trades, waits for a clean setup, and uses asymmetric reward-to-risk.</p><h3 className="font-semibold text-danger">Risk warnings</h3><p>Performance can degrade during news spikes, regime shifts, or low-liquidity sessions.</p></div></div>}
                {detailTab === "Backtest Results" && <div className="space-y-4"><svg viewBox="0 0 900 220" className="h-56 w-full rounded-xl border border-border bg-background"><path d="M20 180 C140 140 180 190 260 120 S420 90 520 110 S700 40 880 60" fill="none" stroke="#00F5A0" strokeWidth="2" /><path d="M20 180 C140 140 180 190 260 120 S420 90 520 110 S700 40 880 60 L880 210 L20 210 Z" fill="#00F5A0" opacity="0.08" /></svg><div className="grid grid-cols-4 gap-3 text-[12px]">{["PF " + selected.pf, "WR " + selected.wr + "%", "Trades " + selected.trades, "Max DD 8.4%", "Sharpe 1.42", "Avg R 0.38", "Best +4.1R", "Worst -1.0R"].map((s) => <div key={s} className="rounded-xl border border-border bg-background/40 p-3 font-mono">{s}</div>)}</div><div className="rounded-xl border border-border bg-background/40 p-4 text-[13px] text-muted">Monthly returns table and drawdown chart preview use standardized Vault backtest data.</div></div>}
                {detailTab === "Code" && <div className="relative rounded-xl border border-border bg-background p-4"><div className={selected.paid ? "blur-sm" : ""}><pre className="overflow-auto font-mono text-[12px] leading-6 text-primary/90">{`// ${selected.title}\nfunction strategy(candles, index, indicators) {\n  const noSignal = { action: null, stopLoss: 0, takeProfit: 0, riskPercent: 1 };\n  if (index < 50) return noSignal;\n  return noSignal;\n}`}</pre></div>{selected.paid && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70"><button className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Purchase to view code</button></div>}<div className="mt-4 flex gap-2"><button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-muted"><Copy className="h-4 w-4" />Copy</button><button className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-muted">Open in Editor</button><span className={`rounded-lg px-2 py-2 text-[10px] ${langClass[selected.language]}`}>{selected.language}</span></div></div>}
                {detailTab === "Reviews" && <div className="grid gap-4 lg:grid-cols-[260px_1fr]"><div className="rounded-xl border border-border bg-background/40 p-4"><div className="text-3xl font-semibold">{selected.rating}</div><Rating rating={selected.rating} /><p className="mt-2 text-[12px] text-muted">{selected.reviews} reviews</p>{[5, 4, 3, 2, 1].map((star) => <div key={star} className="mt-2 flex items-center gap-2 text-[11px] text-muted"><span>{star}</span><div className="h-2 flex-1 rounded-full bg-surface"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${star * 18}%` }} /></div></div>)}</div><div className="space-y-3">{["@alpha Great strategy and clean exits.", "@maria Backtest matches my forward test closely.", "@dev Useful code structure and easy to adapt."].map((review) => <div key={review} className="rounded-xl border border-border bg-background/40 p-4 text-[13px] text-muted"><Rating rating={5} small /><p className="mt-2">{review}</p></div>)}<button className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Write a Review</button></div></div>}
                {detailTab === "Versions" && <div className="space-y-3 text-[13px]"><p className="text-muted">This strategy has been updated 5 times.</p>{["v2.0 - Added ATR trailing exits", "v1.1 - Improved session filters", "v1.0 - Initial release"].map((version) => <div key={version} className="rounded-xl border border-border bg-background/40 p-4"><span className="font-semibold">{version}</span><p className="mt-1 text-muted">Released May 2026 with changelog and compatibility notes.</p></div>)}</div>}
              </div>
            </section>
          )}
        </div>
      </main>

      {showPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowPublish(false)}>
          <div className="w-[600px] rounded-2xl border border-border bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Publish Strategy</h2><button onClick={() => setShowPublish(false)} className="text-muted hover:text-foreground"><X className="h-5 w-5" /></button></div>
            <div className="mb-5 flex gap-2">{[1, 2, 3, 4].map((step) => <button key={step} onClick={() => setPublishStep(step)} className={`h-8 w-8 rounded-full text-[12px] ${publishStep === step ? "bg-primary text-background" : "bg-surface text-muted"}`}>{step}</button>)}</div>
            {publishStep === 1 && <div className="space-y-3"><input placeholder="Strategy name" className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none" /><textarea rows={4} placeholder="Description" className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none" /><div className="grid grid-cols-2 gap-3"><KwantSelect className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"><option>Scalping</option><option>Intraday</option><option>Swing</option><option>Position</option></KwantSelect><KwantSelect className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"><option>5m</option><option>15m</option><option>1h</option><option>4h</option></KwantSelect></div><input placeholder="Instrument tags: NAS100, XAUUSD" className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none" /><KwantSelect className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"><option>Kwantify JavaScript</option><option>Pine Script</option><option>Python</option><option>C#</option><option>MQL5</option></KwantSelect></div>}
            {publishStep === 2 && <div className="space-y-3"><textarea rows={10} placeholder="Paste your strategy code..." className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 font-mono text-[12px] outline-none" /><button className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-[13px] text-primary">Validate Code</button><label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" /> Hide code from buyers (black box mode)</label></div>}
            {publishStep === 3 && <div className="space-y-3 text-[13px] text-muted">{["Free", "One-time purchase", "Monthly subscription"].map((item) => <label key={item} className="flex items-center gap-2"><input type="radio" name="pricing" />{item}</label>)}<input placeholder="$29.99" className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono outline-none" /><p>Kwantify takes 25% platform fee</p><div className="rounded-xl border border-border bg-background/40 p-3">Estimated earnings: $22.49 per $29.99 sale</div></div>}
            {publishStep === 4 && <div className="space-y-4"><button className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-[13px] text-primary">Run Official Backtest</button><div className="rounded-xl border border-border bg-background/40 p-4 text-[13px] text-muted">Results preview will appear here before publishing.</div><button onClick={() => setShowPublish(false)} className="w-full rounded-xl bg-primary py-3 text-[13px] font-semibold text-background">Publish</button></div>}
          </div>
        </div>
      )}
    </div>
  );
}
