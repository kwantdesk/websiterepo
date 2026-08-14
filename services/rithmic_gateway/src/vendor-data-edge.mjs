import { createHash } from "node:crypto";
import { Readable } from "node:stream";

const DATABENTO_ORIGIN = "https://api.databento.com";
const QUANTDATA_ORIGIN = "https://api.quantdata.us";
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const ROLLING_DATABENTO_CACHE_MS = 12_000;
const EVENT_HISTORY_DATABENTO_CACHE_MS = 5 * 60_000;
const SAFE_DATABENTO_PATH = /^\/v0\/(timeseries\.get_range|metadata\.[A-Za-z0-9_.-]+)$/;
const SAFE_QUANTDATA_PATH = /^\/v1\/[A-Za-z0-9_./-]+$/;

async function requestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Vendor request body is too large."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function gatewayPath(pathname, prefix, pattern) {
  const upstreamPath = pathname.slice(prefix.length) || "/";
  if (!pattern.test(upstreamPath)) {
    throw Object.assign(new Error("Vendor endpoint is not allow-listed."), { status: 404 });
  }
  return upstreamPath;
}

function copyResponseHeaders(upstream, response, extra = {}) {
  const headers = {
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "Cache-Control": "no-store",
    ...extra,
  };
  for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  response.writeHead(upstream.status, headers);
}

function bufferedResponseHeaders(upstream, extra = {}) {
  const headers = {
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "Cache-Control": "no-store",
    ...extra,
  };
  for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

export function rollingDatabentoCacheKey(path, body) {
  if (path !== "/v0/timeseries.get_range" || !body?.length) return null;
  const params = new URLSearchParams(body.toString("utf8"));
  const schema = String(params.get("schema") || "");
  if (!schema.startsWith("ohlcv-")) return null;
  const start = Date.parse(params.get("start") || "");
  const end = Date.parse(params.get("end") || "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (Math.abs(Date.now() - end) > 60 * 60_000) return null;
  const durationDays = Math.max(1, Math.round((end - start) / (24 * 60 * 60_000)));
  return createHash("sha256").update(JSON.stringify({
    dataset: params.get("dataset"),
    symbols: params.get("symbols"),
    stypeIn: params.get("stype_in"),
    schema,
    durationDays,
  })).digest("hex");
}

export class VendorDataEdge {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetch = fetchImpl;
    this.databentoCache = new Map();
    this.databentoInFlight = new Map();
    this.quantDataCache = new Map();
    this.quantDataNextStartAt = 0;
    this.metrics = {
      databentoRequests: 0,
      databentoCacheHits: 0,
      databentoCoalescedRequests: 0,
      quantDataRequests: 0,
      quantDataCacheHits: 0,
      lastDatabentoAt: null,
      lastQuantDataAt: null,
      lastError: null,
    };
  }

  health() {
    return {
      databentoConfigured: Boolean(this.config.databentoApiKey),
      quantDataConfigured: Boolean(this.config.quantDataApiKey),
      ...this.metrics,
    };
  }

  canHandle(pathname) {
    return pathname.startsWith("/v1/vendors/databento/") || pathname.startsWith("/v1/vendors/quantdata/");
  }

  async handle(request, response, url) {
    try {
      if (url.pathname.startsWith("/v1/vendors/databento/")) {
        await this.#databento(request, response, url);
        return true;
      }
      if (url.pathname.startsWith("/v1/vendors/quantdata/")) {
        await this.#quantData(request, response, url);
        return true;
      }
      return false;
    } catch (error) {
      this.metrics.lastError = {
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      };
      if (response.headersSent) {
        response.destroy(error instanceof Error ? error : undefined);
        return true;
      }
      response.writeHead(Number(error?.status) || 502, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({ error: this.metrics.lastError.message }));
      return true;
    }
  }

  async #databento(request, response, url) {
    if (!this.config.databentoApiKey) throw Object.assign(new Error("Databento is not configured on the market-data gateway."), { status: 503 });
    if (!['GET', 'POST'].includes(request.method || "")) throw Object.assign(new Error("Method not allowed."), { status: 405 });
    const path = gatewayPath(url.pathname, "/v1/vendors/databento", SAFE_DATABENTO_PATH);
    const body = request.method === "POST" ? await requestBody(request) : undefined;
    const cacheKey = request.method === "POST" ? rollingDatabentoCacheKey(path, body) : null;
    if (cacheKey) {
      const cacheLifetime = request.headers["x-kwantdesk-event-history"] === "1"
        ? EVENT_HISTORY_DATABENTO_CACHE_MS
        : ROLLING_DATABENTO_CACHE_MS;
      const cached = this.databentoCache.get(cacheKey);
      if (cached && Date.now() - cached.updatedAt <= cacheLifetime) {
        this.metrics.databentoCacheHits += 1;
        response.writeHead(cached.status, cached.headers);
        response.end(cached.body);
        return;
      }
      let pending = this.databentoInFlight.get(cacheKey);
      if (!pending) {
        pending = this.#fetchBufferedDatabento(path, url.search, request.headers, body)
          .then((entry) => {
            if (entry.status >= 200 && entry.status < 300) {
              this.databentoCache.set(cacheKey, entry);
            }
            return entry;
          })
          .finally(() => this.databentoInFlight.delete(cacheKey));
        this.databentoInFlight.set(cacheKey, pending);
      } else {
        this.metrics.databentoCoalescedRequests += 1;
      }
      const entry = await pending;
      response.writeHead(entry.status, entry.headers);
      response.end(entry.body);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.vendorRequestTimeoutMs);
    let upstream;
    try {
      upstream = await this.fetch(`${DATABENTO_ORIGIN}${path}${url.search}`, {
        method: request.method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.databentoApiKey}:`).toString("base64")}`,
          ...(request.headers["content-type"] ? { "Content-Type": request.headers["content-type"] } : {}),
          Accept: request.headers.accept || "*/*",
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    this.metrics.databentoRequests += 1;
    this.metrics.lastDatabentoAt = new Date().toISOString();
    copyResponseHeaders(upstream, response, { "X-KwantDesk-Data-Edge": "Databento" });
    if (!upstream.body) return response.end();
    Readable.fromWeb(upstream.body).pipe(response);
  }

  async #fetchBufferedDatabento(path, search, requestHeaders, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.vendorRequestTimeoutMs);
    let upstream;
    try {
      upstream = await this.fetch(`${DATABENTO_ORIGIN}${path}${search}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.databentoApiKey}:`).toString("base64")}`,
          "Content-Type": requestHeaders["content-type"] || "application/x-www-form-urlencoded",
          Accept: requestHeaders.accept || "*/*",
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const payload = Buffer.from(await upstream.arrayBuffer());
    this.metrics.databentoRequests += 1;
    this.metrics.lastDatabentoAt = new Date().toISOString();
    const headers = bufferedResponseHeaders(upstream, { "X-KwantDesk-Data-Edge": "Databento" });
    // DBN/OHLCV responses are already compact binary data. Synchronously
    // gzipping a multi-day response pinned the single Node event loop above
    // 100% CPU, which stopped health checks and live Rithmic ticks while a
    // chart restored. Preserve the upstream bytes and let the live feed keep
    // its latency budget.
    headers["Content-Length"] = String(payload.length);
    return {
      status: upstream.status,
      headers,
      body: payload,
      updatedAt: Date.now(),
    };
  }

  async #quantData(request, response, url) {
    if (!this.config.quantDataApiKey) throw Object.assign(new Error("KwantData is not configured on the market-data gateway."), { status: 503 });
    if (request.method !== "POST") throw Object.assign(new Error("Method not allowed."), { status: 405 });
    const path = gatewayPath(url.pathname, "/v1/vendors/quantdata", SAFE_QUANTDATA_PATH);
    const body = await requestBody(request);
    const cacheKey = createHash("sha256").update(path).update(body).digest("hex");
    const cached = this.quantDataCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.metrics.quantDataCacheHits += 1;
      response.writeHead(cached.status, cached.headers);
      response.end(cached.body);
      return;
    }

    const now = Date.now();
    const startAt = Math.max(now, this.quantDataNextStartAt);
    this.quantDataNextStartAt = startAt + this.config.quantDataMinSpacingMs;
    if (startAt > now) await new Promise((resolve) => setTimeout(resolve, startAt - now));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.vendorRequestTimeoutMs);
    let upstream;
    try {
      upstream = await this.fetch(`${QUANTDATA_ORIGIN}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.quantDataApiKey}`,
          "Content-Type": request.headers["content-type"] || "application/json",
          Accept: "application/json",
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const payload = Buffer.from(await upstream.arrayBuffer());
    this.metrics.quantDataRequests += 1;
    this.metrics.lastQuantDataAt = new Date().toISOString();
    const headers = {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-KwantDesk-Data-Edge": "KwantData",
    };
    for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) headers[name] = value;
    }
    if (upstream.ok) {
      this.quantDataCache.set(cacheKey, {
        expiresAt: Date.now() + this.config.quantDataCacheMs,
        status: upstream.status,
        headers,
        body: payload,
      });
      if (this.quantDataCache.size > 2_000) {
        for (const [key, value] of this.quantDataCache) {
          if (value.expiresAt <= Date.now()) this.quantDataCache.delete(key);
        }
      }
    }
    response.writeHead(upstream.status, headers);
    response.end(payload);
  }
}
