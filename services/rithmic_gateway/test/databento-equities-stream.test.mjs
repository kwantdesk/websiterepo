import assert from "node:assert/strict";
import test from "node:test";

import { DatabentoEquitiesTradeStream } from "../src/databento-equities-stream.mjs";

function configuredStream() {
  const stream = new DatabentoEquitiesTradeStream({
    apiKey: "db-test-key",
    reconnectMinMs: 10,
    reconnectMaxMs: 100,
    symbols: ["QQQ", "SPY"],
  });
  stream.authenticated = true;
  return stream;
}

test("Databento equity mappings route nanounit trades to the correct symbol", () => {
  const stream = configuredStream();
  const quotes = [];
  stream.on("quote", (snapshot) => quotes.push(snapshot));

  stream.onData(Buffer.from([
    JSON.stringify({ hd: { instrument_id: 101 }, stype_out_symbol: "QQQ" }),
    JSON.stringify({
      hd: { instrument_id: 101, ts_event: "2026-08-18T14:30:00.000Z" },
      price: 570_250_000_000,
      size: 4,
    }),
    "",
  ].join("\n")));

  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].symbol, "QQQ");
  assert.equal(quotes[0].lastPrice, 570.25);
  assert.equal(quotes[0].provider, "Databento");
  assert.equal(quotes[0].delayed, false);
  assert.equal(quotes[0].marketOpen, true);
  assert.equal(stream.snapshot("qqq"), quotes[0]);
});

test("Databento equity trade state remains isolated per subscribed symbol", () => {
  const stream = configuredStream();
  const quotes = [];
  stream.on("quote", (snapshot) => quotes.push(snapshot));

  stream.onData(Buffer.from([
    JSON.stringify({ hd: { instrument_id: 101 }, stype_out_symbol: "QQQ" }),
    JSON.stringify({ hd: { instrument_id: 202 }, stype_out_symbol: "SPY" }),
    JSON.stringify({ hd: { instrument_id: 101, ts_event: "2026-08-18T14:30:00.000Z" }, price: 570_000_000_000 }),
    JSON.stringify({ hd: { instrument_id: 202, ts_event: "2026-08-18T14:30:00.100Z" }, price: 650_000_000_000 }),
    JSON.stringify({ hd: { instrument_id: 101, ts_event: "2026-08-18T14:30:00.200Z" }, price: 570_500_000_000 }),
    "",
  ].join("\n")));

  assert.deepEqual(quotes.map((quote) => quote.symbol), ["QQQ", "SPY", "QQQ"]);
  assert.equal(stream.snapshot("QQQ").openPrice, 570);
  assert.equal(stream.snapshot("QQQ").change, 0.5);
  assert.equal(stream.snapshot("SPY").openPrice, 650);
  assert.equal(stream.snapshot("SPY").change, 0);
});

test("a missing live entitlement disables reconnect churn and exposes the cause", () => {
  const stream = new DatabentoEquitiesTradeStream({
    apiKey: "db-test-key",
    symbols: ["QQQ"],
  });
  let destroyed = false;
  stream.socket = { destroy: () => { destroyed = true; } };
  stream.authenticated = false;

  stream.onData(Buffer.from("error=A live data license is required to access EQUS.MINI.\n"));

  assert.equal(destroyed, true);
  assert.match(stream.status().disabledReason, /live data license is required/i);
});
