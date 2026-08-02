"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import { createClient } from "@/lib/supabase";

const ParticleTerrain = dynamic(() => import("@/components/landing/ParticleTerrain"), {
  ssr: false,
});

export default function WorkspaceHome({ username = "" }: { username?: string }) {
  const router = useRouter();
  const [heroReady, setHeroReady] = useState(false);
  const revealHero = useCallback(() => setHeroReady(true), []);

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
      <main
        className="relative min-h-0 flex-1 overflow-hidden bg-black"
        aria-label="Home workspace"
      >
        <div
          className={`absolute inset-0 ${heroReady ? "opacity-100" : "opacity-0"}`}
          aria-hidden={!heroReady}
        >
          <ParticleTerrain onReady={revealHero} />
          <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_42%,transparent_0%,rgba(0,0,0,.08)_50%,rgba(0,0,0,.72)_100%)]" />
          <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center px-6">
            <div className="relative w-[78vw] sm:w-[54vw] lg:w-[33vw]">
              <Image
                src="/images/kwantdesk-wordmark.webp"
                alt="Kwant Desk"
                width={1911}
                height={305}
                priority
                unoptimized
                sizes="(max-width: 639px) 78vw, (max-width: 1023px) 54vw, 33vw"
                className="h-auto w-full drop-shadow-[0_0_28px_rgba(255,255,255,.06)]"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
