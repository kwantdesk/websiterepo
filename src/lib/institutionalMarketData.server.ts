import {
  marketDataGatewayToken,
  marketDataGatewayUrl,
  marketDataGatewayUrlCandidates,
  marketDataProvider,
} from "@/lib/marketDataGatewayEnv";

const DEFAULT_TIMEOUT_MS = 15_000;

// The origin that most recently answered. Checked first on every request so
// steady state costs nothing; reset when it stops answering. This exists
// because env cruft accumulates: production carried a dead Tailscale-funnel
// URL under the highest-precedence variable name, every fetch died against
// it, and the charts silently degraded to the APPROX profile. Precedence
// cannot know which configured host is alive — only a request can.
let lastGoodOrigin: string | null = null;

export function configuredInstitutionalProvider(): "Databento" | "Rithmic" {
  return marketDataProvider();
}

export function isInstitutionalMarketDataConfigured() {
  return Boolean(marketDataGatewayUrl() && marketDataGatewayToken());
}

async function fetchFromOrigin(
  origin: string,
  path: string,
  token: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${origin}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchInstitutionalMarketData(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const token = marketDataGatewayToken();
  const configured = marketDataGatewayUrlCandidates();
  if (!configured.length || !token) {
    throw new Error("Institutional market-data gateway is not configured.");
  }

  const candidates = lastGoodOrigin && configured.includes(lastGoodOrigin)
    ? [lastGoodOrigin, ...configured.filter((origin) => origin !== lastGoodOrigin)]
    : configured;
  const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;

  let lastError: unknown = null;
  for (const origin of candidates) {
    try {
      const response = await fetchFromOrigin(origin, normalizedPath, token, init, timeoutMs);
      // Any HTTP response proves the host is alive; status handling belongs
      // to the caller. Only a network-level failure advances the failover.
      lastGoodOrigin = origin;
      return response;
    } catch (error) {
      lastError = error;
      if (origin === lastGoodOrigin) lastGoodOrigin = null;
    }
  }

  throw new Error(
    `Market-data gateway unreachable on ${candidates.length} configured origin(s): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
