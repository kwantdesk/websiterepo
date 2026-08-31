import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { RouteActor } from "@/lib/serverAuth";
import { createClient as createRouteClient } from "@/lib/supabase/server";

export async function createSocialsStorageClient(actor: RouteActor) {
  if (actor.mode !== "desktop-gateway") return createRouteClient();
  return createSocialsServiceClient();
}

export function createSocialsServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) throw new Error("The desktop SOCIALS account store is not configured.");
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
