// Single source of truth for the private market-data gateway's environment
// variables (the always-on Rithmic collector).
//
// The names accumulated over time and were being read ad-hoc in more than one
// module, which meant a variable set under one spelling worked on one surface
// and silently returned "" on another. Silent empties are the worst failure
// here: the site serves no data and reports no error. Resolve them in one
// place, accept every spelling in use, and let callers ask a question instead
// of remembering a name.
//
// Order is precedence: the first name that carries a value wins.

const GATEWAY_URL_KEYS = [
  "KWANTDESK_MARKET_DATA_GATEWAY_URL",
  "KWANTIFY_MARKET_DATA_GATEWAY_URL",
  "KWANTIFY_MARKET_GATEWAY_URL",
  "KWANTDESK_MARKET_GATEWAY_URL",
] as const;

const GATEWAY_TOKEN_KEYS = [
  "KWANTDESK_MARKET_DATA_GATEWAY_TOKEN",
  "KWANTIFY_MARKET_DATA_GATEWAY_TOKEN",
  "KWANTIFY_MARKET_GATEWAY_TOKEN",
  "KWANTDESK_MARKET_GATEWAY_TOKEN",
] as const;

const PROVIDER_KEYS = [
  "KWANTDESK_MARKET_DATA_PROVIDER",
  "KWANTIFY_MARKET_DATA_PROVIDER",
  "KWANTIFY_DATA_PROVIDER",
  "KWANTDESK_DATA_PROVIDER",
] as const;

function firstConfigured(keys: readonly string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

// A serverless function cannot reach the operator's machine, so a loopback
// gateway URL is definitionally wrong on Vercel. This happened for real: the
// project carried a stale KWANTIFY_MARKET_DATA_GATEWAY_URL=http://127.0.0.1:8793
// from the laptop era, it outranked the freshly added variable pointing at
// the real collector, every proxy fetch failed, and the charts silently sat
// on the APPROX fallback. Treat loopback values as unset in that environment
// so a newer, reachable variable can win; local dev keeps loopback support.
function usableInDeployment(url: string): boolean {
  if (!process.env.VERCEL) return true;
  return !/^https?:\/\/(127\.0\.0\.1|localhost|\[?::1\]?)(:|\/|$)/i.test(url);
}

/** Origin of the private collector, with any trailing slash removed. */
export function marketDataGatewayUrl(): string {
  return marketDataGatewayUrlCandidates()[0] ?? "";
}

/**
 * Every configured, deployment-usable gateway origin in precedence order,
 * deduplicated. Callers that talk to the gateway should fail over through
 * this list rather than trusting the first name blindly: the production
 * incident was a years-of-cruft variable set — a dead Tailscale-funnel URL
 * under the highest-precedence name shadowing the live collector configured
 * under a newer one. Precedence cannot know which host is alive; only a
 * request can.
 */
export function marketDataGatewayUrlCandidates(): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const key of GATEWAY_URL_KEYS) {
    const value = process.env[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const trimmed = value.trim();
    if (!usableInDeployment(trimmed)) continue;
    const normalized = trimmed.replace(/\/+$/, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push(normalized);
  }
  return candidates;
}

/** Bearer token every collector route requires. Never expose to the browser. */
export function marketDataGatewayToken(): string {
  return firstConfigured(GATEWAY_TOKEN_KEYS);
}

/** Configured institutional provider; defaults to Rithmic. */
export function marketDataProvider(): "Databento" | "Rithmic" {
  const configured = firstConfigured(PROVIDER_KEYS) || "Rithmic";
  return configured.toLowerCase() === "rithmic" ? "Rithmic" : "Databento";
}

/**
 * Which variable names were actually picked up. Used by diagnostics so a
 * misspelled variable is visible instead of presenting as "no data".
 */
export function marketDataGatewayEnvNames() {
  const used = (keys: readonly string[]) =>
    keys.find((key) => typeof process.env[key] === "string" && process.env[key]?.trim()) ?? null;
  return {
    url: used(GATEWAY_URL_KEYS),
    token: used(GATEWAY_TOKEN_KEYS),
    provider: used(PROVIDER_KEYS),
    accepted: {
      url: [...GATEWAY_URL_KEYS],
      token: [...GATEWAY_TOKEN_KEYS],
      provider: [...PROVIDER_KEYS],
    },
  };
}
