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
  const metrics = [
    { icon: Workflow, label: "Active Bots", value: "3", detail: "2 armed, 1 paused" },
    { icon: Wallet, label: "Connected Venues", value: "3", detail: "OANDA, Tradovate, demo" },
    { icon: Activity, label: "Live Positions", value: "2", detail: "Chart-synced and bracketed" },
    { icon: Zap, label: "Signal to Route", value: "18ms", detail: "Current median dispatch latency" },
    { icon: Activity, label: "Today P&L", value: "+$160.20", detail: "Net across active runtimes" },
  ];

  return (
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
  );
}
