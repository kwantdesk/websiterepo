import {
  marketDataGatewayToken,
  marketDataGatewayUrl,
  marketDataGatewayUrlCandidates,
  marketDataProvider,
} from "@/lib/marketDataGatewayEnv";

const DEFAULT_TIMEOUT_MS = 15_000;
const HEALTH_CACHE_MS = 15_000;
const gatewayHealth = new Map<string, { checkedAt: number; healthy: boolean }>();

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

async function originIsConnected(origin: string, token: string) {
  const cached = gatewayHealth.get(origin);
  if (cached && Date.now() - cached.checkedAt < HEALTH_CACHE_MS) return cached.healthy;
  let healthy = false;
  try {
    const response = await fetchFromOrigin(origin, "/health", token, { method: "GET" }, 5_000);
    const payload = await response.json().catch(() => null) as {
      connected?: unknown;
      authenticated?: unknown;
    } | null;
    // A disconnected collector can still answer historical endpoints with a
    // stale 200 response. Only a live, authenticated collector should win
    // production routing when another configured origin is healthy.
    healthy = response.ok
      && payload?.connected === true
      && payload?.authenticated === true;
  } catch {
    healthy = false;
  }
  gatewayHealth.set(origin, { checkedAt: Date.now(), healthy });
  return healthy;
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

  const preferred = lastGoodOrigin && configured.includes(lastGoodOrigin)
    ? [lastGoodOrigin, ...configured.filter((origin) => origin !== lastGoodOrigin)]
    : configured;
  const health = await Promise.all(preferred.map(async (origin) => ({
    origin,
    connected: await originIsConnected(origin, token),
  })));
  const candidates = [
    ...health.filter((candidate) => candidate.connected).map((candidate) => candidate.origin),
    ...health.filter((candidate) => !candidate.connected).map((candidate) => candidate.origin),
  ];
  const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;

  let lastError: unknown = null;
  for (const origin of candidates) {
    try {
      const response = await fetchFromOrigin(origin, normalizedPath, token, init, timeoutMs);
      // Remember only a genuinely connected collector. A stale desktop can
      // return HTTP 200 from its archive while its live Rithmic session is
      // disconnected, which previously pinned every production request to it.
      if (gatewayHealth.get(origin)?.healthy) lastGoodOrigin = origin;
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
