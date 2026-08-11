import {
  marketDataGatewayToken,
  marketDataGatewayUrlCandidates,
} from "@/lib/marketDataGatewayEnv";

export type VendorMarketDataProvider = "databento" | "quantdata";

const DIRECT_ORIGINS: Record<VendorMarketDataProvider, string> = {
  databento: "https://api.databento.com",
  quantdata: "https://api.quantdata.us",
};

function directKey(provider: VendorMarketDataProvider) {
  return provider === "databento"
    ? process.env.DATABENTO_API_KEY?.trim() || ""
    : process.env.QUANTDATA_API_KEY?.trim() || "";
}

export function directVendorFallbackAllowed() {
  if (process.env.KWANTDESK_ALLOW_DIRECT_VENDOR_FALLBACK === "1") return true;
  return !process.env.VERCEL && process.env.NODE_ENV !== "production";
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
 * Server-only vendor transport. Production prefers the always-on VPS edge;
 * direct credentials are disabled on Vercel by default. They are available
 * only as an explicit emergency rollback switch.
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
  if (directVendorFallbackAllowed() && key) {
    return fetch(`${DIRECT_ORIGINS[provider]}${normalizedPath}`, {
      ...init,
      headers: directHeaders(provider, key, init.headers),
    });
  }

  if (lastGatewayError instanceof Error) throw lastGatewayError;
  throw new Error(`${provider === "databento" ? "Databento" : "KwantData"} is not configured.`);
}
