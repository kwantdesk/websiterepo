import { createBrowserClient } from "@supabase/ssr";
import { clearObsoleteSupabaseCookies } from "@/lib/supabaseCookieHygiene";

function getPublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getPublicKey();

  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }

  clearObsoleteSupabaseCookies(url);
  return createBrowserClient(url, key);
}
