"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import AppSidebar from "@/components/AppSidebar";
import { createClient } from "@/lib/supabase";

export default function WorkspaceHome({ username = "" }: { username?: string }) {
  const router = useRouter();
  const robotRef = useRef<HTMLDivElement>(null);

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login?returnTo=/");
    router.refresh();
  }

  function moveRobot(event: ReactPointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    robotRef.current?.style.setProperty("--robot-rotate-y", `${x * 9}deg`);
    robotRef.current?.style.setProperty("--robot-rotate-x", `${y * -7}deg`);
    robotRef.current?.style.setProperty("--robot-shift-x", `${x * 10}px`);
  }

  function resetRobot() {
    robotRef.current?.style.setProperty("--robot-rotate-y", "0deg");
    robotRef.current?.style.setProperty("--robot-rotate-x", "0deg");
    robotRef.current?.style.setProperty("--robot-shift-x", "0px");
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
        className="kwantbot-home-stage relative min-h-0 flex-1 overflow-hidden bg-background"
        aria-label="Home workspace"
        onPointerMove={moveRobot}
        onPointerLeave={resetRobot}
      >
        <div className="kwantbot-home-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <span className="kwantbot-home-particle kwantbot-home-particle-one" aria-hidden="true" />
        <span className="kwantbot-home-particle kwantbot-home-particle-two" aria-hidden="true" />
        <span className="kwantbot-home-particle kwantbot-home-particle-three" aria-hidden="true" />

        <div className="absolute inset-0 flex items-center justify-center px-6 pb-4 pt-2 sm:px-10">
          <div className="relative flex h-full max-h-[760px] w-full max-w-[780px] items-center justify-center">
            <div className="kwantbot-home-aura pointer-events-none absolute h-[68%] w-[68%] rounded-full" aria-hidden="true" />
            <div className="kwantbot-home-orbit pointer-events-none absolute h-[58%] w-[58%] rounded-full" aria-hidden="true" />

            <div className="kwantbot-home-float relative z-10 h-[min(76vh,680px)] w-[min(76vh,680px)] max-h-[86%] max-w-[86vw]">
              <div ref={robotRef} className="kwantbot-home-model relative h-full w-full">
                <div className="absolute inset-[16%] rounded-full bg-primary/12 blur-[70px]" aria-hidden="true" />
                <div className="kwantbot-home-visor-glow pointer-events-none absolute z-20" aria-hidden="true" />
                <Image
                  src="/images/kwantbot-avatar.png"
                  alt="Kwant Bot"
                  width={760}
                  height={760}
                  priority
                  sizes="(max-width: 640px) 86vw, min(76vh, 680px)"
                  className="kwantbot-home-image relative z-10 h-full w-full object-contain grayscale contrast-[1.14] brightness-[.93]"
                />
                <span
                  aria-hidden="true"
                  className="kwantbot-home-tint pointer-events-none absolute inset-0 z-[11] opacity-[.22]"
                  style={{
                    background: "var(--primary)",
                    WebkitMaskImage: "url('/images/kwantbot-avatar.png')",
                    WebkitMaskPosition: "center",
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskSize: "contain",
                    maskImage: "url('/images/kwantbot-avatar.png')",
                    maskPosition: "center",
                    maskRepeat: "no-repeat",
                    maskSize: "contain",
                  }}
                />
              </div>
            </div>

            <div className="kwantbot-home-shadow pointer-events-none absolute bottom-[7%] h-6 w-[34%] rounded-full" aria-hidden="true" />
          </div>
        </div>
      </main>
    </div>
  );
}
