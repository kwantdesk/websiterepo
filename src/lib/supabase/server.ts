import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getPublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export async function createClient({ freshOAuth = false }: { freshOAuth?: boolean } = {}) {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getPublicKey();

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        // Starting a new login needs only a new PKCE verifier. Recovering an
        // expired JWT here makes the sign-in redirect wait for a token refresh
        // before the person can even choose their Google account.
        return freshOAuth ? [] : cookieStore.getAll();
      },
      setAll(cookiesToSet) {
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
