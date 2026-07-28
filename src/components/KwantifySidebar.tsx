"use client";

import { useState, type ComponentType } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  CandlestickChart,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";

export type DeskView = "overview" | "flow" | "watchlists" | "research" | "signals" | "journal" | "lab" | "alerts" | "accounts" | "settings";

type NavItem = { key: Exclude<DeskView, "settings">; label: string; title: string; icon: ComponentType<{ className?: string }> };

const navItems: NavItem[] = [
  { key: "overview", label: "Overview", title: "Overview", icon: LayoutDashboard },
  { key: "flow", label: "Options Flow", title: "Options Flow", icon: CandlestickChart },
  { key: "watchlists", label: "Watchlists", title: "Watchlists", icon: BarChart3 },
  { key: "research", label: "Research", title: "Research", icon: BrainCircuit },
  { key: "signals", label: "Signals", title: "Signals", icon: Sparkles },
  { key: "journal", label: "Journal", title: "Journal", icon: BookOpen },
  { key: "lab", label: "Strategy Lab", title: "Strategy Lab", icon: FlaskConical },
  { key: "alerts", label: "Alerts", title: "Alerts", icon: Bell },
  { key: "accounts", label: "Accounts", title: "Accounts", icon: Wallet },
];

const itemBase = "mx-auto flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-all duration-300 group-hover:w-[184px] group-hover:justify-start group-hover:gap-3 group-hover:px-[9px]";
const itemInactive = `${itemBase} text-muted hover:bg-surface hover:text-foreground`;
const itemActive = `${itemBase} bg-primary/10 text-primary`;
const itemLabel = "max-w-0 translate-x-[-6px] overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-all duration-300 group-hover:max-w-[132px] group-hover:translate-x-0 group-hover:opacity-100";

export default function KwantifySidebar({ activeItem, email, onSelect, onSettings }: { activeItem: DeskView; email: string; onSelect: (view: DeskView) => void; onSettings: () => void }) {
  const [researchExpanded, setResearchExpanded] = useState(false);

  return (
    <div className="relative z-[70] w-[52px] shrink-0 self-stretch">
      <aside className="group sticky top-0 z-[70] flex h-screen w-[52px] flex-col items-center gap-1 overflow-visible border-r border-border bg-panel py-5 transition-all duration-300 hover:w-[200px]">
        <button type="button" onClick={onSettings} className={`${itemInactive} mb-4`} title={email}>
          <User className="h-[18px] w-[18px] shrink-0" />
          <span className={itemLabel}>{email}</span>
        </button>

        {navItems.map(({ key, label, title, icon: Icon }) => key === "research" ? (
          <div key={key} className="w-full">
            <button type="button" onClick={() => { onSelect(key); setResearchExpanded((open) => !open); }} className={activeItem === key ? itemActive : itemInactive} title={title}>
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className={`${itemLabel} flex items-center justify-between gap-3`}><span>{label}</span>{researchExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}</span>
            </button>
            {researchExpanded ? <div className="mt-1 space-y-1 px-2 pb-1"><button onClick={() => onSelect("research")} className="flex h-8 w-full items-center rounded-lg pl-[42px] pr-3 text-left text-[12px] font-medium text-muted hover:bg-surface hover:text-foreground"><span className="hidden group-hover:inline">Market notes</span></button><button onClick={() => onSelect("research")} className="flex h-8 w-full items-center rounded-lg pl-[42px] pr-3 text-left text-[12px] font-medium text-muted hover:bg-surface hover:text-foreground"><span className="hidden group-hover:inline">Trade ideas</span></button></div> : null}
          </div>
        ) : (
          <button type="button" key={key} onClick={() => onSelect(key)} className={activeItem === key ? itemActive : itemInactive} title={title}>
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className={itemLabel}>{label}</span>
          </button>
        ))}

        <div className="flex-1" />
        <button type="button" onClick={onSettings} className={activeItem === "settings" ? itemActive : itemInactive} title="Settings"><Settings className="h-[18px] w-[18px] shrink-0" /><span className={itemLabel}>Settings</span></button>
        <form action="/auth/signout" method="post" className="w-full"><button type="submit" className={itemInactive} title="Sign out"><Search className="h-[18px] w-[18px] shrink-0 rotate-90" /><span className={itemLabel}>Sign out</span></button></form>
      </aside>
    </div>
  );
}
