import { NextRequest, NextResponse } from "next/server";
import { getNewsRouteActor } from "@/lib/serverAuth";
import { fetchInstitutionalMarketData } from "@/lib/institutionalMarketData.server";
import { financialInfoUnavailable, parseFinancialInfo, type FinancialInfoPayload } from "@/lib/financialInfo";
import { conditionalJson } from "@/lib/conditionalJson";

export const runtime = "nodejs";
export const maxDuration = 30;
let cached: { value: FinancialInfoPayload; expires: number } | null = null;
let pending: Promise<FinancialInfoPayload> | null = null;
async function sharedSnapshot() {
  if (cached && cached.expires > Date.now()) return cached.value;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetchInstitutionalMarketData("v1/financial-info", { method: "GET" }, 12_000);
      if (!response || (!response.ok && response.status !== 404)) throw Error("News unavailable");
      const value = response.status === 404 ? financialInfoUnavailable() : parseFinancialInfo(await response.json());
      cached = { value, expires: Date.now() + 60_000 };
      return value;
    } catch {
      const value = cached ? { ...cached.value, status: "unavailable" as const, stale: true, note: "Connection unavailable. Showing the last received headlines." } : financialInfoUnavailable(true);
      cached = { value, expires: Date.now() + 60_000 };
      return value;
    } finally { pending = null; }
  })();
  return pending;
}
export async function GET(request: NextRequest) {
  const actor = await getNewsRouteActor(request);
  if (!actor || (process.env.VERCEL && actor.mode === "local-dev")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (request.nextUrl.search) return NextResponse.json({ error: "Unsupported parameter." }, { status: 400 });
  const value = await sharedSnapshot();
  return conditionalJson(request, value, { identity: JSON.stringify(value), maxAgeMs: 60_000 });
}
