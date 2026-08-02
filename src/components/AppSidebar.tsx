"use client";

import Link from "next/link";
import { memo, type ComponentType, useCallback, useEffect, useRef } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Crosshair,
  History,
  Home,
  Layers3,
  LineChart,
  NotebookPen,
  ScanLine,
  Settings,
  Sparkles,
  User,
  UsersRound,
} from "lucide-react";
type SidebarKey =
  | "ai"
  | "agent"
  | "home"
  | "charts"
  | "gamma"
  | "levelz"
  | "gexmap"
  | "gexdesk"
  | "gameplan"
  | "kwantbot"
  | "automation"
  | "connector"
  | "tradeSyncer"
  | "journal"
  | "socials"
  | "backtesting"
  | "converter"
  | "news"
  | "zyon"
  | "alerts"
  | "vault"
  | "leaderboard"
  | "lab"
  | "accounts"
  | "settings";

type AppSidebarProps = {
  activeItem: SidebarKey;
  accountLabel?: string;
  accountTitle?: string;
  onAccountClick?: () => void;
  onNavigateStart?: (item: SidebarKey) => void;
  orientation?: "vertical" | "horizontal";
};

const horizontalItemBase =
  "relative flex h-8 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-[12px] font-semibold uppercase transition-all";
const horizontalItemInactive = `${horizontalItemBase} border-transparent text-muted hover:border-border hover:bg-surface hover:text-foreground`;
const horizontalItemActive = `${horizontalItemBase} border-primary/30 bg-primary/10 text-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_10%,transparent)]`;
const verticalItemBase =
  "mx-auto flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-all duration-300 group-hover:w-[184px] group-hover:justify-start group-hover:gap-3 group-hover:px-[9px]";
const verticalItemInactive = `${verticalItemBase} text-muted hover:bg-surface hover:text-foreground`;
const verticalItemActive = `${verticalItemBase} bg-primary/10 text-primary`;
const verticalItemLabel =
  "max-w-0 translate-x-[-6px] overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-all duration-300 group-hover:max-w-[132px] group-hover:translate-x-0 group-hover:opacity-100";

const navItems: Array<{
  key: Exclude<SidebarKey, "settings">;
  href: string;
  label: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "home", href: "/", label: "Home", title: "Home", icon: Home },
  { key: "charts", href: "/charts", label: "Charts", title: "Charts", icon: LineChart },
  { key: "zyon", href: "/zyon", label: "ZYON", title: "ZYON Trading Intelligence", icon: Sparkles },
  { key: "gameplan", href: "/gameplan", label: "Gameplan", title: "Gameplan", icon: CalendarDays },
  { key: "gamma", href: "/gamma", label: "GAMMA", title: "Gamma", icon: BarChart3 },
  { key: "gexmap", href: "/gexmap", label: "GEX MAP", title: "GEX Map", icon: ScanLine },
  { key: "gexdesk", href: "/gexdesk", label: "GEX DESK", title: "GEX Desk", icon: Layers3 },
  { key: "levelz", href: "/levelz", label: "LEVELZ", title: "LEVELZ", icon: Crosshair },
  { key: "news", href: "/news", label: "News", title: "News", icon: BookOpen },
  { key: "socials", href: "/socials", label: "Socials", title: "Socials", icon: UsersRound },
  { key: "journal", href: "/journal", label: "Journal", title: "Journal", icon: NotebookPen },
  { key: "backtesting", href: "/backtesting", label: "Backtesting", title: "Backtesting", icon: History },
];

function preloadWorkspaceComponent(key: SidebarKey) {
  return key === "gamma"
    ? import("@/components/options-flow/GammaWorkspace")
    : key === "levelz"
      ? import("@/components/levelz/LevelzWorkspace")
      : key === "gexmap"
        ? import("@/components/gex-map/GexMapWorkspace")
        : key === "gexdesk"
          ? import("@/components/gexdesk/GexDeskWorkspace")
          : key === "gameplan"
            ? import("@/components/gameplan/GameplanWorkspace")
            : key === "kwantbot"
              ? import("@/components/kwantbot/KwantBotIntelligenceWorkspace")
              : key === "news"
                ? import("@/components/news/NewsWorkspace")
                : key === "zyon"
                  ? import("@/components/zyon/ZyonWorkspace")
                  : key === "journal"
                    ? import("@/components/journal/JournalWorkspace")
                    : Promise.resolve();
}

function ActiveUnderline() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-3 -bottom-[7px] h-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
    />
  );
}

function AppSidebar({
  activeItem,
  accountLabel = "Account",
  accountTitle = "Account",
  onAccountClick,
  onNavigateStart,
  orientation = "vertical",
}: AppSidebarProps) {
  const intentPreloadTimerRef = useRef<number | null>(null);

  const cancelIntentPreload = useCallback(() => {
    if (intentPreloadTimerRef.current === null) return;
    window.clearTimeout(intentPreloadTimerRef.current);
    intentPreloadTimerRef.current = null;
  }, []);

  const scheduleIntentPreload = useCallback((key: SidebarKey) => {
    cancelIntentPreload();
    intentPreloadTimerRef.current = window.setTimeout(() => {
      intentPreloadTimerRef.current = null;
      void preloadWorkspaceComponent(key);
    }, 220);
  }, [cancelIntentPreload]);

  useEffect(() => {
    return cancelIntentPreload;
  }, [cancelIntentPreload]);

  if (orientation === "vertical") {
    return (
      <div className="relative z-[70] w-[52px] shrink-0 self-stretch">
        <aside className="group sticky top-0 z-[70] flex h-screen w-[52px] flex-col items-center gap-1 overflow-visible border-r border-border bg-panel py-5 transition-all duration-300 hover:w-[200px]">
          <button
            type="button"
            onClick={onAccountClick}
            className={`${verticalItemInactive} mb-4`}
            title={accountTitle}
          >
            <User className="h-[18px] w-[18px] shrink-0" />
            <span className={verticalItemLabel}>{accountLabel}</span>
          </button>

          {navItems.map(({ key, href, label, title, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              onPointerEnter={() => scheduleIntentPreload(key)}
              onPointerLeave={cancelIntentPreload}
              onFocus={() => void preloadWorkspaceComponent(key)}
              onClick={() => onNavigateStart?.(key)}
              className={activeItem === key ? verticalItemActive : verticalItemInactive}
              title={title}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className={verticalItemLabel}>{label}</span>
            </Link>
          ))}

          <div className="flex-1" />

          <Link
            href="/settings"
            className={activeItem === "settings" ? verticalItemActive : verticalItemInactive}
            title="Settings"
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            <span className={verticalItemLabel}>Settings</span>
          </Link>
        </aside>
      </div>
    );
  }

  return (
    <header className="relative z-[70] flex h-14 w-full shrink-0 items-center gap-1 border-b border-border bg-panel px-3">
      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Primary workspace">
        {navItems.map(({ key, href, label, title, icon: Icon }) => {
          const active = activeItem === key;
          return (
            <Link
              key={key}
              href={href}
              prefetch
              onPointerEnter={() => scheduleIntentPreload(key)}
              onPointerLeave={cancelIntentPreload}
              onFocus={() => void preloadWorkspaceComponent(key)}
              onClick={() => onNavigateStart?.(key)}
              aria-current={active ? "page" : undefined}
              className={active ? horizontalItemActive : horizontalItemInactive}
              title={title}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted"}`} />
              <span>{label}</span>
              {active ? <ActiveUnderline /> : null}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onAccountClick}
        className={horizontalItemInactive}
        title={accountTitle}
      >
        <User className="h-4 w-4 shrink-0" />
        <span>{accountLabel}</span>
      </button>
      <Link
        href="/settings"
        prefetch
        onClick={() => onNavigateStart?.("settings")}
        className={activeItem === "settings" ? horizontalItemActive : horizontalItemInactive}
        title="Settings"
      >
        <Settings className="h-4 w-4 shrink-0" />
        <span>Settings</span>
        {activeItem === "settings" ? <ActiveUnderline /> : null}
      </Link>
    </header>
  );
}

export default memo(AppSidebar);
