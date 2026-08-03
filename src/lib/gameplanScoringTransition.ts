import {
  calculateReasoningScore,
  type SocialObject,
  type SocialPrecordPayload,
} from "@/lib/socials";
import { SOCIAL_RECORD_RULES } from "@/lib/socialRecordConfig";
import {
  normalizeZyonTradingAccount,
  type ZyonGameplanDraft,
} from "@/lib/zyon";

const PENDING_SCORING_KEY = "kwantdesk:pending-scoring-record";

export type PendingScoringTransition = {
  record: SocialObject<SocialPrecordPayload>;
  state: "saving" | "saved" | "failed";
  error?: string;
};

function safeRecordId(draftId: string) {
  const suffix = draftId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
  return `precord:${suffix.length >= 8 ? suffix : `${suffix}_${Date.now()}`}`;
}

export function buildGameplanScoringRecord(
  draft: ZyonGameplanDraft,
  options: {
    userId?: string;
    authorLabel?: string;
    recordMode?: "LIVE" | "HISTORICAL";
    id?: string;
    createdAt?: string;
  } = {},
): SocialObject<SocialPrecordPayload> {
  const now = options.createdAt ?? new Date().toISOString();
  const recordMode = options.recordMode ?? draft.recordMode ?? "LIVE";
  const entryLow = Math.min(draft.entryLow, draft.entryHigh);
  const entryHigh = Math.max(draft.entryLow, draft.entryHigh);
  const entry = (entryLow + entryHigh) / 2;
  const riskPoints = Math.abs(entry - draft.stop);
  const target = draft.targets[0] ?? null;
  const plannedRiskReward = target !== null && riskPoints > 0
    ? Number((Math.abs(target - entry) / riskPoints).toFixed(2))
    : null;
  const tradingAccount = normalizeZyonTradingAccount(draft.tradingAccount);
  const base: Omit<SocialPrecordPayload, "lockedAt" | "reasoningScore" | "status"> = {
    instrument: draft.instrument,
    session: draft.session,
    direction: draft.direction,
    marketContext: draft.reasoning,
    plannedEntryTime: draft.entryTime || null,
    plannedEntryLow: entryLow,
    plannedEntryHigh: entryHigh,
    plannedStop: draft.stop,
    plannedTarget: target,
    plannedTargets: draft.targets,
    plannedSize: draft.size,
    maximumRisk: draft.riskAmount,
    riskUnit: draft.riskUnit,
    tradingAccount,
    plannedRiskReward,
    confluences: draft.confluences,
    bullCondition: draft.direction === "LONG" ? draft.confirmation : "",
    bearCondition: draft.direction === "SHORT" ? draft.confirmation : "",
    confirmation: draft.confirmation,
    invalidation: draft.invalidation,
    traderNotes: draft.notes,
    expiryAt: draft.expiryAt,
    source: "ZYON",
    sourceGameplanId: draft.id,
    sourceGameplanVersion: "zyon-structured-v1",
    sourceGeneratedAt: draft.updatedAt,
    gameplanSnapshot: {
      title: draft.title,
      root: draft.root,
      sessionDate: draft.sessionDate,
      instrument: draft.instrument,
      direction: draft.direction,
      session: draft.session,
      entryTime: draft.entryTime,
      entry: [entryLow, entryHigh],
      stop: draft.stop,
      targets: draft.targets,
      riskAmount: draft.riskAmount,
      riskUnit: draft.riskUnit,
      size: draft.size,
      tradingAccount,
      reasoning: draft.reasoning,
      confirmation: draft.confirmation,
      invalidation: draft.invalidation,
      confluences: draft.confluences,
      notes: draft.notes,
      expiryAt: draft.expiryAt,
    },
    scoreModelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
    evidenceState: recordMode === "HISTORICAL" ? "SELF REPORTED" : "PLATFORM TIMESTAMPED",
    recordMode,
    lifecycle: [{
      status: "LOCKED",
      at: now,
      source: "ZYON",
      note: recordMode === "HISTORICAL"
        ? "Trader reviewed and locked a historical Gameplan for end-to-end scoring."
        : "Trader reviewed the ZYON holding record and sent it to Scoring.",
    }],
  };

  return {
    id: options.id ?? safeRecordId(draft.id),
    userId: options.userId ?? "pending",
    authorLabel: options.authorLabel ?? "You",
    objectType: "precord",
    scope: "community",
    deskId: null,
    parentId: null,
    payload: {
      ...base,
      lockedAt: now,
      reasoningScore: calculateReasoningScore(base),
      status: "LOCKED",
    },
    createdAt: now,
    updatedAt: now,
    cloudSaved: false,
  };
}

export function readPendingScoringTransition(): PendingScoringTransition | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(PENDING_SCORING_KEY) ?? "null") as PendingScoringTransition | null;
    return parsed?.record?.objectType === "precord" ? parsed : null;
  } catch {
    return null;
  }
}

export function writePendingScoringTransition(value: PendingScoringTransition) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_SCORING_KEY, JSON.stringify(value));
}

export async function persistGameplanScoringRecord(
  record: SocialObject<SocialPrecordPayload>,
): Promise<SocialObject<SocialPrecordPayload>> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("/api/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: {
            id: record.id,
            objectType: "precord",
            scope: record.scope,
            deskId: record.deskId,
            parentId: record.parentId,
            authorLabel: record.authorLabel,
            payload: record.payload,
          },
        }),
      });
      const result = await response.json().catch(() => null) as {
        object?: SocialObject<SocialPrecordPayload>;
        error?: string;
      } | null;
      if (response.ok && result?.object) return { ...result.object, cloudSaved: true };
      lastError = new Error(result?.error || "The Gameplan did not reach account storage.");
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("The Gameplan did not reach account storage.");
    }
    if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 350 : 900));
  }
  throw lastError ?? new Error("The Gameplan did not reach account storage.");
}

export function clearPendingScoringTransition() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_SCORING_KEY);
}

export function matchingGameplanSource(
  left: SocialObject<SocialPrecordPayload>,
  right: SocialObject,
) {
  const payload = right.payload as Partial<SocialPrecordPayload> | undefined;
  return Boolean(
    left.id === right.id
    || (left.payload.sourceGameplanId && left.payload.sourceGameplanId === payload?.sourceGameplanId),
  );
}
