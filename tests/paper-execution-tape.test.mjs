import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createPaperTradingAccount } from "../src/lib/paperAccounts.ts";
import { emptyPaperTradingLedger, placePaperOrder, processPaperQuote } from "../src/lib/paperTrading.ts";
import { processPaperExecutionTape } from "../src/lib/paperExecutionTape.ts";
import { createExecutionTapeEngine } from "../src/lib/executionTapeEngine.ts";

const time = 1_790_000_000_000;
const print = (close, timestamp = time + 1, recordIndex = 1) => ({
  timestamp, recordIndex, eventId: `trade-${recordIndex}`, open: close, high: close,
  low: close, close, volume: 1, trades: 1, bidVolume: 0, askVolume: 1, delta: 1, aggressor: "BUY",
});
function open(side = "buy", quantity = 1, targets) {
  const record = createPaperTradingAccount({ name: "isolated test", balance: 250000, leverage: "1:1", instrument: "NQ" });
  const result = placePaperOrder(emptyPaperTradingLedger(), [record], {
    accountId: record.id, symbol: "NQ.c.0", side, type: "market", quantity,
    price: null, stopLoss: side === "buy" ? 23990 : 24010,
    takeProfits: targets ?? [{ price: side === "buy" ? 24010 : 23990, quantity }],
  }, { bid: 24000, ask: 24000, last: 24000, timestamp: time });
  assert.equal(result.error, undefined);
  return { record, ledger: result.ledger };
}
const exits = (ledger, id) => ledger.accounts[id].fills.filter((fill) => fill.role !== "entry");

for (const side of ["buy", "sell"]) {
  for (const role of ["take_profit", "stop_loss"]) {
    test(`${side} ${role}: a one-print wick fills exactly, despite immediate reversal`, () => {
      const { record, ledger } = open(side);
      const hit = (side === "buy") === (role === "take_profit") ? 24010 : 23990;
      const batch = [print(24001, time + 1, 1), print(hit, time + 1, 2), print(24000, time + 1, 3)];
      // Reproduce the old sampled-price failure using exactly the same batch.
      const sampled = processPaperQuote(ledger, [record], "NQ", { bid: 24000, ask: 24000, last: batch.at(-1).close, timestamp: time + 1 }, { executionAuthorized: true });
      assert.equal(exits(sampled, record.id).length, 0);
      const next = processPaperExecutionTape(ledger, [record], "NQ", batch);
      assert.equal(exits(next, record.id).length, 1);
      assert.equal(exits(next, record.id)[0].role, role);
      assert.equal(exits(next, record.id)[0].price, hit);
      assert.equal(next.accounts[record.id].positions.filter((position) => position.status === "open").length, 0);
      const duplicate = processPaperExecutionTape(next, [record], "NQ", batch);
      assert.equal(exits(duplicate, record.id).length, 1);
    });
  }
}

for (const prices of [[24010, 23990], [23990, 24010]]) {
  test(`actual arrival order wins when both exits are hit: ${prices.join(" then ")}`, () => {
    const { record, ledger } = open();
    const next = processPaperExecutionTape(ledger, [record], "NQ", prices.map((price, index) => print(price, time + 1, index)));
    assert.deepEqual(exits(next, record.id).map((fill) => fill.price), [prices[0]]);
  });
}

test("partial targets followed by stop in one batch keep exact quantities and ticks", () => {
  const { record, ledger } = open("buy", 3, [{ price: 24005, quantity: 1 }, { price: 24010, quantity: 1 }]);
  const next = processPaperExecutionTape(ledger, [record], "NQ", [24006, 24012, 23985, 24000].map((price, index) => print(price, time + index + 1, index)));
  assert.deepEqual(exits(next, record.id).map(({ price, quantity }) => [price, quantity]), [[24005, 1], [24010, 1], [23990, 1]]);
});

test("display quote cannot preempt a slightly later arriving exact tape batch", () => {
  const { record, ledger } = open();
  const display = processPaperQuote(ledger, [record], "NQ", { bid: 24000, ask: 24000, timestamp: time + 100 }, { executionAuthorized: false });
  const next = processPaperExecutionTape(display, [record], "NQ", [print(24010, time + 1), print(24000, time + 2, 2)]);
  assert.equal(exits(next, record.id)[0].price, 24010);
});

test("a gap still fills the stored NQ quarter-tick target, not the overshoot price", () => {
  const { record, ledger } = open("buy", 1, [{ price: 24010.25, quantity: 1 }]);
  const next = processPaperExecutionTape(ledger, [record], "NQ", [print(24015.75)]);
  assert.equal(exits(next, record.id)[0].price, 24010.25);
});

test("pre-entry, aggregate, summary, invalid and wrong-symbol records cannot fill", () => {
  const { record, ledger } = open();
  const ignored = [print(24010, time - 1), { ...print(24010), flowOnly: true },
    { ...print(24010), footprintSummary: {} }, print(NaN), print(-1), { ...print(24010), volume: 0 }];
  assert.equal(processPaperExecutionTape(ledger, [record], "NQ", ignored), ledger);
  assert.equal(processPaperExecutionTape(ledger, [record], "ES", [print(24010)]), ledger);
});

test("suspended protection stays suspended, then resumes on subsequent actual crossing", () => {
  const { record, ledger } = open();
  const positionId = ledger.accounts[record.id].positions[0].id;
  const held = processPaperExecutionTape(ledger, [record], "NQ", [print(24010)], { suspendedProtectionPositionIds: new Set([positionId]) });
  assert.equal(exits(held, record.id).length, 0);
  const resumed = processPaperExecutionTape(held, [record], "NQ", [print(24000, time + 2), print(24010, time + 3, 3)]);
  assert.equal(exits(resumed, record.id)[0].price, 24010);
});

test("a delayed print before a resting order existed cannot create an entry", () => {
  const { record } = open();
  const result = placePaperOrder(emptyPaperTradingLedger(), [record], {
    accountId: record.id, symbol: "NQ", side: "buy", type: "limit", quantity: 1,
    price: 23995, stopLoss: 23990, takeProfits: [{ price: 24010, quantity: 1 }],
  }, { bid: 24000, ask: 24000, timestamp: time });
  const next = processPaperExecutionTape(result.ledger, [record], "NQ", [print(23995, time - 1)]);
  assert.equal(next, result.ledger);
});

test("disconnect flushes admitted executions rather than deduplicating them away forever", async () => {
  const previousFetch = globalThis.fetch;
  const previousEventSource = globalThis.EventSource;
  let stream;
  class FakeSource {
    listeners = new Map();
    constructor() { stream = this; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    emit(name, payload) { this.listeners.get(name)?.({ data: JSON.stringify(payload) }); }
    close() {}
  }
  globalThis.fetch = async () => ({ ok: true });
  globalThis.EventSource = FakeSource;
  let { record, ledger } = open();
  const engine = createExecutionTapeEngine("NQ", "NQZ6", {
    onStatus() {}, onContinuity() {}, onSeed() {},
    onTrades(records) { ledger = processPaperExecutionTape(ledger, [record], "NQ", records); },
  });
  try {
    engine.start();
    await new Promise((resolve) => setImmediate(resolve));
    stream.emit("seed", { streamId: "s", batchSequence: 0, continuity: "continuous", records: [print(24010, time - 10, 99)] });
    assert.equal(exits(ledger, record.id).length, 0, "seed must not execute");
    stream.emit("trades", { streamId: "s", batchSequence: 1, continuity: "continuous", records: [print(24010)] });
    assert.equal(exits(ledger, record.id).length, 0, "the 40ms fanout is still queued");
    stream.onerror();
    assert.equal(exits(ledger, record.id)[0].price, 24010);
  } finally {
    engine.stop();
    globalThis.fetch = previousFetch;
    globalThis.EventSource = previousEventSource;
  }
});

test("workspace owns exact protection outside chart sampling and seeds", () => {
  const source = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('executionAuthorized: quote.source === "replay" || !paperContractSpec(quote.symbol).isFutures'));
  const owner = source.slice(source.indexOf("const paperLiveExecutionEnabled ="), source.indexOf("// Step the GEX Vue replay clock"));
  assert.ok(owner.includes('position.status === "open"'));
  assert.ok(owner.includes('order.status === "working"'));
  assert.ok(owner.includes("processPaperExecutionTape(current"));
  assert.ok(!owner.includes("onSeed:"));
  assert.ok(!owner.includes("new EventSource"));
  assert.ok(owner.includes("if (subscriptions.has(key)) continue;"), "changing the selected chart must not restart protection for other open positions");
  const start = source.indexOf("* Resting orders reconciled against the bars");
  const reconcile = source.slice(start, source.indexOf("const onVisible = () =>", start));
  assert.ok(reconcile.includes("let next = paperLedgerRef.current;"), "apply history to current ledger, never overwrite an intervening live exit");
  assert.ok(!reconcile.slice(reconcile.indexOf("let next = paperLedgerRef.current;")).includes("await "));
});
