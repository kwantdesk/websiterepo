"use client";

import Link from "next/link";
import { memo, useEffect, type ComponentType, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Crosshair,
  History,
  Home,
  LineChart,
  NotebookPen,
  ScanLine,
  Waves,
  Settings,
  Sparkles,
  User,
  UsersRound,
  Wallet,
} from "lucide-react";
import { defaultTheme, saveTheme } from "@/lib/theme";
type SidebarKey =
  | "ai"
  | "agent"
  | "home"
  | "charts"
  | "gamma"
  | "levelz"
  | "gexmap"
  | "liqmap"
  | "heatmap"
  | "gexbot"
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
  navigationMode?: "native" | "persistent";
  onAccountClick?: () => void;
  onTradesClick?: () => void;
  onNavigateIntent?: (item: SidebarKey) => void;
  onNavigateStart?: (item: SidebarKey) => void;
  orientation?: "vertical" | "horizontal";
  tradesActive?: boolean;
};

const horizontalItemBase =
  "relative flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-[3px] border px-2.5 text-[10px] font-semibold uppercase tracking-[0.075em] transition-colors";
const horizontalItemInactive = `${horizontalItemBase} border-transparent text-muted hover:bg-surface hover:text-foreground`;
const horizontalItemActive = `${horizontalItemBase} border-transparent text-primary`;
const horizontalUtilityBase =
  "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border text-muted transition-colors";
const horizontalUtilityInactive = `${horizontalUtilityBase} border-border/70 bg-background/35 hover:border-primary/30 hover:bg-surface hover:text-foreground`;
const horizontalUtilityActive = `${horizontalUtilityBase} border-primary/35 bg-primary/[0.08] text-primary`;
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
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { key: "home", href: "/", label: "Home", title: "Home", icon: Home },
  { key: "charts", href: "/charts", label: "Charts", title: "Charts", icon: LineChart },
  { key: "gamma", href: "/gamma", label: "GAMMA", title: "Gamma", icon: BarChart3 },
  { key: "gexmap", href: "/gexmap", label: "GEX MAP", title: "GEX Map", icon: ScanLine },
  { key: "liqmap", href: "/liqmap", label: "LIQ MAP", title: "Liquidity Heatmap", icon: Waves },
  { key: "levelz", href: "/levelz", label: "LEVELZ", title: "LEVELZ", icon: Crosshair },
  { key: "gameplan", href: "/gameplan", label: "Gameplan", title: "Gameplan", icon: CalendarDays },
  { key: "zyon", href: "/zyon", label: "ZYON", title: "ZYON Trading Intelligence", icon: Sparkles },
  { key: "news", href: "/news", label: "News", title: "News", icon: BookOpen },
  { key: "socials", href: "/socials", label: "Socials", title: "Socials", icon: UsersRound },
  { key: "journal", href: "/journal", label: "Journal", title: "Journal", icon: NotebookPen },
  { key: "backtesting", href: "/backtesting", label: "Backtesting", title: "Backtesting", icon: History },
  { key: "accounts", href: "/accounts", label: "Accounts", title: "Paper and broker accounts", icon: Wallet },
];

const PERSISTENT_WORKSPACE_KEYS = new Set<SidebarKey>([
  "charts",
  "zyon",
  "gameplan",
  "gamma",
  "gexmap",
  "liqmap",
  "heatmap",
  "gexbot",
  "gexdesk",
  "levelz",
  "news",
  "socials",
  "journal",
  "backtesting",
]);

function ActiveUnderline() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-2 -bottom-[7px] h-px bg-primary shadow-[0_0_7px_var(--primary)]"
    />
  );
}

function AppSidebar({
  activeItem,
  accountLabel = "Account",
  accountTitle = "Account",
  navigationMode = "native",
  onAccountClick,
  onTradesClick,
  onNavigateIntent,
  onNavigateStart,
  orientation = "vertical",
  tradesActive = false,
}: AppSidebarProps) {
  useEffect(() => {
    const body = document.body;
    body.classList.add("kwant-cockpit-ui");

    // This is a one-time visual migration. Once applied, the normal theme
    // controls continue to own the palette and account preference sync.
    const migrationKey = "kwantdesk:midnight-cockpit-theme:v1";
    if (window.localStorage.getItem(migrationKey) !== "applied") {
      saveTheme(defaultTheme);
      window.localStorage.setItem(migrationKey, "applied");
    }

    return () => body.classList.remove("kwant-cockpit-ui");
  }, []);

  const beginNavigation = (key: SidebarKey) => {
    onNavigateStart?.(key);
  };

  const beginPointerNavigation = (
    event: ReactPointerEvent<HTMLAnchorElement>,
    key: SidebarKey,
  ) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    // Stop chart/feed work on pointer-down, before the browser waits for the
    // subsequent click. The click still owns the URL update and keyboard users
    // retain the same path through navigate().
    beginNavigation(key);
  };

  const navigate = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    key: SidebarKey,
    href: string,
  ) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    beginNavigation(key);
    if (navigationMode !== "persistent" || !PERSISTENT_WORKSPACE_KEYS.has(key)) return;

    // Every primary workspace lives inside the same persistent client shell;
    // its route page intentionally renders null. Asking Next for a new RSC
    // document on every tab click adds a network/deployment failure point for
    // no UI benefit. The native history API is integrated with App Router, so
    // usePathname still updates while the already-mounted shell switches
    // sections immediately and remains usable during feed or deploy churn.
    event.preventDefault();
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== href) window.history.pushState(null, "", href);
  };

  if (orientation === "vertical") {
    return (
      <div className="relative z-[70] w-[52px] shrink-0 self-stretch">
        <aside className="kwant-command-rail group sticky top-0 z-[70] flex h-screen w-[52px] flex-col items-center gap-1 overflow-visible border-r border-border bg-panel py-3 transition-all duration-300 hover:w-[200px]">
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
              prefetch={false}
              onPointerEnter={() => onNavigateIntent?.(key)}
              onPointerDown={(event) => beginPointerNavigation(event, key)}
              onFocus={() => onNavigateIntent?.(key)}
              onClick={(event) => navigate(event, key, href)}
              className={activeItem === key ? verticalItemActive : verticalItemInactive}
              title={title}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className={verticalItemLabel}>{label}</span>
            </Link>
          ))}

          <div className="flex-1" />

          <a
            href="/settings"
            className={activeItem === "settings" ? verticalItemActive : verticalItemInactive}
            title="Settings"
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            <span className={verticalItemLabel}>Settings</span>
          </a>
        </aside>
      </div>
    );
  }

  return (
    <header className="kwant-command-rail relative z-[70] flex w-full shrink-0 items-center border-b border-border bg-panel px-2">
      <nav className="kwant-primary-workspace-nav absolute inset-y-0 flex items-center overflow-x-auto overflow-y-clip" aria-label="Primary workspace">
        <div className="kwant-primary-workspace-nav-track flex min-w-max items-center gap-1">
          {navItems.map(({ key, href, label, title, icon: Icon }) => {
            const active = activeItem === key;
            return (
              <Link
                key={key}
                href={href}
                prefetch={false}
                onPointerEnter={() => onNavigateIntent?.(key)}
                onPointerDown={(event) => beginPointerNavigation(event, key)}
                onFocus={() => onNavigateIntent?.(key)}
                onClick={(event) => navigate(event, key, href)}
                aria-current={active ? "page" : undefined}
                className={active ? horizontalItemActive : horizontalItemInactive}
                title={title}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted"}`} strokeWidth={1.55} />
                <span>{label}</span>
                {active ? <ActiveUnderline /> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onTradesClick}
          className={tradesActive ? horizontalItemActive : horizontalItemInactive}
          title="Trade"
          aria-label="Open trade menu"
          aria-expanded={tradesActive}
        >
          <BarChart3 className={`h-3.5 w-3.5 shrink-0 ${tradesActive ? "text-primary" : "text-muted"}`} strokeWidth={1.55} />
          <span>TRADE</span>
          {tradesActive ? <ActiveUnderline /> : null}
        </button>
        <button
          type="button"
          onClick={onAccountClick}
          className={horizontalUtilityInactive}
          title={accountTitle}
          aria-label={accountTitle}
        >
          <User className="h-3.5 w-3.5" strokeWidth={1.55} />
        </button>
        <a
          href="/settings"
          className={activeItem === "settings" ? horizontalUtilityActive : horizontalUtilityInactive}
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={1.55} />
          {activeItem === "settings" ? <ActiveUnderline /> : null}
        </a>
      </div>
    </header>
  );
}

export default memo(AppSidebar);
