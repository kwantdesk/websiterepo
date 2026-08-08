// Provider-neutral public route for chart history. Some browser privacy lists
// block URLs containing vendor names even when the request is first-party,
// which left the chart with cached OHLC but no historical execution tape.
// Keep the original route as a backwards-compatible internal alias.
import { GET as getCmeHistory } from "@/app/api/databento/market/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "iad1";

export async function GET(request: Request) {
  return getCmeHistory(request);
}
