import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthReturn, OAUTH_RETURN_COOKIE } from "@/lib/authRedirect";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeAuthReturn(url.searchParams.get("returnTo"));
  const callback = new URL("/auth/callback", url.origin);
  try {
    // Save PKCE in response cookies. Normal same-tab navigation works before
    // hydration, without popups or a browser auth-client initialization lock.
    const supabase = await createClient({ freshOAuth: true });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
    });
    if (error || !data.url) throw Error("Google sign-in could not be started");
    const response = NextResponse.redirect(data.url, {
      status: 303, headers: { "Cache-Control": "private, no-store" },
    });
    // Keep the registered provider callback URI exact and stable. A varying
    // query can fail the provider allowlist and send the code to its Site URL.
    response.cookies.set(OAUTH_RETURN_COOKIE, returnTo, {
      httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: 600,
    });
    return response;
  } catch {
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", "auth");
    login.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(login, {
      status: 303, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
