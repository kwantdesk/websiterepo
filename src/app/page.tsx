import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import WorkspaceHome from "@/components/WorkspaceHome";
import HoldingPage from "@/components/landing/HoldingPage";
import { isAllowedEmail } from "@/lib/access";
import {
  SITE_ACCESS_COOKIE,
  isSiteAccessConfigured,
  isValidSiteAccessToken,
} from "@/lib/siteAccess";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const siteAccessConfigured = isSiteAccessConfigured();
  const siteAccessGranted = siteAccessConfigured
    ? await isValidSiteAccessToken(cookieStore.get(SITE_ACCESS_COOKIE)?.value)
    : false;

  let user = null;
  let authConfigured = true;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    authConfigured = false;
  }

  if (siteAccessConfigured && !siteAccessGranted) return <HoldingPage />;
  if (!siteAccessConfigured && !user) return <HoldingPage />;
  if (!authConfigured) redirect("/login?error=configuration");
  if (!user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/login?error=restricted");

  let username =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : user.email ?? "";

  let displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || username;
  let avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
  let identityConfirmed = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("social_objects").select("payload")
      .eq("user_id", user.id).eq("id", "profile").eq("object_type", "profile").maybeSingle();
    identityConfirmed = Boolean(data?.payload);
    if (typeof data?.payload?.displayName === "string") displayName = data.payload.displayName;
    if (typeof data?.payload?.handle === "string") username = data.payload.handle;
    if (typeof data?.payload?.avatarUrl === "string") avatarUrl = data.payload.avatarUrl;
  } catch { /* Authentication metadata remains the offline identity fallback. */ }
  return <WorkspaceHome username={username} userId={user.id} displayName={String(displayName)} avatarUrl={String(avatarUrl)} identityConfirmed={identityConfirmed} />;
}
