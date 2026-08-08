import test from "node:test";
import assert from "node:assert/strict";
import {
  databentoEventTimestampMs,
  databentoTradeAggressor,
} from "../src/lib/tradeAggressor.ts";

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

test("parses Databento nanosecond ISO timestamps without dropping trades", () => {
  assert.equal(
    databentoEventTimestampMs("2026-08-07T13:29:59.999740343Z"),
    Date.parse("2026-08-07T13:29:59.999Z"),
  );
  assert.equal(
    databentoEventTimestampMs("2026-08-07T13:29:59.123456789+00:00"),
    Date.parse("2026-08-07T13:29:59.123+00:00"),
  );
});

test("parses numeric nanosecond timestamps into milliseconds", () => {
  assert.equal(databentoEventTimestampMs(1_786_109_399_999_740_000), 1_786_109_399_999);
  assert.equal(databentoEventTimestampMs("1786109399999740000"), 1_786_109_399_999);
});
