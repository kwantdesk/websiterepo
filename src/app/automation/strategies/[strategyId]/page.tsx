"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Database,
  Radio,
  RefreshCcw,
  Shield,
  Zap,
} from "lucide-react";
import AutomationChartWorkspace from "@/components/automation/AutomationChartWorkspace";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import type { ChartLevel } from "@/components/Chart";

type RuntimePayload = {
  ok: boolean;
  profile: {
    id: string;
    slug: string;
    label: string;
    market: string;
    version: string;
    summary: string;
  };
  source: string;
  bridge_status: "ready" | "unavailable";
  strategy: null | {
    id: string;
    label: string;
    version: string;
    enabled: boolean;
    live: boolean;
  };
  snapshot: null | {
    generated_at: string;
    poll_seconds: number;
    kill_switch_armed: boolean;
    mode: string;
    stats: {
      trade_count: number;
      day_pnl: number;
      win_rate: number;
      profit_factor: number;
      net_profit: number;
    };
    active_position: null | {
      side?: string;
      symbol?: string;
      state?: string;
      entry?: string;
      stop?: string;
      target?: string;
      size?: string;
    };
    last_closed_execution: null | {
      symbol?: string;
      exit_pnl?: number;
      exit_price?: number;
      closed_at?: string;
    };
    mailbox?: {
      available?: boolean;
      pending_count?: number;
      claimed_count?: number;
      worker_status?: string | null;
      worker_health_state?: string | null;
      worker_id?: string | null;
      worker_last_heartbeat_at?: string | null;
    };
    health: Array<{ label: string; value: string; status: string }>;
    health_rules?: {
      poll_seconds?: number;
      journal_watch_seconds?: number;
      worker_stale_seconds?: number;
      bridge_stale_seconds?: number;
      producer_stale_seconds?: number;
      runner_stale_seconds?: number;
      bar_stale_seconds?: number;
      bridge_heartbeat_seconds?: number | null;
    };
    equity_curve: Array<{ timestamp: string; cumulative_pnl: number }>;
    execution_logs: string[];
    telegram_logs: string[];
  };
};

type FeedState = {
  pollSeconds: number;
  lastUpdateAt: string | null;
  source: "bridge" | "manual" | "bootstrap";
};

function metricTone(value: number) {
  if (value > 0) return "text-primary";
  if (value < 0) return "text-danger";
  return "text-foreground";
}

function formatMoney(value: number) {
  const abs = Math.abs(value).toFixed(2);
  if (value > 0) return `+$${abs}`;
  if (value < 0) return `-$${abs}`;
  return "$0.00";
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTime(value?: string | null) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusTone(status?: string) {
  if (status === "live") return "text-primary";
  if (status === "warn") return "text-warning";
  if (status === "error") return "text-danger";
  return "text-foreground";
}

function parseLevel(value?: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function EquityPanel({ points }: { points: Array<{ timestamp: string; cumulative_pnl: number }> }) {
  if (!points.length) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 text-[13px] text-muted">
        No completed trades yet. This view will populate as the runtime closes positions.
      </div>
    );
  }

  const values = points.map((point) => point.cumulative_pnl);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - ((point.cumulative_pnl - min) / range) * 100;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-4">
      <svg viewBox="0 0 100 100" className="h-[320px] w-full">
        <defs>
          <linearGradient id="runtime-equity" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 255, 163, 0.45)" />
            <stop offset="100%" stopColor="rgba(255, 159, 67, 0.75)" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="url(#runtime-equity)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default function StrategyRuntimePage({
  params,
}: {
  params: Promise<{ strategyId: string }>;
}) {
  const [strategyId, setStrategyId] = useState("");
  const [payload, setPayload] = useState<RuntimePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedState, setFeedState] = useState<FeedState>({
    pollSeconds: 5,
    lastUpdateAt: null,
    source: "bootstrap",
  });

  useEffect(() => {
    params.then((value) => setStrategyId(value.strategyId));
  }, [params]);

  useEffect(() => {
    if (!strategyId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(source: FeedState["source"] = "bridge") {
      try {
        if (!payload) setLoading(true);
        setError("");
        const response = await fetch(`/api/automation/strategies/${strategyId}/runtime`, {
          cache: "no-store",
        });
        const next = (await response.json()) as RuntimePayload | { error?: string };
        if (!response.ok || !("ok" in next)) {
          throw new Error((next as { error?: string }).error || "Unable to load runtime view.");
        }
        if (!cancelled) {
          setPayload(next);
          setFeedState({
            pollSeconds: next.snapshot?.poll_seconds ?? 5,
            lastUpdateAt: new Date().toISOString(),
            source,
          });
        }
      } catch (nextError) {
        if (!cancelled) setError((nextError as Error).message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          const nextPoll = Math.max(1, payload?.snapshot?.poll_seconds ?? 5) * 1000;
          timer = setTimeout(() => {
            void load("bridge");
          }, nextPoll);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [strategyId]);

  const profile = payload?.profile;
  const snapshot = payload?.snapshot;
  const health = snapshot?.health ?? [];
  const logs = snapshot?.execution_logs ?? [];
  const telegram = snapshot?.telegram_logs ?? [];
  const position = snapshot?.active_position;
  const mailbox = snapshot?.mailbox;
  const strategyLabel = payload?.strategy?.label ?? profile?.label ?? "Strategy Runtime";
  const activeLevels = useMemo<ChartLevel[]>(() => {
    if (!position) return [];

    const levels: ChartLevel[] = [];
    const entry = parseLevel(position.entry);
    const stop = parseLevel(position.stop);
    const target = parseLevel(position.target);

    if (entry !== null) {
      levels.push({
        id: "entry",
        price: entry,
        color: "#00F5A0",
        label: "ENTRY",
        lineStyle: "solid",
      });
    }

    if (stop !== null) {
      levels.push({
        id: "stop",
        price: stop,
        color: "#EF4444",
        label: "SL",
        lineStyle: "dotted",
      });
    }

    if (target !== null) {
      levels.push({
        id: "target",
        price: target,
        color: "#F59E0B",
        label: "TP",
        lineStyle: "dotted",
      });
    }

    return levels;
  }, [position]);

  const metrics = useMemo(() => {
    if (!snapshot) {
      return [
        { label: "# of Trades", value: "--", tone: "text-foreground" },
        { label: "P&L", value: "--", tone: "text-foreground" },
        { label: "Win Rate", value: "--", tone: "text-foreground" },
        { label: "Profit Factor", value: "--", tone: "text-foreground" },
        { label: "Net Profit", value: "--", tone: "text-foreground" },
      ];
    }

    return [
      { label: "# of Trades", value: String(snapshot.stats.trade_count), tone: "text-foreground" },
      { label: "P&L", value: formatMoney(snapshot.stats.day_pnl), tone: metricTone(snapshot.stats.day_pnl) },
      { label: "Win Rate", value: formatPercent(snapshot.stats.win_rate), tone: "text-foreground" },
      { label: "Profit Factor", value: snapshot.stats.profit_factor.toFixed(2), tone: "text-foreground" },
      { label: "Net Profit", value: formatMoney(snapshot.stats.net_profit), tone: metricTone(snapshot.stats.net_profit) },
    ];
  }, [snapshot]);

  const opsCards = useMemo(
    () => [
      {
        label: "BOT STATUS",
        value: health.find((item) => item.label === "BOT STATUS")?.value ?? "RUNNING",
        status: health.find((item) => item.label === "BOT STATUS")?.status ?? "live",
      },
      {
        label: "KILL",
        value: snapshot?.kill_switch_armed ? "DISABLED" : "ENABLED",
        status: snapshot?.kill_switch_armed ? "warn" : "live",
      },
      {
        label: "MODE",
        value: snapshot?.mode?.toUpperCase() ?? "--",
        status: "live",
      },
      {
        label: "MAILBOX",
        value: mailbox?.available ? `${mailbox.pending_count ?? 0}P / ${mailbox.claimed_count ?? 0}C` : "OFFLINE",
        status: mailbox?.available ? ((mailbox.pending_count ?? 0) > 0 ? "warn" : "live") : "warn",
      },
      {
        label: "WORKER",
        value: mailbox?.worker_status ?? mailbox?.worker_id ?? "--",
        status: mailbox?.worker_health_state ?? "idle",
      },
      {
        label: "FEED",
        value: `POLL ${feedState.pollSeconds}s`,
        status: "idle",
      },
    ],
    [feedState.pollSeconds, health, mailbox, snapshot?.kill_switch_armed, snapshot?.mode]
  );

  const syncCards = useMemo(
    () => [
      { label: "Last Update", value: formatTime(feedState.lastUpdateAt), status: "idle" },
      { label: "Update Source", value: feedState.source.toUpperCase(), status: "live" },
      {
        label: "Snapshot Stamp",
        value: formatTime(snapshot?.generated_at),
        status: "idle",
      },
      {
        label: "Journal Watch",
        value: `${snapshot?.health_rules?.journal_watch_seconds ?? "--"}s`,
        status: "idle",
      },
      {
        label: "Worker Stale",
        value: `${snapshot?.health_rules?.worker_stale_seconds ?? "--"}s`,
        status: "idle",
      },
      {
        label: "Bar Stale",
        value: `${snapshot?.health_rules?.bar_stale_seconds ?? "--"}s`,
        status: "idle",
      },
    ],
    [feedState.lastUpdateAt, feedState.source, snapshot?.generated_at, snapshot?.health_rules]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-panel p-5">
        <Link
          href="/automation/strategies"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 text-primary" />
          Back to Strategies
        </Link>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">Strategy Runtime</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-[28px] font-semibold tracking-tight text-foreground">
              {profile?.label || "Strategy Runtime"}
            </h2>
            {profile && (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                {profile.market} • {profile.version}
              </span>
            )}
            {payload && (
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                  payload.bridge_status === "ready"
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted"
                }`}
              >
                {payload.bridge_status === "ready" ? "KWANTMASTER bridge ready" : "Bridge unavailable"}
              </span>
            )}
          </div>
          <p className="mt-2 max-w-[980px] text-[13px] text-muted">
            {profile?.summary ||
              "This page is the public-product home for a single runtime. It should eventually absorb the deeper forward-test state that currently lives in localhost."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/40 px-5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          {strategyLabel} • {profile?.version ?? "--"}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
          Last Sync {snapshot?.generated_at ? formatTime(snapshot.generated_at) : "--"} • Poll {feedState.pollSeconds}s
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-6">
        {opsCards.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-panel px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{item.label}</div>
            <div className={`mt-3 text-[13px] font-semibold ${statusTone(item.status)}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <AutomationChartWorkspace
        title="Strategy Runtime Chart"
        eyebrow="Runtime"
        instrument={profile?.market ?? "MNQ SEP26"}
        timeframe="5m"
        levels={activeLevels}
        statusBadges={[
          profile?.market ?? "MNQ SEP26",
          "5m",
          snapshot?.mode?.toUpperCase() ?? "PAPER",
          position ? `${position.side ?? "POSITION"} LIVE` : "NO OPEN POSITION",
          activeLevels.length > 0 ? "TRADE LEVELS ON" : "WAITING FOR LEVELS",
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border bg-panel p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{metric.label}</div>
            <div className={`mt-4 text-[28px] font-semibold tracking-tight ${metric.tone}`}>{metric.value}</div>
          </div>
        ))}
      </div>

      <SectionCard eyebrow="Health" title="Runtime Status Strip">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {health.length > 0 ? (
            health.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-surface/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{item.label}</div>
                <div className={`mt-3 text-[14px] font-semibold ${statusTone(item.status)}`}>{item.value}</div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 p-4 text-[12px] text-muted">
              Runtime health will appear here once the bridge is supplying forward-test state.
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Performance"
        title="Live Equity Curve / Trade History"
        action={
          <div className="inline-flex items-center gap-2 text-[11px] text-muted">
            <RefreshCcw className="h-4 w-4 text-primary" />
            {snapshot ? `Last sync ${formatTime(snapshot.generated_at)}` : "Waiting for bridge"}
          </div>
        }
      >
        <EquityPanel points={snapshot?.equity_curve ?? []} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard eyebrow="Execution" title="Execution / Engine Log">
          <div className="space-y-2">
            {logs.length > 0 ? (
              logs.map((entry, index) => (
                <div key={`${entry}-${index}`} className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-[12px] text-foreground">
                  {entry}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-8 text-[12px] text-muted">
                No execution events yet.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Alerts" title="Telegram / Alert Log">
          <div className="space-y-2">
            {telegram.length > 0 ? (
              telegram.map((entry, index) => (
                <div key={`${entry}-${index}`} className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-[12px] text-foreground">
                  {entry}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-8 text-[12px] text-muted">
                No telegram alerts yet.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard eyebrow="Position" title="Active Position / Execution State">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Position", value: position?.side ? `${position.side} ${position.symbol || ""}` : "Flat" },
              { label: "State", value: position?.state || "No open trade" },
              { label: "Entry", value: position?.entry || "--" },
              { label: "Stop", value: position?.stop || "--" },
              { label: "Target", value: position?.target || "--" },
              { label: "Size", value: position?.size || "--" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-surface/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{item.label}</div>
                <div className="mt-3 text-[13px] font-semibold text-foreground">{item.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Ops" title="Last Closed / Mailbox State">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Last Closed", value: snapshot?.last_closed_execution?.symbol || "None yet" },
              {
                label: "Exit P&L",
                value:
                  typeof snapshot?.last_closed_execution?.exit_pnl === "number"
                    ? formatMoney(snapshot.last_closed_execution.exit_pnl)
                    : "--",
              },
              { label: "Closed At", value: formatTime(snapshot?.last_closed_execution?.closed_at) },
              { label: "Mailbox", value: mailbox?.available ? "Available" : "Unavailable" },
              { label: "Pending", value: String(mailbox?.pending_count ?? 0) },
              { label: "Claimed", value: String(mailbox?.claimed_count ?? 0) },
              { label: "Worker", value: mailbox?.worker_id || "--" },
              { label: "Worker Status", value: mailbox?.worker_status || "--" },
              { label: "Heartbeat", value: formatTime(mailbox?.worker_last_heartbeat_at) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-surface/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{item.label}</div>
                <div className="mt-3 text-[13px] font-semibold text-foreground">{item.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Sync" title="Live Feed / Sync">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {syncCards.map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-surface/60 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{item.label}</div>
              <div className={`mt-3 text-[13px] font-semibold ${statusTone(item.status)}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Bridge" title="KWANTMASTER Import Status">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <div className="flex items-center gap-2 text-muted">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Source</span>
            </div>
            <div className="mt-3 text-[12px] text-foreground">{payload?.source || "--"}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <div className="flex items-center gap-2 text-muted">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Kill Switch</span>
            </div>
            <div className="mt-3 text-[13px] font-semibold text-foreground">
              {snapshot?.kill_switch_armed ? "Bot Disabled" : "Bot Enabled"}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <div className="flex items-center gap-2 text-muted">
              <Radio className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Mode</span>
            </div>
            <div className="mt-3 text-[13px] font-semibold text-foreground">{snapshot?.mode?.toUpperCase() || "--"}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <div className="flex items-center gap-2 text-muted">
              <Clock3 className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Poll</span>
            </div>
            <div className="mt-3 text-[13px] font-semibold text-foreground">
              {snapshot?.health_rules?.poll_seconds ?? snapshot?.poll_seconds ?? "--"}s
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-xl border border-border bg-surface/40 px-4 py-3 text-[12px] text-muted">
            Loading runtime bridge...
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[12px] text-danger">
            {error}
          </div>
        ) : null}

        {!loading && !error && payload?.bridge_status !== "ready" ? (
          <div className="mt-4 rounded-xl border border-border bg-surface/40 px-4 py-3 text-[12px] text-muted">
            The runtime page shell is live, but the bridge is not available to this deployment yet. In production,
            this will need either a shared backend service or a reachable `KWANTMASTER_FORWARD_SNAPSHOT_URL`.
          </div>
        ) : null}

        {!loading && !error && payload?.bridge_status === "ready" ? (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-[12px] text-primary">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Runtime data is flowing into the public strategy page.
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
