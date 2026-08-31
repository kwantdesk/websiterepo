import { desktopTicketPublicJwk, loadDesktopTicketSigningConfig } from "@/lib/desktopAuthProtocol.server.ts";
import { desktopAuthJson } from "@/lib/desktopAuthHttp.server.ts";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = loadDesktopTicketSigningConfig();
    if (!config) return desktopAuthJson({ error: "authentication_service_unavailable" }, 503);
    return Response.json({ keys: [desktopTicketPublicJwk(config)] }, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return desktopAuthJson({ error: "authentication_service_unavailable" }, 503);
  }
}
