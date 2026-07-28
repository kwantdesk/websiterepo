"use client";

import { useEffect, useState } from "react";

type Theme = "midnight" | "graphite" | "obsidian";

const metrics = [
  { label: "Net premium", value: "$2.84M", delta: "+18.6%", tone: "positive" },
  { label: "Call / put ratio", value: "1.37", delta: "Risk-on", tone: "blue" },
  { label: "Unusual sweeps", value: "42", delta: "+9 today", tone: "positive" },
  { label: "Active alerts", value: "06", delta: "Monitored", tone: "muted" },
];

const activity = [
  ["NVDA", "CALL", "$184.50", "Aug 16", "$1.2M", "bullish"],
  ["SPY", "PUT", "$632.00", "Aug 15", "$840K", "bearish"],
  ["TSLA", "CALL", "$345.00", "Aug 22", "$620K", "bullish"],
  ["AMD", "PUT", "$156.00", "Aug 16", "$410K", "bearish"],
];

const navItems = [
  ["◫", "Overview"],
  ["⌁", "Options Flow"],
  ["◌", "Watchlists"],
  ["⌗", "Research"],
  ["◱", "Signals"],
  ["□", "Journal"],
];

export default function DashboardShell({ email }: { email: string }) {
  const [theme, setTheme] = useState<Theme>("midnight");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("kwantdesk-theme") as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("kwantdesk-theme", theme);
  }, [theme]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="side-brand" href="#top" aria-label="Kwant Desk home"><span>K</span><strong>KWANT DESK</strong></a>
        <nav className="side-nav" aria-label="Workspace">
          {navItems.map(([icon, label], index) => (
            <button className={`side-item ${index === 1 ? "active" : ""}`} type="button" key={label}>
              <span>{icon}</span><b>{label}</b>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="side-item" type="button" onClick={() => setSettingsOpen(true)}>
            <span>⚙</span><b>Settings</b>
          </button>
          <form action="/auth/signout" method="post"><button className="side-item" type="submit"><span>↗</span><b>Sign out</b></button></form>
        </div>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <div><p className="eyebrow">PRIVATE WORKSPACE</p><h1>Options Flow</h1></div>
          <div className="topbar-actions"><span className="market-status"><i /> Market monitoring</span><button className="avatar" onClick={() => setSettingsOpen(true)} type="button">{email.slice(0, 1).toUpperCase()}</button></div>
        </header>

        <div className="command-row">
          <div className="symbol-search"><span>⌕</span><input aria-label="Symbol search" placeholder="Search a symbol, sector, or contract" /></div>
          <button className="filter-button" type="button">All markets <span>⌄</span></button>
          <button className="primary-button" type="button">Create alert <span>+</span></button>
        </div>

        <section className="metric-grid">
          {metrics.map((metric) => <article className="metric-card" key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span className={metric.tone}>{metric.delta}</span></article>)}
        </section>

        <section className="content-grid">
          <article className="panel flow-panel">
            <div className="panel-heading"><div><p className="eyebrow">LIVE FLOW</p><h2>Premium momentum</h2></div><button className="quiet-button" type="button">Last 24 hours ⌄</button></div>
            <div className="chart-legend"><span><i className="legend-call" /> Calls</span><span><i className="legend-put" /> Puts</span><span><i className="legend-line" /> Net flow</span></div>
            <div className="flow-chart" aria-label="Placeholder options flow chart"><div className="gridline g1" /><div className="gridline g2" /><div className="gridline g3" /><div className="flow-area" /><svg viewBox="0 0 800 230" preserveAspectRatio="none" aria-hidden="true"><path d="M0,190 C55,165 78,180 128,136 S205,150 256,112 S332,126 376,78 S443,102 491,69 S568,96 614,47 S695,60 800,15" fill="none" stroke="currentColor" strokeWidth="4" /></svg><div className="bar-set">{[28, 44, 32, 66, 48, 72, 54, 92, 63, 110, 78, 132].map((height, index) => <i key={index} style={{ height: `${height}px` }} />)}</div></div>
            <div className="chart-axis"><span>09:30</span><span>11:00</span><span>12:30</span><span>14:00</span><span>16:00</span></div>
          </article>

          <article className="panel watch-panel">
            <div className="panel-heading"><div><p className="eyebrow">WATCHLIST</p><h2>High-conviction names</h2></div><button className="quiet-button" type="button">Manage</button></div>
            {[['NVDA', '$182.21', '+3.26%', 'up'], ['SPY', '$631.18', '+0.84%', 'up'], ['TSLA', '$333.87', '-1.12%', 'down'], ['AMD', '$154.02', '+2.47%', 'up']].map(([symbol, price, change, direction]) => <div className="watch-row" key={symbol}><div className="ticker-icon">{symbol.slice(0, 1)}</div><strong>{symbol}</strong><span>{price}</span><em className={direction}>{change}</em></div>)}
          </article>
        </section>

        <article className="panel activity-panel">
          <div className="panel-heading"><div><p className="eyebrow">PRIORITY QUEUE</p><h2>Unusual options activity</h2></div><button className="quiet-button" type="button">View all activity →</button></div>
          <div className="activity-table"><div className="table-head"><span>Symbol</span><span>Side</span><span>Strike</span><span>Expiry</span><span>Premium</span><span>Signal</span></div>{activity.map(([symbol, side, strike, expiry, premium, signal]) => <div className="table-row" key={`${symbol}-${strike}`}><strong>{symbol}</strong><span className={side === 'CALL' ? 'call' : 'put'}>{side}</span><span>{strike}</span><span>{expiry}</span><span>{premium}</span><span className={`signal ${signal}`}>{signal}</span></div>)}</div>
        </article>
      </section>

      {settingsOpen ? <div className="settings-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}><aside className="settings-panel" role="dialog" aria-modal="true" aria-label="Workspace settings" onClick={(event) => event.stopPropagation()}><div className="panel-heading"><div><p className="eyebrow">PREFERENCES</p><h2>Workspace settings</h2></div><button className="close-button" type="button" onClick={() => setSettingsOpen(false)}>×</button></div><div className="setting-block"><span>Signed in as</span><strong>{email}</strong></div><div className="setting-block"><span>Colour theme</span><div className="theme-picker">{(['midnight', 'graphite', 'obsidian'] as Theme[]).map((option) => <button type="button" key={option} className={`theme-option ${theme === option ? 'selected' : ''}`} onClick={() => setTheme(option)}><i className={`theme-swatch ${option}`} />{option}</button>)}</div></div><div className="setting-block"><span>Flow refresh</span><strong>Placeholder — live data coming next</strong></div></aside></div> : null}
    </main>
  );
}
