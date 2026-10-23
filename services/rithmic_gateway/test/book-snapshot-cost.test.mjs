import assert from "node:assert/strict";
import test from "node:test";
import { RithmicBookStore } from "../src/book-store.mjs";

function fixture() {
  const store = new RithmicBookStore();
  store.applyOrderBook({ exchange: "CME", symbol: "NQZ6", updateType: 7,
    bidPrice: [100, 98, 99], bidSize: [1, 2, 3], askPrice: [103, 101, 102], askSize: [4, 5, 6] });
  for (let index = 0; index < 20; index++) store.applyTrade({ exchange: "CME", symbol: "NQZ6", tradePrice: 100 + index * .25, tradeSize: index + 1, aggressor: index % 2 ? 1 : 2, ssboe: 1700000000 + index });
  return { store, instrument: store.instruments.get("CME:NQZ6") };
}

test("touch-only snapshots equal full sorted book's best bid/ask without changing the source", () => {
  const { store, instrument } = fixture();
  const before = structuredClone([...instrument.bids]);
  const full = store.snapshot("CME", "NQZ6", 100, { tradeLimit: 1 });
  const touch = store.snapshot("CME", "NQZ6", 1, { tradeLimit: 1 });
  assert.deepEqual(touch.bids, full.bids.slice(0, 1));
  assert.deepEqual(touch.asks, full.asks.slice(0, 1));
  assert.deepEqual([...instrument.bids], before);
});

test("incremental snapshot trade tails exactly match the prior filter/slice semantics", () => {
  const { store, instrument } = fixture();
  const original = structuredClone(instrument.trades);
  for (const afterSequence of [0, 1, 10, 19, 20, 100]) {
    for (const tradeLimit of [0, 1, 3, 256]) {
      const expected = tradeLimit > 0 ? instrument.trades.filter(t => !afterSequence || Number(t.sequence) > afterSequence).slice(-tradeLimit) : [];
      assert.deepEqual(store.snapshot("CME", "NQZ6", 1, { afterSequence, tradeLimit }).trades, expected);
    }
  }
  assert.deepEqual(instrument.trades, original);
});

test("a two-trade incremental snapshot reads only a bounded tail, not the full retained ring", () => {
  const { store, instrument } = fixture();
  const source = instrument.trades;
  let reads = 0;
  instrument.trades = new Proxy(source, { get(target, key, receiver) { if (/^\d+$/.test(String(key))) reads++; return Reflect.get(target, key, receiver); } });
  store.snapshot("CME", "NQZ6", 1, { afterSequence: 1, tradeLimit: 2 });
  assert.ok(reads <= 2, `${reads} retained records were scanned`);
});

test("restored negative history cursors preserve full snapshots and live-only cursor results", () => {
  const { store, instrument } = fixture();
  instrument.trades.unshift(...[-3, -2, -1].map(sequence => ({ sequence, price: 99, size: 1 })));
  for (const afterSequence of [0, 1, 18, 20]) {
    for (const tradeLimit of [0, 1, 5, 256]) {
      const expected = tradeLimit > 0
        ? instrument.trades.filter(trade => afterSequence <= 0 || Number(trade.sequence) > afterSequence).slice(-tradeLimit)
        : [];
      assert.deepEqual(store.snapshot("CME", "NQZ6", 1, { afterSequence, tradeLimit }).trades, expected);
    }
  }
});
