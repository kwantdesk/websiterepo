"use client";

import KwantSelect from "@/components/ui/KwantSelect";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import { loadSavedStrategiesRaw } from "@/lib/automation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  FlaskConical,
  Flame,
  Play,
  Repeat,
  Settings,
  ShieldCheck,
  Store,
  Trophy,
  User,
  Wallet,
  Waves,
} from "lucide-react";

type Stage = "backtest" | "monte-carlo" | "walk-forward" | "robustness";

type SavedStrategy = {
  name?: string;
  title?: string;
  code?: string;
};

const stageScores = [
  { id: "backtest", name: "Backtest", score: 82, status: "PASS", icon: BarChart3, color: "text-primary" },
  { id: "monte-carlo", name: "Monte Carlo", score: 71, status: "PASS", icon: Waves, color: "text-primary" },
  { id: "walk-forward", name: "Walk Forward", score: 68, status: "WARNING", icon: CalendarDays, color: "text-orange-400" },
  { id: "robustness", name: "Robustness", score: 84, status: "PASS", icon: ShieldCheck, color: "text-primary" },
];

const backtestStats = [
  ["Profit Factor", "1.78"],
  ["Win Rate", "46.8%"],
  ["Total Trades", "842"],
  ["Max DD", "8.2%"],
  ["Sharpe", "1.34"],
  ["Sortino", "1.71"],
  ["Avg R", "0.42R"],
];

const scoreRules = [
  ["PF > 1.5", "+20", true],
  ["WR compatible with R:R", "+15", true],
  ["Trades > 200", "+20", true],
  ["DD < 15%", "+15", true],
  ["Sharpe > 1.0", "+15", true],
  ["Sortino > 1.5", "+15", false],
];

const monteMetrics = [
  ["Total Return", "+45.2%", "+38.1%", "+12.3%", "+72.4%"],
  ["Max Drawdown", "8.2%", "12.4%", "4.1%", "28.7%"],
  ["Profit Factor", "1.78", "1.62", "1.21", "2.14"],
  ["Longest DD (trades)", "12", "18", "8", "34"],
  ["Risk of Ruin (50% DD)", "-", "-", "0.3%", "-"],
];

const riskAnalysis = [
  ["Probability of losing money", 12.7],
  ["Probability of drawdown > 20%", 8.4],
  ["Probability of drawdown > 30%", 2.1],
  ["Probability of doubling account", 23.8],
  ["Risk of Ruin (50% loss)", 0.3],
];

const folds = [
  ["Fold 1", "Jan-Jun 2025", "Jul 2025", "2.14", "1.67", "+4.2%", -22],
  ["Fold 2", "Apr-Sep 2025", "Oct 2025", "1.98", "1.45", "+2.8%", -27],
  ["Fold 3", "Jul-Dec 2025", "Jan 2026", "2.31", "1.12", "+0.8%", -51],
  ["Fold 4", "Oct 2025-Mar 2026", "Apr 2026", "1.87", "1.54", "+3.1%", -18],
];

const sensitivity = [
  ["Stop Loss", 1.31, 1.48, 1.78, 1.66, 1.42],
  ["Take Profit", 0.94, 1.08, 1.78, 1.21, 0.89],
  ["EMA Period", 1.55, 1.63, 1.78, 1.69, 1.58],
  ["Session Times", 1.22, 1.44, 1.78, 1.51, 1.29],
  ["Risk %", 1.47, 1.61, 1.78, 1.64, 1.49],
];

const surface = [
  [1.02, 1.18, 1.34, 1.22, 1.05],
  [1.16, 1.39, 1.62, 1.44, 1.20],
  [1.31, 1.58, 1.78, 1.61, 1.37],
  [1.21, 1.47, 1.67, 1.52, 1.25],
  [0.98, 1.22, 1.41, 1.28, 1.04],
];

function Sidebar() {
  return <AppSidebar activeItem="lab" />;
}

function ScoreGauge({ score }: { score: number }) {
  const color = score <= 30 ? "#EF4444" : score <= 60 ? "#FB923C" : score <= 80 ? "#FACC15" : "#00F5A0";
  const label = score <= 30 ? "Fail" : score <= 60 ? "Weak" : score <= 80 ? "Promising" : "Validated";
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-52 w-52">
        <svg viewBox="0 0 220 220" className="h-full w-full">
          <path d="M40 150a78 78 0 0 1 140 0" fill="none" stroke="#18181B" strokeWidth="22" strokeLinecap="round" />
          <path d="M40 150a78 78 0 0 1 34-64" fill="none" stroke="#EF4444" strokeWidth="22" strokeLinecap="round" />
          <path d="M77 83a78 78 0 0 1 34-11" fill="none" stroke="#FB923C" strokeWidth="22" strokeLinecap="round" />
          <path d="M113 72a78 78 0 0 1 38 18" fill="none" stroke="#FACC15" strokeWidth="22" strokeLinecap="round" />
          <path d="M153 92a78 78 0 0 1 27 58" fill="none" stroke="#00F5A0" strokeWidth="22" strokeLinecap="round" />
          <line x1="110" y1="150" x2="157" y2="96" stroke={color} strokeWidth="5" strokeLinecap="round" />
          <circle cx="110" cy="150" r="7" fill={color} />
        </svg>
        <div className="absolute inset-x-0 bottom-6 text-center">
          <div className="font-mono text-5xl font-semibold" style={{ color }}>{score}</div>
          <div className="mt-1 text-[12px] uppercase tracking-[0.28em] text-muted">Lab Score</div>
        </div>
      </div>
      <div className="rounded-full border border-border bg-surface px-3 py-1 text-[12px]" style={{ color }}>{label}</div>
    </div>
  );
}

function StageTabs({ active, setActive }: { active: Stage; setActive: (stage: Stage) => void }) {
  const tabs: { id: Stage; label: string }[] = [
    { id: "backtest", label: "Backtest" },
    { id: "monte-carlo", label: "Monte Carlo" },
    { id: "walk-forward", label: "Walk Forward" },
    { id: "robustness", label: "Robustness" },
  ];
  return (
    <div className="flex flex-wrap gap-2 border-b border-border px-6 pt-5">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => setActive(tab.id)} className={`rounded-t-xl px-4 py-2 text-[13px] font-medium ${active === tab.id ? "border border-b-0 border-border bg-panel text-foreground" : "text-muted hover:text-foreground"}`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function EquityCurve({ dashed = false }: { dashed?: boolean }) {
  const points = "0,155 35,144 70,130 105,136 140,104 175,84 210,91 245,58 280,66 315,38 350,28";
  return (
    <svg viewBox="0 0 360 180" className="h-64 w-full rounded-xl border border-border bg-background/40">
      {[40, 80, 120, 160].map((y) => <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="#27272A" strokeWidth="1" />)}
      <polyline points={points} fill="none" stroke="#00F5A0" strokeWidth="3" strokeDasharray={dashed ? "7 5" : undefined} />
      <path d={`M${points} L350,180 L0,180 Z`} fill="url(#equityFill)" opacity="0.18" />
      <defs><linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#00F5A0" /><stop offset="1" stopColor="#00F5A0" stopOpacity="0" /></linearGradient></defs>
    </svg>
  );
}

function MonteCarloFan() {
  const paths = Array.from({ length: 28 }, (_, index) => {
    const start = 155;
    const drift = index % 5 === 0 ? -1.3 : 2.2 + (index % 7) * 0.35;
    return Array.from({ length: 12 }, (_, step) => `${step * 31},${Math.max(18, start - step * drift * 5 + Math.sin(step + index) * 18)}`).join(" ");
  });
  return (
    <svg viewBox="0 0 360 190" className="h-80 w-full rounded-xl border border-border bg-background/40">
      {[40, 80, 120, 160].map((y) => <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="#27272A" strokeWidth="1" />)}
      {paths.map((points, index) => <polyline key={points} points={points} fill="none" stroke={index % 5 === 0 ? "#EF4444" : "#00F5A0"} strokeWidth="1" opacity="0.18" />)}
      <polyline points="0,155 31,145 62,132 93,124 124,109 155,98 186,86 217,74 248,63 279,52 310,44 341,36" fill="none" stroke="#FAFAFA" strokeWidth="3" />
      <polyline points="0,155 31,163 62,149 93,142 124,134 155,126 186,119 217,111 248,105 279,97 310,91 341,84" fill="none" stroke="#EF4444" strokeWidth="2" />
      <polyline points="0,155 31,130 62,112 93,91 124,78 155,61 186,50 217,38 248,31 279,24 310,19 341,16" fill="none" stroke="#00F5A0" strokeWidth="2" />
      <polyline points="0,155 31,144 62,130 93,136 124,104 155,84 186,91 217,58 248,66 279,38 310,30 341,24" fill="none" stroke="#00F5A0" strokeWidth="3" strokeDasharray="7 5" />
    </svg>
  );
}

function Histogram({ type }: { type: "return" | "drawdown" }) {
  const bars = type === "return" ? [18, 26, 42, 67, 92, 124, 116, 86, 58, 34, 18] : [20, 54, 96, 118, 104, 72, 46, 29, 18, 10, 5];
  return (
    <div className="rounded-2xl border border-border bg-panel p-5">
      <h3 className="mb-1 font-semibold">{type === "return" ? "Return Distribution" : "Maximum Drawdown Distribution"}</h3>
      <p className="mb-4 text-[12px] text-muted">{type === "return" ? "Probability of profit: 87.3%" : "Probability of DD > 20%: 12.4%"}</p>
      <svg viewBox="0 0 330 170" className="h-56 w-full rounded-xl bg-background/40">
        {bars.map((value, index) => {
          const x = 18 + index * 27;
          const good = type === "return" ? index > 2 : index < 7;
          return <rect key={`${value}-${index}`} x={x} y={150 - value} width="20" height={value} rx="4" fill={good ? "#00F5A0" : "#EF4444"} opacity="0.55" />;
        })}
        <line x1={type === "return" ? "202" : "116"} x2={type === "return" ? "202" : "116"} y1="20" y2="154" stroke="#FAFAFA" strokeDasharray="4 4" />
        <line x1="10" x2="320" y1="154" y2="154" stroke="#3F3F46" />
      </svg>
    </div>
  );
}

function ProbabilityBar({ label, value }: { label: string; value: number }) {
  const danger = value > 20 && !label.includes("doubling");
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px]"><span className="text-muted">{label}</span><span className="font-mono text-foreground">{value}%</span></div>
      <div className="h-2 rounded-full bg-surface"><div className={`h-full rounded-full ${danger ? "bg-red-500" : "bg-primary"}`} style={{ width: `${Math.min(value, 100)}%` }} /></div>
    </div>
  );
}

function DegradationChart() {
  return (
    <svg viewBox="0 0 360 190" className="h-72 w-full rounded-xl border border-border bg-background/40">
      {folds.map((fold, index) => {
        const is = Number(fold[3]) * 52;
        const oos = Number(fold[4]) * 52;
        const x = 44 + index * 75;
        return (
          <g key={fold[0] as string}>
            <rect x={x} y={160 - is} width="20" height={is} rx="4" fill="#00F5A0" opacity="0.55" />
            <rect x={x + 24} y={160 - oos} width="20" height={oos} rx="4" fill="#FAFAFA" opacity="0.65" />
            <text x={x + 10} y="178" fill="#A1A1AA" fontSize="10">{index + 1}</text>
          </g>
        );
      })}
      <line x1="20" x2="340" y1="160" y2="160" stroke="#3F3F46" />
    </svg>
  );
}

function Heatmap({ data, compact = false }: { data: (string | number)[][] | number[][]; compact?: boolean }) {
  const columns = ["-20%", "-10%", "Base", "+10%", "+20%"];
  const cellClass = (value: number) => value < 1 ? "bg-red-500/50 text-red-100" : value < 1.2 ? "bg-yellow-400/35 text-yellow-100" : "bg-primary/25 text-primary";
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className={`grid ${compact ? "grid-cols-5" : "grid-cols-6"} border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted`}>
        {!compact && <div className="p-3">Parameter</div>}
        {columns.map((column) => <div key={column} className="p-3 text-center">{column}</div>)}
      </div>
      {data.map((row, index) => {
        const values = compact ? row as number[] : row.slice(1) as number[];
        return (
          <div key={compact ? index : row[0] as string} className={`grid ${compact ? "grid-cols-5" : "grid-cols-6"} border-b border-border/60 last:border-0`}>
            {!compact && <div className="p-3 text-[13px] text-muted">{row[0]}</div>}
            {values.map((value, valueIndex) => <div key={`${index}-${valueIndex}`} className={`p-3 text-center font-mono text-[12px] ${cellClass(value)}`}>{value.toFixed(2)}</div>)}
          </div>
        );
      })}
    </div>
  );
}

export default function LabPage() {
  const [activeStage, setActiveStage] = useState<Stage>("backtest");
  const [strategies, setStrategies] = useState<string[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState("");
  const [hasResults, setHasResults] = useState(false);
  const [simulations, setSimulations] = useState("5000");
  const [skipRate, setSkipRate] = useState(5);

  useEffect(() => {
    const raw = loadSavedStrategiesRaw();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SavedStrategy[];
      const names = parsed.map((strategy) => strategy.name ?? strategy.title).filter(Boolean) as string[];
      if (names.length > 0) {
        setStrategies(names);
        setSelectedStrategy(names[0]);
      }
    } catch {
      // Keep demo strategies if saved strategy storage is unavailable.
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mr-auto flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FlaskConical className="h-5 w-5" /></div>
            <div><h1 className="text-[20px] font-semibold">The Strategy Lab</h1><p className="text-[13px] text-muted">Validate your strategy before risking real capital</p></div>
          </div>
          <KwantSelect value={selectedStrategy} onChange={(event) => setSelectedStrategy(event.target.value)} disabled={strategies.length === 0} className="rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-muted outline-none hover:text-foreground disabled:opacity-50">
            {strategies.length === 0 ? <option value="">No strategies</option> : strategies.map((strategy) => <option key={strategy}>{strategy}</option>)}
          </KwantSelect>
          <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background"><Play className="h-4 w-4" />Run Full Validation</button>
        </header>

        {!hasResults ? (
          <div className="m-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/40 px-8 py-32 text-center">
            <FlaskConical className="mb-4 h-10 w-10 text-muted" />
            <p className="max-w-md text-[15px] text-muted">Run your first strategy test in the lab.</p>
          </div>
        ) : (
        <>
        <div className="space-y-6 p-6">
          <section className="rounded-2xl border border-border bg-panel p-8">
            <div className="grid gap-8 xl:grid-cols-[260px_1fr]">
              <ScoreGauge score={76} />
              <div>
                <div className="grid gap-4 lg:grid-cols-4">
                  {stageScores.map((stage) => {
                    const Icon = stage.icon;
                    return (
                      <div key={stage.id} className="rounded-2xl border border-border bg-background/40 p-4">
                        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface ${stage.color}`}><Icon className="h-5 w-5" /></div>
                        <div className="font-semibold">{stage.name}</div>
                        <div className="mt-2 font-mono text-2xl">{stage.score}/100</div>
                        <span className={`mt-3 inline-flex rounded-lg px-2 py-1 text-[11px] ${stage.status === "PASS" ? "bg-primary/10 text-primary" : "bg-orange-400/10 text-orange-400"}`}>{stage.status}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-6 text-[13px] text-muted">This strategy has a 76% confidence rating. Proceed with caution on the Walk Forward results.</p>
              </div>
            </div>
          </section>
        </div>

        <StageTabs active={activeStage} setActive={setActiveStage} />

        <div className="space-y-6 p-6">
          {activeStage === "backtest" && (
            <>
              <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">{backtestStats.map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-panel p-4"><div className="text-[11px] uppercase tracking-wider text-muted">{label}</div><div className="mt-2 font-mono text-2xl">{value}</div></div>)}</section>
              <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
                <div className="rounded-2xl border border-border bg-panel p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Equity Curve</h2><span className="font-mono text-primary">Backtest Score: 82/100</span></div><EquityCurve /></div>
                <div className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Score Calculation</h2><div className="space-y-3">{scoreRules.map(([rule, points, passed]) => <div key={rule as string} className="flex items-center justify-between rounded-xl bg-background/40 p-3 text-[13px]"><span className={passed ? "text-foreground" : "text-muted"}>{rule}</span><span className={passed ? "font-mono text-primary" : "font-mono text-muted"}>{points}</span></div>)}</div></div>
              </section>
            </>
          )}

          {activeStage === "monte-carlo" && (
            <>
              <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-panel p-4">
                <label className="text-[13px] text-muted">Simulations <KwantSelect value={simulations} onChange={(event) => setSimulations(event.target.value)} className="ml-2 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-foreground"><option>1000</option><option>5000</option><option>10000</option></KwantSelect></label>
                <label className="flex items-center gap-3 text-[13px] text-muted">Skip rate <input type="range" min="0" max="20" value={skipRate} onChange={(event) => setSkipRate(Number(event.target.value))} /><span className="font-mono text-foreground">{skipRate}%</span></label>
                <div className="flex rounded-xl border border-border bg-surface p-0.5">{["Shuffle Trades", "Resample with Replacement", "Add Noise"].map((method, index) => <button key={method} className={`rounded-lg px-3 py-1.5 text-[12px] ${index === 0 ? "bg-panel text-foreground" : "text-muted"}`}>{method}</button>)}</div>
                <button className="ml-auto rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Run Simulation</button>
              </section>
              <section className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Equity Curve Fan</h2><MonteCarloFan /></section>
              <section className="grid gap-6 xl:grid-cols-2"><Histogram type="return" /><Histogram type="drawdown" /></section>
              <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Key Metrics</h2><div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-[13px]"><thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted"><tr>{["Metric", "Original", "Median", "5th Percentile", "95th Percentile"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium">{head}</th>)}</tr></thead><tbody>{monteMetrics.map((row) => <tr key={row[0]} className="border-b border-border/60 last:border-0">{row.map((cell, index) => <td key={cell} className={`px-4 py-3 ${index > 0 ? "font-mono" : ""}`}>{cell}</td>)}</tr>)}</tbody></table></div></div>
                <div className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Risk Analysis</h2><div className="space-y-4">{riskAnalysis.map(([label, value]) => <ProbabilityBar key={label as string} label={label as string} value={value as number} />)}</div><p className="mt-5 text-[12px] text-muted">Monte Carlo Score: 71/100. Probability of profit and ruin profile passed; drawdown tail risk requires monitoring.</p></div>
              </section>
            </>
          )}

          {activeStage === "walk-forward" && (
            <>
              <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-panel p-4"><KwantSelect className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-muted"><option>In-sample: 6 months</option><option>3 months</option><option>1 year</option></KwantSelect><KwantSelect className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-muted"><option>Out-of-sample: 1 month</option><option>3 months</option><option>6 months</option></KwantSelect><input className="w-32 rounded-xl border border-border bg-surface px-3 py-2 text-[13px]" defaultValue="6 folds" /><button className="ml-auto rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Run Walk Forward</button></section>
              <section className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Fold Results</h2><div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-[13px]"><thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted"><tr>{["Fold #", "In-Sample Period", "Out-of-Sample Period", "IS Profit Factor", "OOS Profit Factor", "OOS Return", "Degradation"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium">{head}</th>)}</tr></thead><tbody>{folds.map((fold) => { const degradation = Number(fold[6]); const cls = Math.abs(degradation) < 30 ? "text-primary" : Math.abs(degradation) <= 50 ? "text-orange-400" : "text-red-400"; return <tr key={fold[0] as string} className="border-b border-border/60 last:border-0">{fold.map((cell, index) => <td key={`${fold[0]}-${index}`} className={`px-4 py-3 ${index > 2 ? "font-mono" : ""} ${index === 6 ? cls : ""}`}>{index === 6 ? `${cell}%` : cell}</td>)}</tr>; })}</tbody></table></div></section>
              <section className="grid gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-border bg-panel p-5"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Degradation Chart</h2><span className="text-[13px] text-primary">Average Performance Degradation: 29.5%</span></div><DegradationChart /></div><div className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Combined OOS Equity Curve</h2><EquityCurve dashed /><p className="mt-3 text-[12px] text-muted">Out-of-sample results stitched together and compared against in-sample performance.</p></div></section>
            </>
          )}

          {activeStage === "robustness" && (
            <>
              <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-panel p-4"><div className="flex flex-wrap gap-3 text-[13px] text-muted">{["SL", "TP", "EMA periods", "Session times", "Risk %"].map((item) => <label key={item} className="inline-flex items-center gap-2"><input type="checkbox" defaultChecked />{item}</label>)}</div><label className="flex items-center gap-2 text-[13px] text-muted">Range <input type="range" min="10" max="30" defaultValue="20" /><span className="font-mono">+/-20%</span></label><input className="w-36 rounded-xl border border-border bg-surface px-3 py-2 text-[13px]" defaultValue="100 variations" /><button className="ml-auto rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Run Robustness Test</button></section>
              <section className="grid gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Parameter Sensitivity Heatmap</h2><Heatmap data={sensitivity} /></div><div className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-1 font-semibold">3D Surface Plot</h2><p className="mb-4 text-[12px] text-muted">SL variation vs TP variation, simplified as a 2D profit landscape.</p><Heatmap data={surface} compact /></div></section>
              <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]"><div className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-1 font-semibold">Robustness Distribution</h2><p className="mb-4 text-[12px] text-muted">87 out of 100 variations remained profitable.</p><Histogram type="return" /></div><div className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Verdict</h2><div className="space-y-3 text-[13px] text-muted"><p><span className="text-primary">Parameter Stability:</span> 87% of variations profitable.</p><p><span className="text-orange-400">Most sensitive parameter:</span> Take Profit (+/-15% causes PF to drop below 1.0).</p><p><span className="text-primary">Least sensitive parameter:</span> EMA Period (+/-30% has minimal impact).</p><p>Recommendation: Strategy is robust to stop loss and indicator changes but sensitive to take profit. Consider using a dynamic exit instead of fixed TP.</p></div><div className="mt-5 rounded-xl border border-primary/20 bg-primary/10 p-3 font-mono text-primary">Robustness Score: 84/100</div></div></section>
            </>
          )}

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-panel p-5">
            <div><h2 className="font-semibold">Export & Report</h2><p className="mt-1 text-[13px] text-muted">Generate a PDF-style validation summary with all four stages, scores, charts, and verdicts.</p></div>
            <div className="flex gap-2"><button className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Export Validation Report</button><button className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Share Lab Results</button></div>
          </section>
        </div>
        </>
        )}
      </main>
    </div>
  );
}
