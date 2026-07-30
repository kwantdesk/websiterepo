import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteActor } from "@/lib/serverAuth";
import type { JournalImportBatch, JournalTrade } from "@/lib/journal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AccountRow = {
  id: string;
  name: string;
  source: "import" | "manual";
  created_at: string;
  updated_at: string;
};

type TradeRow = {
  payload: JournalTrade;
};

type ImportRow = {
  payload: JournalImportBatch;
};

function tableUnavailable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function cleanId(value: unknown, maximum = 180) {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9:_.-]/g, "").slice(0, maximum)
    : "";
}

function accountId(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52) || "imported-account";
  let hash = 2_166_136_261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `import:${slug}:${(hash >>> 0).toString(36)}`;
}

function finite(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableFinite(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoDate(value: unknown, fallback: string | null) {
  if (typeof value !== "string") return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function sanitizeTrade(value: unknown, account: string): JournalTrade | null {
  if (!value || typeof value !== "object") return null;
  const trade = value as Partial<JournalTrade>;
  const id = cleanId(trade.id);
  const openedAt = isoDate(trade.openedAt, null);
  const symbol = cleanText(trade.symbol, 32).toUpperCase();
  if (!id || !openedAt || !symbol) return null;
  const side = trade.side === "LONG" || trade.side === "SHORT" ? trade.side : "UNKNOWN";
  return {
    id,
    account,
    openedAt,
    closedAt: isoDate(trade.closedAt, null),
    symbol,
    side,
    quantity: Math.max(0, finite(trade.quantity, 1)),
    entryPrice: nullableFinite(trade.entryPrice),
    exitPrice: nullableFinite(trade.exitPrice),
    grossPnl: finite(trade.grossPnl),
    fees: Math.max(0, finite(trade.fees)),
    netPnl: finite(trade.netPnl),
    initialRisk: nullableFinite(trade.initialRisk),
    rMultiple: nullableFinite(trade.rMultiple),
    durationMs: nullableFinite(trade.durationMs),
    setup: cleanText(trade.setup, 160),
    tags: Array.isArray(trade.tags) ? trade.tags.map((tag) => cleanText(tag, 48)).filter(Boolean).slice(0, 24) : [],
    notes: cleanText(trade.notes, 8_000),
    rating: nullableFinite(trade.rating),
    reviewedAt: isoDate(trade.reviewedAt, null),
    sourceImportId: cleanId(trade.sourceImportId),
    sourceFile: cleanText(trade.sourceFile, 220),
    sourceRows: Array.isArray(trade.sourceRows)
      ? trade.sourceRows.map((row) => Math.max(0, Math.round(finite(row)))).slice(0, 200)
      : [],
    fingerprint: cleanId(trade.fingerprint, 120),
  };
}

function sanitizeImport(value: unknown, account: string): JournalImportBatch | null {
  if (!value || typeof value !== "object") return null;
  const batch = value as Partial<JournalImportBatch>;
  const id = cleanId(batch.id);
  if (!id) return null;
  const allowedSchemas: JournalImportBatch["detectedSchema"][] = ["closed-trades", "executions", "json", "evidence", "notes", "unknown"];
  return {
    id,
    account,
    fileName: cleanText(batch.fileName, 220),
    fileType: cleanText(batch.fileType, 80),
    fileSize: Math.max(0, Math.round(finite(batch.fileSize))),
    importedAt: isoDate(batch.importedAt, new Date().toISOString()) as string,
    detectedSchema: allowedSchemas.includes(batch.detectedSchema as JournalImportBatch["detectedSchema"])
      ? batch.detectedSchema as JournalImportBatch["detectedSchema"]
      : "unknown",
    sourceRows: Math.max(0, Math.round(finite(batch.sourceRows))),
    acceptedTrades: Math.max(0, Math.round(finite(batch.acceptedTrades))),
    rejectedRows: Math.max(0, Math.round(finite(batch.rejectedRows))),
    duplicateTrades: Math.max(0, Math.round(finite(batch.duplicateTrades))),
    evidenceCount: Math.max(0, Math.round(finite(batch.evidenceCount))),
    warnings: Array.isArray(batch.warnings) ? batch.warnings.map((warning) => cleanText(warning, 500)).filter(Boolean).slice(0, 40) : [],
  };
}

async function journalClient(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) return { actor: null, supabase: null };
  try {
    return { actor, supabase: await createSupabaseServerClient() };
  } catch {
    return { actor, supabase: null };
  }
}

export async function GET(request: NextRequest) {
  const { actor, supabase } = await journalClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return NextResponse.json({ cloud: false, accounts: [], trades: [], imports: [] });

  const [accountResult, tradeResult, importResult] = await Promise.all([
    supabase
      .from("journal_accounts")
      .select("id,name,source,created_at,updated_at")
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("journal_trades")
      .select("payload")
      .eq("user_id", actor.userId)
      .order("opened_at", { ascending: false })
      .limit(20_000),
    supabase
      .from("journal_imports")
      .select("payload")
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: false })
      .limit(2_000),
  ]);

  const error = accountResult.error ?? tradeResult.error ?? importResult.error;
  if (error) {
    if (tableUnavailable(error.code)) {
      return NextResponse.json({ cloud: false, accounts: [], trades: [], imports: [] });
    }
    console.error("Journal load failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Journal could not be loaded." }, { status: 502 });
  }

  return NextResponse.json({
    cloud: true,
    accounts: (accountResult.data ?? []) as AccountRow[],
    trades: ((tradeResult.data ?? []) as TradeRow[]).map((row) => row.payload),
    imports: ((importResult.data ?? []) as ImportRow[]).map((row) => row.payload),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  const { actor, supabase } = await journalClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return NextResponse.json({ cloud: false, error: "Journal cloud storage is unavailable." }, { status: 503 });

  let body: { action?: unknown; account?: unknown; trades?: unknown; imports?: unknown; trade?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Journal data could not be read." }, { status: 400 });
  }

  const action = cleanText(body.action, 20);
  if (action === "update") {
    const sourceTrade = body.trade as Partial<JournalTrade> | null;
    const account = cleanText(sourceTrade?.account, 80);
    const trade = sanitizeTrade(sourceTrade, account);
    if (!account || !trade || trade.sourceImportId.startsWith("zyon:")) {
      return NextResponse.json({ error: "Choose an imported Journal trade." }, { status: 400 });
    }
    const { error } = await supabase
      .from("journal_trades")
      .update({
        opened_at: trade.openedAt,
        closed_at: trade.closedAt,
        payload: trade,
      })
      .eq("user_id", actor.userId)
      .eq("id", trade.id);
    if (error) {
      if (tableUnavailable(error.code)) return NextResponse.json({ cloud: false }, { status: 503 });
      return NextResponse.json({ error: "Journal trade could not be updated." }, { status: 502 });
    }
    return NextResponse.json({ cloud: true });
  }

  if (action !== "sync") return NextResponse.json({ error: "Unsupported Journal action." }, { status: 400 });
  const account = cleanText(body.account, 80);
  if (!account || account === "ZYON Journal") return NextResponse.json({ error: "Choose a custom account name." }, { status: 400 });
  const id = accountId(account);
  const trades = (Array.isArray(body.trades) ? body.trades : [])
    .map((trade) => sanitizeTrade(trade, account))
    .filter((trade): trade is JournalTrade => Boolean(trade))
    .slice(0, 5_000);
  const imports = (Array.isArray(body.imports) ? body.imports : [])
    .map((batch) => sanitizeImport(batch, account))
    .filter((batch): batch is JournalImportBatch => Boolean(batch))
    .slice(0, 200);

  const { error: accountError } = await supabase
    .from("journal_accounts")
    .upsert({ user_id: actor.userId, id, name: account, source: "import" }, { onConflict: "user_id,id" });
  if (accountError) {
    if (tableUnavailable(accountError.code)) return NextResponse.json({ cloud: false }, { status: 503 });
    return NextResponse.json({ error: "Journal account could not be saved." }, { status: 502 });
  }

  for (let offset = 0; offset < trades.length; offset += 500) {
    const rows = trades.slice(offset, offset + 500).map((trade) => ({
      user_id: actor.userId,
      id: trade.id,
      account_id: id,
      source_import_id: trade.sourceImportId,
      opened_at: trade.openedAt,
      closed_at: trade.closedAt,
      payload: trade,
    }));
    const { error } = await supabase.from("journal_trades").upsert(rows, { onConflict: "user_id,id" });
    if (error) return NextResponse.json({ error: "Imported trades could not be saved." }, { status: 502 });
  }

  if (imports.length) {
    const rows = imports.map((batch) => ({
      user_id: actor.userId,
      id: batch.id,
      account_id: id,
      payload: batch,
      created_at: batch.importedAt,
    }));
    const { error } = await supabase.from("journal_imports").upsert(rows, { onConflict: "user_id,id" });
    if (error) return NextResponse.json({ error: "Import history could not be saved." }, { status: 502 });
  }

  return NextResponse.json({ cloud: true, accountId: id, trades: trades.length, imports: imports.length });
}

export async function DELETE(request: NextRequest) {
  const { actor, supabase } = await journalClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return NextResponse.json({ cloud: false }, { status: 503 });
  const importId = cleanId(request.nextUrl.searchParams.get("importId"));
  if (!importId) return NextResponse.json({ error: "Choose an import to remove." }, { status: 400 });

  const tradeDelete = await supabase
    .from("journal_trades")
    .delete()
    .eq("user_id", actor.userId)
    .eq("source_import_id", importId);
  if (tradeDelete.error) return NextResponse.json({ error: "Imported trades could not be removed." }, { status: 502 });
  const importDelete = await supabase
    .from("journal_imports")
    .delete()
    .eq("user_id", actor.userId)
    .eq("id", importId);
  if (importDelete.error) return NextResponse.json({ error: "Import history could not be removed." }, { status: 502 });
  return NextResponse.json({ cloud: true });
}
