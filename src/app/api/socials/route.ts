import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteActor, type RouteActor } from "@/lib/serverAuth";
import {
  calculateReasoningScore,
  normalizeSocialProfile,
  SOCIAL_OBJECT_TYPES,
  SOCIAL_SCOPES,
  type SocialObject,
  type SocialObjectType,
  type SocialPrecordPayload,
  type SocialScope,
} from "@/lib/socials";
import { SOCIAL_RECORD_RULES } from "@/lib/socialRecordConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SocialRow = {
  user_id: string;
  id: string;
  author_label: string;
  object_type: SocialObjectType;
  scope: SocialScope;
  desk_id: string | null;
  parent_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type IncomingObject = {
  id?: unknown;
  objectType?: unknown;
  scope?: unknown;
  deskId?: unknown;
  parentId?: unknown;
  authorLabel?: unknown;
  payload?: unknown;
};

function tableUnavailable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function cleanText(value: unknown, maximum = 120) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function cleanIdentifier(value: unknown, maximum = 180) {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, maximum)
    : "";
}

function cleanAuthorLabel(value: unknown, actor: RouteActor) {
  const requested = cleanText(value, 48);
  if (requested && !requested.includes("@")) return requested;
  const stem = actor.label.includes("@") ? actor.label.split("@")[0] : actor.label;
  return cleanText(stem.replace(/[._-]+/g, " "), 48) || "Kwant Trader";
}

function sanitizeJson(value: unknown, depth = 0): unknown {
  if (depth > 7) return null;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const maximum = value.startsWith("data:image/") ? 2_800_000 : 8_000;
    return value.replace(/\u0000/g, "").slice(0, maximum);
  }
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizeJson(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [key.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80), sanitizeJson(item, depth + 1)]),
    );
  }
  return null;
}

function fromRow(row: SocialRow): SocialObject {
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

function unavailableResponse() {
  return NextResponse.json(
    { objects: [], cloud: false },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

async function socialClient(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) return { actor: null, supabase: null };
  try {
    return { actor, supabase: await createSupabaseServerClient() };
  } catch {
    return { actor, supabase: null };
  }
}

export async function GET(request: NextRequest) {
  const { actor, supabase } = await socialClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return unavailableResponse();

  const mineOnly = request.nextUrl.searchParams.get("mine") === "1";
  const requestedTypes = (request.nextUrl.searchParams.get("types") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is SocialObjectType => SOCIAL_OBJECT_TYPES.includes(value as SocialObjectType));
  const rows: SocialRow[] = [];
  for (let offset = 0; offset < 2_000; offset += 500) {
    let query = supabase
      .from("social_objects")
      .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (mineOnly) query = query.eq("user_id", actor.userId);
    if (requestedTypes.length) query = query.in("object_type", requestedTypes);
    const { data, error } = await query.range(offset, offset + 499);
    if (error) {
      if (tableUnavailable(error.code)) return unavailableResponse();
      console.error("Socials load failed", { code: error.code, message: error.message });
      return NextResponse.json({ error: "Socials could not be loaded." }, { status: 502 });
    }
    const page = (data ?? []) as SocialRow[];
    rows.push(...page);
    if (page.length < 500) break;
  }

  return NextResponse.json(
    { objects: rows.map(fromRow), cloud: true, viewerId: actor.userId },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function POST(request: NextRequest) {
  const { actor, supabase } = await socialClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return NextResponse.json({ cloud: false, error: "Account storage is unavailable." }, { status: 503 });

  let body: { object?: IncomingObject };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The Socials object could not be read." }, { status: 400 });
  }
  const incoming = body.object;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "A Socials object is required." }, { status: 400 });
  }
  if (typeof incoming.objectType !== "string" || !SOCIAL_OBJECT_TYPES.includes(incoming.objectType as SocialObjectType)) {
    return NextResponse.json({ error: "Unsupported Socials object type." }, { status: 400 });
  }
  if (typeof incoming.scope !== "string" || !SOCIAL_SCOPES.includes(incoming.scope as SocialScope)) {
    return NextResponse.json({ error: "Unsupported visibility." }, { status: 400 });
  }

  const objectType = incoming.objectType as SocialObjectType;
  const scope = incoming.scope as SocialScope;
  const deskId = cleanIdentifier(incoming.deskId) || null;
  const parentId = cleanIdentifier(incoming.parentId) || null;
  const authorLabel = cleanAuthorLabel(incoming.authorLabel, actor);
  let payload = sanitizeJson(incoming.payload) as Record<string, unknown>;
  if (!payload || typeof payload !== "object") payload = {};
  if (JSON.stringify(payload).length > 3_000_000) {
    return NextResponse.json({ error: "This Socials object is too large." }, { status: 413 });
  }

  const now = new Date().toISOString();
  let id = cleanIdentifier(incoming.id);
  let useUpsert = false;
  let privateEvidence: { name: string; dataUrl: string } | null = null;

  if (objectType === "receipt-evidence") {
    return NextResponse.json({ error: "Receipt evidence is managed by the receipt workflow." }, { status: 403 });
  } else if (objectType === "profile") {
    id = "profile";
    useUpsert = true;
    const profile = normalizeSocialProfile(payload, authorLabel);
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(profile.handle)) {
      return NextResponse.json({ error: "Use a valid 3–24 character profile handle." }, { status: 400 });
    }
    if (profile.callingCardCode) {
      const { data: ownedCard } = await supabase
        .from("social_objects")
        .select("id")
        .eq("user_id", actor.userId)
        .eq("object_type", "card")
        .eq("payload->>code", profile.callingCardCode)
        .maybeSingle();
      if (!ownedCard) profile.callingCardCode = "";
    }
    payload = profile as unknown as Record<string, unknown>;
  } else if (objectType === "progress") {
    const sessionDate = cleanIdentifier(payload.sessionDate, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
      return NextResponse.json({ error: "A valid progress date is required." }, { status: 400 });
    }
    id = `progress:${sessionDate}`;
    useUpsert = true;
  } else if (objectType === "reaction") {
    const kind = cleanIdentifier(payload.kind, 20);
    if (!parentId || !["USEFUL", "CLEAR", "EVIDENCE", "SAVED"].includes(kind)) {
      return NextResponse.json({ error: "A valid reaction target and type are required." }, { status: 400 });
    }
    if (kind === "SAVED" && scope !== "private") {
      return NextResponse.json({ error: "Saved Gameplans are private." }, { status: 400 });
    }
    id = `reaction:${parentId}:${kind}`;
    useUpsert = true;
  } else if (objectType === "follow") {
    const targetUserId = cleanIdentifier(payload.targetUserId, 80);
    if (!targetUserId || targetUserId === actor.userId) {
      return NextResponse.json({ error: "Choose another trader to follow." }, { status: 400 });
    }
    id = `follow:${targetUserId}`;
    useUpsert = true;
  } else if (objectType === "desk-member") {
    if (!deskId) return NextResponse.json({ error: "Choose a Desk." }, { status: 400 });
    id = `desk-member:${deskId}`;
    useUpsert = true;
  } else if (objectType === "receipt") {
    if (!parentId) return NextResponse.json({ error: "Choose a locked Decision Record." }, { status: 400 });
    const { data: parent, error: parentError } = await supabase
      .from("social_objects")
      .select("id")
      .eq("user_id", actor.userId)
      .eq("id", parentId)
      .eq("object_type", "precord")
      .maybeSingle();
    if (parentError || !parent) {
      return NextResponse.json({ error: "Only the owner can complete this Decision Record." }, { status: 403 });
    }
    const evidenceDataUrl = typeof payload.evidenceDataUrl === "string" && payload.evidenceDataUrl.startsWith("data:image/")
      ? payload.evidenceDataUrl.slice(0, 2_800_000)
      : "";
    const evidenceName = cleanText(payload.evidenceName, 180);
    const hasPlatformPathEvidence = payload.evidenceState === "PLATFORM TIMESTAMPED"
      && payload.pathMetrics
      && typeof payload.pathMetrics === "object";
    if (evidenceDataUrl) privateEvidence = { name: evidenceName || "receipt-evidence", dataUrl: evidenceDataUrl };
    payload = {
      ...payload,
      evidenceName: "",
      evidenceDataUrl: "",
      hasEvidence: Boolean(evidenceDataUrl) || Boolean(hasPlatformPathEvidence),
    };
    id = `receipt:${parentId}`;
  } else if (objectType === "card") {
    const code = cleanIdentifier(payload.code, 80);
    if (code !== "first-on-record") {
      return NextResponse.json({ error: "Calling Cards are awarded by verified product rules." }, { status: 403 });
    }
    const { count } = await supabase
      .from("social_objects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", actor.userId)
      .eq("object_type", "precord");
    if (!count) return NextResponse.json({ error: "Lock a Decision Record before claiming this card." }, { status: 409 });
    id = `card:${code}`;
    useUpsert = true;
  } else if (objectType === "precord") {
    const source = cleanText(payload.source, 16) as SocialPrecordPayload["source"];
    const candidate = {
      ...payload,
      instrument: cleanText(payload.instrument, 16).toUpperCase(),
      session: cleanText(payload.session, 40),
      direction: cleanText(payload.direction, 12),
      marketContext: cleanText(payload.marketContext, 2_000),
      bullCondition: cleanText(payload.bullCondition, 1_500),
      bearCondition: cleanText(payload.bearCondition, 1_500),
      confirmation: cleanText(payload.confirmation, 1_500),
      invalidation: cleanText(payload.invalidation, 1_500),
      source: ["SOCIALS", "GAMEPLAN", "CHARTS", "GEXMAP", "JOURNAL", "ZYON"].includes(source) ? source : "SOCIALS",
    } as unknown as Omit<SocialPrecordPayload, "reasoningScore" | "lockedAt" | "status">;
    if (!candidate.instrument || !candidate.marketContext || !candidate.confirmation || !candidate.invalidation) {
      return NextResponse.json({ error: "Instrument, context, confirmation, and invalidation are required." }, { status: 400 });
    }
    payload = {
      ...candidate,
      lockedAt: now,
      reasoningScore: calculateReasoningScore(candidate),
      status: "LOCKED",
      contentHash: createHash("sha256").update(JSON.stringify({
        instrument: candidate.instrument,
        session: candidate.session,
        direction: candidate.direction,
        marketContext: candidate.marketContext,
        plannedEntryLow: candidate.plannedEntryLow,
        plannedEntryHigh: candidate.plannedEntryHigh,
        plannedStop: candidate.plannedStop,
        plannedTarget: candidate.plannedTarget,
        plannedTargets: candidate.plannedTargets,
        confirmation: candidate.confirmation,
        invalidation: candidate.invalidation,
        expiryAt: candidate.expiryAt,
        sourceGameplanId: candidate.sourceGameplanId,
        sourceGeneratedAt: candidate.sourceGeneratedAt,
        gameplanSnapshot: candidate.gameplanSnapshot,
      })).digest("hex"),
      scoreModelVersion: SOCIAL_RECORD_RULES.scoreModelVersion,
      evidenceState: "PLATFORM TIMESTAMPED",
      lifecycle: [{
        status: "LOCKED",
        at: now,
        source: "PLATFORM",
        note: "Immutable Gameplan snapshot placed on record.",
      }],
    };
    id = /^precord:[a-zA-Z0-9_-]{8,}$/.test(id) ? id : `precord:${crypto.randomUUID()}`;
  } else if (objectType === "desk") {
    const name = cleanText(payload.name, 60);
    if (!name) return NextResponse.json({ error: "Give the Desk a name." }, { status: 400 });
    payload = {
      ...payload,
      name,
      capacity: Math.max(2, Math.min(50, Number(payload.capacity) || 8)),
    };
    id = /^desk:[a-zA-Z0-9_-]{8,}$/.test(id) ? id : `desk:${crypto.randomUUID()}`;
  } else if (!id) {
    id = `${objectType}:${crypto.randomUUID()}`;
  }

  const row = {
    user_id: actor.userId,
    id,
    author_label: authorLabel,
    object_type: objectType,
    scope,
    desk_id: deskId,
    parent_id: parentId,
    payload,
    created_at: now,
    updated_at: now,
  };

  const query = useUpsert
    ? supabase.from("social_objects").upsert(row, { onConflict: "user_id,id" })
    : supabase.from("social_objects").insert(row);
  const { data, error } = await query
    .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
    .single();
  if (error) {
    if (tableUnavailable(error.code)) return NextResponse.json({ cloud: false }, { status: 503 });
    console.error("Socials save failed", { code: error.code, message: error.message, objectType });
    return NextResponse.json({ error: error.message || "The Socials object could not be saved." }, { status: 502 });
  }

  if (objectType === "desk") {
    const membershipRow = {
      user_id: actor.userId,
      id: `desk-member:${id}`,
      author_label: authorLabel,
      object_type: "desk-member",
      scope: "desk",
      desk_id: id,
      parent_id: id,
      payload: { role: "OWNER", status: "PREPARING", joinedAt: now },
      created_at: now,
      updated_at: now,
    };
    const { error: membershipError } = await supabase.from("social_objects").insert(membershipRow);
    if (membershipError) {
      await supabase.from("social_objects").delete().eq("user_id", actor.userId).eq("id", id);
      return NextResponse.json({ error: "The Desk membership could not be created." }, { status: 502 });
    }
  }

  if (objectType === "receipt" && parentId && privateEvidence) {
    const evidenceRow = {
      user_id: actor.userId,
      id: `receipt-evidence:${parentId}`,
      author_label: authorLabel,
      object_type: "receipt-evidence",
      scope: "private",
      desk_id: null,
      parent_id: parentId,
      payload: privateEvidence,
      created_at: now,
      updated_at: now,
    };
    const { error: evidenceError } = await supabase
      .from("social_objects")
      .upsert(evidenceRow, { onConflict: "user_id,id" });
    if (evidenceError) {
      await supabase.from("social_objects").delete().eq("user_id", actor.userId).eq("id", id);
      return NextResponse.json({ error: "The private receipt evidence could not be saved." }, { status: 502 });
    }
  }

  return NextResponse.json({ object: fromRow(data as SocialRow), cloud: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { actor, supabase } = await socialClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return NextResponse.json({ cloud: false }, { status: 503 });
  let payload: { id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose an object to remove." }, { status: 400 });
  }
  const id = cleanIdentifier(payload.id);
  if (!id) return NextResponse.json({ error: "Choose an object to remove." }, { status: 400 });
  const { data: existing } = await supabase
    .from("social_objects")
    .select("object_type")
    .eq("user_id", actor.userId)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "That object no longer exists." }, { status: 404 });
  if (existing.object_type === "precord") {
    return NextResponse.json({ error: "Locked Decision Records cannot be deleted from the record." }, { status: 409 });
  }
  const { error } = await supabase.from("social_objects").delete().eq("user_id", actor.userId).eq("id", id);
  if (error) return NextResponse.json({ error: "The object could not be removed." }, { status: 502 });
  return NextResponse.json({ deleted: id });
}
