import {
  marketDataGatewayToken,
  marketDataGatewayUrlCandidates,
} from "@/lib/marketDataGatewayEnv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const token = marketDataGatewayToken();
  const origins = token ? marketDataGatewayUrlCandidates() : [];
  if (!token || !origins.length) {
    return new Response("The VPS market-data gateway is not configured.", { status: 503 });
  }

  const incoming = new URL(request.url);
  const search = new URLSearchParams();
  search.set("symbols", incoming.searchParams.get("symbols") || "");
  search.set("priority", incoming.searchParams.get("priority") || "");
  let lastStatus = 503;

  for (const origin of origins) {
    try {
      const upstream = await fetch(`${origin}/v1/market-data/quotes?${search}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        cache: "no-store",
        signal: request.signal,
      });
      lastStatus = upstream.status;
      if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel().catch(() => undefined);
        continue;
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "X-KwantDesk-Market-Transport": "vps-rithmic",
        },
      });
    } catch (error) {
      if (request.signal.aborted) throw error;
    }
  }

  return new Response("The VPS live market stream is unavailable.", { status: lastStatus });
}
