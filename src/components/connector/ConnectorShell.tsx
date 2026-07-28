"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Cable, CandlestickChart, Cpu, Radar, ShieldCheck, Waves } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";

const tabs = [
  { href: "/connector/futures", label: "Futures", icon: CandlestickChart },
  { href: "/connector/cfds", label: "MT5", icon: Waves },
];

export default function ConnectorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isCfds = pathname === "/connector/cfds" || pathname.startsWith("/connector/cfds/");
  const isFutures = pathname === "/connector/futures" || pathname.startsWith("/connector/futures/");

  const title = isCfds ? "MT5 Connections" : isFutures ? "Futures Connections" : "Execution Connector Layer";
  const description = isCfds
    ? "Copy a connection code, connect MT5, and manage the seat only when you need more detail."
    : isFutures
      ? "Connect direct broker lanes, route accounts, and manage futures execution health."
      : "Build the native bridge between kwantify strategies and external execution venues.";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar activeItem="connector" />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">Connector</div>
              <h1 className="mt-1 text-[24px] font-semibold tracking-tight">{title}</h1>
              <p className="mt-1 max-w-[760px] text-[13px] text-muted">{description}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
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

            {isCfds ? (
              <div className="ml-auto text-[11px] text-muted">MT5 codes first. Advanced detail only when needed.</div>
            ) : (
              <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
                  <Cable className="h-3.5 w-3.5 text-primary" />
                  Signal intake
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  Bridge logic
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Risk + auth
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
                  <Radar className="h-3.5 w-3.5 text-primary" />
                  Health + logs
                </span>
              </div>
            )}
          </div>
        </header>

        <div className="space-y-6 p-6">{children}</div>
      </main>
    </div>
  );
}
