import { redirect } from "next/navigation";
import WorkspaceHome from "@/components/WorkspaceHome";
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

  const username =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : user.email ?? "";

  return <WorkspaceHome username={username} />;
}
