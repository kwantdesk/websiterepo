import assert from "node:assert/strict";
import { createPaperTradingAccount } from "../src/lib/paperAccounts.ts";
import {
  emptyPaperTradingLedger,
  placePaperOrder,
  processPaperQuote,
} from "../src/lib/paperTrading.ts";

/**
 * A level that trades must fill.
 *
 * A resting sell limit at 24,000 sits in the offer queue at 24,000. When the
 * market trades there the book is typically bid 23,999.75 / ask 24,000 - so a
 * rule of "fill when the BID reaches 24,000" needs the market to run a full
 * tick PAST the order before anything happens. The trader watches price print
 * at their level and nothing fills.
 *
 * The same arithmetic applied to take profits and stops, which are tested
 * against the executable touch: a long's target at 24,000 was compared to the
 * bid, which sits a tick below the print that reached it.
 *
 * The gateway already sends the executed price on a trade packet, so a level
 * is now tested against the print. Quote-only packets fall back to the touch
 * exactly as before, and nothing may fill on a display-only quote.
 */

globalThis.window = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 },
  dispatchEvent: () => true,
};
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const TICK = 0.25;
const account = () => createPaperTradingAccount({ name: "sim", balance: 50_000, leverage: "1:1", instrument: "NQ" });
const live = { executionAuthorized: true };

/** A one-tick-wide book with the print sitting on the offer. */
const bookAt = (bid, last) => ({ bid, ask: bid + TICK, last, timestamp: 1_700_000_000_000 });

function restingOrder(side, type, price, quote) {
  const record = account();
  const result = placePaperOrder(emptyPaperTradingLedger(), [record], {
    accountId: record.id, symbol: "NQ", side, type, quantity: 1,
    price, stopLoss: null, takeProfits: [],
  }, quote);
  assert.equal(result.error, undefined, `order rejected: ${result.error}`);
  assert.equal(result.order.status, "working", "it must rest, not fill on placement");
  return { record, ledger: result.ledger };
}

const openPositions = (ledger, id) =>
  ledger.accounts[id].positions.filter((position) => position.status === "open");

check("a sell limit fills when price TRADES at it, without going through", () => {
  // THE REPORTED FAILURE. Sell limit at 24,000 placed while the market is
  // below it, then a print lands exactly on the level.
  const placedAt = bookAt(23_990, 23_990);
  const { record, ledger } = restingOrder("sell", "limit", 24_000, placedAt);

  // Price rises until it prints AT 24,000 - the bid is still a tick below.
  const tap = bookAt(23_999.75, 24_000);
  assert.ok(tap.bid < 24_000, "the bid must not have reached the level");
  const next = processPaperQuote(ledger, [record], "NQ", tap, live);

  const open = openPositions(next, record.id);
  assert.equal(open.length, 1, "a print at the limit price must fill it");
  assert.equal(open[0].side, "sell");
  assert.equal(open[0].entryPrice, 24_000, "a resting limit fills at its own price");
});

check("a buy limit fills when price trades down to it", () => {
  const { record, ledger } = restingOrder("buy", "limit", 24_000, bookAt(24_010, 24_010));
  // Print at the level while the ask is still a tick above.
  const tap = { bid: 23_999.75, ask: 24_000.25, last: 24_000, timestamp: 1_700_000_001_000 };
  assert.ok(tap.ask > 24_000, "the ask must not have reached the level");
  const open = openPositions(processPaperQuote(ledger, [record], "NQ", tap, live), record.id);
  assert.equal(open.length, 1, "a print at the limit price must fill it");
  assert.equal(open[0].entryPrice, 24_000);
});

check("a limit still fills when it is marketable against the touch", () => {
  // The path that already worked must keep working, and keep its price
  // improvement: a sell limit below the bid fills at the better bid.
  const { record, ledger } = restingOrder("sell", "limit", 24_000, bookAt(23_990, 23_990));
  const through = { bid: 24_002, ask: 24_002.25, timestamp: 1_700_000_002_000 };
  const open = openPositions(processPaperQuote(ledger, [record], "NQ", through, live), record.id);
  assert.equal(open.length, 1);
  assert.equal(open[0].entryPrice, 24_002, "selling into a higher bid is price improvement");
});

check("a level that never trades still does not fill", () => {
  // The fix must not turn every resting order into a market order.
  const { record, ledger } = restingOrder("sell", "limit", 24_000, bookAt(23_990, 23_990));
  const short = bookAt(23_995, 23_995.25);
  assert.equal(openPositions(processPaperQuote(ledger, [record], "NQ", short, live), record.id).length, 0);
});

check("a take profit closes when price trades at it", () => {
  // Same arithmetic, other end of the trade: a long's target tested against
  // the bid missed the print that reached it.
  const record = account();
  const entry = placePaperOrder(emptyPaperTradingLedger(), [record], {
    accountId: record.id, symbol: "NQ", side: "buy", type: "market", quantity: 1,
    price: null, stopLoss: 23_980, takeProfits: [{ price: 24_000, quantity: 1 }],
  }, bookAt(23_990, 23_990));
  assert.equal(entry.error, undefined, `entry rejected: ${entry.error}`);

  const tap = bookAt(23_999.75, 24_000);
  const next = processPaperQuote(entry.ledger, [record], "NQ", tap, live);
  assert.equal(openPositions(next, record.id).length, 0, "the target must close the position");
  const exit = next.accounts[record.id].fills.find((fill) => fill.role === "take_profit");
  assert.ok(exit, "a take-profit fill must be recorded");
  assert.equal(exit.price, 24_000, "it fills at the target, not the touch");
});

check("a stop loss closes when price trades at it", () => {
  const record = account();
  const entry = placePaperOrder(emptyPaperTradingLedger(), [record], {
    accountId: record.id, symbol: "NQ", side: "buy", type: "market", quantity: 1,
    price: null, stopLoss: 23_980, takeProfits: [],
  }, bookAt(23_990, 23_990));
  assert.equal(entry.error, undefined, `entry rejected: ${entry.error}`);

  // Print at the stop while the bid is a tick above it.
  const tap = { bid: 23_980.25, ask: 23_980.5, last: 23_980, timestamp: 1_700_000_003_000 };
  const next = processPaperQuote(entry.ledger, [record], "NQ", tap, live);
  assert.equal(openPositions(next, record.id).length, 0, "the stop must close the position");
  const exit = next.accounts[record.id].fills.find((fill) => fill.role === "stop_loss");
  assert.ok(exit && exit.price === 23_980, "it fills at the stop");
});

check("a display-only quote still cannot fill anything", () => {
  // Watchlist and cached quotes mark to market; they must never execute, print
  // or not. This is the guard that keeps a stale price from inventing a fill.
  const { record, ledger } = restingOrder("sell", "limit", 24_000, bookAt(23_990, 23_990));
  const next = processPaperQuote(ledger, [record], "NQ", bookAt(24_050, 24_050), { executionAuthorized: false });
  assert.equal(openPositions(next, record.id).length, 0, "an unauthorised quote must not fill a resting order");
});

check("a packet with no print behaves exactly as it did", () => {
  // Quote-only packets fall back to the touch, so a tap with no trade
  // attached is still not a fill.
  const { record, ledger } = restingOrder("sell", "limit", 24_000, bookAt(23_990, 23_990));
  const quoteOnly = { bid: 23_999.75, ask: 24_000, timestamp: 1_700_000_004_000 };
  assert.equal(openPositions(processPaperQuote(ledger, [record], "NQ", quoteOnly, live), record.id).length, 0);
});

console.log(`\npaper limit fills: ${passed}/${passed} checks passed`);
