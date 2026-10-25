import "server-only";
import { marketDataGatewayToken, marketDataGatewayUrlCandidatesForPath } from "./marketDataGatewayEnv";
import { signBrowserStreamTicket } from "./browserStreamTicket";

/** Existing middleware still authenticates the original same-origin route. */
export function directBrowserStreamResponse(request: Request, path: string, search: string): Response | null {
  // Large archive JSON is a new, finite read contract, independent of the
  // existing live-SSE rollout flag. Never proxy those bodies through Vercel.
  // Disabling replay delivery fails closed; it does not enable a paid fallback.
  const replayRead = path === "/v1/heatmap/replay" || path === "/v1/heatmap/replay/chunk";
  if (!replayRead && process.env.KWANTDESK_BROWSER_STREAM_DIRECT !== "true") return null;
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  try {
    if (replayRead && process.env.KWANTDESK_BROWSER_REPLAY_DIRECT === "false") throw new Error("Replay edge disabled.");
    const origin = marketDataGatewayUrlCandidatesForPath(path)[0];
    // This production rollout is deliberately pinned to our verified TLS edge.
    if (origin !== "https://feed.kwantdesk.com") throw new Error("Unverified stream edge.");
    const ticket = signBrowserStreamTicket({
      key: marketDataGatewayToken(), origin: new URL(request.url).origin, path, search,
    });
    const destination = new URL("/browser-stream", origin);
    destination.searchParams.set("ticket", ticket);
    return new Response(null, { status: 307, headers: {
      ...headers, Location: destination.href, "X-KwantDesk-Market-Transport": "direct-vps",
    } });
  } catch {
    // No hidden continuous Vercel fallback when direct mode is selected.
    return Response.json({ error: "The live market stream is unavailable." }, { status: 503, headers });
  }
}
