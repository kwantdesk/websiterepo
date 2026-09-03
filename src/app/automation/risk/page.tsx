"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Shield, ShieldCheck, Siren } from "lucide-react";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { defaultRiskConfig, loadRiskConfig, saveRiskConfig, type AutomationRiskConfig } from "@/lib/automation";

export default function AutomationRiskPage() {
  const [config, setConfig] = useState<AutomationRiskConfig>(defaultRiskConfig);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setConfig(loadRiskConfig());
  }, []);

  function updateBoolean(key: keyof AutomationRiskConfig, value: boolean) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function updateNumber(key: keyof AutomationRiskConfig, value: number) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function persistRisk() {
    saveRiskConfig(config);
    setToast("Risk profile saved");
    window.setTimeout(() => setToast(""), 1800);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <SectionCard eyebrow="Risk" title="Account and Bot Guardrails">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-2xl border border-border bg-surface/60 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Daily loss limit</div>
            <input
              type="number"
              value={config.dailyLossLimit}
              onChange={(event) => updateNumber("dailyLossLimit", Number(event.target.value))}
              className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-right font-mono text-[13px] text-foreground outline-none"
            />
          </label>

          <label className="rounded-2xl border border-border bg-surface/60 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Max open positions</div>
            <input
              type="number"
              value={config.maxOpenPositions}
              onChange={(event) => updateNumber("maxOpenPositions", Number(event.target.value))}
              className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-right font-mono text-[13px] text-foreground outline-none"
            />
          </label>

          <label className="rounded-2xl border border-border bg-surface/60 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Max open orders</div>
            <input
              type="number"
              value={config.maxOpenOrders}
              onChange={(event) => updateNumber("maxOpenOrders", Number(event.target.value))}
              className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-right font-mono text-[13px] text-foreground outline-none"
            />
          </label>

          {[
            { key: "duplicateSignalBlock" as const, label: "Duplicate signal block" },
            { key: "staleDataBlock" as const, label: "Stale data block" },
            { key: "disconnectFailsafe" as const, label: "Disconnect failsafe" },
            { key: "newsLockout" as const, label: "News lockout" },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[13px] text-foreground">{item.label}</div>
              <input
                type="checkbox"
                checked={config[item.key]}
                onChange={(event) => updateBoolean(item.key, event.target.checked)}
              />
            </label>
          ))}
        </div>

        <div className="mt-4">
          <button onClick={persistRisk} className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-on-primary">
            Save Risk Profile
          </button>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Needs" title="Professional Risk Surfaces">
        <div className="space-y-3">
          {[
            { icon: Shield, label: "Daily loss and drawdown locks" },
            { icon: ShieldCheck, label: "Max open positions and order caps" },
            { icon: AlertTriangle, label: "Stale data and disconnect fail-safe" },
            { icon: Siren, label: "News lockout and prop-firm rule profiles" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3 text-[13px] text-foreground">
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </div>
          ))}
        </div>
      </SectionCard>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-primary/20 bg-panel px-4 py-3 text-[13px] text-primary shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
