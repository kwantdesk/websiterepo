"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  CandlestickChart,
  ChevronDown,
  CircleHelp,
  Filter,
  FlaskConical,
  LayoutDashboard,
  ListFilter,
  LogOut,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  User,
  WalletCards,
  X,
} from "lucide-react";

type Theme = "midnight" | "graphite" | "obsidian";

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Options Flow", icon: CandlestickChart },
  { label: "Watchlists", icon: BarChart3 },
  { label: "Research", icon: BrainCircuit },
  { label: "Signals", icon: Sparkles },
  { label: "Journal", icon: BookOpen },
  { label: "Strategy Lab", icon: FlaskConical },
  { label: "Alerts", icon: Bell },
  { label: "Accounts", icon: WalletCards },
];

const flowRows = [
  { time: "10:42:17", symbol: "NVDA", contract: "NVDA 185C · 16 AUG", premium: "$1.28M", size: "4,210", side: "ASK", sentiment: "Bullish" },
  { time: "10:41:54", symbol: "SPY", contract: "SPY 632P · 15 AUG", premium: "$842K", size: "2,941", side: "BID", sentiment: "Bearish" },
  { time: "10:40:09", symbol: "TSLA", contract: "TSLA 345C · 22 AUG", premium: "$628K", size: "1,790", side: "ASK", sentiment: "Bullish" },
  { time: "10:39:31", symbol: "AMD", contract: "AMD 156P · 16 AUG", premium: "$410K", size: "3,220", side: "BID", sentiment: "Bearish" },
  { time: "10:38:46", symbol: "META", contract: "META 525C · 16 AUG", premium: "$388K", size: "1,104", side: "ASK", sentiment: "Bullish" },
];

const watchlist = [
  ["NVDA", "182.21", "+3.26%", "up"],
  ["SPY", "631.18", "+0.84%", "up"],
  ["QQQ", "539.74", "+1.03%", "up"],
  ["TSLA", "333.87", "-1.12%", "down"],
  ["AMD", "154.02", "+2.47%", "up"],
];

export default function DashboardShell({ email }: { email: string }) {
  const [activeItem, setActiveItem] = useState("Options Flow");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("midnight");

  useEffect(() => {
    const saved = window.localStorage.getItem("kwantdesk-theme") as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("kwantdesk-theme", theme);
  }, [theme]);

  return (
    <main className="desk-app">
      <div className="kd-sidebar-wrap">
        <aside className="kd-sidebar">
          <button className="kd-nav-item kd-account" title={email} type="button" onClick={() => setSettingsOpen(true)}>
            <span className="kd-avatar"><User className="h-[18px] w-[18px]" /></span>
            <span className="kd-nav-label">{email}</span>
          </button>

          <div className="kd-nav-stack">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                className={`kd-nav-item ${activeItem === label ? "is-active" : ""}`}
                key={label}
                title={label}
                type="button"
                onClick={() => setActiveItem(label)}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="kd-nav-label">{label}</span>
              </button>
            ))}
          </div>

          <div className="kd-nav-bottom">
            <button className="kd-nav-item" title="Settings" type="button" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-[18px] w-[18px] shrink-0" />
              <span className="kd-nav-label">Settings</span>
            </button>
            <form action="/auth/signout" method="post">
              <button className="kd-nav-item" title="Sign out" type="submit">
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                <span className="kd-nav-label">Sign out</span>
              </button>
            </form>
          </div>
        </aside>
      </div>

      <section className="kd-workspace">
        <header className="kd-topbar">
          <div className="kd-title-row">
            <span className="kd-wordmark">KWANT DESK</span>
            <span className="kd-separator" />
            <strong>{activeItem}</strong>
          </div>
          <div className="kd-top-actions">
            <button className="kd-icon-button" title="Help" type="button"><CircleHelp className="h-4 w-4" /></button>
            <button className="kd-icon-button" title="Layout" type="button"><PanelLeftClose className="h-4 w-4" /></button>
            <button className="kd-user-button" type="button" onClick={() => setSettingsOpen(true)}>{email.slice(0, 1).toUpperCase()}</button>
          </div>
        </header>

        <div className="kd-content">
          <section className="kd-toolbar">
            <div>
              <p className="kd-overline">MARKET INTELLIGENCE</p>
              <h1>Options Flow</h1>
              <p className="kd-subtitle">Real-time options activity, filtered for conviction.</p>
            </div>
            <div className="kd-toolbar-actions">
              <button className="kd-control" type="button"><span className="kd-live-dot" /> Live <ChevronDown className="h-3.5 w-3.5" /></button>
              <button className="kd-control" type="button"><Filter className="h-3.5 w-3.5" /> Filters</button>
              <button className="kd-primary" type="button"><Plus className="h-4 w-4" /> Create alert</button>
            </div>
          </section>

          <div className="kd-stats">
            <article><span>Net premium</span><strong>$2.84M</strong><em className="positive">+18.6%</em></article>
            <article><span>Call / put ratio</span><strong>1.37</strong><em className="blue">Risk-on</em></article>
            <article><span>Unusual sweeps</span><strong>42</strong><em className="positive">+9 today</em></article>
            <article><span>Active alerts</span><strong>06</strong><em>Monitored</em></article>
          </div>

          <div className="kd-grid">
            <section className="kd-panel kd-flow-panel">
              <div className="kd-panel-header">
                <div><h2>Live flow</h2><span>Last 24 hours</span></div>
                <div className="kd-panel-tools"><button type="button"><Search className="h-4 w-4" /></button><button type="button"><SlidersHorizontal className="h-4 w-4" /></button></div>
              </div>
              <div className="kd-flow-head kd-flow-row"><span>Time</span><span>Symbol</span><span>Contract</span><span>Premium</span><span>Size</span><span>Side</span><span>Signal</span></div>
              <div className="kd-flow-body">
                {flowRows.map((row) => (
                  <div className="kd-flow-row" key={`${row.time}-${row.symbol}`}>
                    <span className="mono muted-text">{row.time}</span><strong>{row.symbol}</strong><span className="mono">{row.contract}</span><span className="mono">{row.premium}</span><span className="mono muted-text">{row.size}</span><span className={`kd-tag ${row.side === "ASK" ? "call" : "put"}`}>{row.side}</span><span className={`kd-signal ${row.sentiment === "Bullish" ? "positive" : "negative"}`}>{row.sentiment}</span>
                  </div>
                ))}
              </div>
              <footer className="kd-panel-footer"><span><i className="kd-live-dot" /> Flow updating</span><button type="button">View all activity →</button></footer>
            </section>

            <aside className="kd-right-stack">
              <section className="kd-panel kd-watchlist">
                <div className="kd-panel-header"><div><h2>Watchlist</h2><span>High conviction</span></div><button className="kd-plus-button" type="button"><Plus className="h-4 w-4" /></button></div>
                {watchlist.map(([symbol, price, change, direction]) => <div className="kd-watch-row" key={symbol}><span className="ticker-badge">{symbol.slice(0, 1)}</span><strong>{symbol}</strong><span className="mono">${price}</span><em className={direction === "up" ? "positive" : "negative"}>{change}</em></div>)}
              </section>
              <section className="kd-panel kd-sentiment-panel">
                <div className="kd-panel-header"><div><h2>Market pulse</h2><span>Aggregate options sentiment</span></div></div>
                <div className="kd-pulse"><div className="kd-pulse-value">68<span>/100</span></div><p>Constructive</p><div className="kd-meter"><i /></div><div className="kd-meter-labels"><span>Risk off</span><span>Risk on</span></div></div>
              </section>
            </aside>
          </div>

          <section className="kd-panel kd-chart-panel">
            <div className="kd-panel-header"><div><h2>Premium momentum</h2><span>Calls versus puts across the session</span></div><div className="kd-chart-legend"><span><i className="calls" /> Calls</span><span><i className="puts" /> Puts</span><span><i className="net" /> Net flow</span></div></div>
            <div className="kd-chart"><div className="kd-chart-grid" /><div className="kd-chart-bars">{[19,31,25,44,37,59,48,71,56,82,66,96,73,111,91,125].map((height, i) => <i key={i} style={{ height: `${height}px` }} />)}</div><svg viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true"><path d="M0 152 C60 133 75 139 126 112 S194 126 248 91 S322 109 374 72 S448 91 505 63 S585 86 640 42 S715 59 772 34 S857 53 1000 12" fill="none" stroke="currentColor" strokeWidth="2.25" /></svg></div>
            <div className="kd-chart-axis"><span>09:30</span><span>11:00</span><span>12:30</span><span>14:00</span><span>16:00</span></div>
          </section>
        </div>
      </section>

      {settingsOpen && <div className="kd-settings-overlay" onClick={() => setSettingsOpen(false)}><aside className="kd-settings" role="dialog" aria-modal="true" aria-label="Settings" onClick={(event) => event.stopPropagation()}><div className="kd-settings-heading"><div><p className="kd-overline">PREFERENCES</p><h2>Settings</h2></div><button type="button" onClick={() => setSettingsOpen(false)}><X className="h-4 w-4" /></button></div><div className="kd-setting"><span>Account</span><strong>{email}</strong></div><div className="kd-setting"><span>Theme</span><div className="kd-theme-list">{(["midnight", "graphite", "obsidian"] as Theme[]).map((option) => <button key={option} type="button" className={theme === option ? "selected" : ""} onClick={() => setTheme(option)}><i className={option} />{option}</button>)}</div></div><div className="kd-setting"><span>Data status</span><strong className="positive">Placeholder flow enabled</strong></div></aside></div>}
    </main>
  );
}
