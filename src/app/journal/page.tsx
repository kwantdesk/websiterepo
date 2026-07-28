"use client";

import KwantSelect from "@/components/ui/KwantSelect";

import { useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Filter,
  FlaskConical,
  Gauge,
  Repeat,
  Settings,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Trash2,
  Upload,
  User,
  Wallet,
  X,
  Zap,
} from "lucide-react";

type Tab = "overview" | "time" | "instruments" | "tags" | "log";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "time", label: "Time Analysis" },
  { id: "instruments", label: "Instruments" },
  { id: "tags", label: "Tags & Psychology" },
  { id: "log", label: "Trade Log" },
];

type JournalTrade = {
  dt: string;
  sym: string;
  dir: string;
  entry: number;
  exit: number;
  sl: number;
  tp: number;
  pnl: number;
  r: number;
  risk: number;
  dur: string;
  tags: string[];
  emo: string;
  rules: boolean;
};

function Sidebar() {
  return <AppSidebar activeItem="journal" />;
}

function money(n: number) {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
}

function pnlClass(n: number) {
  return n >= 0 ? "text-primary" : "text-danger";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-panel border border-border rounded-2xl ${className}`}>{children}</div>;
}

const placeholderAccounts = [
  { id: "placeholder-main", name: "Placeholder Trading Account", type: "connected" },
  { id: "placeholder-funded", name: "Funded Challenge Placeholder", type: "propfirm" },
];

const placeholderTrades: JournalTrade[] = [
  { dt: "2026-05-01 09:35", sym: "NAS100", dir: "LONG", entry: 18420.5, exit: 18518.2, sl: 18380.5, tp: 18520.5, pnl: 2450, r: 2.4, risk: 0.8, dur: "42m", tags: ["Breakout", "London"], emo: "Focused", rules: true },
  { dt: "2026-05-02 11:10", sym: "XAUUSD", dir: "SHORT", entry: 2368.2, exit: 2374.7, sl: 2376.2, tp: 2352.2, pnl: -650, r: -0.6, risk: 0.7, dur: "28m", tags: ["Pullback"], emo: "Impatient", rules: false },
  { dt: "2026-05-05 14:45", sym: "US30", dir: "LONG", entry: 39210.0, exit: 39338.0, sl: 39155.0, tp: 39350.0, pnl: 3200, r: 2.9, risk: 0.9, dur: "1h 12m", tags: ["Momentum", "NY"], emo: "Confident", rules: true },
  { dt: "2026-05-06 10:05", sym: "EURUSD", dir: "LONG", entry: 1.0852, exit: 1.0888, sl: 1.0834, tp: 1.0892, pnl: 1800, r: 1.8, risk: 0.6, dur: "55m", tags: ["Trend"], emo: "Calm", rules: true },
  { dt: "2026-05-07 15:20", sym: "NAS100", dir: "SHORT", entry: 18642.0, exit: 18678.0, sl: 18682.0, tp: 18570.0, pnl: -900, r: -0.9, risk: 0.8, dur: "34m", tags: ["Reversal"], emo: "Rushed", rules: false },
  { dt: "2026-05-08 09:50", sym: "GER40", dir: "LONG", entry: 18780.0, exit: 18946.0, sl: 18720.0, tp: 18960.0, pnl: 4150, r: 3.1, risk: 0.9, dur: "1h 25m", tags: ["Breakout", "London"], emo: "Focused", rules: true },
  { dt: "2026-05-11 13:30", sym: "XAUUSD", dir: "LONG", entry: 2356.4, exit: 2383.4, sl: 2346.4, tp: 2386.4, pnl: 2700, r: 2.7, risk: 0.8, dur: "1h 08m", tags: ["Liquidity Sweep"], emo: "Patient", rules: true },
  { dt: "2026-05-12 08:55", sym: "GBPUSD", dir: "SHORT", entry: 1.2731, exit: 1.2761, sl: 1.2766, tp: 1.2671, pnl: -750, r: -0.7, risk: 0.7, dur: "31m", tags: ["Pullback"], emo: "Distracted", rules: false },
  { dt: "2026-05-13 16:05", sym: "NAS100", dir: "LONG", entry: 18802.5, exit: 18946.5, sl: 18752.5, tp: 18952.5, pnl: 3600, r: 2.8, risk: 0.9, dur: "1h 40m", tags: ["Momentum", "NY"], emo: "Focused", rules: true },
  { dt: "2026-05-14 10:25", sym: "US30", dir: "SHORT", entry: 39485.0, exit: 39401.0, sl: 39525.0, tp: 39390.0, pnl: 2100, r: 2.1, risk: 0.7, dur: "48m", tags: ["Reversal"], emo: "Calm", rules: true },
  { dt: "2026-05-15 12:15", sym: "EURUSD", dir: "SHORT", entry: 1.0912, exit: 1.0922, sl: 1.0932, tp: 1.0872, pnl: -500, r: -0.5, risk: 0.5, dur: "22m", tags: ["Range"], emo: "Neutral", rules: true },
  { dt: "2026-05-18 09:40", sym: "GER40", dir: "LONG", entry: 19015.0, exit: 19133.0, sl: 18975.0, tp: 19145.0, pnl: 2950, r: 2.5, risk: 0.8, dur: "1h 03m", tags: ["Breakout", "London"], emo: "Patient", rules: true },
  { dt: "2026-05-19 14:10", sym: "XAUUSD", dir: "SHORT", entry: 2401.2, exit: 2383.7, sl: 2411.2, tp: 2379.2, pnl: 1750, r: 1.6, risk: 0.7, dur: "47m", tags: ["Supply"], emo: "Calm", rules: true },
  { dt: "2026-05-20 15:50", sym: "NAS100", dir: "LONG", entry: 19022.0, exit: 19118.0, sl: 18972.0, tp: 19130.0, pnl: 2400, r: 2.0, risk: 0.8, dur: "58m", tags: ["Momentum", "NY"], emo: "Confident", rules: true },
  { dt: "2026-05-21 08:35", sym: "GBPUSD", dir: "LONG", entry: 1.2814, exit: 1.2780, sl: 1.2778, tp: 1.2868, pnl: -850, r: -0.8, risk: 0.7, dur: "36m", tags: ["Trend"], emo: "Rushed", rules: false },
  { dt: "2026-05-22 10:55", sym: "US30", dir: "LONG", entry: 39740.0, exit: 39896.0, sl: 39680.0, tp: 39900.0, pnl: 3900, r: 3.0, risk: 0.9, dur: "1h 18m", tags: ["Breakout"], emo: "Focused", rules: true },
  { dt: "2026-05-23 13:15", sym: "NAS100", dir: "SHORT", entry: 19208.0, exit: 19120.0, sl: 19258.0, tp: 19105.0, pnl: 2200, r: 1.9, risk: 0.7, dur: "51m", tags: ["Liquidity Sweep"], emo: "Patient", rules: true },
  { dt: "2026-05-24 11:30", sym: "XAUUSD", dir: "LONG", entry: 2412.5, exit: 2404.95, sl: 2403.5, tp: 2430.5, pnl: -755, r: -0.7, risk: 0.6, dur: "27m", tags: ["Pullback"], emo: "Neutral", rules: true },
];

const placeholderCalendar: Record<number, { pnl: number; trades: number }> = {
  1: { pnl: 2450, trades: 1 },
  2: { pnl: -650, trades: 1 },
  5: { pnl: 3200, trades: 1 },
  6: { pnl: 1800, trades: 1 },
  7: { pnl: -900, trades: 1 },
  8: { pnl: 4150, trades: 1 },
  11: { pnl: 2700, trades: 1 },
  12: { pnl: -750, trades: 1 },
  13: { pnl: 3600, trades: 1 },
  14: { pnl: 2100, trades: 1 },
  15: { pnl: -500, trades: 1 },
  18: { pnl: 2950, trades: 1 },
  19: { pnl: 1750, trades: 1 },
  20: { pnl: 2400, trades: 1 },
  21: { pnl: -850, trades: 1 },
  22: { pnl: 3900, trades: 1 },
  23: { pnl: 2200, trades: 1 },
  24: { pnl: -755, trades: 1 },
};

const dayValues = [5650, 4200, 7800, 350, 10000, 1550, -755];
const hourValues = [0, 0, 0, 0, 0, 0, 0, 0, -1600, 5150, 8900, -1405, -500, 3950, 4950, 1500, 3600, 0, 0, 0, 0, 0, 0, 0];
const instruments = [
  ["NAS100", 13000, 5, 80],
  ["US30", 9200, 4, 100],
  ["GER40", 7100, 2, 100],
  ["XAUUSD", 3045, 5, 60],
  ["EURUSD", 1300, 2, 50],
  ["GBPUSD", -1600, 2, 0],
] as const;
const tags = [
  ["Breakout", 5, 100, 13.9, 16650],
  ["Momentum", 3, 100, 6.8, 8200],
  ["Liquidity Sweep", 2, 100, 4.6, 4900],
  ["Pullback", 4, 25, 0.7, 595],
  ["Reversal", 2, 50, 1.2, 1200],
  ["Trend", 2, 50, 1.0, 950],
] as const;
const emotions = [
  ["Focused", 5, 100, 14.3, 17250],
  ["Patient", 3, 100, 7.1, 7850],
  ["Calm", 4, 100, 7.6, 7650],
  ["Confident", 2, 100, 4.8, 5600],
  ["Neutral", 2, 50, -1.2, -1255],
  ["Rushed", 2, 0, -1.7, -1750],
] as const;

function CumulativeChart() {
  const vals = [0, 2450, 1800, 5000, 6800, 5900, 10050, 12750, 12000, 15600, 17700, 17200, 20150, 21900, 24300, 23450, 27350, 29550, 28795];
  const max = Math.max(...vals);
  const points = vals.map((v, i) => `${40 + i * 29},${190 - (v / max) * 150}`).join(" ");
  return <svg viewBox="0 0 600 220" className="h-full w-full"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00F5A0" stopOpacity=".18"/><stop offset="100%" stopColor="#00F5A0" stopOpacity="0"/></linearGradient></defs><polyline points={points} fill="none" stroke="#00F5A0" strokeWidth="2"/><polygon points={`40,200 ${points} 560,200`} fill="url(#g)"/>{[40,90,140,190].map((y) => <line key={y} x1="35" x2="570" y1={y} y2={y} stroke="#27272A" />)}</svg>;
}

function BarChart({ values }: { values: number[] }) {
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  return <svg viewBox="0 0 360 180" className="h-full w-full"><line x1="0" x2="360" y1="90" y2="90" stroke="#71717A" strokeDasharray="4 4"/>{values.map((v, i) => { const height = Math.max(3, Math.abs(v / max) * 75); return <rect key={i} x={i * 14 + 4} y={v >= 0 ? 90 - height : 90} width="9" height={height} rx="2" fill={v >= 0 ? "#00F5A0" : "#EF4444"} />; })}</svg>;
}

export default function JournalPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [month, setMonth] = useState(new Date());
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [importName, setImportName] = useState("");
  const [trades, setTrades] = useState<JournalTrade[]>(placeholderTrades);
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>(placeholderAccounts);
  const monthName = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const days = Array.from({ length: 35 }, (_, i) => i < 3 ? null : i - 2);
  const calendar = placeholderCalendar;
  const hasTrades = trades.length > 0;
  const netPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const winners = trades.filter((trade) => trade.pnl > 0);
  const losers = trades.filter((trade) => trade.pnl < 0);
  const totalWins = winners.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalLosses = Math.abs(losers.reduce((sum, trade) => sum + trade.pnl, 0));
  const winRate = (winners.length / trades.length) * 100;
  const expectancy = netPnl / trades.length;
  const avgWin = totalWins / winners.length;
  const avgLoss = totalLosses / losers.length;
  const profitFactor = totalWins / totalLosses;
  const maxDayValue = Math.max(...dayValues.map((value) => Math.abs(value)), 1);
  const selectedAccountName = selectedAccount === "all" ? "All Accounts" : accounts.find((account) => account.id === selectedAccount)?.name ?? "All Accounts";
  const connectedAccounts = accounts.filter((account) => account.type === "connected");
  const propFirmAccounts = accounts.filter((account) => account.type === "propfirm");
  const importedAccounts = accounts.filter((account) => account.type === "imported");

  const addImportedAccount = () => {
    const id = `imported-${Date.now()}`;
    setAccounts((current) => [...current, { id, name: importName.trim() || "Imported Trades", type: "imported" }]);
    setSelectedAccount(id);
    setImportName("");
    setShowImportModal(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-panel/95 px-8 py-5 backdrop-blur">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-2xl font-semibold">Dashboard</h1><p className="mt-1 text-[13px] text-muted">Good morning, Guest</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="min-w-[180px] rounded-xl border border-border bg-surface px-4 py-2 text-left text-[13px] text-muted outline-none hover:text-foreground">
                  {selectedAccountName}
                </button>
                {showAccountMenu && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[280px] rounded-xl border border-border bg-panel p-2 shadow-xl shadow-black/40">
                    <button onClick={() => { setSelectedAccount("all"); setShowAccountMenu(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${selectedAccount === "all" ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}>All Accounts</button>
                    <div className="my-2 h-px bg-border" />
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Connected Accounts</div>
                    {connectedAccounts.map((account) => (
                      <button key={account.id} onClick={() => { setSelectedAccount(account.id); setShowAccountMenu(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${selectedAccount === account.id ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}>{account.name}</button>
                    ))}
                    <div className="my-2 h-px bg-border" />
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Prop Firms</div>
                    {propFirmAccounts.map((account) => (
                      <button key={account.id} onClick={() => { setSelectedAccount(account.id); setShowAccountMenu(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${selectedAccount === account.id ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}>{account.name}</button>
                    ))}
                    <div className="my-2 h-px bg-border" />
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Imported Data</div>
                    {importedAccounts.length === 0 && <div className="px-3 py-2 text-[12px] text-muted/70">No imported accounts yet</div>}
                    {importedAccounts.map((account) => (
                      <div key={account.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] ${selectedAccount === account.id ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}>
                        <button onClick={() => { setSelectedAccount(account.id); setShowAccountMenu(false); }} className="min-w-0 flex-1 truncate text-left">{account.name}</button>
                        <button onClick={() => setAccounts((current) => current.filter((item) => item.id !== account.id))} className="text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <KwantSelect className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted outline-none"><option>30d</option><option>7d</option><option>90d</option><option>month</option><option>all</option></KwantSelect>
              <button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted"><Filter className="h-4 w-4" />Filter</button>
              <button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted"><Download className="h-4 w-4" />Export</button>
              <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted"><Upload className="h-4 w-4" />Import</button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto">{tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-4 py-2 text-[13px] font-medium whitespace-nowrap ${tab === t.id ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}>{t.label}</button>)}</nav>
        </header>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setShowImportModal(false)}>
            <div className="relative w-full max-w-[520px] rounded-2xl border border-border bg-panel p-8 shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowImportModal(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
              <h2 className="text-xl font-semibold">Import Trade Data</h2>
              <p className="mt-2 text-[13px] leading-5 text-muted">Import trades from a CSV or Excel file. Data will be stored in a separate imported account.</p>
              <label className="my-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-10 text-center hover:border-primary/40">
                <Upload className="mb-3 h-8 w-8 text-primary" />
                <span className="text-[14px] font-medium">Drag & drop your file here or click to browse</span>
                <span className="mt-2 text-[12px] text-muted">Supported formats: CSV, Excel (.xlsx), MetaTrader 4/5 export, TradingView export, TradeZella export</span>
                <input type="file" accept=".csv,.xlsx" className="hidden" />
              </label>
              <input value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Name this import e.g. FTMO Challenge March 2025" className="mb-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40" />
              <button onClick={addImportedAccount} className="w-full rounded-xl bg-primary py-3 text-[13px] font-semibold text-background">Import</button>
            </div>
          </div>
        )}
        <section className="flex-1 space-y-6 overflow-y-auto p-8">
          {!hasTrades ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/40 px-8 py-24 text-center">
              <BookOpen className="mb-4 h-10 w-10 text-muted" />
              <p className="max-w-md text-[15px] text-muted">No trades recorded yet. Start trading to see your journal.</p>
            </div>
          ) : null}
          {hasTrades && tab === "overview" && <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">{[[DollarSign, "Net P&L", money(netPnl), `${trades.length} trades`, "text-primary"], [Target, "Trade Expectancy", money(expectancy), "per trade", "text-foreground"], [Activity, "Profit Factor", profitFactor.toFixed(2), "strong edge", "text-primary"], [TrendingUp, "Win Rate", `${winRate.toFixed(1)}%`, `${winners.length}W/${losers.length}L`, "text-primary"], [TrendingDown, "Avg Win/Loss", `${(avgWin / avgLoss).toFixed(1)}R`, `${money(avgWin)}/${money(-avgLoss)}`, "text-foreground"], [Zap, "Kwantify Score", "91", "Excellent discipline", "text-primary"]].map(([Icon, label, value, sub, color]) => <Card key={label as string} className="p-5"><div className="mb-3 flex items-center justify-between"><span className="text-[13px] text-muted">{label as string}</span><Icon className="h-4 w-4 text-muted" /></div><div className={`font-mono text-3xl font-semibold ${color}`}>{value as string}</div><div className="mt-1 text-[12px] text-muted">{sub as string}</div></Card>)}</div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><Card className="p-5 lg:col-span-2"><h3 className="mb-4 font-semibold">Daily Net Cumulative P&L</h3><div className="h-[220px]"><CumulativeChart /></div></Card><Card className="p-5"><h3 className="mb-4 font-semibold">Net Daily P&L</h3><div className="h-[220px]"><BarChart values={Object.values(calendar).map((day) => day.pnl)} /></div></Card></div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[["Best Trade", money(Math.max(...trades.map((trade) => trade.pnl))), "text-primary"], ["Worst Trade", money(Math.min(...trades.map((trade) => trade.pnl))), "text-danger"], ["Max Drawdown", "4.8% / $1,450", "text-danger"], ["Trade Efficiency", "84%", "text-primary"], ["Avg Hold Win", "1h 02m", "text-primary"], ["Avg Hold Loss", "31m", "text-danger"], ["Win Streak", "6", "text-primary"], ["Loss Streak", "2", "text-danger"], ["Sharpe", "2.18", "text-primary"], ["Sortino", "3.04", "text-primary"], ["Risk/Trade", "0.76% avg", ""], ["Avg Trades/Day", "1.8", ""]].map(([l, v, c]) => <Card key={l} className="p-4"><div className="mb-2 text-[13px] text-muted">{l}</div><div className={`font-mono text-lg font-semibold ${c}`}>{v}</div></Card>)}</div>
            <Card className="p-5"><h3 className="mb-4 font-semibold">R-Multiple Distribution</h3><div className="flex h-[180px] items-end gap-3">{[-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3].map((r, i) => <div key={r} className="flex flex-1 flex-col items-center gap-2"><div className={`w-full rounded-t ${r < 0 ? "bg-danger/70" : "bg-primary/70"}`} style={{ height: `${30 + i * 10}px` }} /><span className="font-mono text-[11px] text-muted">{r}R</span></div>)}</div></Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><Card className="p-5"><h3 className="mb-4 font-semibold">Recent Trades</h3>{trades.slice(0, 6).map((t) => <div key={t.dt} className="flex border-b border-border/50 py-3 text-[13px]"><span className="flex-1 font-mono text-muted">{t.dt.split(" ")[0]}</span><span className="w-20">{t.sym}</span><span className={`w-24 text-right font-mono font-semibold ${pnlClass(t.pnl)}`}>{money(t.pnl)}</span></div>)}</Card><Card className="p-5 lg:col-span-2"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{monthName}</h3><div><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></button></div></div><div className="grid grid-cols-7 gap-2">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="text-center text-[11px] text-muted">{d}</div>)}{days.map((d, i) => <div key={i} className={`min-h-16 rounded-xl border border-border p-2 ${d && calendar[d] ? calendar[d].pnl >= 0 ? "bg-primary/10" : "bg-danger/10" : "bg-surface/40"}`}>{d && <><div className="text-[12px] text-muted">{d}</div>{calendar[d] && <><div className={`font-mono text-[12px] ${pnlClass(calendar[d].pnl)}`}>{money(calendar[d].pnl)}</div><div className="text-[10px] text-muted">{calendar[d].trades} trades</div></>}</>}</div>)}</div></Card></div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[["Best Day", "+$4,150.00", "text-primary"], ["Worst Day", "-$900.00", "text-danger"], ["Win Streak", "6 trades", "text-primary"], ["Loss Streak", "2 trades", "text-danger"]].map(([l,v,c]) => <Card key={l} className="p-5"><div className="text-[13px] text-muted">{l}</div><div className={`font-mono text-xl font-semibold ${c}`}>{v}</div></Card>)}</div>
          </>}
          {hasTrades && tab === "time" && <><div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Card className="p-5"><h3 className="mb-4 font-semibold">P&L by Day of Week</h3>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i) => <div key={d} className="mb-3 flex items-center gap-3"><span className="w-10 text-muted">{d}</span><div className="h-3 flex-1 rounded bg-surface"><div className={`h-3 rounded ${dayValues[i] >= 0 ? "bg-primary" : "bg-danger"}`} style={{ width: `${(Math.abs(dayValues[i]) / maxDayValue) * 100}%` }} /></div><span className={`w-24 text-right font-mono ${pnlClass(dayValues[i])}`}>{money(dayValues[i])}</span><span className="w-16 text-right text-muted">{i === 6 ? 0 : 2 + i} trades</span></div>)}</Card><Card className="p-5"><h3 className="mb-4 font-semibold">P&L by Session</h3><div className="grid grid-cols-3 gap-3">{[["Asia",1700,2,50],["London",15100,8,75],["New York",11995,8,75]].map(([n,p,t,w]) => <div key={n as string} className="rounded-xl border border-border bg-surface p-4"><div>{n}</div><div className={`font-mono text-xl ${pnlClass(p as number)}`}>{money(p as number)}</div><div className="text-[12px] text-muted">{t as number} trades / {w as number}% WR</div></div>)}</div></Card></div><Card className="p-5"><h3 className="mb-4 font-semibold">P&L by Hour</h3><div className="h-[220px]"><BarChart values={hourValues} /></div></Card></>}
          {hasTrades && tab === "instruments" && <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Card className="p-5"><h3 className="mb-4 font-semibold">P&L by Instrument</h3>{instruments.map(([s,p,t,w]) => <div key={s} className="mb-3 grid grid-cols-[80px_1fr_90px_70px] items-center gap-3 text-[13px]"><span>{s}</span><div className="h-2 rounded bg-surface"><div className={`h-2 rounded ${p >= 0 ? "bg-primary" : "bg-danger"}`} style={{ width: `${Math.min(Math.abs(p) / 130, 100)}%` }} /></div><span className={`font-mono text-right ${pnlClass(p)}`}>{money(p)}</span><span className="text-right text-muted">{t} / {w}%</span></div>)}</Card><Card className="p-5"><h3 className="mb-4 font-semibold">Long vs Short</h3><div className="grid grid-cols-2 gap-4"><div className="rounded-2xl border border-border bg-surface p-5"><div>LONG</div><div className="font-mono text-2xl text-primary">+$25,545.00</div><div className="text-muted">11 trades / 81.8% WR</div></div><div className="rounded-2xl border border-border bg-surface p-5"><div>SHORT</div><div className="font-mono text-2xl text-primary">+$3,250.00</div><div className="text-muted">7 trades / 42.9% WR</div></div></div></Card></div>}
          {hasTrades && tab === "tags" && <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Card className="p-5"><h3 className="mb-4 font-semibold">Performance by Tag</h3><table className="w-full text-[13px]"><tbody>{tags.map(([tag,tr,wr,r,p]) => <tr key={tag} className="border-b border-border/50"><td className="py-3">{tag}</td><td className="text-right">{tr}</td><td className="text-right">{wr}%</td><td className="text-right font-mono">{r}R</td><td className={`text-right font-mono ${pnlClass(p)}`}>{money(p)}</td></tr>)}</tbody></table></Card><Card className="p-5"><h3 className="mb-4 font-semibold">Performance by Emotional State</h3><div className="grid grid-cols-1 gap-3">{emotions.map(([e,t,w,r,p]) => <div key={e} className="rounded-xl border border-border bg-surface p-4"><div className="flex justify-between"><span>{e}</span><span className={`font-mono ${pnlClass(p)}`}>{money(p)}</span></div><div className="text-[12px] text-muted">{t} trades / {w}% WR / {r}R</div></div>)}</div></Card></div>}
          {hasTrades && tab === "log" && <Card className="overflow-x-auto p-5"><table className="w-full min-w-[1100px] text-[13px]"><thead><tr className="border-b border-border text-muted">{["Date/Time","Symbol","Direction","Entry","Exit","SL","TP","P&L","R","Risk%","Duration","Tags","Emotion","Rules Followed"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead><tbody>{trades.map((t) => <tr key={t.dt} className="border-b border-border/50"><td className="px-3 py-3 font-mono text-muted">{t.dt}</td><td className="px-3">{t.sym}</td><td className={`px-3 font-semibold ${t.dir === "LONG" ? "text-primary" : "text-danger"}`}>{t.dir}</td><td className="px-3 font-mono">{t.entry}</td><td className="px-3 font-mono">{t.exit}</td><td className="px-3 font-mono text-danger">{t.sl}</td><td className="px-3 font-mono text-primary">{t.tp}</td><td className={`px-3 font-mono ${pnlClass(t.pnl)}`}>{money(t.pnl)}</td><td className="px-3 font-mono">{t.r}R</td><td className="px-3">{t.risk}%</td><td className="px-3">{t.dur}</td><td className="px-3">{t.tags.map((tag) => <span key={tag} className="mr-1 rounded-full bg-surface px-2 py-1 text-[11px]">{tag}</span>)}</td><td className="px-3">{t.emo}</td><td className={`px-3 font-semibold ${t.rules ? "text-primary" : "text-danger"}`}>{t.rules ? "Yes" : "No"}</td></tr>)}</tbody></table></Card>}
        </section>
      </main>
    </div>
  );
}
