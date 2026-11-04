import { NextResponse, type NextRequest } from "next/server";
import { getRouteActor } from "@/lib/serverAuth";
import { fetchInstitutionalMarketData } from "@/lib/institutionalMarketData.server";
import { validateGexDataRequest } from "@/lib/gexDataPolicy";
import { validateHeatCellArchiveQuery } from "../../../../../services/rithmic_gateway/src/heat-cell-archive-policy.mjs";

export const runtime = "nodejs";
export const maxDuration = 15;
async function boundedText(body: ReadableStream<Uint8Array> | null, maximum: number) {
  if (!body) return "";
  const reader = body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
  try { while (true) { const result = await reader.read(); if (result.done) break; bytes += result.value.byteLength; if (bytes > maximum) throw new Error("Payload too large."); chunks.push(result.value); } }
  finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks).toString("utf8");
}
export async function POST(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || (process.env.VERCEL && actor.mode === "local-dev")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let input: Record<string, unknown>;
  try {
    if (new URL(request.url).search || !/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || "")) throw new Error("Unsupported request.");
    input = JSON.parse(await boundedText(request.body, 65536));
    input.request = validateGexDataRequest("heat-map", input.request);
    validateHeatCellArchiveQuery(input);
  } catch { return NextResponse.json({ error: "Choose a valid recorded Heat Map cell." }, { status: 400 }); }
  try {
    const response = await fetchInstitutionalMarketData("v1/market-data/heat-map-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: request.signal }, 8000);
    const payload = JSON.parse(await boundedText(response.body, 1_000_000));
    if (!response.ok) return NextResponse.json({ error: "Recorded cell history is unavailable.", code: payload.code }, { status: [400, 404, 409, 413, 415, 429, 503].includes(response.status) ? response.status : 502, headers: { "Cache-Control": "private, no-store" } });
    if (!Array.isArray(payload.rows) || payload.rows.length > 256 || payload.coverage?.kind !== "observations-only") throw new Error("Invalid history receipt.");
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Recorded cell history is unavailable." }, { status: 502, headers: { "Cache-Control": "private, no-store" } }); }
}
