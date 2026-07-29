import { NextResponse, type NextRequest } from "next/server";
import { getRouteActor } from "@/lib/serverAuth";
import {
  buildExecutionComparison,
  calculateReceiptClassification,
  type SocialPrecordPayload,
  type SocialReceiptPayload,
} from "@/lib/socials";
import { getClaudeApiKey, runClaudeMessage } from "@/lib/claude.server";
import { SOCIAL_RECORD_RULES } from "@/lib/socialRecordConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AssessmentInput = {
  plan?: SocialPrecordPayload;
  execution?: Pick<
    SocialReceiptPayload,
    | "actualEntry"
    | "actualDirection"
    | "actualStop"
    | "actualExit"
    | "entryTime"
    | "size"
    | "maximumActualRisk"
    | "confirmationsAppeared"
    | "deviationReason"
    | "deviationDetail"
    | "outcomeReview"
    | "nextTimeRule"
    | "noTrade"
    | "hasEvidence"
  >;
};

function fallbackAssessment(plan: SocialPrecordPayload, execution: NonNullable<AssessmentInput["execution"]>) {
  const classification = calculateReceiptClassification(
    execution.deviationReason,
    execution.deviationDetail,
    execution.confirmationsAppeared,
    Boolean(execution.hasEvidence),
    execution.noTrade,
  );
  return {
    classification,
    explanation: execution.noTrade
      ? "No execution was recorded. The record remains process-complete when the stated confirmation did not appear."
      : classification === "UNJUSTIFIED DEVIATION"
        ? "The execution was identified as an impulsive deviation from the locked plan."
        : classification === "INSUFFICIENT EVIDENCE"
          ? "There is not enough timestamped evidence to validate the change from the locked plan."
          : "The supplied execution, confirmation and explanation were compared with the immutable plan.",
    evidenceUsed: [
      "Locked Gameplan snapshot",
      execution.confirmationsAppeared ? "Trader-recorded confirmation" : "",
      execution.hasEvidence ? "Private execution attachment" : "",
      execution.deviationDetail ? "Trader deviation explanation" : "",
    ].filter(Boolean),
    evidenceMissing: [
      execution.hasEvidence ? "" : "Broker-verified execution evidence",
      execution.confirmationsAppeared ? "" : "Observed confirmation detail",
    ].filter(Boolean),
    confidence: execution.hasEvidence && execution.confirmationsAppeared ? 0.78 : 0.54,
    evaluator: "RULES" as const,
    modelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
    rubricVersion: SOCIAL_RECORD_RULES.assessmentRubricVersion,
    assessedAt: new Date().toISOString(),
    appealAvailable: true,
  };
}

function extractJson(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: AssessmentInput;
  try {
    body = await request.json() as AssessmentInput;
  } catch {
    return NextResponse.json({ error: "The assessment request could not be read." }, { status: 400 });
  }
  if (!body.plan || !body.execution) {
    return NextResponse.json({ error: "A locked plan and actual execution are required." }, { status: 400 });
  }

  const comparison = buildExecutionComparison(body.plan, body.execution);
  const fallback = fallbackAssessment(body.plan, body.execution);
  const apiKey = getClaudeApiKey();
  if (!apiKey) return NextResponse.json({ comparison, assessment: fallback });

  try {
    const text = await runClaudeMessage({
      apiKey,
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      maxTokens: 700,
      system: [
        "You are ZYON's process-review layer inside Kwant Desk.",
        "Assess discipline, not profitability. Use only evidence available in the supplied locked plan and execution.",
        "Never improve the original reasoning score with outcome knowledge.",
        "Return strict JSON only with keys classification, explanation, evidenceUsed, evidenceMissing, confidence.",
        "classification must be one of DISCIPLINED NO TRIGGER, JUSTIFIED ADAPTATION, PARTIALLY JUSTIFIED, UNJUSTIFIED DEVIATION, INSUFFICIENT EVIDENCE.",
        "confidence must be a number from 0 to 1.",
      ].join(" "),
      messages: [{
        role: "user",
        content: JSON.stringify({
          lockedPlan: body.plan,
          execution: body.execution,
          deterministicComparison: comparison,
        }).slice(0, 40_000),
      }],
    });
    const parsed = extractJson(text);
    const allowed = [
      "DISCIPLINED NO TRIGGER",
      "JUSTIFIED ADAPTATION",
      "PARTIALLY JUSTIFIED",
      "UNJUSTIFIED DEVIATION",
      "INSUFFICIENT EVIDENCE",
    ];
    if (!parsed || typeof parsed.classification !== "string" || !allowed.includes(parsed.classification)) {
      return NextResponse.json({ comparison, assessment: fallback });
    }
    const assessment = {
      classification: parsed.classification,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation.slice(0, 1_200) : fallback.explanation,
      evidenceUsed: Array.isArray(parsed.evidenceUsed)
        ? parsed.evidenceUsed.filter((item): item is string => typeof item === "string").slice(0, 10)
        : fallback.evidenceUsed,
      evidenceMissing: Array.isArray(parsed.evidenceMissing)
        ? parsed.evidenceMissing.filter((item): item is string => typeof item === "string").slice(0, 10)
        : fallback.evidenceMissing,
      confidence: typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : fallback.confidence,
      evaluator: "ZYON" as const,
      modelVersion: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      rubricVersion: SOCIAL_RECORD_RULES.assessmentRubricVersion,
      assessedAt: new Date().toISOString(),
      appealAvailable: true,
    };
    return NextResponse.json({ comparison, assessment });
  } catch {
    return NextResponse.json({ comparison, assessment: fallback });
  }
}
