import { NextResponse, type NextRequest } from "next/server";
import { getSocialsRouteActor } from "@/lib/serverAuth";
import { createSocialsStorageClient } from "@/lib/socialsStorage.server";
import type {
  SocialExecutionFill,
  SocialGameplanExecutionPayload,
  SocialObject,
  SocialPrecordPayload,
} from "@/lib/socials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENTRY_REPORT_WINDOW_MS = 10 * 60 * 1_000;
const FUTURE_CLOCK_TOLERANCE_MS = 90 * 1_000;

type SocialRow = {
  user_id: string;
  id: string;
  author_label: string;
  object_type: "consensus";
  scope: "private";
  desk_id: string | null;
  parent_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ExecutionRequest = {
  action?: "record-entry" | "complete-trade";
  planId?: string;
  actualDirection?: "LONG" | "SHORT";
  fills?: Array<{ price?: unknown; size?: unknown; time?: unknown }>;
  actualStop?: unknown;
  maximumActualRisk?: unknown;
  outcome?: SocialGameplanExecutionPayload["outcome"];
  actualExit?: unknown;
  exitTime?: unknown;
  realisedPnl?: unknown;
  fees?: unknown;
  confirmationsAppeared?: unknown;
  deviationReason?: unknown;
  deviationDetail?: unknown;
  outcomeReview?: unknown;
  nextTimeRule?: unknown;
  partialExits?: unknown;
};

function cleanIdentifier(value: unknown, maximum = 180) {
  return typeof value === "string" ? value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, maximum) : "";
}

function cleanText(value: unknown, maximum = 2_000) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function finiteNumber(value: unknown, nullable = true) {
  if (value === null || value === undefined || value === "") return nullable ? null : Number.NaN;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : nullable ? null : Number.NaN;
}

function positiveNumber(value: unknown, nullable = true) {
  const parsed = finiteNumber(value, nullable);
  if (parsed === null) return null;
  return parsed > 0 ? parsed : Number.NaN;
}

function validDate(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function fromRow(row: SocialRow): SocialObject<SocialGameplanExecutionPayload> {
  return {
    id: row.id,
    userId: row.user_id,
    authorLabel: row.author_label,
    objectType: row.object_type,
    scope: row.scope,
    deskId: row.desk_id,
    parentId: row.parent_id,
    payload: row.payload as unknown as SocialGameplanExecutionPayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cloudSaved: true,
  };
}

function normalizeFills(value: ExecutionRequest["fills"], nowMs: number) {
  const source = Array.isArray(value) ? value.slice(0, 3) : [];
  const fills: SocialExecutionFill[] = [];
  for (const candidate of source) {
    const price = positiveNumber(candidate?.price, false);
    const size = positiveNumber(candidate?.size);
    const time = validDate(candidate?.time);
    if (!Number.isFinite(price) || !time || (size !== null && !Number.isFinite(size))) return null;
    const fillMs = time.getTime();
    if (fillMs > nowMs + FUTURE_CLOCK_TOLERANCE_MS) return null;
    if (nowMs - fillMs > ENTRY_REPORT_WINDOW_MS) return null;
    fills.push({ price, size, time: time.toISOString() });
  }
  return fills.length ? fills : null;
}

function aggregateFills(fills: SocialExecutionFill[]) {
  const sized = fills.every((fill) => typeof fill.size === "number" && fill.size > 0);
  const totalSize = sized ? fills.reduce((sum, fill) => sum + (fill.size ?? 0), 0) : null;
  const actualEntry = sized && totalSize
    ? fills.reduce((sum, fill) => sum + (fill.price ?? 0) * (fill.size ?? 0), 0) / totalSize
    : fills.reduce((sum, fill) => sum + (fill.price ?? 0), 0) / fills.length;
  const entryTime = fills
    .map((fill) => fill.time as string)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  return { actualEntry: Number(actualEntry.toFixed(6)), size: totalSize, entryTime };
}

export async function POST(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: ExecutionRequest;
  try {
    body = await request.json() as ExecutionRequest;
  } catch {
    return NextResponse.json({ error: "The trade report could not be read." }, { status: 400 });
  }

  const planId = cleanIdentifier(body.planId);
  if (!planId || !body.action) return NextResponse.json({ error: "Choose a locked Gameplan." }, { status: 400 });

  const supabase = await createSocialsStorageClient(actor);
  const { data: planRow, error: planError } = await supabase
    .from("social_objects")
    .select("id,author_label,scope,desk_id,payload,created_at")
    .eq("user_id", actor.userId)
    .eq("id", planId)
    .eq("object_type", "precord")
    .maybeSingle();
  if (planError || !planRow) {
    return NextResponse.json({ error: "Only the owner can report a trade against this Gameplan." }, { status: 403 });
  }

  const plan = planRow.payload as unknown as SocialPrecordPayload;
  const executionId = `gameplan-execution:${planId}`;
  const { data: existingRow, error: existingError } = await supabase
    .from("social_objects")
    .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
    .eq("user_id", actor.userId)
    .eq("id", executionId)
    .eq("object_type", "consensus")
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "The existing trade report could not be checked." }, { status: 502 });

  const now = new Date();
  const nowIso = now.toISOString();

  if (body.action === "record-entry") {
    if (existingRow) {
      return NextResponse.json({ error: "This entry is already timestamped and cannot be rewritten." }, { status: 409 });
    }
    if (body.actualDirection !== "LONG" && body.actualDirection !== "SHORT") {
      return NextResponse.json({ error: "Choose the direction actually traded." }, { status: 400 });
    }
    const fills = normalizeFills(body.fills, now.getTime());
    if (!fills) {
      return NextResponse.json({ error: "Each reported fill must have occurred within the previous 10 minutes of real server time." }, { status: 409 });
    }
    const lockedAt = Date.parse(plan.lockedAt || planRow.created_at);
    if (fills.some((fill) => Date.parse(fill.time as string) < lockedAt)) {
      return NextResponse.json({ error: "The execution cannot predate the locked Gameplan." }, { status: 409 });
    }
    const actualStop = positiveNumber(body.actualStop);
    const maximumActualRisk = positiveNumber(body.maximumActualRisk);
    if ((actualStop !== null && !Number.isFinite(actualStop)) || (maximumActualRisk !== null && !Number.isFinite(maximumActualRisk))) {
      return NextResponse.json({ error: "Stop and risk must be positive numbers when supplied." }, { status: 400 });
    }
    const aggregate = aggregateFills(fills);
    const latestFillMs = Math.max(...fills.map((fill) => Date.parse(fill.time as string)));
    const payload: SocialGameplanExecutionPayload = {
      kind: "GAMEPLAN_EXECUTION",
      stage: "ENTRY RECORDED",
      actualDirection: body.actualDirection,
      fills,
      actualEntry: aggregate.actualEntry,
      entryTime: aggregate.entryTime,
      actualStop,
      size: aggregate.size,
      maximumActualRisk,
      claimedAt: nowIso,
      claimDelaySeconds: Math.max(0, Math.round((now.getTime() - latestFillMs) / 1_000)),
      updatedAt: nowIso,
    };
    const { data, error } = await supabase.from("social_objects").insert({
      user_id: actor.userId,
      id: executionId,
      author_label: planRow.author_label,
      object_type: "consensus",
      scope: "private",
      desk_id: planRow.desk_id,
      parent_id: planId,
      payload,
      updated_at: nowIso,
    }).select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at").single();
    if (error || !data) return NextResponse.json({ error: error?.message || "The entry could not be timestamped." }, { status: 502 });
    return NextResponse.json({ object: fromRow(data as SocialRow), windowMinutes: 10 }, { status: 201 });
  }

  if (!existingRow) {
    return NextResponse.json({ error: "Record the entry first. At submission, the fill cannot be more than 10 minutes old." }, { status: 409 });
  }
  const existing = existingRow.payload as unknown as SocialGameplanExecutionPayload;
  if (existing.kind !== "GAMEPLAN_EXECUTION") {
    return NextResponse.json({ error: "The trade report is not valid." }, { status: 409 });
  }
  if (existing.stage === "CLOSED") {
    return NextResponse.json({ object: fromRow(existingRow as SocialRow), idempotent: true });
  }

  const allowedOutcomes: SocialGameplanExecutionPayload["outcome"][] = ["TARGET HIT", "STOP HIT", "MANUAL EXIT", "BREAKEVEN"];
  if (!body.outcome || !allowedOutcomes.includes(body.outcome)) {
    return NextResponse.json({ error: "Choose how the trade finished." }, { status: 400 });
  }
  const actualExit = positiveNumber(body.actualExit, false);
  const exitTime = validDate(body.exitTime);
  const realisedPnl = finiteNumber(body.realisedPnl, false);
  const fees = finiteNumber(body.fees);
  if (!Number.isFinite(actualExit) || !exitTime || !Number.isFinite(realisedPnl) || (fees !== null && !Number.isFinite(fees))) {
    return NextResponse.json({ error: "Exit price, exit time and realised P&L are required." }, { status: 400 });
  }
  if (exitTime.getTime() < Date.parse(existing.entryTime) || exitTime.getTime() > now.getTime() + FUTURE_CLOCK_TOLERANCE_MS) {
    return NextResponse.json({ error: "Exit time must be after the recorded entry and cannot be in the future." }, { status: 409 });
  }

  const payload: SocialGameplanExecutionPayload = {
    ...existing,
    stage: "CLOSED",
    outcome: body.outcome,
    actualExit,
    exitTime: exitTime.toISOString(),
    realisedPnl,
    fees,
    confirmationsAppeared: cleanText(body.confirmationsAppeared, 1_500),
    deviationReason: cleanText(body.deviationReason, 120),
    deviationDetail: cleanText(body.deviationDetail, 1_500),
    outcomeReview: cleanText(body.outcomeReview, 2_000),
    nextTimeRule: cleanText(body.nextTimeRule, 1_500),
    partialExits: cleanText(body.partialExits, 1_000),
    closedAt: nowIso,
    updatedAt: nowIso,
  };
  const { data, error } = await supabase.from("social_objects").update({ payload, updated_at: nowIso })
    .eq("user_id", actor.userId)
    .eq("id", executionId)
    .eq("object_type", "consensus")
    .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || "The trade outcome could not be saved." }, { status: 502 });
  return NextResponse.json({ object: fromRow(data as SocialRow) });
}
