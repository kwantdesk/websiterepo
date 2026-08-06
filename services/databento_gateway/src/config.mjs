import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SERVICE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

export function loadConfig(env = process.env) {
  const apiKey = String(env.DATABENTO_API_KEY || "").trim();
  const gatewayToken = String(
    env.KWANTDESK_NATIVE_GAMMA_GATEWAY_TOKEN
      || env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN
      || "",
  ).trim();
  return {
    apiKey,
    gatewayToken,
    host: String(env.DATABENTO_GATEWAY_HOST || "127.0.0.1").trim(),
    port: positiveInteger(env.DATABENTO_GATEWAY_PORT, 8794),
    repriceMs: positiveInteger(env.DATABENTO_GAMMA_REPRICE_MS, 60_000),
    reconnectMinMs: positiveInteger(env.DATABENTO_RECONNECT_MIN_MS, 1_000),
    reconnectMaxMs: positiveInteger(env.DATABENTO_RECONNECT_MAX_MS, 30_000),
    statePath: resolve(env.DATABENTO_GAMMA_STATE_PATH || resolve(SERVICE_ROOT, "data", "nq-positioning-map.json")),
    configured: Boolean(apiKey && gatewayToken),
  };
}
