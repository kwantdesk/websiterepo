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
    await service.revoke(requiredStringField(body, "refreshHandle", 128), request.signal);
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return desktopAuthError(error);
  }
}
