import type { NextRequest } from "next/server";
import {
  desktopAuthError,
  desktopAuthJson,
  loadDesktopAuthService,
  readDesktopAuthJson,
  requiredStringField,
} from "@/lib/desktopAuthHttp.server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const service = loadDesktopAuthService();
    if (!service) return desktopAuthJson({ error: "authentication_service_unavailable" }, 503);
    const body = await readDesktopAuthJson(request);
    const result = await service.exchange({
      authorizationCode: requiredStringField(body, "authorizationCode", 128),
      codeVerifier: requiredStringField(body, "codeVerifier", 128),
      redirectUri: requiredStringField(body, "redirectUri", 500),
    }, request.signal);
    return desktopAuthJson(result);
  } catch (error) {
    return desktopAuthError(error);
  }
}
