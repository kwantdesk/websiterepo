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

function selectedExpiryRows<T extends { expiration?: string }>(rows: T[], expiry: string, sessionDate: string) {
  if (expiry === "ALL") return rows;
  const expirations = [...new Set(rows.map((row) => row.expiration).filter((value): value is string => Boolean(value)))].sort();
  if (expiry === "FRONT") return rows.filter((row) => row.expiration === expirations[0]);
  if (expiry === "0DTE") return rows.filter((row) => row.expiration === sessionDate);
  if (expiry === "0-7DTE") {
    const start = new Date(`${sessionDate}T00:00:00Z`).getTime();
    return rows.filter((row) => { const value = row.expiration ? new Date(`${row.expiration}T00:00:00Z`).getTime() : Number.NaN; return Number.isFinite(value) && value >= start && value <= start + 7 * 86_400_000; });
  }
  return rows;
}

function executionBucket(side: string) {
  const value = side.trim().toUpperCase().replace(/[ +\-]/g, "_");
  if (["AA", "A", "ASK", "ABOVE_ASK", "AT_ASK"].includes(value) || value.includes("ABOVE_ASK")) return "BOUGHT" as const;
  if (["BB", "B", "BID", "BELOW_BID", "AT_BID"].includes(value) || value.includes("BELOW_BID")) return "SOLD" as const;
  return "NEUTRAL" as const;
}

function sum<T>(rows: T[], selector: (row: T) => number | null | undefined) {
  return rows.reduce((total, row) => total + Math.max(0, Number(selector(row)) || 0), 0);
}

function responseForTool(tool: string, payload: Awaited<ReturnType<typeof getOptionsFlowPayload>>, greekMode: string, expiry: string) {
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
  const greek = payload.exposures[greekMode as keyof typeof payload.exposures] ?? payload.exposures.GAMMA;
  switch (tool) {
    case "contract-side-statistics": {
      const side = payload.positioning.tradeSidePremium;
      const totalPremium = payload.flow.reduce((total, row) => total + Math.max(0, row.premium), 0);
      const bucket = (contractType: "CALL" | "PUT" | null, execution: "BOUGHT" | "SOLD" | "NEUTRAL") => {
        const rows = payload.flow.filter((row) => (contractType === null || row.contractType === contractType) && executionBucket(row.side) === execution);
        return { contracts: sum(rows, (row) => row.size), tradeCount: rows.length };
      };
      const callBought = bucket("CALL", "BOUGHT"), callSold = bucket("CALL", "SOLD");
      const putBought = bucket("PUT", "BOUGHT"), putSold = bucket("PUT", "SOLD");
      const neutral = bucket(null, "NEUTRAL"), longOptions = bucket(null, "BOUGHT"), shortOptions = bucket(null, "SOLD");
      const row = (label: string, premium: number, detail: { contracts: number; tradeCount: number }, percent = totalPremium > 0 ? premium / totalPremium : null) => ({ side: label, premium, contracts: detail.contracts, tradeCount: detail.tradeCount, percent });
      return { ...common, rows: side ? [
        row("CALL BOUGHT", side.callBought, callBought), row("CALL SOLD", side.callSold, callSold),
        row("PUT BOUGHT", side.putBought, putBought), row("PUT SOLD", side.putSold, putSold),
        row("NEUTRAL", side.neutral, neutral), row("LONG OPTIONS", side.longOptionPremium, longOptions, side.longShare),
        row("SHORT OPTIONS", side.shortOptionPremium, shortOptions, side.longShare === null ? null : 1 - side.longShare),
        row("NET LONG", side.netLongPremium, { contracts: longOptions.contracts - shortOptions.contracts, tradeCount: longOptions.tradeCount + shortOptions.tradeCount }, null),
      ] : [] };
    }
    case "contract-statistics": {
      const stats = payload.marketMap.putCallVolume;
      const calls = payload.flow.filter((row) => row.contractType === "CALL");
      const puts = payload.flow.filter((row) => row.contractType === "PUT");
      const all = [...calls, ...puts];
      const average = (rows: typeof all, selector: (row: typeof all[number]) => number | null | undefined) => {
        const values = rows.map(selector).filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
        return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
      };
      const row = (metric: string, callValue: number | null, putValue: number | null, total: number | null, putCallRatio: number | null, format: "number" | "money" | "percent" = "number") => ({ metric, calls: callValue, puts: putValue, total, putCallRatio, format });
      return { ...common, rows: stats ? [
        row("Volume", stats.callVolume, stats.putVolume, stats.totalVolume, stats.putCallRatio),
        row("Premium", stats.callPremium, stats.putPremium, stats.callPremium + stats.putPremium, stats.callPremium ? stats.putPremium / stats.callPremium : null, "money"),
        row("Trades", calls.length, puts.length, all.length, calls.length ? puts.length / calls.length : null),
        row("Contracts", sum(calls, (item) => item.size), sum(puts, (item) => item.size), sum(all, (item) => item.size), null),
        row("Average print premium", average(calls, (item) => item.premium), average(puts, (item) => item.premium), average(all, (item) => item.premium), null, "money"),
        row("Unusual prints", calls.filter((item) => item.unusual).length, puts.filter((item) => item.unusual).length, all.filter((item) => item.unusual).length, null),
        row("Opening prints", calls.filter((item) => item.opening).length, puts.filter((item) => item.opening).length, all.filter((item) => item.opening).length, null),
        row("0DTE prints", calls.filter((item) => item.dte === 0).length, puts.filter((item) => item.dte === 0).length, all.filter((item) => item.dte === 0).length, null),
        row("Average implied volatility", average(calls, (item) => item.impliedVolatility), average(puts, (item) => item.impliedVolatility), average(all, (item) => item.impliedVolatility), null, "percent"),
      ] : [] };
    }
    case "exposure-expiration":
      return { ...common, rows: selectedExpiryRows(greek?.expiries ?? [], expiry, payload.session.sessionDate) };
    case "exposure-strike":
      return { ...common, rows: expiry === "ALL" ? greek?.strikes ?? [] : selectedExpiryRows(greek?.expiryStrikes ?? [], expiry, payload.session.sessionDate), netExposure: greek?.net ?? null, grossExposure: greek?.gross ?? null };
    case "gainers-losers":
      return { ...common, rows: payload.flowBoard.map((row) => ({
        ...row,
        sentiment: row.bullishShare >= 0.55 ? "BULLISH" : row.bullishShare <= 0.45 ? "BEARISH" : "NEUTRAL",
      })) };
    case "max-pain":
      return { ...common, rows: payload.levels.zeroDteMaxPain === null ? [] : [{ strike: payload.levels.zeroDteMaxPain, expiration: payload.session.sessionDate }] };
    case "net-drift":
      return { ...common, rows: payload.drift.map((row) => ({ ...row, netFlow: row.cumulativeCallPremium - row.cumulativePutPremium })) };
    case "net-flow":
      return { ...common, rows: payload.drift.map((row) => ({ ...row, netFlow: row.cumulativeCallPremium - row.cumulativePutPremium })), trades: payload.flow };
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
  const greekMode = (request.nextUrl.searchParams.get("greek") || "GAMMA").trim().toUpperCase();
  const expiry = (request.nextUrl.searchParams.get("expiry") || "ALL").trim().toUpperCase();
  const size = Math.max(10, Math.min(500, Number(request.nextUrl.searchParams.get("size")) || 100));
  if (!TOOL_IDS.has(tool)) return NextResponse.json({ error: "Unsupported GEX BOX tool." }, { status: 400 });
  if (!SYMBOL_PATTERN.test(symbol)) return NextResponse.json({ error: "Invalid ticker symbol." }, { status: 400 });
  if (sessionDate && !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return NextResponse.json({ error: "Invalid session date." }, { status: 400 });

  try {
    if (tool === "consolidated-flow" || tool === "unconsolidated-flow") {
      const flow = await getGexFlowPayload({
        symbol,
        mode: tool === "unconsolidated-flow" ? "RAW" : "CONSOLIDATED",
        sessionDate,
        size,
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
    return NextResponse.json(responseForTool(tool, payload, greekMode, expiry), {
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
