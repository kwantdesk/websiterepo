import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getEconomicCalendar } from "@/lib/economicCalendar.server";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) return true;

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
  if (!(await isAuthenticated(request))) {
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
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Economic calendar could not be loaded." },
      { status: 502 },
    );
  }
}
