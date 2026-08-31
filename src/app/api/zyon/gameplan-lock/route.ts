import { NextResponse, type NextRequest } from "next/server";

import { getZyonRouteActor } from "@/lib/serverAuth";
import type { SocialObject, SocialPrecordPayload } from "@/lib/socials";
import {
  buildZyonGameplanPrecord,
  cleanZyonGameplanText,
  type ZyonGameplanDraftRow,
  zyonGameplanDraftFromRow,
  zyonGameplanRecordId,
} from "@/lib/zyonGameplan.server";
import { createZyonTransactionalClient } from "@/lib/zyonStorage.server";
import { zyonGameplanEntryTimingStatus, zyonGameplanMissingFields } from "@/lib/zyon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LockRequest = { draftId?: unknown; expectedUpdatedAt?: unknown };
type LockedRow = {
  user_id: string;
  id: string;
  author_label: string;
  object_type: "precord";
  scope: "community";
  desk_id: string | null;
  parent_id: string | null;
  payload: SocialPrecordPayload;
  created_at: string;
  updated_at: string;
};

function objectFromRow(row: LockedRow): SocialObject<SocialPrecordPayload> {
  return {
    id: row.id,
    userId: row.user_id,
    authorLabel: row.author_label,
    objectType: row.object_type,
    scope: row.scope,
    deskId: row.desk_id,
    parentId: row.parent_id,
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cloudSaved: true,
  };
}

export async function POST(request: NextRequest) {
  const actor = await getZyonRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let body: LockRequest;
  try {
    body = await request.json() as LockRequest;
  } catch {
    return NextResponse.json({ error: "The Gameplan lock request could not be read." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "The Gameplan lock request is invalid." }, { status: 400 });
  }
  if (Object.keys(body as Record<string, unknown>).some((key) => !["draftId", "expectedUpdatedAt"].includes(key))) {
    return NextResponse.json({ error: "The Gameplan lock request contains unsupported fields." }, { status: 400 });
  }
  const draftId = cleanZyonGameplanText(body.draftId, 220).replace(/[^a-zA-Z0-9:_-]/g, "");
  const expectedUpdatedAt = cleanZyonGameplanText(body.expectedUpdatedAt, 80);
  if (!draftId || !expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    return NextResponse.json({ error: "A valid holding Gameplan version is required." }, { status: 400 });
  }

  try {
    const supabase = createZyonTransactionalClient();
    const { data: rawDraft, error: draftError } = await supabase
      .from("zyon_gameplan_drafts")
      .select("id,session_date,root,title,payload,created_at,updated_at")
      .eq("user_id", actor.userId)
      .eq("id", draftId)
      .maybeSingle();
    if (draftError) throw draftError;
    if (!rawDraft) return NextResponse.json({ error: "That holding Gameplan no longer exists." }, { status: 404 });
    const draft = zyonGameplanDraftFromRow(rawDraft as ZyonGameplanDraftRow);
    if (!draft) return NextResponse.json({ error: "The holding Gameplan is malformed." }, { status: 409 });
    const missing = zyonGameplanMissingFields(draft);
    if (missing.length) {
      return NextResponse.json({ error: `Complete the required Gameplan details: ${missing.join(", ")}.`, missing }, { status: 400 });
    }
    const entryTiming = zyonGameplanEntryTimingStatus(draft.entryTime, draft.createdAt);
    if (entryTiming === "INVALID" || (draft.recordMode === "HISTORICAL" && entryTiming === "MISSING")) {
      return NextResponse.json({ error: "The Gameplan entry time is not valid for locking.", code: "ENTRY_TIME_INVALID" }, { status: 400 });
    }
    if (Date.parse(expectedUpdatedAt) !== Date.parse(draft.updatedAt)) {
      return NextResponse.json({
        error: "This holding Gameplan changed on another workstation. Reload it before locking.",
        code: "GAMEPLAN_VERSION_CONFLICT",
      }, { status: 409 });
    }
    const lockedAt = new Date().toISOString();
    const payload = buildZyonGameplanPrecord(draft, lockedAt);
    const { data, error } = await supabase.rpc("lock_zyon_gameplan_v1", {
      p_user_id: actor.userId,
      p_draft_id: draft.id,
      p_expected_updated_at: draft.updatedAt,
      p_record_id: zyonGameplanRecordId(draft.id),
      p_author_label: "Kwant Trader",
      p_payload: payload,
      p_locked_at: lockedAt,
    });
    if (error) {
      if (error.code === "40001" || error.message.includes("GAMEPLAN_VERSION_CONFLICT")) {
        return NextResponse.json({
          error: "This holding Gameplan changed while it was being locked. Reload it before continuing.",
          code: "GAMEPLAN_VERSION_CONFLICT",
        }, { status: 409 });
      }
      if (error.code === "P0002" || error.message.includes("GAMEPLAN_NOT_FOUND")) {
        return NextResponse.json({ error: "That holding Gameplan no longer exists." }, { status: 404 });
      }
      throw error;
    }
    const receipt = data as { record?: LockedRow; idempotent?: boolean } | null;
    if (!receipt?.record) throw new Error("The Gameplan lock transaction returned no record.");
    return NextResponse.json(
      { object: objectFromRow(receipt.record), idempotent: receipt.idempotent === true },
      { status: receipt.idempotent ? 200 : 201, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("ZYON Gameplan lock failed", error);
    return NextResponse.json({ error: "The Gameplan remains in Holding because the account lock could not be completed." }, { status: 502 });
  }
}
