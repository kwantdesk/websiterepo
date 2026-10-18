import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getRouteActor } from "@/lib/serverAuth";
import { vendorMarketDataFetch } from "@/lib/vendorMarketData.server";
import { fetchInstitutionalMarketData } from "@/lib/institutionalMarketData.server";
import { conditionalJson } from "@/lib/conditionalJson";
import { GEX_DATA_TOOLS, gexDataClock, validateGexDataRequest } from "@/lib/gexDataPolicy";

export const runtime = "nodejs";
export const maxDuration = 45;
type Context = { params: Promise<{ tool: string }> };
type Entry = { payload: unknown; until: number; asOf: string; bytes: number };
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<Entry>>();

export async function GET(request: NextRequest, context: Context) {
  const actor = await getRouteActor(request);
  if (!actor || (process.env.VERCEL && actor.mode === "local-dev")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { tool } = await context.params;
  if (tool !== "status") return NextResponse.json({ error: "Unsupported request." }, { status: 404 });
  let connected = false;
  try { const response = await fetchInstitutionalMarketData("health", { method: "GET" }, 5000); connected = Boolean(response?.ok); }
  catch { /* Honest unavailable status; no vendor discovery/probe requests. */ }
  return conditionalJson(request, { connected, mode: "gateway", market: gexDataClock() }, { identity: `gex-data-status:${connected}:${Math.floor(Date.now() / 15000)}`, maxAgeMs: 15000 });
}

export async function POST(request: NextRequest, context: Context) {
  const actor = await getRouteActor(request);
  if (!actor || (process.env.VERCEL && actor.mode === "local-dev")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { tool } = await context.params;
  let body: Record<string, unknown>;
  try { const text = await request.text(); if (text.length > 128_000) throw new Error("The filter request is too large."); body = validateGexDataRequest(tool, JSON.parse(text)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request." }, { status: 400 }); }
  const spec = GEX_DATA_TOOLS[tool], clock = gexDataClock();
  const historical = typeof body.sessionDate === "string" && body.sessionDate < clock.date;
  const ttl = historical || body.snapshotTime ? 300_000 : 15_000;
  const serialized = JSON.stringify(body);
  const key = createHash("sha256").update(`${tool}:${clock.date}:${serialized}`).digest("hex");
  try {
    let entry = cache.get(key);
    if (!entry || entry.until < Date.now()) {
      let job = pending.get(key);
      if (!job) {
        if (pending.size >= 16) return NextResponse.json({ error: "The data queue is busy. Try again shortly." }, { status: 503, headers: { "Retry-After": "15" } });
        job = (async () => {
          const response = await vendorMarketDataFetch("quantdata", `/v1/${spec.surface}/tool/${spec.path ?? tool}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: serialized,
          });
          if (!response.ok) throw Object.assign(new Error(response.status === 429 ? "The data provider is rate-limited. Wait before retrying." : "This data is unavailable from the connected feed."), { status: response.status });
          const text = await response.text();
          if (text.length > 12_000_000) throw new Error("Choose a narrower data range.");
          const value = { payload: JSON.parse(text), until: Date.now() + ttl, asOf: new Date().toISOString(), bytes: text.length };
          cache.delete(key); cache.set(key, value);
          let bytes = [...cache.values()].reduce((sum, item) => sum + item.bytes, 0);
          while (cache.size > 32 || bytes > 32_000_000) { const oldest = cache.keys().next().value!; bytes -= cache.get(oldest)!.bytes; cache.delete(oldest); }
          return value;
        })().finally(() => pending.delete(key));
        pending.set(key, job);
      }
      entry = await job;
    }
    const payload = entry.payload && typeof entry.payload === "object" ? { ...entry.payload, _gexData: { gatewayFetchedAt: entry.asOf, requestedSessionDate: body.sessionDate ?? null, liveVerified: false } } : entry.payload;
    return conditionalJson(request, payload, { identity: key + entry.asOf, maxAgeMs: Math.max(0, entry.until - Date.now()) });
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 502;
    return NextResponse.json({ error: "The selected market data could not be loaded. Try again shortly." }, { status: status >= 400 && status <= 599 ? status : 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
