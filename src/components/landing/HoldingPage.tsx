"use client";

import dynamic from "next/dynamic";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

const ParticleTerrain = dynamic(() => import("@/components/landing/ParticleTerrain"), {
  ssr: false,
});

export default function HoldingPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/site-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Access denied.");
      window.location.assign("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Access denied.");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="fixed inset-0 isolate overflow-hidden bg-black" aria-label="Kwant Desk private access">
      <ParticleTerrain />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_42%,transparent_0%,rgba(0,0,0,.08)_50%,rgba(0,0,0,.72)_100%)]" />

      <form
        onSubmit={submit}
        className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 sm:bottom-7"
      >
        <label htmlFor="kwantdesk-access-password" className="sr-only">
          Access code
        </label>
        {error ? (
          <p
            role="alert"
            className="absolute bottom-[calc(100%+9px)] left-1/2 w-max max-w-[280px] -translate-x-1/2 text-center font-mono text-[9px] tracking-[0.08em] text-white/45"
          >
            {error}
          </p>
        ) : null}
        <div className="flex h-9 w-[218px] items-center rounded-full border border-white/[.14] bg-black/35 p-1 pl-4 shadow-[0_14px_50px_rgba(0,0,0,.65)] backdrop-blur-xl transition-colors focus-within:border-white/30">
          <input
            id="kwantdesk-access-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="access code"
            autoComplete="current-password"
            spellCheck={false}
            className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[10px] tracking-[0.14em] text-white/75 outline-none placeholder:text-white/24"
          />
          <button
            type="submit"
            disabled={!password || submitting}
            aria-label="Enter Kwant Desk"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[.12] bg-white/[.06] text-white/55 transition hover:bg-white/[.12] hover:text-white disabled:cursor-default disabled:opacity-25"
          >
            {submitting
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <ArrowRight className="h-3 w-3" />}
          </button>
        </div>
      </form>
    </main>
  );
}
