import { NextRequest, NextResponse } from "next/server";
import type { GexFlowMode } from "@/lib/gexFlow";
import {
  getConfiguredQuantDataApiKey,
  getGexFlowPayload,
  getLastGoodGexFlowPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;

function modeFrom(value: string | null): GexFlowMode {
  const mode = value?.toUpperCase();
  return mode === "RAW" || mode === "CONSOLIDATED" ? mode : "HYBRID";
}

export async function GET(request: NextRequest) {
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "GEX FLOW options data is not configured." }, { status: 503 });
  }
  const symbol = (request.nextUrl.searchParams.get("symbol") || "SPX").trim().toUpperCase();
  const mode = modeFrom(request.nextUrl.searchParams.get("mode"));
  const sessionDate = request.nextUrl.searchParams.get("sessionDate")?.trim() || undefined;
  const replayAt = request.nextUrl.searchParams.get("replayAt")?.trim() || undefined;
  const size = Number(request.nextUrl.searchParams.get("size") || "100");
  const cursorValue = request.nextUrl.searchParams.get("cursor");
  const cursor = cursorValue ? cursorValue.split("|").filter(Boolean) : undefined;
  if (!SYMBOL_PATTERN.test(symbol)) return NextResponse.json({ error: "Invalid options ticker." }, { status: 400 });

  try {
    const payload = await getGexFlowPayload({ symbol, mode, sessionDate, replayAt, size, cursor });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    const resolvedDate = sessionDate || new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const lastGood = getLastGoodGexFlowPayload(symbol, mode, resolvedDate);
    if (lastGood) {
      return NextResponse.json({
        ...lastGood,
        status: "STALE",
        stale: true,
        refreshAfterMs: 10_000,
        diagnostics: {
          ...lastGood.diagnostics,
          limitations: [...lastGood.diagnostics.limitations, `Live refresh delayed: ${problem.message}. Holding the last valid flow tape.`],
        },
      }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }
    return NextResponse.json({ error: problem.message, rateLimitRemaining: problem.remaining }, {
      status: problem.status,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
