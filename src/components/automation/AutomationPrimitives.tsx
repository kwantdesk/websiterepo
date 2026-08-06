"use client";

import type { ComponentType, ReactNode } from "react";
import { Activity, Wallet, Workflow, Zap } from "lucide-react";

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="text-[26px] font-semibold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-[12px] text-muted">{detail}</div>
    </div>
  );
}

export function SectionCard({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-panel ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{eyebrow}</div>
          <h2 className="mt-1 text-[16px] font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function AutomationMetricsRow() {
  // Illustrative placeholders only. No live automation runtime is wired to
  // this row yet, so it must say so — invented account state presented as
  // real is never acceptable.
  const metrics = [
    { icon: Workflow, label: "Active Bots", value: "3", detail: "Illustrative preview" },
    { icon: Wallet, label: "Connected Venues", value: "3", detail: "Illustrative preview" },
    { icon: Activity, label: "Live Positions", value: "2", detail: "Illustrative preview" },
    { icon: Zap, label: "Signal to Route", value: "18ms", detail: "Illustrative preview" },
    { icon: Activity, label: "Today P&L", value: "+$160.20", detail: "Illustrative preview" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <span className="rounded-full border border-amber-400/40 bg-amber-950/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300">
          Illustrative preview · Not live account data
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
          />
        ))}
      </div>
    </div>
  );
}
