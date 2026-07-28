const DEFAULT_TIMEOUT_MS = 15_000;

export type InstitutionalGatewayHealth = {
  provider: "Databento" | "Rithmic";
  dataset: string;
  schema: "mbo";
  configured: boolean;
  connected: boolean;
  startedAt: string | null;
  archivePath: string | null;
  lastError: string | null;
  records: number;
  lastEventNs: number;
};

function gatewayConfiguration() {
  const origin = String(process.env.KWANTIFY_MARKET_DATA_GATEWAY_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const token = String(process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN || "").trim();
  return { origin, token };
}

export function configuredInstitutionalProvider(): "Databento" | "Rithmic" {
  return String(process.env.KWANTIFY_MARKET_DATA_PROVIDER || "Rithmic")
    .trim()
    .toLowerCase() === "rithmic"
    ? "Rithmic"
    : "Databento";
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
