import assert from "node:assert/strict";
import test from "node:test";

import {
  availableEndFromHistoryError,
  DatabentoHistoryService,
  HistoryRequestError,
  normalizeHistoryRequest,
} from "../src/databento-history.mjs";

const NOW = Date.parse("2026-08-28T01:00:00.000Z");
const FROM = Date.parse("2026-08-28T00:00:00.000Z");

function request(overrides = {}) {
  return {
    exchange: "cme",
    symbol: "nqu6",
    interval: "5m",
    fromMs: FROM,
    toMs: NOW,
    limit: 20_000,
    ...overrides,
  };
}

function ndjson(rows, status = 200) {
  return new Response(rows.map((row) => JSON.stringify(row)).join("\n"), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("time history is requested with VPS credentials and normalized into canonical bounded candles", async () => {
  const calls = [];
  const service = new DatabentoHistoryService({
    apiKey: "server-only-key",
    now: () => NOW,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return ndjson([
        { ts_event: "2026-08-28T00:00:00.000000000Z", open: 100, high: 102, low: 99, close: 101, volume: 10 },
        { ts_event: "2026-08-28T00:01:00.000000000Z", open: 101, high: 104, low: 100, close: 103, volume: 15 },
      ]);
    },
  });

  const result = await service.load(request());

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hist.databento.com/v0/timeseries.get_range");
  assert.match(calls[0].init.headers.Authorization, /^Basic /);
  assert.doesNotMatch(String(calls[0].init.body), /server-only-key/);
  assert.equal(new URLSearchParams(calls[0].init.body).get("schema"), "ohlcv-1m");
  assert.deepEqual(result.candles, [{
    timestamp: FROM,
    open: 100,
    high: 104,
    low: 99,
    close: 103,
    volume: 25,
    trades: 0,
    bidVolume: 0,
    askVolume: 0,
    isClosed: true,
  }]);
  assert.deepEqual(result.records, []);
  assert.equal(result.orderFlowAvailable, false);
  assert.equal(result.historicalAvailable, true);
  assert.equal(result.effectiveToMs, NOW);
  assert.equal(result.cached, false);
});

test("provider available_end is retried once and becomes the explicit desktop merge seam", async () => {
  const availableEnd = Date.parse("2026-08-28T00:50:00.000Z");
  const forms = [];
  const service = new DatabentoHistoryService({
    apiKey: "server-only-key",
    now: () => NOW,
    fetchImpl: async (_url, init) => {
      forms.push(new URLSearchParams(init.body));
      if (forms.length === 1) {
        return new Response(JSON.stringify({
          detail: {
            case: "dataset_unavailable_range",
            message: "Try again with an end date of at most 2026-08-28T00:50:00Z.",
          },
        }), { status: 422 });
      }
      return ndjson([
        { ts_event: "2026-08-28T00:45:00.000000000Z", open: 100, high: 101, low: 99, close: 100.5, volume: 4 },
      ]);
    },
  });

  const result = await service.load(request());

  assert.equal(forms.length, 2);
  assert.equal(Date.parse(forms[0].get("end")), NOW);
  assert.equal(Date.parse(forms[1].get("end")), availableEnd - 1);
  assert.equal(result.requestedToMs, NOW);
  assert.equal(result.effectiveToMs, availableEnd - 1);
  assert.equal(result.truncated, true);
  assert.equal(service.status().requests, 2);
});

test("available_end parser accepts only the two typed Databento range cases", () => {
  assert.equal(availableEndFromHistoryError(JSON.stringify({
    detail: {
      case: "data_end_after_available_end",
      payload: { available_end: "2026-08-28T00:50:00Z" },
    },
  })), Date.parse("2026-08-28T00:50:00Z"));
  assert.equal(availableEndFromHistoryError(JSON.stringify({
    detail: { case: "dataset_unavailable_range", message: "Use at most 2026-08-27." },
  })), Date.parse("2026-08-27T00:00:00Z"));
  assert.equal(availableEndFromHistoryError(JSON.stringify({
    detail: { case: "symbology_invalid_symbol", message: "at 2026-08-27" },
  })), null);
  assert.equal(availableEndFromHistoryError("not json"), null);
});

test("event history returns exact normalized executions and preserves Databento aggressor semantics", async () => {
  const service = new DatabentoHistoryService({
    apiKey: "server-only-key",
    now: () => NOW,
    fetchImpl: async () => ndjson([
      { ts_event: "2026-08-28T00:00:00.123456789Z", price: 100_250_000_000, size: 3, side: "B" },
      { ts_event: "2026-08-28T00:00:01.999999999Z", price: 100_000_000_000, size: 2, side: { value: "A" } },
    ]),
  });

  const result = await service.load(request({ interval: "4R" }));

  assert.deepEqual(result.candles, []);
  assert.deepEqual(result.records, [
    { timestamp: FROM + 123, close: 100.25, volume: 3, aggressor: "BUY", recordIndex: 1 },
    { timestamp: FROM + 1_999, close: 100, volume: 2, aggressor: "SELL", recordIndex: 2 },
  ]);
  assert.equal(result.orderFlowAvailable, true);
  assert.equal(result.coverageStartMs, FROM + 123);
  assert.equal(result.coverageEndMs, FROM + 1_999);
});

test("identical history loads are single-flight and then use the bounded cache", async () => {
  let calls = 0;
  let release;
  const responseReady = new Promise((resolve) => { release = resolve; });
  const service = new DatabentoHistoryService({
    apiKey: "server-only-key",
    now: () => NOW,
    fetchImpl: async () => {
      calls += 1;
      await responseReady;
      return ndjson([]);
    },
  });

  const first = service.load(request());
  const second = service.load(request());
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  const cached = await service.load(request());

  assert.equal(calls, 1);
  assert.equal(service.status().coalescedRequests, 1);
  assert.equal(service.status().cacheHits, 1);
  assert.equal(cached.cached, true);
});

test("large windows shift the provider start to a bounded recent tail and report truncation", async () => {
  let form;
  const service = new DatabentoHistoryService({
    apiKey: "server-only-key",
    now: () => NOW,
    fetchImpl: async (_url, init) => {
      form = new URLSearchParams(init.body);
      return ndjson([]);
    },
  });
  const fourYearsAgo = NOW - 4 * 365 * 24 * 60 * 60_000;

  const result = await service.load(request({ interval: "1m", fromMs: fourYearsAgo }));

  assert.ok(Date.parse(form.get("start")) > fourYearsAgo);
  assert.equal(Number(form.get("limit")), 20_000);
  assert.equal(result.truncated, true);
});

test("invalid requests and malformed provider records fail closed with typed errors", async () => {
  assert.throws(
    () => normalizeHistoryRequest(request({ interval: "4x" }), NOW),
    (error) => error instanceof HistoryRequestError && error.code === "invalid_interval",
  );
  assert.throws(
    () => normalizeHistoryRequest(request({ fromMs: NOW, toMs: FROM }), NOW),
    (error) => error instanceof HistoryRequestError && error.code === "invalid_window",
  );

  const service = new DatabentoHistoryService({
    apiKey: "server-only-key",
    now: () => NOW,
    fetchImpl: async () => new Response("not-json\n", { status: 200 }),
  });
  await assert.rejects(
    service.load(request()),
    (error) => error instanceof HistoryRequestError && error.code === "history_malformed",
  );
});
