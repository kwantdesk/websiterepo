import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// Native gamma cold-builds a session's options chain (~25s of Databento pulls); the
// default function timeout can kill it mid-build. Cached calls return in milliseconds.
export const maxDuration = 120;
import {
  getChartGammaLevels,
  getConfiguredQuantDataApiKey,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
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
  const root = (request.nextUrl.searchParams.get("root") || "").trim().toUpperCase();
  const source = (request.nextUrl.searchParams.get("source") || "").trim().toUpperCase();
  const nativeFuturesRequest = (root === "NQ" || root === "ES") && source === root;
  if (!nativeFuturesRequest && !getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "QuantData is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {
    const payload = await getChartGammaLevels(
      root,
      source,
    );
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
