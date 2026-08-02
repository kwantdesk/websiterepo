import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  getConfiguredQuantDataApiKey,
  getGexDeskHistory,
  getGexDeskReplaySessionDates,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import { createGexDeskHistoryFixture } from "@/lib/gexDesk";

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) {
    return true;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined,
    },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source") ?? "COMBINED";
  const instrument = request.nextUrl.searchParams.get("instrument") ?? "NQ";
  const scope = request.nextUrl.searchParams.get("scope") ?? "history";
  const sessionDate = request.nextUrl.searchParams.get("sessionDate") ?? undefined;
  if (!getConfiguredQuantDataApiKey()) {
    if (
      process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
      && ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)
    ) {
      if (scope === "sessions") {
        const latest = new Date();
        const dates: string[] = [];
        while (dates.length < 5) {
          const day = latest.getUTCDay();
          if (day !== 0 && day !== 6) dates.unshift(latest.toISOString().slice(0, 10));
          latest.setUTCDate(latest.getUTCDate() - 1);
        }
        return NextResponse.json({ sessionDates: dates }, {
          headers: { "Cache-Control": "private, no-store, max-age=0" },
        });
      }
      const fixture = createGexDeskHistoryFixture(source, instrument);
      const requestedDate = sessionDate && /^\d{4}-\d{2}-\d{2}$/.test(sessionDate) ? sessionDate : fixture.sessionDate;
      const timestampShift = Date.parse(`${requestedDate}T00:00:00Z`) - Date.parse(`${fixture.sessionDate}T00:00:00Z`);
      return NextResponse.json({
        ...fixture,
        sessionDate: requestedDate,
        asOf: new Date(Date.parse(fixture.asOf) + timestampShift).toISOString(),
        status: requestedDate === fixture.sessionDate ? fixture.status : "LAST_SESSION",
        timestamps: fixture.timestamps.map((timestamp) => timestamp + timestampShift),
      }, {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    return NextResponse.json({ error: "Gexdesk history is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const payload = scope === "sessions"
      ? { sessionDates: await getGexDeskReplaySessionDates(5) }
      : await getGexDeskHistory(source, instrument, sessionDate);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message, rateLimitRemaining: problem.remaining },
      { status: problem.status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
