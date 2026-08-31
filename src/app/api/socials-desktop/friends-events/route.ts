import { NextResponse, type NextRequest } from "next/server";

import { getSocialsRouteActor } from "@/lib/serverAuth";
import { createSocialsStorageClient } from "@/lib/socialsStorage.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const encoder = new TextEncoder();
const TABLES = [
  "social_objects",
  "friend_chats",
  "friend_chat_members",
  "friend_chat_messages",
] as const;

/**
 * Desktop Friends realtime invalidation edge. The workstation connects only to
 * the authenticated VPS. This server-held channel observes the same four
 * production tables as the browser panel and emits table names only; account
 * rows and the Supabase credential never enter the event stream.
 */
export async function GET(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.mode !== "desktop-gateway") {
    return NextResponse.json({ error: "The desktop realtime edge is gateway-only." }, { status: 403 });
  }

  const supabase = await createSocialsStorageClient(actor);
  const channelName = `desktop-friends:${actor.userId}:${crypto.randomUUID()}`;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const enqueue = (value: string) => {
    if (closed || !controllerRef) return;
    try { controllerRef.enqueue(encoder.encode(value)); } catch { closed = true; }
  };
  const cleanup = async () => {
    if (closed && !channel && !heartbeat) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    const active = channel;
    channel = null;
    if (active) {
      try { await supabase.removeChannel(active); } catch { /* connection teardown */ }
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      channel = supabase.channel(channelName);
      for (const table of TABLES) {
        channel = channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => enqueue(`event: invalidated\ndata: ${JSON.stringify({ table })}\n\n`),
        );
      }
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") enqueue("event: ready\ndata: {}\n\n");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          enqueue(`event: unavailable\ndata: ${JSON.stringify({ status })}\n\n`);
        }
      });
      heartbeat = setInterval(() => enqueue(": keepalive\n\n"), 15_000);
      request.signal.addEventListener("abort", () => void cleanup(), { once: true });
    },
    cancel() { return cleanup(); },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
