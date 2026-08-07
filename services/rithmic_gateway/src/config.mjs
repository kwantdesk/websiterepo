import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseSubscriptions(value) {
  if (!String(value || "").trim()) return [];
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      if (separator < 1 || separator === entry.length - 1) {
        throw new Error(
          `Invalid RITHMIC_SUBSCRIPTIONS item "${entry}". Use EXCHANGE:SYMBOL.`,
        );
      }
      return {
        exchange: entry.slice(0, separator).trim().toUpperCase(),
        symbol: entry.slice(separator + 1).trim().toUpperCase(),
      };
    });
}

export function resolveProtoDirectory(env = process.env) {
  const candidates = [
    env.RITHMIC_PROTO_DIR,
    env.RITHMIC_SDK_DIR ? join(env.RITHMIC_SDK_DIR, "proto") : null,
    join(SERVICE_ROOT, "vendor", "proto"),
  ]
    .filter(Boolean)
    .map((candidate) => resolve(candidate));
  const found = candidates.find((candidate) =>
    existsSync(join(candidate, "request_login.proto")),
  );
  if (!found) {
    throw new Error(
      "Rithmic proto files are unavailable. Run scripts/install-rithmic-sdk.ps1 or set RITHMIC_PROTO_DIR.",
    );
  }
  return found;
}

export function loadConfig(env = process.env) {
  const sourceMode = String(env.RITHMIC_SOURCE_MODE || "protocol")
    .trim()
    .toLowerCase();
  if (!["protocol", "rtrader-excel"].includes(sourceMode)) {
    throw new Error(
      `Invalid RITHMIC_SOURCE_MODE "${sourceMode}". Use protocol or rtrader-excel.`,
    );
  }
  const user = String(env.RITHMIC_USER || "").trim();
  const password = String(env.RITHMIC_PASSWORD || "").trim();
  const gatewayToken = String(env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN || "").trim();
  return {
    serviceRoot: SERVICE_ROOT,
    protoDir: sourceMode === "protocol" ? resolveProtoDirectory(env) : null,
    sourceMode,
    url: String(
      env.RITHMIC_WS_URL || "wss://rituz00100.rithmic.com:443",
    ).trim(),
    systemName: String(env.RITHMIC_SYSTEM_NAME || "Rithmic Test").trim(),
    user,
    password,
    appName: String(env.RITHMIC_APP_NAME || "jahu:Olisa Labs Platform").trim(),
    appVersion: String(env.RITHMIC_APP_VERSION || "0.1.0").trim(),
    port: positiveInteger(env.RITHMIC_GATEWAY_PORT, 8793),
    host: String(env.RITHMIC_GATEWAY_HOST || "127.0.0.1").trim(),
    gatewayToken,
    configured:
      sourceMode === "rtrader-excel"
        ? Boolean(gatewayToken)
        : Boolean(user && password),
    subscriptions: parseSubscriptions(env.RITHMIC_SUBSCRIPTIONS),
    // Hard ceiling on what may ever be subscribed upstream. Read endpoints
    // subscribe on demand, so without this a single unexpected symbol in a
    // query string opens a brand new Rithmic subscription that never expires
    // — which is how provider usage limits get exceeded. Defaults to exactly
    // the configured subscription set; widen it deliberately or not at all.
    allowedInstruments: parseSubscriptions(
      env.RITHMIC_ALLOWED_INSTRUMENTS || env.RITHMIC_SUBSCRIPTIONS,
    ),
    enableDepthByOrder:
      String(env.RITHMIC_ENABLE_DEPTH_BY_ORDER || "true").toLowerCase() !==
      "false",
    maxTrades: positiveInteger(env.RITHMIC_MAX_TRADES, 250_000),
    // Append-only capture of the raw stream. Rithmic can replay bars but has
    // no depth-by-order replay, so unrecorded L3 is lost permanently — this
    // is on by default and should stay on.
    recordEnabled:
      String(env.RITHMIC_RECORD_ENABLED || "true").toLowerCase() !== "false",
    recordDir: String(
      env.RITHMIC_RECORD_DIR || join(SERVICE_ROOT, "recordings"),
    ).trim(),
    // Floor on depth-by-order resync requests per instrument. Rithmic depth
    // sequences are exchange-wide and regress constantly for one symbol, so
    // an unthrottled resync becomes a snapshot storm against the provider.
    depthResyncMinMs: positiveInteger(env.RITHMIC_DEPTH_RESYNC_MIN_MS, 30_000),
    reconnectMinMs: positiveInteger(env.RITHMIC_RECONNECT_MIN_MS, 1_000),
    reconnectMaxMs: positiveInteger(env.RITHMIC_RECONNECT_MAX_MS, 30_000),
    excelStaleMs: positiveInteger(env.RITHMIC_EXCEL_STALE_MS, 3_000),
  };
}

export { SERVICE_ROOT };
