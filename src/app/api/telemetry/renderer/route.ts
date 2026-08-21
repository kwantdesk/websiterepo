import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Receives the final health snapshot of a session that ended in a renderer
 * crash ("Aw, Snap"). The snapshot lands in the function log so crashes leave
 * server-side evidence — heap, worst main-thread stall, page and uptime in
 * the tab's final five seconds — instead of vanishing with the tab.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    if (body.length > 4_096) {
      return NextResponse.json({ error: "Snapshot too large." }, { status: 413 });
    }
    const snapshot = JSON.parse(body) as Record<string, unknown>;
    // A stall is reported by the health worker FROM ITS OWN THREAD while the
    // page is still wedged, so it arrives during the freeze rather than after
    // a recovery that may never come. Tagged separately because a stall is a
    // live symptom, whereas a crash report is always about a session that is
    // already gone.
    if (snapshot.kind === "stall") {
      // eslint-disable-next-line no-console
      console.error("[renderer-stall]", JSON.stringify({
        url: snapshot.url,
        ongoingGapMs: snapshot.ongoingGapMs,
        heapUsedMB: snapshot.heapUsedMB,
        heapLimitMB: snapshot.heapLimitMB,
        uptimeSeconds: snapshot.uptimeSeconds,
        userAgent: request.headers.get("user-agent") ?? undefined,
      }));
      return new NextResponse(null, { status: 204 });
    }
    // eslint-disable-next-line no-console
    console.error("[renderer-crash]", JSON.stringify({
      at: snapshot.at,
      url: snapshot.url,
      uptimeSeconds: snapshot.uptimeSeconds,
      heapUsedMB: snapshot.heapUsedMB,
      heapLimitMB: snapshot.heapLimitMB,
      worstLagMs: snapshot.worstLagMs,
      longTasks: snapshot.longTasks,
      longestTaskMs: snapshot.longestTaskMs,
      domNodes: snapshot.domNodes,
      userAgent: request.headers.get("user-agent") ?? undefined,
    }));
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Invalid snapshot." }, { status: 400 });
  }
}
