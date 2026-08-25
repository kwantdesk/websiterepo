import assert from "node:assert/strict";
import { createPaperTradingAccount } from "../src/lib/paperAccounts.ts";
import {
  emptyPaperTradingLedger,
  paperContractNotional,
  paperRequiredMargin,
  placePaperOrder,
  summarizePaperAccount,
} from "../src/lib/paperTrading.ts";

/**
 * Pressing Buy has to fill.
 *
 * A futures contract is not bought with its notional value. One NQ carries
 * about $588,000 of index exposure at 29,400 and the exchange asks a fixed
 * performance bond of a few thousand to hold it. The desk charged the full
 * face value divided by a 1:1 default leverage, so a single NQ needed
 * $588,000 of a $50,000 account and every order came straight back as
 * "insufficient available funds" — the buy button appearing to do nothing.
 *
 * The same wrong sum appeared in three places that had to agree: the check
 * that accepts the order, the margin stamped on the position, and the summary
 * that reports available funds.
 */

globalThis.window = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  dispatchEvent: () => true,
};
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const QUOTE = { bid: 29_400.25, ask: 29_400.75, timestamp: 1_700_000_000_000 };
const account = () => createPaperTradingAccount({ name: "sim", balance: 50_000, leverage: "1:1", instrument: "NQ" });
const marketBuy = (id, symbol, quantity, extra = {}) => ({
  accountId: id, symbol, side: "buy", type: "market", quantity,
  price: null, stopLoss: null, takeProfits: [], ...extra,
});

check("a bond is nothing like the contract's face value", () => {
  const notional = paperContractNotional("NQ", 29_400.5, 1);
  const margin = paperRequiredMargin("NQ", 29_400.5, 1, 1);
  assert.ok(notional > 500_000, `NQ notional should be over half a million, got ${notional}`);
  assert.ok(margin < notional / 10, "margin must be a bond, not the face value");
  assert.ok(margin > 0);
  // A micro is a tenth of the mini, and must be affordable on a small account.
  assert.ok(paperRequiredMargin("MNQ", 29_400.5, 1, 1) < margin);
});

check("one NQ fills on a fifty thousand dollar account", () => {
  // THE REPORTED FAILURE.
  const record = account();
  const result = placePaperOrder(emptyPaperTradingLedger(), [record],
    marketBuy(record.id, "NQ", 1), QUOTE);
  assert.equal(result.error, undefined, `rejected: ${result.error}`);
  assert.equal(result.order.status, "filled");
  const open = result.ledger.accounts[record.id].positions.filter((p) => p.status === "open");
  assert.equal(open.length, 1, "a market order must open a position");
  assert.ok(open[0].entryPrice > 0);
});

check("the three margin sums agree", () => {
  // They must, or an order accepted by one is refused by another and the
  // ticket shows a number the engine disagrees with.
  const record = account();
  const result = placePaperOrder(emptyPaperTradingLedger(), [record],
    marketBuy(record.id, "NQ", 1), QUOTE);
  const position = result.ledger.accounts[record.id].positions.find((p) => p.status === "open");
  const expected = paperRequiredMargin("NQ", position.entryPrice, 1, position.leverage);
  assert.equal(position.marginUsed, expected, "the position must carry the bond it was accepted against");
  const summary = summarizePaperAccount(result.ledger, record);
  assert.equal(summary.availableFunds, summary.balance - expected, "available funds must deduct that same bond");
});

check("a filled position leaves room for another", () => {
  // One NQ used to swallow the whole account, so nothing could follow it.
  const record = account();
  let ledger = emptyPaperTradingLedger();
  ledger = placePaperOrder(ledger, [record], marketBuy(record.id, "NQ", 1), QUOTE).ledger;
  const after = summarizePaperAccount(ledger, record);
  assert.ok(after.availableFunds > 0, "a single contract must not consume the account");
  const second = placePaperOrder(ledger, [record], marketBuy(record.id, "MNQ", 1), QUOTE);
  assert.equal(second.error, undefined, `a micro must still fit: ${second.error}`);
});

check("an order genuinely beyond the account is still refused", () => {
  // The fix must not turn the risk check off.
  const record = account();
  const result = placePaperOrder(emptyPaperTradingLedger(), [record],
    marketBuy(record.id, "NQ", 50), QUOTE);
  assert.equal(result.order.status, "rejected");
  assert.match(result.error ?? "", /Insufficient available funds/);
});

check("leverage only ever makes room", () => {
  const base = paperRequiredMargin("NQ", 29_400.5, 1, 1);
  assert.ok(paperRequiredMargin("NQ", 29_400.5, 1, 10) < base, "leverage must reduce the bond");
  assert.equal(paperRequiredMargin("NQ", 29_400.5, 1, 0), base, "a nonsense leverage cannot inflate it");
  assert.equal(paperRequiredMargin("NQ", 29_400.5, 1, 0.1), base);
});

check("an instrument with no exchange bond still charges something", () => {
  // Cash instruments have no performance bond, so a fraction of notional is
  // the honest requirement rather than nothing at all.
  const margin = paperRequiredMargin("SPY", 600, 100, 1);
  assert.ok(margin > 0, "a cash position must still consume funds");
  assert.ok(margin < paperContractNotional("SPY", 600, 100), "but not its whole value");
});

console.log(`\npaper margin: ${passed}/${passed} checks passed`);
