import { NextResponse, type NextRequest } from "next/server";

import {
  type KwantBotInterpreterMessage,
  type KwantBotMarketContext,
  type KwantBotMarketRoot,
  type KwantBotMemoryEvent,
} from "@/lib/kwantBotInterpreter";
import { getRouteActor } from "@/lib/serverAuth";
import { createClient } from "@/lib/supabase/server";

const MESSAGE_TABLE = "kwantbot_messages";
const MEMORY_TABLE = "kwantbot_memory_events";
const CONTEXT_TABLE = "kwantbot_context_snapshots";
const MAX_MESSAGE_BATCH = 500;
const MAX_MEMORY_BATCH = 1_000;
const MAX_CONTEXT_BATCH = 24;

type ContextSnapshot = {
  snapshotKey: string;
  context: KwantBotMarketContext;
};

function storageUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    { configured: false, storage: "local", error: message },
    { status: 503 },
  );
}

function isRoot(value: unknown): value is KwantBotMarketRoot {
  return value === "NQ" || value === "ES";
}

function isMessage(value: unknown): value is KwantBotInterpreterMessage {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<KwantBotInterpreterMessage>;
  return (
    typeof item.id === "string"
    && isRoot(item.root)
    && typeof item.kind === "string"
    && typeof item.text === "string"
    && typeof item.createdAt === "string"
    && typeof item.dedupeKey === "string"
  );
}

function isMemoryEvent(value: unknown): value is KwantBotMemoryEvent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<KwantBotMemoryEvent>;
  return (
    typeof item.id === "string"
    && isRoot(item.root)
    && typeof item.type === "string"
    && typeof item.createdAt === "string"
  );
}

function isContext(value: unknown): value is KwantBotMarketContext {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<KwantBotMarketContext>;
  return (
    isRoot(item.root)
    && typeof item.generatedAt === "string"
    && typeof item.sessionDate === "string"
    && Array.isArray(item.levels)
    && Boolean(item.options && typeof item.options === "object")
  );
}

function isContextSnapshot(value: unknown): value is ContextSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ContextSnapshot>;
  return typeof item.snapshotKey === "string" && isContext(item.context);
}

function parsePayload<T>(
  rows: Array<{ payload?: unknown }> | null,
  guard: (value: unknown) => value is T,
) {
  return (rows ?? []).map((row) => row.payload).filter(guard);
}

export async function GET(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const requestedRoot = request.nextUrl.searchParams.get("root");
  const root = isRoot(requestedRoot) ? requestedRoot : null;
  const download = request.nextUrl.searchParams.get("download") === "1";

  try {
    const supabase = await createClient();
    let messageQuery = supabase
      .from(MESSAGE_TABLE)
      .select("payload,created_at")
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: false })
      .limit(download ? 10_000 : 2_000);
    let memoryQuery = supabase
      .from(MEMORY_TABLE)
      .select("payload,created_at")
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: false })
      .limit(download ? 50_000 : 5_000);
    let contextQuery = supabase
      .from(CONTEXT_TABLE)
      .select("payload,generated_at,snapshot_key")
      .eq("user_id", actor.userId)
      .order("generated_at", { ascending: false })
      .limit(download ? 5_000 : 100);

    if (root) {
      messageQuery = messageQuery.eq("root", root);
      memoryQuery = memoryQuery.eq("root", root);
      contextQuery = contextQuery.eq("root", root);
    }

    const [messageResult, memoryResult, contextResult] = await Promise.all([
      messageQuery,
      memoryQuery,
      contextQuery,
    ]);
    const error = messageResult.error ?? memoryResult.error ?? contextResult.error;
    if (error) throw new Error(error.message);

    const messages = parsePayload(messageResult.data, isMessage)
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    const memory = parsePayload(memoryResult.data, isMemoryEvent)
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    const contexts = parsePayload(contextResult.data, isContext)
      .sort((left, right) => Date.parse(left.generatedAt) - Date.parse(right.generatedAt));
    const archive = {
      format: "kwantdesk-kwantbot-archive-v1",
      storage: "supabase",
      exportedAt: new Date().toISOString(),
      root,
      messages,
      memory,
      contexts,
    };

    return NextResponse.json(
      { configured: true, ...archive },
      download
        ? {
            headers: {
              "Content-Disposition": `attachment; filename="kwantbot-${root?.toLowerCase() ?? "all"}-archive-${new Date().toISOString().slice(0, 10)}.json"`,
              "Cache-Control": "no-store",
            },
          }
        : { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return storageUnavailable(error);
  }
}

export async function POST(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: {
    messages?: unknown;
    memory?: unknown;
    contexts?: unknown;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.filter(isMessage).slice(-MAX_MESSAGE_BATCH)
    : [];
  const memory = Array.isArray(body.memory)
    ? body.memory.filter(isMemoryEvent).slice(-MAX_MEMORY_BATCH)
    : [];
  const contexts = Array.isArray(body.contexts)
    ? body.contexts.filter(isContextSnapshot).slice(-MAX_CONTEXT_BATCH)
    : [];
  if (!messages.length && !memory.length && !contexts.length) {
    return NextResponse.json({ error: "No valid KwantBot archive records supplied." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const writes = [];

    if (messages.length) {
      writes.push(
        supabase.from(MESSAGE_TABLE).upsert(
          messages.map((item) => ({
            user_id: actor.userId,
            id: item.id,
            root: item.root,
            kind: item.kind,
            level_id: item.levelId ?? null,
            created_at: item.createdAt,
            payload: item,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,id" },
        ),
      );
    }
    if (memory.length) {
      writes.push(
        supabase.from(MEMORY_TABLE).upsert(
          memory.map((item) => ({
            user_id: actor.userId,
            id: item.id,
            root: item.root,
            event_type: item.type,
            level_id: item.levelId ?? null,
            created_at: item.createdAt,
            payload: item,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,id" },
        ),
      );
    }
    if (contexts.length) {
      writes.push(
        supabase.from(CONTEXT_TABLE).upsert(
          contexts.map(({ snapshotKey, context }) => ({
            user_id: actor.userId,
            root: context.root,
            snapshot_key: snapshotKey,
            generated_at: context.generatedAt,
            payload: context,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,root,snapshot_key" },
        ),
      );
    }

    const results = await Promise.all(writes);
    const error = results.find((result) => result.error)?.error;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      configured: true,
      storage: "supabase",
      saved: {
        messages: messages.length,
        memory: memory.length,
        contexts: contexts.length,
      },
      ids: {
        messages: messages.map((item) => item.id),
        memory: memory.map((item) => item.id),
        contexts: contexts.map((item) => item.snapshotKey),
      },
    });
  } catch (error) {
    return storageUnavailable(error);
  }
}
