"use client";

import KwantSelect from "@/components/ui/KwantSelect";

import { useState } from "react";
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
  Code2,
  Crown,
  FlaskConical,
  Flame,
  Lock,
  Repeat,
  Settings,
  Shield,
  Store,
  Trophy,
  User,
  Wallet,
} from "lucide-react";

type Tab = "rankings" | "achievements" | "challenges";
type Tier = "iron" | "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "grandmaster" | "legend";

type Trader = {
  rank: string;
  username: string;
  tier: Tier;
  division: 1 | 2 | 3 | 4;
  totalXp: number;
  weeklyXp: number;
  score: number;
  pf: number;
  bestStrategy: string;
  vaultStrategies: number;
  clones: string;
  streak: number;
};

const tiers: Record<Tier, { label: string; color: string; range: string }> = {
  iron: { label: "Iron", color: "#71717A", range: "0-299 XP" },
  bronze: { label: "Bronze", color: "#CD7F32", range: "300-999 XP" },
  silver: { label: "Silver", color: "#C0C0C0", range: "1000-2499 XP" },
  gold: { label: "Gold", color: "#FFD700", range: "2500-4999 XP" },
  platinum: { label: "Platinum", color: "#00CED1", range: "5000-9999 XP" },
  diamond: { label: "Diamond", color: "#B9F2FF", range: "10000-19999 XP" },
  master: { label: "Master", color: "#8B5CF6", range: "20000-39999 XP" },
  grandmaster: { label: "Grandmaster", color: "#EF4444", range: "40000-79999 XP" },
  legend: { label: "Legend", color: "#FFD700", range: "80000+ XP" },
};

const divisions = ["", "I", "II", "III", "IV"] as const;
const tierOrder: Tier[] = ["iron", "bronze", "silver", "gold", "platinum", "diamond", "master", "grandmaster", "legend"];

const leaderboard: Trader[] = [
  { rank: "#1", username: "@quantmaster", tier: "legend", division: 1, totalXp: 94200, weeklyXp: 4820, score: 96, pf: 2.89, bestStrategy: "ICT Silver Bullet", vaultStrategies: 12, clones: "8,432", streak: 45 },
  { rank: "#2", username: "@algopro", tier: "grandmaster", division: 1, totalXp: 76800, weeklyXp: 4210, score: 94, pf: 2.67, bestStrategy: "Momentum Hunter", vaultStrategies: 8, clones: "6,201", streak: 38 },
  { rank: "#3", username: "@goldfx", tier: "grandmaster", division: 2, totalXp: 63300, weeklyXp: 3890, score: 91, pf: 2.45, bestStrategy: "Gold Scalper Pro", vaultStrategies: 15, clones: "5,890", streak: 52 },
  { rank: "#4", username: "@trendmaster", tier: "master", division: 1, totalXp: 39200, weeklyXp: 3405, score: 89, pf: 2.32, bestStrategy: "Multi-TF Trend", vaultStrategies: 7, clones: "4,720", streak: 31 },
  { rank: "#5", username: "@smcmaster", tier: "master", division: 2, totalXp: 33600, weeklyXp: 3120, score: 87, pf: 2.21, bestStrategy: "Order Block Entry", vaultStrategies: 9, clones: "4,103", streak: 28 },
  { rank: "#6", username: "@cryptoalgo", tier: "diamond", division: 1, totalXp: 19100, weeklyXp: 2890, score: 86, pf: 2.12, bestStrategy: "BTC Momentum Hunter", vaultStrategies: 6, clones: "3,880", streak: 24 },
  { rank: "#7", username: "@quantdev", tier: "diamond", division: 2, totalXp: 16800, weeklyXp: 2610, score: 84, pf: 2.04, bestStrategy: "ATR Trail System", vaultStrategies: 11, clones: "3,440", streak: 21 },
  { rank: "#8", username: "@icttrader", tier: "platinum", division: 1, totalXp: 9800, weeklyXp: 2320, score: 83, pf: 2.01, bestStrategy: "Liquidity Sweep", vaultStrategies: 5, clones: "3,100", streak: 19 },
  { rank: "#9", username: "@vwapking", tier: "platinum", division: 2, totalXp: 8700, weeklyXp: 2140, score: 81, pf: 1.95, bestStrategy: "VWAP Reversal", vaultStrategies: 4, clones: "2,890", streak: 18 },
  { rank: "#10", username: "@newstrader", tier: "platinum", division: 3, totalXp: 7200, weeklyXp: 2020, score: 80, pf: 1.91, bestStrategy: "News Fade", vaultStrategies: 3, clones: "2,420", streak: 16 },
  { rank: "#11", username: "@goldsniper", tier: "gold", division: 1, totalXp: 4880, weeklyXp: 1880, score: 79, pf: 1.88, bestStrategy: "FVG Scalper", vaultStrategies: 6, clones: "2,204", streak: 15 },
  { rank: "#12", username: "@fxlab", tier: "gold", division: 2, totalXp: 4210, weeklyXp: 1760, score: 78, pf: 1.84, bestStrategy: "RSI Reversion", vaultStrategies: 4, clones: "1,980", streak: 14 },
  { rank: "#13", username: "@eurotrader", tier: "gold", division: 2, totalXp: 3940, weeklyXp: 1605, score: 78, pf: 1.82, bestStrategy: "DAX Squeeze", vaultStrategies: 5, clones: "1,750", streak: 14 },
  { rank: "#14", username: "@harmonicfx", tier: "gold", division: 3, totalXp: 3610, weeklyXp: 1420, score: 77, pf: 1.81, bestStrategy: "Harmonic Bot", vaultStrategies: 3, clones: "1,610", streak: 13 },
  { rank: "#15", username: "@breakoutlab", tier: "gold", division: 4, totalXp: 3180, weeklyXp: 1290, score: 76, pf: 1.79, bestStrategy: "Range Breaker", vaultStrategies: 2, clones: "1,420", streak: 13 },
  { rank: "#16", username: "@riskfirst", tier: "silver", division: 1, totalXp: 2380, weeklyXp: 1120, score: 76, pf: 1.77, bestStrategy: "Low DD System", vaultStrategies: 4, clones: "1,200", streak: 12 },
  { rank: "#17", username: "@statquant", tier: "silver", division: 2, totalXp: 2100, weeklyXp: 980, score: 75, pf: 1.76, bestStrategy: "Z-Score Mean", vaultStrategies: 3, clones: "1,060", streak: 11 },
  { rank: "#18", username: "@sessionfx", tier: "silver", division: 3, totalXp: 1760, weeklyXp: 840, score: 75, pf: 1.74, bestStrategy: "London Momentum", vaultStrategies: 5, clones: "940", streak: 11 },
  { rank: "#19", username: "@microalpha", tier: "bronze", division: 1, totalXp: 920, weeklyXp: 730, score: 74, pf: 1.73, bestStrategy: "Micro Pullbacks", vaultStrategies: 2, clones: "880", streak: 10 },
  { rank: "#20", username: "@orderflow", tier: "bronze", division: 2, totalXp: 710, weeklyXp: 690, score: 74, pf: 1.72, bestStrategy: "Delta Reversal", vaultStrategies: 3, clones: "790", streak: 10 },
];

const myTrader: Trader = { rank: "—", username: "@guest", tier: "bronze", division: 1, totalXp: 0, weeklyXp: 0, score: 0, pf: 0, bestStrategy: "EMA Cross Strategy", vaultStrategies: 0, clones: "0", streak: 0 };

const leagueRows: Trader[] = [
  { rank: "#1", username: "@goldsniper", tier: "gold", division: 3, totalXp: 3610, weeklyXp: 1880, score: 79, pf: 1.88, bestStrategy: "FVG Scalper", vaultStrategies: 6, clones: "2,204", streak: 15 },
  { rank: "#2", username: "@harmonicfx", tier: "gold", division: 3, totalXp: 3580, weeklyXp: 1740, score: 77, pf: 1.81, bestStrategy: "Harmonic Bot", vaultStrategies: 3, clones: "1,610", streak: 13 },
  { rank: "#3", username: "@nyopen", tier: "gold", division: 3, totalXp: 3490, weeklyXp: 1610, score: 76, pf: 1.76, bestStrategy: "NY Open Pulse", vaultStrategies: 2, clones: "1,140", streak: 8 },
  { rank: "#4", username: "@londonfx", tier: "gold", division: 3, totalXp: 3320, weeklyXp: 1465, score: 75, pf: 1.71, bestStrategy: "London Drive", vaultStrategies: 4, clones: "990", streak: 21 },
  { rank: "#5", username: "@swinglab", tier: "gold", division: 3, totalXp: 3280, weeklyXp: 1320, score: 75, pf: 1.69, bestStrategy: "Swing Filter", vaultStrategies: 2, clones: "850", streak: 7 },
  { rank: "#6", username: "@riskfirst", tier: "gold", division: 3, totalXp: 3100, weeklyXp: 1040, score: 74, pf: 1.66, bestStrategy: "Low DD System", vaultStrategies: 4, clones: "760", streak: 12 },
  { rank: "#7", username: "@breakoutlab", tier: "gold", division: 3, totalXp: 3020, weeklyXp: 980, score: 74, pf: 1.65, bestStrategy: "Range Breaker", vaultStrategies: 2, clones: "705", streak: 9 },
  myTrader,
  ...Array.from({ length: 22 }, (_, index) => ({
    rank: `#${index + 9}`,
    username: `@goldleague${index + 1}`,
    tier: "gold" as Tier,
    division: 3 as const,
    totalXp: 2850 - index * 34,
    weeklyXp: 880 - index * 31,
    score: 73 - Math.floor(index / 5),
    pf: Number((1.62 - index * 0.01).toFixed(2)),
    bestStrategy: ["EMA Pullback", "Asia Range", "Gold VWAP", "Momentum Fade"][index % 4],
    vaultStrategies: 1 + (index % 4),
    clones: `${620 - index * 17}`,
    streak: 9 - (index % 7),
  })),
];

const xpSources = [
  ["Run a backtest", "10 XP"],
  ["Build strategy with AI", "15 XP"],
  ["Publish to Vault", "50 XP"],
  ["Get a clone on your strategy", "5 XP / clone"],
  ["Log journal entry", "10 XP"],
  ["Complete daily challenge", "25 XP"],
  ["Login streak bonus", "5 XP / streak day"],
  ["Review a strategy", "10 XP"],
  ["Strategy achieves PF > 2.0", "100 XP bonus"],
];

const achievementSections = [
  { title: "Getting Started", icon: User, items: [["First Login", "Welcome to the Lab", 10, true], ["First Strategy", "Code Monkey", 25, true], ["First Backtest", "Test Pilot", 25, true], ["Connect Broker", "Going Live", 50, false], ["Complete Profile", "Identity Verified", 15, true]] },
  { title: "Strategy Building", icon: Code2, items: [["10 Strategies Built", "Strategy Factory", 50, true], ["50 Strategies Built", "Assembly Line", 200, false], ["Strategy with PF > 2.0", "Edge Finder", 100, true], ["Strategy with PF > 3.0", "Holy Grail", 500, false], ["Use AI to build strategy", "AI Native", 25, true], ["Convert between languages", "Polyglot", 50, true]] },
  { title: "Backtesting", icon: BarChart3, items: [["100 Backtests Run", "Data Driven", 100, true], ["1,000 Backtests Run", "Obsessed", 500, false], ["Backtest with 1000+ trades", "Statistical Significance", 200, true], ["Achieve < 5% max drawdown", "Risk Manager", 150, false]] },
  { title: "Community", icon: Store, items: [["Publish to Vault", "Open Source", 50, true], ["Get 100 Clones", "Rising Star", 100, true], ["Get 1,000 Clones", "Influencer", 500, false], ["Get 5 Star Review", "Perfect Score", 100, true], ["Write 10 Reviews", "Critic", 50, false], ["Sell a Strategy", "Entrepreneur", 200, false], ["Earn $100 from sales", "Side Hustle", 300, false], ["Earn $1,000 from sales", "Business Owner", 1000, false]] },
  { title: "Discipline", icon: Shield, items: [["7 Day Login Streak", "Consistent", 50, true], ["30 Day Login Streak", "Dedicated", 200, false], ["100 Day Login Streak", "Machine", 1000, false], ["Log 50 Journal Entries", "Self Aware", 100, true], ["Follow Trading Plan 10 times", "Disciplined", 100, false]] },
  { title: "Elite", icon: Trophy, elite: true, items: [["Reach Master", "Master", 500, false], ["Top 10 on Leaderboard", "Champion", 1000, false], ["10,000 Total Clones", "Legend", 2000, false], ["365 Day Streak", "Immortal", 5000, false]] },
];

function Sidebar() {
  return <AppSidebar activeItem="leaderboard" />;
}

function RankIcon({ tier }: { tier: Tier }) {
  if (tier === "diamond") {
    return <path d="M12 5 17 11l-5 7-5-7 5-6Z" fill="#09090B" opacity="0.82" />;
  }
  if (tier === "grandmaster") {
    return <path d="M7 16h10l1-7-3 2-3-5-3 5-3-2 1 7Z" fill="#09090B" opacity="0.82" />;
  }
  if (tier === "legend") {
    return <path d="m12 5 1.7 4.1 4.4.4-3.3 2.9 1 4.3-3.8-2.3-3.8 2.3 1-4.3-3.3-2.9 4.4-.4L12 5Z" fill="#09090B" opacity="0.82" />;
  }
  if (tier === "master") {
    return <path d="M12 5 16 9v7H8V9l4-4Z" fill="#09090B" opacity="0.82" />;
  }
  if (tier === "platinum") {
    return <path d="M12 5 18 12l-6 7-6-7 6-7Zm0 3-3.5 4L12 16l3.5-4L12 8Z" fill="#09090B" opacity="0.82" />;
  }
  if (tier === "gold") {
    return <path d="M12 5 15 9l4 1.2-2.6 3.3.2 4.2L12 16l-4.6 1.7.2-4.2L5 10.2 9 9l3-4Z" fill="#09090B" opacity="0.82" />;
  }
  if (tier === "silver") {
    return <path d="M12 5 17 9v6l-5 4-5-4V9l5-4Z" fill="#09090B" opacity="0.82" />;
  }
  if (tier === "bronze") {
    return <circle cx="12" cy="12" r="5" fill="#09090B" opacity="0.82" />;
  }
  return <path d="M8 8h8v8H8V8Z" fill="#09090B" opacity="0.82" />;
}

function RankBadge({ tier, division, size = 16 }: { tier: Tier; division: 1 | 2 | 3 | 4; size?: number }) {
  const config = tiers[tier];
  const glow = tier === "legend" ? "animate-pulse drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]" : "";
  return (
    <span className={`inline-flex items-center gap-1 align-middle ${glow}`} title={`${config.label} ${divisions[division]}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 20 6v6c0 5.2-3.2 8.7-8 10-4.8-1.3-8-4.8-8-10V6l8-4Z" fill={config.color} opacity="0.95" />
        <path d="M12 5 17 7.5v4.3c0 3.4-1.9 5.6-5 6.7-3.1-1.1-5-3.3-5-6.7V7.5L12 5Z" fill="#09090B" opacity="0.35" />
        <RankIcon tier={tier} />
      </svg>
      <span className="text-[10px] font-semibold" style={{ color: config.color }}>{config.label} {divisions[division]}</span>
    </span>
  );
}

function AvatarFrame({ trader, large = false }: { trader: Trader; large?: boolean }) {
  const config = tiers[trader.tier];
  const effects: Record<Tier, string> = {
    iron: "",
    bronze: "shadow-[0_0_0_1px_rgba(205,127,50,0.35)]",
    silver: "shadow-[0_0_0_1px_rgba(192,192,192,0.4)]",
    gold: "shadow-[0_0_18px_rgba(255,215,0,0.18)]",
    platinum: "shadow-[0_0_18px_rgba(0,206,209,0.18)]",
    diamond: "shadow-[0_0_22px_rgba(185,242,255,0.28)]",
    master: "shadow-[0_0_24px_rgba(139,92,246,0.28)]",
    grandmaster: "shadow-[0_0_24px_rgba(239,68,68,0.34)]",
    legend: "animate-pulse shadow-[0_0_28px_rgba(255,215,0,0.45)]",
  };
  return (
    <div className={`${large ? "h-20 w-20 text-2xl" : "h-8 w-8 text-[11px]"} relative flex shrink-0 items-center justify-center rounded-full border-2 bg-surface font-semibold ${effects[trader.tier]}`} style={{ borderColor: config.color }}>
      {trader.username.slice(1, 3).toUpperCase()}
      {(trader.tier === "diamond" || trader.tier === "legend") && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-white shadow-[0_0_8px_white]" />}
    </div>
  );
}

function RankProgressCard() {
  const config = tiers[myTrader.tier];
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-panel p-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr_0.9fr]">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="absolute -inset-3 rounded-full opacity-20 blur-xl" style={{ backgroundColor: config.color }} />
            <AvatarFrame trader={myTrader} large />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[13px] text-muted"><RankBadge tier={myTrader.tier} division={myTrader.division} /> <span>Current rank</span></div>
            <h2 className="mt-1 text-4xl font-semibold" style={{ color: config.color }}>Gold III</h2>
            <div className="mt-2 flex items-center gap-3 text-[13px] text-muted"><span className="inline-flex items-center gap-1 text-orange-400"><Flame className="h-4 w-4" />12 day streak</span><span>1 freeze available</span></div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex justify-between text-[13px]"><span className="text-muted">2,340 / 3,000 XP to Gold II</span><span className="text-primary">78%</span></div>
            <div className="h-3 rounded-full bg-surface"><div className="h-full w-[78%] rounded-full bg-primary" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            {["League position: #8 of 30", "Status: Safe", "Weekly XP: 915", "Kwantify Score: 74"].map((stat) => <div key={stat} className="rounded-xl border border-border bg-background/40 p-3 text-muted">{stat}</div>)}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
          <div className="relative mb-3 overflow-hidden rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3">
            <div className="absolute right-3 top-3 flex gap-1">{Array.from({ length: 8 }).map((_, index) => <span key={index} className="h-1.5 w-1.5 rounded-full bg-yellow-300/70" />)}</div>
            <div className="text-[11px] font-semibold text-yellow-300">PROMOTED!</div>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-muted"><RankBadge tier="silver" division={1} /> <span>-&gt;</span> <RankBadge tier="gold" division={3} /></div>
          </div>
          <div className="text-[13px] text-primary">+50 XP bonus for promotion</div>
        </div>
      </div>
    </section>
  );
}

function LeagueRow({ trader, index }: { trader: Trader; index: number }) {
  const mine = trader.username === myTrader.username;
  const promotion = index < 5;
  const demotion = index >= 25;
  return (
    <tr className={`border-b border-border/60 ${promotion ? "bg-primary/5" : ""} ${demotion ? "bg-red-500/5" : ""} ${mine ? "sticky bottom-0 z-10 border-l-2 border-l-primary bg-panel shadow-[0_-8px_20px_rgba(0,0,0,0.35)]" : ""}`}>
      <td className="px-4 py-3 font-mono font-semibold">{index + 1}</td>
      <td className="px-4 py-3"><div className="flex items-center gap-2"><AvatarFrame trader={trader} /><div><div className="flex items-center gap-2 font-medium">{trader.username}<span className="inline-flex items-center gap-1 text-orange-400"><Flame className="h-3 w-3" />{trader.streak}</span></div><RankBadge tier={trader.tier} division={trader.division} /></div></div></td>
      <td className="px-4 py-3 font-mono text-primary">{trader.weeklyXp.toLocaleString()}</td>
      <td className="px-4 py-3">{promotion ? <span className="rounded-lg bg-primary/10 px-2 py-1 text-[11px] text-primary">Promotion zone</span> : demotion ? <span className="rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-400">Demotion zone</span> : <span className="rounded-lg bg-surface px-2 py-1 text-[11px] text-muted">Safe</span>}</td>
    </tr>
  );
}

function RankRow({ trader }: { trader: Trader }) {
  const top = trader.rank === "#1" || trader.rank === "#2" || trader.rank === "#3";
  const border = trader.rank === "#1" ? "border-l-[#FFD700] shadow-[0_0_18px_rgba(255,215,0,0.08)]" : trader.rank === "#2" ? "border-l-[#C0C0C0]" : trader.rank === "#3" ? "border-l-[#CD7F32]" : "border-l-transparent";
  return (
    <tr className={`border-b border-border/60 border-l-2 ${border} ${top ? "bg-surface/20" : ""} hover:bg-surface/30`}>
      <td className="px-4 py-3 font-mono font-semibold">{trader.rank === "#1" ? <Crown className="h-4 w-4 text-yellow-400" /> : trader.rank}</td>
      <td className="px-4 py-3"><div className="flex items-center gap-2"><AvatarFrame trader={trader} /><div><div className="flex items-center gap-2 font-medium">{trader.username}<span className="inline-flex items-center gap-1 text-orange-400"><Flame className="h-3 w-3" />{trader.streak}</span></div><RankBadge tier={trader.tier} division={trader.division} /></div></div></td>
      <td className="px-4 py-3 font-mono text-primary">{trader.score}</td>
      <td className="px-4 py-3 font-mono">{trader.pf}</td>
      <td className="px-4 py-3">{trader.bestStrategy}</td>
      <td className="px-4 py-3 font-mono">{trader.vaultStrategies}</td>
      <td className="px-4 py-3 font-mono">{trader.clones}</td>
      <td className="px-4 py-3 font-mono">{trader.totalXp.toLocaleString()}</td>
    </tr>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("rankings");
  const [period, setPeriod] = useState("This Week");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ "Getting Started": true, "Strategy Building": true, Elite: true });

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mr-auto flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Trophy className="h-5 w-5" /></div>
            <div><h1 className="text-[20px] font-semibold">Leaderboard</h1><p className="text-[13px] text-muted">Compete, earn achievements & climb the ranks</p></div>
          </div>
          <div className="hidden items-center gap-1 rounded-xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-[13px] text-orange-400 sm:flex"><Flame className="h-4 w-4" />12</div>
          <button className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">My Profile</button>
          <div className="flex rounded-xl border border-border bg-panel p-0.5">{["This Week", "This Month", "All Time"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded-lg px-3 py-1.5 text-[12px] ${period === item ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}>{item}</button>)}</div>
        </header>

        <div className="border-b border-border px-6 pt-5">
          <div className="flex gap-2">{(["rankings", "achievements", "challenges"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-t-xl px-4 py-2 text-[13px] font-medium ${tab === item ? "border border-b-0 border-border bg-panel text-foreground" : "text-muted hover:text-foreground"}`}>{item === "rankings" ? "League" : item === "achievements" ? "Achievements" : "Challenges"}</button>)}</div>
        </div>

        <div className="space-y-6 p-6">
          {tab === "rankings" && (
            <>
              <RankProgressCard />

              <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-border bg-panel p-5">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div className="mr-auto"><h2 className="text-lg font-semibold">Your League - Gold III</h2><p className="text-[13px] text-muted">30 traders competing by XP earned this week. League resets every Monday 00:00 UTC.</p></div>
                    <span className="rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[12px] text-muted">League ends in 3d 14h</span>
                  </div>
                  <div className="max-h-[620px] overflow-auto rounded-xl border border-border">
                    <table className="w-full text-[13px]">
                      <thead className="sticky top-0 z-10 border-b border-border bg-panel text-[11px] uppercase tracking-wider text-muted"><tr>{["#", "Trader", "Weekly XP", "Status"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr></thead>
                      <tbody>{leagueRows.map((trader, index) => <LeagueRow key={`${trader.username}-${index}`} trader={trader} index={index} />)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-panel p-5"><h3 className="mb-4 font-semibold">Rank Tiers</h3><div className="grid grid-cols-2 gap-2">{tierOrder.map((tier) => <div key={tier} className="rounded-xl border border-border bg-background/40 p-3"><RankBadge tier={tier} division={tier === "legend" ? 1 : 4} /><div className="mt-1 font-mono text-[10px] text-muted">{tiers[tier].range}</div></div>)}</div></div>
                  <div className="rounded-2xl border border-border bg-panel p-5"><h3 className="mb-4 font-semibold">Weekly XP Sources</h3><div className="space-y-2">{xpSources.map(([label, xp]) => <div key={label} className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2 text-[13px]"><span className="text-muted">{label}</span><span className="font-mono text-primary">{xp}</span></div>)}</div></div>
                  <div className="rounded-2xl border border-border bg-panel p-5"><h3 className="mb-4 font-semibold">Streak Milestones</h3><div className="space-y-3 text-[13px]">{[["7 days", "Bronze flame - Consistent badge"], ["30 days", "Silver flame - Dedicated badge + frame"], ["100 days", "Gold flame - Machine badge + exclusive frame"], ["365 days", "Diamond flame - Immortal badge + animated frame"]].map(([days, reward]) => <div key={days} className="flex gap-3 rounded-xl bg-background/40 p-3"><Flame className="h-4 w-4 text-orange-400" /><div><div className="font-medium">{days}</div><div className="text-muted">{reward}</div></div></div>)}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-panel p-5">
                <div className="mb-4 flex flex-wrap gap-3"><KwantSelect className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-muted"><option>By Kwantify Score</option><option>By Profit Factor</option><option>By Vault Clones</option><option>By Win Rate Consistency</option><option>By Streak</option></KwantSelect><KwantSelect className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-muted"><option>All</option><option>NAS100 specialists</option><option>Gold specialists</option><option>Crypto</option><option>Forex</option></KwantSelect></div>
                <div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-[13px]"><thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted"><tr>{["Rank", "Trader", "Kwantify Score", "Profit Factor", "Best Strategy", "Vault Strategies", "Clones Received", "Total XP"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr></thead><tbody>{leaderboard.map((trader) => <RankRow key={trader.rank} trader={trader} />)}<RankRow trader={myTrader} /></tbody></table></div>
                <button className="mt-4 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Load more</button>
              </section>
            </>
          )}

          {tab === "achievements" && (
            <section className="space-y-4">
              {achievementSections.map((section) => {
                const Icon = section.icon;
                const open = !!openSections[section.title];
                return (
                  <div key={section.title} className="overflow-hidden rounded-2xl border border-border bg-panel">
                    <button onClick={() => setOpenSections((current) => ({ ...current, [section.title]: !open }))} className="flex w-full items-center gap-3 px-5 py-4 text-left font-semibold hover:bg-surface/40"><Icon className={`h-5 w-5 ${section.elite ? "text-yellow-400" : "text-primary"}`} /><span className="mr-auto">{section.title}</span><ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "" : "-rotate-90"}`} /></button>
                    {open && <div className="grid gap-3 border-t border-border p-4 lg:grid-cols-2 xl:grid-cols-3">{section.items.map(([name, desc, xp, earned]) => <div key={name as string} className={`rounded-2xl border border-border bg-background/40 p-4 ${earned ? "border-l-2 border-l-primary" : "opacity-50"} ${section.elite ? "animate-pulse shadow-[0_0_18px_rgba(255,215,0,0.08)]" : ""}`}><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-full ${earned ? "bg-primary/10 text-primary" : "bg-surface text-muted"}`}>{earned ? <Check className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="font-semibold">{name}</div><div className="text-[12px] text-muted">{desc}</div></div><div className="font-mono text-[12px] text-primary">{xp} XP</div></div>{!earned && <div className="mt-3 h-1.5 rounded-full bg-surface"><div className="h-full w-1/3 rounded-full bg-primary" /></div>}</div>)}</div>}
                  </div>
                );
              })}
            </section>
          )}

          {tab === "challenges" && (
            <section className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-border bg-panel p-6"><div className="mb-3 flex items-center gap-2"><Flame className="h-5 w-5 text-orange-400" /><h2 className="text-xl font-semibold">Gold Rush</h2><span className="ml-auto rounded-lg bg-surface px-2 py-1 font-mono text-[11px] text-muted">Ends in 3d 14h 22m</span></div><p className="text-[13px] leading-6 text-muted">Build a XAUUSD strategy with Profit Factor &gt; 2.0 on the last 90 days of data.</p><div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-3 text-[13px] text-primary">Reward: 500 XP + Gold Rush Champion badge + featured on leaderboard</div><div className="mt-4 text-[13px] text-muted">234 traders competing · Your status: Submitted - PF 1.87 - Rank #12</div><button className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-background">Enter Challenge</button></div>
                <div className="space-y-4"><div className="rounded-2xl border border-border bg-panel p-5"><h3 className="font-semibold">Quick Draw</h3><p className="mt-2 text-[13px] text-muted">Run 5 backtests today</p><div className="mt-3 text-[12px] text-primary">Reward: 50 XP</div><div className="mt-3 flex justify-between text-[12px] text-muted"><span>3/5 complete</span><span>Resets daily</span></div><div className="mt-2 h-2 rounded-full bg-surface"><div className="h-full w-3/5 rounded-full bg-primary" /></div></div><div className="rounded-2xl border border-border bg-panel p-5"><h3 className="font-semibold">Team Battle: NAS100 vs XAUUSD</h3><p className="mt-2 text-[13px] text-muted">Which instrument produces better strategies this week?</p><div className="mt-3 grid grid-cols-2 gap-2 text-[12px]"><div className="rounded-xl bg-surface p-3">NAS100<br /><span className="font-mono text-primary">145 traders · PF 1.67</span></div><div className="rounded-xl bg-surface p-3">XAUUSD<br /><span className="font-mono text-primary">132 traders · PF 1.72</span></div></div><button className="mt-4 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Join a Team</button></div></div>
              </div>
              <div className="rounded-2xl border border-border bg-panel p-5"><h2 className="text-[16px] font-semibold">Past Challenges</h2><div className="mt-4 space-y-2 text-[13px] text-muted">{["Gold Rush Week 12 - Winner: @quantmaster - PF 3.21", "NAS100 Sprint - Winner: @algopro - PF 2.88", "Risk Manager Cup - Winner: @riskfirst - Max DD 2.9%"].map((item) => <div key={item} className="rounded-xl border border-border bg-background/40 p-3">{item}</div>)}</div></div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
