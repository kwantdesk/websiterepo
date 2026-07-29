import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export type RouteActor = {
  userId: string;
  label: string;
  mode: "supabase" | "local-dev";
  displayName?: string;
  username?: string;
  avatarUrl?: string;
};

export async function getRouteActor(request?: NextRequest): Promise<RouteActor | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      userId: "local-dev",
      label: "local-dev",
      mode: "local-dev",
    };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Route handlers in this helper only need read access for connector authorization.
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  let user = data.user;

  if ((!user || error) && request) {
    const authorization = request.headers.get("authorization")?.trim() ?? "";
    if (authorization.toLowerCase().startsWith("bearer ")) {
      const accessToken = authorization.slice(7).trim();
      if (accessToken) {
        const tokenResult = await supabase.auth.getUser(accessToken);
        if (!tokenResult.error && tokenResult.data.user) {
          user = tokenResult.data.user;
        }
      }
    }
  }

  if (!user) return null;

  const email = user.email?.trim();
  const username =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username.trim()
      : "";
  const displayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
      : "";
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url.trim()
      : typeof user.user_metadata?.picture === "string"
        ? user.user_metadata.picture.trim()
        : "";

  return {
    userId: user.id,
    label: email || username || displayName || user.id,
    mode: "supabase",
    displayName,
    username,
    avatarUrl,
  };
}
