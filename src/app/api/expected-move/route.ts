import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  nextNewYorkExpectedMoveOpen,
  staleExpectedMovePayload,
  type ExpectedMoveApiPayload,
  type ExpectedMoveSourceSymbol,
} from "@/lib/expectedMove";
import {
  getConfiguredQuantDataApiKey,
  getOptionsFlowPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const globalExpectedMove = globalThis as typeof globalThis & {
  __kwantdeskExpectedMove?: Map<ExpectedMoveSourceSymbol, ExpectedMoveApiPayload>;
};
const lastGood = globalExpectedMove.__kwantdeskExpectedMove
  ?? (globalExpectedMove.__kwantdeskExpectedMove = new Map());

async function isAuthenticated(request: NextRequest) {
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
  const now = Date.now();
  try {
    // GAMEPLAN is the existing cached structural payload path. Its QuantData
    // endpoint requests share the 4s/60s quantDataPost caches with Gamma and
    // Gameplan; this route never creates a second provider pull pipeline.
    const options = await getOptionsFlowPayload(source, "CASH", undefined, "GAMEPLAN");
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
    if (!payload.stale) lastGood.set(source, payload);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
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
