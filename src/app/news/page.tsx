"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FlaskConical,
  Globe,
  Repeat,
  Settings,
  Store,
  Trophy,
  User,
  Wallet,
} from "lucide-react";

type View = "calendar" | "news" | "analysis";
type Impact = "High" | "Medium" | "Low";
type Currency = "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD" | "CHF" | "NZD" | "XAU" | "BTC";

const currencies: Currency[] = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "NZD"];
const currencyClass: Record<string, string> = {
  USD: "bg-blue-500/10 text-blue-400",
  EUR: "bg-indigo-500/10 text-indigo-400",
  GBP: "bg-purple-500/10 text-purple-400",
  JPY: "bg-red-500/10 text-red-400",
  CAD: "bg-green-500/10 text-green-400",
  AUD: "bg-yellow-500/10 text-yellow-400",
  CHF: "bg-orange-500/10 text-orange-400",
  NZD: "bg-cyan-500/10 text-cyan-400",
  XAU: "bg-yellow-500/10 text-yellow-400",
  BTC: "bg-orange-500/10 text-orange-400",
};

const impactDot: Record<Impact, string> = {
  High: "bg-red-500",
  Medium: "bg-orange-400",
  Low: "bg-yellow-400",
};

const todayEvents = [
  { id: "de-cpi", time: "06:00", currency: "EUR", impact: "Medium" as Impact, event: "German CPI m/m", actual: "0.3%", forecast: "0.2%", previous: "0.1%", released: true, better: true },
  { id: "nfp", time: "08:30", currency: "USD", impact: "High" as Impact, event: "Non-Farm Payrolls", actual: "-", forecast: "180K", previous: "175K", released: false },
  { id: "unemployment", time: "08:30", currency: "USD", impact: "High" as Impact, event: "Unemployment Rate", actual: "-", forecast: "3.8%", previous: "3.7%", released: false },
  { id: "ism", time: "10:00", currency: "USD", impact: "Medium" as Impact, event: "ISM Manufacturing PMI", actual: "-", forecast: "49.5", previous: "49.2", released: false },
  { id: "factory", time: "14:00", currency: "USD", impact: "Low" as Impact, event: "Factory Orders m/m", actual: "-", forecast: "0.5%", previous: "0.3%", released: false },
];

const tomorrowEvents = [
  { id: "gdp", time: "02:00", currency: "GBP", impact: "High" as Impact, event: "GDP q/q", actual: "-", forecast: "0.4%", previous: "0.3%", released: false },
  { id: "claims", time: "08:30", currency: "USD", impact: "Medium" as Impact, event: "Weekly Jobless Claims", actual: "-", forecast: "215K", previous: "210K", released: false },
  { id: "lagarde", time: "10:00", currency: "EUR", impact: "Medium" as Impact, event: "ECB President Lagarde Speaks", actual: "-", forecast: "-", previous: "-", released: false },
];

const weekGroups = [
  { day: "Wednesday", events: [{ id: "fomc", time: "14:00", currency: "USD", impact: "High" as Impact, event: "FOMC Meeting Minutes", actual: "-", forecast: "-", previous: "-", released: false }] },
  { day: "Thursday", events: [{ id: "retail", time: "08:30", currency: "USD", impact: "High" as Impact, event: "Retail Sales m/m", actual: "-", forecast: "0.4%", previous: "0.1%", released: false }] },
  { day: "Friday", events: [{ id: "boe", time: "07:00", currency: "GBP", impact: "High" as Impact, event: "BOE Rate Decision", actual: "-", forecast: "4.25%", previous: "4.25%", released: false }] },
];

const newsItems = [
  { id: "inflation", source: "Reuters", time: "2 hours ago", headline: "US Inflation Rises More Than Expected in April", summary: "Hotter CPI data pushed yields higher and pressured growth stocks as traders reduced expectations for near-term Fed easing.", tags: ["USD"], impact: "High Impact", sentiment: "Bearish for stocks", tone: "Bearish" },
  { id: "ecb", source: "Bloomberg", time: "4 hours ago", headline: "ECB Signals Potential Rate Hold at June Meeting", summary: "Officials indicated patience after recent sticky services inflation, leaving EUR sensitive to upcoming wage and CPI data.", tags: ["EUR"], impact: "High Impact", sentiment: "Bearish EUR", tone: "Bearish" },
  { id: "gold", source: "CNBC", time: "6 hours ago", headline: "Gold Surges Past $3,200 on Safe Haven Demand", summary: "XAUUSD caught a strong bid as real yields eased and geopolitical risk kept safe haven flows elevated.", tags: ["XAU"], impact: "Medium Impact", sentiment: "Bullish", tone: "Bullish" },
  { id: "btc", source: "CoinDesk", time: "8 hours ago", headline: "Bitcoin Tests $100K Resistance Amid ETF Inflows", summary: "Persistent spot ETF demand is supporting dips, but the market remains vulnerable to a failed breakout near six figures.", tags: ["BTC"], impact: "Medium Impact", sentiment: "Bullish", tone: "Bullish" },
  { id: "boj", source: "Nikkei", time: "12 hours ago", headline: "Bank of Japan Maintains Negative Rate Policy", summary: "The BOJ held policy steady and kept guidance cautious, weighing on JPY as carry trades remained attractive.", tags: ["JPY"], impact: "High Impact", sentiment: "Bearish JPY", tone: "Bearish" },
];

const strength = [
  ["USD", 3.2],
  ["EUR", -1.4],
  ["GBP", 0.8],
  ["JPY", -2.1],
  ["CAD", 1.5],
  ["AUD", -0.5],
  ["CHF", 0.3],
  ["NZD", -1.8],
] as const;

function Sidebar() {
  return <AppSidebar activeItem="news" />;
}

function CurrencyBadge({ currency }: { currency: string }) {
  return <span className={`rounded-lg px-2 py-1 text-[11px] font-medium ${currencyClass[currency] ?? "bg-surface text-muted"}`}>{currency}</span>;
}

function ImpactDot({ impact }: { impact: Impact }) {
  return <span className={`h-2.5 w-2.5 rounded-full ${impactDot[impact]}`} />;
}

export default function NewsPage() {
  const [view, setView] = useState<View>("calendar");
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(["All"]);
  const [selectedImpact, setSelectedImpact] = useState<Impact | "All">("All");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [expandedNews, setExpandedNews] = useState<string | null>(null);
  const [weekOpen, setWeekOpen] = useState<Record<string, boolean>>({ Wednesday: true });
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayLabel = useMemo(() => clock.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }), [clock]);
  const clockLabel = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function toggleCurrency(currency: string) {
    if (currency === "All") {
      setSelectedCurrencies(["All"]);
      return;
    }
    setSelectedCurrencies((current) => {
      const withoutAll = current.filter((item) => item !== "All");
      const next = withoutAll.includes(currency) ? withoutAll.filter((item) => item !== currency) : [...withoutAll, currency];
      return next.length ? next : ["All"];
    });
  }

  function visibleEvent(event: { currency: string; impact: Impact }) {
    const currencyOk = selectedCurrencies.includes("All") || selectedCurrencies.includes(event.currency);
    const impactOk = selectedImpact === "All" || selectedImpact === event.impact;
    return currencyOk && impactOk;
  }

  function EventTable({ events, showAnalysis = true }: { events: typeof todayEvents; showAnalysis?: boolean }) {
    const filtered = events.filter(visibleEvent);
    const nextId = filtered.find((event) => !event.released)?.id;
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-panel">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
            <tr>
              {["Time", "Currency", "Impact", "Event", "Actual", "Forecast", "Previous", "Analysis"].map((header) => <th key={header} className="px-4 py-3 text-left font-medium">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <React.Fragment key={event.id}>
                <tr key={event.id} className={`border-b border-border/60 ${event.released ? "opacity-60" : ""} ${event.id === nextId ? "border-l-2 border-l-primary" : ""}`}>
                  <td className="px-4 py-3 font-mono text-foreground">{event.time}</td>
                  <td className="px-4 py-3"><CurrencyBadge currency={event.currency} /></td>
                  <td className="px-4 py-3"><ImpactDot impact={event.impact} /></td>
                  <td className="px-4 py-3 font-medium text-foreground">{event.event}</td>
                  <td className={`px-4 py-3 font-mono ${event.actual === "-" ? "text-muted" : event.better ? "text-primary" : "text-danger"}`}>{event.actual}</td>
                  <td className="px-4 py-3 font-mono text-muted">{event.forecast}</td>
                  <td className="px-4 py-3 font-mono text-muted">{event.previous}</td>
                  <td className="px-4 py-3">{showAnalysis && <button onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)} className="rounded-lg border border-border bg-surface px-3 py-1 text-[12px] text-muted hover:text-foreground">View</button>}</td>
                </tr>
                {expandedEvent === event.id && (
                  <tr>
                    <td colSpan={8} className="border-b border-border bg-background/30 px-5 py-4">
                      <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-[13px] leading-6 text-muted">
                        <span className="font-semibold text-primary">AI analysis:</span> {event.event} can shift short-term liquidity and volatility. Watch the first 5-15 minutes after release for whipsaws, then favor continuation only if price accepts beyond the initial range.
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-4">
            <div className="mr-auto flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Globe className="h-5 w-5" /></div>
              <div>
                <h1 className="text-[20px] font-semibold">Market Intelligence</h1>
                <p className="text-[13px] text-muted">Economic calendar, news & analysis</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {["All", ...currencies].map((currency) => {
                const active = selectedCurrencies.includes(currency);
                return <button key={currency} onClick={() => toggleCurrency(currency)} className={`rounded-xl px-3 py-1.5 text-[12px] transition-all ${active ? "border border-border bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>{currency}</button>;
              })}
            </div>

            <div className="flex items-center gap-1">
              {(["All", "High", "Medium", "Low"] as const).map((impact) => (
                <button key={impact} onClick={() => setSelectedImpact(impact)} className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] transition-all ${selectedImpact === impact ? "border border-border bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>
                  {impact !== "All" && <ImpactDot impact={impact} />}
                  {impact}
                </button>
              ))}
            </div>

            <div className="flex rounded-xl border border-border bg-panel p-0.5">
              {(["calendar", "news", "analysis"] as const).map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-lg px-3 py-1.5 text-[12px] capitalize transition-all ${view === item ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>{item}</button>)}
            </div>
          </div>
        </header>

        <div className="space-y-6 p-6">
          {view === "calendar" && (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-semibold">Today - {todayLabel}</h2>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-1.5 font-mono text-[12px] text-muted"><Clock className="h-3.5 w-3.5 text-primary" />{clockLabel}</div>
                </div>
                <EventTable events={todayEvents} />
              </section>

              <section className="space-y-3">
                <h2 className="text-[16px] font-semibold">Tomorrow</h2>
                <EventTable events={tomorrowEvents} />
              </section>

              <section className="space-y-3">
                <h2 className="text-[16px] font-semibold">This Week</h2>
                <div className="space-y-2">
                  {weekGroups.map((group) => (
                    <div key={group.day} className="overflow-hidden rounded-2xl border border-border bg-panel">
                      <button onClick={() => setWeekOpen((current) => ({ ...current, [group.day]: !current[group.day] }))} className="flex w-full items-center gap-2 px-5 py-3 text-left text-[14px] font-semibold hover:bg-surface/40">
                        {weekOpen[group.day] ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
                        {group.day}
                      </button>
                      {weekOpen[group.day] && <EventTable events={group.events} showAnalysis={false} />}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {view === "news" && (
            <section className="grid gap-4">
              {newsItems.map((item) => (
                <article key={item.id} onClick={() => setExpandedNews(expandedNews === item.id ? null : item.id)} className="cursor-pointer rounded-2xl border border-border bg-panel p-5 transition-all hover:border-primary/20">
                  <div className="mb-3 flex items-center gap-2 text-[12px] text-muted"><span className="rounded-lg bg-surface px-2 py-1">{item.source}</span><span>{item.time}</span></div>
                  <h2 className="text-[16px] font-semibold text-foreground">{item.headline}</h2>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-muted">{item.summary}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {item.tags.map((tag) => <CurrencyBadge key={tag} currency={tag} />)}
                    <span className="rounded-lg bg-surface px-2 py-1 text-[11px] text-muted">{item.impact}</span>
                    <span className={`rounded-lg px-2 py-1 text-[11px] ${item.tone === "Bullish" ? "bg-primary/10 text-primary" : item.tone === "Bearish" ? "bg-danger/10 text-danger" : "bg-surface text-muted"}`}>{item.sentiment}</span>
                  </div>
                  {expandedNews === item.id && (
                    <div className="mt-4 rounded-xl border border-border bg-background/40 p-4 text-[13px] leading-6 text-muted">
                      <span className="font-semibold text-primary">AI analysis:</span> This headline can alter near-term sentiment in related instruments. Wait for confirmation through yields, dollar reaction, and the first post-news liquidity sweep before entering.
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}

          {view === "analysis" && (
            <section className="space-y-6">
              <div className="rounded-2xl border border-border bg-panel p-5">
                <h2 className="text-[16px] font-semibold">Week Ahead - May 17 to May 24</h2>
                <p className="mt-3 text-[13px] leading-6 text-muted">The week is centered on US labor data, inflation follow-through, and central bank commentary. Dollar strength remains the key macro driver for indices, gold, and major FX pairs.</p>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div><h3 className="mb-2 text-[13px] font-semibold text-primary">Key Events to Watch</h3><ul className="space-y-2 text-[13px] text-muted">{["Non-Farm Payrolls", "US CPI follow-through", "FOMC minutes", "BOE rate decision", "ECB President Lagarde Speaks"].map((item) => <li key={item}>- {item}</li>)}</ul></div>
                  <div><h3 className="mb-2 text-[13px] font-semibold text-primary">Market Outlook</h3><p className="text-[13px] leading-6 text-muted">NAS100 remains vulnerable to hot inflation and rising yields. XAUUSD favors dips while geopolitical risk stays elevated. EURUSD needs dovish Fed repricing to sustain rallies.</p></div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-panel p-5">
                <h2 className="mb-5 text-[16px] font-semibold">Currency Strength</h2>
                <div className="space-y-3">
                  {strength.map(([currency, value]) => (
                    <div key={currency} className="grid grid-cols-[44px_1fr_46px] items-center gap-3">
                      <CurrencyBadge currency={currency} />
                      <div className="relative h-3 rounded-full bg-surface">
                        <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                        <div className={`absolute top-0 h-full rounded-full ${value >= 0 ? "left-1/2 bg-primary" : "right-1/2 bg-danger"}`} style={{ width: `${Math.abs(value) * 10}%` }} />
                      </div>
                      <span className={`text-right font-mono text-[12px] ${value >= 0 ? "text-primary" : "text-danger"}`}>{value > 0 ? "+" : ""}{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-panel p-5">
                  <h2 className="text-[16px] font-semibold">Event Impact History</h2>
                  <div className="mt-4 space-y-3 text-[13px] text-muted">
                    {["Last 10 US CPI releases: NAS100 average move -0.6%, XAUUSD +0.4%", "Last 10 NFP releases: USD index average move +0.3%, gold -0.5%", "Last 8 FOMC events: NAS100 average range 1.8% intraday", "Last 6 ECB decisions: EURUSD average move 0.7%"].map((item) => <div key={item} className="rounded-xl border border-border bg-background/30 p-3">{item}</div>)}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-panel p-5">
                  <h2 className="text-[16px] font-semibold">Upcoming High Impact</h2>
                  <div className="mt-4 space-y-4">
                    {["Non-Farm Payrolls in 3h 24m", "GDP q/q in 21h 15m", "Retail Sales in 2d 4h", "FOMC Minutes in 3d 2h", "BOE Rate Decision in 4d 9h"].map((item, index) => <div key={item}><div className="mb-2 flex justify-between text-[13px]"><span>{item}</span><span className="text-muted">{index + 1}/5</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${80 - index * 12}%` }} /></div></div>)}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
