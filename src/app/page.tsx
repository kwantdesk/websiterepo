import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { isAllowedEmail } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let user;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    redirect("/login?error=configuration");
  }

  if (!user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/login?error=restricted");

  return <DashboardShell email={user.email ?? "Authorized user"} />;
}
