import { zyonTradingAccountLabel } from "./zyon.ts";

export const ZYON_JOURNAL_ACCOUNT = "ZYON Journal";

export function isZyonJournalAccountName(value: unknown) {
  return typeof value === "string"
    && value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase() === ZYON_JOURNAL_ACCOUNT.toLowerCase();
}

export type JournalSide = "LONG" | "SHORT" | "UNKNOWN";
export type JournalTradingAccountType = "LIVE_CAPITAL" | "EVALUATION" | "FUNDED";

export type JournalTrade = {
  id: string;
  account: string;
  openedAt: string;
  closedAt: string | null;
  entryTimeKnown?: boolean;
  exitTimeKnown?: boolean;
  symbol: string;
  side: JournalSide;
  quantity: number;
  entryPrice: number | null;
  exitPrice: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  plannedRiskReward?: number | null;
  grossPnl: number;
  fees: number;
  feesKnown?: boolean;
  netPnl: number;
  initialRisk: number | null;
  rMultiple: number | null;
  durationMs: number | null;
  setup: string;
  tags: string[];
  notes: string;
  improvements?: string;
  contractClass?: "MICRO" | "MINI" | "OTHER";
  tradingAccountName?: string;
  tradingAccountType?: JournalTradingAccountType;
  accountSize?: number | null;
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
  /*
   * "paper" is a journal created for a demo trading account. Its trades are
   * written as they close and are never revised, so the record survives the
   * trader clearing their fills, resetting the account, or deleting it.
   */
  source: "import" | "manual" | "paper";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  sortOrder?: number | null;
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

export type JournalAdvancedStats = {
  tradedDays: number;
  winningDays: number;
  losingDays: number;
  winningDayRate: number | null;
  averageWinningDay: number | null;
  averageLosingDay: number | null;
  bestDay: number | null;
  worstDay: number | null;
  payoffRatio: number | null;
  recoveryFactor: number | null;
};

const HEADER_ALIASES = {
  openedAt: ["openedat", "entrydatetime", "entrytimestamp", "opendatetime", "opentimestamp", "entrydt", "opentime", "entrytime", "datetime", "dateandtime", "timestamp", "timeopened", "entrydate", "opendate", "tradeopen", "tradeopened", "tradeopentime", "positionopened", "dateopened", "entryfilledat", "firstfilltime", "openeddatetime", "entrydateandtime"],
  closedAt: ["closedat", "exitdatetime", "exittimestamp", "closedatetime", "closetimestamp", "exitdt", "closetime", "exittime", "timeclosed", "exitdate", "closedate", "tradeclose", "tradeclosed", "tradeclosetime", "positionclosed", "dateclosed", "exitfilledat", "lastfilltime", "closeddatetime", "exitdateandtime"],
  date: ["date", "tradedate", "dateoftrade", "sessiondate", "filldate", "executedate", "transactiondate", "businessdate"],
  time: ["time", "tradetime", "filltime", "executiontime", "transactiontime", "ordertime", "updatedatetimee", "updatedatetimel", "ssboe"],
  symbol: ["symbol", "contractsymbol", "instrumentsymbol", "instrument", "ticker", "contract", "market", "tradingsymbol", "product", "security", "underlying", "symbolcontract", "instrumentname"],
  side: ["side", "tradedirection", "positiondirection", "marketposition", "marketpos", "position", "direction", "buysell", "bs", "action", "actiontype", "type", "ordertype", "transactiontype"],
  quantity: ["quantity", "numberofcontracts", "contractquantity", "qty", "qtyfilled", "filledqty", "filledquantity", "fillqty", "executedqty", "executedquantity", "size", "positionsize", "positionqty", "contracts", "lots", "lot", "units", "volume", "shares"],
  entryPrice: ["entryprice", "entry", "entrypoint", "entrypoints", "entrylevel", "entryvalue", "entryfill", "openprice", "averageentryprice", "avgentryprice", "averageopenprice", "avgopenprice", "buyprice", "entryfillprice"],
  exitPrice: ["exitprice", "exit", "exitpoint", "exitpoints", "exitlevel", "exitvalue", "exitfill", "closeprice", "averageexitprice", "avgexitprice", "averagecloseprice", "avgcloseprice", "sellprice", "exitfillprice"],
  price: ["price", "fillprice", "filledprice", "executionprice", "executedprice", "tradeprice", "transactionprice", "averageprice", "avgprice", "avgfillprice", "averagefillprice", "tprice"],
  grossPnl: ["grosspnl", "grosspnlusd", "grossprofit", "grossprofitusd", "profitloss", "profitandloss", "pnl", "pnlusd", "pl", "result", "tradepnl", "tradeprofit", "realizedpnl", "realisedpnl", "realizedpnlusd", "realizedpl", "realisedpl", "profit", "profitusd"],
  netPnl: ["netpnl", "netpnlusd", "netprofit", "netprofitusd", "netpl", "netplusd", "netprofitloss", "netresult", "netrealizedpnl", "netrealisedpnl"],
  fees: ["fees", "fee", "commission", "commissions", "totalfees", "totalcommission", "commfee", "commissionfee", "brokerage", "costs", "transactioncosts"],
  initialRisk: ["initialrisk", "risk", "riskamount", "plannedrisk"],
  rMultiple: ["rmultiple", "realizedr", "r", "resultinr"],
  stopPrice: ["stopprice", "stoploss", "stop", "sl"],
  targetPrice: ["targetprice", "takeprofit", "profittarget", "target", "tp"],
  plannedRiskReward: ["plannedriskreward", "riskreward", "risktoreward", "rr"],
  contractClass: ["contractclass", "contracttype", "productclass"],
  tradingAccountName: ["tradingaccount", "accountname", "brokeraccount", "provider", "propfirm"],
  tradingAccountType: ["accounttype", "fundingstatus", "accountstatus"],
  accountSize: ["accountsize", "startingbalance", "capital", "buyingpower"],
  setup: ["setup", "strategy", "playbook", "tradetype", "pattern", "signal"],
  tags: ["tags", "tag", "mistakes", "labels"],
  notes: ["notes", "note", "comment", "comments", "description"],
  rating: ["rating", "traderating", "grade"],
  duration: ["hold", "holdtime", "holdingtime", "duration", "tradeduration", "timetraded", "timeintrade", "elapsedtime"],
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
  const qualifiers = ["usd", "aud", "cad", "gbp", "eur", "dollar", "dollars", "accountcurrency", "currency", "points", "ticks"];
  return aliases.some((alias) => header === alias || qualifiers.some((qualifier) => header === `${alias}${qualifier}`));
}

function inferredHeader(value: string) {
  const header = normalizeHeader(value);
  if (!header) return header;
  if (Object.values(HEADER_ALIASES).some((aliases) => aliases.includes(header as never))) return header;

  if (/(?:entry|open).*(?:date|time|timestamp)|(?:date|time).*(?:entry|open)/.test(header)) return "entrydatetime";
  if (/(?:exit|close).*(?:date|time|timestamp)|(?:date|time).*(?:exit|close)/.test(header)) return "exitdatetime";
  if (/(?:net).*(?:pnl|profit|loss|result)|(?:pnl|profit|loss|result).*net/.test(header)) return "netpnl";
  if (/(?:pnl|profitandloss|profitloss|realizedprofit|realisedprofit|traderesult|closedpnl)/.test(header)) return "grosspnl";
  if (/(?:entry|open|buy).*(?:price|fill|point|level|value)|(?:price|fill|point|level|value).*(?:entry|open)/.test(header)) return "entryprice";
  if (/(?:exit|close|sell).*(?:price|fill|point|level|value)|(?:price|fill|point|level|value).*(?:exit|close)/.test(header)) return "exitprice";
  if (/(?:avg|average|execution|executed|transaction|trade|fill|filled).*price|price.*(?:avg|average|execution|executed|transaction|trade|fill|filled)/.test(header)) return "fillprice";
  if (/(?:instrument|symbol|ticker|contract|security|product|underlying)/.test(header)) return "symbol";
  if (/(?:quantity|filledqty|fillqty|positionqty|contracts|lots|shares|units)/.test(header)) return "quantity";
  if (/(?:buysell|marketpos|positiondirection|tradedirection|transactiontype)/.test(header)) return "side";
  if (/(?:commission|brokerage|transactioncost|totalfee)/.test(header)) return "fees";
  if (/(?:holdtime|holdingtime|duration|timeintrade|elapsedtime)/.test(header)) return "duration";
  return header;
}

export function journalHeaderScore(cells: unknown[]) {
  const headers = cells.map((cell) => inferredHeader(String(cell ?? ""))).filter(Boolean);
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
  const rawText = String(value ?? "")
    .trim()
    .replace(/[−–—]/g, "-");
  const text = rawText
    .replace(/\b(?:USD|AUD|CAD|GBP|EUR|JPY|NZD|CHF|DR|CR|DEBIT|CREDIT|PROFIT|LOSS)\b/gi, "");
  if (!text) return null;
  const negative = /^\(.*\)$/.test(rawText) || /-$/.test(rawText) || /\b(?:DR|DEBIT|LOSS)\b/i.test(rawText);
  const normalized = text.replace(/[,$£€¥%\s()]/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return negative ? -Math.abs(number) : number;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "number" && value >= 1_000_000_000) {
    const milliseconds = value >= 1_000_000_000_000_000
      ? value / 1_000
      : value >= 1_000_000_000_000
        ? value
        : value * 1_000;
    const unixDate = new Date(milliseconds);
    return Number.isNaN(unixDate.getTime()) ? null : unixDate.toISOString();
  }
  if (typeof value === "number" && value > 20_000 && value < 100_000) {
    const excelDate = new Date(Math.round((value - 25_569) * 86_400_000));
    return Number.isNaN(excelDate.getTime()) ? null : excelDate.toISOString();
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const dayFirst = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(.+))?$/);
  if (dayFirst) {
    const year = dayFirst[3].length === 2 ? 2_000 + Number(dayFirst[3]) : Number(dayFirst[3]);
    const first = Number(dayFirst[1]);
    const second = Number(dayFirst[2]);
    const month = first > 12 ? second : second > 12 ? first : second;
    const day = first > 12 ? first : second > 12 ? second : first;
    const fallback = Date.parse(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${dayFirst[4] || "00:00:00"}`);
    if (!Number.isNaN(fallback)) return new Date(fallback).toISOString();
  }
  if (/^\d{10,16}$/.test(text)) return parseDateValue(Number(text));
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function valueFor(row: Record<string, unknown>, aliases: readonly string[]) {
  for (const alias of aliases) {
    if (alias in row && String(row[alias] ?? "").trim() !== "") return row[alias];
  }
  for (const [header, value] of Object.entries(row)) {
    if (headerMatches(header, aliases) && String(value ?? "").trim() !== "") return value;
  }
  return null;
}

const ENTRY_DATE_ALIASES = ["entrydate", "opendate", "dateentered", "openeddate"] as const;
const ENTRY_TIME_ALIASES = ["entrytime", "opentime", "timeentered", "timeopened"] as const;
const EXIT_DATE_ALIASES = ["exitdate", "closedate", "dateexited", "dateclosed"] as const;
const EXIT_TIME_ALIASES = ["exittime", "closetime", "timeexited", "timeclosed"] as const;

function qualifiedValuesFor(row: Record<string, unknown>, aliases: readonly string[]) {
  const values: unknown[] = [];
  const orderedAliases = [...aliases].sort((left, right) => right.length - left.length);
  for (const alias of orderedAliases) {
    for (const [key, value] of Object.entries(row)) {
      // Claude and broker exports often append a timezone/currency qualifier,
      // e.g. `Entry Date/Time (Brisbane)` -> `entrydatetimebrisbane`.
      if ((key === alias || (alias.length >= 5 && key.startsWith(alias))) && String(value ?? "").trim() !== "") {
        values.push(value);
      }
    }
  }
  return values;
}

function combinedDateAndTime(
  row: Record<string, unknown>,
  dateAliases: readonly string[],
  timeAliases: readonly string[],
) {
  const date = qualifiedValuesFor(row, dateAliases)[0];
  const time = qualifiedValuesFor(row, timeAliases)[0];
  if (date === undefined || time === undefined) return null;
  if (date instanceof Date && time instanceof Date) {
    const combined = new Date(date);
    combined.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
    return Number.isNaN(combined.getTime()) ? null : combined.toISOString();
  }
  if (typeof time === "number" && time >= 0 && time < 1) {
    const dateOnly = parseDateValue(date);
    if (!dateOnly) return null;
    return new Date(new Date(dateOnly).getTime() + Math.round(time * 86_400_000)).toISOString();
  }
  return parseDateValue(`${String(date)} ${String(time)}`);
}

function dateFromRow(
  row: Record<string, unknown>,
  directAliases: readonly string[],
  fallbackToDate = true,
  phase?: "entry" | "exit",
) {
  if (phase === "entry") {
    const combined = combinedDateAndTime(row, ENTRY_DATE_ALIASES, ENTRY_TIME_ALIASES)
      ?? combinedDateAndTime(row, HEADER_ALIASES.date, ENTRY_TIME_ALIASES);
    if (combined) return combined;
  } else if (phase === "exit") {
    const combined = combinedDateAndTime(row, EXIT_DATE_ALIASES, EXIT_TIME_ALIASES)
      ?? combinedDateAndTime(row, HEADER_ALIASES.date, EXIT_TIME_ALIASES);
    if (combined) return combined;
  }

  for (const direct of qualifiedValuesFor(row, directAliases)) {
    const parsed = parseDateValue(direct);
    if (parsed) return parsed;
  }
  if (!fallbackToDate) return null;
  const date = valueFor(row, HEADER_ALIASES.date);
  const time = valueFor(row, HEADER_ALIASES.time);
  if (date === null) return null;
  return parseDateValue(`${String(date)}${time === null ? "" : ` ${String(time)}`}`);
}

function durationMillisecondsFromRow(row: Record<string, unknown>) {
  let matchedHeader = "";
  let matchedValue: unknown = null;
  for (const [header, value] of Object.entries(row)) {
    const baseMatch = HEADER_ALIASES.duration.some((alias) => header === alias || header.startsWith(alias));
    if (baseMatch && String(value ?? "").trim() !== "") {
      matchedHeader = header;
      matchedValue = value;
      break;
    }
  }
  if (matchedValue === null) return null;
  const text = String(matchedValue).trim().toLowerCase();
  if (!text) return null;

  const colonParts = text.split(":").map(Number);
  if ((colonParts.length === 2 || colonParts.length === 3) && colonParts.every(Number.isFinite)) {
    const [hours, minutes, seconds] = colonParts.length === 3
      ? colonParts
      : [0, colonParts[0], colonParts[1]];
    return Math.max(0, Math.round((hours * 3_600 + minutes * 60 + seconds) * 1_000));
  }

  const hours = Number(text.match(/(-?\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/)?.[1] ?? 0);
  const minutes = Number(text.match(/(-?\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/)?.[1] ?? 0);
  const seconds = Number(text.match(/(-?\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/)?.[1] ?? 0);
  if (hours || minutes || seconds) {
    return Math.max(0, Math.round((hours * 3_600 + minutes * 60 + seconds) * 1_000));
  }

  const numeric = parseNumber(matchedValue);
  if (numeric === null || numeric < 0) return null;
  if (/(?:millisecond|milliseconds|msec|ms)$/.test(matchedHeader)) return Math.round(numeric);
  if (/(?:second|seconds|secs|sec)$/.test(matchedHeader)) return Math.round(numeric * 1_000);
  if (/(?:hour|hours|hrs|hr)$/.test(matchedHeader)) return Math.round(numeric * 3_600_000);
  // A bare Hold/Duration column in generated journal CSVs conventionally means minutes.
  return Math.round(numeric * 60_000);
}

function parseSide(value: unknown): JournalSide {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["LONG", "BUY", "B", "BOT", "BUYTOOPEN", "BUY TO OPEN"].includes(normalized) || /\b(?:LONG|BUY)\b/.test(normalized)) return "LONG";
  if (["SHORT", "SELL", "S", "SLD", "SELLTOOPEN", "SELL TO OPEN"].includes(normalized) || /\b(?:SHORT|SELL)\b/.test(normalized)) return "SHORT";
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

function inferredContractClass(symbol: string): JournalTrade["contractClass"] {
  const root = symbolRoot(symbol);
  if (["MES", "MNQ", "M2K", "MYM", "MCL", "MGC", "SIL"].includes(root)) return "MICRO";
  if (["ES", "NQ", "RTY", "YM", "CL", "GC", "SI", "HG", "NG", "ZB", "ZN", "ZF", "ZT"].includes(root)) return "MINI";
  return "OTHER";
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

export function mergeJournalImportTrades(existing: JournalTrade[], incoming: JournalTrade[], account: string) {
  const known = new Set(
    existing
      .filter((trade) => trade.account === account)
      .map((trade) => trade.fingerprint),
  );
  const added: JournalTrade[] = [];
  let duplicateTrades = 0;

  for (const trade of incoming) {
    if (known.has(trade.fingerprint)) {
      duplicateTrades += 1;
      continue;
    }
    known.add(trade.fingerprint);
    added.push(trade);
  }

  return { added, duplicateTrades };
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
  return rows.map((source) => {
    const normalized: Record<string, unknown> = {};
    Object.entries(source).forEach(([key, value]) => {
      const original = normalizeHeader(key);
      if (original && !(original in normalized)) normalized[original] = value;
      const inferred = inferredHeader(key);
      if (inferred && !(inferred in normalized)) normalized[inferred] = value;
    });
    return normalized;
  });
}

export function parseDelimited(text: string, delimiter?: string) {
  const clean = text
    .replace(/^\uFEFF/, "")
    .replace(/^\s*```(?:csv|tsv|text)?\s*$/gim, "")
    .replace(/^\s*```\s*$/gim, "");
  const sampleLines = clean.split(/\r?\n/).slice(0, 25);
  const selectedDelimiter = delimiter ?? [
    { delimiter: "\t", score: Math.max(...sampleLines.map((line) => (line.match(/\t/g) ?? []).length)) },
    { delimiter: ",", score: Math.max(...sampleLines.map((line) => (line.match(/,/g) ?? []).length)) },
    { delimiter: ";", score: Math.max(...sampleLines.map((line) => (line.match(/;/g) ?? []).length)) },
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

  // AI-generated exports often contain a title or explanatory sentence above
  // the real CSV. Find the strongest trade-header row instead of assuming row 1.
  const candidates = rows.slice(0, Math.min(rows.length - 1, 25));
  let headerIndex = 0;
  let bestScore = journalHeaderScore(candidates[0] ?? []);
  candidates.forEach((cells, index) => {
    const score = journalHeaderScore(cells);
    if (score > bestScore) {
      headerIndex = index;
      bestScore = score;
    }
  });

  const headers = rows[headerIndex];
  return rows.slice(headerIndex + 1).map((cells) => Object.fromEntries(
    headers.map((header, index) => [header || `column_${index + 1}`, cells[index] ?? ""]),
  )).filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));
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
  const missing = { date: 0, instrument: 0, economics: 0 };

  rows.forEach((row, index) => {
    const openedAt = dateFromRow(row, HEADER_ALIASES.openedAt, true, "entry");
    const holdDurationMs = durationMillisecondsFromRow(row);
    const explicitClosedAt = dateFromRow(row, HEADER_ALIASES.closedAt, false, "exit");
    const closedAt = explicitClosedAt ?? (openedAt && holdDurationMs !== null
      ? new Date(Date.parse(openedAt) + holdDurationMs).toISOString()
      : null);
    const symbol = String(valueFor(row, HEADER_ALIASES.symbol) ?? options.symbolFallback ?? "").trim().toUpperCase();
    const signedQuantity = parseNumber(valueFor(row, HEADER_ALIASES.quantity));
    const explicitSide = parseSide(valueFor(row, HEADER_ALIASES.side));
    // Deep Charts closed-trade exports encode direction in signed Quantity
    // and do not include a separate Side column.
    const side: JournalSide = explicitSide !== "UNKNOWN"
      ? explicitSide
      : signedQuantity !== null && signedQuantity !== 0
        ? signedQuantity < 0 ? "SHORT" : "LONG"
        : "UNKNOWN";
    const quantity = Math.abs(signedQuantity ?? 1);
    const entryPrice = parseNumber(valueFor(row, HEADER_ALIASES.entryPrice));
    const exitPrice = parseNumber(valueFor(row, HEADER_ALIASES.exitPrice));
    const explicitGross = parseNumber(valueFor(row, HEADER_ALIASES.grossPnl));
    const explicitNet = parseNumber(valueFor(row, HEADER_ALIASES.netPnl));
    const fees = Math.abs(parseNumber(valueFor(row, HEADER_ALIASES.fees)) ?? 0);

    const missingEconomics = explicitGross === null && explicitNet === null && (entryPrice === null || exitPrice === null);
    if (!openedAt || !symbol || missingEconomics) {
      rejectedRows += 1;
      if (!openedAt) missing.date += 1;
      if (!symbol) missing.instrument += 1;
      if (missingEconomics) missing.economics += 1;
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
    const contractClassText = String(valueFor(row, HEADER_ALIASES.contractClass) ?? "").trim().toUpperCase();
    const contractClass = contractClassText.includes("MICRO")
      ? "MICRO"
      : contractClassText.includes("MINI")
        ? "MINI"
        : inferredContractClass(symbol);
    const accountTypeText = String(valueFor(row, HEADER_ALIASES.tradingAccountType) ?? "").trim().toUpperCase();
    const tradingAccountType: JournalTradingAccountType | undefined = /EVAL|CHALLENGE/.test(accountTypeText)
      ? "EVALUATION"
      : /FUND/.test(accountTypeText)
        ? "FUNDED"
        : /LIVE|PERSONAL|CAPITAL/.test(accountTypeText)
          ? "LIVE_CAPITAL"
          : undefined;
    const plannedRiskReward = parseNumber(valueFor(row, HEADER_ALIASES.plannedRiskReward));
    const accountSize = parseNumber(valueFor(row, HEADER_ALIASES.accountSize));

    const base: Omit<JournalTrade, "id" | "fingerprint"> = {
      account,
      openedAt,
      closedAt,
      entryTimeKnown: true,
      exitTimeKnown: Boolean(closedAt),
      symbol,
      side,
      quantity,
      entryPrice,
      exitPrice,
      stopPrice: parseNumber(valueFor(row, HEADER_ALIASES.stopPrice)),
      targetPrice: parseNumber(valueFor(row, HEADER_ALIASES.targetPrice)),
      plannedRiskReward,
      grossPnl,
      fees,
      netPnl,
      initialRisk: initialRisk !== null && initialRisk > 0 ? initialRisk : null,
      rMultiple,
      durationMs: closedAt ? Math.max(0, Date.parse(closedAt) - Date.parse(openedAt)) : holdDurationMs,
      setup: String(valueFor(row, HEADER_ALIASES.setup) ?? "").trim(),
      tags: parseTags(valueFor(row, HEADER_ALIASES.tags)),
      notes: String(valueFor(row, HEADER_ALIASES.notes) ?? "").trim(),
      contractClass,
      tradingAccountName: String(valueFor(row, HEADER_ALIASES.tradingAccountName) ?? "").trim() || undefined,
      tradingAccountType,
      accountSize: accountSize !== null && accountSize >= 0 ? accountSize : null,
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

  if (rejectedRows) {
    const details = [
      missing.date ? `${missing.date} missing a valid entry date/time` : "",
      missing.instrument ? `${missing.instrument} missing an instrument` : "",
      missing.economics ? `${missing.economics} missing P&L or an entry/exit price pair` : "",
    ].filter(Boolean).join("; ");
    warnings.push(`${rejectedRows} row${rejectedRows === 1 ? "" : "s"} could not be converted${details ? `: ${details}.` : "."}`);
  }
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
          contractClass: inferredContractClass(execution.symbol),
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
      contractClass: inferredContractClass(symbol),
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
      const container = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
      const preferredCollections = ["trades", "executions", "fills", "orders", "transactions", "records", "data", "results", "closedtrades"];
      const nestedRows = container
        ? Object.entries(container).find(([key, value]) => preferredCollections.includes(normalizeHeader(key)) && Array.isArray(value))?.[1]
        : null;
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(nestedRows)
          ? nestedRows
          : container && journalHeaderScore(Object.keys(container)) >= 4
            ? [container]
            : [];
      sourceRows = rows
        .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)))
        .map((row) => Object.fromEntries(Object.entries(row).flatMap(([key, value]) => {
          if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Date) return [[key, value]];
          return Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) => [`${key} ${nestedKey}`, nestedValue]);
        })));
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

export function calculateJournalAdvancedStats(trades: JournalTrade[]): JournalAdvancedStats {
  const byDay = new Map<string, number>();
  for (const trade of trades) {
    const timestamp = trade.closedAt ?? trade.openedAt;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + trade.netPnl);
  }

  const dailyResults = [...byDay.values()];
  const winningDays = dailyResults.filter((value) => value > 0);
  const losingDays = dailyResults.filter((value) => value < 0);
  const averageWin = trades.filter((trade) => trade.netPnl > 0).reduce((sum, trade) => sum + trade.netPnl, 0) / Math.max(1, trades.filter((trade) => trade.netPnl > 0).length);
  const averageLoss = Math.abs(trades.filter((trade) => trade.netPnl < 0).reduce((sum, trade) => sum + trade.netPnl, 0)) / Math.max(1, trades.filter((trade) => trade.netPnl < 0).length);
  const stats = calculateJournalStats(trades);

  return {
    tradedDays: dailyResults.length,
    winningDays: winningDays.length,
    losingDays: losingDays.length,
    winningDayRate: dailyResults.length ? winningDays.length / dailyResults.length : null,
    averageWinningDay: winningDays.length ? winningDays.reduce((sum, value) => sum + value, 0) / winningDays.length : null,
    averageLosingDay: losingDays.length ? losingDays.reduce((sum, value) => sum + value, 0) / losingDays.length : null,
    bestDay: dailyResults.length ? Math.max(...dailyResults) : null,
    worstDay: dailyResults.length ? Math.min(...dailyResults) : null,
    payoffRatio: averageLoss > 0 ? averageWin / averageLoss : averageWin > 0 ? Number.POSITIVE_INFINITY : null,
    recoveryFactor: stats.maxDrawdown > 0 ? stats.netPnl / stats.maxDrawdown : stats.netPnl > 0 ? Number.POSITIVE_INFINITY : null,
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
    "Trading Account",
    "Account Type",
    "Account Size",
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
      trade.tradingAccountName ?? "",
      trade.tradingAccountType ?? "",
      trade.accountSize ?? "",
      trade.sourceFile,
    ].map(escape).join(",")),
  ].join("\r\n");
}
