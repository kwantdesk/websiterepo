import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteActor } from "@/lib/serverAuth";
import {
  isZyonMarketRoot,
  type ZyonJournalEntry,
} from "@/lib/zyon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JournalRow = {
  id: string;
  session_date: string;
  root: string;
  title: string;
  summary: string;
  body: string;
  kind: ZyonJournalEntry["kind"];
  tags: string[] | null;
  attachments: ZyonJournalEntry["attachments"] | null;
  created_at: string;
};

function unavailableTable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function fromRow(row: JournalRow): ZyonJournalEntry | null {
  if (!isZyonMarketRoot(row.root)) return null;
  return {
    id: row.id,
    sessionDate: row.session_date,
    root: row.root,
    title: row.title,
    summary: row.summary,
    body: row.body,
    kind: row.kind,
    tags: Array.isArray(row.tags) ? row.tags : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    createdAt: row.created_at,
    cloudSaved: true,
  };
}

export async function GET(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { entries: [], cloud: false },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
  const { data, error } = await supabase
    .from("zyon_journal_entries")
    .select("id,session_date,root,title,summary,body,kind,tags,attachments,created_at")
    .eq("user_id", actor.userId)
    .order("created_at", { ascending: false })
    .limit(240);

  if (error) {
    if (unavailableTable(error.code)) {
      return NextResponse.json(
        { entries: [], cloud: false },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    console.error("ZYON journal load failed", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: "ZYON journal could not be loaded." }, { status: 502 });
  }

  const entries = (data as JournalRow[])
    .map(fromRow)
    .filter((entry): entry is ZyonJournalEntry => Boolean(entry));
  return NextResponse.json(
    { entries, cloud: true },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
