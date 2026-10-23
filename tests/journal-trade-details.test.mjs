import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { journalTradeDetails, formatTradeHoldDuration } from "../src/lib/journalTradeDetails.ts";
import { createPaperTradingAccount } from "../src/lib/paperAccounts.ts";
import { emptyPaperTradingLedger, placePaperOrder, closePaperPosition } from "../src/lib/paperTrading.ts";
import { appendPaperTradesToJournal } from "../src/lib/paperJournal.ts";

const trade = overrides => ({ openedAt: "2026-10-23T01:00:00Z", closedAt: "2026-10-23T01:01:05Z", durationMs: null,
  side: "LONG", entryPrice: 100, exitPrice: 105, grossPnl: 100, netPnl: 95, favourableExcursion: 200, adverseExcursion: -40, ...overrides });

test("shows exact hold duration and compares excursions with gross P&L, not net after fees", () => {
  const details = journalTradeDetails(trade());
  assert.equal(details.durationMs, 65000);
  assert.equal(details.peakProfit, 200);
  assert.equal(details.worstUnrealised, -40);
  assert.equal(details.profitGiveback, 100);
  assert.equal(details.capturePercent, 50);
  assert.equal(details.priceMove, 5);
});

test("short price move is direction aware; losing exits can give back more than the peak", () => {
  const details = journalTradeDetails(trade({ side: "SHORT", exitPrice: 95, grossPnl: -20 }));
  assert.equal(details.priceMove, 5);
  assert.equal(details.profitGiveback, 220);
  assert.equal(details.capturePercent, -10);
});

test("missing excursions are unknown, not zero or fabricated from entry and exit", () => {
  const details = journalTradeDetails(trade({ favourableExcursion: undefined, adverseExcursion: null }));
  assert.equal(details.peakProfit, null);
  assert.equal(details.worstUnrealised, null);
  assert.equal(details.capturePercent, null);
  assert.equal(details.profitGiveback, null);
  assert.equal(journalTradeDetails(trade({ favourableExcursion: 0, adverseExcursion: 0 })).peakProfit, 0);
  assert.equal(journalTradeDetails(trade({ favourableExcursion: -5, adverseExcursion: 20 })).peakProfit, null);
});

test("duration distinguishes sub-minute, multi-day, zero and missing time", () => {
  assert.equal(formatTradeHoldDuration(65000), "1m 5s");
  assert.equal(formatTradeHoldDuration(23000), "23s");
  assert.equal(formatTradeHoldDuration(0), "0ms");
  assert.equal(formatTradeHoldDuration(90061000), "1d 1h 1m 1s");
  assert.equal(formatTradeHoldDuration(null), "Not recorded");
  assert.equal(journalTradeDetails(trade({ entryTimeKnown: false })).durationMs, null);
  assert.equal(journalTradeDetails(trade({ closedAt: "2026-10-22T01:00:00Z" })).durationMs, null);
  assert.equal(journalTradeDetails(trade({ durationMs: 1000, entryTimeKnown: false })).durationMs, 1000);
});

test("cloud serialization retains excursion fields and detail UI exposes them", () => {
  const api = readFileSync(new URL("../src/app/api/journal/route.ts", import.meta.url), "utf8");
  assert.match(api, /adverseExcursion: nullableFinite\(trade.adverseExcursion\)/);
  assert.match(api, /favourableExcursion: nullableFinite\(trade.favourableExcursion\)/);
  const ui = readFileSync(new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8");
  for (const label of ["Time in trade", "Max unrealised profit", "Max unrealised loss", "Profit given back", "Entry time", "Exit time"]) assert.ok(ui.includes(label));
  const engine = readFileSync(new URL("../src/lib/paperTrading.ts", import.meta.url), "utf8");
  assert.match(engine, /Math.max\(0, realizedPnl, calculatePnl\(position, bestPrice, closeQuantity\)\)/);
  assert.match(engine, /Math.min\(0, realizedPnl, calculatePnl\(position, worstPrice, closeQuantity\)\)/);
});

test("an immediate manual close includes its final executed price in excursions and persists into journal details", () => {
  for (const exit of [24010, 23990]) {
    const record = createPaperTradingAccount({ name: "Metrics fixture", balance: 50000, leverage: "1:1", instrument: "NQ" });
    const entered = placePaperOrder(emptyPaperTradingLedger(), [record], {
      accountId: record.id, symbol: "NQ", side: "buy", type: "market", quantity: 1,
      price: null, stopLoss: null, takeProfits: [],
    }, { bid: 24000, ask: 24000, last: 24000, timestamp: 1700000000000 });
    assert.equal(entered.error, undefined);
    const position = entered.ledger.accounts[record.id].positions[0];
    const closed = closePaperPosition(entered.ledger, record.id, position.id,
      { bid: exit, ask: exit, last: exit, timestamp: 1700000002500 });
    assert.equal(closed.error, undefined);
    const journal = appendPaperTradesToJournal({ version: 1, accounts: [], trades: [], evidence: [], imports: [] }, [record], closed.ledger);
    const details = journalTradeDetails(journal.trades[0]);
    assert.equal(details.durationMs, 2500);
    assert.equal(details.peakProfit, exit > 24000 ? 200 : 0);
    assert.equal(details.worstUnrealised, exit < 24000 ? -200 : 0);
    assert.equal(details.capturePercent, exit > 24000 ? 100 : null);
  }
});
