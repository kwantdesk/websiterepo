import { NextResponse, type NextRequest } from "next/server";
import { getRouteActor } from "@/lib/serverAuth";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isZyonMarketRoot,
  zyonGameplanMissingFields,
  type ZyonGameplanDraft,
  type ZyonGameplanDirection,
  type ZyonGameplanRiskUnit,
} from "@/lib/zyon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DraftRow = {
  id: string;
  session_date: string;
  root: string;
  title: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function tableUnavailable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function finite(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalFinite(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = finite(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value: unknown, maximum = 2_000) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maximum)
    : "";
}

function fromRow(row: DraftRow): ZyonGameplanDraft | null {
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
    instrument: clean(payload.instrument, 16).toUpperCase() || row.root,
    title: clean(row.title, 120) || `${row.root} Gameplan`,
    direction,
    session: clean(payload.session, 60) || "New York",
    entryTime: clean(payload.entryTime, 80),
    entryLow: Math.min(entryLow, entryHigh),
    entryHigh: Math.max(entryLow, entryHigh),
    stop: finite(payload.stop),
    targets,
    riskAmount: optionalFinite(payload.riskAmount),
    riskUnit,
    size: optionalFinite(payload.size),
    reasoning: clean(payload.reasoning, 5_000),
    confluences: Array.isArray(payload.confluences)
      ? payload.confluences.map((value) => clean(value, 300)).filter(Boolean).slice(0, 12)
      : [],
    confirmation: clean(payload.confirmation, 2_000),
    invalidation: clean(payload.invalidation, 2_000),
    expiryAt: clean(payload.expiryAt, 60) || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cloudSaved: true,
  };
}

export async function GET(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const rootParam = request.nextUrl.searchParams.get("root");
  const root = isZyonMarketRoot(rootParam) ? rootParam : null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("zyon_gameplan_drafts")
      .select("id,session_date,root,title,payload,created_at,updated_at")
      .eq("user_id", actor.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) {
      if (tableUnavailable(error.code)) {
        return NextResponse.json({ drafts: [], cloud: false, migrationRequired: true });
      }
      throw error;
    }
    const allDrafts = ((data ?? []) as DraftRow[])
      .map(fromRow)
      .filter((draft): draft is ZyonGameplanDraft => Boolean(draft));
    const { data: recordRows, error: recordError } = await supabase
      .from("social_objects")
      .select("payload")
      .eq("user_id", actor.userId)
      .eq("object_type", "precord")
      .limit(500);
    if (recordError && !tableUnavailable(recordError.code)) throw recordError;
    const postedDraftIds = new Set(
      (recordRows ?? []).map((row) => {
        const payload = row.payload as Record<string, unknown> | null;
        return clean(payload?.sourceGameplanId, 220);
      }).filter(Boolean),
    );
    const newestDraft = allDrafts[0] ?? null;
    const pendingDraft = newestDraft && !postedDraftIds.has(newestDraft.id) ? newestDraft : null;
    const drafts = root ? allDrafts.filter((draft) => draft.root === root) : allDrafts;
    const localDate = clean(request.nextUrl.searchParams.get("localDate"), 10);
    const today = /^\d{4}-\d{2}-\d{2}$/.test(localDate)
      ? localDate
      : new Date().toISOString().slice(0, 10);
    return NextResponse.json(
      {
        drafts,
        draft: pendingDraft,
        pendingDraft,
        blocked: Boolean(pendingDraft),
        sentToday: allDrafts.filter((draft) => draft.sessionDate === today).length,
        postedDraftIds: [...postedDraftIds],
        cloud: true,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("ZYON Gameplan draft load failed", error);
    return NextResponse.json({ error: "The ZYON Gameplan draft could not be loaded." }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let draft: ZyonGameplanDraft;
  try {
    draft = await request.json() as ZyonGameplanDraft;
  } catch {
    return NextResponse.json({ error: "The Gameplan could not be read." }, { status: 400 });
  }
  const missing = zyonGameplanMissingFields(draft);
  if (!clean(draft?.id, 220) || !isZyonMarketRoot(draft?.root) || missing.length) {
    return NextResponse.json({
      error: `Complete the required Gameplan details: ${missing.join(", ")}.`,
      missing,
    }, { status: 400 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: existing, error: loadError } = await supabase
      .from("zyon_gameplan_drafts")
      .select("id")
      .eq("user_id", actor.userId)
      .eq("id", draft.id)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) return NextResponse.json({ error: "That holding Gameplan no longer exists." }, { status: 404 });
    const { error } = await supabase
      .from("zyon_gameplan_drafts")
      .update({
        root: draft.root,
        title: clean(draft.title, 120) || `${draft.root} Gameplan`,
        payload: {
          instrument: clean(draft.instrument, 16).toUpperCase(),
          direction: draft.direction,
          session: clean(draft.session, 60) || "New York",
          entryTime: clean(draft.entryTime, 80),
          entryLow: draft.entryLow,
          entryHigh: draft.entryHigh,
          stop: draft.stop,
          targets: draft.targets.slice(0, 8),
          riskAmount: draft.riskAmount,
          riskUnit: draft.riskUnit,
          size: draft.size,
          reasoning: clean(draft.reasoning, 5_000),
          confluences: draft.confluences.slice(0, 12),
          confirmation: clean(draft.confirmation, 2_000),
          invalidation: clean(draft.invalidation, 2_000),
          expiryAt: draft.expiryAt,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", actor.userId)
      .eq("id", draft.id);
    if (error) throw error;
    return NextResponse.json({ saved: true }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("ZYON Gameplan draft update failed", error);
    return NextResponse.json({ error: "The holding Gameplan could not be updated." }, { status: 502 });
  }
}
