import { NextRequest, NextResponse } from "next/server";
import {
  getConfiguredQuantDataApiKey,
  getOptionsFlowPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;
const TOOL_IDS = new Set([
  "consolidated-flow",
  "contract-side-statistics",
  "contract-statistics",
  "exposure-expiration",
  "exposure-strike",
  "gainers-losers",
  "max-pain",
  "net-drift",
  "net-flow",
  "oi-strike",
  "term-structure",
  "unconsolidated-flow",
]);

function responseForTool(tool: string, payload: Awaited<ReturnType<typeof getOptionsFlowPayload>>) {
  const common = {
    schemaVersion: 1,
    provider: "KwantData",
    tool,
    symbol: payload.symbol,
    sessionDate: payload.session.sessionDate,
    marketOpen: payload.session.marketOpen,
    snapshotMode: payload.snapshotMode,
    asOf: payload.asOf,
    refreshAfterMs: payload.refreshAfterMs,
    errors: payload.errors,
  };
  const greek = payload.exposures.GAMMA;
  switch (tool) {
    case "consolidated-flow":
    case "unconsolidated-flow":
      return { ...common, rows: payload.flow, board: payload.flowBoard };
    case "contract-side-statistics":
      return { ...common, rows: payload.positioning.tradeSidePremium };
    case "contract-statistics":
      return { ...common, rows: [payload.marketMap.putCallVolume].filter(Boolean) };
    case "exposure-expiration":
      return { ...common, rows: greek?.expiries ?? [] };
    case "exposure-strike":
      return { ...common, rows: greek?.strikes ?? [], netExposure: greek?.net ?? null, grossExposure: greek?.gross ?? null };
    case "gainers-losers":
      return { ...common, rows: payload.flowBoard };
    case "max-pain":
      return { ...common, rows: payload.levels.zeroDteMaxPain === null ? [] : [{ strike: payload.levels.zeroDteMaxPain, expiration: payload.session.sessionDate }] };
    case "net-drift":
      return { ...common, rows: payload.drift };
    case "net-flow":
      return { ...common, rows: payload.drift, trades: payload.flow };
    case "oi-strike":
      return { ...common, rows: payload.openInterest };
    case "term-structure":
      return { ...common, rows: payload.marketMap.volatility.termStructure, state: payload.marketMap.volatility.termStructureState };
    default:
      return common;
  }
}

export async function GET(request: NextRequest) {
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "KwantData is not configured." }, { status: 503 });
  }
  const tool = (request.nextUrl.searchParams.get("tool") || "").trim().toLowerCase();
  const symbol = (request.nextUrl.searchParams.get("symbol") || "SPX").trim().toUpperCase();
  const sessionDate = request.nextUrl.searchParams.get("sessionDate")?.trim() || undefined;
  if (!TOOL_IDS.has(tool)) return NextResponse.json({ error: "Unsupported GEX BOX tool." }, { status: 400 });
  if (!SYMBOL_PATTERN.test(symbol)) return NextResponse.json({ error: "Invalid ticker symbol." }, { status: 400 });
  if (sessionDate && !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return NextResponse.json({ error: "Invalid session date." }, { status: 400 });

  try {
    const payload = await getOptionsFlowPayload(symbol, "CASH", sessionDate, "FULL");
    return NextResponse.json(responseForTool(tool, payload), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message, rateLimitRemaining: problem.remaining },
      { status: problem.status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
