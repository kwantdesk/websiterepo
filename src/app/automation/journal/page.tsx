"use client";

import { useEffect, useState } from "react";
import { BookOpen, FileSearch } from "lucide-react";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { journalRows } from "@/components/automation/automationData";
import { loadJournalEvents, type AutomationJournalEvent } from "@/lib/automation";

export default function AutomationJournalPage() {
  const [events, setEvents] = useState<AutomationJournalEvent[]>([]);

  useEffect(() => {
    setEvents(loadJournalEvents());
  }, []);

  const rows =
    events.length > 0
      ? events.map((event) => ({
          time: new Date(event.time).toLocaleTimeString(),
          bot: event.bot,
          action: event.action,
          reason: event.reason,
        }))
      : journalRows;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard eyebrow="Journal" title="Execution Audit Trail">
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={`${row.time}-${row.action}`} className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] font-mono text-primary">{row.time}</div>
                <div className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted">{row.bot}</div>
              </div>
              <div className="mt-3 text-[14px] font-semibold text-foreground">{row.action}</div>
              <div className="mt-1 text-[12px] text-muted">{row.reason}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Future" title="What this needs to become">
        <div className="space-y-3">
          {[
            { icon: BookOpen, label: "Signal, risk, route, fill, and exit all linked together" },
            { icon: FileSearch, label: "Filter by bot, account, symbol, day, and rejection reason" },
            { icon: FileSearch, label: "Deep-link every event back to replay and chart context" },
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
