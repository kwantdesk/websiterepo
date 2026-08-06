"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRightLeft, Sparkles } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";

const tabs = [
  { href: "/trade-syncer/dashboard", label: "Dashboard", blurb: "Copier overview and summary metrics" },
  { href: "/trade-syncer/accounts", label: "Accounts", blurb: "Connected account inventory and controls" },
  { href: "/trade-syncer/account-trades", label: "Account Trades", blurb: "Open and closed trade review" },
  { href: "/trade-syncer/copier-engine", label: "Copier Engine", blurb: "Lead/follower groups and routing" },
  { href: "/trade-syncer/templates", label: "Templates", blurb: "Reusable copy policies and presets" },
  { href: "/trade-syncer/copier-logs", label: "Copier Logs", blurb: "Copy events, warnings, and drift actions" },
  { href: "/trade-syncer/integrations", label: "Integrations", blurb: "Venue support and premium rails" },
] as const;

export default function TradeSyncerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar activeItem="tradeSyncer" />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-6 py-5 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">Trade Syncer</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                  <ArrowRightLeft className="h-4 w-4 text-primary" />
                  Multi-account copy trading workspace
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Retail operator view
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="inline-flex min-w-max items-center gap-1.5 rounded-2xl border border-border bg-panel/80 p-1.5">
              {tabs.map((tab) => {
                const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`rounded-xl px-3.5 py-2 text-[12px] font-medium transition-colors ${
                      active
                        ? "bg-primary text-background shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                        : "text-muted hover:bg-background/70 hover:text-foreground"
                    }`}
                    title={tab.blurb}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </header>

        <div className="space-y-6 p-6">
          {/* The copier backend is not a live broker-copy engine yet: every
              account, balance, position and log on these pages comes from the
              seeded demonstration store. That must be visible on every tab. */}
          <div className="rounded-2xl border border-amber-400/40 bg-amber-950/30 px-4 py-3 text-[13px] text-amber-200">
            <span className="font-semibold uppercase tracking-[0.08em]">Seeded preview</span>
            {" — accounts, balances, positions and copier activity shown here are demonstration data. No live broker connection is active."}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
