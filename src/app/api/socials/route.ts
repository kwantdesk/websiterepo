import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteActor, type RouteActor } from "@/lib/serverAuth";
import {
  calculateReasoningScore,
  CALLING_CARD_CATALOG,
  normalizeSocialProfile,
  SOCIAL_OBJECT_TYPES,
  SOCIAL_SCOPES,
  type SocialObject,
  type SocialObjectType,
  type SocialPostPayload,
  type SocialPrecordPayload,
  type SocialScope,
} from "@/lib/socials";
import { SOCIAL_RECORD_RULES } from "@/lib/socialRecordConfig";
import { normalizeZyonTradingAccount } from "@/lib/zyon";
import { isValidProfileHandle, PROFILE_HANDLE_REQUIREMENTS } from "@/lib/profileHandle";

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

function finiteNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullablePositiveNumber(value: unknown) {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
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
  const payload = row.object_type === "profile"
    && (typeof row.payload.activeSince !== "string" || !Number.isFinite(Date.parse(row.payload.activeSince)))
    ? { ...row.payload, activeSince: row.created_at }
    : row.payload;
  return {
    id: row.id,
    userId: row.user_id,
    authorLabel: row.author_label,
    objectType: row.object_type,
    scope: row.scope,
    deskId: row.desk_id,
    parentId: row.parent_id,
    payload,
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
  const requestedProfileHandle = cleanIdentifier(
    request.nextUrl.searchParams.get("profileHandle"),
    24,
  ).toLowerCase();
  const requestedTypes = (request.nextUrl.searchParams.get("types") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is SocialObjectType => SOCIAL_OBJECT_TYPES.includes(value as SocialObjectType));

  if (requestedProfileHandle) {
    const { data: profileData, error: profileError } = await supabase
      .from("social_objects")
      .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
      .eq("object_type", "profile")
      .eq("payload->>handle", requestedProfileHandle)
      .maybeSingle();
    if (profileError) {
      if (tableUnavailable(profileError.code)) return unavailableResponse();
      console.error("Social profile lookup failed", {
        code: profileError.code,
        message: profileError.message,
      });
      return NextResponse.json({ error: "This profile could not be loaded." }, { status: 502 });
    }
    if (!profileData) {
      return NextResponse.json(
        { objects: [], cloud: true, viewerId: actor.userId, profileFound: false },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    const profileRow = profileData as SocialRow;
    const { data: profileObjects, error: objectsError } = await supabase
      .from("social_objects")
      .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
      .eq("user_id", profileRow.user_id)
      .in("object_type", ["profile", "precord", "receipt", "card", "post", "reaction"])
      .order("created_at", { ascending: false })
      .limit(1_000);
    if (objectsError) {
      if (tableUnavailable(objectsError.code)) return unavailableResponse();
      console.error("Social profile records failed", {
        code: objectsError.code,
        message: objectsError.message,
      });
      return NextResponse.json({ error: "This profile could not be loaded." }, { status: 502 });
    }

    const requestedProfile = normalizeSocialProfile(profileRow.payload, profileRow.author_label);
    const viewingOwnProfile = profileRow.user_id === actor.userId;
    const profileRows = ((profileObjects ?? []) as SocialRow[]).filter((row) => {
      if (viewingOwnProfile) return true;
      if (row.object_type === "reaction") {
        const kind = cleanIdentifier((row.payload as Record<string, unknown>)?.kind, 20);
        if (kind === "LIKE" && requestedProfile.visibility.likes === "private") return false;
        if (kind === "SAVED" && requestedProfile.visibility.saves === "private") return false;
      }
      if (row.object_type === "post") {
        const postPayload = row.payload as Record<string, unknown>;
        if (postPayload?.isRepost === true && requestedProfile.visibility.reposts === "private") return false;
      }
      return true;
    });
    const referencedIds = [...new Set(profileRows.flatMap((row) => {
      const rowPayload = row.payload as Record<string, unknown>;
      return [
        row.parent_id,
        cleanIdentifier(rowPayload?.relatedPrecordId, 180),
        cleanIdentifier(rowPayload?.repostOfPostId, 180),
      ].filter((value): value is string => Boolean(value));
    }))].slice(0, 500);
    let referencedRows: SocialRow[] = [];
    if (referencedIds.length) {
      const { data: references, error: referencesError } = await supabase
        .from("social_objects")
        .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
        .in("id", referencedIds)
        .in("object_type", ["post", "precord", "receipt"])
        .limit(500);
      if (!referencesError) referencedRows = (references ?? []) as SocialRow[];
    }
    const contentIds = [...new Set([...profileRows, ...referencedRows]
      .filter((row) => row.object_type === "post" || row.object_type === "precord")
      .map((row) => row.id))].slice(0, 500);
    let interactionRows: SocialRow[] = [];
    if (contentIds.length) {
      const { data: interactions, error: interactionsError } = await supabase
        .from("social_objects")
        .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
        .in("parent_id", contentIds)
        .in("object_type", ["comment", "reaction", "receipt"])
        .limit(1_000);
      if (!interactionsError) interactionRows = (interactions ?? []) as SocialRow[];
    }
    const rows = [...new Map([...profileRows, ...referencedRows, ...interactionRows]
      .map((row) => [`${row.user_id}:${row.id}`, row])).values()].filter((row) => {
      if (viewingOwnProfile || row.user_id !== profileRow.user_id) return true;
      if (row.object_type === "reaction") {
        const kind = cleanIdentifier((row.payload as Record<string, unknown>)?.kind, 20);
        if (kind === "LIKE" && requestedProfile.visibility.likes === "private") return false;
        if (kind === "SAVED" && requestedProfile.visibility.saves === "private") return false;
      }
      if (row.object_type === "post") {
        const postPayload = row.payload as Record<string, unknown>;
        if (postPayload?.isRepost === true && requestedProfile.visibility.reposts === "private") return false;
      }
      return true;
    });
    if (!rows.some((row) => row.object_type === "profile")) rows.unshift(profileRow);
    return NextResponse.json(
      {
        objects: rows.map(fromRow),
        cloud: true,
        viewerId: actor.userId,
        profileFound: true,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

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
  let authorLabel = cleanAuthorLabel(incoming.authorLabel, actor);
  let payload = sanitizeJson(incoming.payload) as Record<string, unknown>;
  if (!payload || typeof payload !== "object") payload = {};
  if (JSON.stringify(payload).length > 3_000_000) {
    return NextResponse.json({ error: "This Socials object is too large." }, { status: 413 });
  }

  const now = new Date().toISOString();
  let id = cleanIdentifier(incoming.id);
  let useUpsert = false;
  let privateEvidence: { name: string; dataUrl: string } | null = null;

  if (objectType === "consensus" && (id.startsWith("gameplan-execution:") || payload.kind === "GAMEPLAN_EXECUTION")) {
    return NextResponse.json({ error: "Gameplan executions must use the timestamped Scoring workflow." }, { status: 403 });
  }

  if (objectType === "receipt-evidence") {
    return NextResponse.json({ error: "Receipt evidence is managed by the receipt workflow." }, { status: 403 });
  } else if (objectType === "profile") {
    id = "profile";
    useUpsert = true;
    const profile = normalizeSocialProfile(payload, authorLabel);
    profile.activeSince = actor.createdAt && Number.isFinite(Date.parse(actor.createdAt))
      ? new Date(actor.createdAt).toISOString()
      : profile.activeSince;
    if (!isValidProfileHandle(profile.handle)) {
      return NextResponse.json({ error: PROFILE_HANDLE_REQUIREMENTS }, { status: 400 });
    }
    if (profile.callingCardCode && profile.callingCardCode !== "origin-signal") {
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
    if (!parentId || !["LIKE", "USEFUL", "CLEAR", "EVIDENCE", "SAVED", "FIRE", "TARGET", "BRAIN", "APPLAUSE"].includes(kind)) {
      return NextResponse.json({ error: "A valid reaction target and type are required." }, { status: 400 });
    }
    if (kind === "SAVED" && scope !== "private" && scope !== "community") {
      return NextResponse.json({ error: "Saved items can only be private or visible on the profile." }, { status: 400 });
    }
    id = `reaction:${parentId}:${kind}`;
    useUpsert = true;
  } else if (objectType === "post") {
    const kind = cleanText(payload.kind, 24) as SocialPostPayload["kind"];
    const tradeCandidate = payload.trade && typeof payload.trade === "object"
      ? payload.trade as Record<string, unknown>
      : null;
    const trade = tradeCandidate ? {
      journalTradeId: cleanIdentifier(tradeCandidate.journalTradeId, 180),
      instrument: cleanText(tradeCandidate.instrument, 32).toUpperCase(),
      side: ["LONG", "SHORT", "UNKNOWN"].includes(cleanText(tradeCandidate.side, 12).toUpperCase())
        ? cleanText(tradeCandidate.side, 12).toUpperCase()
        : "UNKNOWN",
      entryPrice: nullablePositiveNumber(tradeCandidate.entryPrice),
      exitPrice: nullablePositiveNumber(tradeCandidate.exitPrice),
      openedAt: typeof tradeCandidate.openedAt === "string" && Number.isFinite(Date.parse(tradeCandidate.openedAt))
        ? new Date(tradeCandidate.openedAt).toISOString()
        : "",
      closedAt: typeof tradeCandidate.closedAt === "string" && Number.isFinite(Date.parse(tradeCandidate.closedAt))
        ? new Date(tradeCandidate.closedAt).toISOString()
        : null,
      entryTimeKnown: tradeCandidate.entryTimeKnown !== false
        && typeof tradeCandidate.openedAt === "string"
        && Number.isFinite(Date.parse(tradeCandidate.openedAt)),
      exitTimeKnown: tradeCandidate.exitTimeKnown !== false
        && typeof tradeCandidate.closedAt === "string"
        && Number.isFinite(Date.parse(tradeCandidate.closedAt)),
      netPnl: finiteNumber(tradeCandidate.netPnl, 0) ?? 0,
      initialRisk: nullablePositiveNumber(tradeCandidate.initialRisk),
      rMultiple: finiteNumber(tradeCandidate.rMultiple),
    } : null;
    const imageDataUrl = typeof payload.imageDataUrl === "string"
      && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(payload.imageDataUrl)
      && payload.imageDataUrl.length <= 1_350_000
      ? payload.imageDataUrl
      : "";
    payload = {
      ...payload,
      kind: ["POST", "ONE-LINER", "TRADE", "MAP", "LIVE OBSERVATION", "REVIEW REQUEST", "LESSON", "QUESTION"].includes(kind) ? kind : "POST",
      instrument: cleanText(payload.instrument, 16).toUpperCase(),
      title: cleanText(payload.title, 180),
      body: cleanText(payload.body, kind === "ONE-LINER" ? 280 : 4_000),
      context: cleanText(payload.context, 2_000),
      condition: cleanText(payload.condition, 1_500),
      invalidation: cleanText(payload.invalidation, 1_500),
      imageDataUrl,
      imageName: imageDataUrl ? cleanText(payload.imageName, 140) : "",
      relatedPrecordId: cleanIdentifier(payload.relatedPrecordId, 180) || null,
      repostOfUserId: cleanIdentifier(payload.repostOfUserId, 80) || undefined,
      repostOfPostId: cleanIdentifier(payload.repostOfPostId, 180) || undefined,
      isRepost: payload.isRepost === true,
      trade: kind === "TRADE" ? trade : undefined,
      pinnedCommentId: cleanIdentifier(payload.pinnedCommentId, 180) || undefined,
      observedAt: typeof payload.observedAt === "string" && Number.isFinite(Date.parse(payload.observedAt))
        ? new Date(payload.observedAt).toISOString()
        : now,
    };
    if ((payload.kind !== "TRADE" && !payload.body) || (payload.kind !== "ONE-LINER" && !payload.instrument)) {
      return NextResponse.json({ error: payload.kind === "ONE-LINER" ? "Write your one-liner first." : "Instrument and post are required." }, { status: 400 });
    }
    if (payload.kind === "TRADE" && (!trade?.journalTradeId || !trade.instrument || !trade.openedAt || trade.entryPrice === null || trade.exitPrice === null)) {
      return NextResponse.json({ error: "Choose a completed journal trade with entry and exit prices." }, { status: 400 });
    }
    id = /^post:[a-zA-Z0-9_-]{8,}$/.test(id) || /^repost:[a-zA-Z0-9:_-]{8,}$/.test(id)
      ? id
      : `post:${crypto.randomUUID()}`;
    if (payload.pinnedCommentId) {
      const { data: pinnedComment } = await supabase
        .from("social_objects")
        .select("id")
        .eq("id", String(payload.pinnedCommentId))
        .eq("parent_id", id)
        .eq("object_type", "comment")
        .maybeSingle();
      if (!pinnedComment) return NextResponse.json({ error: "That comment can no longer be pinned." }, { status: 409 });
    }
    useUpsert = true;
  } else if (objectType === "comment") {
    if (!parentId) return NextResponse.json({ error: "Choose a post to comment on." }, { status: 400 });
    const body = cleanText(payload.body, 2_000);
    if (!body) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });
    const replyToCommentId = cleanIdentifier(payload.replyToCommentId, 180) || null;
    if (replyToCommentId) {
      const { data: replyTarget } = await supabase
        .from("social_objects")
        .select("id")
        .eq("id", replyToCommentId)
        .eq("parent_id", parentId)
        .eq("object_type", "comment")
        .maybeSingle();
      if (!replyTarget) return NextResponse.json({ error: "That comment thread is no longer available." }, { status: 409 });
    }
    payload = {
      kind: ["QUESTION", "REVIEW", "COUNTERCASE", "LESSON", "TRADER NOTE"].includes(cleanText(payload.kind, 24))
        ? cleanText(payload.kind, 24)
        : "REVIEW",
      body,
      helpful: payload.helpful === true,
      replyToCommentId,
    };
    id = /^comment:[a-zA-Z0-9_-]{8,}$/.test(id) ? id : `comment:${crypto.randomUUID()}`;
    // Comments use the same authenticated compound key for creation and edits.
    // A user can therefore update only their own comment; another user's row has
    // a different user_id and cannot be overwritten by reusing its public id.
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
      .select("id,payload")
      .eq("user_id", actor.userId)
      .eq("id", parentId)
      .eq("object_type", "precord")
      .maybeSingle();
    if (parentError || !parent) {
      return NextResponse.json({ error: "Only the owner can complete this Decision Record." }, { status: 403 });
    }
    const parentPayload = parent.payload && typeof parent.payload === "object"
      ? parent.payload as Partial<SocialPrecordPayload>
      : {};
    if (parentPayload.recordMode !== "HISTORICAL") {
      const { data: execution } = await supabase
        .from("social_objects")
        .select("payload")
        .eq("user_id", actor.userId)
        .eq("id", `gameplan-execution:${parentId}`)
        .eq("object_type", "consensus")
        .maybeSingle();
      const executionPayload = execution?.payload && typeof execution.payload === "object"
        ? execution.payload as Record<string, unknown>
        : null;
      if (executionPayload?.kind !== "GAMEPLAN_EXECUTION" || executionPayload.stage !== "CLOSED") {
        return NextResponse.json({ error: "Record the timestamped entry and completed trade in Game Plan → Scoring before scoring it." }, { status: 409 });
      }
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
    const definition = CALLING_CARD_CATALOG.find((candidate) => candidate.code === code);
    if (!definition || !["origin-signal", "first-on-record"].includes(code)) {
      return NextResponse.json({ error: "Calling Cards are awarded by verified product rules." }, { status: 403 });
    }
    if (code === "first-on-record") {
      const { count } = await supabase
        .from("social_objects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", actor.userId)
        .eq("object_type", "precord");
      if (!count) return NextResponse.json({ error: "Lock a Decision Record before claiming this card." }, { status: 409 });
    }
    payload = {
      code: definition.code,
      name: definition.name,
      family: definition.family,
      description: definition.description,
      earnedAt: typeof payload.earnedAt === "string" && Number.isFinite(Date.parse(payload.earnedAt))
        ? new Date(payload.earnedAt).toISOString()
        : now,
      active: payload.active !== false,
      equipped: payload.equipped === true || definition.starter === true,
      public: payload.public !== false,
    };
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
      tradingAccount: normalizeZyonTradingAccount(payload.tradingAccount),
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
        tradingAccount: candidate.tradingAccount,
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

  if (objectType === "post" || objectType === "comment" || objectType === "precord") {
    const { data: profileIdentity } = await supabase
      .from("social_objects")
      .select("author_label,payload")
      .eq("user_id", actor.userId)
      .eq("object_type", "profile")
      .eq("id", "profile")
      .maybeSingle();
    const profilePayload = profileIdentity?.payload && typeof profileIdentity.payload === "object"
      ? profileIdentity.payload as Record<string, unknown>
      : null;
    authorLabel = cleanText(profilePayload?.displayName, 48)
      || cleanText(profileIdentity?.author_label, 48)
      || authorLabel;
  }

  if (objectType === "precord") {
    const { data: existing, error: existingError } = await supabase
      .from("social_objects")
      .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
      .eq("user_id", actor.userId)
      .eq("id", id)
      .eq("object_type", "precord")
      .maybeSingle();
    if (existingError) {
      if (tableUnavailable(existingError.code)) return NextResponse.json({ cloud: false }, { status: 503 });
      return NextResponse.json({ error: existingError.message || "The existing Gameplan could not be checked." }, { status: 502 });
    }
    if (existing) {
      const existingPayload = existing.payload && typeof existing.payload === "object"
        ? existing.payload as Record<string, unknown>
        : {};
      if (!payload.sourceGameplanId || existingPayload.sourceGameplanId === payload.sourceGameplanId) {
        return NextResponse.json({ cloud: true, object: fromRow(existing as SocialRow), idempotent: true });
      }
      return NextResponse.json({ error: "That scoring record ID already belongs to another Gameplan." }, { status: 409 });
    }
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
  let payload: { id?: unknown; parentId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose an object to remove." }, { status: 400 });
  }
  const id = cleanIdentifier(payload.id);
  const parentId = cleanIdentifier(payload.parentId);
  if (!id) return NextResponse.json({ error: "Choose an object to remove." }, { status: 400 });
  const { data: existing } = await supabase
    .from("social_objects")
    .select("user_id,id,object_type,parent_id")
    .eq("user_id", actor.userId)
    .eq("id", id)
    .maybeSingle();
  if (!existing && parentId) {
    const { data: ownedParent } = await supabase
      .from("social_objects")
      .select("id")
      .eq("user_id", actor.userId)
      .eq("id", parentId)
      .eq("object_type", "post")
      .maybeSingle();
    if (!ownedParent) return NextResponse.json({ error: "Only the author can moderate this post." }, { status: 403 });
    const { data: moderatedComment } = await supabase
      .from("social_objects")
      .select("user_id,id,object_type,parent_id")
      .eq("id", id)
      .eq("parent_id", parentId)
      .eq("object_type", "comment")
      .maybeSingle();
    if (!moderatedComment) return NextResponse.json({ error: "That comment no longer exists." }, { status: 404 });
    const { error: moderationError } = await supabase
      .from("social_objects")
      .delete()
      .eq("user_id", moderatedComment.user_id)
      .eq("id", id)
      .eq("parent_id", parentId);
    if (moderationError) return NextResponse.json({ error: "The comment could not be removed." }, { status: 502 });
    return NextResponse.json({ deleted: id });
  }
  if (!existing) return NextResponse.json({ error: "That object no longer exists." }, { status: 404 });
  if (existing.object_type === "precord") {
    return NextResponse.json({ error: "Locked Decision Records cannot be deleted from the record." }, { status: 409 });
  }
  const { error } = await supabase.from("social_objects").delete().eq("user_id", actor.userId).eq("id", id);
  if (error) return NextResponse.json({ error: "The object could not be removed." }, { status: 502 });
  return NextResponse.json({ deleted: id });
}
