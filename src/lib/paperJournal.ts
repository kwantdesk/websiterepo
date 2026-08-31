import {
  journalTradeFingerprint,
  type JournalAccount,
  type JournalSide,
  type JournalState,
  type JournalTrade,
} from "@/lib/journal";
import type { PaperTradingAccountRecord } from "@/lib/paperAccounts";
import {
  paperContractSpec,
  type PaperAccountLedger,
  type PaperTradeFill,
  type PaperTradingLedger,
} from "@/lib/paperTrading";

/**
 * The bridge from demo trading to the journal.
 *
 * Every demo account gets a journal of its own, and every trade closed in that
 * account writes itself into it. Nothing here is derived on demand, and that is
 * the point: the ledger DELETES a position the moment it closes, keeping only
 * the fills, and the trader is free to clear those fills off the chart whenever
 * they like. A journal reconstructed from the ledger would therefore lose the
 * trade twice over.
 *
 * So a closed trade is copied into the journal AT THE MOMENT IT CLOSES and is
 * never touched again. Clearing fills, resetting the account, or deleting the
 * demo account itself leaves the journal exactly as it was - it is a record of
 * what the trader did, not a view onto what the ledger currently holds.
 */

/** Journal trade ids for paper fills are prefixed so the source is never ambiguous. */
export const PAPER_JOURNAL_TRADE_PREFIX = "paper:";
export const PAPER_JOURNAL_IMPORT_ID = "paper-trading";

/**
 * Fired after closed demo trades are written to the journal store.
 *
 * An open journal holds its own copy of the state and saves it back, so it has
 * to be told that trades arrived underneath it - otherwise the next thing the
 * trader edits would write a copy that predates them.
 */
export const PAPER_JOURNAL_UPDATED_EVENT = "kwantdesk:paper-journal-updated";

/**
 * One journal row per EXIT.
 *
 * A scale-out closes a position in pieces, and each piece is a realised result
 * with its own price, size and P&L. Writing a row per exit means every row is
 * complete and final the instant it is created - nothing is ever revised later,
 * which is what lets the journal be permanent. For the ordinary trade that ends
 * at one stop or one target, this is exactly one row.
 */
function isExitFill(fill: PaperTradeFill) {
  return fill.role !== "entry";
}

function journalSide(side: PaperTradeFill["side"]): JournalSide {
  // The fill's side is the side of the EXIT, so a long is closed by a sell.
  return side === "sell" ? "LONG" : "SHORT";
}

function contractClass(symbol: string): JournalTrade["contractClass"] {
  const spec = paperContractSpec(symbol);
  if (spec.isMicro) return "MICRO";
  if (spec.isMini) return "MINI";
  return "OTHER";
}

/** The journal account a demo account writes into. Its name is the link. */
export function paperJournalAccountName(record: Pick<PaperTradingAccountRecord, "name">) {
  return record.name.trim() || "Demo account";
}

export function isPaperJournalTrade(trade: Pick<JournalTrade, "id">) {
  return trade.id.startsWith(PAPER_JOURNAL_TRADE_PREFIX);
}

/**
 * A journal account for every demo account, created once and then left alone.
 *
 * Renaming or deleting the demo account does not rename or remove the journal:
 * the trades under it were taken under that name, and rewriting history to
 * match a later decision would make the record less true, not more.
 */
export function ensurePaperJournalAccounts(
  state: JournalState,
  records: readonly PaperTradingAccountRecord[],
  now = Date.now(),
): JournalState {
  const existing = new Set(state.accounts.map((account) => account.name));
  const missing = records
    .map((record) => paperJournalAccountName(record))
    .filter((name, index, names) => !existing.has(name) && names.indexOf(name) === index);
  if (!missing.length) return state;

  const timestamp = new Date(now).toISOString();
  const added: JournalAccount[] = missing.map((name, index) => ({
    id: `paper-${name}`,
    name,
    source: "paper",
    createdAt: timestamp,
    updatedAt: timestamp,
    sortOrder: state.accounts.length + index,
  }));
  return { ...state, accounts: [...state.accounts, ...added] };
}

function paperFillToJournalTrade(
  fill: PaperTradeFill,
  entryFill: PaperTradeFill | null,
  accountName: string,
): JournalTrade | null {
  const quantity = Number(fill.quantity);
  const exitPrice = Number(fill.price);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(exitPrice)) return null;

  const side = journalSide(fill.side);
  const entryPrice = entryFill && Number.isFinite(entryFill.price) ? entryFill.price : null;
  const openedAtMs = entryFill?.timestamp ?? fill.timestamp;
  const openedAt = new Date(openedAtMs).toISOString();
  const closedAt = new Date(fill.timestamp).toISOString();
  const netPnl = Number.isFinite(fill.realizedPnl) ? fill.realizedPnl : 0;

  const trade: JournalTrade = {
    id: `${PAPER_JOURNAL_TRADE_PREFIX}${fill.id}`,
    account: accountName,
    openedAt,
    closedAt,
    entryTimeKnown: Boolean(entryFill),
    exitTimeKnown: true,
    symbol: fill.symbol,
    side,
    quantity,
    entryPrice,
    exitPrice,
    // Simulated fills carry no commission, and inventing one would misstate
    // every result in the journal.
    grossPnl: netPnl,
    fees: 0,
    feesKnown: true,
    netPnl,
    /*
     * Measured on the trade itself and written onto the fill as it closed, from
     * the stop and target it was PLANNED with - locked thirty seconds in, so a
     * stop later trailed into profit cannot rewrite the risk the trade was
     * actually taken with. Still null when the trade carried no stop: there is
     * no R to be a multiple of, and zero would read as a scratch.
     */
    initialRisk: fill.initialRisk ?? null,
    rMultiple: fill.rMultiple ?? null,
    stopPrice: fill.plannedStopLoss ?? null,
    targetPrice: fill.plannedTakeProfit ?? null,
    plannedRiskReward: fill.plannedRiskReward ?? null,
    adverseExcursion: fill.adverseExcursion ?? null,
    favourableExcursion: fill.favourableExcursion ?? null,
    durationMs: fill.holdMs
      ?? (entryFill ? Math.max(0, fill.timestamp - entryFill.timestamp) : null),
    // The exit that actually happened is the most useful thing to sort by, and
    // it is a fact rather than an interpretation.
    setup: fill.role === "take_profit"
      ? "Target"
      : fill.role === "stop_loss"
      ? "Stop"
      : "Manual close",
    tags: ["demo"],
    notes: "",
    rating: null,
    reviewedAt: null,
    sourceImportId: PAPER_JOURNAL_IMPORT_ID,
    sourceFile: accountName,
    sourceRows: [],
    contractClass: contractClass(fill.symbol),
    tradingAccountName: accountName,
    fingerprint: "",
  };
  return { ...trade, fingerprint: journalTradeFingerprint(trade) };
}

function entryFillFor(account: PaperAccountLedger, exit: PaperTradeFill) {
  return account.fills.find(
    (candidate) => candidate.positionId === exit.positionId && candidate.role === "entry",
  ) ?? null;
}

/**
 * Copy any closed demo trade the journal has not already recorded.
 *
 * Strictly additive. A trade already present is left untouched even if the
 * ledger no longer knows about it, which is exactly the case after the trader
 * clears their fills or resets the account.
 *
 * Returns the SAME state object when there is nothing to add, so a caller can
 * skip a write without comparing contents.
 */
export function appendPaperTradesToJournal(
  state: JournalState,
  records: readonly PaperTradingAccountRecord[],
  ledger: PaperTradingLedger,
  now = Date.now(),
): JournalState {
  const withAccounts = ensurePaperJournalAccounts(state, records, now);
  const known = new Set(withAccounts.trades.map((trade) => trade.id));
  const nameById = new Map(records.map((record) => [record.id, paperJournalAccountName(record)]));

  const added: JournalTrade[] = [];
  for (const [accountId, account] of Object.entries(ledger.accounts)) {
    const accountName = nameById.get(accountId);
    // A ledger for an account that no longer exists still holds real history,
    // but there is no name to file it under, so it is left alone rather than
    // filed somewhere arbitrary.
    if (!accountName) continue;
    for (const fill of account.fills) {
      if (!isExitFill(fill)) continue;
      if (known.has(`${PAPER_JOURNAL_TRADE_PREFIX}${fill.id}`)) continue;
      const trade = paperFillToJournalTrade(fill, entryFillFor(account, fill), accountName);
      if (trade) added.push(trade);
    }
  }

  if (!added.length) return withAccounts;
  // Oldest first, matching how imported trades are held.
  const trades = [...withAccounts.trades, ...added]
    .sort((left, right) => Date.parse(left.closedAt ?? left.openedAt) - Date.parse(right.closedAt ?? right.openedAt));
  return { ...withAccounts, trades };
}
