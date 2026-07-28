"use client";

import { Search, Star, TableProperties } from "lucide-react";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { scannerRows } from "@/components/automation/automationData";

export default function AutomationScannerPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard eyebrow="Scanner" title="Market Analyzer">
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.6fr_1.2fr] border-b border-border bg-surface/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            <div>Symbol</div>
            <div>Venue</div>
            <div>Regime</div>
            <div>Score</div>
            <div>Alert</div>
          </div>
          {scannerRows.map((row) => (
            <div key={row.symbol} className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.6fr_1.2fr] border-b border-border bg-panel px-4 py-3 text-[13px] last:border-b-0">
              <div className="font-semibold text-foreground">{row.symbol}</div>
              <div className="text-muted">{row.venue}</div>
              <div className="text-muted">{row.regime}</div>
              <div className="text-primary">{row.score}</div>
              <div className="text-muted">{row.alert}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Why it matters" title="Missing Scanner Workflow">
        <div className="space-y-3">
          {[
            { icon: Search, label: "Symbol search and instant chart switch" },
            { icon: Star, label: "Watchlists, sections, favorites, and sync" },
            { icon: TableProperties, label: "Custom columns, sorting, filters, and alerts" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3 text-[13px] text-foreground">
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
