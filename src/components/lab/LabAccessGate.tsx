"use client";

import { FormEvent, useState } from "react";
import { FlaskConical, KeyRound, LockKeyhole } from "lucide-react";

export default function LabAccessGate() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/lab/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Access denied.");
      window.location.replace("/lab");
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Access denied.");
      setPasscode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <section className="w-full max-w-[390px] border border-border bg-panel shadow-[0_22px_80px_rgba(0,0,0,.42)]">
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center border border-primary/30 bg-primary/[0.06] text-primary">
            <FlaskConical className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-muted">Private workspace</p>
            <h1 className="mt-1 text-[15px] font-semibold tracking-[0.04em]">THE LAB</h1>
          </div>
          <LockKeyhole className="ml-auto h-4 w-4 text-muted" strokeWidth={1.5} />
        </header>
        <form onSubmit={unlock} className="space-y-4 p-5">
          <div>
            <label htmlFor="lab-passcode" className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Desk passcode</label>
            <div className="mt-2 flex h-10 items-center border border-border bg-background px-3 focus-within:border-primary/45">
              <KeyRound className="mr-2 h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
              <input
                id="lab-passcode"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value.slice(0, 64))}
                className="min-w-0 flex-1 bg-transparent font-mono text-[13px] tracking-[0.3em] text-foreground outline-none"
                autoFocus
              />
            </div>
          </div>
          {error ? <p role="alert" className="border border-danger/30 bg-danger/[0.06] px-3 py-2 text-[9px] text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !passcode}
            className="h-9 w-full border border-primary/35 bg-primary/[0.08] text-[9px] font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Verifying…" : "Enter the desk"}
          </button>
          <p className="text-[8px] leading-4 text-muted">Protected by the normal KwantDesk account gate plus a separate HttpOnly Lab session.</p>
        </form>
      </section>
    </main>
  );
}
