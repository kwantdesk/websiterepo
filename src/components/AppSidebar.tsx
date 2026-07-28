"use client";

import Link from "next/link";
import { type ComponentType } from "react";
import {
  Home,
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
  orientation?: "vertical" | "horizontal";
};

const horizontalItemBase =
  "flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-[12px] font-medium transition-colors";
const horizontalItemInactive = `${horizontalItemBase} text-muted hover:bg-surface hover:text-foreground`;
const horizontalItemActive = `${horizontalItemBase} bg-primary/10 text-primary`;
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
  { key: "charts", href: "/", label: "Home", title: "Home", icon: Home },
];

export default function AppSidebar({
  activeItem,
  accountLabel = "Account",
  accountTitle = "Account",
  onAccountClick,
  orientation = "vertical",
}: AppSidebarProps) {
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
            <Link key={key} href={href} className={activeItem === key ? verticalItemActive : verticalItemInactive} title={title}>
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
    <header className="relative z-[70] flex h-11 w-full shrink-0 items-center gap-1 border-b border-border bg-panel px-3">
      <button
        type="button"
        onClick={onAccountClick}
        className={horizontalItemInactive}
        title={accountTitle}
      >
        <User className="h-4 w-4 shrink-0" />
        <span>{accountLabel}</span>
      </button>

      {navItems.map(({ key, href, label, title, icon: Icon }) => (
        <Link key={key} href={href} className={activeItem === key ? horizontalItemActive : horizontalItemInactive} title={title}>
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </Link>
      ))}

      <div className="flex-1" />

      <Link
        href="/settings"
        className={activeItem === "settings" ? horizontalItemActive : horizontalItemInactive}
        title="Settings"
      >
        <Settings className="h-4 w-4 shrink-0" />
        <span>Settings</span>
      </Link>
    </header>
  );
}
