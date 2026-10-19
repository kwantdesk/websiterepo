import assert from "node:assert/strict";
import test from "node:test";
import { Readable, Writable } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { QuantDataRequestBudget, createQuantDataBudgetFetch } from "../src/quantdata-request-budget.mjs";
import { VendorDataEdge, quantDataCacheKey } from "../src/vendor-data-edge.mjs";
import { QuantDataMarketSnapshotStream } from "../src/quantdata-market-snapshot-stream.mjs";
import { QuantDataMarketHistoryService } from "../src/quantdata-market-history.mjs";
import { CashIndexArchiver } from "../src/cash-index-archiver.mjs";

const PATH = "/v1/equities/tool/stock-price-over-time";
const config = { quantDataApiKey: "qd-test-only", vendorRequestTimeoutMs: 5000, quantDataMinSpacingMs: 350, quantDataCacheMs: 10_000 };
function req(body) {
  const result = Readable.from([Buffer.from(JSON.stringify(body))]);
  result.method = "POST"; result.headers = { "content-type": "application/json" }; return result;
}
function capture() {
  const chunks = [], stream = new Writable({ write(chunk, _, done) { chunks.push(Buffer.from(chunk)); done(); } });
  stream.writeHead = (status, headers) => { stream.statusCode = status; stream.responseHeaders = headers; stream.headersSent = true; };
  return { stream, finished: new Promise(resolve => stream.on("finish", resolve)), body: () => Buffer.concat(chunks).toString("utf8") };
}
const date = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.now());
async function until(check) { for (let i = 0; i < 250; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 1)); } assert.ok(check(), "consumers did not reach the shared budget"); }

test("exact-origin adapter rejects lookalikes, credentials, query/hash and other origins before acquisition", async () => {
  let calls = 0;
  const adapter = createQuantDataBudgetFetch({ fetch() { calls++; return Promise.resolve(new Response("{}")); } });
  for (const url of ["http://api.quantdata.us/v1/options/tool/net-drift", "https://api.quantdata.us.evil.test/v1/options", "https://user:pass@api.quantdata.us/v1/options", "https://api.quantdata.us/v1/options?key=x", "https://api.quantdata.us/v1/options#x", "/v1/options", "https://example.test/v1/options"]) await assert.rejects(adapter(url), { code: "invalid_request" });
  assert.equal(calls, 0);
  await adapter(`https://api.quantdata.us${PATH}`, { body: "{}" }); assert.equal(calls, 1);
  await assert.rejects(createQuantDataBudgetFetch(null)(`https://api.quantdata.us${PATH}`), { code: "provider_unconfigured" });
});

test("all four real upstream consumers coalesce through one budget and preserve normalized/archive contracts", async context => {
  context.mock.method(Date, "now", () => Date.parse("2026-10-19T14:30:00Z"));
  const dir = await mkdtemp(join(tmpdir(), "qd-budget-integration-"));
  let finish, calls = 0;
  const archives = [], sessionDate = date();
  const start = Date.parse(`${sessionDate}T13:30:00Z`);
  const payload = { data: Object.fromEntries(Array.from({ length: 390 }, (_, i) => [start + i * 60_000,
    { openPrice: 100 + i, highPrice: 101 + i, lowPrice: 99 + i, closePrice: 100 + i, volume: 10 }])) };
  const budget = new QuantDataRequestBudget({ apiKey: config.quantDataApiKey, fetchImpl: async (url, init) => {
    calls++; assert.equal(url, `https://api.quantdata.us${PATH}`); assert.equal(init.headers.Authorization, "Bearer qd-test-only");
    return new Promise(resolve => { finish = () => resolve(new Response(JSON.stringify(payload), { headers: { "content-type": "application/json", "x-ratelimit-limit": "240" } })); });
  } });
  const shared = createQuantDataBudgetFetch(budget), archiveResponse = entry => archives.push(entry);
  const edge = new VendorDataEdge(config, () => { throw new Error("unbudgeted provider request"); }, { archive: archiveResponse }, shared);
  const snapshots = new QuantDataMarketSnapshotStream({ apiKey: config.quantDataApiKey, equitySymbols: [], indexSymbols: ["SPX"], requestSpacingMs: 1, timeoutMs: 5000 }, shared, archiveResponse);
  const history = new QuantDataMarketHistoryService({ apiKey: config.quantDataApiKey, fetchImpl: shared, archiveResponse, now: () => start + 390 * 60_000 });
  const archiver = new CashIndexArchiver({ dir, apiKey: config.quantDataApiKey, tickers: ["SPX"], fetchImpl: shared, archiveResponse, requestSpacingMs: 0 });
  const output = capture(), body = { sessionDate, aggregationPeriod: "1m", filter: { ticker: "SPX" } };
  try {
    const jobs = [
      edge.handle(req(body), output.stream, new URL(`http://gateway/v1/vendors/quantdata${PATH}`)),
      snapshots.pollNow(),
      history.load({ symbol: "SPX", timeframe: "1m", from: start, to: start + 60_000 }),
      archiver.archiveSession("SPX", sessionDate),
    ];
    await until(() => budget.status().waiters === 4); assert.equal(calls, 1); finish();
    const results = await Promise.all(jobs); await output.finished;
    assert.equal(output.stream.statusCode, 200); assert.deepEqual(JSON.parse(output.body()), payload);
    assert.equal(snapshots.snapshot("SPX").lastPrice, 489);
    assert.ok(results[2].candles.length > 0); assert.equal(results[3].status, "complete");
    assert.equal((await archiver.readSession("SPX", sessionDate)).candles.length, 390);
    assert.equal(archives.length, 4); assert.ok(archives.every(entry => entry.path === PATH));
    assert.ok(archives.every(entry => JSON.parse(entry.requestBody.toString()).filter.ticker === "SPX"));
    assert.ok(archives.every(entry => JSON.parse(entry.payload.toString()).data[start].closePrice === 100));
    assert.equal(budget.status().startsInMinute, 1); assert.equal(budget.status().pending, 0);
    // Same semantic body in a different property order retains edge cache hits.
    const cached = capture(); await edge.handle(req({ filter: { ticker: "SPX" }, aggregationPeriod: "1m", sessionDate }), cached.stream, new URL(`http://gateway/v1/vendors/quantdata${PATH}`));
    await cached.finished; assert.equal(calls, 1); assert.equal(edge.health().quantDataCacheHits, 1);
  } finally { snapshots.stop(); archiver.stop(); budget.close(); await rm(dir, { recursive: true, force: true }); }
});

test("separate Quant Data budget injection never changes other providers' transport", async () => {
  let fallback = 0, quant = 0;
  const edge = new VendorDataEdge({ ...config, massiveApiKey: "massive-only", massiveRestOrigin: "https://api.massive.com" }, async () => { fallback++; return new Response("{}", { headers: { "content-type": "application/json" } }); }, null,
    async () => { quant++; throw new Error("wrong provider lane"); });
  const result = capture(); const request = req({}); request.method = "GET";
  await edge.handle(request, result.stream, new URL("http://gateway/v1/vendors/massive/v2/reference/news")); await result.finished;
  assert.equal(result.stream.statusCode, 200); assert.equal(fallback, 1); assert.equal(quant, 0);
});

test("entrypoint constructs exactly one shared account budget, injects four callers and closes before archive writer", async () => {
  const source = await readFile(new URL("../src/server.mjs", import.meta.url), "utf8");
  assert.equal((source.match(/new QuantDataRequestBudget\(/g) || []).length, 1);
  assert.match(source, /new VendorDataEdge\(config, fetch, exposureArchiver, quantDataFetch\)/);
  assert.match(source, /new CashIndexArchiver\(\{[\s\S]*?fetchImpl: quantDataFetch,/);
  assert.match(source, /new QuantDataMarketHistoryService\(\{[\s\S]*?fetchImpl: quantDataFetch,/);
  assert.match(source, /new QuantDataMarketSnapshotStream\([\s\S]*?\}, quantDataFetch, archiveQuantDataResponse\)/);
  const shutdown = source.slice(source.indexOf("async function shutdown()"));
  assert.ok(shutdown.indexOf("quantDataRequestBudget?.close()") < shutdown.indexOf("exposureArchiver.stop()"));
  assert.ok(shutdown.includes("cashIndexArchiver.stop()"));
  assert.equal(quantDataCacheKey(PATH, Buffer.from('{"b":2,"a":1}')), quantDataCacheKey(PATH, Buffer.from('{"a":1,"b":2}')));
});

test("an existing history deadline cancels its queued consumer without bypassing a global provider hold", async () => {
  let calls = 0;
  const budget = new QuantDataRequestBudget({ apiKey: "test-only", fetchImpl: async () => {
    calls++; return new Response("limited", { status: 429, headers: { "retry-after": "90" } });
  } });
  const shared = createQuantDataBudgetFetch(budget);
  try {
    assert.equal((await shared(`https://api.quantdata.us${PATH}`, { body: { filter: { ticker: "SPY" } } })).status, 429);
    const from = Date.parse("2026-10-19T13:30:00Z");
    const history = new QuantDataMarketHistoryService({ apiKey: "test-only", fetchImpl: shared, timeoutMs: 5, now: () => from + 60_000 });
    await assert.rejects(history.load({ symbol: "QQQ", timeframe: "1m", from, to: from + 60_000 }), { code: "index_history_transport_failed" });
    assert.equal(calls, 1); assert.equal(budget.status().pending, 0); assert.equal(budget.status().waiters, 0);
    assert.ok(budget.status().blockedUntil > Date.now() + 80_000);
  } finally { budget.close(); }
});
