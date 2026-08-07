import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  isSiteAccessConfigured,
  isValidSiteAccessToken,
} from "@/lib/siteAccess";

function allowed(email?: string | null) {
  return Boolean(email?.trim());
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const apiRequest = pathname.startsWith("/api/");
  const localPreviewBypass =
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname);

  if (localPreviewBypass) return response;

  if (
    pathname === "/" ||
    pathname === "/api/site-access" ||
    pathname === "/api/waitlist" ||
    pathname === "/api/databento/health" ||
    pathname === "/api/market-data/diagnostics" ||
    pathname === "/api/macro-memory/ingest"
  ) {
    return response;
  }

  const siteAccessConfigured = isSiteAccessConfigured();
  const siteAccessGranted = siteAccessConfigured
    ? await isValidSiteAccessToken(request.cookies.get(SITE_ACCESS_COOKIE)?.value)
    : true;

  if (siteAccessConfigured && !siteAccessGranted) {
    if (apiRequest) {
      return NextResponse.json(
        { error: "Site access is required.", code: "SITE_ACCESS_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    const holdingPage = new URL("/", request.url);
    holdingPage.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(holdingPage);
  }

  if (pathname === "/login") return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (apiRequest) {
      return NextResponse.json(
        { error: "Authentication is not configured.", code: "AUTH_CONFIGURATION_REQUIRED" },
        { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookies) { cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
    },
  });
  const { data } = await supabase.auth.getUser();

  if (!data.user || !allowed(data.user.email)) {
    if (apiRequest) {
      return NextResponse.json(
        { error: "Your session has expired. Sign in again.", code: "AUTHENTICATION_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/((?!auth|_next/static|_next/image|favicon.ico|images/|brand/).*)"],
};
