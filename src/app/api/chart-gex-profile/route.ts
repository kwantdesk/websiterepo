import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  getClassicGexProfilePayload,
  getConfiguredQuantDataApiKey,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import type {
  ClassicGexExpiry,
  ClassicGexMappingSource,
  ClassicGexSource,
} from "@/lib/classicGexProfile";

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

function finiteParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "KwantData is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const sourceValue = (request.nextUrl.searchParams.get("source") || "QQQ").toUpperCase();
  const expiryValue = (request.nextUrl.searchParams.get("expiry") || "ZERO_DTE").toUpperCase();
  const profileSourceValue = (request.nextUrl.searchParams.get("profileSource") || "VOLUME").toUpperCase();
  const mappingValue = (request.nextUrl.searchParams.get("mapping") || "AUTO").toUpperCase();
  if (sourceValue !== "NDX" && sourceValue !== "QQQ") {
    return NextResponse.json({ error: "Classic GEX supports NQ / NDX and NQ / QQQ mapping." }, { status: 400 });
  }
  if (!new Set(["ZERO_DTE", "NEXT_EXPIRY", "ALL"]).has(expiryValue)) {
    return NextResponse.json({ error: "Invalid expiry selection." }, { status: 400 });
  }
  if (profileSourceValue !== "VOLUME" && profileSourceValue !== "OPEN_INTEREST") {
    return NextResponse.json({ error: "Invalid Classic GEX source." }, { status: 400 });
  }
  if (mappingValue !== "AUTO" && mappingValue !== "MANUAL") {
    return NextResponse.json({ error: "Invalid mapping mode." }, { status: 400 });
  }

  try {
    const payload = await getClassicGexProfilePayload({
      sourceSymbol: sourceValue as ClassicGexMappingSource,
      expiry: expiryValue as ClassicGexExpiry,
      profileSource: profileSourceValue as ClassicGexSource,
      mappingMode: mappingValue,
      manualMultiplier: Math.max(0.000001, finiteParam(request.nextUrl.searchParams.get("multiplier"), 1)),
      premiumOffset: finiteParam(request.nextUrl.searchParams.get("offset"), 0),
      futuresPrice: finiteParam(request.nextUrl.searchParams.get("futuresPrice"), 0) || null,
    });
    return NextResponse.json(payload, {
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
