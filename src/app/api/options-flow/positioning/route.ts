import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  getConfiguredQuantDataApiKey,
  getOptionsPositioningPulse,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;
const EXPIRATION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MODES = new Set(["GAMMA", "DELTA", "VANNA", "CHARM"]);

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) {
    return true;
  }

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

function finiteQueryNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "Options positioning is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const symbol = (request.nextUrl.searchParams.get("symbol") || "").trim().toUpperCase();
  const mode = (request.nextUrl.searchParams.get("mode") || "").trim().toUpperCase();
  const expiration = (request.nextUrl.searchParams.get("expiration") || "").trim();
  const minStrike = finiteQueryNumber(request.nextUrl.searchParams.get("minStrike"));
  const maxStrike = finiteQueryNumber(request.nextUrl.searchParams.get("maxStrike"));
  if (!SYMBOL_PATTERN.test(symbol)) {
    return NextResponse.json({ error: "Invalid ticker symbol." }, { status: 400 });
  }
  if (!MODES.has(mode)) {
    return NextResponse.json({ error: "Invalid positioning Greek." }, { status: 400 });
  }
  if (!EXPIRATION_PATTERN.test(expiration)) {
    return NextResponse.json({ error: "Invalid front expiration." }, { status: 400 });
  }
  if (
    (minStrike === null) !== (maxStrike === null)
    || (minStrike !== null && maxStrike !== null && (minStrike <= 0 || maxStrike <= minStrike))
  ) {
    return NextResponse.json({ error: "Invalid strike range." }, { status: 400 });
  }

  try {
    const payload = await getOptionsPositioningPulse(
      symbol,
      mode,
      expiration,
      minStrike !== null && maxStrike !== null ? { min: minStrike, max: maxStrike } : null,
    );
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message, rateLimitRemaining: problem.remaining },
      {
        status: problem.status,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
