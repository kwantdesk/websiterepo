import { NextResponse, type NextRequest } from "next/server";

import type { KwantBotLearningReview } from "@/lib/kwantBotLearning";
import { getRouteActor } from "@/lib/serverAuth";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TABLE = "kwantbot_learning_reviews";
const MAX_BATCH = 500;

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
    const { data, error } = await supabase
      .from(table)
      .select("payload,reviewed_at")
      .eq("user_id", actor.userId)
      .order("reviewed_at", { ascending: false })
      .limit(1_000);
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

    return NextResponse.json({
      configured: true,
      storage: "supabase",
      saved: rows.length,
      ids: rows.map((row) => row.id),
    });
  } catch (error) {
    return storageUnavailable(error);
  }
}
