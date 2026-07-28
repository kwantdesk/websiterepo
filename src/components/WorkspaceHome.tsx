"use client";

import { useRouter } from "next/navigation";
import AppSidebar from "@/components/AppSidebar";
import { createClient } from "@/lib/supabase";

export default function WorkspaceHome({ username = "" }: { username?: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login?returnTo=/");
    router.refresh();
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <AppSidebar
        activeItem="home"
        accountLabel="Account"
        accountTitle={username ? `Sign out @${username}` : "Sign out"}
        onAccountClick={signOut}
        orientation="horizontal"
      />
      <main className="min-h-0 flex-1 bg-background" aria-label="Home workspace" />
    </div>
  );
}
