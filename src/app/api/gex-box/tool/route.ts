import { NextRequest, NextResponse } from "next/server";
import {
  getConfiguredQuantDataApiKey,
  getGexBoxVolatilityDrift,
  getGexFlowPayload,
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
  "volatility-drift",
]);

function detailModeForTool(tool: string): "FULL" | "GAMEPLAN" | "CORE" {
  if (["contract-side-statistics", "contract-statistics", "gainers-losers", "term-structure"].includes(tool)) return "FULL";
  if (["max-pain", "oi-strike"].includes(tool)) return "GAMEPLAN";
  return "CORE";
}

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
    if (tool === "consolidated-flow" || tool === "unconsolidated-flow") {
      const flow = await getGexFlowPayload({
        symbol,
        mode: tool === "unconsolidated-flow" ? "RAW" : "CONSOLIDATED",
        sessionDate,
        size: 100,
      });
      return NextResponse.json({
        schemaVersion: 1,
        provider: "KwantData",
        tool,
        symbol,
        sessionDate: flow.sessionDate,
        marketOpen: flow.marketOpen,
        snapshotMode: flow.status,
        asOf: flow.asOf,
        refreshAfterMs: flow.refreshAfterMs,
        rows: flow.rows,
        summary: flow.summary,
        limitations: flow.diagnostics.limitations,
      }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }
    if (tool === "volatility-drift") {
      const date = sessionDate || new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
      return NextResponse.json(await getGexBoxVolatilityDrift({ symbol, sessionDate: date }), {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    // Most GEX BOX panels need only the core gamma/flow surface. Requesting
    // FULL used to rebuild interval maps, skew, IV and term structure whenever
    // a small strike table opened, which made the whole browser appear frozen.
    const payload = await getOptionsFlowPayload(symbol, "CASH", sessionDate, detailModeForTool(tool));
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
