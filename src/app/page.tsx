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

  const username =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : user.email ?? "";

  return <WorkspaceHome username={username} />;
}
