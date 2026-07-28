"use client";

import { useEffect, useMemo, useState } from "react";
import { Cable, Cloud, Loader2, Router, Server, Wallet } from "lucide-react";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { brokerFeeds } from "@/components/automation/automationData";
import { runtimeModeLabels, toneClasses, type AutomationConnectionAccount, type AutomationConnectionProvider, type RuntimeMode } from "@/lib/automation";

type ConnectionResponse = {
  providers: AutomationConnectionProvider[];
  accounts: AutomationConnectionAccount[];
  runtimeModes: RuntimeMode[];
  generatedAt: string;
};

export default function AutomationConnectionsPage() {
  const [data, setData] = useState<ConnectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/automation/connections", { cache: "no-store" });
        const next = await response.json();

        if (!response.ok) {
          throw new Error(next?.error || "Failed to load connection health.");
        }

        if (!cancelled) {
          setData(next);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError((nextError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const providers = data?.providers ?? [];
  const accounts = data?.accounts ?? [];
  const fallbackProviders: AutomationConnectionProvider[] = brokerFeeds.map((feed) => ({
    id: feed.name.toLowerCase().replace(/\s+/g, "-"),
    name: feed.name,
    kind: "broker",
    status: feed.status,
    tone: feed.status === "Connected" ? "live" : feed.status === "Ready" ? "ready" : "planned",
    detail: feed.detail,
  }));
  const runtimeModes = useMemo(
    () => (data?.runtimeModes ?? ["replay", "demo", "paper", "forward_test", "live"]).map((mode) => runtimeModeLabels[mode]),
    [data?.runtimeModes]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <SectionCard
        eyebrow="Connections"
        title="Broker, Data, and Prop Venues"
        action={
          loading ? (
            <div className="inline-flex items-center gap-2 text-[12px] text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Checking live environment
            </div>
          ) : data ? (
            <div className="text-[12px] text-muted">Updated {new Date(data.generatedAt).toLocaleTimeString()}</div>
          ) : null
        }
      >
        <div className="space-y-3">
          {(providers.length > 0 ? providers : fallbackProviders).map((feed) => (
            <div key={feed.name} className="rounded-2xl border border-border bg-surface/60 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[14px] font-semibold text-foreground">{feed.name}</div>
                  <div className="mt-1 text-[12px] text-muted">{feed.detail}</div>
                </div>
                <div className={`text-[12px] font-medium ${toneClasses(feed.tone)}`}>{feed.status}</div>
              </div>
              {feed.metadata && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(feed.metadata).map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] font-medium text-muted"
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {error && (
            <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[12px] text-danger">
              {error}
            </div>
          )}
        </div>
      </SectionCard>

      <div className="space-y-6">
        <SectionCard eyebrow="Center" title="Connection Center Foundations">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Cable, label: "Broker auth", detail: "Credentials, API health, reconnect" },
              { icon: Cloud, label: "Data feeds", detail: "Provider priority and symbol coverage" },
              { icon: Wallet, label: "Accounts", detail: "Live, paper, demo, prop routing" },
              { icon: Router, label: "Execution router", detail: "Venue mapping and fallback logic" },
              { icon: Server, label: "Heartbeat", detail: "Status lights, stale feeds, drift" },
            ].map(({ icon: Icon, label, detail }) => (
              <div key={label} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center gap-2 text-muted">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</span>
                </div>
                <div className="mt-3 text-[13px] text-foreground">{detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Accounts" title="Execution Lanes Available">
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-foreground">{account.label}</div>
                    <div className="mt-1 text-[12px] text-muted">{account.detail}</div>
                  </div>
                  <div className="rounded-full border border-border bg-panel px-3 py-1 text-[11px] font-medium text-muted">
                    {runtimeModeLabels[account.mode as RuntimeMode] ?? account.mode}
                  </div>
                </div>
                <div className="mt-3 text-[12px] text-muted">{account.status}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Modes" title="Runtime Modes This Desk Must Support">
          <div className="flex flex-wrap gap-2">
            {runtimeModes.map((mode) => (
              <span
                key={mode}
                className="rounded-full border border-border bg-surface px-3 py-2 text-[12px] font-medium text-foreground"
              >
                {mode}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
