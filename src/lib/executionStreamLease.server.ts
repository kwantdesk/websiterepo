import "server-only";
import { marketDataGatewayToken, marketDataGatewayUrlCandidatesForPath } from "./marketDataGatewayEnv";
import { signBrowserStreamTicket } from "./browserStreamTicket";

/** Negotiate on the authenticated site; open EventSource at the VPS directly.
 * Cross-origin redirects can taint Origin to null, which the edge must reject. */
export function executionStreamLeaseResponse(request: Request, path: string, search: string): Response | null {
  const query = new URLSearchParams(search);
  if (query.get("streamLease") !== "1" || path !== "/v1/market-data/trades") return null;
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  try {
    if (marketDataGatewayUrlCandidatesForPath(path)[0] !== "https://feed.kwantdesk.com") throw Error("Unverified edge");
    query.delete("streamLease");
    const now = Date.now();
    const ticket = signBrowserStreamTicket({ key: marketDataGatewayToken(),
      origin: new URL(request.url).origin, path, search: "?" + query.toString(), now });
    const destination = new URL("https://feed.kwantdesk.com/browser-stream");
    destination.searchParams.set("ticket", ticket);
    return Response.json({ url: destination.href, expiresAt: (Math.floor(now / 1000) + 300) * 1000,
      transport: "direct-vps" }, { headers });
  } catch {
    return Response.json({ error: "The execution stream is unavailable." }, { status: 503, headers });
  }
}
