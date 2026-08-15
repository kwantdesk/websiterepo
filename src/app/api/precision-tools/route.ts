import { NextResponse, type NextRequest } from "next/server";
import { getRouteActor } from "@/lib/serverAuth";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { PRECISION_TOOL_IDS } from "@/chart/precision-tools/types";

export const dynamic = "force-dynamic";

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function cleanId(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanObjects(value: unknown) {
  if (!Array.isArray(value)) return null;
  const objects = value.slice(0, 750).filter((candidate) => isRecord(candidate)
    && candidate.schemaVersion === 1
    && typeof candidate.id === "string"
    && PRECISION_TOOL_IDS.includes(candidate.toolId as never)
    && Array.isArray(candidate.anchors));
  return JSON.stringify(objects).length <= 1_500_000 ? objects : null;
}

function cleanConfigs(value: unknown) {
  if (!Array.isArray(value)) return null;
  const configs = value.slice(0, PRECISION_TOOL_IDS.length * 9).filter((candidate) => isRecord(candidate)
    && candidate.schemaVersion === 1
    && PRECISION_TOOL_IDS.includes(candidate.toolId as never)
    && Number(candidate.slot) >= 1
    && Number(candidate.slot) <= 9);
  return JSON.stringify(configs).length <= 500_000 ? configs : null;
}

function precisionPreferenceKeys(workspaceId: string, chartId: string) {
  return {
    objects: `kwantdesk:precision-tools:v1:${workspaceId}:${chartId}`,
    configs: `kwantdesk:precision-tool-configs:v1:${workspaceId}`,
    toolbar: `kwantdesk:precision-toolbar:v1:${workspaceId}`,
  };
}

function parseStoredJson(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try { return JSON.parse(value) as unknown; }
  catch { return null; }
}

async function loadPreferenceFallback(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  workspaceId: string,
  chartId: string,
) {
  const result = await supabase
    .from("user_preferences")
    .select("preferences,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error || !isRecord(result.data?.preferences)) return null;
  const values = isRecord(result.data.preferences.values) ? result.data.preferences.values : {};
  const keys = precisionPreferenceKeys(workspaceId, chartId);
  const objectDocument = parseStoredJson(values[keys.objects]);
  const objects = isRecord(objectDocument) ? cleanObjects(objectDocument.objects) : null;
  const configs = cleanConfigs(parseStoredJson(values[keys.configs]));
  const toolbar = parseStoredJson(values[keys.toolbar]);
  if (!objects && !configs && !isRecord(toolbar)) return null;
  return {
    objects: objects ?? [],
    configs: configs ?? [],
    toolbar: isRecord(toolbar) ? toolbar : {},
    updatedAt: result.data.updated_at ?? null,
  };
}

async function savePreferenceFallback(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  workspaceId: string,
  chartId: string,
  objects: Record<string, unknown>[],
  configs: Record<string, unknown>[],
  toolbar: Record<string, unknown>,
) {
  const current = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (current.error) return false;
  const existing = isRecord(current.data?.preferences) ? current.data.preferences : {};
  const values = isRecord(existing.values) ? existing.values : {};
  const keys = precisionPreferenceKeys(workspaceId, chartId);
  const updatedAt = new Date().toISOString();
  const nextPreferences = {
    ...existing,
    version: 1,
    complete: existing.complete !== false,
    updatedAt,
    values: {
      ...values,
      [keys.objects]: JSON.stringify({ schemaVersion: 1, workspaceId, chartId, objects, savedAt: Date.now() }),
      [keys.configs]: JSON.stringify(configs),
      [keys.toolbar]: JSON.stringify({ ...toolbar, activeTool: null, mode: "select" }),
    },
  };
  const saved = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, preferences: nextPreferences, updated_at: updatedAt }, { onConflict: "user_id" });
  return !saved.error;
}

async function context(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") return { actor: null, supabase: null };
  try { return { actor, supabase: await createSupabaseServerClient() }; }
  catch { return { actor, supabase: null }; }
}

export async function GET(request: NextRequest) {
  const workspaceId = cleanId(request.nextUrl.searchParams.get("workspaceId"), 120);
  const chartId = cleanId(request.nextUrl.searchParams.get("chartId"), 160);
  if (!workspaceId || !chartId) return response({ error: "Workspace and chart are required." }, 400);
  const { actor, supabase } = await context(request);
  if (!actor) return response({ configured: false, objects: [], configs: [], toolbar: {} }, 401);
  if (!supabase) return response({ configured: false, objects: [], configs: [], toolbar: {} });
  const result = await supabase.from("precision_tool_documents").select("objects,configs,toolbar,schema_version,updated_at").eq("user_id", actor.userId).eq("workspace_id", workspaceId).eq("chart_id", chartId).maybeSingle();
  if (result.error) {
    const fallback = await loadPreferenceFallback(supabase, actor.userId, workspaceId, chartId);
    if (!fallback) return response({ configured: false, objects: [], configs: [], toolbar: {} });
    return response({ configured: true, ...fallback, schemaVersion: 1, backend: "account-preferences" });
  }
  return response({ configured: true, objects: cleanObjects(result.data?.objects) ?? [], configs: cleanConfigs(result.data?.configs) ?? [], toolbar: isRecord(result.data?.toolbar) ? result.data.toolbar : {}, schemaVersion: Number(result.data?.schema_version ?? 1), updatedAt: result.data?.updated_at ?? null });
}

export async function PUT(request: NextRequest) {
  const { actor, supabase } = await context(request);
  if (!actor) return response({ error: "Authentication required." }, 401);
  if (!supabase) return response({ configured: false });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return response({ error: "Precision payload could not be read." }, 400); }
  const workspaceId = cleanId(body.workspaceId, 120), chartId = cleanId(body.chartId, 160);
  const objects = cleanObjects(body.objects), configs = cleanConfigs(body.configs);
  const toolbar = isRecord(body.toolbar) ? body.toolbar : null;
  if (!workspaceId || !chartId || !objects || !configs || !toolbar) return response({ error: "Precision payload is invalid." }, 400);
  const result = await supabase.from("precision_tool_documents").upsert({ user_id: actor.userId, workspace_id: workspaceId, chart_id: chartId, schema_version: 1, objects, configs, toolbar, updated_at: new Date().toISOString() }, { onConflict: "user_id,workspace_id,chart_id" });
  if (result.error) {
    const saved = await savePreferenceFallback(supabase, actor.userId, workspaceId, chartId, objects, configs, toolbar);
    return response({ configured: saved, saved: saved ? objects.length : 0, backend: saved ? "account-preferences" : "local" });
  }
  return response({ configured: true, saved: objects.length });
}
