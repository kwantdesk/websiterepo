import type { NextRequest } from "next/server";
import { parseDesktopAuthorizationRequest } from "@/lib/desktopAuthProtocol.server.ts";
import {
  desktopAuthError,
  desktopAuthJson,
  isSameOriginConsent,
  loadDesktopAuthService,
  readDesktopAuthJson,
} from "@/lib/desktopAuthHttp.server.ts";
import { getRouteActor } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginConsent(request)) {
      return desktopAuthJson({ error: "invalid_origin" }, 403);
    }
    const actor = await getRouteActor(request);
    if (!actor || actor.mode !== "supabase") {
      return desktopAuthJson({ error: "authentication_required" }, 401);
    }
    const service = loadDesktopAuthService();
    if (!service) return desktopAuthJson({ error: "authentication_service_unavailable" }, 503);

    const body = await readDesktopAuthJson(request);
    const result = await service.authorize(actor.userId, parseDesktopAuthorizationRequest(body), request.signal);
    return desktopAuthJson(result);
  } catch (error) {
    return desktopAuthError(error);
  }
}
