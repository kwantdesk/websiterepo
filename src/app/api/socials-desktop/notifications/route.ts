import { NextResponse, type NextRequest } from "next/server";

import { getSocialsRouteActor } from "@/lib/serverAuth";
import {
  createSocialsNotificationsServiceFromEnv,
  SocialsNotificationsError,
} from "@/lib/socialsNotifications.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_REQUEST_BYTES = 16 * 1024;

export async function GET(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return response({ error: "Authentication required.", code: "socials_unauthorized" }, 401);
  try {
    requireExactQuery(request, ["offset", "limit"]);
    return response(await createSocialsNotificationsServiceFromEnv().page(
      actor.userId,
      request.nextUrl.searchParams.get("offset"),
      request.nextUrl.searchParams.get("limit"),
    ), 200);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return response({ error: "Authentication required.", code: "socials_unauthorized" }, 401);
  try {
    requireExactQuery(request, []);
    const mediaType = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (mediaType !== "application/json") {
      throw invalid("The SOCIALS notification request must be JSON.");
    }
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAXIMUM_REQUEST_BYTES) {
      throw new SocialsNotificationsError(
        "socials_notification_request_too_large", 413, "The SOCIALS notification request is too large.",
      );
    }
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_REQUEST_BYTES) {
      throw bytes.byteLength > MAXIMUM_REQUEST_BYTES
        ? new SocialsNotificationsError(
            "socials_notification_request_too_large", 413, "The SOCIALS notification request is too large.",
          )
        : invalid("The SOCIALS notification request is required.");
    }
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw invalid("The SOCIALS notification request is invalid."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw invalid("The SOCIALS notification request is invalid.");
    }
    const record = body as Record<string, unknown>;
    const action = typeof record.action === "string" ? record.action.trim().toLowerCase() : "";
    const expected = action === "read" ? ["action", "ids"] : ["action"];
    const keys = Object.keys(record);
    if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
      throw invalid("The SOCIALS notification request is invalid.");
    }
    return response(await createSocialsNotificationsServiceFromEnv().mark(actor.userId, {
      action,
      ids: action === "read" ? record.ids : [],
    }), 200);
  } catch (error) {
    return failure(error);
  }
}

function requireExactQuery(request: NextRequest, keys: readonly string[]) {
  const actual = [...request.nextUrl.searchParams.keys()];
  const allowed = new Set(keys);
  if (actual.length !== keys.length
      || actual.some((key) => !allowed.has(key) || request.nextUrl.searchParams.getAll(key).length !== 1)) {
    throw new SocialsNotificationsError(
      "socials_invalid_notification_query", 400, "The SOCIALS notification query is invalid.",
    );
  }
}

function invalid(message: string) {
  return new SocialsNotificationsError("socials_invalid_notification_request", 400, message);
}

function failure(error: unknown) {
  const problem = error instanceof SocialsNotificationsError
    ? error
    : new SocialsNotificationsError(
        "socials_notifications_unavailable", 502, "SOCIALS notifications are unavailable.",
      );
  return response({ error: problem.message, code: problem.code }, problem.status);
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
