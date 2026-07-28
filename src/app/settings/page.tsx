import { redirect } from "next/navigation";
import KwantifySettingsWorkspace from "@/components/KwantifySettingsWorkspace";
import { isAllowedEmail } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user || !isAllowedEmail(data.user.email)) redirect("/login");

  return <KwantifySettingsWorkspace />;
}
