import type { InstitutionalTrade } from "./institutionalMarketData";
import type { PaperTradingAccountRecord } from "./paperAccounts";
import { processPaperQuote, type PaperQuoteProcessingOptions, type PaperTradingLedger } from "./paperTrading";

/** Execute the real tape in arrival order, never an OHLC path or a sampled quote.
 * Equal timestamps are intentional: multiple executions can share a millisecond.
 * Historical seeds must not be passed here as newly arriving executions.
 */
export function processPaperExecutionTape(
  ledger: PaperTradingLedger,
  accounts: PaperTradingAccountRecord[],
  symbol: string,
  records: readonly InstitutionalTrade[],
  options: Omit<PaperQuoteProcessingOptions, "executionAuthorized"> = {},
) {
  let next = ledger;
  for (const record of records) {
    if (record.flowOnly || record.footprintSummary
      || !Number.isFinite(record.timestamp) || record.timestamp <= 0
      || !Number.isFinite(record.close) || record.close <= 0
      || !Number.isFinite(record.volume) || record.volume <= 0) continue;
    // This is an execution price, not a fabricated spread. Working simulated
    // orders trigger on last; their fills retain their configured tick price.
    next = processPaperQuote(next, accounts, symbol, {
      bid: record.close, ask: record.close, last: record.close, timestamp: record.timestamp,
    }, { ...options, executionAuthorized: true });
  }
  return next;
}
