"use client";

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  RefreshCw,
  Scale,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import {
  buildAutomaticGameplanReceipt,
  evaluateReasoningPath,
  type SocialReasoningCandle,
  type SocialObject,
  type SocialPrecordPayload,
  type SocialReceiptPayload,
} from "@/lib/socials";

export type GameplanRecordTab = "scoring" | "previous";

type SocialsResponse = {
  objects?: SocialObject[];
  cloud?: boolean;
  error?: string;
};

type GameplanRecord = {
  plan: SocialObject<SocialPrecordPayload>;
  receipt: SocialObject<SocialReceiptPayload> | null;
};

function payloadOf<T>(object: SocialObject | undefined): T | null {
  return object?.payload && typeof object.payload === "object"
    ? object.payload as T
    : null;
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

function directionStyle(direction: SocialPrecordPayload["direction"]) {
  if (direction === "LONG") return "border-accent/25 bg-accent/[0.07] text-accent";
  if (direction === "SHORT") return "border-danger/25 bg-danger/[0.07] text-danger";
  return "border-border bg-surface text-muted";
}

function GameplanRecordCard({ record, complete }: { record: GameplanRecord; complete: boolean }) {
  const { plan, receipt } = record;
  const payload = plan.payload;
  const outcome = receipt?.payload ?? null;
  const targets = payload.plannedTargets?.length
    ? payload.plannedTargets
    : payload.plannedTarget !== null
      ? [payload.plannedTarget]
      : [];
  const finalScore = outcome?.scores?.final;
  const stateStyle = complete
    ? "border-accent/25 shadow-[0_0_28px_color-mix(in_srgb,var(--accent)_6%,transparent)]"
    : "border-warning/25 shadow-[0_0_28px_color-mix(in_srgb,var(--warning)_6%,transparent)]";

  return (
    <article className={`overflow-hidden rounded-2xl border bg-panel ${stateStyle}`}>
      <div className={`flex flex-wrap items-center gap-2 border-b px-4 py-3 ${complete ? "border-accent/15 bg-accent/[0.035]" : "border-warning/15 bg-warning/[0.035]"}`}>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${complete ? "border-accent/20 bg-accent/10 text-accent" : "border-warning/20 bg-warning/10 text-warning"}`}>
          {complete ? <CheckCircle2 className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-foreground">{payload.instrument}</span>
            <span className={`rounded-md border px-2 py-0.5 text-[8px] font-bold tracking-[0.13em] ${directionStyle(payload.direction)}`}>{payload.direction}</span>
          </div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.14em] text-muted">{payload.session || "Session not set"} · {payload.recordMode ?? "LIVE"}</div>
        </div>
        <div className="ml-auto text-right">
          <div className={`text-[9px] font-bold uppercase tracking-[0.13em] ${complete ? "text-accent" : "text-warning"}`}>
            {complete ? "Scored" : "Scoring in progress"}
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5 font-mono text-[8px] text-muted">
            <Clock3 className="h-3 w-3" /> {dateLabel(plan.createdAt)}
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-panel p-3.5">
          <div className="text-[7px] uppercase tracking-[0.15em] text-muted">Planned entry</div>
          <div className="mt-1.5 font-mono text-[12px] font-semibold text-foreground">
            {payload.plannedEntryLow === payload.plannedEntryHigh
              ? numberLabel(payload.plannedEntryLow)
              : `${numberLabel(payload.plannedEntryLow)} – ${numberLabel(payload.plannedEntryHigh)}`}
          </div>
        </div>
        <div className="bg-panel p-3.5">
          <div className="text-[7px] uppercase tracking-[0.15em] text-muted">Stop</div>
          <div className="mt-1.5 font-mono text-[12px] font-semibold text-danger">{numberLabel(payload.plannedStop)}</div>
        </div>
        <div className="bg-panel p-3.5">
          <div className="text-[7px] uppercase tracking-[0.15em] text-muted">Targets</div>
          <div className="mt-1.5 truncate font-mono text-[12px] font-semibold text-accent">{targets.length ? targets.map(numberLabel).join(" · ") : "—"}</div>
        </div>
        <div className="bg-panel p-3.5">
          <div className="text-[7px] uppercase tracking-[0.15em] text-muted">{complete ? "Reasoning score" : "Pre-trade score"}</div>
          <div className={`mt-1.5 font-mono text-[12px] font-semibold ${complete ? "text-accent" : "text-warning"}`}>
            {complete && typeof finalScore === "number" ? `${Math.round(finalScore)}%` : `${Math.round(payload.reasoningScore ?? 0)}%`}
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,.5fr)]">
        <div>
          <div className="text-[7px] uppercase tracking-[0.15em] text-muted">Market reasoning</div>
          <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-foreground/85">{payload.marketContext || "No reasoning was attached to this game plan."}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface/55 p-3">
          {complete && outcome ? (
            <>
              <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-accent"><ShieldCheck className="h-3.5 w-3.5" />{outcome.classification}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[8px] text-muted">
                <span>Actual entry <b className="ml-1 font-mono text-foreground">{numberLabel(outcome.actualEntry)}</b></span>
                <span>Actual exit <b className="ml-1 font-mono text-foreground">{numberLabel(outcome.actualExit)}</b></span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-warning"><Activity className="h-3.5 w-3.5" />Awaiting outcome</div>
              <p className="mt-2 text-[9px] leading-4 text-muted">This locked plan remains here until its execution and market outcome have been reviewed.</p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function GameplanRecordsWorkspace({ tab }: { tab: GameplanRecordTab }) {
  const [objects, setObjects] = useState<SocialObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cloud, setCloud] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scoringRef = useRef(new Set<string>());

  const loadRecords = useCallback(async (manual = false, silent = false) => {
    if (manual) setRefreshing(true);
    else if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/socials?mine=1&types=precord,receipt", { cache: "no-store" });
      const result = await response.json() as SocialsResponse;
      if (!response.ok) throw new Error(result.error ?? "Game plans could not be loaded.");
      setObjects(Array.isArray(result.objects) ? result.objects : []);
      setCloud(result.cloud !== false);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Game plans could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    const refresh = () => void loadRecords(false, true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("kwantdesk:gameplan-locked", refresh);
    window.addEventListener("kwantdesk:gameplan-scored", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("kwantdesk:gameplan-locked", refresh);
      window.removeEventListener("kwantdesk:gameplan-scored", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadRecords]);

  const records = useMemo(() => {
    const receipts = objects.filter((object) => object.objectType === "receipt");
    return objects
      .filter((object) => object.objectType === "precord")
      .map((object): GameplanRecord | null => {
        const plan = payloadOf<SocialPrecordPayload>(object);
        if (!plan) return null;
        const receiptObject = receipts.find((receipt) => receipt.parentId === object.id);
        return {
          plan: { ...object, payload: plan },
          receipt: receiptObject
            ? { ...receiptObject, payload: payloadOf<SocialReceiptPayload>(receiptObject) as SocialReceiptPayload }
            : null,
        };
      })
      .filter((record): record is GameplanRecord => Boolean(record))
      .filter((record) => tab === "previous" ? Boolean(record.receipt) : !record.receipt)
      .sort((left, right) => Date.parse(right.plan.createdAt) - Date.parse(left.plan.createdAt));
  }, [objects, tab]);

  const complete = tab === "previous";

  useEffect(() => {
    if (tab !== "scoring" || loading || !records.length) return;
    let cancelled = false;
    const evaluateOpenRecords = async () => {
      const byRoot = new Map<"NQ" | "ES", GameplanRecord[]>();
      for (const record of records) {
        if (record.receipt || !["LONG", "SHORT"].includes(record.plan.payload.direction)) continue;
        const root = record.plan.payload.instrument.toUpperCase().includes("NQ") ? "NQ" : "ES";
        byRoot.set(root, [...(byRoot.get(root) ?? []), record]);
      }
      await Promise.all([...byRoot.entries()].map(async ([root, rootRecords]) => {
        try {
          const response = await fetch(`/api/databento/market?symbol=${root}.v.0&timeframe=5m&days=14`, { cache: "no-store" });
          const body = await response.json() as { candles?: SocialReasoningCandle[] };
          if (!response.ok || !Array.isArray(body.candles) || cancelled) return;
          for (const record of rootRecords) {
            const metrics = evaluateReasoningPath(record.plan.payload, body.candles);
            if (!metrics || metrics.status === "IN PROGRESS" || scoringRef.current.has(record.plan.id) || cancelled) continue;
            scoringRef.current.add(record.plan.id);
            try {
              const saveResponse = await fetch("/api/socials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  object: {
                    id: `receipt:${record.plan.id}`,
                    objectType: "receipt",
                    scope: record.plan.scope,
                    deskId: record.plan.deskId,
                    parentId: record.plan.id,
                    authorLabel: record.plan.authorLabel,
                    payload: buildAutomaticGameplanReceipt(record.plan.payload, metrics),
                  },
                }),
              });
              const saved = await saveResponse.json() as { object?: SocialObject; error?: string };
              if (!saveResponse.ok || !saved.object) throw new Error(saved.error ?? "The scored result could not be saved.");
              if (cancelled) return;
              setObjects((current) => [
                saved.object as SocialObject,
                ...current.filter((object) => !(object.objectType === "receipt" && object.parentId === record.plan.id)),
              ]);
              window.dispatchEvent(new CustomEvent("kwantdesk:gameplan-scored", {
                detail: { recordId: record.plan.id, score: metrics.outcomeScore },
              }));
            } catch (scoreError) {
              if (!cancelled) setError(scoreError instanceof Error ? scoreError.message : "The scored result could not be saved.");
            } finally {
              scoringRef.current.delete(record.plan.id);
            }
          }
        } catch {
          // Keep the locked plan orange when the market history feed is temporarily unavailable.
        }
      }));
    };
    void evaluateOpenRecords();
    const timer = window.setInterval(() => void evaluateOpenRecords(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loading, records, tab]);

  const copy = complete
    ? {
        eyebrow: "Account history",
        title: "Previous game plans",
        description: "Completed plans and their final execution review, kept against your account.",
        empty: "No game plans have completed scoring yet.",
        icon: History,
      }
    : {
        eyebrow: "Live judgement queue",
        title: "Scoring",
        description: "Locked game plans stay here while their execution and outcome are being judged.",
        empty: "No game plans are currently being scored.",
        icon: Scale,
      };
  const HeadingIcon = copy.icon;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-[1500px] p-3 lg:p-5 xl:p-6">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-panel px-5 py-5 shadow-[0_18px_70px_rgba(0,0,0,.2)] sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,color-mix(in_srgb,var(--color-primary)_13%,transparent),transparent_36%)]" />
          <div className="relative flex flex-wrap items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><HeadingIcon className="h-5 w-5" /></span>
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</div>
              <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.035em] text-foreground">{copy.title}</h1>
              <p className="mt-1 text-[9px] leading-5 text-muted">{copy.description}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`rounded-xl border px-3 py-2 font-mono text-[10px] font-semibold ${complete ? "border-accent/20 bg-accent/[0.06] text-accent" : "border-warning/20 bg-warning/[0.06] text-warning"}`}>{records.length} {complete ? "COMPLETE" : "ACTIVE"}</span>
              <button type="button" onClick={() => void loadRecords(true)} disabled={refreshing} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:text-foreground disabled:opacity-50" aria-label="Refresh game plans"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /></button>
            </div>
          </div>
        </section>

        {!cloud ? <div className="mt-3 rounded-xl border border-warning/20 bg-warning/[0.05] px-4 py-3 text-[9px] text-warning">Account storage is not connected, so cloud game plans are unavailable.</div> : null}
        {error ? <div className="mt-3 rounded-xl border border-danger/20 bg-danger/[0.05] px-4 py-3 text-[9px] text-danger">{error}</div> : null}

        {loading ? (
          <KwantLoader className="min-h-[420px]" icon={HeadingIcon} title={complete ? "Loading previous game plans" : "Loading scoring queue"} detail="Reading your account-backed gameplan records" />
        ) : records.length ? (
          <div className="mt-4 space-y-3">{records.map((record) => <GameplanRecordCard key={record.plan.id} record={record} complete={complete} />)}</div>
        ) : (
          <div className="mt-4 flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/55 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.06] text-primary"><HeadingIcon className="h-5 w-5" /></span>
            <h2 className="mt-4 text-[14px] font-semibold text-foreground">{copy.empty}</h2>
            <p className="mt-2 max-w-md text-[9px] leading-5 text-muted">{complete ? "Once an active game plan receives its outcome review and score, it will move here automatically." : "Lock and send a game plan from ZYON to place it into the scoring lifecycle."}</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-border px-2 py-4 text-[8px] uppercase tracking-[0.14em] text-muted">
          <CalendarDays className="h-3.5 w-3.5 text-primary" /> Account-backed gameplan record
          <span className="ml-auto flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-primary" /> Plan → score → history</span>
        </div>
      </div>
    </div>
  );
}
