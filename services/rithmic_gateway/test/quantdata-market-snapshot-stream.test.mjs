import assert from "node:assert/strict";
import test from "node:test";

import { QuantDataMarketSnapshotStream } from "../src/quantdata-market-snapshot-stream.mjs";

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

test("one QuantData market-map request fans out every requested equity", async () => {
  const calls = [];
  const archived = [];
  const stream = new QuantDataMarketSnapshotStream({
    apiKey: "qd-test",
    equitySymbols: ["QQQ", "SPY"],
    indexSymbols: [],
  }, async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return jsonResponse({
      data: {
        QQQ: { currentValue: 603.25, previousValue: 600 },
        SPY: { currentValue: 650.5, previousValue: 648 },
      },
    });
  }, (entry) => archived.push(entry));
  const quotes = [];
  stream.on("quote", (snapshot) => quotes.push(snapshot));

  await stream.pollNow();

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /equities\/tool\/market-map$/);
  assert.equal(calls[0].body.filterExpression.conjunction, "OR");
  assert.equal(calls[0].body.filterExpression.filters.length, 2);
  assert.equal(calls[0].body.filterExpression.filters[0].operation, "EQUALS");
  assert.deepEqual(quotes.map((row) => row.symbol), ["QQQ", "SPY"]);
  assert.equal(stream.snapshot("qqq").lastPrice, 603.25);
  assert.equal(stream.snapshot("QQQ").provider, "QuantData");
  assert.equal(archived.length, 1, "the direct snapshot response bypassed the archive");
  assert.match(archived[0].path, /market-map$/);
  assert.equal(JSON.parse(archived[0].requestBody).filterExpression.filters.length, 2);
  assert.equal(JSON.parse(archived[0].payload).data.QQQ.currentValue, 603.25);
});

test("index candles publish SPX and its SPXW cash alias without another request", async () => {
  const calls = [];
  const stream = new QuantDataMarketSnapshotStream({
    apiKey: "qd-test",
    equitySymbols: [],
    indexSymbols: ["SPX"],
    requestSpacingMs: 1,
  }, async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return jsonResponse({
      data: {
        "1786455000000": { openPrice: 6400, highPrice: 6410, lowPrice: 6398, closePrice: 6405 },
        "1786455060000": { openPrice: 6405, highPrice: 6412, lowPrice: 6404, closePrice: 6411.5 },
      },
    });
  });

  await stream.pollNow();

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /equities\/tool\/stock-price-over-time$/);
  assert.equal(calls[0].body.filter.ticker, "SPX");
  assert.equal(stream.snapshot("SPX").lastPrice, 6411.5);
  assert.equal(stream.snapshot("SPXW").lastPrice, 6411.5);
  assert.equal(stream.snapshot("SPX").openPrice, 6400);
  assert.deepEqual(stream.snapshot("SPX").candle, {
    time: 1786455060000, open: 6405, high: 6412, low: 6404, close: 6411.5,
  });
  assert.deepEqual(stream.snapshot("SPXW").candle, stream.snapshot("SPX").candle);
});

test("sampled market-map quotes never invent OHLC", async () => {
  const stream = new QuantDataMarketSnapshotStream({apiKey: "qd-test", equitySymbols: ["QQQ"]},
    async () => jsonResponse({data: {QQQ: {currentValue: 500, previousValue: 495}}}));
  await stream.pollNow();
  assert.equal(stream.snapshot("QQQ").lastPrice, 500);
  assert.equal(stream.snapshot("QQQ").candle, undefined);
});

test("malformed or missing source OHLC keeps quote semantics without forwarding fake candles", async () => {
  for (const row of [
    {openPrice: 100, closePrice: 101},
    {openPrice: 100, highPrice: 99, lowPrice: 98, closePrice: 101},
    {openPrice: 100, highPrice: 102, lowPrice: 101, closePrice: 101},
  ]) {
    const stream = new QuantDataMarketSnapshotStream({apiKey: "qd-test", indexSymbols: ["NDX"], requestSpacingMs: 1},
      async () => jsonResponse({data: {"1786455000000": row}}));
    await stream.pollNow();
    assert.equal(stream.snapshot("NDX").lastPrice, 101);
    assert.equal(stream.snapshot("NDX").candle, undefined);
  }
});

test("older source responses cannot rewind quote or actual candle", async () => {
  let nextTime = 1786455060000;
  const stream = new QuantDataMarketSnapshotStream({apiKey: "qd-test", indexSymbols: ["NDX"], indexPollMs: 1, requestSpacingMs: 1},
    async () => jsonResponse({data: {[nextTime]: {openPrice: 100, highPrice: 102, lowPrice: 99, closePrice: 101}}}));
  await stream.pollNow(); nextTime -= 60_000;
  await new Promise(resolve => setTimeout(resolve, 2)); await stream.pollNow();
  assert.equal(stream.snapshot("NDX").timestamp, 1786455060000);
  assert.equal(stream.snapshot("NDX").candle.time, 1786455060000);
});

test("cash indices rotate independently so a first symbol cannot starve the next", async () => {
  const calls = [];
  const stream = new QuantDataMarketSnapshotStream({
    apiKey: "qd-test",
    equitySymbols: [],
    indexSymbols: ["SPX", "NDX"],
    indexPollMs: 1,
    requestSpacingMs: 1,
  }, async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.filter.ticker);
    return jsonResponse({
      data: {
        "1786455000000": { openPrice: 100, highPrice: 101, lowPrice: 99, closePrice: 100.5 },
      },
    });
  });

  await stream.pollNow();
  await new Promise((resolve) => setTimeout(resolve, 2));
  await stream.pollNow();

  assert.deepEqual(calls, ["SPX", "NDX"]);
  assert.equal(stream.snapshot("SPX").lastPrice, 100.5);
  assert.equal(stream.snapshot("NDX").lastPrice, 100.5);
});

test("rate-limit responses are retained as status instead of crashing the shared stream", async () => {
  const archived = [];
  const stream = new QuantDataMarketSnapshotStream({
    apiKey: "qd-test",
    equitySymbols: ["QQQ"],
    indexSymbols: [],
  }, async () => jsonResponse({ detail: "Rate limit exceeded" }, 429, { "Retry-After": "1" }),
  (entry) => archived.push(entry));

  await stream.pollNow();

  assert.equal(stream.status().connected, false);
  assert.equal(stream.status().lastError.status, 429);
  assert.match(stream.status().lastError.message, /rate limit/i);
  assert.equal(archived.length, 0, "a provider error was archived as market history");
});
