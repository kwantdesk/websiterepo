import { redirect } from "next/navigation";
import KwantifySettingsWorkspace from "@/components/KwantifySettingsWorkspace";
import { isAllowedEmail } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (process.env.KWANTIFY_DEV_AUTH_BYPASS === "1") {
    return <KwantifySettingsWorkspace />;
  }
  const supabase = await createClient();
  // Middleware already checks this request with the Auth server. Verify the
  // page's JWT with Supabase's cached signing keys instead of serially making
  // a second user lookup before the settings UI can render. getClaims checks
  // signature/expiry and falls back to getUser for symmetric signing keys.
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims.sub || !isAllowedEmail(data.claims.email)) redirect("/login");

  return <KwantifySettingsWorkspace />;
}
