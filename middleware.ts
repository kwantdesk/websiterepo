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

function supabaseAuthCookieName(supabaseUrl: string) {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0]?.trim();
    return projectRef ? `sb-${projectRef}-auth-token` : "";
  } catch {
    return "";
  }
}

function belongsToAuthCookie(name: string, baseName: string) {
  return name === baseName || name.startsWith(`${baseName}.`);
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

  const activeAuthCookie = supabaseAuthCookieName(url);
  const supabase = createServerClient(url, key, {
    cookies: {
      // Never hand old Supabase projects or unrelated cookie chunks to the
      // auth parser. Besides being irrelevant, accumulated JWT chunks can
      // make Routing Middleware exceed Vercel's request-header limit.
      getAll() {
        return request.cookies
          .getAll()
          .filter((cookie) => belongsToAuthCookie(cookie.name, activeAuthCookie));
      },
      // Middleware only validates the request. Supabase can decide that a
      // chunked JWT needs refreshing and return dozens of cookie writes;
      // forwarding those through Vercel's x-middleware-set-cookie header can
      // exceed the 32 KB routing limit and crash the whole request. The
      // browser client and /auth/callback own durable session writes instead.
      setAll() {},
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
  matcher: ["/((?!auth|_next/static|_next/image|favicon.ico|cookie-recovery.html|images/|brand/).*)"],
};
