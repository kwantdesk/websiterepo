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
    try {
      const response = await fetch(
        `${origin}/v1/vendors/${provider}${normalizedPath}`,
        { ...init, headers: gatewayHeaders(token, init.headers) },
      );
      if (![502, 503, 504].includes(response.status)) return response;
      lastGatewayError = new Error(`${provider} gateway returned ${response.status}.`);
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastGatewayError = error;
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
