import assert from "node:assert/strict";
import { createPaperTradingAccount } from "../src/lib/paperAccounts.ts";
import {
  emptyPaperTradingLedger,
  placePaperOrder,
  processPaperQuote,
} from "../src/lib/paperTrading.ts";

/**
 * Stops and targets fill when the market reaches them.
 *
 * Reported as "i dont think sl and tp are working when they are hit on this
 * theme". A theme cannot change whether a level fills, but on Chromey Mono the
 * stop line was drawn in the chart's own background colour and was therefore
 * invisible - so there was no way to see a stop sitting there, and no way to
 * see it go. These checks pin the behaviour itself so the question can be
 * answered with a test rather than with an opinion about the rendering.
 *
 * The trigger is a CROSSING test, not a level test: it fires when the mark was
 * on one side of the level and is now on the other. That is deliberate - it
 * stops a level firing repeatedly while price sits on it - and it is the part
 * most likely to hide a real bug, because a crossing needs a correct previous
 * mark to compare against.
 */

globalThis.window = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 },
  dispatchEvent: () => true,
};
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const TICK = 0.25;
const live = { executionAuthorized: true };
let clock = 1_700_000_000_000;
const book = (last) => ({ bid: last - TICK, ask: last + TICK, last, timestamp: (clock += 1_000) });

function openPosition(side, entry, { stopLoss = null, takeProfits = [] } = {}) {
  const record = createPaperTradingAccount({ name: "sim", balance: 50_000, leverage: "1:1", instrument: "NQ" });
  const result = placePaperOrder(emptyPaperTradingLedger(), [record], {
    accountId: record.id, symbol: "NQ", side, type: "market", quantity: 1,
    price: null, stopLoss, takeProfits,
  }, book(entry));
  assert.equal(result.error, undefined, `order rejected: ${result.error}`);
  const open = result.ledger.accounts[record.id].positions.filter((p) => p.status === "open");
  assert.equal(open.length, 1, "the market order did not open a position");
  return { record, ledger: result.ledger };
}

const openCount = (ledger, id) =>
  ledger.accounts[id].positions.filter((position) => position.status === "open").length;
/** The roles of every fill recorded on the account, newest last. */
const fillRoles = (ledger, id) => (ledger.accounts[id].fills ?? []).map((fill) => fill.role);

check("a long's stop fills when price trades down through it", () => {
  const { record, ledger } = openPosition("buy", 24_000, { stopLoss: 23_990 });
  const after = processPaperQuote(ledger, [record], "NQ", book(23_985), live);
  assert.equal(openCount(after, record.id), 0, "the stop did not fill");
  // Recorded as a stop, not as a manual close - the journal and the P&L
  // attribution both read this.
  assert.ok(fillRoles(after, record.id).includes("stop_loss"), "the fill was not recorded as a stop");
});

check("a long's target fills when price trades up through it", () => {
  const { record, ledger } = openPosition("buy", 24_000, {
    takeProfits: [{ price: 24_010, quantity: 1 }],
  });
  const after = processPaperQuote(ledger, [record], "NQ", book(24_015), live);
  assert.equal(openCount(after, record.id), 0, "the target did not fill");
  assert.ok(fillRoles(after, record.id).includes("take_profit"), "the fill was not recorded as a target");
});

check("a short's stop fills when price trades up through it", () => {
  // The side comparison inverts here; getting it wrong leaves a short's stop
  // permanently unarmed, which is exactly the reported symptom.
  const { record, ledger } = openPosition("sell", 24_000, { stopLoss: 24_010 });
  const after = processPaperQuote(ledger, [record], "NQ", book(24_015), live);
  assert.equal(openCount(after, record.id), 0, "the short's stop did not fill");
});

check("a short's target fills when price trades down through it", () => {
  const { record, ledger } = openPosition("sell", 24_000, {
    takeProfits: [{ price: 23_990, quantity: 1 }],
  });
  const after = processPaperQuote(ledger, [record], "NQ", book(23_985), live);
  assert.equal(openCount(after, record.id), 0, "the short's target did not fill");
});

check("a level is reached exactly, not only passed", () => {
  // A stop at 23,990 with price printing 23,990 has been hit. Requiring a
  // strictly lower print makes a stop that price sat on look like it failed.
  const { record, ledger } = openPosition("buy", 24_000, { stopLoss: 23_990 });
  const after = processPaperQuote(ledger, [record], "NQ", book(23_990), live);
  assert.equal(openCount(after, record.id), 0, "a print exactly at the stop did not fill it");
});

check("a gap straight through the level still fills", () => {
  // One quote, entry to well beyond the stop, with nothing in between. The
  // crossing test has to compare against the mark the position opened at.
  const { record, ledger } = openPosition("buy", 24_000, { stopLoss: 23_990 });
  const after = processPaperQuote(ledger, [record], "NQ", book(23_900), live);
  assert.equal(openCount(after, record.id), 0, "a gap through the stop did not fill it");
});

check("a level that has not been reached does not fill", () => {
  const { record, ledger } = openPosition("buy", 24_000, {
    stopLoss: 23_990, takeProfits: [{ price: 24_010, quantity: 1 }],
  });
  const after = processPaperQuote(ledger, [record], "NQ", book(24_005), live);
  assert.equal(openCount(after, record.id), 1, "the position closed without reaching either level");
});

check("a stop still fills after several quotes that did not reach it", () => {
  /*
   * The crossing test carries a watermark between quotes. If that watermark is
   * not maintained, a stop arms once and then stops working - which would look
   * exactly like "sometimes they fire and sometimes they do not".
   */
  let { record, ledger } = openPosition("buy", 24_000, { stopLoss: 23_990 });
  for (const price of [24_002, 23_998, 23_995, 23_992]) {
    ledger = processPaperQuote(ledger, [record], "NQ", book(price), live);
    assert.equal(openCount(ledger, record.id), 1, `closed early at ${price}`);
  }
  ledger = processPaperQuote(ledger, [record], "NQ", book(23_989), live);
  assert.equal(openCount(ledger, record.id), 0, "the stop stopped working after earlier quotes");
});

console.log(`\npaper protection triggers: ${passed}/${passed} checks passed`);
