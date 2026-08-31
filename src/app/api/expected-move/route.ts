import { createServerClient } from "@supabase/ssr";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  nextNewYorkExpectedMoveOpen,
  isExpectedMoveCalibrationUsable,
  staleExpectedMovePayload,
  type ExpectedMoveApiPayload,
  type ExpectedMoveSourceSymbol,
} from "@/lib/expectedMove";
import {
  getConfiguredQuantDataApiKey,
  getOptionsFlowPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import { isOptionsFuturesRatioSane } from "@/lib/optionsFlow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type NormalizedExpectedMoveReceipt = {
  schemaVersion: 1;
  id: "expected-move";
  displayInstrument: "NQ" | "MNQ";
  sourceSymbol: ExpectedMoveSourceSymbol;
  sessionDate: string;
  generatedAtMs: number;
  nextRefreshAtMs: number;
  receivedAtMs: number;
  marketOpen: boolean;
  stale: boolean;
  dataAgeMs: number;
  scale: number;
  sourcePrice: number;
  futuresPrice: number;
  calibratedAtMs: number;
  range: ExpectedMoveApiPayload["range"];
};
const globalExpectedMove = globalThis as typeof globalThis & {
  __kwantdeskExpectedMove?: Map<ExpectedMoveSourceSymbol, ExpectedMoveApiPayload>;
  __kwantdeskNormalizedExpectedMove?: Map<string, NormalizedExpectedMoveReceipt>;
};
const lastGood = globalExpectedMove.__kwantdeskExpectedMove
  ?? (globalExpectedMove.__kwantdeskExpectedMove = new Map());
const normalizedLastGood = globalExpectedMove.__kwantdeskNormalizedExpectedMove
  ?? (globalExpectedMove.__kwantdeskNormalizedExpectedMove = new Map());

async function isAuthenticated(request: NextRequest) {
  const expectedInternalToken = String(process.env.KWANTDESK_ANALYTICS_SERVICE_TOKEN || "").trim();
  const suppliedInternalToken = String(request.headers.get("x-kwantdesk-internal-analytics-token") || "").trim();
  if (expectedInternalToken.length >= 32 && suppliedInternalToken.length === expectedInternalToken.length) {
    const supplied = Buffer.from(suppliedInternalToken, "utf8");
    const expected = Buffer.from(expectedInternalToken, "utf8");
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return true;
  }
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) return true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined,
    },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json(
      { error: "Expected Move: data source needs re-authentication" },
      { status: 401 },
    );
  }
  const requested = (request.nextUrl.searchParams.get("source") || "QQQ").trim().toUpperCase();
  if (requested !== "QQQ" && requested !== "NDX") {
    return NextResponse.json({ error: "Expected Move supports QQQ or NDX calibration." }, { status: 400 });
  }
  const source = requested as ExpectedMoveSourceSymbol;
  const requestedDisplay = (request.nextUrl.searchParams.get("display") || "").trim().toUpperCase();
  const normalizedDisplay = requestedDisplay === "NQ" || requestedDisplay === "MNQ"
    ? requestedDisplay as "NQ" | "MNQ"
    : null;
  if (requestedDisplay && !normalizedDisplay) {
    return NextResponse.json({ error: "Expected Move is calibrated only for NQ or MNQ." }, { status: 400 });
  }
  const now = Date.now();
  try {
    // GAMEPLAN is the existing cached structural payload path. Its QuantData
    // endpoint requests share the 4s/60s quantDataPost caches with Gamma and
    // Gameplan; this route never creates a second provider pull pipeline.
    const options = await getOptionsFlowPayload(
      source,
      normalizedDisplay ? "FUTURES" : "CASH",
      undefined,
      "GAMEPLAN",
    );
    const range = options.marketMap.expectedMove;
    if (!range) throw new Error(`No expected-move inputs are available for ${source}.`);
    const generatedAt = options.asOf;
    const nextRefreshAt = options.marketData.stale
      ? now + 60_000
      : options.session.marketOpen && range.anchorLabel !== "SESSION_OPEN"
        ? now + 30_000
        : nextNewYorkExpectedMoveOpen(now);
    const payload: ExpectedMoveApiPayload = {
      generatedAt,
      nextRefreshAt: new Date(nextRefreshAt).toISOString(),
      sessionDate: options.session.sessionDate,
      sourceSymbol: source,
      marketOpen: options.session.marketOpen,
      stale: options.marketData.stale,
      dataAge: Math.max(0, now - Date.parse(generatedAt)),
      range,
    };
    if (normalizedDisplay) {
      const scale = Number(options.marketData.levelPriceScale);
      const sourcePrice = Number(options.stockPrice);
      const futuresPrice = Number(options.marketData.lastPrice);
      const calibratedAtMs = Date.parse(options.marketData.asOf);
      const ratioIsSane = isOptionsFuturesRatioSane(source, scale);
      const calibrationUsable = isExpectedMoveCalibrationUsable({
        calibration: {
          sourceSymbol: source,
          targetInstrument: normalizedDisplay,
          sessionDate: payload.sessionDate,
          scale,
          calibratedAtMs,
        },
        sourceSymbol: source,
        targetInstrument: normalizedDisplay,
        sessionDate: payload.sessionDate,
        marketOpen: payload.marketOpen,
        now,
        ratioIsSane,
      });
      if (!calibrationUsable || !(sourcePrice > 0) ||
          !(futuresPrice > 0) || !Number.isFinite(calibratedAtMs)) {
        throw new Error(`Expected Move cannot verify the ${source} to ${normalizedDisplay} calibration.`);
      }
      // The expected range is intentionally session-stable, but the cash-to-
      // futures calibration is a separate live contract. Refresh it while the
      // market is open so the desktop never carries a ratio beyond the same
      // 20-minute validity gate used by the browser overlay.
      const normalizedNextRefreshAtMs = payload.marketOpen
        ? Math.min(Date.parse(payload.nextRefreshAt), now + 60_000)
        : Date.parse(payload.nextRefreshAt);
      const receipt: NormalizedExpectedMoveReceipt = {
        schemaVersion: 1,
        id: "expected-move",
        displayInstrument: normalizedDisplay,
        sourceSymbol: source,
        sessionDate: payload.sessionDate,
        generatedAtMs: Date.parse(payload.generatedAt),
        nextRefreshAtMs: normalizedNextRefreshAtMs,
        receivedAtMs: now,
        marketOpen: payload.marketOpen,
        stale: payload.stale,
        dataAgeMs: payload.dataAge,
        scale,
        sourcePrice,
        futuresPrice,
        calibratedAtMs,
        range: payload.range,
      };
      if (!receipt.stale) normalizedLastGood.set(`${normalizedDisplay}:${source}`, receipt);
      return NextResponse.json(receipt, {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    if (!payload.stale) lastGood.set(source, payload);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (normalizedDisplay) {
      const retained = normalizedLastGood.get(`${normalizedDisplay}:${source}`);
      if (retained) {
        return NextResponse.json({
          ...retained,
          receivedAtMs: now,
          stale: true,
          dataAgeMs: Math.max(0, now - retained.generatedAtMs),
        }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
      }
      const problem = getQuantDataHttpError(error);
      const authenticationFailure = problem.status === 401 || problem.status === 403;
      return NextResponse.json(
        { error: authenticationFailure ? "Expected Move: data source needs re-authentication" : problem.message },
        { status: authenticationFailure ? 401 : problem.status },
      );
    }
    const retained = lastGood.get(source);
    if (retained) {
      return NextResponse.json(staleExpectedMovePayload(retained, now), {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    const problem = getQuantDataHttpError(error);
    const authenticationFailure = problem.status === 401 || problem.status === 403;
    return NextResponse.json(
      { error: authenticationFailure ? "Expected Move: data source needs re-authentication" : problem.message },
      { status: authenticationFailure ? 401 : problem.status },
    );
  }
}
