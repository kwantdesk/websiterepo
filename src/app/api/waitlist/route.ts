import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const supabase = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { error } = await supabase
    .from(WAITLIST_TABLE)
    .insert({
      email,
      source: "kwantdesk-holding-page",
    });

  if (!error || error.code === "23505") {
    return NextResponse.json({ ok: true });
  }

  console.error("Waitlist signup failed", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  return NextResponse.json(
    { error: "The waitlist is temporarily unavailable." },
    { status: 503 },
  );
}
