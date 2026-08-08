import test from "node:test";
import assert from "node:assert/strict";
import { databentoTradeAggressor } from "../src/lib/tradeAggressor.ts";

test("maps Databento Trade sides without inverting profile delta", () => {
  assert.equal(databentoTradeAggressor("A"), "SELL");
  assert.equal(databentoTradeAggressor("S"), "SELL");
  assert.equal(databentoTradeAggressor("B"), "BUY");
  assert.equal(databentoTradeAggressor("N"), "NONE");
});

test("accepts the object enum shape returned by decoded records", () => {
  assert.equal(databentoTradeAggressor({ value: "Ask" }), "SELL");
  assert.equal(databentoTradeAggressor({ value: "Bid" }), "BUY");
});
