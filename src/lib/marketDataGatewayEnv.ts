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

/** Origin of the private collector, with any trailing slash removed. */
export function marketDataGatewayUrl(): string {
  return firstConfigured(GATEWAY_URL_KEYS).replace(/\/+$/, "");
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
