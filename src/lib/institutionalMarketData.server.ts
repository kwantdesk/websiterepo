import {
  marketDataGatewayToken,
  marketDataGatewayUrl,
  marketDataProvider,
} from "@/lib/marketDataGatewayEnv";

const DEFAULT_TIMEOUT_MS = 15_000;

function gatewayConfiguration() {
  return { origin: marketDataGatewayUrl(), token: marketDataGatewayToken() };
}

export function configuredInstitutionalProvider(): "Databento" | "Rithmic" {
  return marketDataProvider();
}

export function isInstitutionalMarketDataConfigured() {
  const { origin, token } = gatewayConfiguration();
  return Boolean(origin && token);
}

export async function fetchInstitutionalMarketData(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const { origin, token } = gatewayConfiguration();
  if (!origin || !token) {
    throw new Error("Institutional market-data gateway is not configured.");
  }

  const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${origin}${normalizedPath}`, {
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
