import { calculateReasoningScore, type SocialPrecordPayload } from "@/lib/socials";
import { SOCIAL_RECORD_RULES } from "@/lib/socialRecordConfig";
import {
  isZyonMarketRoot,
  normalizeZyonTradingAccount,
  type ZyonGameplanDirection,
  type ZyonGameplanDraft,
  type ZyonGameplanRiskUnit,
} from "@/lib/zyon";

export type ZyonGameplanDraftRow = {
  id: string;
  session_date: string;
  root: string;
  title: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function finite(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalFinite(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = finite(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cleanZyonGameplanText(value: unknown, maximum = 2_000) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maximum)
    : "";
}

export function zyonGameplanDraftFromRow(row: ZyonGameplanDraftRow): ZyonGameplanDraft | null {
  if (!isZyonMarketRoot(row.root)) return null;
  const payload = row.payload ?? {};
  const direction: ZyonGameplanDirection = payload.direction === "SHORT" ? "SHORT" : "LONG";
  const riskUnit: ZyonGameplanRiskUnit = ["DOLLARS", "POINTS", "TICKS", "PERCENT"].includes(String(payload.riskUnit))
    ? payload.riskUnit as ZyonGameplanRiskUnit
    : "DOLLARS";
  const entryLow = finite(payload.entryLow);
  const entryHigh = finite(payload.entryHigh, entryLow);
  const targets = Array.isArray(payload.targets)
    ? payload.targets.map((value) => finite(value, Number.NaN)).filter(Number.isFinite).slice(0, 8)
    : [];
  return {
    id: row.id,
    sessionDate: row.session_date,
    root: row.root,
    instrument: cleanZyonGameplanText(payload.instrument, 16).toUpperCase() || row.root,
    title: cleanZyonGameplanText(row.title, 120) || `${row.root} Gameplan`,
    direction,
    session: cleanZyonGameplanText(payload.session, 60) || "New York",
    entryTime: cleanZyonGameplanText(payload.entryTime, 80),
    entryLow: Math.min(entryLow, entryHigh),
    entryHigh: Math.max(entryLow, entryHigh),
    stop: finite(payload.stop),
    targets,
    riskAmount: optionalFinite(payload.riskAmount),
    riskUnit,
    size: optionalFinite(payload.size),
    tradingAccount: normalizeZyonTradingAccount(payload.tradingAccount),
    reasoning: cleanZyonGameplanText(payload.reasoning, 5_000),
    confluences: Array.isArray(payload.confluences)
      ? payload.confluences.map((value) => cleanZyonGameplanText(value, 300)).filter(Boolean).slice(0, 12)
      : [],
    confirmation: cleanZyonGameplanText(payload.confirmation, 2_000),
    invalidation: cleanZyonGameplanText(payload.invalidation, 2_000),
    notes: cleanZyonGameplanText(payload.notes, 4_000),
    expiryAt: cleanZyonGameplanText(payload.expiryAt, 60) || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recordMode: payload.recordMode === "HISTORICAL" ? "HISTORICAL" : "LIVE",
    cloudSaved: true,
  };
}

export function zyonGameplanRecordId(draftId: string) {
  const suffix = draftId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
  if (suffix.length < 8) throw new Error("The holding Gameplan identity is invalid.");
  return `precord:${suffix}`;
}

export function buildZyonGameplanPrecord(draft: ZyonGameplanDraft, lockedAt: string): SocialPrecordPayload {
  const entryLow = Math.min(draft.entryLow, draft.entryHigh);
  const entryHigh = Math.max(draft.entryLow, draft.entryHigh);
  const entry = (entryLow + entryHigh) / 2;
  const riskPoints = Math.abs(entry - draft.stop);
  const target = draft.targets[0] ?? null;
  const plannedRiskReward = target !== null && riskPoints > 0
    ? Number((Math.abs(target - entry) / riskPoints).toFixed(2))
    : null;
  const tradingAccount = normalizeZyonTradingAccount(draft.tradingAccount);
  const recordMode = draft.recordMode === "HISTORICAL" ? "HISTORICAL" : "LIVE";
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
      at: lockedAt,
      source: "ZYON",
      note: recordMode === "HISTORICAL"
        ? "Trader reviewed and locked a historical Gameplan for end-to-end scoring."
        : "Trader reviewed the ZYON holding record and sent it to Scoring.",
    }],
  };
  return {
    ...base,
    lockedAt,
    reasoningScore: calculateReasoningScore(base),
    status: "LOCKED",
  };
}
