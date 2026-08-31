import { NextResponse, type NextRequest } from "next/server";
import { getSocialsRouteActor } from "@/lib/serverAuth";
import {
  createSocialsFollowServiceFromEnv,
  SocialsFollowError,
} from "@/lib/socialsFollow.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_REQUEST_BYTES = 16 * 1024;

export async function GET(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return response({ error: "Authentication required.", code: "socials_unauthorized" }, 401);
  try {
    requireExactQuery(request, ["targetUserId"]);
    return response(
      await createSocialsFollowServiceFromEnv().summary(
        actor.userId,
        request.nextUrl.searchParams.get("targetUserId") ?? "",
      ),
      200,
    );
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
      throw new SocialsFollowError("socials_invalid_follow_request", 400, "The SOCIALS follow request must be JSON.");
    }
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAXIMUM_REQUEST_BYTES) {
      throw new SocialsFollowError("socials_follow_request_too_large", 413, "The SOCIALS follow request is too large.");
    }
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_REQUEST_BYTES) {
      throw new SocialsFollowError(
        bytes.byteLength > MAXIMUM_REQUEST_BYTES ? "socials_follow_request_too_large" : "socials_invalid_follow_request",
        bytes.byteLength > MAXIMUM_REQUEST_BYTES ? 413 : 400,
        bytes.byteLength > MAXIMUM_REQUEST_BYTES ? "The SOCIALS follow request is too large." : "The SOCIALS follow request is required.",
      );
    }
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new SocialsFollowError("socials_invalid_follow_request", 400, "The SOCIALS follow request is invalid."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new SocialsFollowError("socials_invalid_follow_request", 400, "The SOCIALS follow request is invalid.");
    }
    requireExactMutationShape(body as Record<string, unknown>);
    return response(
      await createSocialsFollowServiceFromEnv().mutate(actor.userId, body as {
        idempotencyKey: unknown;
        action: unknown;
        targetUserId: unknown;
        enabled?: unknown;
      }),
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

function requireExactQuery(request: NextRequest, keys: readonly string[]) {
  const allowed = new Set(keys);
  const actual = [...request.nextUrl.searchParams.keys()];
  if (actual.length !== keys.length
      || actual.some((key) => !allowed.has(key) || request.nextUrl.searchParams.getAll(key).length !== 1)) {
    throw new SocialsFollowError("socials_invalid_follow_request", 400, "The SOCIALS follow query is invalid.");
  }
}

function requireExactMutationShape(body: Record<string, unknown>) {
  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
  const allowed = new Set(action === "notifications"
    ? ["idempotencyKey", "action", "targetUserId", "enabled"]
    : ["idempotencyKey", "action", "targetUserId"]);
  const actual = Object.keys(body);
  if (actual.length !== allowed.size || actual.some((key) => !allowed.has(key))) {
    throw new SocialsFollowError("socials_invalid_follow_request", 400, "The SOCIALS follow request is invalid.");
  }
}

function failure(error: unknown) {
  const problem = error instanceof SocialsFollowError
    ? error
    : new SocialsFollowError("socials_follow_unavailable", 502, "SOCIALS follow information is unavailable.");
  return response({ error: problem.message, code: problem.code }, problem.status);
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
