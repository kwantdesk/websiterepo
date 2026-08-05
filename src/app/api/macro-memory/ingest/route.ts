import { NextRequest, NextResponse } from "next/server";
import { ingestMacroMemory } from "@/lib/macroMemory.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "iad1";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) return request.headers.get("authorization") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production" || request.headers.get("x-vercel-cron") === "1";
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Macro ingestion authorization failed." }, { status: 401 });
  }
  try {
    const result = await ingestMacroMemory(request.nextUrl.searchParams.get("force") === "1");
    return NextResponse.json(result, {
      status: result.configured ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Macro memory ingestion failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Macro memory ingestion failed.",
    }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
