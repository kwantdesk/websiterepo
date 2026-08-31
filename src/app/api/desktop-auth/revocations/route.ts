import type { NextRequest } from "next/server";

import { desktopAuthError, desktopAuthJson } from "@/lib/desktopAuthHttp.server.ts";
import { loadDesktopTicketSigningConfig } from "@/lib/desktopAuthProtocol.server.ts";
import {
  createDesktopRevocationSnapshot,
  isDesktopRevocationSyncAuthorized,
  loadDesktopRevocationSyncToken,
} from "@/lib/desktopAuthRevocations.server.ts";
import { createDesktopAuthStoreFromEnv } from "@/lib/desktopAuthStore.server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const syncToken = loadDesktopRevocationSyncToken();
    if (!syncToken) {
      return desktopAuthJson({ error: "authentication_service_unavailable" }, 503);
    }
    if (!isDesktopRevocationSyncAuthorized(request.headers.get("authorization"), syncToken)) {
      return desktopAuthJson({ error: "unauthorized" }, 401);
    }
    const store = createDesktopAuthStoreFromEnv();
    const signingConfig = loadDesktopTicketSigningConfig();
    if (!store || !signingConfig) {
      return desktopAuthJson({ error: "authentication_service_unavailable" }, 503);
    }
    return desktopAuthJson(await createDesktopRevocationSnapshot({
      store,
      signingConfig,
      signal: request.signal,
    }));
  } catch (error) {
    return desktopAuthError(error);
  }
}
