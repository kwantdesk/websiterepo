"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FilePenLine,
  Loader2,
  LockKeyhole,
  Save,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import {
  buildGameplanScoringRecord,
  writePendingScoringTransition,
} from "@/lib/gameplanScoringTransition";
import {
  normalizeZyonGameplanDraft,
  zyonGameplanMissingFields,
  zyonTradingAccountLabel,
  type ZyonGameplanDraft,
  type ZyonTradingAccount,
  type ZyonTradingAccountCurrency,
  type ZyonTradingAccountMode,
  type ZyonTradingAccountPhase,
} from "@/lib/zyon";
import { zyonGameplanLaunchHref } from "@/lib/zyonGameplanLaunch";
import { writeProtectedItem } from "@/lib/browserStorageQuota";

type DraftResponse = {
  draft?: ZyonGameplanDraft | null;
  migrationRequired?: boolean;
  error?: string;
};

type Props = {
  onPendingChange?: (pending: boolean) => void;
};

function localDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function finiteOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function accountForMode(
  mode: ZyonTradingAccountMode,
  current: ZyonTradingAccount | null,
): ZyonTradingAccount {
  const phase: ZyonTradingAccountPhase = mode === "LIVE"
    ? "LIVE"
    : mode === "SIM"
      ? "SIMULATION"
      : current?.mode === "PROP" && ["EVALUATION", "FUNDED"].includes(current.phase)
        ? current.phase
        : "EVALUATION";
  return {
    mode,
    provider: current?.provider ?? "",
    program: current?.program ?? "",
    phase,
    size: current?.size ?? null,
    currency: current?.currency ?? "USD",
  };
}

const inputClass = "mt-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-[8px] text-foreground outline-none transition focus:border-primary/40";
const labelClass = "text-[6.5px] font-semibold uppercase tracking-[0.12em] text-muted";

export default function GameplanHoldingPanel({ onPendingChange }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<ZyonGameplanDraft | null>(null);
  const [targetsInput, setTargetsInput] = useState("");
  const [confluencesInput, setConfluencesInput] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [notice, setNotice] = useState("");

  const applyDraft = useCallback((value: unknown) => {
    const next = value === null ? null : normalizeZyonGameplanDraft(value);
    setDraft(next);
    setTargetsInput(next ? next.targets.join(", ") : "");
    setConfluencesInput(next ? next.confluences.join("\n") : "");
    onPendingChange?.(Boolean(next));
    return next;
  }, [onPendingChange]);

  const loadDraft = useCallback(async (showLoading = false) => {
    if (showLoading) setState("loading");
    try {
      const response = await fetch(`/api/zyon/gameplan-draft?localDate=${localDateKey()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null) as DraftResponse | null;
      if (!response.ok) throw new Error(payload?.error || "The holding Gameplan could not be loaded.");
      if (payload?.migrationRequired) throw new Error("Gameplan storage is not connected.");
      const next = applyDraft(payload?.draft ?? null);
      if (payload?.draft && !next) throw new Error("The holding Gameplan record was incomplete.");
      setState(next ? "ready" : "missing");
      setNotice("");
    } catch (error) {
      setState("error");
      setNotice(error instanceof Error ? error.message : "The holding Gameplan could not be loaded.");
      onPendingChange?.(false);
    }
  }, [applyDraft, onPendingChange]);

  useEffect(() => {
    const refresh = () => void loadDraft(false);
    const refreshVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    void loadDraft(true);
    window.addEventListener("kwantdesk:zyon-gameplan-sent", refresh);
    window.addEventListener("kwantdesk:zyon-gameplan-draft-updated", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.removeEventListener("kwantdesk:zyon-gameplan-sent", refresh);
      window.removeEventListener("kwantdesk:zyon-gameplan-draft-updated", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [loadDraft]);

  const missing = useMemo(() => zyonGameplanMissingFields(draft), [draft]);

  const persistDraft = async () => {
    if (!draft) return null;
    const normalized = {
      ...draft,
      entryLow: Math.min(draft.entryLow, draft.entryHigh),
      entryHigh: Math.max(draft.entryLow, draft.entryHigh),
      targets: targetsInput.split(",").map((value) => Number(value.trim())).filter(Number.isFinite).slice(0, 8),
      confluences: confluencesInput.split(/\n|,/).map((value) => value.trim()).filter(Boolean).slice(0, 12),
    };
    const missingFields = zyonGameplanMissingFields(normalized);
    if (missingFields.length) {
      setNotice(`Complete: ${missingFields.join(", ")}.`);
      return null;
    }
    const response = await fetch("/api/zyon/gameplan-draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
    const payload = await response.json().catch(() => null) as {
      error?: string;
      recordMode?: "LIVE" | "HISTORICAL";
      updatedAt?: string;
    } | null;
    if (!response.ok) throw new Error(payload?.error || "The edited Gameplan could not be saved.");
    const saved = {
      ...normalized,
      recordMode: payload?.recordMode ?? normalized.recordMode ?? "LIVE",
      updatedAt: payload?.updatedAt ?? normalized.updatedAt,
    };
    setDraft(saved);
    window.dispatchEvent(new CustomEvent("kwantdesk:zyon-gameplan-draft-updated", {
      detail: { draftId: saved.id },
    }));
    return saved;
  };

  const save = async () => {
    setSaving(true);
    setNotice("");
    try {
      const saved = await persistDraft();
      if (saved) setNotice("Saved here and in Socials → Record.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Gameplan could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const lockIntoScoring = async () => {
    if (!draft || locking) return;
    const normalizedDraft = {
      ...draft,
      entryLow: Math.min(draft.entryLow, draft.entryHigh),
      entryHigh: Math.max(draft.entryLow, draft.entryHigh),
      targets: targetsInput.split(",").map((value) => Number(value.trim())).filter(Number.isFinite).slice(0, 8),
      confluences: confluencesInput.split(/\n|,/).map((value) => value.trim()).filter(Boolean).slice(0, 12),
    };
    const missingFields = zyonGameplanMissingFields(normalizedDraft);
    if (missingFields.length) {
      setNotice(`Complete: ${missingFields.join(", ")}.`);
      return;
    }
    const optimisticRecord = buildGameplanScoringRecord(normalizedDraft);
    setLocking(true);
    setNotice("");
    writePendingScoringTransition({ record: optimisticRecord, state: "saving" });
    writeProtectedItem("kwantdesk:gameplan-page-tab", "scoring");
    window.dispatchEvent(new CustomEvent("kwantdesk:gameplan-lock-started", {
      detail: { record: optimisticRecord },
    }));
    try {
      const saved = await persistDraft();
      if (!saved) throw new Error("The completed Gameplan could not be prepared for Scoring.");
      const lockResponse = await fetch("/api/zyon/gameplan-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: saved.id, expectedUpdatedAt: saved.updatedAt }),
      });
      const lockResult = await lockResponse.json().catch(() => null) as {
        object?: typeof optimisticRecord;
        error?: string;
      } | null;
      if (!lockResponse.ok || !lockResult?.object) {
        throw new Error(lockResult?.error || "The Gameplan remains in Holding because its immutable record could not be created.");
      }
      const savedRecord = lockResult.object;
      writePendingScoringTransition({ record: savedRecord, state: "saved" });
      window.dispatchEvent(new CustomEvent("kwantdesk:gameplan-locked", {
        detail: { recordId: savedRecord.id, object: savedRecord },
      }));
      // The route verifies the first completed record before awarding this;
      // upsert semantics make the request harmless for existing holders.
      void fetch("/api/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: {
            id: "card:first-on-record",
            objectType: "card",
            scope: "community",
            payload: { code: "first-on-record", active: true, public: true },
          },
        }),
      });
      applyDraft(null);
      setState("missing");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The Gameplan remains safely in holding.";
      writePendingScoringTransition({ record: optimisticRecord, state: "failed", error: message });
      window.dispatchEvent(new CustomEvent("kwantdesk:gameplan-lock-failed", {
        detail: { record: optimisticRecord, error: message },
      }));
      setNotice(message);
    } finally {
      setLocking(false);
    }
  };

  if (state === "loading") {
    return (
      <section className="gameplan-holding-editable overflow-hidden rounded-2xl border border-border bg-panel p-4">
        <div className="flex items-center gap-2 text-[8px] text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />Checking your Gameplan holding record</div>
      </section>
    );
  }

  if (!draft) {
    return (
      <section className="gameplan-holding-editable overflow-hidden rounded-2xl border border-dashed border-border bg-panel/70 p-4">
        <div className="flex items-center gap-2"><FilePenLine className="h-4 w-4 text-muted" /><span className="text-[10px] font-semibold">Your Gameplan</span></div>
        <p className="mt-2 text-[8px] leading-4 text-muted">No plan is waiting for approval. Finish one with Zyon and it will appear here and in Socials → Record.</p>
        {notice ? <p className="mt-2 text-[8px] text-danger">{notice}</p> : null}
        <button type="button" onClick={() => router.push(zyonGameplanLaunchHref())} className="mt-3 flex h-8 items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.07] px-3 text-[8px] font-semibold text-primary hover:bg-primary/10"><Sparkles className="h-3.5 w-3.5" />Make Gameplan</button>
      </section>
    );
  }

  const updateAccount = (patch: Partial<ZyonTradingAccount>) => {
    setDraft((current) => current ? {
      ...current,
      tradingAccount: { ...accountForMode(current.tradingAccount?.mode ?? "SIM", current.tradingAccount), ...patch },
    } : current);
  };

  return (
    <section className="gameplan-holding-editable overflow-hidden rounded-2xl border border-primary/25 bg-panel shadow-[0_0_30px_color-mix(in_srgb,var(--primary)_6%,transparent)]">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center gap-2.5 border-b border-primary/15 bg-primary/[0.035] px-3.5 py-3 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><FilePenLine className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold text-foreground">Your Gameplan</span><span className="mt-0.5 block truncate text-[7px] text-muted">{draft.instrument} · {draft.direction} · waiting for your approval</span></span>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
      </button>

      {expanded ? (
        <div className="max-h-[720px] overflow-y-auto p-3">
          <label className={labelClass}>Plan name<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value.slice(0, 120) })} className={inputClass} /></label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className={labelClass}>Instrument<input value={draft.instrument} onChange={(event) => setDraft({ ...draft, instrument: event.target.value.toUpperCase().slice(0, 16) })} className={`${inputClass} font-mono`} /></label>
            <label className={labelClass}>Direction<KwantSelect value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value as ZyonGameplanDraft["direction"] })} className={inputClass}><option value="LONG">Long</option><option value="SHORT">Short</option></KwantSelect></label>
            <label className={labelClass}>Session<input value={draft.session} onChange={(event) => setDraft({ ...draft, session: event.target.value.slice(0, 60) })} className={inputClass} /></label>
            <label className={labelClass}>Entry time · optional<input value={draft.entryTime} onChange={(event) => setDraft({ ...draft, entryTime: event.target.value.slice(0, 80) })} placeholder="Leave blank until filled" className={`${inputClass} font-mono`} /></label>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className={labelClass}>Entry low<input type="number" value={draft.entryLow} onChange={(event) => setDraft({ ...draft, entryLow: Number(event.target.value) })} className={`${inputClass} font-mono`} /></label>
            <label className={labelClass}>Entry high<input type="number" value={draft.entryHigh} onChange={(event) => setDraft({ ...draft, entryHigh: Number(event.target.value) })} className={`${inputClass} font-mono`} /></label>
            <label className={labelClass}>Stop<input type="number" value={draft.stop} onChange={(event) => setDraft({ ...draft, stop: Number(event.target.value) })} className={`${inputClass} border-danger/25 font-mono focus:border-danger/50`} /></label>
            <label className={labelClass}>Take profits<input value={targetsInput} onChange={(event) => { setTargetsInput(event.target.value); setDraft({ ...draft, targets: event.target.value.split(",").map((value) => Number(value.trim())).filter(Number.isFinite).slice(0, 8) }); }} placeholder="TP1, TP2, TP3" className={`${inputClass} border-primary/20 font-mono`} /></label>
            <label className={labelClass}>Maximum risk<input type="number" value={draft.riskAmount ?? ""} onChange={(event) => setDraft({ ...draft, riskAmount: finiteOrNull(event.target.value) })} className={`${inputClass} font-mono`} /></label>
            <label className={labelClass}>Risk unit<KwantSelect value={draft.riskUnit} onChange={(event) => setDraft({ ...draft, riskUnit: event.target.value as ZyonGameplanDraft["riskUnit"] })} className={inputClass}><option value="DOLLARS">Dollars</option><option value="POINTS">Points</option><option value="TICKS">Ticks</option><option value="PERCENT">Percent</option></KwantSelect></label>
            <label className={labelClass}>Position size<input type="number" value={draft.size ?? ""} onChange={(event) => setDraft({ ...draft, size: finiteOrNull(event.target.value) })} placeholder="Contracts" className={`${inputClass} font-mono`} /></label>
            <label className={labelClass}>Plan expiry<input value={draft.expiryAt ?? ""} onChange={(event) => setDraft({ ...draft, expiryAt: event.target.value.slice(0, 60) || null })} placeholder="Optional ISO time" className={`${inputClass} font-mono`} /></label>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background/35 p-2.5">
            <div className="flex items-center gap-2"><WalletCards className="h-3.5 w-3.5 text-primary" /><span className="text-[8px] font-semibold">Trading account</span><span className="ml-auto max-w-[150px] truncate text-[7px] text-primary">{zyonTradingAccountLabel(draft.tradingAccount)}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className={labelClass}>Environment<KwantSelect value={draft.tradingAccount?.mode ?? ""} onChange={(event) => setDraft({ ...draft, tradingAccount: accountForMode(event.target.value as ZyonTradingAccountMode, draft.tradingAccount) })} className={inputClass}><option value="" disabled>Select</option><option value="LIVE">Personal live</option><option value="SIM">Simulation</option><option value="PROP">Prop firm</option></KwantSelect></label>
              <label className={labelClass}>Phase<KwantSelect value={draft.tradingAccount?.phase ?? ""} onChange={(event) => updateAccount({ phase: event.target.value as ZyonTradingAccountPhase })} className={inputClass}><option value="" disabled>Select</option>{draft.tradingAccount?.mode === "LIVE" ? <option value="LIVE">Live</option> : null}{draft.tradingAccount?.mode === "SIM" ? <option value="SIMULATION">Simulation</option> : null}{draft.tradingAccount?.mode === "PROP" ? <><option value="EVALUATION">Evaluation</option><option value="FUNDED">Funded</option></> : null}</KwantSelect></label>
              <label className={labelClass}>Provider<input value={draft.tradingAccount?.provider ?? ""} onChange={(event) => updateAccount({ provider: event.target.value.slice(0, 80) })} placeholder="Firm / broker" className={inputClass} /></label>
              <label className={labelClass}>Programme<input value={draft.tradingAccount?.program ?? ""} onChange={(event) => updateAccount({ program: event.target.value.slice(0, 80) })} placeholder="Optional" className={inputClass} /></label>
              <label className={labelClass}>Account size<input type="number" value={draft.tradingAccount?.size ?? ""} onChange={(event) => updateAccount({ size: finiteOrNull(event.target.value) })} className={`${inputClass} font-mono`} /></label>
              <label className={labelClass}>Currency<KwantSelect value={draft.tradingAccount?.currency ?? "USD"} onChange={(event) => updateAccount({ currency: event.target.value as ZyonTradingAccountCurrency })} className={inputClass}>{["USD", "AUD", "GBP", "EUR", "CAD"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}</KwantSelect></label>
            </div>
          </div>

          <label className={`${labelClass} mt-3 block`}>Reasoning<textarea value={draft.reasoning} onChange={(event) => setDraft({ ...draft, reasoning: event.target.value.slice(0, 5_000) })} rows={5} className="mt-1 w-full resize-y rounded-lg border border-border bg-background p-2.5 text-[8px] leading-4 text-foreground outline-none focus:border-primary/40" /></label>
          <label className={`${labelClass} mt-2 block`}>Confirmation<textarea value={draft.confirmation} onChange={(event) => setDraft({ ...draft, confirmation: event.target.value.slice(0, 2_000) })} rows={3} className="mt-1 w-full resize-y rounded-lg border border-primary/15 bg-background p-2.5 text-[8px] leading-4 text-foreground outline-none focus:border-primary/40" /></label>
          <label className={`${labelClass} mt-2 block`}>Invalidation<textarea value={draft.invalidation} onChange={(event) => setDraft({ ...draft, invalidation: event.target.value.slice(0, 2_000) })} rows={3} className="mt-1 w-full resize-y rounded-lg border border-danger/20 bg-background p-2.5 text-[8px] leading-4 text-foreground outline-none focus:border-danger/40" /></label>
          <label className={`${labelClass} mt-2 block`}>Confluences<textarea value={confluencesInput} onChange={(event) => { setConfluencesInput(event.target.value); setDraft({ ...draft, confluences: event.target.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean).slice(0, 12) }); }} rows={3} placeholder="One per line" className="mt-1 w-full resize-y rounded-lg border border-border bg-background p-2.5 text-[8px] leading-4 text-foreground outline-none focus:border-primary/40" /></label>
          <label className={`${labelClass} mt-2 block`}>Additional notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value.slice(0, 4_000) })} rows={3} className="mt-1 w-full resize-y rounded-lg border border-border bg-background p-2.5 text-[8px] leading-4 text-foreground outline-none focus:border-primary/40" /></label>

          {notice ? <p role="status" className={`mt-2 text-[7.5px] leading-4 ${notice.startsWith("Saved") ? "text-primary" : "text-danger"}`}>{notice}</p> : null}
          {missing.length ? <p className="mt-2 text-[7px] text-warning">Still required: {missing.join(", ")}</p> : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-border bg-background/25 p-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[7px] text-muted"><Clock3 className="h-3 w-3 shrink-0 text-primary" />Synced holding record</span>
        <button type="button" onClick={() => void save()} disabled={saving || locking} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[7.5px] font-semibold text-muted hover:text-foreground disabled:opacity-45">{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save</button>
        <button type="button" onClick={() => void lockIntoScoring()} disabled={saving || locking || Boolean(missing.length)} className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[7.5px] font-semibold text-on-primary shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_18%,transparent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{locking ? <Loader2 className="h-3 w-3 animate-spin" /> : <LockKeyhole className="h-3 w-3" />}{locking ? "Sending" : "Lock & score"}</button>
      </div>
      {state === "ready" ? <div className="flex items-center gap-1.5 border-t border-primary/10 bg-primary/[0.025] px-3 py-2 text-[6.5px] uppercase tracking-[0.1em] text-primary"><CheckCircle2 className="h-3 w-3" /><Target className="h-3 w-3" />Same record as Socials → Record</div> : null}
    </section>
  );
}
