import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { freshPaperExecutionQuote, paperOrderReceipt, paperTradeExecutionQuote } from "../src/lib/paperOrderReceipt.ts";
import { emptyPaperTradingLedger, placePaperOrder, parsePaperPriceInput } from "../src/lib/paperTrading.ts";
import { processPaperExecutionTape } from "../src/lib/paperExecutionTape.ts";

const now = 1793000000000;
const account = { id: "fixture-account", name: "20 october fixture", balance: "$50,000.00", leverage: "1:30" };
const quote = { symbol: "NQ", source: "live", receivedAt: now, timestamp: now - 1000, bid: 24000, ask: 24000.25, last: 24000 };
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

test("fresh quotes keep the true price but stamp the actual click time", () => {
  const selected = freshPaperExecutionQuote(quote, "NQ", now);
  assert.equal(selected.timestamp, now);
  assert.equal(selected.ask, 24000.25);
  for (const patch of [{ timestamp: now - 5001 }, { receivedAt: now - 5001 }, { symbol: "ES" }, { source: "replay" }, { ask: 23999 }, { bid: NaN }]) {
    assert.equal(freshPaperExecutionQuote({ ...quote, ...patch }, "NQ", now), null);
  }
});

test("chart-independent pricing accepts real incoming trades, never summary/flow/history", () => {
  const row = { close: 24001, volume: 1, timestamp: now - 1 };
  assert.equal(paperTradeExecutionQuote("NQ", [row], now).bid, 24001);
  for (const patch of [{ flowOnly: true }, { footprintSummary: {} }, { timestamp: now - 5001 }, { volume: 0 }]) {
    assert.equal(paperTradeExecutionQuote("NQ", [{ ...row, ...patch }], now), null);
  }
});

function harness(overrides = {}) {
  const messages = [], persisted = [];
  const context = { preferencesReady: true, paperAccountsHydrated: true, selectedPaperTradingAccount: account,
    paperTradingAccounts: [account], paperTradingInstrument: "NQ", orderSide: "buy", orderType: "market", selectedOrderQuantity: 2,
    orderPrice: "", tpEnabled: false, slEnabled: false, selectedMidPrice: 24000,
    paperLedgerRef: { current: emptyPaperTradingLedger() },
    resolvePaperExecutionQuote: () => freshPaperExecutionQuote(quote, "NQ", now), parsePaperPriceInput, placePaperOrder, paperOrderReceipt,
    displayCmeSymbol: symbol => symbol, formatPrice: price => price.toFixed(2),
    showPaperOrderMessage: (tone, text) => messages.push({ tone, text }),
    commitPaperLedger: ledger => { context.paperLedgerRef.current = ledger; },
    savePaperTradingLedger: ledger => { persisted.push(ledger); return { ok: true }; }, ...overrides };
  const start = workspace.indexOf("  const submitPaperOrder =");
  const end = workspace.indexOf("\n  /**", start);
  const block = workspace.slice(start, end);
  vm.runInNewContext(ts.transpileModule(block + "\nglobalThis.submit=submitPaperOrder;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { context, messages, persisted, submit: context.submit };
}

for (const side of ["buy", "sell"]) {
  test(`real ${side} submit confirms a persisted entry fill, position and execution price`, () => {
    const h = harness({ orderSide: side });
    h.submit();
    assert.equal(h.messages.at(-1).tone, "success");
    assert.match(h.messages.at(-1).text, /filled at .*20 october fixture/);
    assert.equal(h.persisted.length, 1);
    const ledger = h.persisted[0].accounts[account.id];
    assert.equal(ledger.positions[0].side, side);
    assert.equal(ledger.positions[0].remainingQuantity, 2);
    assert.equal(ledger.fills[0].price, side === "buy" ? 24000.25 : 24000);
    assert.equal(ledger.orders[0].positionId, ledger.positions[0].id);
    assert.equal(ledger.orders[0].createdAt, now);
  });
}

test("missing quote, incomplete restoration, unverified fill and persistence failure cannot show filled", () => {
  for (const overrides of [
    { resolvePaperExecutionQuote: () => null },
    { preferencesReady: false },
    { paperAccountsHydrated: false },
    { placePaperOrder: (...args) => { const result = placePaperOrder(...args); result.ledger.accounts[account.id].positions = []; return result; } },
    { savePaperTradingLedger: () => ({ ok: false }) },
  ]) {
    const h = harness(overrides);
    h.submit();
    assert.equal(h.messages.at(-1).tone, "error");
    assert.equal(h.messages.some(row => row.tone === "success"), false);
  }
});

test("a pending limit is reported working, not filled", () => {
  const h = harness({ orderType: "limit", orderPrice: "23,990" });
  h.submit();
  assert.match(h.messages.at(-1).text, /working/);
  assert.equal(h.persisted[0].accounts[account.id].positions.length, 0);
});

test("a delayed pre-click execution cannot make a newly filled position vanish", () => {
  const draft = { accountId: account.id, symbol: "NQ", side: "buy", type: "market", quantity: 1, price: null, stopLoss: 23990, takeProfits: [] };
  const result = placePaperOrder(emptyPaperTradingLedger(), [account], draft, freshPaperExecutionQuote(quote, "NQ", now));
  const row = { close: 23989, volume: 1, timestamp: now - 500, delta: -1 };
  const after = processPaperExecutionTape(result.ledger, [account], "NQ", [row]);
  assert.equal(after.accounts[account.id].positions[0].status, "open");
  const actualTouch = processPaperExecutionTape(after, [account], "NQ", [{ ...row, timestamp: now + 1 }]);
  assert.equal(actualTouch.accounts[account.id].positions.some(position => position.status === "open"), false);
});

test("ticket resolver has no static-price freshness bypass and changing ticket clears old messages", () => {
  const resolver = workspace.slice(workspace.indexOf("  const resolvePaperExecutionQuote ="), workspace.indexOf("  const handleFlattenPaperPosition ="));
  assert.doesNotMatch(resolver, /currentLivePrice|watchlist\.find|timestamp: Date\.now\(\)/);
  assert.match(resolver, /freshPaperExecutionQuote\(liveExecutionQuotesBySymbol.get/);
  assert.match(workspace, /useEffect\(\(\) => \{ setOrderTicketMessage\(null\); \}, \[orderSide, orderType, orderUnits/);
});
