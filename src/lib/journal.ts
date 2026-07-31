import { zyonTradingAccountLabel } from "@/lib/zyon";

export const ZYON_JOURNAL_ACCOUNT = "ZYON Journal";

export function isZyonJournalAccountName(value: unknown) {
  return typeof value === "string"
    && value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase() === ZYON_JOURNAL_ACCOUNT.toLowerCase();
}

export type JournalSide = "LONG" | "SHORT" | "UNKNOWN";

export type JournalTrade = {
  id: string;
  account: string;
  openedAt: string;
  closedAt: string | null;
  symbol: string;
  side: JournalSide;
  quantity: number;
  entryPrice: number | null;
  exitPrice: number | null;
  grossPnl: number;
  fees: number;
  netPnl: number;
  initialRisk: number | null;
  rMultiple: number | null;
  durationMs: number | null;
  setup: string;
  tags: string[];
  notes: string;
  improvements?: string;
  contractClass?: "MICRO" | "MINI" | "OTHER";
  rating: number | null;
  reviewedAt: string | null;
  sourceImportId: string;
  sourceFile: string;
  sourceSheet?: string;
  sourceRows: number[];
  fingerprint: string;
};

export type JournalAccount = {
  id: string;
  name: string;
  source: "import" | "manual";
  createdAt: string;
  updatedAt: string;
};

type ZyonSocialRecord = {
  id: string;
  userId: string;
  objectType: string;
  parentId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type JournalEvidence = {
  id: string;
  account: string;
  name: string;
  mimeType: string;
  size: number;
  importedAt: string;
  sourceImportId: string;
  tradeId: string | null;
  dataUrl: string;
  textContent?: string;
  caption: string;
};

export type JournalImportBatch = {
  id: string;
  account: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  importedAt: string;
  detectedSchema: "closed-trades" | "executions" | "workbook" | "json" | "evidence" | "notes" | "unknown";
  sourceRows: number;
  acceptedTrades: number;
  rejectedRows: number;
  duplicateTrades: number;
  evidenceCount: number;
  warnings: string[];
};

export type JournalState = {
  version: 1;
  accounts: JournalAccount[];
  trades: JournalTrade[];
  evidence: JournalEvidence[];
  imports: JournalImportBatch[];
};

export type JournalParseResult = {
  trades: JournalTrade[];
  detectedSchema: JournalImportBatch["detectedSchema"];
  sourceRows: number;
  rejectedRows: number;
  warnings: string[];
};

export type JournalStats = {
  tradeCount: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  averageR: number | null;
  maxDrawdown: number;
  reviewedCount: number;
  reviewedPercent: number | null;
  evidenceLinkedCount: number;
  bestTrade: number | null;
  worstTrade: number | null;
  currentStreak: number;
  currentStreakKind: "WIN" | "LOSS" | "NONE";
};

const HEADER_ALIASES = {
  openedAt: ["openedat", "opentime", "entrytime", "datetime", "dateandtime", "timestamp", "timeopened", "entrydate"],
  closedAt: ["closedat", "closetime", "exittime", "timeclosed", "exitdate"],
  date: ["date", "tradedate", "filldate", "executedate"],
  time: ["time", "tradetime", "filltime", "executiontime", "updatedatetimee", "updatedatetimel"],
  symbol: ["symbol", "instrument", "ticker", "contract", "market", "tradingsymbol"],
  side: ["side", "direction", "buysell", "action", "actiontype", "type", "ordertype"],
  quantity: ["quantity", "qty", "qtyfilled", "filledqty", "size", "positionsize", "positionqty", "contracts", "volume", "shares"],
  entryPrice: ["entryprice", "entry", "openprice", "averageentryprice", "avgentryprice", "buyprice"],
  exitPrice: ["exitprice", "exit", "closeprice", "averageexitprice", "avgexitprice", "sellprice"],
  price: ["price", "fillprice", "executionprice", "averageprice", "avgprice"],
  grossPnl: ["grosspnl", "grosspnlusd", "grossprofit", "grossprofitusd", "profitloss", "pnl", "pnlusd", "pl", "realizedpnl", "realizedpnlusd", "realizedpl", "profit", "profitusd"],
  netPnl: ["netpnl", "netpnlusd", "netprofit", "netprofitusd", "netpl", "netplusd", "netprofitloss"],
  fees: ["fees", "fee", "commission", "commissions", "totalfees", "brokerage"],
  initialRisk: ["initialrisk", "risk", "riskamount", "plannedrisk"],
  rMultiple: ["rmultiple", "realizedr", "r", "resultinr"],
  setup: ["setup", "strategy", "playbook", "tradetype", "pattern", "signal"],
  tags: ["tags", "tag", "mistakes", "labels"],
  notes: ["notes", "note", "comment", "comments", "description"],
  rating: ["rating", "traderating", "grade"],
} as const;

const TRADINGVIEW_ALIASES = {
  tradeNumber: ["tradeno", "tradenumber", "tradeid"],
  tradeType: ["type", "tradetype", "entryexit"],
  signal: ["signal", "order", "ordername"],
} as const;

const FUTURES_MULTIPLIERS: Record<string, number> = {
  ES: 50,
  MES: 5,
  NQ: 20,
  MNQ: 2,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 5,
  CL: 1_000,
  MCL: 100,
  GC: 100,
  MGC: 10,
  SI: 5_000,
  SIL: 1_000,
  HG: 25_000,
  NG: 10_000,
  ZB: 1_000,
  ZN: 1_000,
  ZF: 1_000,
  ZT: 2_000,
  "6E": 125_000,
  "6B": 62_500,
  "6J": 12_500_000,
  "6A": 100_000,
  "6C": 100_000,
};

export const EMPTY_JOURNAL_STATE: JournalState = {
  version: 1,
  accounts: [],
  trades: [],
  evidence: [],
  imports: [],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function headerMatches(header: string, aliases: readonly string[]) {
  return aliases.some((alias) => header === alias || header.startsWith(`${alias}usd`) || header.startsWith(`${alias}aud`));
}

export function journalHeaderScore(cells: unknown[]) {
  const headers = cells.map((cell) => normalizeHeader(String(cell ?? ""))).filter(Boolean);
  const has = (aliases: readonly string[]) => headers.some((header) => headerMatches(header, aliases));
  let score = 0;
  if (has(HEADER_ALIASES.symbol)) score += 3;
  if (has(HEADER_ALIASES.openedAt) || has(HEADER_ALIASES.date)) score += 3;
  if (has(HEADER_ALIASES.entryPrice) || has(HEADER_ALIASES.exitPrice) || has(HEADER_ALIASES.price)) score += 2;
  if (has(HEADER_ALIASES.grossPnl) || has(HEADER_ALIASES.netPnl)) score += 2;
  if (has(HEADER_ALIASES.side) || has(TRADINGVIEW_ALIASES.tradeType)) score += 1;
  if (has(HEADER_ALIASES.quantity)) score += 1;
  if (has(TRADINGVIEW_ALIASES.tradeNumber)) score += 3;
  return score;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text);
  const normalized = text.replace(/[,$£€¥%\s()]/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

function parseDateValue(value: unknown) {
  if (typeof value === "number" && value > 20_000 && value < 100_000) {
    const excelDate = new Date(Math.round((value - 25_569) * 86_400_000));
    return Number.isNaN(excelDate.getTime()) ? null : excelDate.toISOString();
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();

  const dayFirst = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(.+))?$/);
  if (!dayFirst) return null;
  const year = dayFirst[3].length === 2 ? 2_000 + Number(dayFirst[3]) : Number(dayFirst[3]);
  const first = Number(dayFirst[1]);
  const second = Number(dayFirst[2]);
  const month = first > 12 ? second : first;
  const day = first > 12 ? first : second;
  const fallback = Date.parse(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${dayFirst[4] || "00:00:00"}`);
  return Number.isNaN(fallback) ? null : new Date(fallback).toISOString();
}

function valueFor(row: Record<string, unknown>, aliases: readonly string[]) {
  for (const alias of aliases) {
    if (alias in row && String(row[alias] ?? "").trim() !== "") return row[alias];
  }
  return null;
}

function dateFromRow(row: Record<string, unknown>, directAliases: readonly string[], fallbackToDate = true) {
  const direct = valueFor(row, directAliases);
  if (direct !== null) return parseDateValue(direct);
  if (!fallbackToDate) return null;
  const date = valueFor(row, HEADER_ALIASES.date);
  const time = valueFor(row, HEADER_ALIASES.time);
  if (date === null) return null;
  return parseDateValue(`${String(date)}${time === null ? "" : ` ${String(time)}`}`);
}

function parseSide(value: unknown): JournalSide {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["LONG", "BUY", "B", "BOT", "BUYTOOPEN", "BUY TO OPEN"].includes(normalized)) return "LONG";
  if (["SHORT", "SELL", "S", "SLD", "SELLTOOPEN", "SELL TO OPEN"].includes(normalized)) return "SHORT";
  return "UNKNOWN";
}

function parseTags(value: unknown) {
  return [...new Set(String(value ?? "")
    .split(/[|;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean))].slice(0, 24);
}

function symbolRoot(symbol: string) {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const known = Object.keys(FUTURES_MULTIPLIERS).sort((left, right) => right.length - left.length);
  return known.find((root) => normalized.startsWith(root)) ?? normalized.replace(/[FGHJKMNQUVXZ]\d{1,4}$/i, "");
}

function contractMultiplier(symbol: string) {
  return FUTURES_MULTIPLIERS[symbolRoot(symbol)] ?? 1;
}

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hashText(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export function journalTradeFingerprint(trade: Pick<JournalTrade, "openedAt" | "closedAt" | "symbol" | "side" | "quantity" | "entryPrice" | "exitPrice" | "netPnl">) {
  return hashText([
    trade.openedAt,
    trade.closedAt ?? "",
    trade.symbol.toUpperCase(),
    trade.side,
    trade.quantity.toFixed(8),
    trade.entryPrice?.toFixed(8) ?? "",
    trade.exitPrice?.toFixed(8) ?? "",
    trade.netPnl.toFixed(8),
  ].join("|"));
}

export function zyonOutcomesToJournalTrades(records: ZyonSocialRecord[], viewerId: string) {
  const precards = new Map(
    records
      .filter((record) => record.userId === viewerId && record.objectType === "precord")
      .filter((record) => String(record.payload.source ?? "").toUpperCase() === "ZYON")
      .map((record) => [record.id, record]),
  );

  return records
    .filter((record) => record.userId === viewerId && record.objectType === "receipt" && record.parentId && precards.has(record.parentId))
    .map((receipt) => {
      const precord = precards.get(receipt.parentId as string);
      if (!precord) return null;

      const planned = precord.payload;
      const outcome = receipt.payload;
      const path = recordObject(outcome.pathMetrics);
      const scores = recordObject(outcome.scores);
      const assessment = recordObject(outcome.assessment);
      const directionText = String(outcome.actualDirection ?? planned.direction ?? "").toUpperCase();
      const side: JournalSide = directionText === "LONG" || directionText === "SHORT" ? directionText : "UNKNOWN";
      const symbol = String(planned.instrument ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
      const entryPrice = finiteNumber(outcome.actualEntry) ?? finiteNumber(path.entryPrice);
      const exitPrice = finiteNumber(outcome.actualExit) ?? finiteNumber(path.exitPrice);
      const quantity = Math.abs(finiteNumber(outcome.size) ?? finiteNumber(planned.plannedSize) ?? 1);
      const fees = Math.abs(finiteNumber(outcome.fees) ?? 0);
      const noTrade = Boolean(outcome.noTrade);
      const direction = side === "SHORT" ? -1 : 1;
      const grossPnl = !noTrade && entryPrice !== null && exitPrice !== null
        ? (exitPrice - entryPrice) * quantity * contractMultiplier(symbol) * direction
        : 0;
      const netPnl = grossPnl - fees;
      const riskUnit = String(planned.riskUnit ?? "").toUpperCase();
      const maximumActualRisk = finiteNumber(outcome.maximumActualRisk);
      const plannedRisk = riskUnit === "DOLLARS" ? finiteNumber(planned.maximumRisk) : null;
      const pathRiskPoints = finiteNumber(path.riskPoints);
      const calculatedRisk = pathRiskPoints !== null
        ? pathRiskPoints * quantity * contractMultiplier(symbol)
        : null;
      const initialRisk = maximumActualRisk ?? plannedRisk ?? calculatedRisk;
      const explicitR = finiteNumber(path.realisedR);
      const rMultiple = explicitR ?? (initialRisk && initialRisk > 0 ? netPnl / initialRisk : null);
      const openedAt = String(outcome.entryTime ?? path.entryTime ?? planned.plannedEntryTime ?? precord.createdAt);
      const closedAt = String(outcome.exitTime ?? path.exitTime ?? outcome.addedAt ?? receipt.updatedAt);
      const openedTime = Date.parse(openedAt);
      const closedTime = Date.parse(closedAt);
      const durationSeconds = finiteNumber(path.durationSeconds);
      const durationMs = durationSeconds !== null
        ? Math.max(0, durationSeconds * 1_000)
        : Number.isFinite(openedTime) && Number.isFinite(closedTime)
          ? Math.max(0, closedTime - openedTime)
          : null;
      const reasoningScore = finiteNumber(scores.final);
      const classification = String(outcome.classification ?? assessment.classification ?? "").trim();
      const tradingAccount = zyonTradingAccountLabel(planned.tradingAccount);
      const hasTradingAccount = tradingAccount !== "Account not set";
      const notes = [
        hasTradingAccount ? `Trading account: ${tradingAccount}` : "",
        String(outcome.outcomeReview ?? "").trim(),
        String(outcome.nextTimeRule ?? "").trim() ? `Next time: ${String(outcome.nextTimeRule).trim()}` : "",
        String(assessment.explanation ?? "").trim(),
      ].filter(Boolean).join("\n\n");

      const base: Omit<JournalTrade, "id" | "fingerprint"> = {
        account: "ZYON Journal",
        openedAt: Number.isNaN(Date.parse(openedAt)) ? precord.createdAt : openedAt,
        closedAt: Number.isNaN(Date.parse(closedAt)) ? receipt.updatedAt : closedAt,
        symbol,
        side,
        quantity: noTrade ? 0 : quantity,
        entryPrice: noTrade ? null : entryPrice,
        exitPrice: noTrade ? null : exitPrice,
        grossPnl,
        fees,
        netPnl,
        initialRisk: initialRisk !== null && initialRisk > 0 ? initialRisk : null,
        rMultiple,
        durationMs,
        setup: noTrade
          ? `ZYON · ${hasTradingAccount ? `${tradingAccount} · ` : ""}No trade`
          : `ZYON Gameplan${hasTradingAccount ? ` · ${tradingAccount}` : ""}`,
        tags: [...new Set(["ZYON", hasTradingAccount ? tradingAccount : "", String(planned.session ?? "").trim(), classification].filter(Boolean))],
        notes,
        rating: reasoningScore === null ? null : Math.max(1, Math.min(5, Math.round(reasoningScore / 20))),
        reviewedAt: String(outcome.addedAt ?? receipt.updatedAt),
        sourceImportId: `zyon:${precord.id}`,
        sourceFile: "ZYON Gameplan outcome",
        sourceRows: [],
      };
      const fingerprint = journalTradeFingerprint(base);
      return {
        ...base,
        id: `zyon:${precord.id}`,
        fingerprint,
      } satisfies JournalTrade;
    })
    .filter((trade): trade is JournalTrade => Boolean(trade))
    .sort((left, right) => Date.parse(right.closedAt ?? right.openedAt) - Date.parse(left.closedAt ?? left.openedAt));
}

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return rows.map((source) => Object.fromEntries(
    Object.entries(source).map(([key, value]) => [normalizeHeader(key), value]),
  ));
}

export function parseDelimited(text: string, delimiter?: string) {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const selectedDelimiter = delimiter ?? [
    { delimiter: "\t", score: (firstLine.match(/\t/g) ?? []).length },
    { delimiter: ",", score: (firstLine.match(/,/g) ?? []).length },
    { delimiter: ";", score: (firstLine.match(/;/g) ?? []).length },
  ].sort((left, right) => right.score - left.score)[0].delimiter;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < clean.length; index += 1) {
    const character = clean[index];
    const next = clean[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === selectedDelimiter) {
      row.push(field.trim());
      field = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += character;
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(
    headers.map((header, index) => [header || `column_${index + 1}`, cells[index] ?? ""]),
  ));
}

export type JournalParseOptions = {
  sourceSheet?: string;
  sourceRowNumbers?: number[];
  symbolFallback?: string;
};

function sourceRowNumber(options: JournalParseOptions, index: number) {
  return options.sourceRowNumbers?.[index] ?? index + 2;
}

function parseClosedTrades(
  rows: Array<Record<string, unknown>>,
  account: string,
  importId: string,
  fileName: string,
  options: JournalParseOptions = {},
) {
  const trades: JournalTrade[] = [];
  const warnings: string[] = [];
  let rejectedRows = 0;

  rows.forEach((row, index) => {
    const openedAt = dateFromRow(row, HEADER_ALIASES.openedAt);
    const closedAt = dateFromRow(row, HEADER_ALIASES.closedAt, false);
    const symbol = String(valueFor(row, HEADER_ALIASES.symbol) ?? options.symbolFallback ?? "").trim().toUpperCase();
    const side = parseSide(valueFor(row, HEADER_ALIASES.side));
    const quantity = Math.abs(parseNumber(valueFor(row, HEADER_ALIASES.quantity)) ?? 1);
    const entryPrice = parseNumber(valueFor(row, HEADER_ALIASES.entryPrice));
    const exitPrice = parseNumber(valueFor(row, HEADER_ALIASES.exitPrice));
    const explicitGross = parseNumber(valueFor(row, HEADER_ALIASES.grossPnl));
    const explicitNet = parseNumber(valueFor(row, HEADER_ALIASES.netPnl));
    const fees = Math.abs(parseNumber(valueFor(row, HEADER_ALIASES.fees)) ?? 0);

    if (!openedAt || !symbol || (explicitGross === null && explicitNet === null && (entryPrice === null || exitPrice === null))) {
      rejectedRows += 1;
      return;
    }

    const direction = side === "SHORT" ? -1 : 1;
    const calculatedGross = entryPrice !== null && exitPrice !== null
      ? (exitPrice - entryPrice) * quantity * contractMultiplier(symbol) * direction
      : 0;
    const grossPnl = explicitGross ?? (explicitNet !== null ? explicitNet + fees : calculatedGross);
    const netPnl = explicitNet ?? grossPnl - fees;
    const initialRisk = parseNumber(valueFor(row, HEADER_ALIASES.initialRisk));
    const explicitR = parseNumber(valueFor(row, HEADER_ALIASES.rMultiple));
    const rMultiple = explicitR ?? (initialRisk && initialRisk > 0 ? netPnl / initialRisk : null);
    const ratingValue = parseNumber(valueFor(row, HEADER_ALIASES.rating));

    const base: Omit<JournalTrade, "id" | "fingerprint"> = {
      account,
      openedAt,
      closedAt,
      symbol,
      side,
      quantity,
      entryPrice,
      exitPrice,
      grossPnl,
      fees,
      netPnl,
      initialRisk: initialRisk !== null && initialRisk > 0 ? initialRisk : null,
      rMultiple,
      durationMs: closedAt ? Math.max(0, Date.parse(closedAt) - Date.parse(openedAt)) : null,
      setup: String(valueFor(row, HEADER_ALIASES.setup) ?? "").trim(),
      tags: parseTags(valueFor(row, HEADER_ALIASES.tags)),
      notes: String(valueFor(row, HEADER_ALIASES.notes) ?? "").trim(),
      rating: ratingValue === null ? null : Math.min(5, Math.max(1, Math.round(ratingValue))),
      reviewedAt: null,
      sourceImportId: importId,
      sourceFile: fileName,
      sourceSheet: options.sourceSheet,
      sourceRows: [sourceRowNumber(options, index)],
    };
    const fingerprint = journalTradeFingerprint(base);
    trades.push({ ...base, id: `${importId}-${index + 1}-${fingerprint}`, fingerprint });
  });

  if (rejectedRows) warnings.push(`${rejectedRows} row${rejectedRows === 1 ? "" : "s"} could not be converted because required trade fields were missing.`);
  return { trades, rejectedRows, warnings };
}

type OpenExecutionPosition = {
  symbol: string;
  account: string;
  signedQuantity: number;
  openedQuantity: number;
  averagePrice: number;
  openedAt: string;
  fees: number;
  realizedGross: number;
  sourceRows: number[];
};

function parseExecutions(
  rows: Array<Record<string, unknown>>,
  account: string,
  importId: string,
  fileName: string,
  options: JournalParseOptions = {},
) {
  const executions = rows.flatMap((row, index) => {
    const timestamp = dateFromRow(row, HEADER_ALIASES.openedAt);
    const symbol = String(valueFor(row, HEADER_ALIASES.symbol) ?? options.symbolFallback ?? "").trim().toUpperCase();
    const side = parseSide(valueFor(row, HEADER_ALIASES.side));
    const quantity = Math.abs(parseNumber(valueFor(row, HEADER_ALIASES.quantity)) ?? 0);
    const price = parseNumber(valueFor(row, HEADER_ALIASES.price) ?? valueFor(row, HEADER_ALIASES.entryPrice));
    const fees = Math.abs(parseNumber(valueFor(row, HEADER_ALIASES.fees)) ?? 0);
    if (!timestamp || !symbol || side === "UNKNOWN" || !quantity || price === null) return [];
    return [{ timestamp, symbol, side, quantity, price, fees, rowNumber: sourceRowNumber(options, index) }];
  }).sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

  const positions = new Map<string, OpenExecutionPosition>();
  const trades: JournalTrade[] = [];

  for (const execution of executions) {
    let remaining = execution.quantity;
    const direction = execution.side === "LONG" ? 1 : -1;
    let position = positions.get(execution.symbol);

    if (!position || position.signedQuantity === 0 || Math.sign(position.signedQuantity) === direction) {
      const existingQuantity = Math.abs(position?.signedQuantity ?? 0);
      const nextQuantity = existingQuantity + remaining;
      positions.set(execution.symbol, {
        symbol: execution.symbol,
        account,
        signedQuantity: nextQuantity * direction,
        openedQuantity: (position?.openedQuantity ?? 0) + remaining,
        averagePrice: nextQuantity
          ? ((position?.averagePrice ?? 0) * existingQuantity + execution.price * remaining) / nextQuantity
          : execution.price,
        openedAt: position?.openedAt ?? execution.timestamp,
        fees: (position?.fees ?? 0) + execution.fees,
        realizedGross: position?.realizedGross ?? 0,
        sourceRows: [...(position?.sourceRows ?? []), execution.rowNumber],
      });
      continue;
    }

    while (position && remaining > 0 && Math.sign(position.signedQuantity) !== direction) {
      const positionDirection = Math.sign(position.signedQuantity);
      const openQuantity = Math.abs(position.signedQuantity);
      const closingQuantity = Math.min(openQuantity, remaining);
      const gross = (execution.price - position.averagePrice)
        * closingQuantity
        * contractMultiplier(execution.symbol)
        * positionDirection;
      const allocatedFee = execution.fees * (closingQuantity / execution.quantity);
      const nextOpenQuantity = openQuantity - closingQuantity;
      position.realizedGross += gross;
      position.fees += allocatedFee;
      position.sourceRows.push(execution.rowNumber);
      remaining -= closingQuantity;

      if (nextOpenQuantity <= 1e-10) {
        const base: Omit<JournalTrade, "id" | "fingerprint"> = {
          account,
          openedAt: position.openedAt,
          closedAt: execution.timestamp,
          symbol: execution.symbol,
          side: positionDirection > 0 ? "LONG" : "SHORT",
          quantity: position.openedQuantity,
          entryPrice: position.averagePrice,
          exitPrice: execution.price,
          grossPnl: position.realizedGross,
          fees: position.fees,
          netPnl: position.realizedGross - position.fees,
          initialRisk: null,
          rMultiple: null,
          durationMs: Math.max(0, Date.parse(execution.timestamp) - Date.parse(position.openedAt)),
          setup: "",
          tags: [],
          notes: "",
          rating: null,
          reviewedAt: null,
          sourceImportId: importId,
          sourceFile: fileName,
          sourceSheet: options.sourceSheet,
          sourceRows: [...new Set(position.sourceRows)],
        };
        const fingerprint = journalTradeFingerprint(base);
        trades.push({ ...base, id: `${importId}-execution-${trades.length + 1}-${fingerprint}`, fingerprint });
        positions.delete(execution.symbol);
        position = undefined;
      } else {
        position.signedQuantity = nextOpenQuantity * positionDirection;
        positions.set(execution.symbol, position);
      }
    }

    if (remaining > 0) {
      positions.set(execution.symbol, {
        symbol: execution.symbol,
        account,
        signedQuantity: remaining * direction,
        openedQuantity: remaining,
        averagePrice: execution.price,
        openedAt: execution.timestamp,
        fees: execution.fees * (remaining / execution.quantity),
        realizedGross: 0,
        sourceRows: [execution.rowNumber],
      });
    }
  }

  const unmatchedExecutions = [...positions.values()].reduce((sum, position) => sum + position.sourceRows.length, 0);
  const rejectedRows = Math.max(0, rows.length - executions.length);
  const warnings = [
    ...(rejectedRows ? [`${rejectedRows} execution row${rejectedRows === 1 ? "" : "s"} were missing a valid timestamp, symbol, side, quantity, or price.`] : []),
    ...(unmatchedExecutions ? [`${unmatchedExecutions} execution row${unmatchedExecutions === 1 ? "" : "s"} remained open and were not recorded as closed trades.`] : []),
  ];
  return { trades, rejectedRows: rejectedRows + unmatchedExecutions, warnings };
}

function parseTradingViewStrategyRows(
  rows: Array<Record<string, unknown>>,
  account: string,
  importId: string,
  fileName: string,
  options: JournalParseOptions = {},
) {
  const groups = new Map<string, Array<{ row: Record<string, unknown>; index: number }>>();
  rows.forEach((row, index) => {
    const tradeNumber = String(valueFor(row, TRADINGVIEW_ALIASES.tradeNumber) ?? "").trim();
    if (!tradeNumber) return;
    const group = groups.get(tradeNumber) ?? [];
    group.push({ row, index });
    groups.set(tradeNumber, group);
  });

  const trades: JournalTrade[] = [];
  let rejectedRows = 0;
  let usedFallbackSymbol = false;

  for (const [tradeNumber, group] of groups) {
    const entry = group.find(({ row }) => /entry/i.test(String(valueFor(row, TRADINGVIEW_ALIASES.tradeType) ?? "")));
    const exit = group.find(({ row }) => /exit/i.test(String(valueFor(row, TRADINGVIEW_ALIASES.tradeType) ?? "")));
    if (!entry || !exit) {
      rejectedRows += group.length;
      continue;
    }

    const entryType = String(valueFor(entry.row, TRADINGVIEW_ALIASES.tradeType) ?? "").toUpperCase();
    const side: JournalSide = entryType.includes("SHORT") ? "SHORT" : entryType.includes("LONG") ? "LONG" : "UNKNOWN";
    const openedAt = dateFromRow(entry.row, HEADER_ALIASES.openedAt);
    const closedAt = dateFromRow(exit.row, HEADER_ALIASES.openedAt);
    const entryPrice = parseNumber(valueFor(entry.row, HEADER_ALIASES.price) ?? valueFor(entry.row, HEADER_ALIASES.entryPrice));
    const exitPrice = parseNumber(valueFor(exit.row, HEADER_ALIASES.price) ?? valueFor(exit.row, HEADER_ALIASES.exitPrice));
    const symbolValue = valueFor(entry.row, HEADER_ALIASES.symbol) ?? valueFor(exit.row, HEADER_ALIASES.symbol);
    const symbol = String(symbolValue ?? options.symbolFallback ?? "TRADINGVIEW").trim().toUpperCase() || "TRADINGVIEW";
    const quantity = Math.abs(parseNumber(valueFor(entry.row, HEADER_ALIASES.quantity) ?? valueFor(exit.row, HEADER_ALIASES.quantity)) ?? 1);
    const explicitNet = parseNumber(valueFor(exit.row, HEADER_ALIASES.netPnl) ?? valueFor(exit.row, HEADER_ALIASES.grossPnl));
    const fees = Math.abs(parseNumber(valueFor(exit.row, HEADER_ALIASES.fees)) ?? 0);
    if (!openedAt || !closedAt || entryPrice === null || exitPrice === null) {
      rejectedRows += group.length;
      continue;
    }
    if (!symbolValue && !options.symbolFallback) usedFallbackSymbol = true;
    const direction = side === "SHORT" ? -1 : 1;
    const calculatedGross = (exitPrice - entryPrice) * quantity * contractMultiplier(symbol) * direction;
    const netPnl = explicitNet ?? calculatedGross - fees;
    const grossPnl = explicitNet === null ? calculatedGross : explicitNet + fees;
    const rowNumbers = [...new Set(group.map(({ index }) => sourceRowNumber(options, index)))].sort((left, right) => left - right);
    const base: Omit<JournalTrade, "id" | "fingerprint"> = {
      account,
      openedAt,
      closedAt,
      symbol,
      side,
      quantity,
      entryPrice,
      exitPrice,
      grossPnl,
      fees,
      netPnl,
      initialRisk: null,
      rMultiple: null,
      durationMs: Math.max(0, Date.parse(closedAt) - Date.parse(openedAt)),
      setup: String(valueFor(entry.row, TRADINGVIEW_ALIASES.signal) ?? valueFor(exit.row, TRADINGVIEW_ALIASES.signal) ?? "").trim(),
      tags: ["TradingView"],
      notes: `TradingView strategy trade ${tradeNumber}`,
      rating: null,
      reviewedAt: null,
      sourceImportId: importId,
      sourceFile: fileName,
      sourceSheet: options.sourceSheet,
      sourceRows: rowNumbers,
    };
    const fingerprint = journalTradeFingerprint(base);
    trades.push({ ...base, id: `${importId}-tradingview-${tradeNumber.replace(/[^a-zA-Z0-9_-]/g, "")}-${fingerprint}`, fingerprint });
  }

  const warnings = [
    ...(rejectedRows ? [`${rejectedRows} TradingView row${rejectedRows === 1 ? "" : "s"} did not form a complete entry/exit pair.`] : []),
    ...(usedFallbackSymbol ? ["TradingView did not include the strategy symbol, so imported trades are labelled TRADINGVIEW. You can edit the symbol after import."] : []),
  ];
  return { trades, rejectedRows, warnings };
}

export function parseJournalRows(
  fileName: string,
  sourceRows: Array<Record<string, unknown>>,
  account: string,
  importId: string,
  options: JournalParseOptions = {},
): JournalParseResult {
  if (!sourceRows.length) {
    return { trades: [], detectedSchema: "unknown", sourceRows: 0, rejectedRows: 0, warnings: ["No tabular trade rows were found."] };
  }

  const rows = normalizeRows(sourceRows);
  const headers = new Set(Object.keys(rows[0] ?? {}));
  const hasTradingViewTradeNumber = TRADINGVIEW_ALIASES.tradeNumber.some((header) => headers.has(header));
  const hasTradingViewType = TRADINGVIEW_ALIASES.tradeType.some((header) => headers.has(header));
  const hasTradingViewDate = HEADER_ALIASES.openedAt.some((header) => headers.has(header));
  const hasTradingViewPrice = HEADER_ALIASES.price.some((header) => headers.has(header));
  const isTradingViewStrategy = hasTradingViewTradeNumber && hasTradingViewType && hasTradingViewDate && hasTradingViewPrice;
  if (isTradingViewStrategy) {
    return {
      ...parseTradingViewStrategyRows(rows, account, importId, fileName, options),
      sourceRows: rows.length,
      detectedSchema: "closed-trades",
    };
  }

  const hasEntryExit = [...HEADER_ALIASES.entryPrice, ...HEADER_ALIASES.exitPrice, ...HEADER_ALIASES.grossPnl, ...HEADER_ALIASES.netPnl]
    .some((header) => headers.has(header));
  const hasExecutionPrice = HEADER_ALIASES.price.some((header) => headers.has(header));
  const hasSide = HEADER_ALIASES.side.some((header) => headers.has(header));
  const result = hasEntryExit || !hasExecutionPrice || !hasSide
    ? parseClosedTrades(rows, account, importId, fileName, options)
    : parseExecutions(rows, account, importId, fileName, options);

  return {
    ...result,
    sourceRows: rows.length,
    detectedSchema: hasEntryExit || !hasExecutionPrice || !hasSide ? "closed-trades" : "executions",
  };
}

export function parseJournalTextFile(
  fileName: string,
  text: string,
  account: string,
  importId: string,
): JournalParseResult {
  let sourceRows: Array<Record<string, unknown>> = [];
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "json") {
    try {
      const parsed = JSON.parse(text) as unknown;
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { trades?: unknown[] }).trades)
          ? (parsed as { trades: Array<Record<string, unknown>> }).trades
          : [];
      sourceRows = rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    } catch {
      return { trades: [], detectedSchema: "unknown", sourceRows: 0, rejectedRows: 0, warnings: ["The JSON file could not be parsed."] };
    }
  } else {
    sourceRows = parseDelimited(text);
  }

  const result = parseJournalRows(fileName, sourceRows, account, importId);
  return extension === "json" ? { ...result, detectedSchema: "json" } : result;
}

export function calculateJournalStats(trades: JournalTrade[], evidence: JournalEvidence[] = []): JournalStats {
  const ordered = [...trades].sort((left, right) => Date.parse(left.closedAt ?? left.openedAt) - Date.parse(right.closedAt ?? right.openedAt));
  const winners = ordered.filter((trade) => trade.netPnl > 0);
  const losers = ordered.filter((trade) => trade.netPnl < 0);
  const grossProfit = winners.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLoss = Math.abs(losers.reduce((sum, trade) => sum + trade.netPnl, 0));
  const netPnl = ordered.reduce((sum, trade) => sum + trade.netPnl, 0);
  const rTrades = ordered.filter((trade) => trade.rMultiple !== null);
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of ordered) {
    equity += trade.netPnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  let currentStreak = 0;
  let currentStreakKind: JournalStats["currentStreakKind"] = "NONE";
  for (const trade of [...ordered].reverse()) {
    if (trade.netPnl === 0) continue;
    const kind = trade.netPnl > 0 ? "WIN" : "LOSS";
    if (currentStreakKind === "NONE") currentStreakKind = kind;
    if (kind !== currentStreakKind) break;
    currentStreak += 1;
  }

  const reviewedCount = ordered.filter((trade) => trade.reviewedAt).length;
  const linkedTradeIds = new Set(evidence.flatMap((item) => item.tradeId ? [item.tradeId] : []));
  return {
    tradeCount: ordered.length,
    netPnl,
    grossProfit,
    grossLoss,
    winRate: ordered.length ? winners.length / ordered.length : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : null,
    expectancy: ordered.length ? netPnl / ordered.length : null,
    averageWin: winners.length ? grossProfit / winners.length : null,
    averageLoss: losers.length ? grossLoss / losers.length : null,
    averageR: rTrades.length ? rTrades.reduce((sum, trade) => sum + (trade.rMultiple ?? 0), 0) / rTrades.length : null,
    maxDrawdown,
    reviewedCount,
    reviewedPercent: ordered.length ? reviewedCount / ordered.length : null,
    evidenceLinkedCount: ordered.filter((trade) => linkedTradeIds.has(trade.id)).length,
    bestTrade: ordered.length ? Math.max(...ordered.map((trade) => trade.netPnl)) : null,
    worstTrade: ordered.length ? Math.min(...ordered.map((trade) => trade.netPnl)) : null,
    currentStreak,
    currentStreakKind,
  };
}

export function journalTradesToCsv(trades: JournalTrade[]) {
  const headers = [
    "Opened At",
    "Closed At",
    "Account",
    "Symbol",
    "Side",
    "Quantity",
    "Entry Price",
    "Exit Price",
    "Gross P&L",
    "Fees",
    "Net P&L",
    "Initial Risk",
    "R Multiple",
    "Setup",
    "Tags",
    "Rating",
    "Reviewed At",
    "Notes",
    "How To Improve Next Time",
    "Contract Class",
    "Source File",
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    headers.map(escape).join(","),
    ...trades.map((trade) => [
      trade.openedAt,
      trade.closedAt,
      trade.account,
      trade.symbol,
      trade.side,
      trade.quantity,
      trade.entryPrice,
      trade.exitPrice,
      trade.grossPnl,
      trade.fees,
      trade.netPnl,
      trade.initialRisk,
      trade.rMultiple,
      trade.setup,
      trade.tags.join("|"),
      trade.rating,
      trade.reviewedAt,
      trade.notes,
      trade.improvements ?? "",
      trade.contractClass ?? "",
      trade.sourceFile,
    ].map(escape).join(",")),
  ].join("\r\n");
}
