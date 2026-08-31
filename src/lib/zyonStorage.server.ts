import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { RouteActor } from "@/lib/serverAuth";
import { createClient as createRouteClient } from "@/lib/supabase/server";

/**
 * Returns an account-scoped storage client for a ZYON route.
 *
 * Browser requests retain their cookie/RLS client. Desktop requests have
 * already been authenticated by the VPS gateway and therefore use the
 * service-role only inside this server process, while every query still pins
 * the verified desktop subject explicitly.
 */
export async function createZyonStorageClient(actor: RouteActor) {
  if (actor.mode !== "desktop-gateway") return createRouteClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) throw new Error("The desktop ZYON account store is not configured.");
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * The lock RPC is intentionally service-role-only so its version check and
 * immutable record insert execute as one database transaction for both web
 * and desktop callers.
 */
export function createZyonTransactionalClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) throw new Error("The ZYON transactional account store is not configured.");
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
