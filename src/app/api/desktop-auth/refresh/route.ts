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
    return desktopAuthJson(await service.refresh(
      requiredStringField(body, "refreshHandle", 128),
      request.signal,
    ));
  } catch (error) {
    return desktopAuthError(error);
  }
}
