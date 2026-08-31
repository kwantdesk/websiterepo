import { once } from "node:events";

const SERVICE_TOKEN_HEADER = "x-kwantdesk-internal-zyon-token";
const SUBJECT_HEADER = "x-kwantdesk-desktop-subject";
const MAX_QUERY_LENGTH = 4_096;
const MAX_QUERY_VALUE_LENGTH = 1_000;
const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROUTES = new Map([
  ["POST /v1/zyon/messages", Object.freeze({ path: "/api/zyon", query: [] })],
  ["GET /v1/zyon/journal", Object.freeze({ path: "/api/zyon/journal", query: ["compact", "chatId", "responseId"] })],
  ["POST /v1/zyon/journal", Object.freeze({ path: "/api/zyon/journal", query: [] })],
  ["DELETE /v1/zyon/journal", Object.freeze({ path: "/api/zyon/journal", query: [] })],
  ["GET /v1/zyon/gameplan-draft", Object.freeze({ path: "/api/zyon/gameplan-draft", query: ["localDate", "root"] })],
  ["PUT /v1/zyon/gameplan-draft", Object.freeze({ path: "/api/zyon/gameplan-draft", query: [] })],
  ["POST /v1/zyon/gameplan-lock", Object.freeze({
    path: "/api/zyon/gameplan-lock",
    query: [],
    body: "gameplan-lock",
  })],
  ["GET /v1/zyon/health", Object.freeze({ path: "/api/zyon/health", query: ["root"] })],
  ["GET /v1/zyon/gameplan-analyst-archive", Object.freeze({
    path: "/api/kwantbot/archive",
    query: ["root"],
    defaults: Object.freeze({ messageLimit: "1", memoryLimit: "600", contextLimit: "1" }),
  })],
  ["POST /v1/zyon/gameplan-analyst-archive", Object.freeze({
    path: "/api/kwantbot/archive",
    query: [],
    body: "gameplan-analyst-memory",
  })],
  ["GET /v1/kwantbot/archive", Object.freeze({
    path: "/api/kwantbot/archive",
    query: [
      "root", "download", "messageLimit", "memoryLimit", "contextLimit",
      "messagesBefore", "memoryBefore", "contextsBefore",
    ],
  })],
  ["POST /v1/kwantbot/archive", Object.freeze({
    path: "/api/kwantbot/archive",
    query: [],
    body: "kwantbot-archive",
  })],
]);

/**
 * Fixed, user-bound ZYON bridge. It is deliberately not an open HTTP proxy:
 * every public path, method and query key is allow-listed, the verified JWT
 * subject is supplied by the gateway itself, and only the VPS-held service
 * credential crosses the private upstream boundary.
 */
export class ZyonServiceProxy {
  constructor({ origin = "", serviceToken = "", timeoutMs = 300_000, fetchImpl = fetch } = {}) {
    this.origin = normalizeOrigin(origin);
    this.serviceToken = String(serviceToken || "").trim();
    this.timeoutMs = Math.max(10_000, Math.min(300_000, Number(timeoutMs) || 300_000));
    this.fetch = fetchImpl;
    if ((this.origin && !this.serviceToken) || (!this.origin && this.serviceToken)) {
      throw new Error("The ZYON service origin and token must be configured together.");
    }
    if (this.serviceToken && (this.serviceToken.length < 32 || this.serviceToken.length > 4_096)) {
      throw new Error("The ZYON service token must contain 32 to 4096 characters.");
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
    if (!this.configured) {
      throw problem(503, "zyon_unconfigured", "ZYON is not configured on this VPS.");
    }
    const subject = String(principal?.subject || "").trim();
    if (!UUID.test(subject)) {
      throw problem(401, "zyon_desktop_identity_required", "A verified desktop identity is required for ZYON.");
    }
    const key = `${String(request?.method || "").toUpperCase()} ${incomingUrl?.pathname || ""}`;
    const route = ROUTES.get(key);
    if (!route) {
      throw problem(404, "zyon_route_not_found", "That ZYON operation is not available.");
    }
    validateQuery(incomingUrl, route.query);
    const body = request.method === "GET" ? undefined : await readBoundedBody(request);
    if (route.body === "gameplan-analyst-memory") validateGameplanAnalystMemory(body);
    if (route.body === "kwantbot-archive") validateKwantBotArchive(body);
    if (route.body === "gameplan-lock") validateGameplanLock(body);
    const upstreamUrl = new URL(route.path, this.origin);
    upstreamUrl.search = incomingUrl.search;
    for (const [name, value] of Object.entries(route.defaults || {})) {
      upstreamUrl.searchParams.set(name, value);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let upstream;
    try {
      upstream = await this.fetch(upstreamUrl, {
        method: request.method,
        headers: {
          Accept: request.headers?.accept === "application/x-ndjson"
            ? "application/x-ndjson"
            : "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          [SERVICE_TOKEN_HEADER]: this.serviceToken,
          [SUBJECT_HEADER]: subject,
        },
        ...(body ? { body } : {}),
        signal: controller.signal,
      });

      const declaredLength = Number(upstream.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        throw problem(502, "zyon_payload_too_large", "The ZYON response exceeded its bounded payload contract.");
      }
      const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
      if (!isSupportedContentType(contentType)) {
        throw problem(502, "zyon_invalid_payload", "The ZYON service returned an unsupported payload.");
      }
      const headers = {
        "Content-Type": contentType,
        "Cache-Control": upstream.headers.get("cache-control") || "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-KwantDesk-Data-Edge": "ZYON-VPS",
      };
      const retryAfter = upstream.headers.get("retry-after");
      if (retryAfter && /^\d{1,5}$/.test(retryAfter)) headers["Retry-After"] = retryAfter;
      response.writeHead(upstream.status, headers);

      let total = 0;
      if (upstream.body) {
        for await (const value of upstream.body) {
          const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
          total += chunk.length;
          if (total > MAX_RESPONSE_BYTES) {
            response.destroy(problem(502, "zyon_payload_too_large", "The ZYON response exceeded its bounded payload contract."));
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
      if (error?.zyonProblem === true) throw error;
      throw problem(
        error?.name === "AbortError" ? 504 : 502,
        error?.name === "AbortError" ? "zyon_timeout" : "zyon_unavailable",
        error?.name === "AbortError" ? "ZYON timed out." : "ZYON is unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function validateQuery(url, allowedKeys) {
  if (!(url instanceof URL) || url.search.length > MAX_QUERY_LENGTH) {
    throw problem(400, "zyon_invalid_query", "The ZYON query is invalid.");
  }
  const allowed = new Set(allowedKeys);
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    if (!allowed.has(key) || values.length !== 1 || values[0].length > MAX_QUERY_VALUE_LENGTH) {
      throw problem(400, "zyon_invalid_query", "The ZYON query is invalid.");
    }
  }
  if (url.searchParams.has("root") && !["NQ", "ES"].includes(url.searchParams.get("root"))) {
    throw problem(400, "zyon_invalid_query", "The ZYON root is invalid.");
  }
  if (url.searchParams.has("compact") && url.searchParams.get("compact") !== "1") {
    throw problem(400, "zyon_invalid_query", "The ZYON compact mode is invalid.");
  }
  if (url.searchParams.has("localDate") && !/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("localDate"))) {
    throw problem(400, "zyon_invalid_query", "The ZYON session date is invalid.");
  }
  if (url.searchParams.has("download") && !["0", "1"].includes(url.searchParams.get("download"))) {
    throw problem(400, "zyon_invalid_query", "The KwantBot download mode is invalid.");
  }
  for (const key of ["messageLimit", "memoryLimit", "contextLimit"]) {
    if (url.searchParams.has(key) && !/^\d{1,5}$/.test(url.searchParams.get(key))) {
      throw problem(400, "zyon_invalid_query", `The KwantBot ${key} is invalid.`);
    }
  }
  for (const key of ["messagesBefore", "memoryBefore", "contextsBefore"]) {
    if (url.searchParams.has(key) && !Number.isFinite(Date.parse(url.searchParams.get(key)))) {
      throw problem(400, "zyon_invalid_query", `The KwantBot ${key} cursor is invalid.`);
    }
  }
  for (const key of ["chatId", "responseId"]) {
    if (url.searchParams.has(key) && !/^[A-Za-z0-9_-]{1,220}$/.test(url.searchParams.get(key))) {
      throw problem(400, "zyon_invalid_query", `The ZYON ${key} is invalid.`);
    }
  }
}

async function readBoundedBody(request) {
  const declared = Number(request?.headers?.["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw problem(413, "zyon_request_too_large", "The ZYON request exceeded its bounded payload contract.");
  }
  const chunks = [];
  let total = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    total += chunk.length;
    if (total > MAX_REQUEST_BYTES) {
      throw problem(413, "zyon_request_too_large", "The ZYON request exceeded its bounded payload contract.");
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  if (!body.length) throw problem(400, "zyon_invalid_request", "The ZYON request body is required.");
  try {
    JSON.parse(body.toString("utf8"));
  } catch {
    throw problem(400, "zyon_invalid_request", "The ZYON request is not valid JSON.");
  }
  return body;
}

function isSupportedContentType(value) {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("application/json") || normalized.includes("application/x-ndjson");
}

function validateGameplanAnalystMemory(body) {
  let parsed;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    throw problem(400, "zyon_invalid_request", "The GAMEPLAN analyst-memory request is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      Object.keys(parsed).some((key) => key !== "memory") ||
      !Array.isArray(parsed.memory) || parsed.memory.length < 1 || parsed.memory.length > 32) {
    throw problem(400, "zyon_invalid_request", "The GAMEPLAN analyst-memory batch is invalid.");
  }
  const recordKeys = new Set([
    "id", "root", "type", "createdAt", "price", "levelId", "levelName",
    "zone", "reasoning", "detail", "analyst",
  ]);
  for (const record of parsed.memory) {
    const analyst = record?.analyst;
    if (!record || typeof record !== "object" || Array.isArray(record) ||
        Object.keys(record).some((key) => !recordKeys.has(key)) ||
        !/^gameplan-analyst-(nq|es)-[A-Za-z0-9-]{1,100}$/.test(record.id || "") ||
        !["NQ", "ES"].includes(record.root) || record.type !== "context" ||
        !Number.isFinite(Date.parse(record.createdAt)) ||
        typeof record.price !== "number" || !Number.isFinite(record.price) || record.price <= 0 ||
        typeof record.levelId !== "string" || record.levelId.length < 1 || record.levelId.length > 500 ||
        typeof record.levelName !== "string" || record.levelName.length < 1 || record.levelName.length > 240 ||
        !Array.isArray(record.zone) || record.zone.length !== 2 ||
        record.zone.some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0) ||
        record.zone[1] < record.zone[0] ||
        typeof record.reasoning !== "string" || record.reasoning.length > 12_000 ||
        record.detail !== "Kwant Desk Gameplan Live Market Analyst" ||
        !analyst || typeof analyst !== "object" || Array.isArray(analyst) ||
        analyst.modelVersion !== "gameplan-live-analyst-v1" ||
        analyst.id !== record.id || analyst.root !== record.root ||
        analyst.generatedAt !== record.createdAt || analyst.price !== record.price ||
        !analyst.nearestLevel || analyst.nearestLevel.id !== record.levelId) {
      throw problem(400, "zyon_invalid_request", "The GAMEPLAN analyst-memory record is invalid.");
    }
  }
}

function validateKwantBotArchive(body) {
  let parsed;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    throw problem(400, "zyon_invalid_request", "The KwantBot archive request is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      Object.keys(parsed).some((key) => !["messages", "memory", "contexts"].includes(key))) {
    throw problem(400, "zyon_invalid_request", "The KwantBot archive batch is invalid.");
  }
  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  const memory = Array.isArray(parsed.memory) ? parsed.memory : [];
  const contexts = Array.isArray(parsed.contexts) ? parsed.contexts : [];
  if ((!messages.length && !memory.length && !contexts.length) ||
      messages.length > 500 || memory.length > 1_000 || contexts.length > 24) {
    throw problem(400, "zyon_invalid_request", "The KwantBot archive batch is outside its bounds.");
  }
  const roots = new Set(["NQ", "ES"]);
  const messageKinds = new Set(["system", "briefing", "approach", "touch", "rejection", "acceptance", "outcome", "options"]);
  const memoryTypes = new Set(["price", "context", "approach", "touch", "rejection", "acceptance", "outcome"]);
  for (const item of messages) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        typeof item.id !== "string" || item.id.length < 1 || item.id.length > 220 ||
        !roots.has(item.root) || !messageKinds.has(item.kind) ||
        typeof item.text !== "string" || item.text.length > 24_000 ||
        typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) ||
        typeof item.dedupeKey !== "string" || item.dedupeKey.length > 1_000) {
      throw problem(400, "zyon_invalid_request", "The KwantBot message batch is invalid.");
    }
  }
  for (const item of memory) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        typeof item.id !== "string" || item.id.length < 1 || item.id.length > 220 ||
        !roots.has(item.root) || !memoryTypes.has(item.type) ||
        typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt))) {
      throw problem(400, "zyon_invalid_request", "The KwantBot memory batch is invalid.");
    }
  }
  for (const item of contexts) {
    const context = item?.context;
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        typeof item.snapshotKey !== "string" || item.snapshotKey.length < 1 || item.snapshotKey.length > 220 ||
        !context || typeof context !== "object" || Array.isArray(context) ||
        !roots.has(context.root) || typeof context.generatedAt !== "string" ||
        !Number.isFinite(Date.parse(context.generatedAt)) || !Array.isArray(context.levels) ||
        !context.options || typeof context.options !== "object" || Array.isArray(context.options)) {
      throw problem(400, "zyon_invalid_request", "The KwantBot context batch is invalid.");
    }
  }
}

function validateGameplanLock(body) {
  let parsed;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    throw problem(400, "zyon_invalid_request", "The GAMEPLAN lock request is not valid JSON.");
  }
  const keys = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? Object.keys(parsed)
    : [];
  if (
    !parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
    keys.length !== 2 || keys.some((key) => !["draftId", "expectedUpdatedAt"].includes(key)) ||
    typeof parsed.draftId !== "string" || !/^[A-Za-z0-9:_-]{8,220}$/.test(parsed.draftId) ||
    typeof parsed.expectedUpdatedAt !== "string" || parsed.expectedUpdatedAt.length > 80 ||
    !Number.isFinite(Date.parse(parsed.expectedUpdatedAt))
  ) {
    throw problem(400, "zyon_invalid_request", "The GAMEPLAN lock request is invalid.");
  }
}


function normalizeOrigin(value) {
  if (!String(value || "").trim()) return "";
  let parsed;
  try {
    parsed = new URL(String(value).trim());
  } catch {
    throw new Error("The ZYON service origin must be an absolute HTTP or HTTPS origin.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password ||
      parsed.search || parsed.hash || (parsed.pathname !== "/" && parsed.pathname !== "")) {
    throw new Error("The ZYON service origin must not contain credentials, a path, query, or fragment.");
  }
  return parsed.origin;
}

function problem(status, code, message) {
  return Object.assign(new Error(message), { zyonProblem: true, status, code });
}

export function zyonServiceProblem(error) {
  return error?.zyonProblem === true
    ? error
    : problem(502, "zyon_unavailable", "ZYON is unavailable.");
}

export const zyonServiceProxyContract = Object.freeze({
  serviceTokenHeader: SERVICE_TOKEN_HEADER,
  subjectHeader: SUBJECT_HEADER,
  routes: Object.freeze(Object.fromEntries(ROUTES)),
  maximumQueryLength: MAX_QUERY_LENGTH,
  maximumQueryValueLength: MAX_QUERY_VALUE_LENGTH,
  maximumRequestBytes: MAX_REQUEST_BYTES,
  maximumResponseBytes: MAX_RESPONSE_BYTES,
});
