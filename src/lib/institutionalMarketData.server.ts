import {
  marketDataGatewayToken,
  marketDataGatewayUrl,
  marketDataGatewayUrlCandidates,
  marketDataProvider,
} from "@/lib/marketDataGatewayEnv";
import { getMarketIndexDefinition } from "@/lib/marketIndices";
import type { MarketIndexSnapshot } from "@/lib/marketIndices.server";

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
  const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;

  let lastError: unknown = null;
  const unavailable: string[] = [];
  // Probe in priority order and use the first healthy collector immediately.
  // Waiting for Promise.all meant every cold request also waited five seconds
  // for a dead legacy Tailscale origin even though feed.kwantdesk.com had
  // already answered. That delay exposed the stale browser tail long enough
  // for a live candle to appear across a false gap.
  for (const origin of preferred) {
    const connected = await originIsConnected(origin, token);
    if (!connected) {
      unavailable.push(origin);
      continue;
    }
    try {
      const response = await fetchFromOrigin(origin, normalizedPath, token, init, timeoutMs);
      lastGoodOrigin = origin;
      return response;
    } catch (error) {
      lastError = error;
      if (origin === lastGoodOrigin) lastGoodOrigin = null;
    }
  }

  // Preserve historical/degraded failover behavior only after every healthy
  // collector has failed. A disconnected origin must never delay steady-state
  // live chart requests.
  for (const origin of unavailable) {
    try {
      return await fetchFromOrigin(origin, normalizedPath, token, init, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Market-data gateway unreachable on ${preferred.length} configured origin(s): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Reads the shared VPS market-index cache and normalizes its provider-neutral
 * payload for server-side consumers such as Zyon and options context. Keeping
 * this here prevents those consumers from opening their own vendor sessions
 * from Vercel and makes the browser, API routes and AI context observe the
 * same authoritative frame.
 */
export async function fetchInstitutionalMarketIndexSnapshots(
  symbols: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<MarketIndexSnapshot[]> {
  const requested = [...new Set(symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => Boolean(getMarketIndexDefinition(symbol))))];
  if (!requested.length) return [];

  const response = await fetchInstitutionalMarketData(
    `v1/market-data/index-snapshot?symbols=${encodeURIComponent(requested.join(","))}`,
    { method: "GET" },
    timeoutMs,
  );
  const payload = await response.json().catch(() => null) as {
    snapshots?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok) {
    throw new Error(String(payload?.error || `VPS index snapshot failed (${response.status}).`));
  }
  const rows = Array.isArray(payload?.snapshots) ? payload.snapshots : [];
  return rows.flatMap((value): MarketIndexSnapshot[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = String(row.symbol || "").trim().toUpperCase();
    const definition = getMarketIndexDefinition(symbol);
    const lastPrice = finiteNumber(row.lastPrice);
    const timestamp = finiteNumber(row.timestamp);
    if (!definition || lastPrice === null || lastPrice <= 0 || timestamp === null) return [];
    const openPrice = finiteNumber(row.openPrice) ?? lastPrice;
    const calculatedChange = lastPrice - openPrice;
    const change = finiteNumber(row.change) ?? calculatedChange;
    const changePercent = finiteNumber(row.changePercent)
      ?? (openPrice ? calculatedChange / openPrice * 100 : 0);
    return [{
      symbol,
      broker: "Market Index",
      exchange: definition.exchange,
      lastPrice,
      openPrice,
      change,
      changePercent,
      timestamp,
      delayed: row.delayed === true,
      marketOpen: row.marketOpen === true,
      provider: String(row.provider || "VPS market-data edge"),
    }];
  });
}
