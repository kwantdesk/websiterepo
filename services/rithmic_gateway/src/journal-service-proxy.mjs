import { once } from "node:events";

const SERVICE_TOKEN_HEADER = "x-kwantdesk-internal-journal-token";
const SUBJECT_HEADER = "x-kwantdesk-desktop-subject";
const MAX_QUERY_LENGTH = 1_024;
const MAX_REQUEST_BYTES = 64 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_ANALYSIS_REQUEST_BYTES = 128 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[a-zA-Z0-9:_.-]{1,220}$/;
const ACTIONS = new Set([
  "reorder-accounts", "rename-account", "archive-account", "restore-account", "delete-account",
  "create-account", "create-trade", "save-evidence", "update", "sync",
]);
const ROUTES = new Set([
  "GET /v1/journal/state", "POST /v1/journal/state", "DELETE /v1/journal/state",
  "GET /v1/journal/analysis", "POST /v1/journal/analysis",
]);

/** Fixed identity-bound Journal bridge; never an arbitrary web proxy. */
export class JournalServiceProxy {
  constructor({ origin = "", serviceToken = "", timeoutMs = 120_000, fetchImpl = fetch } = {}) {
    this.origin = normalizeOrigin(origin);
    this.serviceToken = String(serviceToken || "").trim();
    this.timeoutMs = Math.max(10_000, Math.min(180_000, Number(timeoutMs) || 120_000));
    this.fetch = fetchImpl;
    if ((this.origin && !this.serviceToken) || (!this.origin && this.serviceToken)) {
      throw new Error("The Journal service origin and token must be configured together.");
    }
    if (this.serviceToken && (this.serviceToken.length < 32 || this.serviceToken.length > 4_096)) {
      throw new Error("The Journal service token must contain 32 to 4096 characters.");
    }
  }

  get configured() { return Boolean(this.origin && this.serviceToken); }
  health() { return Object.freeze({ configured: this.configured, origin: this.origin || null }); }
  canHandle(method, pathname) { return ROUTES.has(`${String(method || "").toUpperCase()} ${String(pathname || "")}`); }

  async forward(request, response, incomingUrl, principal) {
    if (!this.configured) throw problem(503, "journal_unconfigured", "Journal is not configured on this VPS.");
    const subject = String(principal?.subject || "").trim();
    if (!UUID.test(subject)) throw problem(401, "journal_desktop_identity_required", "A verified desktop identity is required for Journal.");
    if (!this.canHandle(request?.method, incomingUrl?.pathname)) throw problem(404, "journal_route_not_found", "That Journal operation is not available.");
    validateQuery(request.method, incomingUrl);
    const body = request.method === "POST" ? await readMutationBody(request, incomingUrl.pathname) : undefined;
    const upstreamUrl = new URL(incomingUrl.pathname === "/v1/journal/analysis" ? "/api/journal/analysis" : "/api/journal", this.origin);
    upstreamUrl.search = incomingUrl.search;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const upstream = await this.fetch(upstreamUrl, {
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
      const declared = Number(upstream.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw problem(502, "journal_payload_too_large", "The Journal response exceeded its bounded payload contract.");
      const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
      if (!contentType.toLowerCase().includes("application/json")) throw problem(502, "journal_invalid_payload", "Journal returned an unsupported payload.");
      response.writeHead(upstream.status, {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-KwantDesk-Data-Edge": "JOURNAL-VPS",
      });
      let total = 0;
      if (upstream.body) for await (const value of upstream.body) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        total += chunk.length;
        if (total > MAX_RESPONSE_BYTES) { response.destroy(problem(502, "journal_payload_too_large", "The Journal response exceeded its bounded payload contract.")); return; }
        if (!response.write(chunk)) await once(response, "drain");
      }
      response.end();
    } catch (error) {
      if (response.headersSent) { response.destroy(error instanceof Error ? error : new Error(String(error))); return; }
      if (error?.journalProblem === true) throw error;
      throw problem(error?.name === "AbortError" ? 504 : 502,
        error?.name === "AbortError" ? "journal_timeout" : "journal_unavailable",
        error?.name === "AbortError" ? "Journal timed out." : "Journal is unavailable.");
    } finally { clearTimeout(timeout); }
  }
}

function validateQuery(method, url) {
  if (!(url instanceof URL) || url.search.length > MAX_QUERY_LENGTH) throw problem(400, "journal_invalid_query", "The Journal query is invalid.");
  const entries = [...url.searchParams.entries()];
  if (url.pathname === "/v1/journal/analysis") {
    if (method === "POST" && entries.length === 0) return;
    const account = entries.length === 1 && entries[0][0] === "account" ? entries[0][1].trim() : "";
    if (method !== "GET" || !account || account.length > 100 || /[\u0000-\u001f]/.test(account)) {
      throw problem(400, "journal_invalid_query", "The Journal analysis account is invalid.");
    }
    return;
  }
  if (method !== "DELETE") {
    if (entries.length) throw problem(400, "journal_invalid_query", "The Journal query is invalid.");
    return;
  }
  if (entries.length !== 1 || !["tradeId", "evidenceId", "importId"].includes(entries[0][0]) || !IDENTIFIER.test(entries[0][1])) {
    throw problem(400, "journal_invalid_query", "Choose exactly one valid Journal item.");
  }
}

async function readMutationBody(request, pathname) {
  const contentType = String(request?.headers?.["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw problem(400, "journal_invalid_request", "The Journal request must be JSON.");
  const maximumBytes = pathname === "/v1/journal/analysis" ? MAX_ANALYSIS_REQUEST_BYTES : MAX_REQUEST_BYTES;
  const declared = Number(request?.headers?.["content-length"]);
  if (Number.isFinite(declared) && declared > maximumBytes) throw problem(413, "journal_request_too_large", "The Journal request exceeded its bounded payload contract.");
  const chunks = [];
  let total = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    total += chunk.length;
    if (total > maximumBytes) throw problem(413, "journal_request_too_large", "The Journal request exceeded its bounded payload contract.");
    chunks.push(chunk);
  }
  if (!total) throw problem(400, "journal_invalid_request", "The Journal request body is required.");
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw problem(400, "journal_invalid_request", "The Journal request is not valid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw problem(400, "journal_invalid_request", "The Journal request is invalid.");
  }
  if (pathname === "/v1/journal/analysis") {
    const keys = Object.keys(value);
    const account = typeof value.account === "string" ? value.account.trim() : "";
    const evidence = value.evidence;
    if (keys.length !== 2 || keys.some((key) => key !== "account" && key !== "evidence")
        || !account || account.length > 100 || /[\u0000-\u001f]/.test(account)
        || !evidence || typeof evidence !== "object" || Array.isArray(evidence)
        || evidence.version !== 1 || evidence.account !== account
        || typeof evidence.fingerprint !== "string" || evidence.fingerprint.length < 1 || evidence.fingerprint.length > 100
        || !evidence.performance || typeof evidence.performance.trades !== "number"
        || evidence.performance.trades < 3 || evidence.performance.trades > 100_000) {
      throw problem(400, "journal_invalid_request", "The Journal analysis evidence is invalid.");
    }
    return Buffer.from(JSON.stringify({ account, evidence }), "utf8");
  }
  if (!ACTIONS.has(value.action)) {
    throw problem(400, "journal_invalid_request", "The Journal action is invalid.");
  }
  const allowedKeys = new Set(["action", "account", "accountId", "accountIds", "newName", "trades", "imports", "trade", "evidence"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) throw problem(400, "journal_invalid_request", "The Journal request contains unsupported fields.");
  return Buffer.from(JSON.stringify(value), "utf8");
}

function normalizeOrigin(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const url = new URL(text);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("The Journal service origin is invalid.");
  url.pathname = url.pathname.replace(/\/+$/, "") + "/";
  return url.toString();
}

function problem(status, code, message) {
  const error = new Error(message); error.journalProblem = true; error.status = status; error.code = code; return error;
}

export function journalServiceProblem(error) {
  return error?.journalProblem === true
    ? { status: error.status, code: error.code, message: error.message }
    : { status: 502, code: "journal_unavailable", message: "Journal is unavailable." };
}
