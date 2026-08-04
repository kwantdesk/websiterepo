"use client";

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  History,
  RefreshCw,
  Save,
  Scale,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import {
  clearPendingScoringTransition,
  matchingGameplanSource,
  readPendingScoringTransition,
  type PendingScoringTransition,
} from "@/lib/gameplanScoringTransition";
import {
  buildExecutionComparison,
  calculateReceiptClassification,
  calculateReceiptScores,
  isGameplanExecutionPayload,
  type SocialGameplanExecutionPayload,
  type SocialObject,
  type SocialPrecordPayload,
  type SocialReceiptPayload,
} from "@/lib/socials";
import { SOCIAL_RECORD_RULES } from "@/lib/socialRecordConfig";

export type GameplanRecordTab = "scoring" | "previous";

type SocialsResponse = {
  objects?: SocialObject[];
  cloud?: boolean;
  error?: string;
};

type GameplanRecord = {
  plan: SocialObject<SocialPrecordPayload>;
  execution: SocialObject<SocialGameplanExecutionPayload> | null;
  receipt: SocialObject<SocialReceiptPayload> | null;
};

type EntryDraft = {
  actualDirection: "LONG" | "SHORT";
  fills: Array<{ price: string; size: string; time: string }>;
  actualStop: string;
  maximumActualRisk: string;
};

type OutcomeDraft = {
  outcome: "TARGET HIT" | "STOP HIT" | "MANUAL EXIT" | "BREAKEVEN";
  actualExit: string;
  exitTime: string;
  realisedPnl: string;
  fees: string;
  confirmationsAppeared: string;
  deviationReason: string;
  deviationDetail: string;
  outcomeReview: string;
  nextTimeRule: string;
  partialExits: string;
};

function payloadOf<T>(object: SocialObject | undefined): T | null {
  return object?.payload && typeof object.payload === "object" ? object.payload as T : null;
}

function numberLabel(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : "—";
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : value;
}

function localDateTimeValue(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function isoFromLocal(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function directionStyle(direction: SocialPrecordPayload["direction"]) {
  if (direction === "LONG") return "border-accent/25 bg-accent/[0.07] text-accent";
  if (direction === "SHORT") return "border-danger/25 bg-danger/[0.07] text-danger";
  return "border-border bg-surface text-muted";
}

function initialEntryDraft(plan: SocialPrecordPayload): EntryDraft {
  const now = localDateTimeValue();
  return {
    actualDirection: plan.direction === "SHORT" ? "SHORT" : "LONG",
    fills: [
      { price: "", size: plan.plannedSize?.toString() ?? "", time: now },
      { price: "", size: "", time: now },
      { price: "", size: "", time: now },
    ],
    actualStop: plan.plannedStop?.toString() ?? "",
    maximumActualRisk: plan.maximumRisk?.toString() ?? "",
  };
}

function initialOutcomeDraft(plan: SocialPrecordPayload, execution?: SocialGameplanExecutionPayload | null): OutcomeDraft {
  return {
    outcome: execution?.outcome ?? "TARGET HIT",
    actualExit: execution?.actualExit?.toString() ?? "",
    exitTime: execution?.exitTime ? localDateTimeValue(new Date(execution.exitTime)) : localDateTimeValue(),
    realisedPnl: execution?.realisedPnl?.toString() ?? "",
    fees: execution?.fees?.toString() ?? "",
    confirmationsAppeared: execution?.confirmationsAppeared ?? plan.confirmation,
    deviationReason: execution?.deviationReason ?? "",
    deviationDetail: execution?.deviationDetail ?? "",
    outcomeReview: execution?.outcomeReview ?? "",
    nextTimeRule: execution?.nextTimeRule ?? "",
    partialExits: execution?.partialExits ?? "",
  };
}

function adherenceDiscipline(comparison: NonNullable<SocialReceiptPayload["comparison"]>) {
  const relevant = comparison.filter((item) => item.dimension !== "Target / exit");
  const score = (status: (typeof relevant)[number]["status"]) => ({
    MATCHED: 100,
    SAFER: 100,
    MET: 100,
    VALID: 100,
    ADAPTED: 78,
    PARTIAL: 62,
    "NOT APPLICABLE": 72,
    DEVIATED: 35,
    RISKIER: 20,
    UNMET: 30,
    RETROSPECTIVE: 0,
  })[status] ?? 50;
  return relevant.length
    ? Math.round(relevant.reduce((sum, item) => sum + score(item.status), 0) / relevant.length)
    : 50;
}

function EntryReportForm({
  record,
  busy,
  onCancel,
  onSaved,
}: {
  record: GameplanRecord;
  busy: boolean;
  onCancel: () => void;
  onSaved: (object: SocialObject<SocialGameplanExecutionPayload>) => void;
}) {
  const [draft, setDraft] = useState<EntryDraft>(() => initialEntryDraft(record.plan.payload));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const fills = draft.fills
      .filter((fill) => fill.price.trim())
      .map((fill) => ({ price: Number(fill.price), size: numberOrNull(fill.size), time: isoFromLocal(fill.time) }));
    if (!fills.length || fills.some((fill) => !Number.isFinite(fill.price) || !fill.time)) {
      setError("Add at least one valid fill price and time.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/socials/gameplan-execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record-entry",
          planId: record.plan.id,
          actualDirection: draft.actualDirection,
          fills,
          actualStop: numberOrNull(draft.actualStop),
          maximumActualRisk: numberOrNull(draft.maximumActualRisk),
        }),
      });
      const result = await response.json().catch(() => null) as { object?: SocialObject<SocialGameplanExecutionPayload>; error?: string } | null;
      if (!response.ok || !result?.object) {
        setError(result?.error || "The entry could not be timestamped.");
        return;
      }
      onSaved(result.object);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-warning/15 bg-warning/[0.02] px-4 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <div className="text-[9px] font-semibold text-foreground">Record the actual entry</div>
          <p className="mt-1 text-[8px] leading-4 text-muted">At submission, each fill must have happened within the previous 10 minutes of real time. This is not measured from when the plan was locked.</p>
        </div>
        <label className="ml-auto min-w-[150px]">
          <span className="mb-1 block text-[7px] uppercase tracking-[0.13em] text-muted">Direction traded</span>
          <KwantSelect value={draft.actualDirection} onChange={(event) => setDraft((current) => ({ ...current, actualDirection: event.target.value as "LONG" | "SHORT" }))} className="h-9 w-full rounded-xl border border-border bg-background px-3 text-[9px]">
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </KwantSelect>
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {draft.fills.map((fill, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-border bg-background/45 p-3 sm:grid-cols-[58px_1fr_1fr_1.3fr] sm:items-end">
            <div className="pb-2 font-mono text-[8px] font-semibold text-primary">FILL {index + 1}</div>
            <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Price {index === 0 ? "*" : ""}</span><input type="number" step="any" value={fill.price} onChange={(event) => setDraft((current) => ({ ...current, fills: current.fills.map((item, itemIndex) => itemIndex === index ? { ...item, price: event.target.value } : item) }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/45" /></label>
            <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Size</span><input type="number" step="any" value={fill.size} onChange={(event) => setDraft((current) => ({ ...current, fills: current.fills.map((item, itemIndex) => itemIndex === index ? { ...item, size: event.target.value } : item) }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/45" /></label>
            <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Entry time {index === 0 ? "*" : ""}</span><input type="datetime-local" value={fill.time} onChange={(event) => setDraft((current) => ({ ...current, fills: current.fills.map((item, itemIndex) => itemIndex === index ? { ...item, time: event.target.value } : item) }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/45" /></label>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Actual stop</span><input type="number" step="any" value={draft.actualStop} onChange={(event) => setDraft((current) => ({ ...current, actualStop: event.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/45" /></label>
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Maximum risk</span><input type="number" step="any" value={draft.maximumActualRisk} onChange={(event) => setDraft((current) => ({ ...current, maximumActualRisk: event.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/45" /></label>
      </div>
      {error ? <div className="mt-3 rounded-lg border border-danger/20 bg-danger/[0.05] px-3 py-2 text-[8px] text-danger">{error}</div> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy || saving} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => void submit()} disabled={busy || saving} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-50">{saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <Clock3 className="h-3.5 w-3.5" />}{saving ? "Timestamping…" : "Timestamp entry"}</button>
      </div>
    </div>
  );
}

function OutcomeReportForm({
  record,
  busy,
  onCancel,
  onComplete,
}: {
  record: GameplanRecord;
  busy: boolean;
  onCancel: () => void;
  onComplete: (draft: OutcomeDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<OutcomeDraft>(() => initialOutcomeDraft(record.plan.payload, record.execution?.payload));
  const [error, setError] = useState("");
  const submit = async () => {
    if (!numberOrNull(draft.actualExit) || !draft.exitTime || numberOrNull(draft.realisedPnl) === null) {
      setError("Exit price, exit time and realised P&L are required. Use 0 for breakeven.");
      return;
    }
    setError("");
    try {
      await onComplete(draft);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The trade outcome could not be saved.");
    }
  };
  return (
    <div className="border-t border-primary/15 bg-primary/[0.02] px-4 py-4">
      <div className="text-[9px] font-semibold text-foreground">Complete the actual trade</div>
      <p className="mt-1 text-[8px] leading-4 text-muted">The entry is already protected. Add the outcome now or return when the trade closes.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Outcome *</span><KwantSelect value={draft.outcome} onChange={(event) => setDraft((current) => ({ ...current, outcome: event.target.value as OutcomeDraft["outcome"] }))} className="h-9 w-full rounded-xl border border-border bg-background px-3 text-[9px]"><option>TARGET HIT</option><option>STOP HIT</option><option>MANUAL EXIT</option><option>BREAKEVEN</option></KwantSelect></label>
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Final exit *</span><input type="number" step="any" value={draft.actualExit} onChange={(event) => setDraft((current) => ({ ...current, actualExit: event.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/45" /></label>
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Exit time *</span><input type="datetime-local" value={draft.exitTime} onChange={(event) => setDraft((current) => ({ ...current, exitTime: event.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/45" /></label>
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Realised P&amp;L *</span><input type="number" step="any" value={draft.realisedPnl} onChange={(event) => setDraft((current) => ({ ...current, realisedPnl: event.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/45" /></label>
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Fees</span><input type="number" step="any" value={draft.fees} onChange={(event) => setDraft((current) => ({ ...current, fees: event.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-[9px] outline-none focus:border-primary/45" /></label>
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">What changed?</span><KwantSelect value={draft.deviationReason} onChange={(event) => setDraft((current) => ({ ...current, deviationReason: event.target.value }))} className="h-9 w-full rounded-xl border border-border bg-background px-3 text-[9px]"><option value="">Followed locked plan</option><option>CONFIRMATION ARRIVED LATER</option><option>ENTRY USED A DEFINED ZONE</option><option>ORDER-FLOW CONDITIONS IMPROVED</option><option>ORIGINAL PRICE WAS MISSED</option><option>MARKET STRUCTURE CHANGED</option><option>IMPULSIVE DEVIATION</option><option>OTHER</option></KwantSelect></label>
        <label className="sm:col-span-2"><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Partial exits</span><input value={draft.partialExits} onChange={(event) => setDraft((current) => ({ ...current, partialExits: event.target.value }))} placeholder="Optional sizes and prices" className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[9px] outline-none focus:border-primary/45" /></label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Confirmations that appeared</span><textarea value={draft.confirmationsAppeared} onChange={(event) => setDraft((current) => ({ ...current, confirmationsAppeared: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/45" /></label>
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Deviation detail</span><textarea value={draft.deviationDetail} onChange={(event) => setDraft((current) => ({ ...current, deviationDetail: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/45" /></label>
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Outcome review</span><textarea value={draft.outcomeReview} onChange={(event) => setDraft((current) => ({ ...current, outcomeReview: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/45" /></label>
        <label><span className="mb-1 block text-[7px] uppercase tracking-[0.12em] text-muted">Next-time rule</span><textarea value={draft.nextTimeRule} onChange={(event) => setDraft((current) => ({ ...current, nextTimeRule: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-4 outline-none focus:border-primary/45" /></label>
      </div>
      {error ? <div className="mt-3 rounded-lg border border-danger/20 bg-danger/[0.05] px-3 py-2 text-[8px] text-danger">{error}</div> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="h-9 rounded-xl border border-border px-4 text-[8px] font-semibold text-muted disabled:opacity-50">Do later</button>
        <button type="button" onClick={() => void submit()} disabled={busy} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background disabled:opacity-50">{busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <Save className="h-3.5 w-3.5" />}{busy ? "Scoring against plan…" : "Save outcome & score"}</button>
      </div>
    </div>
  );
}

function GameplanRecordCard({
  record,
  complete,
  busy,
  onObjectSaved,
  onComplete,
}: {
  record: GameplanRecord;
  complete: boolean;
  busy: boolean;
  onObjectSaved: (object: SocialObject) => void;
  onComplete: (record: GameplanRecord, draft: OutcomeDraft) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { plan, receipt, execution } = record;
  const payload = plan.payload;
  const outcome = receipt?.payload ?? null;
  const targets = payload.plannedTargets?.length ? payload.plannedTargets : payload.plannedTarget !== null ? [payload.plannedTarget] : [];
  const finalScore = outcome?.scores?.final;
  const stateStyle = complete
    ? "border-accent/25 shadow-[0_0_28px_color-mix(in_srgb,var(--accent)_6%,transparent)]"
    : "border-warning/25 shadow-[0_0_28px_color-mix(in_srgb,var(--warning)_6%,transparent)]";
  const waitingForEntry = !complete && !execution;
  const waitingForOutcome = !complete && execution?.payload.stage === "ENTRY RECORDED";

  return (
    <article className={`overflow-hidden rounded-2xl border bg-panel ${stateStyle}`}>
      <div className={`flex flex-wrap items-center gap-2 border-b px-4 py-3 ${complete ? "border-accent/15 bg-accent/[0.035]" : "border-warning/15 bg-warning/[0.035]"}`}>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${complete ? "border-accent/20 bg-accent/10 text-accent" : "border-warning/20 bg-warning/10 text-warning"}`}>
          {complete ? <CheckCircle2 className="h-4 w-4" /> : waitingForOutcome ? <Clock3 className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
        </span>
        <div>
          <div className="flex items-center gap-2"><span className="font-mono text-[13px] font-semibold text-foreground">{payload.instrument}</span><span className={`rounded-md border px-2 py-0.5 text-[8px] font-bold tracking-[0.13em] ${directionStyle(payload.direction)}`}>{payload.direction}</span></div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.14em] text-muted">{payload.session || "Session not set"} · {payload.recordMode ?? "LIVE"}</div>
        </div>
        <div className="ml-auto text-right">
          <div className={`text-[9px] font-bold uppercase tracking-[0.13em] ${complete ? "text-accent" : "text-warning"}`}>{complete ? "Scored" : waitingForOutcome ? "Entry recorded · waiting for outcome" : "Waiting for trade info"}</div>
          <div className="mt-1 flex items-center justify-end gap-1.5 font-mono text-[8px] text-muted"><Clock3 className="h-3 w-3" /> {dateLabel(plan.createdAt)}</div>
        </div>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-panel p-3.5"><div className="text-[7px] uppercase tracking-[0.15em] text-muted">Planned entry</div><div className="mt-1.5 font-mono text-[12px] font-semibold text-foreground">{payload.plannedEntryLow === payload.plannedEntryHigh ? numberLabel(payload.plannedEntryLow) : `${numberLabel(payload.plannedEntryLow)} – ${numberLabel(payload.plannedEntryHigh)}`}</div></div>
        <div className="bg-panel p-3.5"><div className="text-[7px] uppercase tracking-[0.15em] text-muted">Stop</div><div className="mt-1.5 font-mono text-[12px] font-semibold text-danger">{numberLabel(payload.plannedStop)}</div></div>
        <div className="bg-panel p-3.5"><div className="text-[7px] uppercase tracking-[0.15em] text-muted">Targets</div><div className="mt-1.5 truncate font-mono text-[12px] font-semibold text-accent">{targets.length ? targets.map(numberLabel).join(" · ") : "—"}</div></div>
        <div className="bg-panel p-3.5"><div className="text-[7px] uppercase tracking-[0.15em] text-muted">{complete ? "Final reasoning score" : "Pre-trade score"}</div><div className={`mt-1.5 font-mono text-[12px] font-semibold ${complete ? "text-accent" : "text-warning"}`}>{complete && typeof finalScore === "number" ? `${Math.round(finalScore)}%` : `${Math.round(payload.reasoningScore ?? 0)}%`}</div></div>
      </div>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,.5fr)]">
        <div><div className="text-[7px] uppercase tracking-[0.15em] text-muted">Locked market reasoning</div><p className="mt-2 line-clamp-3 text-[10px] leading-5 text-foreground/85">{payload.marketContext || "No reasoning was attached to this game plan."}</p></div>
        <div className="rounded-xl border border-border bg-surface/55 p-3">
          {complete && outcome ? (
            <><div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-accent"><ShieldCheck className="h-3.5 w-3.5" />{outcome.outcome ?? outcome.classification}</div><div className="mt-2 grid grid-cols-2 gap-2 text-[8px] text-muted"><span>Entry <b className="ml-1 font-mono text-foreground">{numberLabel(outcome.actualEntry)}</b></span><span>Exit <b className="ml-1 font-mono text-foreground">{numberLabel(outcome.actualExit)}</b></span><span>Discipline <b className="ml-1 font-mono text-foreground">{Math.round(outcome.scores.discipline)}%</b></span><span>P&amp;L <b className={`ml-1 font-mono ${(outcome.realisedPnl ?? 0) >= 0 ? "text-accent" : "text-danger"}`}>{numberLabel(outcome.realisedPnl)}</b></span></div></>
          ) : execution ? (
            <><div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-primary"><CheckCircle2 className="h-3.5 w-3.5" />Entry timestamped</div><div className="mt-2 grid grid-cols-2 gap-2 text-[8px] text-muted"><span>Average <b className="ml-1 font-mono text-foreground">{numberLabel(execution.payload.actualEntry)}</b></span><span>Fills <b className="ml-1 font-mono text-foreground">{execution.payload.fills.length}</b></span><span className="col-span-2">Reported <b className="ml-1 font-mono text-foreground">{execution.payload.claimDelaySeconds}s after latest fill</b></span></div></>
          ) : (
            <><div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-warning"><Activity className="h-3.5 w-3.5" />Waiting for trade info</div><p className="mt-2 text-[9px] leading-4 text-muted">No score is produced from market movement alone. When logging a trade, its fill must be no more than 10 minutes old.</p></>
          )}
        </div>
      </div>

      {!complete ? (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-background/20 px-4 py-3">
          <div className="text-[8px] text-muted">{waitingForEntry ? "Fill must be from the previous 10 minutes of real time" : "Entry is locked; complete the outcome when the trade closes"}</div>
          <button type="button" onClick={() => setExpanded((current) => !current)} className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 text-[8px] font-semibold text-primary hover:bg-primary/10">{waitingForEntry ? "Add trade entry" : execution?.payload.stage === "CLOSED" ? "Finish scoring" : "Complete trade"}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>
        </div>
      ) : null}

      {expanded && waitingForEntry ? <EntryReportForm record={record} busy={busy} onCancel={() => setExpanded(false)} onSaved={(object) => { onObjectSaved(object); setExpanded(false); }} /> : null}
      {expanded && execution ? <OutcomeReportForm record={record} busy={busy} onCancel={() => setExpanded(false)} onComplete={async (draft) => { await onComplete(record, draft); setExpanded(false); }} /> : null}
    </article>
  );
}

export default function GameplanRecordsWorkspace({ tab }: { tab: GameplanRecordTab }) {
  const [objects, setObjects] = useState<SocialObject[]>([]);
  const [pendingTransition, setPendingTransition] = useState<PendingScoringTransition | null>(() => readPendingScoringTransition());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cloud, setCloud] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mergeObject = useCallback((object: SocialObject) => {
    setObjects((current) => [object, ...current.filter((candidate) => !(candidate.userId === object.userId && candidate.id === object.id))]);
  }, []);

  const loadRecords = useCallback(async (manual = false, silent = false) => {
    if (manual) setRefreshing(true);
    else if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/socials?mine=1&types=precord,receipt,consensus", { cache: "no-store" });
      const result = await response.json() as SocialsResponse;
      if (!response.ok) throw new Error(result.error ?? "Game plans could not be loaded.");
      const loadedObjects = Array.isArray(result.objects) ? result.objects : [];
      setObjects(loadedObjects);
      const pending = readPendingScoringTransition();
      if (pending && loadedObjects.some((object) => matchingGameplanSource(pending.record, object))) {
        clearPendingScoringTransition();
        setPendingTransition(null);
      } else setPendingTransition(pending);
      setCloud(result.cloud !== false);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Game plans could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  useEffect(() => {
    const refresh = () => void loadRecords(false, true);
    const started = (event: Event) => {
      const detail = (event as CustomEvent<{ record?: SocialObject<SocialPrecordPayload> }>).detail;
      const stored = readPendingScoringTransition();
      setPendingTransition(stored ?? (detail?.record ? { record: detail.record, state: "saving" } : null));
    };
    const locked = (event: Event) => {
      const detail = (event as CustomEvent<{ object?: SocialObject }>).detail;
      if (detail?.object) {
        mergeObject(detail.object);
        clearPendingScoringTransition();
        setPendingTransition(null);
      }
      void loadRecords(false, true);
    };
    const failed = (event: Event) => {
      const detail = (event as CustomEvent<{ error?: string }>).detail;
      setPendingTransition(readPendingScoringTransition());
      setError(detail?.error ?? "The Gameplan is still in holding and could not finish syncing.");
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("kwantdesk:gameplan-lock-started", started);
    window.addEventListener("kwantdesk:gameplan-locked", locked);
    window.addEventListener("kwantdesk:gameplan-lock-failed", failed);
    window.addEventListener("kwantdesk:gameplan-scored", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("kwantdesk:gameplan-lock-started", started);
      window.removeEventListener("kwantdesk:gameplan-locked", locked);
      window.removeEventListener("kwantdesk:gameplan-lock-failed", failed);
      window.removeEventListener("kwantdesk:gameplan-scored", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadRecords, mergeObject]);

  const visibleObjects = useMemo(() => {
    if (!pendingTransition || objects.some((object) => matchingGameplanSource(pendingTransition.record, object))) return objects;
    return [pendingTransition.record, ...objects];
  }, [objects, pendingTransition]);

  const records = useMemo(() => {
    const receipts = visibleObjects.filter((object) => object.objectType === "receipt");
    const executions = visibleObjects.filter((object) => object.objectType === "consensus" && isGameplanExecutionPayload(object.payload));
    return visibleObjects
      .filter((object) => object.objectType === "precord")
      .map((object): GameplanRecord | null => {
        const plan = payloadOf<SocialPrecordPayload>(object);
        if (!plan) return null;
        const receiptObject = receipts.find((receipt) => receipt.parentId === object.id);
        const executionObject = executions.find((execution) => execution.parentId === object.id);
        return {
          plan: { ...object, payload: plan },
          execution: executionObject ? { ...executionObject, payload: executionObject.payload as SocialGameplanExecutionPayload } : null,
          receipt: receiptObject ? { ...receiptObject, payload: payloadOf<SocialReceiptPayload>(receiptObject) as SocialReceiptPayload } : null,
        };
      })
      .filter((record): record is GameplanRecord => Boolean(record))
      .filter((record) => tab === "previous" ? Boolean(record.receipt) : !record.receipt)
      .sort((left, right) => Date.parse(right.plan.createdAt) - Date.parse(left.plan.createdAt));
  }, [tab, visibleObjects]);

  const completeTrade = useCallback(async (record: GameplanRecord, draft: OutcomeDraft) => {
    if (!record.execution) throw new Error("Record the entry first.");
    setBusyId(record.plan.id);
    setError(null);
    try {
      let executionObject = record.execution;
      if (record.execution.payload.stage !== "CLOSED") {
        const closeResponse = await fetch("/api/socials/gameplan-execution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete-trade",
            planId: record.plan.id,
            ...draft,
            actualExit: numberOrNull(draft.actualExit),
            exitTime: isoFromLocal(draft.exitTime),
            realisedPnl: numberOrNull(draft.realisedPnl),
            fees: numberOrNull(draft.fees),
          }),
        });
        const closed = await closeResponse.json().catch(() => null) as { object?: SocialObject<SocialGameplanExecutionPayload>; error?: string } | null;
        if (!closeResponse.ok || !closed?.object) throw new Error(closed?.error || "The trade outcome could not be saved.");
        executionObject = closed.object;
        mergeObject(executionObject);
      }

      const execution = executionObject.payload;
      const assessmentExecution = {
        actualDirection: execution.actualDirection,
        actualEntry: execution.actualEntry,
        entryTime: execution.entryTime,
        actualStop: execution.actualStop,
        actualExit: execution.actualExit ?? null,
        size: execution.size,
        maximumActualRisk: execution.maximumActualRisk,
        confirmationsAppeared: execution.confirmationsAppeared ?? "",
        deviationReason: execution.deviationReason ?? "",
        deviationDetail: execution.deviationDetail ?? "",
        outcomeReview: execution.outcomeReview ?? "",
        nextTimeRule: execution.nextTimeRule ?? "",
        noTrade: false,
        hasEvidence: false,
      };
      const comparison = buildExecutionComparison(record.plan.payload, assessmentExecution);
      const localClassification = calculateReceiptClassification(
        assessmentExecution.deviationReason,
        assessmentExecution.deviationDetail || (assessmentExecution.deviationReason ? "Trader supplied adaptation." : "Execution compared with the locked plan."),
        assessmentExecution.confirmationsAppeared,
        false,
        false,
      );
      let assessment: NonNullable<SocialReceiptPayload["assessment"]> = {
        classification: localClassification,
        explanation: "The timestamped execution was compared with the immutable Gameplan using Kwant Desk process rules.",
        evidenceUsed: ["Locked Gameplan", "Server-timestamped entry", "Trader-recorded outcome"],
        evidenceMissing: ["Broker-verified execution evidence"],
        confidence: 0.68,
        evaluator: "RULES",
        modelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
        rubricVersion: SOCIAL_RECORD_RULES.assessmentRubricVersion,
        assessedAt: new Date().toISOString(),
        appealAvailable: true,
      };
      try {
        const assessmentResponse = await fetch("/api/socials/assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: record.plan.payload, execution: assessmentExecution }),
        });
        const reviewed = await assessmentResponse.json().catch(() => null) as { assessment?: SocialReceiptPayload["assessment"] } | null;
        if (assessmentResponse.ok && reviewed?.assessment) assessment = reviewed.assessment;
      } catch {
        // Deterministic scoring remains available if the AI review is temporarily unavailable.
      }

      const baseScores = calculateReceiptScores({
        classification: assessment.classification,
        confirmations: assessmentExecution.confirmationsAppeared,
        review: assessmentExecution.outcomeReview,
        nextTimeRule: assessmentExecution.nextTimeRule,
        hasEvidence: false,
        noTrade: false,
      });
      const discipline = adherenceDiscipline(comparison);
      const final = Math.round(record.plan.payload.reasoningScore * 0.4 + discipline * 0.4 + baseScores.review * 0.1 + baseScores.evidenceConfidence * 0.1);
      const receiptPayload: SocialReceiptPayload = {
        actualDirection: execution.actualDirection,
        actualEntry: execution.actualEntry,
        entryTime: execution.entryTime,
        actualStop: execution.actualStop,
        actualExit: execution.actualExit ?? null,
        exitTime: execution.exitTime ?? null,
        size: execution.size,
        maximumActualRisk: execution.maximumActualRisk,
        partialExits: execution.partialExits ?? "",
        fees: execution.fees ?? null,
        confirmationsAppeared: execution.confirmationsAppeared ?? "",
        deviationReason: execution.deviationReason ?? "",
        deviationDetail: execution.deviationDetail ?? "",
        outcomeReview: execution.outcomeReview ?? "",
        nextTimeRule: execution.nextTimeRule ?? "",
        evidenceName: "",
        evidenceDataUrl: "",
        hasEvidence: false,
        noTrade: false,
        classification: assessment.classification,
        scores: { ...baseScores, discipline, execution: Math.round((discipline + baseScores.confirmation) / 2), final },
        addedAt: new Date().toISOString(),
        fills: execution.fills,
        exits: [{ price: execution.actualExit ?? null, size: execution.size, time: execution.exitTime ?? null }],
        comparison,
        retrospective: false,
        evidenceState: "PLATFORM TIMESTAMPED",
        assessment,
        scoreSnapshot: {
          reasoning: record.plan.payload.reasoningScore,
          reasoningModelVersion: record.plan.payload.scoreModelVersion ?? SOCIAL_RECORD_RULES.scoreModelVersion,
          postExecutionModelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
          createdAt: new Date().toISOString(),
        },
        realisedPnl: execution.realisedPnl ?? null,
        outcome: execution.outcome,
      };
      const receiptResponse = await fetch("/api/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ object: { id: `receipt:${record.plan.id}`, objectType: "receipt", scope: record.plan.scope, deskId: record.plan.deskId, parentId: record.plan.id, authorLabel: record.plan.authorLabel, payload: receiptPayload } }),
      });
      const saved = await receiptResponse.json().catch(() => null) as { object?: SocialObject<SocialReceiptPayload>; error?: string } | null;
      if (!receiptResponse.ok || !saved?.object) throw new Error(saved?.error || "The score could not be saved.");
      mergeObject(saved.object);
      window.dispatchEvent(new CustomEvent("kwantdesk:gameplan-scored", { detail: { recordId: record.plan.id, score: final } }));
    } finally {
      setBusyId(null);
    }
  }, [mergeObject]);

  const complete = tab === "previous";
  const copy = complete
    ? { eyebrow: "Account history", title: "Previous game plans", description: "Completed plans with their actual execution, discipline review and final reasoning score.", empty: "No game plans have completed scoring yet.", icon: History }
    : { eyebrow: "Execution queue", title: "Scoring", description: "Plans stay orange until the real entry is timestamped and the completed trade is reported.", empty: "No game plans are waiting for trade information.", icon: Scale };
  const HeadingIcon = copy.icon;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-[1500px] p-3 lg:p-5 xl:p-6">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-panel px-5 py-5 shadow-[0_18px_70px_rgba(0,0,0,.2)] sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,color-mix(in_srgb,var(--color-primary)_13%,transparent),transparent_36%)]" />
          <div className="relative flex flex-wrap items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><HeadingIcon className="h-5 w-5" /></span>
            <div><div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</div><h1 className="mt-1 text-[22px] font-semibold tracking-[-0.035em] text-foreground">{copy.title}</h1><p className="mt-1 text-[9px] leading-5 text-muted">{copy.description}</p></div>
            <div className="ml-auto flex items-center gap-2"><span className={`rounded-xl border px-3 py-2 font-mono text-[10px] font-semibold ${complete ? "border-accent/20 bg-accent/[0.06] text-accent" : "border-warning/20 bg-warning/[0.06] text-warning"}`}>{records.length} {complete ? "COMPLETE" : "ACTIVE"}</span><button type="button" onClick={() => void loadRecords(true)} disabled={refreshing} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:text-foreground disabled:opacity-50" aria-label="Refresh game plans"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /></button></div>
          </div>
        </section>

        {!complete ? <div className="mt-3 grid gap-2 md:grid-cols-3"><div className="rounded-xl border border-warning/20 bg-warning/[0.04] px-4 py-3"><div className="font-mono text-[8px] font-semibold text-warning">1 · LOCKED PLAN</div><p className="mt-1 text-[8px] text-muted">The approved holding record cannot change.</p></div><div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3"><div className="font-mono text-[8px] font-semibold text-primary">2 · ACTUAL EXECUTION</div><p className="mt-1 text-[8px] text-muted">At submission, the real fill must be no more than 10 minutes old. The outcome can follow later.</p></div><div className="rounded-xl border border-accent/20 bg-accent/[0.04] px-4 py-3"><div className="font-mono text-[8px] font-semibold text-accent">3 · REASONING SCORE</div><p className="mt-1 text-[8px] text-muted">Discipline is graded against the original plan.</p></div></div> : null}
        {!cloud ? <div className="mt-3 rounded-xl border border-warning/20 bg-warning/[0.05] px-4 py-3 text-[9px] text-warning">Account storage is not connected, so cloud game plans are unavailable.</div> : null}
        {error ? <div className="mt-3 rounded-xl border border-danger/20 bg-danger/[0.05] px-4 py-3 text-[9px] text-danger">{error}</div> : null}
        {pendingTransition ? <div className={`mt-3 flex items-center gap-2 rounded-xl border px-4 py-3 text-[9px] ${pendingTransition.state === "failed" ? "border-danger/20 bg-danger/[0.05] text-danger" : "border-primary/20 bg-primary/[0.05] text-primary"}`}>{pendingTransition.state === "failed" ? <ShieldCheck className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5 animate-spin" />}{pendingTransition.state === "failed" ? pendingTransition.error ?? "Account sync needs another attempt; the original plan remains safely in holding." : "Gameplan opened in Scoring. Account storage is syncing quietly in the background."}</div> : null}

        {loading && !records.length ? <KwantLoader className="min-h-[420px]" icon={HeadingIcon} title={complete ? "Loading previous game plans" : "Loading scoring queue"} detail="Reading your account-backed gameplan records" /> : records.length ? <div className="mt-4 space-y-3">{records.map((record) => <GameplanRecordCard key={record.plan.id} record={record} complete={complete} busy={busyId === record.plan.id} onObjectSaved={mergeObject} onComplete={completeTrade} />)}</div> : <div className="mt-4 flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/55 p-8 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.06] text-primary"><HeadingIcon className="h-5 w-5" /></span><h2 className="mt-4 text-[14px] font-semibold text-foreground">{copy.empty}</h2><p className="mt-2 max-w-md text-[9px] leading-5 text-muted">{complete ? "Once a trader reports the real execution and outcome, the scored record moves here." : "Lock and send a game plan from ZYON to place it into this execution queue."}</p></div>}

        <div className="mt-4 flex items-center gap-2 border-t border-border px-2 py-4 text-[8px] uppercase tracking-[0.14em] text-muted"><CalendarDays className="h-3.5 w-3.5 text-primary" /> Account-backed gameplan record<span className="ml-auto flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-primary" /> Plan → execution → score → history</span></div>
      </div>
    </div>
  );
}
