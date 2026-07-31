import { NextResponse, type NextRequest } from "next/server";

import type {
  KwantBotLearningCalibration,
  KwantBotLearningReview,
  KwantBotLearningVerdict,
} from "@/lib/kwantBotLearning";
import { getRouteActor } from "@/lib/serverAuth";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TABLE = "kwantbot_learning_reviews";
const MAX_BATCH = 500;
const CALIBRATION_PAGE_SIZE = 1_000;

type CalibrationRow = {
  root: "NQ" | "ES";
  score: number;
  verdict: KwantBotLearningVerdict;
  reviewed_at: string;
};

async function loadCalibrationRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  userId: string,
) {
  const rows: CalibrationRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("root,score,verdict,reviewed_at")
      .eq("user_id", userId)
      .order("reviewed_at", { ascending: true })
      .range(offset, offset + CALIBRATION_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as CalibrationRow[];
    rows.push(...page);
    if (page.length < CALIBRATION_PAGE_SIZE) break;
    offset += CALIBRATION_PAGE_SIZE;
  }

  return rows;
}

function calibrationForRoot(
  root: "NQ" | "ES",
  rows: CalibrationRow[],
): KwantBotLearningCalibration | null {
  const rootRows = rows
    .filter((row) => row.root === root)
    .sort((left, right) => Date.parse(left.reviewed_at) - Date.parse(right.reviewed_at));
  if (!rootRows.length) return null;

  const scoreSum = rootRows.reduce((total, row) => total + row.score, 0);
  const baselineRows = rootRows.slice(0, Math.min(10, rootRows.length));
  const recentRows = rootRows.slice(-Math.min(10, rootRows.length));
  const average = (items: CalibrationRow[]) => Math.round(
    items.reduce((total, row) => total + row.score, 0) / Math.max(1, items.length),
  );
  const checkpointStride = Math.max(1, Math.ceil(rootRows.length / 24));
  let runningScore = 0;
  const checkpoints = rootRows.flatMap((row, index) => {
    runningScore += row.score;
    const reviewCount = index + 1;
    if (reviewCount !== rootRows.length && reviewCount % checkpointStride !== 0) return [];
    return [{
      reviewCount,
      averageScore: Math.round(runningScore / reviewCount),
      reviewedAt: row.reviewed_at,
    }];
  });
  const baselineAverage = average(baselineRows);
  const averageScore = Math.round(scoreSum / rootRows.length);

  return {
    root,
    reviewCount: rootRows.length,
    scoreSum,
    averageScore,
    confirmedCount: rootRows.filter((row) => row.verdict === "CONFIRMED").length,
    partialCount: rootRows.filter((row) => row.verdict === "PARTIAL").length,
    failedCount: rootRows.filter((row) => row.verdict === "FAILED").length,
    firstReviewedAt: rootRows[0].reviewed_at,
    lastReviewedAt: rootRows.at(-1)?.reviewed_at ?? rootRows[0].reviewed_at,
    baselineReviewCount: baselineRows.length,
    baselineAverage,
    recentReviewCount: recentRows.length,
    recentAverage: average(recentRows),
    changeFromBaseline: averageScore - baselineAverage,
    checkpoints,
  };
}

async function loadCalibration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  userId: string,
) {
  const rows = await loadCalibrationRows(supabase, table, userId);
  return (["NQ", "ES"] as const).flatMap((root) => {
    const calibration = calibrationForRoot(root, rows);
    return calibration ? [calibration] : [];
  });
}

function storageUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    {
      configured: false,
      storage: "local",
      error: message,
    },
    { status: 503 },
  );
}

function isReview(value: unknown): value is KwantBotLearningReview {
  if (!value || typeof value !== "object") return false;
  const review = value as Partial<KwantBotLearningReview>;
  return (
    typeof review.id === "string"
    && (review.root === "NQ" || review.root === "ES")
    && typeof review.reviewedAt === "string"
    && typeof review.score === "number"
    && review.score >= 0
    && review.score <= 100
    && typeof review.evidence?.outcomeEventId === "string"
  );
}

export async function GET(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const table = process.env.KWANTBOT_LEARNING_TABLE?.trim() || DEFAULT_TABLE;
    const [{ data, error }, calibration] = await Promise.all([
      supabase
        .from(table)
        .select("payload,reviewed_at")
        .eq("user_id", actor.userId)
        .order("reviewed_at", { ascending: false })
        .limit(1_000),
      loadCalibration(supabase, table, actor.userId),
    ]);
    if (error) throw new Error(error.message);

    const reviews = (data ?? [])
      .map((row) => row.payload)
      .filter(isReview)
      .map((review) => ({ ...review, syncState: "synced" as const }))
      .sort((left, right) => Date.parse(left.reviewedAt) - Date.parse(right.reviewedAt));

    return NextResponse.json({
      configured: true,
      storage: "supabase",
      reviews,
      calibration,
    });
  } catch (error) {
    return storageUnavailable(error);
  }
}

export async function POST(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { reviews?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const reviews = Array.isArray(body.reviews)
    ? body.reviews.filter(isReview).slice(-MAX_BATCH)
    : [];
  if (!reviews.length) {
    return NextResponse.json({ error: "At least one valid review is required." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const table = process.env.KWANTBOT_LEARNING_TABLE?.trim() || DEFAULT_TABLE;
    const rows = reviews.map((review) => ({
      user_id: actor.userId,
      id: review.id,
      root: review.root,
      level_id: review.levelId,
      level_name: review.levelName,
      score: Math.round(review.score),
      verdict: review.verdict,
      grade: review.grade,
      reviewed_at: review.reviewedAt,
      payload: {
        ...review,
        syncState: "synced",
      },
    }));
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: "user_id,id" });
    if (error) throw new Error(error.message);

    const calibration = await loadCalibration(supabase, table, actor.userId);
    return NextResponse.json({
      configured: true,
      storage: "supabase",
      saved: rows.length,
      ids: rows.map((row) => row.id),
      calibration,
    });
  } catch (error) {
    return storageUnavailable(error);
  }
}
