import { createBrowserClient } from "@supabase/ssr";

// Local design-preview bypass (clone only): when NEXT_PUBLIC_KWANTIFY_DEV_AUTH_BYPASS=1
// and running on localhost, auth.getUser()/getSession() report a stub user so the
// authenticated UI renders without a real Supabase session. Everything else passes
// through to the real client. Pair with KWANTIFY_DEV_AUTH_BYPASS=1 for middleware.
const DEV_BYPASS =
  process.env.NEXT_PUBLIC_KWANTIFY_DEV_AUTH_BYPASS === "1";

function isLocalhost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

const DEV_USER = {
  id: "00000000-0000-4000-8000-00000000dev1",
  aud: "authenticated",
  role: "authenticated",
  email: "design@localhost",
  app_metadata: { provider: "email" },
  user_metadata: { username: "Designer" },
  created_at: new Date(0).toISOString(),
};

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a dummy client that won't crash during build
    return null as any;
  }

  const client = createBrowserClient(url, key);

  if (DEV_BYPASS && isLocalhost()) {
    const realAuth = client.auth;
    const stubbedAuth = new Proxy(realAuth, {
      get(target, prop, receiver) {
        if (prop === "getUser") {
          return async () => ({ data: { user: DEV_USER }, error: null });
        }
        if (prop === "getSession") {
          return async () => ({
            data: {
              session: {
                access_token: "dev-bypass",
                token_type: "bearer",
                expires_in: 3600,
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                refresh_token: "dev-bypass",
                user: DEV_USER,
              },
            },
            error: null,
          });
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    return new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === "auth") return stubbedAuth;
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  return client;
}
