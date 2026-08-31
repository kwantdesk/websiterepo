import { NextResponse, type NextRequest } from "next/server";
import { getSocialsRouteActor } from "@/lib/serverAuth";
import { createSocialsReadServiceFromEnv, SocialsReadError } from "@/lib/socialsRead.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await getSocialsRouteActor(request);
  if (!actor) return response({ error: "Authentication required.", code: "socials_unauthorized" }, 401);
  try {
    return response(
      await createSocialsReadServiceFromEnv().profile(actor.userId, request.nextUrl.searchParams.get("handle") ?? ""),
      200,
    );
  } catch (error) {
    const failure = error instanceof SocialsReadError
      ? error
      : new SocialsReadError("socials_unavailable", 502, "SOCIALS is unavailable.");
    return response({ error: failure.message, code: failure.code }, failure.status);
  }
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
