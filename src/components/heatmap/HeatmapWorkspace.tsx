"use client";

import { Activity, CircleDot, Database, Waves } from "lucide-react";

export default function HeatmapWorkspace() {
  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background text-foreground">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Waves className="h-[17px] w-[17px]" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-semibold">Liquidity Heatmap</h1>
              <p className="truncate text-[10px] text-muted">MNQU6 · CME · order-flow research</p>
            </div>
          </div>

          <div className="mx-1 h-5 w-px bg-border" />

          <div className="hidden items-center gap-1.5 text-[10px] text-muted md:flex">
            <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5">
              <Database className="h-3 w-3 text-primary" />
              Market depth
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5">
              <CircleDot className="h-3 w-3 text-primary" />
              Executions
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5">
              <Activity className="h-3 w-3 text-primary" />
              CVD
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[10px] font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            LIVE DEPTH
          </div>
        </header>

        <section className="min-h-0 flex-1 bg-chart-background">
          <iframe
            className="h-full w-full border-0"
            src="/heatmap-app/index.html"
            title="Kwant Desk liquidity heatmap"
          />
        </section>
      </main>
    </div>
  );
}
