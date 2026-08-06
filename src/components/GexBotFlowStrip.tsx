"use client";

import { ChevronDown, ChevronUp, Radio, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";

import type { GexBotFlowPayload } from "@/lib/gexBotFlow";

function compact(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function freshness(payload: GexBotFlowPayload) {
  if (payload.status === "LIVE") return "LIVE 60s";
  if (payload.status === "STALE") return `STALE ${Math.max(0, Math.round((payload.dataAgeMs ?? 0) / 1_000))}s`;
  if (payload.status === "FROZEN") {
    return `FROZEN ${payload.freezeTime ? new Date(payload.freezeTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "close"}`;
  }
  return "FLOW UNAVAILABLE";
}

export default function GexBotFlowStrip({ payload }: { payload: GexBotFlowPayload }) {
  const [expanded, setExpanded] = useState(false);
  const tooltip = useMemo(() => [
    `Convexity ${compact(payload.convexity.value)}`,
    `Call DEX ${compact(payload.dexLean.call)}`,
    `Put DEX ${compact(payload.dexLean.put)}`,
    `Net DEX ${compact(payload.dexLean.net)}`,
    `Charm ${compact(payload.clock.charm)}`,
    `Vanna ${compact(payload.clock.vanna)}`,
    `Data age ${payload.dataAgeMs === null ? "unavailable" : `${Math.round(payload.dataAgeMs / 1_000)}s`}`,
    payload.signConvention,
  ].join(" · "), [payload]);

  return (
    <div className="pointer-events-auto absolute bottom-2 left-1/2 z-[24] max-w-[calc(100%-150px)] -translate-x-1/2 font-mono text-[8px] text-muted">
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); setExpanded((current) => !current); }}
        title={tooltip}
        className="flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-border bg-panel/92 px-2.5 py-1 shadow-lg shadow-black/25 backdrop-blur transition-colors hover:border-primary/30"
      >
        {payload.status === "LIVE" ? <Radio className="h-2.5 w-2.5 shrink-0 animate-pulse text-primary" /> : <Snowflake className="h-2.5 w-2.5 shrink-0 text-muted" />}
        <span className="shrink-0 font-semibold text-foreground">Flow</span>
        <span className="truncate">{payload.convexity.label} <span className="text-foreground">{compact(payload.convexity.value)}</span></span>
        <span className="hidden shrink-0 md:inline">· {payload.dexLean.label}</span>
        <span className="hidden shrink-0 lg:inline">· {payload.clock.label}</span>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-semibold ${payload.status === "LIVE" ? "bg-primary/12 text-primary" : payload.status === "STALE" ? "bg-warning/12 text-warning" : "bg-surface text-muted"}`}>{freshness(payload)}</span>
        {expanded ? <ChevronDown className="h-2.5 w-2.5 shrink-0" /> : <ChevronUp className="h-2.5 w-2.5 shrink-0" />}
      </button>
      {expanded ? (
        <div className="absolute bottom-full left-1/2 mb-2 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl border border-border bg-panel/96 p-3 shadow-2xl backdrop-blur">
          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
            <span>Convexity</span><span className="text-right text-foreground">{payload.convexity.label} · {compact(payload.convexity.value)}</span>
            <span>Session dex lean</span><span className="text-right text-foreground">{payload.dexLean.label}</span>
            <span>Clock</span><span className="text-right text-foreground">{payload.clock.label}</span>
            <span>Window</span><span className="text-right text-foreground">{payload.windowSamples}/20 samples</span>
            <span>Freshness</span><span className="text-right text-foreground">{freshness(payload)}</span>
          </div>
          <div className="mt-3 border-t border-border pt-2">
            <div className="font-semibold text-foreground">Recent pushes</div>
            <div className="mt-1.5 space-y-1">
              {payload.sponsorship.recent.length ? payload.sponsorship.recent.map((verdict) => (
                <div key={verdict.id} className="flex items-center justify-between gap-3">
                  <span className={verdict.state === "SPONSORED" ? "text-primary" : "text-warning"}>{verdict.label}</span>
                  <span>{(verdict.priceChangePercent * 100).toFixed(3)}% · ΔDEX {compact(verdict.dexChange)}</span>
                </div>
              )) : <span>{payload.sponsorship.state === "WARMING_UP" ? "warming up — five samples required" : "No qualifying push in the current window"}</span>}
            </div>
          </div>
          {payload.restrikes.length ? (
            <div className="mt-3 border-t border-border pt-2">
              <div className="font-semibold text-foreground">Map changes</div>
              <div className="mt-1.5 space-y-1">{payload.restrikes.map((notice) => (
                <div
                  key={notice.id}
                  title="A re-strike moving with the active push confirms sponsorship; a re-strike moving against it means stand down."
                >
                  {notice.label}
                </div>
              ))}</div>
            </div>
          ) : null}
          <div className="mt-3 border-t border-border pt-2 text-[7px] leading-3.5">{payload.signConvention}</div>
        </div>
      ) : null}
    </div>
  );
}
