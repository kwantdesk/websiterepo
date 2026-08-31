"use client";

import { useState } from "react";
import type { DesktopAuthorizationRequest } from "@/lib/desktopAuthProtocol.server.ts";

const scopeLabels: Record<string, string> = {
  "market.trades:read": "Live futures trades and execution-driven charts",
  "market.depth:read": "Live order book, depth and liquidity views",
  "market.replay:read": "Recorded market-session replay",
  "market.indices:read": "Normalized cash-index market data",
  "lab.snapshot:read": "Your published Lab plans and updates",
  "journal.account:read": "Your private Journal accounts, trades, imports and evidence",
  "journal.account:write": "Create and update your private Journal records",
};

export default function DesktopAuthorizeConsent({
  request,
  accountLabel,
}: {
  request: DesktopAuthorizationRequest;
  accountLabel: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function authorize() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/desktop-auth/authorize", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_type: "code",
          redirect_uri: request.redirectUri,
          state: request.state,
          code_challenge: request.codeChallenge,
          code_challenge_method: "S256",
          client_version: request.clientVersion,
          scope: request.scopes.join(" "),
        }),
      });
      const payload = await response.json() as { redirectUri?: string };
      if (!response.ok || !payload.redirectUri) throw new Error("authorization_failed");
      window.location.replace(payload.redirectUri);
    } catch {
      setError("KwantDesk could not authorize the workstation. Nothing was granted; try again.");
      setPending(false);
    }
  }

  function cancel() {
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("state", request.state);
    window.location.replace(redirect.toString());
  }

  return (
    <section className="login-card" aria-labelledby="desktop-authorize-title">
      <div className="brand-row">
        <div className="brand-mark">⌁</div>
        <span>Kwant Desk</span>
      </div>
      <div className="login-heading">
        <h1 id="desktop-authorize-title">Connect KwantDesk Workstation</h1>
        <p>Authorize the native Windows app without sharing your password or any vendor credential.</p>
      </div>
      <div className="mb-5 border border-white/10 bg-white/[.025] p-3 text-[11px] text-white/60">
        Signed in as <span className="font-semibold text-white">{accountLabel}</span>
      </div>
      <div className="mb-6">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-white/45">Requested read access</div>
        <ul className="space-y-2">
          {request.scopes.map((scope) => (
            <li key={scope} className="flex gap-2 border border-white/10 bg-black px-3 py-2 text-[11px] text-white/75">
              <span aria-hidden="true" className="text-emerald-400">✓</span>
              <span>{scopeLabels[scope] ?? scope}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mb-5 text-[10px] leading-5 text-white/45">
        Access tickets expire after five minutes. The renewable session can be revoked by signing out. Rithmic,
        Databento, QuantData and Massive credentials remain on the KwantDesk VPS.
      </p>
      {error ? <p className="login-error">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="h-10 border border-white/15 bg-transparent text-[11px] font-semibold uppercase tracking-[.1em] text-white/65 hover:text-white disabled:opacity-40" onClick={cancel} disabled={pending}>
          Cancel
        </button>
        <button type="button" className="h-10 border border-white bg-white text-[11px] font-bold uppercase tracking-[.1em] text-black hover:bg-white/90 disabled:opacity-40" onClick={() => void authorize()} disabled={pending}>
          {pending ? "Authorizing…" : "Authorize"}
        </button>
      </div>
    </section>
  );
}
