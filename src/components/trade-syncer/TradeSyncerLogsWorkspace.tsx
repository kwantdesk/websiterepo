"use client";

import { Suspense, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { tradeSyncerFailureModes, type TradeSyncerAccountRecord, type TradeSyncerLogEntry, type TradeSyncerSyncGroupRecord } from "@/lib/tradeSyncer";
import type { TradeSyncerFollowerRepairView } from "@/lib/tradeSyncer.server";
import { TradeSyncerSelect } from "@/components/trade-syncer/TradeSyncerControls";

const filterOptions = ["All", "Warnings", "Errors", "Follower Repair", "Venue Dispatch"] as const;

function formatOccurredAt(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function TradeSyncerLogsWorkspaceContent({
  accounts,
  followerRepairView,
  logs,
  syncGroups,
}: {
  accounts: TradeSyncerAccountRecord[];
  followerRepairView: TradeSyncerFollowerRepairView[];
  logs: TradeSyncerLogEntry[];
  syncGroups: TradeSyncerSyncGroupRecord[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const filter = filterOptions.includes((searchParams.get("filter") as typeof filterOptions[number]) ?? "All")
    ? ((searchParams.get("filter") as typeof filterOptions[number]) ?? "All")
    : "All";
  const refreshed = searchParams.get("refreshed");
  const exportFormat = searchParams.get("export");
  const selectedFollowerId = searchParams.get("follower");
  const groupMap = new Map(syncGroups.map((group) => [group.id, group.label]));
  const accountMap = new Map(accounts.map((account) => [account.id, account.label]));
  const selectedFollowerEntry =
    followerRepairView.find((item) => item.followerId === selectedFollowerId) ??
    followerRepairView.find((item) => item.healthState !== "healthy") ??
    followerRepairView[0] ??
    null;
  const selectedGroup =
    syncGroups.find((group) => group.id === selectedFollowerEntry?.groupId) ?? syncGroups[0] ?? null;
  const selectedFollowerRecord =
    selectedGroup?.followerRecords.find((follower) => follower.id === selectedFollowerEntry?.followerId) ?? null;

  const logRows = logs.map((log) => [
    formatOccurredAt(log.occurredAt),
    groupMap.get(log.groupId ?? "") ?? "Trade Syncer",
    accountMap.get(log.accountId ?? "") ?? "System",
    log.title,
    log.severity === "success" ? "Success" : log.severity === "warning" ? "Warning" : log.severity === "error" ? "Error" : "Info",
    log.detail,
  ]);
  const venueDispatchRows = logs
    .filter((log) =>
      ["dispatch_staged", "dispatch_execution_simulated", "venue_dispatch_simulated"].includes(log.status)
    )
    .slice(0, 6)
    .map((log) => ({
      id: log.id,
      time: formatOccurredAt(log.occurredAt),
      group: groupMap.get(log.groupId ?? "") ?? "Trade Syncer",
      account: accountMap.get(log.accountId ?? "") ?? "System",
      title: log.title,
      detail: log.detail,
      tone:
        log.severity === "success"
          ? ("success" as const)
          : log.severity === "warning"
            ? ("warning" as const)
            : ("error" as const),
    }));

  const filteredLogs = useMemo(() => {
    return logs.filter((log, index) => {
      const row = logRows[index];
      if (!row) return false;
      const matchesFilter =
        filter === "All"
          ? true
          : filter === "Follower Repair"
            ? row[3].toLowerCase().includes("follower") ||
              row[3].toLowerCase().includes("repair") ||
              row[5].toLowerCase().includes("follower") ||
              row[5].toLowerCase().includes("protection")
            : filter === "Venue Dispatch"
              ? ["dispatch_staged", "dispatch_execution_simulated", "venue_dispatch_simulated"].includes(log.status)
            : row[4] === filter.slice(0, -1) || row[4] === filter;
      const matchesSearch = row.join(" ").toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, logRows, logs]);

  const handleFollowerRepairAction = (
    groupId: string,
    followerId: string,
    action: "pause_follower" | "restage_follower_protection" | "mark_follower_healthy" | "flatten_follower"
  ) => {
    setActionError(null);
    setActionMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/follower-repair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId, followerId, action }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to run follower repair action.");
        }
        setActionMessage(payload.logEntry?.detail ?? "Follower repair action completed.");
        router.refresh();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Failed to run follower repair action.");
      }
    });
  };

  const handleGroupRepairAction = (
    groupId: string,
    action: "pause_group" | "restage_protection" | "mark_healthy" | "flatten_followers"
  ) => {
    setActionError(null);
    setActionMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/repair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId, action }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to run group repair action.");
        }
        setActionMessage(payload.logEntry?.detail ?? "Group repair action completed.");
        router.refresh();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Failed to run group repair action.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-panel px-6 py-6">
        <div>
          <div className="text-[24px] font-semibold tracking-tight text-foreground">Copier Logs</div>
          <div className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Watch copy events, warnings, rejects, and drift repairs in one place. This page should tell the operator what happened without needing raw debug output.
          </div>
        </div>
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/40 p-1">
          {filterOptions.map((option) => (
            <Link
              key={option}
              href={`/trade-syncer/copier-logs?filter=${encodeURIComponent(option)}`}
              className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                filter === option ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              {option}
            </Link>
          ))}
        </div>
      </section>

      {refreshed || exportFormat ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] leading-6 text-primary">
              {refreshed ? "Copier logs refreshed. New rows would stream in here once the live journal is wired." : null}
              {refreshed && exportFormat ? " " : null}
              {exportFormat ? `Export queued in ${exportFormat.toUpperCase()} format.` : null}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] leading-6 text-primary">
          {actionMessage}
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] leading-6 text-danger">
          {actionError}
        </div>
      ) : null}

      <section className="rounded-3xl border border-border bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <div className="text-[18px] font-semibold text-foreground">Copier Logs Table</div>
            <div className="mt-1 text-[12px] text-muted">This page should be the first place operators go when copy behavior looks wrong.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by ticket"
              className="w-[220px] rounded-xl border border-border bg-background/40 px-4 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted focus:border-primary/30"
            />
            <div className="w-[180px]">
              <TradeSyncerSelect label="Columns" options={["3 column(s) hidden", "All columns visible", "Hide price columns"]} />
            </div>
            <Link
              href="/trade-syncer/copier-logs?export=csv"
              className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              Export
            </Link>
            <Link
              href={`/trade-syncer/copier-logs?filter=${encodeURIComponent(filter)}&refreshed=1`}
              className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              Refresh
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto px-6 py-4">
          <table className="min-w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
              <tr className="border-b border-border">
                {["Time", "Group", "Account", "Event", "Status", "Details"].map((head) => (
                  <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, index) => {
                const row = logRows[logs.indexOf(log)] ?? [
                  formatOccurredAt(log.occurredAt),
                  groupMap.get(log.groupId ?? "") ?? "Trade Syncer",
                  accountMap.get(log.accountId ?? "") ?? "System",
                  log.title,
                  log.severity === "success" ? "Success" : log.severity === "warning" ? "Warning" : log.severity === "error" ? "Error" : "Info",
                  log.detail,
                ];
                return (
                <tr key={`${log.id}-${index}`} className="border-b border-border/60 last:border-0">
                  <td className="py-4 pr-4 text-muted">{row[0]}</td>
                  <td className="py-4 pr-4 font-medium text-foreground">{row[1]}</td>
                  <td className="py-4 pr-4 text-muted">{row[2]}</td>
                  <td className="py-4 pr-4 text-muted">{row[3]}</td>
                  <td className="py-4 pr-4 text-muted">{row[4]}</td>
                  <td className="py-4 pr-4">
                    <details className="rounded-xl border border-border bg-background/30 px-3 py-2">
                      <summary className="cursor-pointer list-none text-[12px] font-medium text-foreground">View</summary>
                      <div className="mt-3 text-[12px] leading-6 text-muted">{row[5]}</div>
                    </details>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 text-[12px] text-muted">
          <div>Showing {filteredLogs.length} rows</div>
          <div className="flex items-center gap-3">
            <div className="w-[170px]">
              <TradeSyncerSelect label="Page Size" options={["10 rows", "25 rows", "50 rows"]} />
            </div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-background/40 p-1">
              <Link href="/trade-syncer/copier-logs" className="rounded-lg px-3 py-2 text-[12px] font-medium text-muted hover:text-foreground">
                Prev
              </Link>
              <span className="rounded-lg bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary">1</span>
              <Link href="/trade-syncer/copier-logs" className="rounded-lg px-3 py-2 text-[12px] font-medium text-muted hover:text-foreground">
                Next
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-panel">
        <div className="border-b border-border px-6 py-5">
          <div className="text-[18px] font-semibold text-foreground">Venue Dispatch History</div>
          <div className="mt-1 text-[12px] text-muted">
            Master-to-follower handoff, execution simulation, and venue-shaped dispatch outcomes in one compact stream.
          </div>
        </div>
        <div className="space-y-3 px-6 py-4">
          {venueDispatchRows.length ? (
            venueDispatchRows.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{entry.title}</div>
                    <div className="mt-1 text-[12px] text-muted">
                      {entry.group} · {entry.account}
                    </div>
                  </div>
                  <div className="text-[11px] font-medium text-muted">{entry.time}</div>
                </div>
                <div className="mt-2 text-[12px] leading-6 text-muted">{entry.detail}</div>
                <div
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    entry.tone === "success"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : entry.tone === "warning"
                        ? "border-warning/30 bg-warning/10 text-warning"
                        : "border-danger/30 bg-danger/10 text-danger"
                  }`}
                >
                  {entry.tone === "success" ? "accepted path" : entry.tone === "warning" ? "review path" : "failed path"}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-[13px] leading-6 text-muted">
              No venue dispatch history yet. Stage copied orders or run a venue dispatch from Copier Engine and the handoff trail will appear here.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-panel">
        <div className="border-b border-border px-6 py-5">
          <div className="text-[18px] font-semibold text-foreground">Group Repair Queue</div>
          <div className="mt-1 text-[12px] text-muted">
            Handle group-wide pause, protection, recovery, and flatten actions before you drill into a single follower.
          </div>
        </div>
        <div className="overflow-x-auto px-6 py-4">
          <table className="min-w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
              <tr className="border-b border-border">
                {["Group", "Lead", "Status", "Repair State", "Open Positions", "Lag", "Actions"].map((head) => (
                  <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {syncGroups.map((group) => {
                const leadAccount = accounts.find((account) => account.id === group.leadAccountId);
                return (
                  <tr key={group.id} className="border-b border-border/60 last:border-0">
                    <td className="py-4 pr-4 font-medium text-foreground">{group.label}</td>
                    <td className="py-4 pr-4 text-muted">{leadAccount?.label ?? group.leadAccountId}</td>
                    <td className="py-4 pr-4 text-muted">{group.status}</td>
                    <td className="py-4 pr-4 text-muted">{group.repairState}</td>
                    <td className="py-4 pr-4 text-muted">{group.openPositions}</td>
                    <td className="py-4 pr-4 text-muted">{group.medianCopyLagMs}ms</td>
                    <td className="py-4 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleGroupRepairAction(group.id, "pause_group")}
                          disabled={isPending}
                          className="rounded-xl border border-border bg-background/40 px-3 py-1.5 text-[12px] text-foreground disabled:opacity-60"
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGroupRepairAction(group.id, "restage_protection")}
                          disabled={isPending}
                          className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-[12px] text-primary disabled:opacity-60"
                        >
                          Restage
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGroupRepairAction(group.id, "mark_healthy")}
                          disabled={isPending}
                          className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-[12px] text-primary disabled:opacity-60"
                        >
                          Healthy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGroupRepairAction(group.id, "flatten_followers")}
                          disabled={isPending}
                          className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-1.5 text-[12px] text-danger disabled:opacity-60"
                        >
                          Flatten
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-panel">
        <div className="border-b border-border px-6 py-5">
          <div className="text-[18px] font-semibold text-foreground">Follower Repair Queue</div>
          <div className="mt-1 text-[12px] text-muted">
            Focused follower-level drift state across all groups, so we can repair the exact slave that is offside.
          </div>
        </div>
        <div className="overflow-x-auto px-6 py-4">
          <table className="min-w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
              <tr className="border-b border-border">
                {["Group", "Follower", "Health", "Position", "Protection", "Current Drift", "Latest Repair", "Time", "Actions"].map((head) => (
                  <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {followerRepairView.map((item) => (
                <tr key={`${item.groupId}-${item.followerId}`} className="border-b border-border/60 last:border-0">
                  <td className="py-4 pr-4 font-medium text-foreground">{item.groupLabel}</td>
                  <td className="py-4 pr-4 text-muted">{item.accountLabel}</td>
                  <td className="py-4 pr-4 text-muted">{item.healthState}</td>
                  <td className="py-4 pr-4 text-muted">
                    {item.positionSide} {item.positionQuantity} / {item.positionState}
                  </td>
                  <td className="py-4 pr-4 text-muted">
                    {item.protectionState} / {item.protectionLegCount} leg{item.protectionLegCount === 1 ? "" : "s"}
                  </td>
                  <td className="py-4 pr-4 text-muted">{item.currentDrift ?? "No active drift"}</td>
                  <td className="py-4 pr-4 text-muted">{item.latestRepairDetail ?? "No repair actions yet"}</td>
                  <td className="py-4 pr-4 text-muted">{item.latestRepairAt ? formatOccurredAt(item.latestRepairAt) : "-"}</td>
                  <td className="py-4 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/trade-syncer/copier-logs?filter=${encodeURIComponent(filter)}&follower=${encodeURIComponent(item.followerId)}`}
                        className="rounded-xl border border-border bg-background/40 px-3 py-1.5 text-[12px] text-foreground"
                      >
                        Focus
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleFollowerRepairAction(item.groupId, item.followerId, "pause_follower")}
                        disabled={isPending}
                        className="rounded-xl border border-border bg-background/40 px-3 py-1.5 text-[12px] text-foreground disabled:opacity-60"
                      >
                        Pause
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFollowerRepairAction(item.groupId, item.followerId, "restage_follower_protection")}
                        disabled={isPending}
                        className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-[12px] text-primary disabled:opacity-60"
                      >
                        Restage
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFollowerRepairAction(item.groupId, item.followerId, "mark_follower_healthy")}
                        disabled={isPending}
                        className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-[12px] text-primary disabled:opacity-60"
                      >
                        Healthy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFollowerRepairAction(item.groupId, item.followerId, "flatten_follower")}
                        disabled={isPending}
                        className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-1.5 text-[12px] text-danger disabled:opacity-60"
                      >
                        Flatten
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedFollowerEntry && selectedFollowerRecord ? (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-border bg-panel p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[18px] font-semibold text-foreground">Focused Follower</div>
                <div className="mt-1 text-[12px] text-muted">
                  Detailed state for the follower currently selected from the repair queue.
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted">
                {selectedFollowerEntry.accountLabel}
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <div className="text-[12px] text-muted">Position State</div>
                <div className="mt-3 text-[16px] font-semibold text-foreground">
                  {selectedFollowerEntry.positionSide} {selectedFollowerEntry.positionQuantity}
                </div>
                <div className="mt-2 text-[12px] text-muted">
                  {selectedFollowerRecord.positionSnapshot.symbol} / {selectedFollowerEntry.positionState}
                </div>
                <div className="mt-2 text-[12px] text-muted">
                  Avg Entry: {selectedFollowerRecord.positionSnapshot.avgEntryPrice ?? "n/a"}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background/30 p-4">
                <div className="text-[12px] text-muted">Protection State</div>
                <div className="mt-3 text-[16px] font-semibold text-foreground">
                  {selectedFollowerEntry.protectionState}
                </div>
                <div className="mt-2 text-[12px] text-muted">
                  SL {selectedFollowerRecord.protectionSnapshot.stopLossState} / TP {selectedFollowerRecord.protectionSnapshot.takeProfitState}
                </div>
                <div className="mt-2 text-[12px] text-muted">
                  Legs: {selectedFollowerEntry.protectionLegCount} | Restaged: {selectedFollowerRecord.protectionSnapshot.lastRestagedAt ? formatOccurredAt(selectedFollowerRecord.protectionSnapshot.lastRestagedAt) : "never"}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-background/30 p-4 text-[13px] leading-6 text-muted">
              {selectedFollowerEntry.currentDrift ?? "No active drift on the focused follower."}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-panel p-6">
            <div className="text-[18px] font-semibold text-foreground">Follower Repair Timeline</div>
            <div className="mt-1 text-[12px] text-muted">
              Ordered repair history for the selected follower, newest first.
            </div>
            <div className="mt-5 space-y-3">
              {selectedFollowerRecord.repairHistory.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{entry.action}</div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">{entry.outcome}</div>
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-muted">{entry.detail}</div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted">
                    {formatOccurredAt(entry.occurredAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {tradeSyncerFailureModes.map((item) => (
          <div key={item.title} className="rounded-3xl border border-border bg-panel p-6">
            <div className="text-[16px] font-semibold text-foreground">{item.title}</div>
            <div className="mt-3 text-[12px] leading-5 text-muted">
              <span className="font-medium text-foreground">Cause:</span> {item.cause}
            </div>
            <div className="mt-2 text-[12px] leading-5 text-muted">
              <span className="font-medium text-foreground">Fix:</span> {item.fix}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function TradeSyncerLogsWorkspace(props: {
  accounts: TradeSyncerAccountRecord[];
  followerRepairView: TradeSyncerFollowerRepairView[];
  logs: TradeSyncerLogEntry[];
  syncGroups: TradeSyncerSyncGroupRecord[];
}) {
  return (
    <Suspense fallback={null}>
      <TradeSyncerLogsWorkspaceContent {...props} />
    </Suspense>
  );
}
