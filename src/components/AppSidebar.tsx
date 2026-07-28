"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ComponentType } from "react";
import {
  ArrowRightLeft,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Repeat,
  Settings,
  Store,
  Trophy,
  User,
  Wallet,
  PlugZap,
} from "lucide-react";

type SidebarKey =
  | "ai"
  | "agent"
  | "charts"
  | "automation"
  | "connector"
  | "tradeSyncer"
  | "journal"
  | "converter"
  | "news"
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
};

const itemBase =
  "mx-auto flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-all duration-300 group-hover:w-[184px] group-hover:justify-start group-hover:gap-3 group-hover:px-[9px]";
const itemInactive = `${itemBase} text-muted hover:bg-surface hover:text-foreground`;
const itemActive = `${itemBase} bg-primary/10 text-primary`;
const itemLabel =
  "max-w-0 translate-x-[-6px] overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-all duration-300 group-hover:max-w-[132px] group-hover:translate-x-0 group-hover:opacity-100";

const navItems: Array<{
  key: Exclude<SidebarKey, "settings">;
  href: string;
  label: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "ai", href: "/ai", label: "AI Builder", title: "AI Strategy Builder", icon: Bot },
  { key: "agent", href: "/agent", label: "Trading Agent", title: "AI Trading Agent", icon: BrainCircuit },
  { key: "charts", href: "/", label: "Charts", title: "Charts", icon: BarChart3 },
  { key: "connector", href: "/connector/futures", label: "Connector", title: "Connector", icon: PlugZap },
  { key: "tradeSyncer", href: "/trade-syncer", label: "Trade Syncer", title: "Trade Syncer", icon: ArrowRightLeft },
  { key: "journal", href: "/journal", label: "Journal", title: "Journal", icon: BookOpen },
  { key: "converter", href: "/converter", label: "Converter", title: "Code Converter", icon: Repeat },
  { key: "news", href: "/news", label: "News", title: "Market Intelligence", icon: CalendarDays },
  { key: "alerts", href: "/alerts", label: "Alerts", title: "Alerts", icon: Bell },
  { key: "vault", href: "/vault", label: "Vault", title: "The Vault", icon: Store },
  { key: "leaderboard", href: "/leaderboard", label: "Leaderboard", title: "Leaderboard", icon: Trophy },
  { key: "lab", href: "/lab", label: "Lab", title: "The Strategy Lab", icon: FlaskConical },
  { key: "accounts", href: "/accounts", label: "Accounts", title: "Accounts", icon: Wallet },
];

export default function AppSidebar({
  activeItem,
  accountLabel = "Account",
  accountTitle = "Account",
  onAccountClick,
}: AppSidebarProps) {
  const pathname = usePathname();
  const connectorRouteActive = pathname.startsWith("/connector");
  const [connectorExpanded, setConnectorExpanded] = useState(connectorRouteActive);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const connectorChildren = useMemo(
    () => [
      { href: "/connector/futures", label: "Futures" },
      { href: "/connector/cfds", label: "MT5" },
    ],
    []
  );

  return (
    <div className="relative z-[70] w-[52px] shrink-0 self-stretch">
      <aside
        className="group sticky top-0 z-[70] flex h-screen w-[52px] flex-col items-center gap-1 overflow-visible border-r border-border bg-panel py-5 transition-all duration-300 hover:w-[200px]"
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
      >
        <button
          type="button"
          onClick={onAccountClick}
          className={`${itemInactive} mb-4`}
          title={accountTitle}
        >
          <User className="h-[18px] w-[18px] shrink-0" />
          <span className={itemLabel}>{accountLabel}</span>
        </button>

        {navItems.map(({ key, href, label, title, icon: Icon }) =>
          key === "connector" ? (
            <div key={key} className="w-full">
              <Link
                href="/connector/cfds"
                onClick={() => setConnectorExpanded(true)}
                className={activeItem === key ? itemActive : itemInactive}
                title={title}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className={`${itemLabel} flex items-center justify-between gap-3`}>
                  <span>{label}</span>
                  {connectorExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                </span>
              </Link>

              {(connectorExpanded || connectorRouteActive) && sidebarHovered ? (
                <div className="mt-1 space-y-1 px-2 pb-1">
                  {connectorChildren.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex h-8 items-center rounded-lg pl-[42px] pr-3 text-[12px] font-medium transition-colors ${
                          childActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted hover:bg-surface hover:text-foreground"
                        }`}
                      >
                        <span className="hidden group-hover:inline">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              key={key}
              href={href}
              className={activeItem === key ? itemActive : itemInactive}
              title={title}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className={itemLabel}>{label}</span>
            </Link>
          )
        )}

        <div className="flex-1" />

        <Link
          href="/settings"
          className={activeItem === "settings" ? itemActive : itemInactive}
          title="Settings"
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          <span className={itemLabel}>Settings</span>
        </Link>
      </aside>
    </div>
  );
}
