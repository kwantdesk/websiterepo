import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  tradeSyncerConnectionLanes,
  tradeSyncerFailureModes,
} from "@/lib/tradeSyncer";
import type { TradeSyncerOverview } from "@/lib/tradeSyncer.server";

const quickSetup = [
  { label: "Connect broker accounts", href: "/trade-syncer/accounts" },
  { label: "Create the lead copier", href: "/trade-syncer/copier-engine" },
  { label: "Attach followers and set sizing", href: "/trade-syncer/copier-engine" },
  { label: "Run a safe test before going live", href: "/trade-syncer/copier-logs" },
];

function toneClasses(tone: "good" | "warn" | "danger") {
  if (tone === "good") return "border-primary/30 bg-primary/10 text-primary";
  if (tone === "warn") return "border-warning/30 bg-warning/10 text-warning";
  return "border-danger/30 bg-danger/10 text-danger";
}

function statusClasses(status: string) {
  return status === "Enabled"
    ? "border-primary/30 bg-primary/10 text-primary"
    : "border-warning/30 bg-warning/10 text-warning";
}

function formatOccurredAt(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function toDisplayVenue(venue: string) {
  if (venue === "metatrader5") return "MetaTrader 5";
  return venue.charAt(0).toUpperCase() + venue.slice(1);
}

function toDisplayGroupStatus(status: string) {
  return status
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export default function TradeSyncerWorkspace({ overview }: { overview: TradeSyncerOverview }) {
  const accountMap = new Map(overview.accounts.map((account) => [account.id, account]));
  const venueDispatchHistory = overview.logs
    .filter((log) =>
      ["dispatch_staged", "dispatch_execution_simulated", "venue_dispatch_simulated"].includes(log.status)
    )
    .slice(0, 4)
    .map((log) => {
      const group = overview.syncGroups.find((item) => item.id === log.groupId);
      return {
        id: log.id,
        time: formatOccurredAt(log.occurredAt),
        group: group?.label ?? "Trade Syncer",
        title: log.title,
        detail: log.detail,
        tone:
          log.severity === "success"
            ? ("good" as const)
            : log.severity === "warning"
              ? ("warn" as const)
              : ("danger" as const),
      };
    });
  const syncGroups = overview.syncGroups.map((group) => {
    const leadAccount = accountMap.get(group.leadAccountId);
    const firstFollower = group.followerRecords[0];

    return {
      name: group.label,
      lead: leadAccount?.label ?? "Unknown lead",
      followers: `${group.followerRecords.length} follower${group.followerRecords.length === 1 ? "" : "s"}`,
      risk: firstFollower ? `${firstFollower.riskType} / ${firstFollower.riskSetting}` : "No follower sizing yet",
      status: toDisplayGroupStatus(group.status),
    };
  });

  const connectedAccounts = overview.accounts.slice(0, 4).map((account) => [
    account.label,
    account.brokerAccountRef,
    toDisplayVenue(account.venue),
    account.connectionState === "connected" ? "Connected" : account.connectionState === "needs_reauth" ? "Needs Re-auth" : "Review",
  ]);

  const recentLogs = overview.logs.slice(0, 3).map((log) => {
    const group = overview.syncGroups.find((item) => item.id === log.groupId);
    return {
      time: formatOccurredAt(log.occurredAt),
      group: group?.label ?? "Trade Syncer",
      message: log.title,
      tone: log.severity === "success" ? ("good" as const) : log.severity === "warning" ? ("warn" as const) : ("danger" as const),
    };
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-panel px-6 py-6">
        <div>
          <div className="text-[24px] font-semibold tracking-tight text-foreground">Dashboard</div>
          <div className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            See copier health, active sync groups, recent drift events, and the linked accounts that matter right now.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/trade-syncer/copier-logs"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            <Bell className="h-4 w-4 text-primary" />
            Copier Alerts
          </Link>
          <Link
            href="/trade-syncer/copier-engine"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-on-primary"
          >
            <Plus className="h-4 w-4" />
            Add Master Copier
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.dashboardMetrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border bg-panel px-5 py-4">
            <div className="text-[12px] text-muted">{metric.label}</div>
            <div className="mt-4 text-[24px] font-semibold text-foreground">{metric.value}</div>
            <div className="mt-2 text-[12px] text-muted">{metric.detail}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-3xl border border-border bg-panel">
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <div>
              <div className="flex items-center gap-2 text-[18px] font-semibold text-foreground">
                <Activity className="h-5 w-5 text-primary" />
                Copier Overview
              </div>
              <div className="mt-1 text-[12px] text-muted">A compact health summary, closer to the Traders Connect rhythm.</div>
            </div>
            <Link
              href="/trade-syncer/copier-engine"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-[13px] font-medium text-primary"
            >
              Manage
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {overview.copierMetrics.map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-background/40 px-4 py-4">
                <div className="text-[12px] text-muted">{item.label}</div>
                <div className="mt-4 text-[20px] font-semibold text-foreground">{item.value}</div>
                <div className="mt-2 text-[12px] text-muted">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-panel p-6">
          <div className="flex items-center gap-2 text-[18px] font-semibold text-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Quick Setup
          </div>
          <div className="mt-1 text-[12px] text-muted">Keep the operator flow obvious and safe.</div>

          <div className="mt-5 space-y-3">
            {quickSetup.map((item, index) => (
              <Link key={item.label} href={item.href} className="flex items-start gap-3 rounded-2xl border border-border bg-background/40 px-4 py-3 transition-colors hover:border-primary/30">
                <div className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {index + 1}
                </div>
                <div className="text-[13px] text-foreground">{item.label}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-3xl border border-border bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
            <div>
              <div className="text-[18px] font-semibold text-foreground">Trade Copiers</div>
              <div className="mt-1 text-[12px] text-muted">Lead and follower groups in one clean table instead of scattered cards.</div>
            </div>
            <Link
              href="/trade-syncer/copier-engine"
              className="rounded-xl border border-border bg-background/40 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              Open Copier Engine
            </Link>
          </div>

          <div className="overflow-x-auto px-6 py-4">
            <table className="min-w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                <tr className="border-b border-border">
                  <th className="pb-3 pr-4 font-medium">Group</th>
                  <th className="pb-3 pr-4 font-medium">Lead</th>
                  <th className="pb-3 pr-4 font-medium">Followers</th>
                  <th className="pb-3 pr-4 font-medium">Risk</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {syncGroups.map((group) => (
                  <tr key={group.name} className="border-b border-border/60 last:border-0">
                    <td className="py-4 pr-4 font-medium text-foreground">{group.name}</td>
                    <td className="py-4 pr-4 text-muted">{group.lead}</td>
                    <td className="py-4 pr-4 text-muted">{group.followers}</td>
                    <td className="py-4 pr-4 text-muted">{group.risk}</td>
                    <td className="py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClasses(group.status)}`}>
                        {group.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <div className="text-[18px] font-semibold text-foreground">Dispatch Handoff</div>
                <div className="mt-1 text-[12px] text-muted">
                  The last few master-to-follower dispatch passes, so operators can tell whether copy flow is only staged, simulated, or venue-shaped.
                </div>
              </div>
              <Link
                href="/trade-syncer/copier-logs?filter=Venue%20Dispatch"
                className="rounded-xl border border-border bg-background/40 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                View Dispatch Logs
              </Link>
            </div>
            <div className="space-y-3 px-6 py-4">
              {venueDispatchHistory.length ? (
                venueDispatchHistory.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{entry.title}</div>
                        <div className="mt-1 text-[12px] text-muted">{entry.group}</div>
                      </div>
                      <div className="text-[11px] font-medium text-muted">{entry.time}</div>
                    </div>
                    <div className="mt-2 text-[12px] leading-6 text-muted">{entry.detail}</div>
                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClasses(entry.tone)}`}>
                      {entry.tone === "good" ? "accepted path" : entry.tone === "warn" ? "review path" : "failed path"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-[13px] leading-6 text-muted">
                  No dispatch handoff history yet. Run a stage, execution simulation, or venue dispatch from Copier Engine and it will show up here.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <div className="text-[18px] font-semibold text-foreground">Recent Copier Logs</div>
                <div className="mt-1 text-[12px] text-muted">Recent copy events and the first warning signals.</div>
              </div>
              <Link
                href="/trade-syncer/copier-logs"
                className="rounded-xl border border-border bg-background/40 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                View Logs
              </Link>
            </div>
            <div className="space-y-3 px-6 py-4">
              {recentLogs.map((log) => (
                <div key={`${log.time}-${log.message}`} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{log.message}</div>
                      <div className="mt-1 text-[12px] text-muted">{log.group}</div>
                    </div>
                    <div className="text-[11px] font-medium text-muted">{log.time}</div>
                  </div>
                  <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClasses(log.tone)}`}>
                    {log.tone === "good" ? "success" : log.tone === "warn" ? "warning" : "manual review"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <div className="text-[18px] font-semibold text-foreground">Connected Accounts</div>
                <div className="mt-1 text-[12px] text-muted">Quick account inventory without leaving the dashboard.</div>
              </div>
              <Link
                href="/trade-syncer/accounts"
                className="rounded-xl border border-border bg-background/40 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                Open Accounts
              </Link>
            </div>
            <div className="overflow-x-auto px-6 py-4">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Account</th>
                    <th className="pb-3 pr-4 font-medium">Venue</th>
                    <th className="pb-3 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {connectedAccounts.map((row) => (
                    <tr key={row[1]} className="border-b border-border/60 last:border-0">
                      {row.map((cell, index) => (
                        <td key={`${row[1]}-${index}`} className="py-4 pr-4 text-muted first:font-medium first:text-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-3xl border border-border bg-panel p-6">
          <div className="flex items-center gap-2 text-[18px] font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Follower Protection
          </div>
          <div className="mt-4 space-y-3">
            {tradeSyncerFailureModes.slice(0, 3).map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                  <div>
                    <div className="font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-[12px] leading-5 text-muted">{item.fix}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-panel p-6">
          <div className="text-[18px] font-semibold text-foreground">Supported Lanes</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {tradeSyncerConnectionLanes.slice(0, 4).map((lane) => (
              <div key={lane.venue} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-foreground">{lane.venue}</div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      lane.status === "ready"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : lane.status === "planned"
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-border bg-surface text-muted"
                    }`}
                  >
                    {lane.status}
                  </span>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted">{lane.summary}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
