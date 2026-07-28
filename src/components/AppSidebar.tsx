"use client";

import Link from "next/link";
import { type ComponentType } from "react";
import {
  BarChart3,
  Settings,
  User,
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
  { key: "charts", href: "/", label: "Charts", title: "Charts", icon: BarChart3 },
];

export default function AppSidebar({
  activeItem,
  accountLabel = "Account",
  accountTitle = "Account",
  onAccountClick,
}: AppSidebarProps) {
  return (
    <div className="relative z-[70] w-[52px] shrink-0 self-stretch">
      <aside
        className="group sticky top-0 z-[70] flex h-screen w-[52px] flex-col items-center gap-1 overflow-visible border-r border-border bg-panel py-5 transition-all duration-300 hover:w-[200px]"
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

        {navItems.map(({ key, href, label, title, icon: Icon }) => (
          <Link key={key} href={href} className={activeItem === key ? itemActive : itemInactive} title={title}>
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className={itemLabel}>{label}</span>
          </Link>
        ))}

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
