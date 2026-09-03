"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  tradeSyncerControlGroups,
  tradeSyncerRiskTypes,
  type TradeSyncerTemplateRecord,
} from "@/lib/tradeSyncer";
import {
  TradeSyncerField,
  TradeSyncerModal,
  TradeSyncerSelect,
} from "@/components/trade-syncer/TradeSyncerControls";

const templateSections = ["Basic Settings", "SL/TP Settings", "Advanced Settings", "Trade Filters"];

function boolLabel(value: boolean) {
  return value ? "On" : "Off";
}

function TradeSyncerTemplatesWorkspaceContent({
  templates,
}: {
  templates: TradeSyncerTemplateRecord[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modal = searchParams.get("modal");
  const templateId = searchParams.get("template");
  const result = searchParams.get("result");
  const templateSection = searchParams.get("section") ?? "Basic Settings";
  const activeTemplate = templates.find((item) => item.id === templateId) ?? null;
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    label: activeTemplate?.label ?? "MNQ Eval Safe",
    riskType: activeTemplate?.riskType ?? "Fixed % Risk (Beta)",
    riskSetting: activeTemplate?.riskSetting ?? "1.0%",
    status: activeTemplate?.status === "enabled" ? "Enabled" : "Draft",
  });

  const handleSaveTemplate = () => {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/trade-syncer/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: templateForm.label,
            riskType: templateForm.riskType,
            riskSetting: templateForm.riskSetting,
            status: templateForm.status.toLowerCase(),
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to save Trade Syncer template.");
        }
        router.push(`/trade-syncer/templates?template=${encodeURIComponent(payload.template.id)}&result=saved`);
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to save Trade Syncer template.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-panel px-6 py-6">
        <div>
          <div className="text-[24px] font-semibold tracking-tight text-foreground">Templates</div>
          <div className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Save copier presets once, then reuse them across follower groups. Traders Connect gets a lot of value out of this and we should too.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/trade-syncer/templates?modal=import"
            className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            Import Template
          </Link>
          <Link
            href="/trade-syncer/templates?modal=add"
            className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-on-primary"
          >
            Add Template
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <div className="text-[18px] font-semibold text-foreground">Copier Templates</div>
            <div className="mt-1 text-[12px] text-muted">Templates should store the settings traders re-use over and over.</div>
          </div>
          <div className="rounded-xl border border-border bg-background/40 px-3.5 py-2 text-[12px] text-muted">
            Reusable copier presets and overrides
          </div>
        </div>
        <div className="overflow-x-auto px-6 py-4">
          <table className="min-w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
              <tr className="border-b border-border">
                {["Name", "Risk Type", "Risk Setting", "Copy SL", "Copy TP", "Copy Pending", "Settings"].map((head) => (
                  <th key={head} className="pb-3 pr-4 font-medium">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-border/60 last:border-0">
                  <td className="py-4 pr-4 font-medium text-foreground">{template.label}</td>
                  <td className="py-4 pr-4 text-muted">{template.riskType}</td>
                  <td className="py-4 pr-4 text-muted">{template.riskSetting}</td>
                  <td className="py-4 pr-4 text-muted">{boolLabel(template.copyStopLoss)}</td>
                  <td className="py-4 pr-4 text-muted">{boolLabel(template.copyTakeProfit)}</td>
                  <td className="py-4 pr-4 text-muted">{boolLabel(template.copyPendingOrders)}</td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/trade-syncer/templates?modal=edit&template=${encodeURIComponent(template.id)}`}
                        className="rounded-xl border border-border bg-background/40 px-3 py-1.5 text-[12px] text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/trade-syncer/templates?modal=delete&template=${encodeURIComponent(template.id)}`}
                        className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-1.5 text-[12px] text-danger transition-colors hover:border-danger/40"
                      >
                        Delete
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-3xl border border-border bg-panel p-6">
          <div className="text-[18px] font-semibold text-foreground">Template Control Groups</div>
          <div className="mt-4 space-y-3">
            {tradeSyncerControlGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="font-medium text-foreground">{group.title}</div>
                <div className="mt-1 text-[12px] leading-5 text-muted">{group.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-panel p-6">
          <div className="text-[18px] font-semibold text-foreground">Preferred Risk Types</div>
          <div className="mt-4 space-y-3">
            {tradeSyncerRiskTypes.map((risk) => (
              <div key={risk.title} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="font-medium text-foreground">{risk.title}</div>
                <div className="mt-1 text-[12px] leading-5 text-muted">{risk.detail}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {modal === "import" ? (
        <TradeSyncerModal
          title="Import Template"
          description="Bring in an existing copier preset and review it before attaching it to live followers."
          onClose={() => router.push("/trade-syncer/templates")}
        >
          <div className="rounded-2xl border border-border bg-background/40 p-4 text-[13px] leading-6 text-muted">
            Template import should support JSON or prior kwantify presets. For now this keeps the Traders Connect-style utility path alive.
          </div>
          <div className="mt-5 flex gap-3">
            <Link href="/trade-syncer/templates" className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground">
              Cancel
            </Link>
            <Link href="/trade-syncer/templates?modal=import&result=imported" className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary">
              Import Template
            </Link>
          </div>
        </TradeSyncerModal>
      ) : null}

      {modal === "add" || modal === "edit" ? (
        <TradeSyncerModal
          title={modal === "edit" ? `Edit Template / ${activeTemplate?.label ?? "Template"}` : "Add Template"}
          description="Templates should own the same policy groups Traders Connect exposes so the operator can reuse copy behavior cleanly."
          onClose={() => router.push("/trade-syncer/templates")}
        >
          {submitError ? (
            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/5 p-4 text-[13px] leading-6 text-danger">
              {submitError}
            </div>
          ) : null}
          {result ? (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
              {result === "saved"
                ? `${activeTemplate?.label ?? "Template"} saved. The next real step is wiring this to backend-owned template state.`
                : `${activeTemplate?.label ?? "Template"} tested. Policy sections are linked and ready for follower assignment.`}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/40 p-1">
              {templateSections.map((section) => {
                const active = templateSection === section;
                const href = `/trade-syncer/templates?modal=${modal}&section=${encodeURIComponent(section)}${activeTemplate ? `&template=${encodeURIComponent(activeTemplate.id)}` : ""}`;
                return (
                  <Link
                    key={section}
                    href={href}
                    className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                      active ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {section}
                  </Link>
                );
              })}
            </div>
            <div className="text-[12px] text-muted">Template sections mirror the real copier setup flow.</div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {templateSection === "Basic Settings" ? (
              <>
                <TradeSyncerField label="Template Name" placeholder={activeTemplate?.label ?? "MNQ Eval Safe"} value={templateForm.label} onChange={(next) => setTemplateForm((current) => ({ ...current, label: next }))} />
                <TradeSyncerSelect label="Risk Type" options={["Fixed Lot", "Lot Multiplier", "Balance Multiplier", "Fixed % Risk (Beta)"]} value={templateForm.riskType} onChange={(next) => setTemplateForm((current) => ({ ...current, riskType: next }))} />
                <TradeSyncerField label="Risk Setting" placeholder={activeTemplate?.riskSetting ?? "1.0%"} value={templateForm.riskSetting} onChange={(next) => setTemplateForm((current) => ({ ...current, riskSetting: next }))} />
                <TradeSyncerSelect label="Status" options={["Enabled", "Draft"]} value={templateForm.status} onChange={(next) => setTemplateForm((current) => ({ ...current, status: next }))} />
              </>
            ) : templateSection === "SL/TP Settings" ? (
              <>
                <TradeSyncerSelect label="Copy Stop Loss" options={["On", "Off"]} />
                <TradeSyncerSelect label="Copy Take Profit" options={["On", "Off"]} />
                <TradeSyncerSelect label="Copy Pending Orders" options={["On", "Off"]} />
                <TradeSyncerSelect label="Copy Expiry Time" options={["On", "Off"]} />
              </>
            ) : templateSection === "Advanced Settings" ? (
              <>
                <TradeSyncerSelect label="Strict Close" options={["On", "Off"]} />
                <TradeSyncerSelect label="Contract Alignment" options={["On", "Off"]} />
                <TradeSyncerField label="Custom Comment" placeholder={activeTemplate?.customComment ?? "KWANTIFY-FANOUT"} />
                <TradeSyncerSelect label="Delay Mode" options={["Immediate", "Fixed Delay", "Random Delay"]} />
              </>
            ) : (
              <>
                <TradeSyncerField label="Allowed Symbols" placeholder={(activeTemplate?.allowedSymbols ?? ["MNQ", "NQ", "ES"]).join(",")} />
                <TradeSyncerField label="Comment Filter" placeholder={activeTemplate?.commentFilter ?? "Optional comment match"} />
                <TradeSyncerSelect label="Direction" options={["Both", "Long only", "Short only"]} />
                <TradeSyncerField label="Master Lot Range" placeholder={activeTemplate?.masterLotRange ?? "0.50 - 5.00"} />
              </>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <Link
              href={`/trade-syncer/templates?modal=${modal}${activeTemplate ? `&template=${encodeURIComponent(activeTemplate.id)}` : ""}&section=${encodeURIComponent(templateSection)}&result=tested`}
              className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground"
            >
              Test Template
            </Link>
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isPending}
              className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save Template"}
            </button>
          </div>
        </TradeSyncerModal>
      ) : null}

      {modal === "delete" ? (
        <TradeSyncerModal
          title={`Delete Template / ${activeTemplate?.label ?? "Template"}`}
          description="Deleting a copier template should be explicit because multiple groups can depend on it."
          onClose={() => router.push("/trade-syncer/templates")}
        >
          {result ? (
            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/5 p-4 text-[13px] leading-6 text-danger">
              {activeTemplate?.label ?? "Template"} deleted from the library. Active groups should be prompted to replace or detach their template assignment.
            </div>
          ) : null}
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-4 text-[13px] leading-6 text-danger">
            Remove {activeTemplate?.label ?? "this template"} from the template library. In the live version we should block this if an active copier group still depends on it.
          </div>
          <div className="mt-5 flex gap-3">
            <Link href="/trade-syncer/templates" className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground">
              Cancel
            </Link>
            <Link href={`/trade-syncer/templates?modal=delete&template=${encodeURIComponent(activeTemplate?.id ?? "")}&result=deleted`} className="flex-1 rounded-xl bg-danger py-3 text-center text-[13px] font-semibold text-on-danger">
              Confirm Delete
            </Link>
          </div>
        </TradeSyncerModal>
      ) : null}
    </div>
  );
}

export default function TradeSyncerTemplatesWorkspace(props: {
  templates: TradeSyncerTemplateRecord[];
}) {
  return (
    <Suspense fallback={null}>
      <TradeSyncerTemplatesWorkspaceContent {...props} />
    </Suspense>
  );
}
