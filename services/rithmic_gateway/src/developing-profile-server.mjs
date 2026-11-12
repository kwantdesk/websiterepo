import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { exchangeForRoot } from "./instrument-resolution.mjs";
import { DevelopingProfileArchive } from "./developing-profile-archive.mjs";

const PROFILE_PATH = "/v1/market-data/volume-profile";

export function createDevelopingProfileServer({ gatewayOrigin, archive, fetchImpl = fetch }) {
  const upstream = new URL(gatewayOrigin);
  if (!["http:", "https:"].includes(upstream.protocol) || upstream.username || upstream.password) {
    throw new Error("Invalid private gateway origin.");
  }

  return createServer({ requestTimeout: 15_000, headersTimeout: 10_000, maxHeaderSize: 8_192 }, async (request, response) => {
    const url = new URL(request.url, "http://profile.internal");
    const send = (status, body, type = "application/json") => {
      if (response.destroyed) return;
      response.writeHead(status, {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(body);
    };

    if (request.method === "GET" && url.pathname === "/health" && !url.search) {
      return send(200, JSON.stringify({ ok: true, service: "developing-volume-profile", readOnly: true }));
    }
    if (url.pathname !== PROFILE_PATH) return send(404, '{"error":"Not found."}');
    if (request.method !== "GET") return send(405, '{"error":"Method not allowed."}');
    if (!request.headers.authorization) return send(401, '{"error":"Authentication required."}');

    const destination = new URL(PROFILE_PATH, upstream);
    destination.search = url.search;
    // The collector authenticates the caller and owns the exact histogram.
    // Preserve its response when the optional archive is cold or unavailable.
    const controller = new AbortController();
    response.once("close", () => controller.abort());
    let base;
    let body;
    try {
      base = await fetchImpl(destination, {
        headers: { authorization: request.headers.authorization },
        redirect: "error",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_500)]),
      });
      body = await base.text();
    } catch {
      return send(502, '{"error":"The market-data gateway is temporarily unavailable."}');
    }
    const type = base.headers.get("content-type") ?? "application/json";
    const windowEndMs = Number(url.searchParams.get("developmentWindowEndMs"));
    if (base.status !== 200 || !Number.isSafeInteger(windowEndMs) || windowEndMs <= 0) {
      return send(base.status, body, type);
    }
    try {
      const profile = JSON.parse(body);
      const exchange = String(profile.exchange || url.searchParams.get("exchange") || exchangeForRoot(profile.root)).toUpperCase();
      if (!profile.complete || profile.period !== "daily" || profile.developingPoc?.length) {
        return send(base.status, body, type);
      }
      const development = await archive.load({
        exchange,
        symbol: profile.contractSymbol,
        fromMs: profile.startMs,
        windowEndMs,
        cutoffMs: profile.endMs,
        tickSize: profile.tickSize,
        groupTicks: profile.groupTicks,
        valueAreaPercent: profile.valueAreaPercent,
        minTradeVolume: profile.minTradeVolume,
        maxTradeVolume: profile.maxTradeVolume,
      });
      if (development) body = JSON.stringify({ ...profile, ...development });
    } catch {
      // Optional trails must never replace a successful histogram with an error.
    }
    return send(base.status, body, type);
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const archive = new DevelopingProfileArchive({ dir: process.env.RITHMIC_RECORD_DIR || "/recordings" });
  createDevelopingProfileServer({
    gatewayOrigin: process.env.PROFILE_GATEWAY_ORIGIN,
    archive,
  }).listen(Number(process.env.DEVELOPING_PROFILE_PORT || 8799), "0.0.0.0");
}
