"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useState, type ComponentType } from "react";
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
import {
  HomeWorkspacePreview,
  LiveIndexTape,
  useHomeLiveIndices,
  type HomeLaunchPreview,
  type HomeLiveIndices,
} from "@/components/home/HomeLivePreviews";
import { createClient } from "@/lib/supabase";

const ParticleTerrain = dynamic(() => import("@/components/landing/ParticleTerrain"), {
  ssr: false,
});

type LaunchDestination = {
  href: string;
  title: string;
  eyebrow: string;
  description: string;
  preview: HomeLaunchPreview;
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

const LaunchCard = memo(function LaunchCard({
  destination,
  live,
}: {
  destination: LaunchDestination;
  live: HomeLiveIndices;
}) {
  const Icon = destination.icon;
  return (
    <Link
      href={destination.href}
      prefetch={false}
      className="group relative flex min-h-[216px] flex-col overflow-hidden rounded-[7px] border border-[color-mix(in_srgb,var(--foreground)_11%,transparent)] bg-[color-mix(in_srgb,var(--background)_55%,transparent)] text-left shadow-[0_22px_70px_rgba(0,0,0,.28)] backdrop-blur-[18px] transition duration-300 hover:-translate-y-1 hover:border-primary/65 hover:bg-[color-mix(in_srgb,var(--background)_72%,transparent)] hover:shadow-[0_24px_80px_rgba(0,0,0,.55),0_0_30px_color-mix(in_srgb,var(--primary)_18%,transparent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      <div className="relative h-[140px] shrink-0 overflow-hidden border-b border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-[color-mix(in_srgb,var(--background)_35%,transparent)]">
        <HomeWorkspacePreview type={destination.preview} live={live} />
        {destination.preview === "home" && <LiveIndexTape live={live} />}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_72%,color-mix(in_srgb,var(--background)_45%,transparent)_100%)]" />
        <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--background)_55%,transparent)] text-primary backdrop-blur-md transition group-hover:border-primary/45 group-hover:shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_30%,transparent)]">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.55} />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-end gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[7px] font-semibold uppercase tracking-[0.18em] text-primary/75">{destination.eyebrow}</div>
          <h2 className="text-[14px] font-semibold uppercase leading-none tracking-[0.065em] text-foreground">{destination.title}</h2>
          <p className="mt-1.5 line-clamp-1 text-[8px] leading-4 text-[color-mix(in_srgb,var(--foreground)_48%,transparent)] transition group-hover:text-[color-mix(in_srgb,var(--foreground)_67%,transparent)]">{destination.description}</p>
        </div>
        <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] text-[color-mix(in_srgb,var(--foreground)_38%,transparent)] transition group-hover:border-primary/45 group-hover:bg-primary/10 group-hover:text-primary">
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
        </span>
      </div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-primary shadow-[0_0_12px_var(--primary)] transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
});

const EMPTY_LIVE_INDICES: HomeLiveIndices = {};

export default function WorkspaceHome({ username = "" }: { username?: string }) {
  const router = useRouter();
  const [heroReady, setHeroReady] = useState(false);
  const revealHero = useCallback(() => setHeroReady(true), []);
  const liveIndices = useHomeLiveIndices();

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
        className="relative min-h-0 flex-1 overflow-hidden bg-background"
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
          <div className="grid min-h-full w-full auto-rows-[minmax(216px,1fr)] grid-cols-1 gap-[clamp(12px,1vw,18px)] sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map((destination) => (
              <LaunchCard
                key={destination.href + destination.title}
                destination={destination}
                live={destination.preview === "chart" || destination.preview === "vue" || destination.preview === "home"
                  ? liveIndices
                  : EMPTY_LIVE_INDICES}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
