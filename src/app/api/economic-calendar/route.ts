import { NextRequest, NextResponse } from "next/server";
import { getEconomicCalendar } from "@/lib/economicCalendar.server";
import { getNewsRouteActor } from "@/lib/serverAuth";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  if (!(await getNewsRouteActor(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const from = request.nextUrl.searchParams.get("from") || today;
  const to = request.nextUrl.searchParams.get("to") || from;
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return NextResponse.json({ error: "Invalid calendar date." }, { status: 400 });
  }
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T23:59:59Z`);
  const span = end.getTime() - start.getTime();
  if (Number.isNaN(span) || span < 0 || span > 120 * 86_400_000) {
    return NextResponse.json({ error: "Calendar range must be between 1 and 120 days." }, { status: 400 });
  }

  try {
    const payload = await getEconomicCalendar(from, to);
    const browserMaxAge = Math.max(60, Math.min(300, Math.round(payload.refreshAfterMs / 1_000)));
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `private, max-age=${browserMaxAge}, stale-while-revalidate=900`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Economic calendar could not be loaded." },
      { status: 502 },
    );
  }
}
