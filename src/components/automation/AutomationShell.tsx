"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Cable,
  Play,
  Radar,
  Shield,
  Workflow,
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";

const tabs = [
  { href: "/automation", label: "Overview", icon: Workflow },
  { href: "/automation/execution", label: "Execution", icon: Activity },
  { href: "/automation/backtests", label: "Backtests", icon: BarChart3 },
  { href: "/automation/strategies", label: "Strategies", icon: Play },
  { href: "/automation/connections", label: "Connections", icon: Cable },
  { href: "/automation/risk", label: "Risk", icon: Shield },
  { href: "/automation/scanner", label: "Scanner", icon: Radar },
  { href: "/automation/replay", label: "Replay", icon: Play },
  { href: "/automation/journal", label: "Journal", icon: BookOpen },
];

export default function AutomationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar activeItem="automation" />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">Automation</div>
              <h1 className="mt-1 text-[24px] font-semibold tracking-tight">Execution Command Center</h1>
              <p className="mt-1 max-w-[860px] text-[13px] text-muted">
                Native automation for broker routing, risk controls, strategy runtime, market scanning,
                replay, and chart-synced execution. This is the serious operator surface that needs to
                stand on its own without connector chains.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-muted">
                Paper / Ready
              </span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                Automation Enabled
              </span>
              <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-muted transition-colors hover:text-foreground">
                <Bell className="h-4 w-4 text-primary" />
                Alerts
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">
                <Play className="h-4 w-4" />
                New Automation
              </button>
            </div>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "border border-border bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="space-y-6 p-6">{children}</div>
      </main>
    </div>
  );
}
