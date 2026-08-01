import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import {
  buildGammaBotPayload,
  gammaBotSource,
  type GammaBotInstrument,
} from "@/lib/gammaBot";
import {
  getConfiguredQuantDataApiKey,
  getOptionsFlowPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

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
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "Gamma Bot is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const requested = (request.nextUrl.searchParams.get("instrument") || "NQ").trim().toUpperCase();
  if (requested !== "NQ" && requested !== "ES") {
    return NextResponse.json({ error: "Gamma Bot currently supports NQ and ES." }, { status: 400 });
  }
  const instrument = requested as GammaBotInstrument;

  try {
    const data = await getOptionsFlowPayload(gammaBotSource(instrument), "FUTURES");
    return NextResponse.json(buildGammaBotPayload(instrument, data), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message },
      { status: problem.status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
