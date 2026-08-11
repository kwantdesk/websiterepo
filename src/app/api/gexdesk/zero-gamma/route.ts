import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  getGexDeskZeroGammaPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import { createGexDeskZeroGammaFixture } from "@/lib/gexDesk";
import { vendorMarketDataConfigured } from "@/lib/vendorMarketData.server";

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
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)
    && !vendorMarketDataConfigured("databento")
  ) {
    return NextResponse.json(createGexDeskZeroGammaFixture(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  try {
    return NextResponse.json(await getGexDeskZeroGammaPayload(), {
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
