import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteActor } from "@/lib/serverAuth";
import {
  isZyonJournalAccountName,
  type JournalAccount,
  type JournalEvidence,
  type JournalImportBatch,
  type JournalTrade,
} from "@/lib/journal";

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

type EvidenceRow = {
  payload: JournalEvidence & { kind?: string };
};

type AccountStateRow = {
  payload: {
    kind?: unknown;
    accountId?: unknown;
    account?: unknown;
    archivedAt?: unknown;
  };
};

const JOURNAL_EVIDENCE_KIND = "journal-evidence-v1";
const JOURNAL_ACCOUNT_STATE_KIND = "journal-account-state-v1";
const JOURNAL_ANALYSIS_KIND = "journal-quant-analysis-v1";
const MAX_CLOUD_EVIDENCE_DATA_URL = 2_500_000;

function tableUnavailable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function cleanLongText(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, maximum)
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
  const accountSize = nullableFinite(trade.accountSize);
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
    stopPrice: nullableFinite(trade.stopPrice),
    targetPrice: nullableFinite(trade.targetPrice),
    plannedRiskReward: nullableFinite(trade.plannedRiskReward),
    grossPnl: finite(trade.grossPnl),
    fees: Math.max(0, finite(trade.fees)),
    feesKnown: typeof trade.feesKnown === "boolean" ? trade.feesKnown : undefined,
    netPnl: finite(trade.netPnl),
    initialRisk: nullableFinite(trade.initialRisk),
    rMultiple: nullableFinite(trade.rMultiple),
    durationMs: nullableFinite(trade.durationMs),
    setup: cleanText(trade.setup, 160),
    tags: Array.isArray(trade.tags) ? trade.tags.map((tag) => cleanText(tag, 48)).filter(Boolean).slice(0, 24) : [],
    notes: cleanLongText(trade.notes, 8_000),
    improvements: cleanLongText(trade.improvements, 8_000),
    contractClass: trade.contractClass === "MICRO" || trade.contractClass === "MINI" ? trade.contractClass : "OTHER",
    tradingAccountName: cleanText(trade.tradingAccountName, 120) || undefined,
    tradingAccountType: trade.tradingAccountType === "LIVE_CAPITAL" || trade.tradingAccountType === "EVALUATION" || trade.tradingAccountType === "FUNDED"
      ? trade.tradingAccountType
      : undefined,
    accountSize: accountSize === null ? null : Math.max(0, accountSize),
    rating: nullableFinite(trade.rating),
    reviewedAt: isoDate(trade.reviewedAt, null),
    sourceImportId: cleanId(trade.sourceImportId),
    sourceFile: cleanText(trade.sourceFile, 220),
    sourceSheet: cleanText(trade.sourceSheet, 120) || undefined,
    sourceRows: Array.isArray(trade.sourceRows)
      ? trade.sourceRows.map((row) => Math.max(0, Math.round(finite(row)))).slice(0, 200)
      : [],
    fingerprint: cleanId(trade.fingerprint, 120),
  };
}

function sanitizeEvidence(value: unknown, account: string): JournalEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<JournalEvidence>;
  const id = cleanId(item.id);
  const dataUrl = typeof item.dataUrl === "string" ? item.dataUrl.trim() : "";
  if (!id || !account || dataUrl.length > MAX_CLOUD_EVIDENCE_DATA_URL || !/^data:(?:image\/(?:jpeg|png|webp|gif)|text\/plain)[;,]/i.test(dataUrl)) return null;
  return {
    id,
    account,
    name: cleanText(item.name, 220) || "Journal evidence",
    mimeType: cleanText(item.mimeType, 80) || "application/octet-stream",
    size: Math.max(0, Math.round(finite(item.size))),
    importedAt: isoDate(item.importedAt, new Date().toISOString()) as string,
    sourceImportId: cleanId(item.sourceImportId),
    tradeId: cleanId(item.tradeId) || null,
    dataUrl,
    textContent: cleanText(item.textContent, 100_000) || undefined,
    caption: cleanText(item.caption, 2_000),
  };
}

function fromAccountRow(row: AccountRow, archivedAt?: string | null): JournalAccount {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: archivedAt ?? null,
  };
}

function sanitizeImport(value: unknown, account: string): JournalImportBatch | null {
  if (!value || typeof value !== "object") return null;
  const batch = value as Partial<JournalImportBatch>;
  const id = cleanId(batch.id);
  if (!id) return null;
  const allowedSchemas: JournalImportBatch["detectedSchema"][] = ["closed-trades", "executions", "workbook", "json", "evidence", "notes", "unknown"];
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

  const [accountResult, tradeResult, importResult, evidenceResult, accountStateResult] = await Promise.all([
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
    supabase
      .from("social_objects")
      .select("payload")
      .eq("user_id", actor.userId)
      .eq("object_type", "progress")
      .eq("payload->>kind", JOURNAL_EVIDENCE_KIND)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("social_objects")
      .select("payload")
      .eq("user_id", actor.userId)
      .eq("object_type", "progress")
      .eq("payload->>kind", JOURNAL_ACCOUNT_STATE_KIND)
      .limit(500),
  ]);

  const error = accountResult.error ?? tradeResult.error ?? importResult.error;
  if (error) {
    if (tableUnavailable(error.code)) {
      return NextResponse.json({ cloud: false, accounts: [], trades: [], imports: [] });
    }
    console.error("Journal load failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Journal could not be loaded." }, { status: 502 });
  }

  const archiveStates = new Map<string, string>();
  if (!accountStateResult.error) {
    for (const row of (accountStateResult.data ?? []) as AccountStateRow[]) {
      const id = cleanId(row.payload?.accountId);
      const archivedAt = isoDate(row.payload?.archivedAt, null);
      if (id && archivedAt) archiveStates.set(id, archivedAt);
    }
  }

  return NextResponse.json({
    cloud: true,
    accounts: ((accountResult.data ?? []) as AccountRow[]).map((row) => fromAccountRow(row, archiveStates.get(row.id))),
    trades: ((tradeResult.data ?? []) as TradeRow[]).map((row) => row.payload),
    imports: ((importResult.data ?? []) as ImportRow[]).map((row) => row.payload),
    evidence: evidenceResult.error
      ? []
      : ((evidenceResult.data ?? []) as EvidenceRow[]).map((row) => row.payload),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  const { actor, supabase } = await journalClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return NextResponse.json({ cloud: false, error: "Journal cloud storage is unavailable." }, { status: 503 });

  let body: { action?: unknown; account?: unknown; trades?: unknown; imports?: unknown; trade?: unknown; evidence?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Journal data could not be read." }, { status: 400 });
  }

  const action = cleanText(body.action, 20);
  if (action === "archive-account" || action === "restore-account" || action === "delete-account") {
    const account = cleanText(body.account, 80);
    if (!account || isZyonJournalAccountName(account)) {
      return NextResponse.json({ error: "Choose a custom Journal account." }, { status: 400 });
    }
    const id = accountId(account);
    const { data: accountRow, error: accountError } = await supabase
      .from("journal_accounts")
      .select("id,name,source,created_at,updated_at")
      .eq("user_id", actor.userId)
      .eq("id", id)
      .maybeSingle();
    if (accountError) return NextResponse.json({ error: "The Journal account could not be checked." }, { status: 502 });
    if (!accountRow) return NextResponse.json({ error: "That Journal account no longer exists." }, { status: 404 });
    const storedAccount = accountRow as AccountRow;
    const stateId = `journal-account-state:${id}`;

    if (action === "archive-account") {
      const archivedAt = new Date().toISOString();
      const { error } = await supabase.from("social_objects").upsert({
        user_id: actor.userId,
        id: stateId,
        author_label: actor.label,
        object_type: "progress",
        scope: "private",
        desk_id: null,
        parent_id: null,
        payload: {
          kind: JOURNAL_ACCOUNT_STATE_KIND,
          accountId: id,
          account: storedAccount.name,
          archivedAt,
        },
        updated_at: archivedAt,
      }, { onConflict: "user_id,id" });
      if (error) return NextResponse.json({ error: "The Journal could not be archived." }, { status: 502 });
      return NextResponse.json({ cloud: true, account: fromAccountRow(storedAccount, archivedAt) });
    }

    if (action === "restore-account") {
      const { error } = await supabase
        .from("social_objects")
        .delete()
        .eq("user_id", actor.userId)
        .eq("id", stateId);
      if (error) return NextResponse.json({ error: "The Journal could not be restored." }, { status: 502 });
      return NextResponse.json({ cloud: true, account: fromAccountRow(storedAccount, null) });
    }

    const evidenceDelete = await supabase
      .from("social_objects")
      .delete()
      .eq("user_id", actor.userId)
      .eq("payload->>kind", JOURNAL_EVIDENCE_KIND)
      .eq("payload->>account", storedAccount.name);
    if (evidenceDelete.error) return NextResponse.json({ error: "Journal evidence could not be removed." }, { status: 502 });
    const analysisDelete = await supabase
      .from("social_objects")
      .delete()
      .eq("user_id", actor.userId)
      .eq("payload->>kind", JOURNAL_ANALYSIS_KIND)
      .eq("payload->>account", storedAccount.name);
    if (analysisDelete.error) return NextResponse.json({ error: "Journal analysis could not be removed." }, { status: 502 });
    const stateDelete = await supabase
      .from("social_objects")
      .delete()
      .eq("user_id", actor.userId)
      .eq("id", stateId);
    if (stateDelete.error) return NextResponse.json({ error: "Journal archive state could not be removed." }, { status: 502 });
    const accountDelete = await supabase
      .from("journal_accounts")
      .delete()
      .eq("user_id", actor.userId)
      .eq("id", id);
    if (accountDelete.error) return NextResponse.json({ error: "The Journal could not be deleted." }, { status: 502 });
    return NextResponse.json({ cloud: true, deleted: storedAccount.name });
  }

  if (action === "create-account") {
    const account = cleanText(body.account, 80);
    if (!account || isZyonJournalAccountName(account)) {
      return NextResponse.json({ error: "Choose a unique KwantDesk Journal name." }, { status: 400 });
    }
    const { data: existingAccounts, error: existingError } = await supabase
      .from("journal_accounts")
      .select("id,name,source,created_at,updated_at")
      .eq("user_id", actor.userId)
      .limit(500);
    if (existingError) return NextResponse.json({ error: "Journal accounts could not be checked." }, { status: 502 });
    const normalized = account.normalize("NFKC").trim().toLowerCase();
    if (((existingAccounts ?? []) as AccountRow[]).some((row) => row.name.normalize("NFKC").trim().toLowerCase() === normalized)) {
      return NextResponse.json({ error: "A Journal with that name already exists." }, { status: 409 });
    }
    const now = new Date().toISOString();
    const row = { user_id: actor.userId, id: accountId(account), name: account, source: "manual", created_at: now, updated_at: now };
    const { data, error } = await supabase
      .from("journal_accounts")
      .insert(row)
      .select("id,name,source,created_at,updated_at")
      .single();
    if (error) return NextResponse.json({ error: "The KwantDesk Journal could not be created." }, { status: 502 });
    return NextResponse.json({ cloud: true, account: fromAccountRow(data as AccountRow) });
  }

  if (action === "create-trade") {
    const account = cleanText(body.account, 80);
    const trade = sanitizeTrade(body.trade, account);
    if (!account || isZyonJournalAccountName(account) || !trade || !trade.sourceImportId.startsWith("manual:")) {
      return NextResponse.json({ error: "Complete the required manual trade details." }, { status: 400 });
    }
    const accountKey = accountId(account);
    const { data: accountRow, error: accountError } = await supabase
      .from("journal_accounts")
      .select("id,source")
      .eq("user_id", actor.userId)
      .eq("id", accountKey)
      .maybeSingle();
    if (accountError || !accountRow || accountRow.source !== "manual") {
      return NextResponse.json({ error: "Choose a native KwantDesk Journal account." }, { status: 400 });
    }
    const { error } = await supabase.from("journal_trades").upsert({
      user_id: actor.userId,
      id: trade.id,
      account_id: accountKey,
      source_import_id: trade.sourceImportId,
      opened_at: trade.openedAt,
      closed_at: trade.closedAt,
      payload: trade,
    }, { onConflict: "user_id,id" });
    if (error) return NextResponse.json({ error: "The manual trade could not be saved." }, { status: 502 });
    return NextResponse.json({ cloud: true, trade });
  }

  if (action === "save-evidence") {
    const account = cleanText(body.account, 80);
    const evidence = sanitizeEvidence(body.evidence, account);
    if (!evidence || isZyonJournalAccountName(account)) {
      return NextResponse.json({ error: "That evidence file could not be saved." }, { status: 400 });
    }
    const payload = { ...evidence, kind: JOURNAL_EVIDENCE_KIND };
    if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 2_850_000) {
      return NextResponse.json({ error: "Compress this evidence image before saving it." }, { status: 413 });
    }
    const { error } = await supabase.from("social_objects").upsert({
      user_id: actor.userId,
      id: `journal-evidence:${evidence.id}`,
      author_label: actor.label,
      object_type: "progress",
      scope: "private",
      desk_id: null,
      parent_id: evidence.tradeId,
      payload,
      updated_at: evidence.importedAt,
    }, { onConflict: "user_id,id" });
    if (error) return NextResponse.json({ error: "Journal evidence could not be saved." }, { status: 502 });
    return NextResponse.json({ cloud: true, evidence });
  }

  if (action === "update") {
    const sourceTrade = body.trade as Partial<JournalTrade> | null;
    const account = cleanText(sourceTrade?.account, 80);
    const trade = sanitizeTrade(sourceTrade, account);
    if (!account || isZyonJournalAccountName(account) || !trade || trade.sourceImportId.startsWith("zyon:")) {
      return NextResponse.json({ error: "Choose a custom Journal trade." }, { status: 400 });
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
  if (!account || isZyonJournalAccountName(account)) return NextResponse.json({ error: "Choose a custom account name." }, { status: 400 });
  const id = accountId(account);
  const trades = (Array.isArray(body.trades) ? body.trades : [])
    .map((trade) => sanitizeTrade(trade, account))
    .filter((trade): trade is JournalTrade => Boolean(trade))
    .slice(0, 5_000);
  const imports = (Array.isArray(body.imports) ? body.imports : [])
    .map((batch) => sanitizeImport(batch, account))
    .filter((batch): batch is JournalImportBatch => Boolean(batch))
    .slice(0, 200);

  const { data: currentAccount, error: currentAccountError } = await supabase
    .from("journal_accounts")
    .select("source")
    .eq("user_id", actor.userId)
    .eq("id", id)
    .maybeSingle();
  if (currentAccountError) {
    if (tableUnavailable(currentAccountError.code)) return NextResponse.json({ cloud: false }, { status: 503 });
    return NextResponse.json({ error: "Journal account could not be checked." }, { status: 502 });
  }
  const source = currentAccount?.source === "manual" ? "manual" : "import";
  const { error: accountError } = await supabase
    .from("journal_accounts")
    .upsert({ user_id: actor.userId, id, name: account, source }, { onConflict: "user_id,id" });
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
  const evidenceId = cleanId(request.nextUrl.searchParams.get("evidenceId"));
  if (evidenceId) {
    const { error } = await supabase
      .from("social_objects")
      .delete()
      .eq("user_id", actor.userId)
      .eq("id", `journal-evidence:${evidenceId}`);
    if (error) return NextResponse.json({ error: "Journal evidence could not be removed." }, { status: 502 });
    return NextResponse.json({ cloud: true });
  }
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
