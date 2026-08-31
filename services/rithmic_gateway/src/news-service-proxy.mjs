import { once } from "node:events";

const SERVICE_TOKEN_HEADER = "x-kwantdesk-internal-news-token";
const SUBJECT_HEADER = "x-kwantdesk-desktop-subject";
const MAX_QUERY_LENGTH = 4_096;
const MAX_QUERY_VALUE_LENGTH = 1_000;
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const ROUTES = new Map([
  ["GET /v1/news/calendar", Object.freeze({ path: "/api/economic-calendar", query: ["from", "to"] })],
  ["GET /v1/news/intelligence", Object.freeze({ path: "/api/macro-intelligence", query: ["refresh"] })],
  ["POST /v1/news/analyst", Object.freeze({ path: "/api/macro-intelligence", query: [] })],
  ["GET /v1/news/friends", Object.freeze({ path: "/api/news-sharing", query: [] })],
  ["POST /v1/news/share", Object.freeze({ path: "/api/news-sharing", query: [] })],
]);

/**
 * Fixed, identity-bound bridge for the provider-neutral NEWS receipts. It is
 * intentionally incapable of forwarding arbitrary paths, methods, headers or
 * query parameters and never forwards the desktop bearer to the web service.
 */
export class NewsServiceProxy {
  constructor({ origin = "", serviceToken = "", timeoutMs = 120_000, fetchImpl = fetch } = {}) {
    this.origin = normalizeOrigin(origin);
    this.serviceToken = String(serviceToken || "").trim();
    this.timeoutMs = Math.max(10_000, Math.min(180_000, Number(timeoutMs) || 120_000));
    this.fetch = fetchImpl;
    if ((this.origin && !this.serviceToken) || (!this.origin && this.serviceToken)) {
      throw new Error("The NEWS service origin and token must be configured together.");
    }
    if (this.serviceToken && (this.serviceToken.length < 32 || this.serviceToken.length > 4_096)) {
      throw new Error("The NEWS service token must contain 32 to 4096 characters.");
    }
  }

  get configured() {
    return Boolean(this.origin && this.serviceToken);
  }

  health() {
    return Object.freeze({ configured: this.configured, origin: this.origin || null });
  }

  canHandle(method, pathname) {
    return ROUTES.has(`${String(method || "").toUpperCase()} ${String(pathname || "")}`);
  }

  async forward(request, response, incomingUrl, principal) {
    if (!this.configured) throw problem(503, "news_unconfigured", "NEWS is not configured on this VPS.");
    const subject = String(principal?.subject || "").trim();
    if (!UUID.test(subject)) {
      throw problem(401, "news_desktop_identity_required", "A verified desktop identity is required for NEWS.");
    }
    const route = ROUTES.get(`${String(request?.method || "").toUpperCase()} ${incomingUrl?.pathname || ""}`);
    if (!route) throw problem(404, "news_route_not_found", "That NEWS operation is not available.");
    validateQuery(incomingUrl, route.query);
    const body = request.method === "GET" ? undefined : await readBoundedBody(request);
    const upstreamUrl = new URL(route.path, this.origin);
    upstreamUrl.search = incomingUrl.search;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let upstream;
    try {
      upstream = await this.fetch(upstreamUrl, {
        method: request.method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          [SERVICE_TOKEN_HEADER]: this.serviceToken,
          [SUBJECT_HEADER]: subject,
        },
        ...(body ? { body } : {}),
        signal: controller.signal,
      });
      const declaredLength = Number(upstream.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        throw problem(502, "news_payload_too_large", "The NEWS response exceeded its bounded payload contract.");
      }
      const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
      if (!contentType.toLowerCase().includes("application/json")) {
        throw problem(502, "news_invalid_payload", "The NEWS service returned an unsupported payload.");
      }
      response.writeHead(upstream.status, {
        "Content-Type": contentType,
        "Cache-Control": upstream.headers.get("cache-control") || "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-KwantDesk-Data-Edge": "NEWS-VPS",
      });
      let total = 0;
      if (upstream.body) {
        for await (const value of upstream.body) {
          const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
          total += chunk.length;
          if (total > MAX_RESPONSE_BYTES) {
            response.destroy(problem(502, "news_payload_too_large", "The NEWS response exceeded its bounded payload contract."));
            return;
          }
          if (!response.write(chunk)) await once(response, "drain");
        }
      }
      response.end();
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      if (error?.newsProblem === true) throw error;
      throw problem(
        error?.name === "AbortError" ? 504 : 502,
        error?.name === "AbortError" ? "news_timeout" : "news_unavailable",
        error?.name === "AbortError" ? "NEWS timed out." : "NEWS is unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function validateQuery(url, allowedKeys) {
  if (!(url instanceof URL) || url.search.length > MAX_QUERY_LENGTH) {
    throw problem(400, "news_invalid_query", "The NEWS query is invalid.");
  }
  const allowed = new Set(allowedKeys);
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    if (!allowed.has(key) || values.length !== 1 || values[0].length > MAX_QUERY_VALUE_LENGTH) {
      throw problem(400, "news_invalid_query", "The NEWS query is invalid.");
    }
  }
  if (url.pathname === "/v1/news/calendar") {
    if (!DATE.test(url.searchParams.get("from") || "") || !DATE.test(url.searchParams.get("to") || "")) {
      throw problem(400, "news_invalid_query", "The NEWS calendar range is invalid.");
    }
    const from = Date.parse(`${url.searchParams.get("from")}T00:00:00Z`);
    const to = Date.parse(`${url.searchParams.get("to")}T23:59:59Z`);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 120 * 86_400_000) {
      throw problem(400, "news_invalid_query", "The NEWS calendar range is invalid.");
    }
  }
  if (url.searchParams.has("refresh") && url.searchParams.get("refresh") !== "1") {
    throw problem(400, "news_invalid_query", "The NEWS refresh mode is invalid.");
  }
}

async function readBoundedBody(request) {
  const declared = Number(request?.headers?.["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw problem(413, "news_request_too_large", "The NEWS request exceeded its bounded payload contract.");
  }
  const chunks = [];
  let total = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    total += chunk.length;
    if (total > MAX_REQUEST_BYTES) {
      throw problem(413, "news_request_too_large", "The NEWS request exceeded its bounded payload contract.");
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  if (!body.length) throw problem(400, "news_invalid_request", "The NEWS request body is required.");
  let value;
  try { value = JSON.parse(body.toString("utf8")); }
  catch { throw problem(400, "news_invalid_request", "The NEWS request is not valid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw problem(400, "news_invalid_request", "The NEWS request is not valid JSON.");
  }
  return body;
}

function normalizeOrigin(value) {
  if (!String(value || "").trim()) return "";
  let parsed;
  try { parsed = new URL(String(value).trim()); }
  catch { throw new Error("The NEWS service origin must be an absolute HTTP or HTTPS origin."); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password ||
      parsed.search || parsed.hash || (parsed.pathname !== "/" && parsed.pathname !== "")) {
    throw new Error("The NEWS service origin must not contain credentials, a path, query, or fragment.");
  }
  return parsed.origin;
}

function problem(status, code, message) {
  return Object.assign(new Error(message), { newsProblem: true, status, code });
}

export function newsServiceProblem(error) {
  return error?.newsProblem === true
    ? error
    : problem(502, "news_unavailable", "NEWS is unavailable.");
}

export const newsServiceProxyContract = Object.freeze({
  serviceTokenHeader: SERVICE_TOKEN_HEADER,
  subjectHeader: SUBJECT_HEADER,
  routes: Object.freeze(Object.fromEntries(ROUTES)),
  maximumQueryLength: MAX_QUERY_LENGTH,
  maximumQueryValueLength: MAX_QUERY_VALUE_LENGTH,
  maximumRequestBytes: MAX_REQUEST_BYTES,
  maximumResponseBytes: MAX_RESPONSE_BYTES,
});
