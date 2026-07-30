import { NextResponse, type NextRequest } from "next/server";
import { getRouteActor } from "@/lib/serverAuth";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isZyonMarketRoot,
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
    let query = supabase
      .from("zyon_gameplan_drafts")
      .select("id,session_date,root,title,payload,created_at,updated_at")
      .eq("user_id", actor.userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (root) query = query.eq("root", root);
    const { data, error } = await query;
    if (error) {
      if (tableUnavailable(error.code)) {
        return NextResponse.json({ drafts: [], cloud: false, migrationRequired: true });
      }
      throw error;
    }
    const drafts = ((data ?? []) as DraftRow[])
      .map(fromRow)
      .filter((draft): draft is ZyonGameplanDraft => Boolean(draft));
    return NextResponse.json(
      { drafts, draft: drafts[0] ?? null, cloud: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("ZYON Gameplan draft load failed", error);
    return NextResponse.json({ error: "The ZYON Gameplan draft could not be loaded." }, { status: 502 });
  }
}
