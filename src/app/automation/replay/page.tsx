"use client";

import { PlayCircle, TimerReset } from "lucide-react";
import AutomationChartWorkspace from "@/components/automation/AutomationChartWorkspace";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { replaySessions } from "@/components/automation/automationData";

export default function AutomationReplayPage() {
  return (
    <>
      <AutomationChartWorkspace title="Replay Workspace" eyebrow="Replay" compact />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard eyebrow="Replay" title="Playback Sessions">
          <div className="space-y-3">
            {replaySessions.map((session) => (
              <div key={session.name} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-foreground">{session.name}</div>
                    <div className="mt-1 text-[12px] text-muted">{session.market} • {session.mode}</div>
                  </div>
                  <button className="rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-on-primary">Open</button>
                </div>
                <div className="mt-3 text-[12px] text-muted">{session.detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Purpose" title="Replay Needs">
          <div className="space-y-3">
            {[
              { icon: PlayCircle, label: "Historical playback with live-feel execution state" },
              { icon: TimerReset, label: "Trade-by-trade review with bot decisions on chart" },
              { icon: PlayCircle, label: "Strategy debug and forward-test parity" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3 text-[13px] text-foreground">
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
