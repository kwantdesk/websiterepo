import { NextResponse, type NextRequest } from "next/server";

import { getRouteActor } from "@/lib/serverAuth";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function usageValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, count]) => Number.isFinite(Number(count)) && Number(count) > 0)
    .map(([emoji, count]) => [emoji.slice(0, 32), Math.min(100_000, Math.floor(Number(count)))]));
}

async function client(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") return { actor: null, supabase: null };
  try { return { actor, supabase: await createSupabaseServerClient() }; } catch { return { actor, supabase: null }; }
}

export async function GET(request: NextRequest) {
  const { actor, supabase } = await client(request);
  if (!actor) return response({ usage: {} }, 401);
  if (!supabase) return response({ usage: {}, configured: false });
  const result = await supabase.from("user_emoji_preferences").select("usage").eq("user_id", actor.userId).maybeSingle();
  if (result.error) return response({ usage: {}, configured: false });
  return response({ usage: usageValue(result.data?.usage), configured: true });
}

export async function POST(request: NextRequest) {
  const { actor, supabase } = await client(request);
  if (!actor) return response({ error: "Authentication required." }, 401);
  if (!supabase) return response({ configured: false });
  let body: { emoji?: unknown };
  try { body = await request.json(); } catch { return response({ error: "Emoji usage could not be read." }, 400); }
  const emoji = typeof body.emoji === "string" ? body.emoji.trim().slice(0, 32) : "";
  if (!emoji) return response({ error: "Choose an emoji." }, 400);
  const current = await supabase.from("user_emoji_preferences").select("usage").eq("user_id", actor.userId).maybeSingle();
  if (current.error && current.error.code !== "PGRST116") return response({ configured: false });
  const usage = usageValue(current.data?.usage);
  usage[emoji] = Math.min(100_000, (usage[emoji] ?? 0) + 1);
  const result = await supabase.from("user_emoji_preferences").upsert({ user_id: actor.userId, usage, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (result.error) return response({ configured: false });
  return response({ configured: true, usage });
}
