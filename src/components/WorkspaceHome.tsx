"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Crosshair,
  History,
  Home,
  LineChart,
  NotebookPen,
  ScanLine,
  Sparkles,
  UsersRound,
  Wallet,
  Waves,
  Workflow,
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { createClient } from "@/lib/supabase";

const ParticleTerrain = dynamic(() => import("@/components/landing/ParticleTerrain"), {
  ssr: false,
});

type LaunchPreview =
  | "home"
  | "chart"
  | "vue"
  | "calendar"
  | "flow"
  | "gamma"
  | "gexmap"
  | "liquidity"
  | "levels"
  | "gameplan"
  | "zyon"
  | "news"
  | "socials"
  | "journal"
  | "backtest"
  | "accounts";

type LaunchDestination = {
  href: string;
  title: string;
  eyebrow: string;
  description: string;
  preview: LaunchPreview;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

const destinations: LaunchDestination[] = [
  { href: "/", title: "Home", eyebrow: "Command centre", description: "Your complete Kwant Desk launch surface.", preview: "home", icon: Home },
  { href: "/charts", title: "Charts", eyebrow: "Market workspace", description: "Live futures charting, indicators and execution.", preview: "chart", icon: LineChart },
  { href: "/gamvue", title: "GEX Vue", eyebrow: "Gamma charting", description: "Multi-panel underlying and options context.", preview: "vue", icon: BarChart3 },
  { href: "/gex-cal", title: "GEX Calendar", eyebrow: "Expiry structure", description: "Exposure across dates, strikes and expirations.", preview: "calendar", icon: CalendarRange },
  { href: "/gex-flow", title: "GEX Flow", eyebrow: "Options movement", description: "Track live positioning as exposure builds.", preview: "flow", icon: Workflow },
  { href: "/gamma", title: "Gamma", eyebrow: "Options intelligence", description: "Dealer regime, structure and positioning data.", preview: "gamma", icon: Crosshair },
  { href: "/gexmap", title: "GEX Map", eyebrow: "Strike exposure", description: "Live GEX, DEX and VEX strike ladders.", preview: "gexmap", icon: ScanLine },
  { href: "/liqmap", title: "Liquidity Map", eyebrow: "Level 3 order flow", description: "Resting liquidity, trades, bubbles and DOM.", preview: "liquidity", icon: Waves },
  { href: "/levelz", title: "Levelz", eyebrow: "Price intelligence", description: "Institutional levels, zones and reactions.", preview: "levels", icon: Crosshair },
  { href: "/gameplan", title: "Gameplan", eyebrow: "Session preparation", description: "Build, hold and score your trading plan.", preview: "gameplan", icon: CalendarDays },
  { href: "/zyon", title: "Zyon", eyebrow: "Trading intelligence", description: "Live market context, research and reasoning.", preview: "zyon", icon: Sparkles },
  { href: "/news", title: "News", eyebrow: "Macro calendar", description: "Events, releases and market-moving context.", preview: "news", icon: BookOpen },
  { href: "/socials", title: "Socials", eyebrow: "Trader network", description: "Posts, desks, friends and shared trades.", preview: "socials", icon: UsersRound },
  { href: "/journal", title: "Journal", eyebrow: "Performance record", description: "Trades, reviews, analytics and equity curves.", preview: "journal", icon: NotebookPen },
  { href: "/backtesting", title: "Backtesting", eyebrow: "Historical replay", description: "Replay past sessions without lookahead.", preview: "backtest", icon: History },
  { href: "/accounts", title: "Accounts", eyebrow: "Trade operations", description: "Sim accounts, balances and broker routing.", preview: "accounts", icon: Wallet },
];

const candleData = [
  [19, 42, 12, 49], [39, 33, 26, 45], [31, 55, 28, 59], [53, 47, 41, 58],
  [45, 63, 43, 68], [61, 57, 50, 65], [55, 72, 52, 76], [70, 66, 61, 75],
  [64, 79, 60, 82], [77, 69, 65, 81], [67, 84, 64, 88], [82, 76, 71, 87],
];

function Candles({ compact = false }: { compact?: boolean }) {
  const scale = compact ? 0.72 : 1;
  return (
    <g transform={compact ? "translate(22 15) scale(.72)" : undefined}>
      {candleData.map(([open, close, low, high], index) => {
        const up = close >= open;
        const x = 13 + index * 13;
        const y = 92 - Math.max(open, close) * scale;
        const height = Math.max(3, Math.abs(close - open) * scale);
        return (
          <g key={x}>
            <line x1={x + 3} y1={92 - high * scale} x2={x + 3} y2={92 - low * scale} stroke={up ? "var(--primary)" : "rgba(255,255,255,.88)"} strokeWidth="1" />
            <rect x={x} y={y} width="6" height={height} fill={up ? "var(--primary)" : "rgba(255,255,255,.9)"} />
          </g>
        );
      })}
    </g>
  );
}

function PreviewGrid() {
  return (
    <g stroke="rgba(255,255,255,.075)" strokeWidth=".75">
      {[24, 48, 72, 96].map((y) => <line key={`y-${y}`} x1="0" y1={y} x2="176" y2={y} />)}
      {[35, 70, 105, 140].map((x) => <line key={`x-${x}`} x1={x} y1="0" x2={x} y2="112" />)}
    </g>
  );
}

function WorkspacePreview({ type }: { type: LaunchPreview }) {
  const common = <PreviewGrid />;
  let content: ReactNode;

  switch (type) {
    case "home":
      content = <><path d="M0 84 C28 79 35 55 63 66 S103 79 126 56 S157 51 176 60" fill="none" stroke="var(--primary)" strokeWidth="1.4" /><path d="M0 92 C26 83 43 73 67 80 S112 92 137 73 S160 67 176 72" fill="none" stroke="rgba(255,255,255,.3)" /><g fill="var(--primary)">{[16,33,58,81,106,132,151,166].map((x, i) => <circle key={x} cx={x} cy={78 - (i % 3) * 5} r="1.2" />)}</g></>;
      break;
    case "chart":
      content = <>{common}<Candles /><path d="M0 80 C24 77 43 61 65 65 S105 55 126 43 S154 39 176 31" fill="none" stroke="var(--primary)" strokeWidth="1" opacity=".65" /></>;
      break;
    case "vue":
      content = <><rect x="6" y="7" width="101" height="98" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.1)" /><rect x="113" y="7" width="57" height="47" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.1)" /><rect x="113" y="58" width="57" height="47" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.1)" /><Candles compact /><path d="M118 43 L125 35 133 38 142 24 150 29 164 16" fill="none" stroke="var(--primary)" /><path d="M118 91 L128 84 137 88 148 69 158 77 166 64" fill="none" stroke="rgba(255,255,255,.55)" /></>;
      break;
    case "calendar":
      content = <>{[0,1,2,3,4].map((row) => [0,1,2,3,4,5,6].map((column) => { const active = (row * 5 + column * 3) % 7 < 3; return <rect key={`${row}-${column}`} x={8 + column * 24} y={8 + row * 20} width="19" height="15" fill={active ? "color-mix(in srgb, var(--primary) 45%, transparent)" : "rgba(255,255,255,.035)"} stroke={active ? "var(--primary)" : "rgba(255,255,255,.09)"} opacity={.42 + ((row + column) % 3) * .2} />; }))}</>;
      break;
    case "flow":
      content = <>{common}<path d="M0 89 C21 82 24 49 49 57 S78 79 95 54 S127 31 176 22" fill="none" stroke="var(--primary)" strokeWidth="2" /><path d="M0 71 C27 64 34 75 57 67 S92 37 111 49 S141 60 176 42" fill="none" stroke="rgba(255,255,255,.5)" /><g fill="var(--primary)">{[20,48,74,98,125,150].map((x, i) => <circle key={x} cx={x} cy={78 - i * 8} r={2 + i * .35} opacity={.4 + i * .1} />)}</g></>;
      break;
    case "gamma":
      content = <>{[0,1,2,3,4,5,6,7,8].map((index) => { const width = [31,49,66,91,122,103,78,51,28][index]; return <g key={index}><rect x={88 - width / 2} y={8 + index * 11} width={width} height="6" fill={index < 4 ? "rgba(255,255,255,.36)" : "var(--primary)"} opacity={.3 + index * .07} /><line x1="88" y1={6 + index * 11} x2="88" y2={17 + index * 11} stroke="rgba(255,255,255,.18)" /></g>; })}</>;
      break;
    case "gexmap":
      content = <>{[0,1,2].map((panel) => <g key={panel} transform={`translate(${4 + panel * 57} 5)`}><rect width="53" height="102" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.1)" />{[0,1,2,3,4,5,6].map((row) => <rect key={row} x="4" y={7 + row * 13} width="45" height="9" fill={row === 4 ? "var(--primary)" : row % 2 ? "color-mix(in srgb, var(--primary) 32%, transparent)" : "rgba(255,255,255,.05)"} opacity={row === 4 ? .8 : .65} />)}</g>)}</>;
      break;
    case "liquidity":
      content = <>{[10,22,35,49,62,76,90,103].map((y, index) => <rect key={y} x="0" y={y} width="176" height={index % 3 === 0 ? 7 : 4} fill="var(--primary)" opacity={[.1,.28,.13,.55,.2,.38,.12,.22][index]} />)}<path d="M0 72 L18 67 35 70 51 57 68 60 87 46 106 51 126 35 144 42 176 29" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth="1.5" />{[[31,68,5],[72,57,8],[110,48,4],[145,40,10]].map(([x,y,r]) => <circle key={x} cx={x} cy={y} r={r} fill="var(--primary)" opacity=".68" stroke="rgba(255,255,255,.55)" />)}</>;
      break;
    case "levels":
      content = <>{common}<Candles compact />{[[25,.3],[46,.7],[69,.4],[91,.85]].map(([y, opacity]) => <g key={y}><line x1="0" y1={y} x2="176" y2={y} stroke="var(--primary)" strokeWidth={opacity > .8 ? 2 : 1} opacity={opacity} strokeDasharray={opacity < .5 ? "3 3" : undefined} /><rect x="145" y={y - 4} width="27" height="8" fill="var(--primary)" opacity={opacity} /></g>)}</>;
      break;
    case "gameplan":
      content = <>{[0,1,2].map((column) => <g key={column} transform={`translate(${6 + column * 57} 7)`}><rect width="51" height="98" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" /><rect x="6" y="8" width={26 + column * 5} height="3" fill="var(--primary)" /><rect x="6" y="19" width="38" height="2" fill="rgba(255,255,255,.25)" />{[34,49,64,79].map((y, i) => <rect key={y} x="6" y={y} width={38 - i * 4} height="6" fill={i === column ? "color-mix(in srgb, var(--primary) 35%, transparent)" : "rgba(255,255,255,.06)"} />)}</g>)}</>;
      break;
    case "zyon":
      content = <><circle cx="31" cy="29" r="13" fill="none" stroke="var(--primary)" strokeWidth="1.5" /><circle cx="31" cy="29" r="6" fill="var(--primary)" opacity=".5" /><rect x="53" y="14" width="108" height="25" rx="3" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.1)" /><rect x="15" y="51" width="124" height="22" rx="3" fill="color-mix(in srgb, var(--primary) 14%, transparent)" stroke="color-mix(in srgb, var(--primary) 35%, transparent)" /><rect x="42" y="84" width="119" height="18" rx="3" fill="rgba(255,255,255,.045)" /><g fill="rgba(255,255,255,.4)"><rect x="60" y="22" width="75" height="2" /><rect x="22" y="59" width="92" height="2" /><rect x="50" y="91" width="69" height="2" /></g></>;
      break;
    case "news":
      content = <>{[0,1,2,3].map((row) => <g key={row} transform={`translate(7 ${8 + row * 25})`}><rect width="162" height="20" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.08)" /><circle cx="10" cy="10" r="3" fill={row === 1 ? "var(--primary)" : "rgba(255,255,255,.28)"} /><rect x="20" y="6" width={54 + row * 12} height="3" fill="rgba(255,255,255,.42)" /><rect x="20" y="12" width="92" height="2" fill="rgba(255,255,255,.13)" /><rect x="139" y="6" width="16" height="8" fill={row === 1 ? "var(--primary)" : "rgba(255,255,255,.08)"} opacity=".7" /></g>)}</>;
      break;
    case "socials":
      content = <><rect x="8" y="7" width="102" height="98" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" /><circle cx="22" cy="22" r="7" fill="var(--primary)" opacity=".55" /><rect x="34" y="17" width="47" height="3" fill="rgba(255,255,255,.45)" /><rect x="16" y="37" width="86" height="40" fill="color-mix(in srgb, var(--primary) 10%, transparent)" /><path d="M20 68 L33 57 46 62 61 48 76 55 97 43" fill="none" stroke="var(--primary)" /><rect x="16" y="86" width="20" height="4" fill="rgba(255,255,255,.18)" /><rect x="44" y="86" width="20" height="4" fill="rgba(255,255,255,.18)" /><rect x="118" y="7" width="50" height="46" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" /><rect x="118" y="59" width="50" height="46" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" /></>;
      break;
    case "journal":
      content = <>{common}<path d="M6 86 L24 79 41 82 59 61 78 66 97 45 114 50 132 31 151 37 170 18" fill="none" stroke="var(--primary)" strokeWidth="2" /><path d="M6 86 L24 79 41 82 59 61 78 66 97 45 114 50 132 31 151 37 170 18 L170 106 L6 106 Z" fill="url(#journalFade)" /><defs><linearGradient id="journalFade" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--primary)" stopOpacity=".24" /><stop offset="1" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs></>;
      break;
    case "backtest":
      content = <>{common}<Candles /><line x1="116" y1="5" x2="116" y2="94" stroke="var(--primary)" strokeDasharray="3 3" /><circle cx="116" cy="48" r="4" fill="var(--primary)" /><rect x="12" y="101" width="150" height="3" fill="rgba(255,255,255,.12)" /><rect x="12" y="101" width="104" height="3" fill="var(--primary)" /><path d="M168 98 L174 102.5 168 107 Z" fill="var(--primary)" /></>;
      break;
    case "accounts":
      content = <>{[0,1,2,3].map((index) => <g key={index} transform={`translate(${7 + (index % 2) * 84} ${7 + Math.floor(index / 2) * 52})`}><rect width="78" height="45" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" /><rect x="8" y="8" width="25" height="2" fill="rgba(255,255,255,.26)" /><rect x="8" y="18" width={42 + index * 4} height="6" fill={index === 0 || index === 3 ? "var(--primary)" : "rgba(255,255,255,.68)"} opacity=".75" /><path d={`M8 36 L22 ${34 - index * 2} 35 ${37 - index} 48 ${29 - index * 2} 68 ${25 - index}`} fill="none" stroke="var(--primary)" /></g>)}</>;
      break;
  }

  return (
    <svg viewBox="0 0 176 112" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
      {content}
    </svg>
  );
}

function LaunchCard({ destination }: { destination: LaunchDestination }) {
  const Icon = destination.icon;
  return (
    <Link
      href={destination.href}
      prefetch={false}
      className="group relative flex min-h-[190px] flex-col overflow-hidden rounded-[7px] border border-white/[0.11] bg-black/55 text-left shadow-[0_22px_70px_rgba(0,0,0,.28)] backdrop-blur-[18px] transition duration-300 hover:-translate-y-1 hover:border-primary/65 hover:bg-black/72 hover:shadow-[0_24px_80px_rgba(0,0,0,.55),0_0_30px_color-mix(in_srgb,var(--primary)_18%,transparent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      <div className="relative h-[112px] shrink-0 overflow-hidden border-b border-white/[0.08] bg-black/35">
        <div className="absolute inset-0 opacity-80 transition duration-500 group-hover:scale-[1.035] group-hover:opacity-100">
          <WorkspacePreview type={destination.preview} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(0,0,0,.5)_100%)]" />
        <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-[4px] border border-white/10 bg-black/55 text-primary backdrop-blur-md transition group-hover:border-primary/45 group-hover:shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_30%,transparent)]">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.55} />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-end gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[7px] font-semibold uppercase tracking-[0.18em] text-primary/75">{destination.eyebrow}</div>
          <h2 className="text-[14px] font-semibold uppercase leading-none tracking-[0.065em] text-white">{destination.title}</h2>
          <p className="mt-1.5 line-clamp-1 text-[8px] leading-4 text-white/48 transition group-hover:text-white/67">{destination.description}</p>
        </div>
        <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-white/10 text-white/38 transition group-hover:border-primary/45 group-hover:bg-primary/10 group-hover:text-primary">
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
        </span>
      </div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-primary shadow-[0_0_12px_var(--primary)] transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
}

export default function WorkspaceHome({ username = "" }: { username?: string }) {
  const router = useRouter();
  const [heroReady, setHeroReady] = useState(false);
  const revealHero = useCallback(() => setHeroReady(true), []);

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login?returnTo=/");
    router.refresh();
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <AppSidebar
        activeItem="home"
        accountLabel="Account"
        accountTitle={username ? `Sign out @${username}` : "Sign out"}
        onAccountClick={signOut}
        orientation="horizontal"
      />
      <main
        className="relative min-h-0 flex-1 overflow-hidden bg-black"
        aria-label="Home workspace"
      >
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${heroReady ? "opacity-100" : "opacity-0"}`}
          aria-hidden={!heroReady}
        >
          <ParticleTerrain onReady={revealHero} />
          <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_42%,transparent_0%,rgba(0,0,0,.08)_48%,rgba(0,0,0,.78)_100%)]" />
          <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center px-6 opacity-[0.16]">
            <div className="relative w-[78vw] sm:w-[54vw] lg:w-[33vw]">
              <Image
                src="/images/kwantdesk-wordmark.webp"
                alt="Kwant Desk"
                width={1911}
                height={305}
                priority
                unoptimized
                sizes="(max-width: 639px) 78vw, (max-width: 1023px) 54vw, 33vw"
                className="h-auto w-full drop-shadow-[0_0_28px_rgba(255,255,255,.08)]"
              />
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 z-[4] bg-[linear-gradient(180deg,rgba(0,0,0,.16),rgba(0,0,0,.02)_35%,rgba(0,0,0,.34))]" />
        <section
          className="kwant-scrollbar relative z-10 h-full w-full overflow-y-auto px-[clamp(28px,4vw,88px)] py-[clamp(16px,2vw,32px)]"
          aria-label="Workspace launcher"
        >
          <div className="grid min-h-full w-full auto-rows-[minmax(190px,1fr)] grid-cols-1 gap-[clamp(12px,1vw,18px)] sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map((destination) => <LaunchCard key={destination.href + destination.title} destination={destination} />)}
          </div>
        </section>
      </main>
    </div>
  );
}
