import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { buildGameplanPayload, type GameplanSession } from "@/lib/gameplan";
import {
  getConfiguredQuantDataApiKey,
  getOptionsFlowPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

export const maxDuration = 120;

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
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "The Gameplan options feed is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rootInput = (request.nextUrl.searchParams.get("root") || "NQ").trim().toUpperCase();
  const sessionInput = (request.nextUrl.searchParams.get("session") || "newyork").trim().toLowerCase();
  if (rootInput !== "NQ" && rootInput !== "ES") {
    return NextResponse.json({ error: "Gameplan currently supports NQ and ES." }, { status: 400 });
  }
  if (sessionInput !== "globex" && sessionInput !== "newyork") {
    return NextResponse.json({ error: "Invalid Gameplan edition." }, { status: 400 });
  }

  try {
    const source = rootInput === "NQ" ? "NDX" : "SPX";
    const options = await getOptionsFlowPayload(source, "FUTURES");
    const payload = buildGameplanPayload(options, rootInput, sessionInput as GameplanSession);
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
