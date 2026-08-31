import { NextResponse, type NextRequest } from "next/server";

import { getSocialsRouteActor } from "@/lib/serverAuth";
import {
  buildExecutionComparison,
  calculateReceiptClassification,
  calculateReceiptScores,
  type SocialExecutionComparison,
  type SocialGameplanExecutionPayload,
  type SocialObject,
  type SocialPrecordPayload,
  type SocialReceiptPayload,
} from "@/lib/socials";
import { SOCIAL_RECORD_RULES } from "@/lib/socialRecordConfig";
import { createSocialsServiceClient } from "@/lib/socialsStorage.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SocialRow = {
  user_id: string;
  id: string;
  author_label: string;
  object_type: "receipt";
  scope: "private" | "friends" | "desk" | "community";
  desk_id: string | null;
  parent_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function cleanIdentifier(value: unknown, maximum = 180) {
  return typeof value === "string" ? value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, maximum) : "";
}

function fromRow(row: SocialRow): SocialObject<SocialReceiptPayload> {
  return {
    id: row.id,
    userId: row.user_id,
    authorLabel: row.author_label,
    objectType: row.object_type,
    scope: row.scope,
    deskId: row.desk_id,
    parentId: row.parent_id,
    payload: row.payload as unknown as SocialReceiptPayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cloudSaved: true,
  };
}

function adherenceDiscipline(comparison: SocialExecutionComparison[]) {
  const relevant = comparison.filter((item) => item.dimension !== "Target / exit");
  const scores: Record<SocialExecutionComparison["status"], number> = {
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
  };
  return relevant.length
    ? Math.round(relevant.reduce((sum, item) => sum + (scores[item.status] ?? 50), 0) / relevant.length)
    : 50;
}

export async function POST(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return response({ error: "Authentication required.", code: "socials_unauthorized" }, 401);
  let body: { planId?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return response({ error: "The score request could not be read.", code: "socials_invalid_request" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !Object.hasOwn(body, "planId")) {
    return response({ error: "The score request is invalid.", code: "socials_invalid_request" }, 400);
  }
  const planId = cleanIdentifier(body.planId);
  if (!planId) return response({ error: "Choose a locked Gameplan.", code: "socials_invalid_request" }, 400);

  try {
    const supabase = createSocialsServiceClient();
    const receiptId = `receipt:${planId}`;
    const select = "user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at";
    const { data: existing, error: existingError } = await supabase
      .from("social_objects")
      .select(select)
      .eq("user_id", actor.userId)
      .eq("id", receiptId)
      .eq("object_type", "receipt")
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return response({ object: fromRow(existing as SocialRow), idempotent: true }, 200);

    const [{ data: planRow, error: planError }, { data: executionRow, error: executionError }] = await Promise.all([
      supabase.from("social_objects")
        .select("id,author_label,scope,desk_id,payload,created_at")
        .eq("user_id", actor.userId).eq("id", planId).eq("object_type", "precord").maybeSingle(),
      supabase.from("social_objects")
        .select("id,payload")
        .eq("user_id", actor.userId).eq("id", `gameplan-execution:${planId}`).eq("object_type", "consensus").maybeSingle(),
    ]);
    if (planError || !planRow) return response({ error: "Only the owner can score this Gameplan.", code: "socials_gameplan_forbidden" }, 403);
    if (executionError || !executionRow) return response({ error: "Record the real entry and outcome before scoring.", code: "socials_gameplan_execution_required" }, 409);
    const plan = planRow.payload as unknown as SocialPrecordPayload;
    const execution = executionRow.payload as unknown as SocialGameplanExecutionPayload;
    if (execution.kind !== "GAMEPLAN_EXECUTION" || execution.stage !== "CLOSED"
        || execution.actualExit === null || execution.actualExit === undefined || !execution.exitTime) {
      return response({ error: "Complete the timestamped trade before scoring.", code: "socials_gameplan_execution_open" }, 409);
    }

    const assessmentExecution = {
      actualDirection: execution.actualDirection,
      actualEntry: execution.actualEntry,
      entryTime: execution.entryTime,
      actualStop: execution.actualStop,
      actualExit: execution.actualExit,
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
    const comparison = buildExecutionComparison(plan, assessmentExecution);
    const classification = calculateReceiptClassification(
      assessmentExecution.deviationReason,
      assessmentExecution.deviationDetail || (assessmentExecution.deviationReason ? "Trader supplied adaptation." : "Execution compared with the locked plan."),
      assessmentExecution.confirmationsAppeared,
      false,
      false,
    );
    const now = new Date().toISOString();
    const assessment: NonNullable<SocialReceiptPayload["assessment"]> = {
      classification,
      explanation: "The timestamped execution was compared with the immutable Gameplan using Kwant Desk process rules.",
      evidenceUsed: ["Locked Gameplan", "Server-timestamped entry", "Trader-recorded outcome"],
      evidenceMissing: ["Broker-verified execution evidence"],
      confidence: 0.68,
      evaluator: "RULES",
      modelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
      rubricVersion: SOCIAL_RECORD_RULES.assessmentRubricVersion,
      assessedAt: now,
      appealAvailable: true,
    };
    const baseScores = calculateReceiptScores({
      classification,
      confirmations: assessmentExecution.confirmationsAppeared,
      review: assessmentExecution.outcomeReview,
      nextTimeRule: assessmentExecution.nextTimeRule,
      hasEvidence: false,
      noTrade: false,
    });
    const discipline = adherenceDiscipline(comparison);
    const final = Math.round(plan.reasoningScore * 0.4 + discipline * 0.4 + baseScores.review * 0.1 + baseScores.evidenceConfidence * 0.1);
    const payload: SocialReceiptPayload = {
      actualDirection: execution.actualDirection,
      actualEntry: execution.actualEntry,
      entryTime: execution.entryTime,
      actualStop: execution.actualStop,
      actualExit: execution.actualExit,
      exitTime: execution.exitTime,
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
      classification,
      scores: { ...baseScores, discipline, execution: Math.round((discipline + baseScores.confirmation) / 2), final },
      addedAt: now,
      fills: execution.fills,
      exits: [{ price: execution.actualExit, size: execution.size, time: execution.exitTime }],
      comparison,
      retrospective: false,
      evidenceState: "PLATFORM TIMESTAMPED",
      assessment,
      scoreSnapshot: {
        reasoning: plan.reasoningScore,
        reasoningModelVersion: plan.scoreModelVersion ?? SOCIAL_RECORD_RULES.scoreModelVersion,
        postExecutionModelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
        createdAt: now,
      },
      realisedPnl: execution.realisedPnl ?? null,
      outcome: execution.outcome,
    };
    const { data, error } = await supabase.from("social_objects").insert({
      user_id: actor.userId,
      id: receiptId,
      author_label: planRow.author_label,
      object_type: "receipt",
      scope: planRow.scope,
      desk_id: planRow.desk_id,
      parent_id: planId,
      payload,
      updated_at: now,
    }).select(select).single();
    if (error || !data) {
      if (error?.code === "23505") {
        const { data: raced } = await supabase.from("social_objects").select(select)
          .eq("user_id", actor.userId).eq("id", receiptId).eq("object_type", "receipt").maybeSingle();
        if (raced) return response({ object: fromRow(raced as SocialRow), idempotent: true }, 200);
      }
      throw error ?? new Error("The score receipt was not saved.");
    }
    return response({ object: fromRow(data as SocialRow), idempotent: false }, 201);
  } catch (error) {
    console.error("Desktop GAMEPLAN scoring failed", error);
    return response({ error: "The immutable plan and execution remain saved, but scoring could not be completed.", code: "socials_gameplan_score_unavailable" }, 502);
  }
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
