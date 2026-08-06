import { NextRequest, NextResponse } from "next/server";

import { getGexBotFlowSnapshot } from "@/lib/gexBotFlow.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("refresh") === "1";
  const payload = await getGexBotFlowSnapshot(Date.now(), force);
  return NextResponse.json(payload, {
    status: payload.ok ? 200 : 503,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie",
    },
  });
}
