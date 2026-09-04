import assert from "node:assert/strict";
import test from "node:test";

import {
  MarketIndexHistoryError,
  QuantDataMarketHistoryService,
  __test,
} from "../src/quantdata-market-history.mjs";

const NOW = Date.UTC(2026, 7, 29, 12);

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function providerCandles(rows) {
  return {
    data: Object.fromEntries(rows.map((row) => [String(row.timestamp), {
      openPrice: row.open,
      highPrice: row.high,
      lowPrice: row.low,
      closePrice: row.close,
      volume: row.volume ?? 0,
    }])),
  };
}

test("completed VPS cash-index archives are aggregated before QuantData is called", async () => {
  const calls = [];
  const archiveReads = [];
  const start = Date.UTC(2026, 7, 17, 13, 30);
  const service = new QuantDataMarketHistoryService({
    apiKey: "qd-test",
    now: () => NOW,
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse({ data: {} });
    },
    archiveReadSession: async (ticker, sessionDate) => {
      archiveReads.push({ ticker, sessionDate });
      return {
        complete: true,
        aggregationPeriod: "1m",
        candles: [
          { timestamp: start, open: 650, high: 651, low: 649.5, close: 650.5, volume: 10 },
          { timestamp: start + 60_000, open: 650.5, high: 652, low: 650, close: 651.5, volume: 20 },
          { timestamp: start + 2 * 60_000, open: 651.5, high: 653, low: 651, close: 652.5, volume: 30 },
        ],
      };
    },
  });

  const result = await service.load({
    symbol: "SPY",
    timeframe: "5m",
    from: start,
    to: start + 6 * 60_000,
  });

  assert.deepEqual(archiveReads, [{ ticker: "SPY", sessionDate: "2026-08-17" }]);
  assert.equal(calls.length, 0);
  assert.equal(result.source, "QuantData (VPS)");
  assert.deepEqual(result.candles, [{
    timestamp: start,
    open: 650,
    high: 653,
    low: 649.5,
    close: 652.5,
    volume: 60,
  }]);
});

test("SPXW history uses the SPX cash tape and keeps the vendor credential VPS-side", async () => {
  const calls = [];
  const archived = [];
  const start = Date.UTC(2026, 7, 18, 13, 30);
  const service = new QuantDataMarketHistoryService({
    apiKey: "qd-secret-test",
    now: () => NOW,
    archiveReadSession: async () => null,
    archiveResponse: (entry) => archived.push(entry),
    fetchImpl: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return jsonResponse(providerCandles([
        { timestamp: start, open: 6500, high: 6502, low: 6499, close: 6501, volume: 0 },
      ]));
    },
  });

  const result = await service.load({
    symbol: "spxw",
    timeframe: "1m",
    from: start,
    to: start + 60_000,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/api\.quantdata\.us\/v1\/equities\/tool\/stock-price-over-time$/);
  assert.equal(calls[0].init.headers.Authorization, "Bearer qd-secret-test");
  assert.equal(calls[0].body.filter.ticker, "SPX");
  assert.equal(calls[0].body.sessionDate, "2026-08-18");
  assert.equal(result.symbol, "SPXW");
  assert.equal(result.candles[0].close, 6501);
  assert.equal(JSON.stringify(result).includes("qd-secret-test"), false);
  assert.equal(archived.length, 1, "the direct history response bypassed the QuantData archive");
  assert.match(archived[0].path, /stock-price-over-time$/);
  assert.equal(JSON.parse(archived[0].requestBody).filter.ticker, "SPX");
  assert.ok(JSON.parse(archived[0].payload).data, "the provider payload was not preserved");
});

test("identical QuantData history requests coalesce and then use the bounded VPS cache", async () => {
  let calls = 0;
  const start = Date.UTC(2026, 7, 18, 13, 30);
  const service = new QuantDataMarketHistoryService({
    apiKey: "qd-test",
    now: () => NOW,
    fetchImpl: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return jsonResponse(providerCandles([
        { timestamp: start, open: 600, high: 602, low: 599, close: 601 },
      ]));
    },
  });
  const request = { symbol: "QQQ", timeframe: "5m", from: start, to: start + 60_000 };

  const [first, second] = await Promise.all([service.load(request), service.load(request)]);
  const third = await service.load(request);

  assert.equal(calls, 1);
  assert.deepEqual(first.candles, second.candles);
  assert.equal(first.cached, false);
  assert.equal(second.cached, false);
  assert.equal(third.cached, true);
});

test("minute history reads every available local session before bounded provider fallback", async () => {
  let archiveReads = 0;
  const service = new QuantDataMarketHistoryService({
    now: () => NOW,
    archiveReadSession: async (_ticker, sessionDate) => {
      archiveReads += 1;
      const timestamp = Date.parse(`${sessionDate}T14:30:00.000Z`);
      return {
        complete: true,
        aggregationPeriod: "1m",
        candles: [{ timestamp, open: 100, high: 101, low: 99, close: 100.5, volume: 1 }],
      };
    },
  });

  const result = await service.load({
    symbol: "SPY",
    timeframe: "1m",
    from: Date.UTC(2026, 4, 1),
    to: Date.UTC(2026, 7, 28, 23),
  });

  assert.ok(archiveReads > 80, "the complete requested archive window was not inspected");
  assert.equal(result.truncated, false);
  assert.ok(result.candles.length > 80, "the locally available historical range was truncated");
});

test("history validation rejects unsupported symbols, intervals and unbounded windows", async () => {
  const service = new QuantDataMarketHistoryService({ apiKey: "qd-test", now: () => NOW });

  await assert.rejects(
    () => service.load({ symbol: "BTCUSD", timeframe: "5m", from: NOW - 60_000, to: NOW }),
    (error) => error instanceof MarketIndexHistoryError && error.code === "index_history_symbol_unsupported",
  );
  await assert.rejects(
    () => service.load({ symbol: "SPY", timeframe: "10s", from: NOW - 60_000, to: NOW }),
    (error) => error instanceof MarketIndexHistoryError && error.code === "index_history_interval_unsupported",
  );
  await assert.rejects(
    () => service.load({ symbol: "SPY", timeframe: "5m", from: NOW - 731 * 86_400_000, to: NOW }),
    (error) => error instanceof MarketIndexHistoryError && error.code === "index_history_window_invalid",
  );
});

test("range history aggregates daily candles into deterministic weeks", async () => {
  const monday = Date.UTC(2026, 7, 17);
  const service = new QuantDataMarketHistoryService({
    apiKey: "qd-test",
    now: () => NOW,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.aggregationPeriod, "1d");
      assert.equal(body.filter.ticker, "NDX");
      return jsonResponse(providerCandles([
        { timestamp: monday, open: 24_000, high: 24_100, low: 23_950, close: 24_050, volume: 10 },
        { timestamp: monday + 86_400_000, open: 24_050, high: 24_250, low: 24_000, close: 24_200, volume: 20 },
      ]));
    },
  });

  const result = await service.load({
    symbol: "NDX",
    timeframe: "1W",
    from: monday,
    to: monday + 2 * 86_400_000,
  });

  assert.deepEqual(result.candles, [{
    timestamp: monday,
    open: 24_000,
    high: 24_250,
    low: 23_950,
    close: 24_200,
    volume: 30,
  }]);
  assert.deepEqual(__test.historyPlan("4h"), { sourceAggregation: "1h", sessionScoped: false });
});
