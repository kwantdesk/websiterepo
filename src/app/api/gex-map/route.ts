import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getConfiguredQuantDataApiKey, getGexMapPanel, getQuantDataHttpError, getUsOptionsSessionDate } from "@/lib/quantData.server";
import { getDealerInventoryPanel } from "@/lib/gexMapV2.server";
import {
  compactLiveGexMapPanel,
  DEFAULT_GEX_MAP_EXPIRY_SCOPE,
  DEFAULT_GEX_MAP_REPRESENTATION,
  GEX_MAP_GREEKS,
  type GexMapExpiryScope,
  type GexMapRepresentation,
} from "@/lib/gexMap";
import { OPTIONS_FLOW_TICKERS, type GreekMode } from "@/lib/optionsFlow";
import {
  SITE_ACCESS_COOKIE,
  isSiteAccessConfigured,
  isValidSiteAccessToken,
} from "@/lib/siteAccess";

// A cold completed-session surface can require several serialised provider
// reads. Do not let the serverless default terminate one panel while the
// other two finish successfully.
export const maxDuration = 60;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) {
    return true;
  }

  // Middleware has already validated this signed site-access cookie before
  // allowing the read-only market-data fast path. Rechecking Supabase here
  // made three simultaneous GEX panels perform three extra remote auth calls;
  // one intermittent auth delay was enough to leave only QQQ failed.
  if (
    isSiteAccessConfigured()
    && await isValidSiteAccessToken(request.cookies.get(SITE_ACCESS_COOKIE)?.value)
  ) return true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
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
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "GEXMAP is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const symbol = (request.nextUrl.searchParams.get("symbol") || "SPX").trim().toUpperCase();
  const greekMode = (request.nextUrl.searchParams.get("greekMode") || "GAMMA").trim().toUpperCase() as GreekMode;
  const sessionDate = request.nextUrl.searchParams.get("sessionDate")?.trim() || undefined;
  const compact = request.nextUrl.searchParams.get("compact") === "1" && !sessionDate;
  const requestedScope = (request.nextUrl.searchParams.get("scope") || DEFAULT_GEX_MAP_EXPIRY_SCOPE).trim().toUpperCase();
  const scope = requestedScope as GexMapExpiryScope;
  const requestedRepresentation = (
    request.nextUrl.searchParams.get("representation") || DEFAULT_GEX_MAP_REPRESENTATION
  ).trim().toUpperCase();
  const representation = requestedRepresentation as GexMapRepresentation;
  if (!OPTIONS_FLOW_TICKERS.includes(symbol as (typeof OPTIONS_FLOW_TICKERS)[number])) {
    return NextResponse.json({ error: "Unsupported GEXMAP instrument." }, { status: 400 });
  }
  if (!GEX_MAP_GREEKS.some((item) => item.mode === greekMode)) {
    return NextResponse.json({ error: "Unsupported exposure metric." }, { status: 400 });
  }
  if (sessionDate && !DATE_PATTERN.test(sessionDate)) {
    return NextResponse.json({ error: "Invalid replay date." }, { status: 400 });
  }
  if (scope !== "ALL_EXPIRIES" && scope !== "FRONT_EXPIRY") {
    return NextResponse.json({ error: "Unsupported expiry scope." }, { status: 400 });
  }
  if (representation !== "PER_ONE_DOLLAR_MOVE" && representation !== "PER_ONE_PERCENT_MOVE") {
    return NextResponse.json({ error: "Unsupported exposure representation." }, { status: 400 });
  }

  /*
   * model=DEALER_INVENTORY selects v2. It is opt-in per request and defaults to
   * v1, so every existing caller - including the GEX Map panels embedded in GEX
   * VUE - keeps the structural model untouched.
   *
   * v2 is GAMMA only: a dealer book is a gamma position, and the same carried
   * contracts revalued through a delta or vanna surface would be a different
   * measurement wearing this model's name.
   */
  const model = (request.nextUrl.searchParams.get("model") || "STRUCTURAL_OI").trim().toUpperCase();
  if (model !== "STRUCTURAL_OI" && model !== "DEALER_INVENTORY") {
    return NextResponse.json({ error: "Unsupported exposure model." }, { status: 400 });
  }
  if (model === "DEALER_INVENTORY" && greekMode !== "GAMMA") {
    return NextResponse.json({ error: "The dealer inventory model is gamma only." }, { status: 400 });
  }

  try {
    const payload = model === "DEALER_INVENTORY"
      ? await getDealerInventoryPanel(
        symbol,
        sessionDate || getUsOptionsSessionDate(),
        scope,
        representation,
        Boolean(sessionDate) && sessionDate !== getUsOptionsSessionDate(),
      )
      : await getGexMapPanel(symbol, greekMode, sessionDate, scope, representation);
    return NextResponse.json(compact ? compactLiveGexMapPanel(payload) : payload, {
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
