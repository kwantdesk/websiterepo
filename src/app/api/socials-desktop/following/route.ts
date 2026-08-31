import { NextResponse, type NextRequest } from "next/server";
import { getSocialsRouteActor } from "@/lib/serverAuth";
import {
  createSocialsFollowServiceFromEnv,
  SocialsFollowError,
} from "@/lib/socialsFollow.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return response({ error: "Authentication required.", code: "socials_unauthorized" }, 401);
  try {
    if ([...request.nextUrl.searchParams.keys()].length !== 0) {
      throw new SocialsFollowError("socials_invalid_follow_request", 400, "The SOCIALS following query is invalid.");
    }
    return response(await createSocialsFollowServiceFromEnv().following(actor.userId), 200);
  } catch (error) {
    const problem = error instanceof SocialsFollowError
      ? error
      : new SocialsFollowError("socials_follow_unavailable", 502, "SOCIALS following information is unavailable.");
    return response({ error: problem.message, code: problem.code }, problem.status);
  }
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
