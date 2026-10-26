import { normalizePaperSymbol, type PaperOrder, type PaperQuote, type PaperTradingLedger } from "./paperTrading";
import type { InstitutionalTrade } from "./institutionalMarketData";

type ExecutionQuote = PaperQuote & { symbol: string; source: string; receivedAt: number };

/** An actual incoming execution can price a simulated order when its chart is
 * closed. This is a last-trade price, not an invented bid/ask spread or seed. */
export function paperTradeExecutionQuote(symbol: string, records: readonly InstitutionalTrade[], receivedAt: number) {
  for (let index = records.length - 1; index >= 0; index--) {
    const row = records[index];
    if (row.flowOnly || row.footprintSummary || !Number.isFinite(row.close) || row.close <= 0 || !(row.volume > 0)) continue;
    const candidate = { symbol, source: "live", bid: row.close, ask: row.close, last: row.close, timestamp: row.timestamp, receivedAt };
    if (freshPaperExecutionQuote(candidate, symbol, receivedAt)) return candidate;
  }
  return null;
}

export function freshPaperExecutionQuote(candidate: ExecutionQuote | null | undefined, symbol: string, now: number): PaperQuote | null {
  if (!candidate || candidate.source !== "live" || normalizePaperSymbol(candidate.symbol) !== normalizePaperSymbol(symbol)) return null;
  const sourceAge = now - candidate.timestamp;
  const receiptAge = now - candidate.receivedAt;
  if (!Number.isFinite(sourceAge) || !Number.isFinite(receiptAge)
    || sourceAge < -5_000 || sourceAge > 5_000 || receiptAge < -5_000 || receiptAge > 5_000
    || !Number.isFinite(candidate.bid) || !Number.isFinite(candidate.ask)
    || candidate.bid <= 0 || candidate.ask < candidate.bid) return null;
  // Placement happens now. Delayed executions preceding the click must not
  // hit a stop/target on a position that did not exist at their timestamp.
  return { bid: candidate.bid, ask: candidate.ask, last: candidate.last, timestamp: now };
}

export function paperOrderReceipt(result: { ledger: PaperTradingLedger; order: PaperOrder; error?: string }) {
  if (result.error) return { status: "error" as const, error: result.error };
  const account = result.ledger.accounts[result.order.accountId];
  const order = account?.orders.find(row => row.id === result.order.id);
  if (!account || !order) return { status: "error" as const, error: "The order was not recorded. No fill is confirmed." };
  if (order.status === "working" && order.type !== "market") return { status: "working" as const, order };
  const fill = account.fills.find(row => row.orderId === order.id && row.role === "entry");
  const position = account.positions.find(row => row.id === order.positionId && row.status === "open" && row.remainingQuantity > 0);
  if (order.status !== "filled" || !fill || !position || fill.positionId !== position.id
    || fill.quantity !== order.quantity || position.quantity !== order.quantity || fill.price !== position.entryPrice) {
    return { status: "error" as const, error: "The order has no matching fill and open position. No fill is confirmed." };
  }
  return { status: "filled" as const, order, fill, position };
}
