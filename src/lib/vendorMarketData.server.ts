import {
  originIsCoolingDown,
  recordOriginFailure,
  recordOriginSuccess,
} from "@/lib/institutionalMarketData.server";
import {
  marketDataGatewayToken,
  marketDataGatewayUrlCandidates,
} from "@/lib/marketDataGatewayEnv";

export type VendorMarketDataProvider = "databento" | "quantdata" | "massive";

const DIRECT_ORIGINS: Record<VendorMarketDataProvider, string> = {
  databento: "https://api.databento.com",
  quantdata: "https://api.quantdata.us",
  massive: "https://api.massive.com",
};

function directKey(provider: VendorMarketDataProvider) {
  if (provider === "databento") return process.env.DATABENTO_API_KEY?.trim() || "";
  if (provider === "quantdata") return process.env.QUANTDATA_API_KEY?.trim() || "";
  return process.env.MASSIVE_API_KEY?.trim() || "";
}

/**
 * How long a vendor request may sit on the gateway before it is abandoned.
 *
 * This fetch previously carried NO timeout and no abort signal. A collector
 * that accepts a connection and then dies - which is what a crash loop looks
 * like from here - left the request hanging until the platform killed the
 * function, up to five minutes. Every pane on the workspace did the same thing
 * at once, which is what "the whole site is frozen" and a platform error spike
 * actually were.
 *
 * Ten seconds: comfortably longer than a healthy provider read, far shorter
 * than a function ceiling, and short enough that the retry above it cannot
 * stack two of them into most of a minute.
 */
const VENDOR_GATEWAY_TIMEOUT_MS = 10_000;

export function directVendorFallbackAllowed() {
  return process.env.KWANTDESK_ALLOW_DIRECT_VENDOR_FALLBACK === "1"
    && !process.env.VERCEL
    && process.env.NODE_ENV !== "production";
}

export function vendorMarketDataTransport(provider: VendorMarketDataProvider) {
  if (marketDataGatewayToken() && marketDataGatewayUrlCandidates().length) {
    return "vps-market-data-edge" as const;
  }
  if (directVendorFallbackAllowed() && directKey(provider)) return "direct" as const;
  return "unconfigured" as const;
}

export function vendorMarketDataConfigured(provider: VendorMarketDataProvider) {
  return vendorMarketDataTransport(provider) !== "unconfigured";
}

function directHeaders(
  provider: VendorMarketDataProvider,
  key: string,
  headers: HeadersInit | undefined,
) {
  const result = new Headers(headers);
  result.set(
    "Authorization",
    provider === "databento"
      ? `Basic ${Buffer.from(`${key}:`).toString("base64")}`
      : `Bearer ${key}`,
  );
  return result;
}

function gatewayHeaders(token: string, headers: HeadersInit | undefined) {
  const result = new Headers(headers);
  result.set("Authorization", `Bearer ${token}`);
  return result;
}

/**
 * Server-only vendor transport. Production uses the always-on VPS edge only.
 * A direct connection exists solely for explicitly opted-in local development;
 * Vercel cannot silently bypass the VPS when the gateway is unhealthy.
 */
export async function vendorMarketDataFetch(
  provider: VendorMarketDataProvider,
  path: string,
  init: RequestInit = {},
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const token = marketDataGatewayToken();
  const gatewayOrigins = token ? marketDataGatewayUrlCandidates() : [];
  let lastGatewayError: unknown = null;

  for (const origin of gatewayOrigins) {
    /*
     * An origin the breaker is holding open is skipped outright.
     *
     * On the platform there is no direct-vendor fallback by design, so a dead
     * gateway means no market data either way - but there is a large
     * difference between a request that fails in milliseconds and one that
     * occupies a function until its ceiling. The first shows a trader an
     * honest unavailable state; the second is what a frozen workspace and an
     * error spike are made of.
     */
    if (originIsCoolingDown(origin)) {
      lastGatewayError = new Error(`${provider} gateway is cooling down after repeated failures.`);
      continue;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VENDOR_GATEWAY_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${origin}/v1/vendors/${provider}${normalizedPath}`,
        { ...init, headers: gatewayHeaders(token, init.headers), signal: controller.signal },
      );
      if (![502, 503, 504].includes(response.status)) {
        recordOriginSuccess(origin);
        return response;
      }
      lastGatewayError = new Error(`${provider} gateway returned ${response.status}.`);
      // Definitive: the edge told us the collector behind it is not answering.
      recordOriginFailure(origin, true);
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastGatewayError = error;
      recordOriginFailure(origin);
    } finally {
      clearTimeout(timeout);
    }
  }

  const key = directKey(provider);
  if (key && directVendorFallbackAllowed()) {
    return fetch(`${DIRECT_ORIGINS[provider]}${normalizedPath}`, {
      ...init,
      headers: directHeaders(provider, key, init.headers),
    });
  }

  if (lastGatewayError instanceof Error) throw lastGatewayError;
  const label = provider === "databento" ? "Databento" : provider === "quantdata" ? "KwantData" : "Massive";
  throw new Error(`${label} is not configured on the VPS market-data edge.`);
}
