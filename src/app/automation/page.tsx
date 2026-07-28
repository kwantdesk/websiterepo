"use client";

import { Clock3 } from "lucide-react";
import AutomationChartWorkspace from "@/components/automation/AutomationChartWorkspace";
import { AutomationMetricsRow, SectionCard } from "@/components/automation/AutomationPrimitives";
import {
  automations,
  infrastructurePanels,
  operatorPanels,
  ribbonItems,
  runtimeLog,
} from "@/components/automation/automationData";

export default function AutomationOverviewPage() {
  return (
    <>
      <SectionCard eyebrow="Platform" title="Automation Operator Ribbon">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {ribbonItems.map(({ label, detail, icon: Icon }) => (
            <button
              key={label}
              className="rounded-2xl border border-border bg-surface/60 p-4 text-left transition-colors hover:bg-surface"
            >
              <div className="flex items-center gap-2 text-muted">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</span>
              </div>
              <div className="mt-3 text-[14px] font-medium text-foreground">{label}</div>
              <div className="mt-1 text-[12px] text-muted">{detail}</div>
            </button>
          ))}
        </div>
      </SectionCard>

      <AutomationMetricsRow />

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <AutomationChartWorkspace />

        <div className="space-y-6">
          <SectionCard eyebrow="Runtime" title="Automation Programs">
            <div className="space-y-3">
              {automations.map((item) => (
                <div
                  key={item.name}
                  className="grid gap-3 rounded-2xl border border-border bg-surface/60 p-4 md:grid-cols-[1.4fr_0.8fr_0.7fr_0.6fr]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      <div className="text-[14px] font-semibold text-foreground">{item.name}</div>
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {item.market} • {item.broker}
                    </div>
                    <div className="mt-2 text-[12px] text-muted">{item.lastEvent}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-panel px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Mode</div>
                    <div className="mt-2 text-[14px] font-medium text-foreground">{item.mode}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-panel px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">State</div>
                    <div className={`mt-2 text-[14px] font-medium ${item.stateTone}`}>{item.state}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-panel px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Latency</div>
                    <div className="mt-2 text-[14px] font-medium text-foreground">{item.latency}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Platform" title="NT8-Class Surfaces We Need">
            <div className="grid gap-3 sm:grid-cols-2">
              {operatorPanels.map(({ title, detail, value, icon: Icon }) => (
                <div key={title} className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex items-center gap-2 text-muted">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{title}</span>
                  </div>
                  <div className="mt-3 text-[14px] font-medium text-foreground">{value}</div>
                  <div className="mt-1 text-[12px] text-muted">{detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <SectionCard
          eyebrow="Logs"
          title="Execution Timeline"
          action={
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-muted">
              <Clock3 className="h-4 w-4 text-primary" />
              Last 5 events
            </div>
          }
        >
          <div className="rounded-2xl border border-border bg-background p-4 font-mono text-[12px] leading-6 text-muted">
            {runtimeLog.map((entry) => (
              <div key={entry} className="border-b border-border/60 py-2 last:border-b-0">
                {entry}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Infrastructure" title="Data, Runtime, and Connection Health">
          <div className="grid gap-3">
            {infrastructurePanels.map(({ label, detail, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center gap-2 text-muted">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</span>
                </div>
                <div className="mt-3 text-[13px] leading-6 text-foreground">{detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
