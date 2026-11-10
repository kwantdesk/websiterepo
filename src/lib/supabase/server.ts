import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

function getPublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export async function createClient({ freshOAuth = false, cookieResponse, requestSignal }: { freshOAuth?: boolean; cookieResponse?: NextResponse; requestSignal?: AbortSignal } = {}) {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getPublicKey();

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createServerClient(url, key, {
    ...(requestSignal ? { global: { fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const caller = init?.signal ?? (input instanceof Request ? input.signal : null);
      const signal = AbortSignal.any([requestSignal, ...(caller ? [caller] : [])]);
      const timedOut = () => Response.json({ message: "Journal request timed out.", code: "REQUEST_TIMEOUT" }, { status: 408 });
      if (signal.aborted) return timedOut();
      try { return await fetch(input, { ...init, signal }); }
      catch (error) {
        if (requestSignal.aborted) return timedOut();
        throw error;
      }
    } } } : {}),
    cookies: {
      getAll() {
        // Starting a new login needs only a new PKCE verifier. Recovering an
        // expired JWT here makes the sign-in redirect wait for a token refresh
        // before the person can even choose their Google account.
        return freshOAuth ? [] : cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (cookieResponse) {
          cookiesToSet.forEach(({ name, value, options }) => cookieResponse.cookies.set(name, value, options));
          return;
        }
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always set cookies. The callback route does.
        }
      },
    },
  });
}
