import { Activity, CircleDot, Database, Waves } from "lucide-react";

import AppSidebar from "@/components/AppSidebar";

export const dynamic = "force-dynamic";

// Ported 1:1 from Kwantify's /heatmap page. The heatmap itself is the
// standalone canvas app in public/heatmap-app, mounted in an iframe exactly
// as it was there, so its rendering, controls, palettes and DOM ladder are
// unchanged. It streams the live order book from
// /api/institutional-market-data/v1/heatmap/stream, which the Rithmic
// collector serves as depth-by-order.
export default function LiqMapPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar activeItem="liqmap" />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Waves className="h-[17px] w-[17px]" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-semibold">Liquidity Heatmap</h1>
              <p className="truncate text-[10px] text-muted">
                NQ · ES · CME depth-by-order
              </p>
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

          {/* Kwantify hard-coded a SIMULATION badge here. The app reports its
              own connection state, and asserting liveness from static markup
              is exactly how a stalled feed passes for a live one. */}
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
