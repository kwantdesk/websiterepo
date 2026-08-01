import { NextRequest, NextResponse } from "next/server";
import { getKwantBotMarketContext } from "@/lib/kwantBotContext.server";
import type { KwantBotMarketRoot } from "@/lib/kwantBotInterpreter";
import { getConfiguredQuantDataApiKey, getQuantDataHttpError } from "@/lib/quantData.server";
import { getRouteActor } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function validRoot(value: string): value is KwantBotMarketRoot {
  return value === "NQ" || value === "ES";
}

export async function GET(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json(
      { error: "The KwantBot options feed is not configured." },
      { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const rootInput = (request.nextUrl.searchParams.get("root") || "NQ").trim().toUpperCase();
  if (!validRoot(rootInput)) {
    return NextResponse.json(
      { error: "KwantBot currently supports NQ and ES." },
      { status: 400, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  try {
    const payload = await getKwantBotMarketContext(rootInput);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message },
      {
        status: problem.status,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
