import assert from "node:assert/strict";
import test from "node:test";

import { MassiveIndicesStream, __test } from "../src/massive-indices-stream.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function configuredStream(fetchImpl = async () => jsonResponse({ results: [] })) {
  return new MassiveIndicesStream({
    apiKey: "massive-test-key",
    restOrigin: "https://api.massive.test",
    websocketUrl: "wss://socket.massive.test/indices",
    requestTimeoutMs: 1_000,
    symbols: ["SPX", "SPXW", "NDX", "VIX"],
  }, { fetchImpl });
}

test("one Massive SPX WebSocket value fans out to SPX and SPXW", () => {
  const stream = configuredStream();
  const quotes = [];
  stream.on("quote", (snapshot) => quotes.push(snapshot));

  stream.handleMessage(JSON.stringify([{
    ev: "V",
    T: "I:SPX",
    val: 6501.25,
    t: Date.UTC(2026, 7, 18, 14, 31, 0),
  }]));

  assert.deepEqual(quotes.map((row) => row.symbol), ["SPX", "SPXW"]);
  assert.equal(stream.snapshot("spx").lastPrice, 6501.25);
  assert.equal(stream.snapshot("SPXW").provider, "Massive");
  assert.equal(stream.snapshot("SPX").transport, "VPS WebSocket → shared SSE");
});

test("Massive REST bootstrap seeds the shared VPS cache before a live value", async () => {
  const calls = [];
  const stream = configuredStream(async (url, init) => {
    calls.push({ url, authorization: init.headers.Authorization });
    return jsonResponse({
      results: [{
        ticker: "I:NDX",
        value: 24_750.5,
        last_updated: Date.UTC(2026, 7, 18, 14, 29, 55) * 1_000_000,
        market_status: "open",
        session: { previous_close: 24_700, change: 50.5, change_percent: 0.20445 },
      }],
    });
  });

  await stream.bootstrap();

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/v3\/snapshot\?/);
  assert.equal(calls[0].authorization, "Bearer massive-test-key");
  assert.equal(stream.snapshot("NDX").lastPrice, 24_750.5);
  assert.equal(stream.snapshot("NDX").openPrice, 24_700);
  assert.equal(stream.snapshot("NDX").transport, "VPS REST bootstrap → shared SSE");
});

test("Massive index history stays server-side and is cached on the VPS", async () => {
  const calls = [];
  const stream = configuredStream(async (url) => {
    calls.push(url);
    return jsonResponse({
      results: [{ t: 1_786_455_000_000, o: 6500, h: 6502, l: 6499.5, c: 6501.25, v: 0 }],
    });
  });
  const request = {
    symbol: "SPXW",
    timeframe: "5m",
    from: Date.UTC(2026, 7, 17),
    to: Date.UTC(2026, 7, 18),
  };

  const first = await stream.history(request);
  const second = await stream.history(request);

  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/v2\/aggs\/ticker\/I%3ASPX\/range\/5\/minute\/2026-08-17\/2026-08-18/);
  assert.deepEqual(second, first);
  assert.deepEqual(first[0], {
    timestamp: 1_786_455_000_000,
    open: 6500,
    high: 6502,
    low: 6499.5,
    close: 6501.25,
    volume: 0,
  });
});

test("Massive history fallback supports GEX VUE listed underlyings without subscribing them on the index socket", async () => {
  const calls = [];
  const stream = configuredStream(async (url) => {
    calls.push(url);
    return jsonResponse({
      results: [{ t: 1_786_455_000_000, o: 650, h: 651, l: 649, c: 650.5, v: 100 }],
    });
  });

  const candles = await stream.history({
    symbol: "SPY",
    timeframe: "5m",
    from: Date.UTC(2026, 7, 17),
    to: Date.UTC(2026, 7, 18),
  });

  assert.equal(candles.length, 1);
  assert.match(calls[0], /\/v2\/aggs\/ticker\/SPY\/range\/5\/minute/);
  assert.equal(__test.providerTicker("SPY"), null);
  assert.equal(__test.historyTicker("QQQ"), "QQQ");
});

test("Massive resolution and symbol aliases are deterministic", () => {
  assert.deepEqual(__test.aggregateResolution("1m"), { multiplier: 1, timespan: "minute" });
  assert.deepEqual(__test.aggregateResolution("4h"), { multiplier: 4, timespan: "hour" });
  assert.equal(__test.providerTicker("SPXW"), "I:SPX");
  assert.equal(__test.historyTicker("SPY"), "SPY");
  assert.deepEqual(__test.publicSymbols("I:SPX"), ["SPX", "SPXW"]);
});
