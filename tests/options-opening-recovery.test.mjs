import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { optionsOpeningClock, optionsOpeningRefreshDelay, publishPanelResults } from "../src/lib/optionsOpeningRefresh.ts";
import { isGatewayBusyResponse } from "../src/lib/gatewayBusyResponse.ts";
import { vendorMarketDataFetch } from "../src/lib/vendorMarketData.server.ts";
import { fetchInstitutionalMarketData } from "../src/lib/institutionalMarketData.server.ts";

test("overnight delays wake at the New York open in summer and winter; weekends stay quiet", () => {
  for (const date of ["2026-10-23T13:29:58Z", "2026-12-14T14:29:58Z"]) {
    assert.equal(optionsOpeningRefreshDelay(300000, false, Date.parse(date)), 2100);
  }
  assert.equal(optionsOpeningRefreshDelay(300000, false, Date.parse("2026-10-24T13:29:58Z")), 300000);
  assert.equal(optionsOpeningRefreshDelay(60000, true, Date.parse("2026-10-23T13:30:01Z")), 5000);
  assert.equal(optionsOpeningRefreshDelay(60000, true, Date.parse("2026-10-23T13:36:01Z")), 60000);
  assert.equal(optionsOpeningClock(Date.parse("2026-10-23T13:30:00Z")).opening, true);
});

test("a healthy panel publishes before a slow/failing sibling settles", async () => {
  let release;
  const slow = new Promise((_, reject) => { release = reject; });
  const seen = [];
  const pending = publishPanelResults([Promise.resolve("actual surface"), slow], value => seen.push(value));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen, ["actual surface"]);
  release(new Error("slow provider"));
  const result = await pending;
  assert.equal(result[0].status, "fulfilled");
  assert.equal(result[1].status, "rejected");
});

test("only explicit load-shed JSON is busy, and classification does not consume the caller's response", async () => {
  const busy = Response.json({ code: "live_feed_priority" }, { status: 503 });
  assert.equal(await isGatewayBusyResponse(busy), true);
  assert.deepEqual(await busy.json(), { code: "live_feed_priority" });
  assert.equal(await isGatewayBusyResponse(new Response("bad gateway", { status: 503 })), false);
  assert.equal(await isGatewayBusyResponse(Response.json({ code: "unknown" }, { status: 503 })), false);
});

test("archive load shedding cannot trip the whole gateway or provider breaker", async () => {
  const originalFetch = globalThis.fetch;
  const env = { KWANTDESK_MARKET_DATA_GATEWAY_URL: "https://opening-isolation.example", KWANTDESK_MARKET_DATA_GATEWAY_TOKEN: "test-private" };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    return String(url).endsWith("/health") ? Response.json({ connected: true, authenticated: true })
      : String(url).includes("busy") ? Response.json({ code: "live_feed_priority" }, { status: 503 }) : Response.json({ actual: 42 });
  };
  try {
    assert.equal((await fetchInstitutionalMarketData("/busy")).status, 503);
    assert.deepEqual(await (await fetchInstitutionalMarketData("/healthy")).json(), { actual: 42 });
    assert.equal((await vendorMarketDataFetch("quantdata", "/v1/busy")).status, 503);
    assert.deepEqual(await (await vendorMarketDataFetch("quantdata", "/v1/healthy")).json(), { actual: 42 });
    assert.equal(calls, 5);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(env)) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
  }
});

test("vendor transport preserves caller cancellation, including while consuming body", async () => {
  const originalFetch = globalThis.fetch;
  const env = { KWANTDESK_MARKET_DATA_GATEWAY_URL: "https://opening-deadline.example", KWANTDESK_MARKET_DATA_GATEWAY_TOKEN: "test-private" };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  globalThis.fetch = async (_url, init) => new Response(new ReadableStream({ start(controller) {
    init.signal.addEventListener("abort", () => controller.error(new Error("cancelled response body")), { once: true });
  } }), { headers: { "Content-Type": "application/json" } });
  const controller = new AbortController();
  try {
    const response = await vendorMarketDataFetch("quantdata", "/v1/options/tool/interval-map", { signal: controller.signal });
    const body = response.text();
    controller.abort();
    await assert.rejects(body, /cancelled response body/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(env)) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
  }
});

test("opening partial history never substitutes for unavailable exposures or invents replay", () => {
  const source = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");
  const start = source.indexOf("async function buildGexMapPanel(");
  const build = source.slice(start, source.indexOf("export async function readConsolidatedTape", start));
  assert.match(build, /opening && error instanceof QuantDataError && \[404, 422\].includes\(error.status\)/);
  assert.match(build, /const opening = !historical && currentSession.marketOpen/);
  assert.match(build, /if \(!expiration\)/);
  assert.match(build, /historyPending/);
});
