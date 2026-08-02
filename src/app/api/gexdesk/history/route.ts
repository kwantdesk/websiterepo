import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  getConfiguredQuantDataApiKey,
  getGexDeskHistory,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import { createGexDeskHistoryFixture } from "@/lib/gexDesk";

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

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source") ?? "COMBINED";
  const instrument = request.nextUrl.searchParams.get("instrument") ?? "NQ";
  if (!getConfiguredQuantDataApiKey()) {
    if (
      process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
      && ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)
    ) {
      return NextResponse.json(createGexDeskHistoryFixture(source, instrument), {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    return NextResponse.json({ error: "Gexdesk history is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    return NextResponse.json(await getGexDeskHistory(source, instrument), {
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
