import { NextResponse } from "next/server";

const WAITLIST_TABLE = "waitlist_signups";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const dynamic = "force-dynamic";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? ""
  ).trim();
  return url && key ? { url, key } : null;
}

export async function POST(request: Request) {
  let body: { email?: unknown; website?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json(
      { error: "The waitlist is temporarily unavailable." },
      { status: 503 },
    );
  }

  const response = await fetch(`${config.url}/rest/v1/${WAITLIST_TABLE}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      email,
      source: "kwantdesk-holding-page",
    }),
    cache: "no-store",
  });

  if (response.ok) {
    return NextResponse.json({ ok: true });
  }

  const error = await response.json().catch(() => null) as { code?: string } | null;
  if (response.status === 409 && error?.code === "23505") {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "The waitlist is temporarily unavailable." },
    { status: 503 },
  );
}
