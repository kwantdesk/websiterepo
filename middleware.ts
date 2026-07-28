import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function allowed(email?: string | null) {
  const values = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && values.includes(email.toLowerCase()));
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return NextResponse.redirect(new URL("/login?error=configuration", request.url));

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookies) { cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
    },
  });
  const { data } = await supabase.auth.getUser();

  if (!data.user || !allowed(data.user.email)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/((?!login|auth|_next/static|_next/image|favicon.ico).*)"],
};
