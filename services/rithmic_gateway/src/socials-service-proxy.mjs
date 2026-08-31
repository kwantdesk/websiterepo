import { once } from "node:events";

const SERVICE_TOKEN_HEADER = "x-kwantdesk-internal-socials-token";
const SUBJECT_HEADER = "x-kwantdesk-desktop-subject";
const MAX_QUERY_LENGTH = 4_096;
const MAX_QUERY_VALUE_LENGTH = 1_000;
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const MAX_FOLLOW_RESPONSE_BYTES = 32 * 1024;
const MAX_REACTION_RESPONSE_BYTES = 64 * 1024;
const MAX_NOTIFICATIONS_RESPONSE_BYTES = 512 * 1024;
const MAX_GAMEPLAN_RESPONSE_BYTES = 512 * 1024;
const MAX_FRIENDS_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_FRIENDS_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_FRIENDS_EVENT_BYTES = 64 * 1024;
const MAX_FRIEND_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_OBJECT_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_OBJECT_RESPONSE_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE = /^[a-z][a-z0-9_]{2,23}$/;
const IDENTIFIER = /^[a-zA-Z0-9:_-]{1,180}$/;
const REACTION_KINDS = new Set([
  "LIKE", "USEFUL", "CLEAR", "EVIDENCE", "SAVED",
  "FIRE", "TARGET", "BRAIN", "APPLAUSE", "POLL",
]);
const OBJECT_TYPES = new Set([
  "profile", "post", "precord", "receipt", "receipt-evidence", "desk",
  "desk-member", "comment", "reaction", "follow", "card", "progress", "consensus",
]);
const OBJECT_MUTATION_TYPES = new Set(["profile", "post", "comment"]);
const SOCIAL_SCOPES = new Set(["private", "friends", "desk", "community"]);
const ROUTES = new Map([
  ["GET /v1/socials/state", Object.freeze({ path: "/api/socials-desktop/state", query: ["mine", "types"], maximumResponseBytes: MAX_RESPONSE_BYTES })],
  ["GET /v1/socials/profile", Object.freeze({ path: "/api/socials-desktop/profile", query: ["handle"], maximumResponseBytes: MAX_RESPONSE_BYTES })],
  ["GET /v1/socials/follow", Object.freeze({ path: "/api/socials-desktop/follow", query: ["targetUserId"], maximumResponseBytes: MAX_FOLLOW_RESPONSE_BYTES })],
  ["POST /v1/socials/follow", Object.freeze({ path: "/api/socials-desktop/follow", query: [], maximumResponseBytes: MAX_FOLLOW_RESPONSE_BYTES })],
  ["GET /v1/socials/following", Object.freeze({ path: "/api/socials-desktop/following", query: [], maximumResponseBytes: MAX_FOLLOW_RESPONSE_BYTES })],
  ["GET /v1/socials/reaction", Object.freeze({ path: "/api/socials-desktop/reaction", query: ["targetUserId", "targetObjectId", "kind"], maximumResponseBytes: MAX_REACTION_RESPONSE_BYTES })],
  ["POST /v1/socials/reaction", Object.freeze({ path: "/api/socials-desktop/reaction", query: [], maximumResponseBytes: MAX_REACTION_RESPONSE_BYTES })],
  ["GET /v1/socials/notifications", Object.freeze({ path: "/api/socials-desktop/notifications", query: ["offset", "limit"], maximumResponseBytes: MAX_NOTIFICATIONS_RESPONSE_BYTES })],
  ["PATCH /v1/socials/notifications", Object.freeze({ path: "/api/socials-desktop/notifications", query: [], maximumResponseBytes: MAX_NOTIFICATIONS_RESPONSE_BYTES })],
  ["POST /v1/socials/gameplan-execution", Object.freeze({ path: "/api/socials/gameplan-execution", query: [], maximumResponseBytes: MAX_GAMEPLAN_RESPONSE_BYTES })],
  ["POST /v1/socials/gameplan-score", Object.freeze({ path: "/api/socials-desktop/gameplan-score", query: [], maximumResponseBytes: MAX_GAMEPLAN_RESPONSE_BYTES })],
  ["POST /v1/socials/trade-post", Object.freeze({ path: "/api/socials", query: [], maximumResponseBytes: MAX_GAMEPLAN_RESPONSE_BYTES })],
  ["POST /v1/socials/object", Object.freeze({ path: "/api/socials", query: [], maximumResponseBytes: MAX_OBJECT_RESPONSE_BYTES })],
  ["DELETE /v1/socials/object", Object.freeze({ path: "/api/socials", query: [], maximumResponseBytes: MAX_OBJECT_RESPONSE_BYTES })],
  ["GET /v1/socials/friends", Object.freeze({ path: "/api/friends", query: ["friendId", "groupId"], maximumResponseBytes: MAX_FRIENDS_RESPONSE_BYTES })],
  ["POST /v1/socials/friends", Object.freeze({ path: "/api/friends", query: [], maximumResponseBytes: MAX_FRIENDS_RESPONSE_BYTES })],
  ["GET /v1/socials/friends/events", Object.freeze({ path: "/api/socials-desktop/friends-events", query: [], responseKind: "event-stream", maximumResponseBytes: MAX_FRIENDS_EVENT_BYTES })],
  ["GET /v1/socials/friends/avatar", Object.freeze({ path: "/api/socials-desktop/friend-avatar", query: ["userId"], responseKind: "image", maximumResponseBytes: MAX_FRIEND_AVATAR_BYTES })],
]);

/** Fixed, identity-bound SOCIALS bridge; never an arbitrary web proxy. */
export class SocialsServiceProxy {
  constructor({ origin = "", serviceToken = "", timeoutMs = 120_000, fetchImpl = fetch } = {}) {
    this.origin = normalizeOrigin(origin);
    this.serviceToken = String(serviceToken || "").trim();
    this.timeoutMs = Math.max(10_000, Math.min(180_000, Number(timeoutMs) || 120_000));
    this.fetch = fetchImpl;
    if ((this.origin && !this.serviceToken) || (!this.origin && this.serviceToken)) {
      throw new Error("The SOCIALS service origin and token must be configured together.");
    }
    if (this.serviceToken && (this.serviceToken.length < 32 || this.serviceToken.length > 4_096)) {
      throw new Error("The SOCIALS service token must contain 32 to 4096 characters.");
    }
  }

  get configured() { return Boolean(this.origin && this.serviceToken); }
  health() { return Object.freeze({ configured: this.configured, origin: this.origin || null }); }
  canHandle(method, pathname) {
    return ROUTES.has(`${String(method || "").toUpperCase()} ${String(pathname || "")}`);
  }

  async forward(request, response, incomingUrl, principal) {
    if (!this.configured) throw problem(503, "socials_unconfigured", "SOCIALS is not configured on this VPS.");
    const subject = String(principal?.subject || "").trim();
    if (!UUID.test(subject)) {
      throw problem(401, "socials_desktop_identity_required", "A verified desktop identity is required for SOCIALS.");
    }
    const route = ROUTES.get(`${String(request?.method || "").toUpperCase()} ${incomingUrl?.pathname || ""}`);
    if (!route) throw problem(404, "socials_route_not_found", "That SOCIALS operation is not available.");
    validateQuery(incomingUrl, route.query);
    const body = request.method === "POST" || request.method === "PATCH" || request.method === "DELETE"
      ? await readMutationBody(request, subject, incomingUrl.pathname)
      : undefined;
    const upstreamUrl = new URL(route.path, this.origin);
    upstreamUrl.search = incomingUrl.search;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const upstream = await this.fetch(upstreamUrl, {
        method: request.method,
        headers: {
          Accept: route.responseKind === "event-stream"
            ? "text/event-stream"
            : route.responseKind === "image"
              ? "image/png,image/jpeg,image/webp,image/gif"
              : "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          [SERVICE_TOKEN_HEADER]: this.serviceToken,
          [SUBJECT_HEADER]: subject,
        },
        ...(body ? { body } : {}),
        signal: controller.signal,
      });
      const declaredLength = Number(upstream.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > route.maximumResponseBytes) {
        throw problem(502, "socials_payload_too_large", "The SOCIALS response exceeded its bounded payload contract.");
      }
      const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
      const normalizedContentType = contentType.split(";", 1)[0].trim().toLowerCase();
      const validContentType = route.responseKind === "event-stream"
        ? normalizedContentType === "text/event-stream"
        : route.responseKind === "image"
          ? ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(normalizedContentType)
          : normalizedContentType === "application/json";
      if (!validContentType) {
        throw problem(502, "socials_invalid_payload", "The SOCIALS service returned an unsupported payload.");
      }
      if (route.responseKind === "event-stream") {
        response.writeHead(upstream.status, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "private, no-store, max-age=0, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "X-Content-Type-Options": "nosniff",
          "X-KwantDesk-Data-Edge": "SOCIALS-VPS",
        });
        await relayEventStream(upstream.body, response, route.maximumResponseBytes);
        return;
      }
      if (route.responseKind === "image") {
        response.writeHead(upstream.status, {
          "Content-Type": normalizedContentType,
          "Cache-Control": "private, max-age=300, no-transform",
          "X-Content-Type-Options": "nosniff",
          "X-KwantDesk-Data-Edge": "SOCIALS-VPS",
        });
        await relayBoundedBody(upstream.body, response, route.maximumResponseBytes);
        return;
      }
      response.writeHead(upstream.status, {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-KwantDesk-Data-Edge": "SOCIALS-VPS",
      });
      let total = 0;
      if (upstream.body) {
        for await (const value of upstream.body) {
          const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
          total += chunk.length;
          if (total > route.maximumResponseBytes) {
            response.destroy(problem(502, "socials_payload_too_large", "The SOCIALS response exceeded its bounded payload contract."));
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
      if (error?.socialsProblem === true) throw error;
      throw problem(
        error?.name === "AbortError" ? 504 : 502,
        error?.name === "AbortError" ? "socials_timeout" : "socials_unavailable",
        error?.name === "AbortError" ? "SOCIALS timed out." : "SOCIALS is unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function relayEventStream(body, response, maximumEventBytes) {
  let pending = Buffer.alloc(0);
  if (body) {
    for await (const value of body) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      while (true) {
        const boundary = pending.indexOf("\n\n");
        if (boundary < 0) break;
        const length = boundary + 2;
        if (length > maximumEventBytes) {
          response.destroy(problem(502, "socials_event_too_large", "A SOCIALS realtime event exceeded its bounded payload contract."));
          return;
        }
        const frame = pending.subarray(0, length);
        pending = pending.subarray(length);
        if (!response.write(frame)) await once(response, "drain");
      }
      if (pending.length > maximumEventBytes) {
        response.destroy(problem(502, "socials_event_too_large", "A SOCIALS realtime event exceeded its bounded payload contract."));
        return;
      }
    }
  }
  if (pending.length) {
    if (pending.length > maximumEventBytes) {
      response.destroy(problem(502, "socials_event_too_large", "A SOCIALS realtime event exceeded its bounded payload contract."));
      return;
    }
    if (!response.write(pending)) await once(response, "drain");
  }
  response.end();
}

async function relayBoundedBody(body, response, maximumBytes) {
  let total = 0;
  if (body) {
    for await (const value of body) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      total += chunk.length;
      if (total > maximumBytes) {
        response.destroy(problem(502, "socials_payload_too_large", "The SOCIALS response exceeded its bounded payload contract."));
        return;
      }
      if (!response.write(chunk)) await once(response, "drain");
    }
  }
  response.end();
}

function validateQuery(url, allowedKeys) {
  if (!(url instanceof URL) || url.search.length > MAX_QUERY_LENGTH) {
    throw problem(400, "socials_invalid_query", "The SOCIALS query is invalid.");
  }
  const allowed = new Set(allowedKeys);
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    if (!allowed.has(key) || values.length !== 1 || values[0].length > MAX_QUERY_VALUE_LENGTH) {
      throw problem(400, "socials_invalid_query", "The SOCIALS query is invalid.");
    }
  }
  if (url.pathname === "/v1/socials/state") {
    if (url.searchParams.has("mine") && url.searchParams.get("mine") !== "1") {
      throw problem(400, "socials_invalid_query", "The SOCIALS account filter is invalid.");
    }
    if (url.searchParams.has("types")) {
      const types = (url.searchParams.get("types") || "").split(",");
      if (!types.length || types.some((type) => !OBJECT_TYPES.has(type)) || new Set(types).size !== types.length) {
        throw problem(400, "socials_invalid_query", "The SOCIALS object-type filter is invalid.");
      }
    }
  }
  if (url.pathname === "/v1/socials/profile") {
    const handle = url.searchParams.get("handle") || "";
    if (!HANDLE.test(handle) || (handle.match(/[a-z]/g) || []).length < 3) {
      throw problem(400, "socials_invalid_query", "The SOCIALS profile handle is invalid.");
    }
  }
  if (url.pathname === "/v1/socials/follow" && url.searchParams.has("targetUserId")) {
    if (!UUID.test(url.searchParams.get("targetUserId") || "")) {
      throw problem(400, "socials_invalid_query", "The SOCIALS follow target is invalid.");
    }
  }
  if (url.pathname === "/v1/socials/follow" && !url.searchParams.has("targetUserId")
      && allowedKeys.includes("targetUserId")) {
    throw problem(400, "socials_invalid_query", "The SOCIALS follow target is required.");
  }
  if (url.pathname === "/v1/socials/reaction" && allowedKeys.length > 0) {
    const targetUserId = url.searchParams.get("targetUserId") || "";
    const targetObjectId = url.searchParams.get("targetObjectId") || "";
    const kind = url.searchParams.get("kind") || "";
    if (!UUID.test(targetUserId) || !IDENTIFIER.test(targetObjectId) || !REACTION_KINDS.has(kind)) {
      throw problem(400, "socials_invalid_query", "The SOCIALS reaction target is invalid.");
    }
  }
  if (url.pathname === "/v1/socials/notifications" && allowedKeys.length > 0) {
    const offset = url.searchParams.get("offset") || "";
    const limit = url.searchParams.get("limit") || "";
    if (!/^\d{1,7}$/.test(offset) || !/^\d{1,3}$/.test(limit)
        || Number(offset) > 1_000_000 || Number(limit) < 1 || Number(limit) > 100) {
      throw problem(400, "socials_invalid_query", "The SOCIALS notification query is invalid.");
    }
  }
  if (url.pathname === "/v1/socials/friends") {
    for (const key of ["friendId", "groupId"]) {
      if (url.searchParams.has(key) && !IDENTIFIER.test(url.searchParams.get(key) || "")) {
        throw problem(400, "socials_invalid_query", "The Friends conversation query is invalid.");
      }
    }
    if (url.searchParams.has("friendId") && url.searchParams.has("groupId")) {
      throw problem(400, "socials_invalid_query", "Choose one Friends conversation at a time.");
    }
  }
  if (url.pathname === "/v1/socials/friends/events" && url.search.length > 0) {
    throw problem(400, "socials_invalid_query", "The Friends realtime query is invalid.");
  }
  if (url.pathname === "/v1/socials/friends/avatar") {
    const userId = url.searchParams.get("userId") || "";
    if (!UUID.test(userId)) throw problem(400, "socials_invalid_query", "The Friends avatar account is invalid.");
  }
}

async function readMutationBody(request, subject, pathname) {
  const contentType = String(request?.headers?.["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw problem(400, "socials_invalid_request", "The SOCIALS request must be JSON.");
  }
  const declared = Number(request?.headers?.["content-length"]);
  const maximumRequestBytes = pathname === "/v1/socials/friends"
    ? MAX_FRIENDS_REQUEST_BYTES
    : pathname === "/v1/socials/object"
      ? MAX_OBJECT_REQUEST_BYTES
      : MAX_REQUEST_BYTES;
  if (Number.isFinite(declared) && declared > maximumRequestBytes) {
    throw problem(413, "socials_request_too_large", "The SOCIALS request exceeded its bounded payload contract.");
  }
  const chunks = [];
  let total = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    total += chunk.length;
    if (total > maximumRequestBytes) {
      throw problem(413, "socials_request_too_large", "The SOCIALS request exceeded its bounded payload contract.");
    }
    chunks.push(chunk);
  }
  if (!total) throw problem(400, "socials_invalid_request", "The SOCIALS request body is required.");
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw problem(400, "socials_invalid_request", "The SOCIALS request is not valid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw problem(400, "socials_invalid_request", "The SOCIALS request is invalid.");
  }
  if (pathname === "/v1/socials/gameplan-execution") return gameplanExecutionBody(value);
  if (pathname === "/v1/socials/gameplan-score") return gameplanScoreBody(value);
  if (pathname === "/v1/socials/trade-post") return tradePostBody(value);
  if (pathname === "/v1/socials/object") return socialObjectMutationBody(value, request.method);
  if (pathname === "/v1/socials/reaction") return reactionMutationBody(value);
  if (pathname === "/v1/socials/notifications") return notificationMutationBody(value);
  if (pathname === "/v1/socials/friends") return friendsMutationBody(value);
  if (pathname !== "/v1/socials/follow") {
    throw problem(404, "socials_route_not_found", "That SOCIALS operation is not available.");
  }
  const action = typeof value.action === "string" ? value.action : "";
  const targetUserId = typeof value.targetUserId === "string" ? value.targetUserId.toLowerCase() : "";
  const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey.toLowerCase() : "";
  const expectedKeys = action === "notifications"
    ? ["idempotencyKey", "action", "targetUserId", "enabled"]
    : ["idempotencyKey", "action", "targetUserId"];
  const keys = Object.keys(value);
  if (!["follow", "unfollow", "notifications"].includes(action)
      || keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))
      || !UUID.test(targetUserId) || targetUserId === subject.toLowerCase()
      || !UUID.test(idempotencyKey)
      || (action === "notifications" ? typeof value.enabled !== "boolean" : value.enabled !== undefined)) {
    throw problem(400, "socials_invalid_request", "The SOCIALS follow request is invalid.");
  }
  return Buffer.from(JSON.stringify({
    idempotencyKey,
    action,
    targetUserId,
    ...(action === "notifications" ? { enabled: value.enabled } : {}),
  }), "utf8");
}

function socialObjectMutationBody(value, method) {
  if (method === "DELETE") {
    const keys = Object.keys(value);
    if (keys.length < 1 || keys.length > 2 || keys.some((key) => !["id", "parentId"].includes(key))
        || !objectIdentifier(value.id)
        || !(value.parentId === undefined || value.parentId === null || IDENTIFIER.test(value.parentId))) {
      throw problem(400, "socials_invalid_request", "The SOCIALS object deletion is invalid.");
    }
    return Buffer.from(JSON.stringify({
      id: value.id,
      ...(value.parentId ? { parentId: value.parentId } : {}),
    }), "utf8");
  }
  const topKeys = Object.keys(value);
  const object = value.object;
  if (topKeys.length !== 1 || topKeys[0] !== "object"
      || !object || typeof object !== "object" || Array.isArray(object)) {
    throw problem(400, "socials_invalid_request", "The SOCIALS object mutation is invalid.");
  }
  const allowedKeys = new Set(["id", "objectType", "scope", "deskId", "parentId", "authorLabel", "payload"]);
  const keys = Object.keys(object);
  if (keys.length < 4 || keys.some((key) => !allowedKeys.has(key))
      || !OBJECT_MUTATION_TYPES.has(object.objectType)
      || !SOCIAL_SCOPES.has(object.scope)
      || !objectIdentifier(object.id)
      || !(object.deskId === undefined || object.deskId === null || typeof object.deskId === "string" && IDENTIFIER.test(object.deskId))
      || !(object.parentId === undefined || object.parentId === null || typeof object.parentId === "string" && IDENTIFIER.test(object.parentId))
      || !(object.authorLabel === undefined || typeof object.authorLabel === "string" && object.authorLabel.length <= 80 && !/\u0000/.test(object.authorLabel))
      || !validSocialPayload(object.payload)) {
    throw problem(400, "socials_invalid_request", "The SOCIALS object mutation is invalid.");
  }
  if ((object.objectType === "profile" && object.id !== "profile")
      || (object.objectType === "post" && !/^(post|repost):[a-zA-Z0-9:_-]{8,}$/.test(object.id))
      || (object.objectType === "comment" && (!/^comment:[a-zA-Z0-9_-]{8,}$/.test(object.id) || !IDENTIFIER.test(object.parentId || "")))) {
    throw problem(400, "socials_invalid_request", "The SOCIALS object identity is invalid.");
  }
  return Buffer.from(JSON.stringify({ object }), "utf8");
}

function objectIdentifier(value) {
  return typeof value === "string" && value.length <= 220 && /^[a-zA-Z0-9:_-]+$/.test(value);
}

function validSocialPayload(value, depth = 0) {
  if (depth > 8 || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 100) return false;
  return entries.every(([key, item]) => /^[a-zA-Z0-9_-]{1,80}$/.test(key) && validSocialPayloadValue(item, depth + 1));
}

function validSocialPayloadValue(value, depth) {
  if (depth > 8 || value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const maximum = value.startsWith("data:image/") ? 2_800_000 : 8_000;
    return value.length <= maximum && !/\u0000/.test(value);
  }
  if (Array.isArray(value)) return value.length <= 80 && value.every((item) => validSocialPayloadValue(item, depth + 1));
  return value && typeof value === "object" && validSocialPayload(value, depth);
}

function friendsMutationBody(value) {
  const action = typeof value.action === "string" ? value.action : "";
  const target = typeof value.targetUserId === "string" ? value.targetUserId : "";
  const group = typeof value.groupId === "string" ? value.groupId : "";
  const text = (candidate, maximum) => typeof candidate === "string" && candidate.length <= maximum && !/\u0000/.test(candidate);
  const keysExactly = (expected) => {
    const keys = Object.keys(value);
    return keys.length === expected.length && keys.every((key) => expected.includes(key));
  };
  const ids = (candidate, maximum = 100) => Array.isArray(candidate) && candidate.length >= 1
    && candidate.length <= maximum && candidate.every((item) => typeof item === "string" && IDENTIFIER.test(item))
    && new Set(candidate).size === candidate.length;
  const attachments = (candidate) => Array.isArray(candidate) && candidate.length <= 2 && candidate.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const keys = Object.keys(item);
    return keys.length === 5 && keys.every((key) => ["id", "name", "type", "size", "dataUrl"].includes(key))
      && IDENTIFIER.test(item.id) && text(item.name, 120) && text(item.type, 80)
      && Number.isSafeInteger(item.size) && item.size >= 1 && item.size <= 950_000
      && typeof item.dataUrl === "string" && item.dataUrl.length <= 1_350_000
      && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(item.dataUrl);
  });
  const targetOnly = new Set(["request", "accept", "cancel", "decline", "remove", "block", "unblock", "mark-read"]);
  if (targetOnly.has(action) && keysExactly(["action", "targetUserId"]) && IDENTIFIER.test(target)) {
    return Buffer.from(JSON.stringify({ action, targetUserId: target }), "utf8");
  }
  if (action === "identity" && keysExactly(["action", "displayName", "handle", "avatarUrl"])
      && text(value.displayName, 60) && value.displayName.trim()
      && /^[a-z][a-z0-9_]{2,23}$/.test(value.handle)
      && text(value.avatarUrl, 1_600_000)
      && (value.avatarUrl === "" || /^https:\/\//i.test(value.avatarUrl)
        || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value.avatarUrl))) {
    return Buffer.from(JSON.stringify(value), "utf8");
  }
  if (action === "status" && keysExactly(["action", "presenceStatus", "presenceMessage"])
      && ["online", "dnd", "away", "sleeping", "offline"].includes(value.presenceStatus)
      && text(value.presenceMessage, 120)) return Buffer.from(JSON.stringify(value), "utf8");
  if (action === "create-group" && keysExactly(["action", "name", "description", "memberUserIds", "allowMemberInvites"])
      && text(value.name, 60) && value.name.trim() && text(value.description, 240)
      && ids(value.memberUserIds, 100) && typeof value.allowMemberInvites === "boolean") {
    return Buffer.from(JSON.stringify(value), "utf8");
  }
  if (action === "group-settings" && keysExactly(["action", "groupId", "name", "description", "allowMemberInvites"])
      && IDENTIFIER.test(group) && text(value.name, 60) && value.name.trim() && text(value.description, 240)
      && typeof value.allowMemberInvites === "boolean") return Buffer.from(JSON.stringify(value), "utf8");
  if (action === "group-add-members" && keysExactly(["action", "groupId", "memberUserIds"])
      && IDENTIFIER.test(group) && ids(value.memberUserIds, 100)) return Buffer.from(JSON.stringify(value), "utf8");
  if (action === "group-remove-member" && keysExactly(["action", "groupId", "targetUserId"])
      && IDENTIFIER.test(group) && IDENTIFIER.test(target)) return Buffer.from(JSON.stringify(value), "utf8");
  if (["group-leave", "group-delete", "group-mark-read"].includes(action)
      && keysExactly(["action", "groupId"]) && IDENTIFIER.test(group)) return Buffer.from(JSON.stringify(value), "utf8");
  if (action === "group-mute" && keysExactly(["action", "groupId", "muted"])
      && IDENTIFIER.test(group) && typeof value.muted === "boolean") return Buffer.from(JSON.stringify(value), "utf8");
  const messageKeys = action === "message"
    ? ["action", "targetUserId", "body", "attachments", "clientMessageId"]
    : ["action", "groupId", "body", "attachments", "clientMessageId"];
  if ((action === "message" || action === "group-message") && keysExactly(messageKeys)
      && (action === "message" ? IDENTIFIER.test(target) : IDENTIFIER.test(group))
      && text(value.body, 2_000) && attachments(value.attachments)
      && (value.body.trim().length > 0 || value.attachments.length > 0)
      && UUID.test(value.clientMessageId || "")) return Buffer.from(JSON.stringify(value), "utf8");
  throw problem(400, "socials_invalid_request", "The Friends request is invalid.");
}

function tradePostBody(value) {
  const expected = [
    "journalTradeId", "instrument", "side", "entryPrice", "exitPrice", "openedAt", "closedAt",
    "entryTimeKnown", "exitTimeKnown", "netPnl", "initialRisk", "rMultiple", "caption", "observedAt",
  ];
  const keys = Object.keys(value);
  const nullableNumber = (candidate) => candidate === null || (typeof candidate === "number" && Number.isFinite(candidate));
  const time = (candidate, nullable = false) => (nullable && candidate === null)
    || (typeof candidate === "string" && candidate.length <= 40 && Number.isFinite(Date.parse(candidate)));
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))
      || !IDENTIFIER.test(value.journalTradeId)
      || typeof value.instrument !== "string" || !/^[A-Z0-9._!-]{1,32}$/.test(value.instrument)
      || !["LONG", "SHORT", "UNKNOWN"].includes(value.side)
      || !nullableNumber(value.entryPrice) || !nullableNumber(value.exitPrice)
      || !time(value.openedAt) || !time(value.closedAt, true)
      || typeof value.entryTimeKnown !== "boolean" || typeof value.exitTimeKnown !== "boolean"
      || typeof value.netPnl !== "number" || !Number.isFinite(value.netPnl)
      || !nullableNumber(value.initialRisk) || !nullableNumber(value.rMultiple)
      || typeof value.caption !== "string" || value.caption.length > 2_000 || /\u0000/.test(value.caption)
      || !time(value.observedAt)) {
    throw problem(400, "socials_invalid_request", "The Journal trade post is invalid.");
  }
  return Buffer.from(JSON.stringify({
    object: {
      objectType: "post",
      scope: "community",
      authorLabel: "Kwant Trader",
      payload: {
        kind: "TRADE",
        instrument: value.instrument,
        title: `${value.instrument} trade`,
        body: value.caption.trim(),
        context: "",
        condition: "",
        invalidation: "",
        relatedPrecordId: null,
        observedAt: new Date(value.observedAt).toISOString(),
        trade: {
          journalTradeId: value.journalTradeId,
          instrument: value.instrument,
          side: value.side,
          entryPrice: value.entryPrice,
          exitPrice: value.exitPrice,
          openedAt: new Date(value.openedAt).toISOString(),
          closedAt: value.closedAt === null ? null : new Date(value.closedAt).toISOString(),
          entryTimeKnown: value.entryTimeKnown,
          exitTimeKnown: value.exitTimeKnown,
          netPnl: value.netPnl,
          initialRisk: value.initialRisk,
          rMultiple: value.rMultiple,
        },
      },
    },
  }), "utf8");
}

function notificationMutationBody(value) {
  const action = typeof value.action === "string" ? value.action : "";
  const expectedKeys = action === "read" ? ["action", "ids"] : ["action"];
  const keys = Object.keys(value);
  if (!["read", "read-all"].includes(action)
      || keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    throw problem(400, "socials_invalid_request", "The SOCIALS notification request is invalid.");
  }
  if (action === "read") {
    if (!Array.isArray(value.ids) || value.ids.length < 1 || value.ids.length > 100
        || value.ids.some((id) => typeof id !== "string" || !UUID.test(id))
        || new Set(value.ids.map((id) => id.toLowerCase())).size !== value.ids.length) {
      throw problem(400, "socials_invalid_request", "The SOCIALS notification request is invalid.");
    }
    return Buffer.from(JSON.stringify({ action, ids: value.ids.map((id) => id.toLowerCase()) }), "utf8");
  }
  return Buffer.from(JSON.stringify({ action }), "utf8");
}

function gameplanExecutionBody(value) {
  const action = value.action;
  const planId = typeof value.planId === "string" ? value.planId : "";
  if (!IDENTIFIER.test(planId) || !["record-entry", "complete-trade"].includes(action)) {
    throw problem(400, "socials_invalid_request", "The GAMEPLAN execution request is invalid.");
  }
  if (action === "record-entry") {
    const expected = ["action", "planId", "actualDirection", "fills", "actualStop", "maximumActualRisk"];
    const keys = Object.keys(value);
    const finitePositiveOrNull = (item) => item === null || (typeof item === "number" && Number.isFinite(item) && item > 0);
    if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))
        || !["LONG", "SHORT"].includes(value.actualDirection)
        || !Array.isArray(value.fills) || value.fills.length < 1 || value.fills.length > 3
        || !finitePositiveOrNull(value.actualStop) || !finitePositiveOrNull(value.maximumActualRisk)) {
      throw problem(400, "socials_invalid_request", "The GAMEPLAN entry request is invalid.");
    }
    for (const fill of value.fills) {
      const fillKeys = fill && typeof fill === "object" && !Array.isArray(fill) ? Object.keys(fill) : [];
      if (!fill || typeof fill !== "object" || Array.isArray(fill)
          || fillKeys.length !== 3 || fillKeys.some((key) => !["price", "size", "time"].includes(key))
          || typeof fill.price !== "number" || !Number.isFinite(fill.price) || fill.price <= 0
          || !finitePositiveOrNull(fill.size)
          || typeof fill.time !== "string" || fill.time.length > 80 || !Number.isFinite(Date.parse(fill.time))) {
        throw problem(400, "socials_invalid_request", "The GAMEPLAN entry fill is invalid.");
      }
    }
    return Buffer.from(JSON.stringify(value), "utf8");
  }
  const expected = [
    "action", "planId", "outcome", "actualExit", "exitTime", "realisedPnl", "fees",
    "confirmationsAppeared", "deviationReason", "deviationDetail", "outcomeReview",
    "nextTimeRule", "partialExits",
  ];
  const keys = Object.keys(value);
  const textWithin = (name, maximum) => typeof value[name] === "string" && value[name].length <= maximum;
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))
      || !["TARGET HIT", "STOP HIT", "MANUAL EXIT", "BREAKEVEN"].includes(value.outcome)
      || typeof value.actualExit !== "number" || !Number.isFinite(value.actualExit) || value.actualExit <= 0
      || typeof value.exitTime !== "string" || value.exitTime.length > 80 || !Number.isFinite(Date.parse(value.exitTime))
      || typeof value.realisedPnl !== "number" || !Number.isFinite(value.realisedPnl)
      || !(value.fees === null || typeof value.fees === "number" && Number.isFinite(value.fees))
      || !textWithin("confirmationsAppeared", 1_500) || !textWithin("deviationReason", 120)
      || !textWithin("deviationDetail", 1_500) || !textWithin("outcomeReview", 2_000)
      || !textWithin("nextTimeRule", 1_500) || !textWithin("partialExits", 1_000)) {
    throw problem(400, "socials_invalid_request", "The GAMEPLAN outcome request is invalid.");
  }
  return Buffer.from(JSON.stringify(value), "utf8");
}

function gameplanScoreBody(value) {
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "planId" || typeof value.planId !== "string" || !IDENTIFIER.test(value.planId)) {
    throw problem(400, "socials_invalid_request", "The GAMEPLAN score request is invalid.");
  }
  return Buffer.from(JSON.stringify({ planId: value.planId }), "utf8");
}

function reactionMutationBody(value) {
  const targetUserId = typeof value.targetUserId === "string" ? value.targetUserId.toLowerCase() : "";
  const targetObjectId = typeof value.targetObjectId === "string" ? value.targetObjectId : "";
  const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey.toLowerCase() : "";
  const kind = typeof value.kind === "string" ? value.kind : "";
  const expectedKeys = kind === "POLL"
    ? ["idempotencyKey", "targetUserId", "targetObjectId", "kind", "enabled", "optionIndex"]
    : ["idempotencyKey", "targetUserId", "targetObjectId", "kind", "enabled"];
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))
      || !UUID.test(idempotencyKey) || !UUID.test(targetUserId) || !IDENTIFIER.test(targetObjectId)
      || !REACTION_KINDS.has(kind) || typeof value.enabled !== "boolean"
      || (kind === "POLL"
        ? !Number.isSafeInteger(value.optionIndex) || value.optionIndex < 0 || value.optionIndex > 5
        : value.optionIndex !== undefined)) {
    throw problem(400, "socials_invalid_request", "The SOCIALS reaction request is invalid.");
  }
  return Buffer.from(JSON.stringify({
    idempotencyKey,
    targetUserId,
    targetObjectId,
    kind,
    enabled: value.enabled,
    ...(kind === "POLL" ? { optionIndex: value.optionIndex } : {}),
  }), "utf8");
}

function normalizeOrigin(value) {
  if (!String(value || "").trim()) return "";
  let parsed;
  try { parsed = new URL(String(value).trim()); }
  catch { throw new Error("The SOCIALS service origin must be an absolute HTTP or HTTPS origin."); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password
      || parsed.search || parsed.hash || (parsed.pathname !== "/" && parsed.pathname !== "")) {
    throw new Error("The SOCIALS service origin must not contain credentials, a path, query, or fragment.");
  }
  return parsed.origin;
}

function problem(status, code, message) {
  return Object.assign(new Error(message), { socialsProblem: true, status, code });
}

export function socialsServiceProblem(error) {
  return error?.socialsProblem === true
    ? error
    : problem(502, "socials_unavailable", "SOCIALS is unavailable.");
}

export const socialsServiceProxyContract = Object.freeze({
  serviceTokenHeader: SERVICE_TOKEN_HEADER,
  subjectHeader: SUBJECT_HEADER,
  routes: Object.freeze(Object.fromEntries(ROUTES)),
  maximumQueryLength: MAX_QUERY_LENGTH,
  maximumQueryValueLength: MAX_QUERY_VALUE_LENGTH,
  maximumRequestBytes: MAX_REQUEST_BYTES,
  maximumResponseBytes: MAX_RESPONSE_BYTES,
  maximumFollowResponseBytes: MAX_FOLLOW_RESPONSE_BYTES,
  maximumReactionResponseBytes: MAX_REACTION_RESPONSE_BYTES,
  maximumNotificationsResponseBytes: MAX_NOTIFICATIONS_RESPONSE_BYTES,
  maximumGameplanResponseBytes: MAX_GAMEPLAN_RESPONSE_BYTES,
  maximumFriendsRequestBytes: MAX_FRIENDS_REQUEST_BYTES,
  maximumFriendsResponseBytes: MAX_FRIENDS_RESPONSE_BYTES,
  maximumFriendsEventBytes: MAX_FRIENDS_EVENT_BYTES,
  maximumFriendAvatarBytes: MAX_FRIEND_AVATAR_BYTES,
});
