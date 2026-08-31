import { NextResponse, type NextRequest } from "next/server";
import { getSocialsRouteActor } from "@/lib/serverAuth";
import {
  createSocialsReactionServiceFromEnv,
  SocialsReactionError,
} from "@/lib/socialsReaction.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_REQUEST_BYTES = 16 * 1024;

export async function GET(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return response({ error: "Authentication required.", code: "socials_unauthorized" }, 401);
  try {
    requireExactQuery(request, ["targetUserId", "targetObjectId", "kind"]);
    return response(await createSocialsReactionServiceFromEnv().summary(actor.userId, {
      targetUserId: request.nextUrl.searchParams.get("targetUserId"),
      targetObjectId: request.nextUrl.searchParams.get("targetObjectId"),
      kind: request.nextUrl.searchParams.get("kind"),
    }), 200);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return response({ error: "Authentication required.", code: "socials_unauthorized" }, 401);
  try {
    requireExactQuery(request, []);
    const mediaType = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (mediaType !== "application/json") {
      throw new SocialsReactionError("socials_invalid_reaction_request", 400, "The SOCIALS reaction request must be JSON.");
    }
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAXIMUM_REQUEST_BYTES) {
      throw new SocialsReactionError("socials_reaction_request_too_large", 413, "The SOCIALS reaction request is too large.");
    }
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_REQUEST_BYTES) {
      throw new SocialsReactionError(
        bytes.byteLength > MAXIMUM_REQUEST_BYTES ? "socials_reaction_request_too_large" : "socials_invalid_reaction_request",
        bytes.byteLength > MAXIMUM_REQUEST_BYTES ? 413 : 400,
        bytes.byteLength > MAXIMUM_REQUEST_BYTES ? "The SOCIALS reaction request is too large." : "The SOCIALS reaction request is required.",
      );
    }
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new SocialsReactionError("socials_invalid_reaction_request", 400, "The SOCIALS reaction request is invalid."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new SocialsReactionError("socials_invalid_reaction_request", 400, "The SOCIALS reaction request is invalid.");
    }
    requireExactMutationShape(body as Record<string, unknown>);
    return response(await createSocialsReactionServiceFromEnv().mutate(actor.userId, body as {
      idempotencyKey: unknown;
      targetUserId: unknown;
      targetObjectId: unknown;
      kind: unknown;
      enabled: unknown;
      optionIndex?: unknown;
    }), 200);
  } catch (error) {
    return failure(error);
  }
}

function requireExactQuery(request: NextRequest, keys: readonly string[]) {
  const allowed = new Set(keys);
  const actual = [...request.nextUrl.searchParams.keys()];
  if (actual.length !== keys.length
      || actual.some((key) => !allowed.has(key) || request.nextUrl.searchParams.getAll(key).length !== 1)) {
    throw new SocialsReactionError("socials_invalid_reaction_request", 400, "The SOCIALS reaction query is invalid.");
  }
}

function requireExactMutationShape(body: Record<string, unknown>) {
  const kind = typeof body.kind === "string" ? body.kind.trim().toUpperCase() : "";
  const allowed = new Set(kind === "POLL"
    ? ["idempotencyKey", "targetUserId", "targetObjectId", "kind", "enabled", "optionIndex"]
    : ["idempotencyKey", "targetUserId", "targetObjectId", "kind", "enabled"]);
  const actual = Object.keys(body);
  if (actual.length !== allowed.size || actual.some((key) => !allowed.has(key))) {
    throw new SocialsReactionError("socials_invalid_reaction_request", 400, "The SOCIALS reaction request is invalid.");
  }
}

function failure(error: unknown) {
  const problem = error instanceof SocialsReactionError
    ? error
    : new SocialsReactionError("socials_reaction_unavailable", 502, "SOCIALS reaction information is unavailable.");
  return response({ error: problem.message, code: problem.code }, problem.status);
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
