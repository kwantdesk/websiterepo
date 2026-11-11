import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith("@/") && specifier.endsWith(".server")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { GET } = await import("../src/app/api/cme-history-page/route.ts");

test("older 500-volume pages keep the monthly seed and exclusive chart cursor", async () => {
  await withArchive(async (calls) => {
    const from = Date.now() - 30 * 86_400_000;
    const to = from + 20 * 86_400_000;
    const response = await page({ timeframe: "500v", from, to, before: to + 7 });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.candles.length, 1);
    assert.equal(result.nextBefore, null);
    assert.equal(calls[0].get("fromMs"), String(from));
    assert.equal(calls[0].get("beforeTimestamp"), String(to + 7));
    assert.equal(calls[0].get("exec"), "0");
  }, (params) => [bar(Number(params.get("fromMs")))]);
});

test("seconds pages cross empty recording windows and preserve exact flow when data resumes", async () => {
  await withArchive(async (calls) => {
    const day = 86_400_000;
    const to = Math.floor(Date.now() / 1_000) * 1_000;
    const from = to - 30 * day;
    const empty = await (await page({ timeframe: "1s", from, to, before: to })).json();
    assert.deepEqual(empty.candles, []);
    assert.equal(empty.nextBefore, to - 2 * day);
    assert.equal(calls[0].get("toMs"), String(to - 1));
    assert.equal(calls[0].get("limit"), "50000");
    const next = empty.nextBefore;
    const populated = await (await page({ timeframe: "1s", from, to: next, before: next })).json();
    assert.equal(populated.candles.length, 1);
    assert.equal(populated.candles[0].delta, 4);
    assert.equal(populated.nextBefore, to - 4 * day);
    assert.equal(calls[1].get("toMs"), String(next - 1));
  }, (params, index) => index === 0 ? [] : [bar(Number(params.get("toMs")) - 999)]);
});

function page(params) {
  return GET(new Request("http://localhost/api/cme-history-page?" + new URLSearchParams({ symbol: "NQ", ...params })));
}

function bar(timestamp) {
  return { timestamp, open: 100, high: 101, low: 99, close: 101, volume: 10, bidVolume: 3, askVolume: 7, delta: 4 };
}

async function withArchive(run, rows) {
  const savedFetch = globalThis.fetch;
  const keys = ["KWANTDESK_MARKET_DATA_GATEWAY_URL", "KWANTDESK_MARKET_DATA_GATEWAY_TOKEN"];
  const saved = keys.map(key => process.env[key]);
  const calls = [];
  [process.env[keys[0]], process.env[keys[1]]] = ["http://monthly-history.test", "fixture"];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/health") return Response.json({ connected: true, authenticated: true });
    assert.equal(url.pathname, "/v1/market-data/history");
    const candles = rows(url.searchParams, calls.length);
    calls.push(url.searchParams);
    return Response.json({ candles, executions: [] });
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = savedFetch;
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    });
  }
}
