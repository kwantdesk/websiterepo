import { createServer } from "node:http";
import { URL } from "node:url";

import { loadConfig } from "./config.mjs";
import { DatabentoNqTradeStream, loadDailyPositioningMap } from "./databento-client.mjs";
import { chicagoTradingClock } from "./market-clock.mjs";
import { classifyGatewayFreshness, deriveNativeGammaSnapshot } from "./native-gamma-engine.mjs";
import { readPositioningMap, replacePositioningMapAfterBuild } from "./state-store.mjs";

const config = loadConfig();
const stream = new DatabentoNqTradeStream(config);
let positioningMap = null;
let currentSnapshot = null;
let lastRepriceAt = 0;
let dailyJobRunning = false;
let dailyJobError = null;

function log(event) {
  process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`);
}

function json(response, status, body, cacheControl = "no-store") {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
  });
  response.end(JSON.stringify(body));
}

function authorized(request) {
  if (!config.gatewayToken) return false;
  const value = String(request.headers.authorization || "");
  return value.startsWith("Bearer ") && value.slice(7).trim() === config.gatewayToken;
}

function reprice(nowMs = Date.now()) {
  if (!positioningMap || !stream.lastPrice) return null;
  currentSnapshot = deriveNativeGammaSnapshot(positioningMap, stream.lastPrice, nowMs);
  lastRepriceAt = nowMs;
  return currentSnapshot;
}

async function refreshDailyMap(force = false) {
  if (dailyJobRunning) return;
  const clock = chicagoTradingClock(Date.now());
  if (!force && positioningMap?.oiAsOf === clock.expectedSettleDate) return;
  dailyJobRunning = true;
  const result = await replacePositioningMapAfterBuild(
    config.statePath,
    positioningMap,
    () => loadDailyPositioningMap(config.apiKey, clock.expectedSettleDate, log),
  );
  try {
    if (!result.replaced || !result.map) throw result.error ?? new Error("Daily positioning map refresh failed.");
    positioningMap = result.map;
    stream.setContract(result.map.underlyingContract);
    dailyJobError = null;
    reprice();
    log({ level: "info", code: "POSITIONING_MAP_READY", oiAsOf: result.map.oiAsOf, records: result.map.records.length, contract: result.map.underlyingContract });
  } catch (error) {
    dailyJobError = error instanceof Error ? error.message : String(error);
    log({ level: "error", code: "POSITIONING_MAP_REFRESH_FAILED", error: dailyJobError, retainingOiAsOf: positioningMap?.oiAsOf ?? null });
  } finally {
    dailyJobRunning = false;
  }
}

function payload(nowMs = Date.now()) {
  const clock = chicagoTradingClock(nowMs);
  if (positioningMap && stream.lastPrice && (!currentSnapshot || nowMs - lastRepriceAt >= config.repriceMs)) reprice(nowMs);
  const freshness = classifyGatewayFreshness({
    generatedAt: currentSnapshot?.generatedAt ?? null,
    lastTradeAt: stream.lastTradeAt,
    nowMs,
    marketClosed: clock.marketClosed,
    oiAsOf: positioningMap?.oiAsOf ?? null,
    settleDate: clock.expectedSettleDate,
  });
  return {
    ...(currentSnapshot ?? {}),
    generatedAt: currentSnapshot?.generatedAt ?? positioningMap?.generatedAt ?? null,
    oiAsOf: positioningMap?.oiAsOf ?? null,
    spotAge: freshness.spotAge,
    stale: freshness.stale,
    state: freshness.state,
    oiStale: freshness.oiStale,
    heartbeat: new Date(nowMs).toISOString(),
    stream: stream.status(),
    dailyJobError,
    mapAvailable: Boolean(positioningMap),
    levels: currentSnapshot?.levels ?? [],
  };
}

stream.on("trade", () => {
  if (!currentSnapshot || Date.now() - lastRepriceAt >= config.repriceMs) reprice();
});
stream.on("streamError", (error) => log({ level: "error", code: "LIVE_STREAM_ERROR", error: error.message }));
stream.on("status", (status) => log({ level: "info", code: "LIVE_STREAM_STATUS", ...status }));

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, config.configured ? 200 : 503, {
      configured: config.configured,
      service: "kwantdesk-databento-gateway",
      mapAvailable: Boolean(positioningMap),
      oiAsOf: positioningMap?.oiAsOf ?? null,
      dailyJobRunning,
      dailyJobError,
      stream: stream.status(),
    });
  }
  if (!authorized(request)) return json(response, config.gatewayToken ? 401 : 503, { error: "Native gamma gateway authentication is not configured." });
  if (request.method === "GET" && url.pathname === "/v1/native-gamma/nq") {
    const body = payload();
    return json(response, body.mapAvailable ? 200 : 503, body, "private, max-age=5, stale-while-revalidate=15");
  }
  if (request.method === "POST" && url.pathname === "/v1/native-gamma/refresh-map") {
    void refreshDailyMap(true);
    return json(response, 202, { accepted: true, currentOiAsOf: positioningMap?.oiAsOf ?? null });
  }
  return json(response, 404, { error: "Not found." });
});

async function start() {
  positioningMap = await readPositioningMap(config.statePath);
  if (positioningMap) log({ level: "info", code: "POSITIONING_MAP_RESTORED", oiAsOf: positioningMap.oiAsOf, records: positioningMap.records.length });
  stream.start(positioningMap?.underlyingContract || "");
  void refreshDailyMap(!positioningMap);
  setInterval(() => void refreshDailyMap(false), 60_000).unref?.();
  setInterval(() => reprice(), config.repriceMs).unref?.();
  server.listen(config.port, config.host, () => {
    log({ level: "info", code: "GATEWAY_LISTENING", origin: `http://${config.host}:${config.port}` });
  });
}

async function shutdown() {
  stream.stop();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
await start();
