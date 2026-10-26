import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { safeAuthReturn, OAUTH_RETURN_COOKIE } from "@/lib/authRedirect";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const returnTo = safeAuthReturn(requestUrl.searchParams.get("returnTo") ?? request.cookies.get(OAUTH_RETURN_COOKIE)?.value);
  const success = NextResponse.redirect(new URL(returnTo, origin), {
    status: 303, headers: { "Cache-Control": "private, no-store" },
  });
  const fail = (kind = "auth") => {
    const login = new URL("/login", origin);
    login.searchParams.set("error", kind);
    login.searchParams.set("returnTo", returnTo);
    const response = NextResponse.redirect(login, { status: 303, headers: { "Cache-Control": "private, no-store" } });
    for (const cookie of success.cookies.getAll()) response.cookies.set(cookie);
    response.cookies.delete(OAUTH_RETURN_COOKIE);
    return response;
  };

  if (!code) return fail();

  try {
    const supabase = await createClient({ cookieResponse: success });
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.warn("[oauth-callback] session exchange failed", { code: error.code, status: error.status });
      return fail();
    }

    const { data } = await supabase.auth.getUser();

    if (!isAllowedEmail(data.user?.email)) {
      await supabase.auth.signOut();
      return fail("restricted");
    }

    success.cookies.delete(OAUTH_RETURN_COOKIE);
    return success;
  } catch {
    console.warn("[oauth-callback] session completion failed");
    return fail();
  }
}
