import test from "node:test";
import assert from "node:assert/strict";
import { createDevelopingProfileServer } from "../src/developing-profile-server.mjs";

const start = Date.parse("2026-11-11T16:04:00Z");
const cutoff = start + 120_000;
const sessionEnd = start + 240_000;
const base = { root: "CL", contractSymbol: "CLZ6", complete: true, period: "daily", startMs: start, endMs: cutoff,
  tickSize: 0.01, groupTicks: 4, valueAreaPercent: 68, minTradeVolume: 2, maxTradeVolume: 30,
  levels: [{ price: 68.04, volume: 25 }], developingPoc: [] };
const trail = { developingPoc: [{ timestamp: cutoff - 1, price: 68.04 }], developingValueArea: [], developingVwap: [] };

test("sidecar adds owned trails only to authenticated opted-in exact profiles", async () => {
  const requests = [];
  const server = createDevelopingProfileServer({
    gatewayOrigin: "http://collector.internal:8793",
    archive: { load: async (request) => { requests.push(request); return trail; } },
    fetchImpl: async (url, options) => {
      assert.equal(url.origin, "http://collector.internal:8793");
      assert.equal(url.pathname, "/v1/market-data/volume-profile");
      return options.headers.authorization === "Bearer fixture"
        ? Response.json(base)
        : Response.json({ error: "Denied" }, { status: 401 });
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/v1/market-data/volume-profile";
  const auth = (value) => ({ headers: { authorization: "Bearer " + value } });
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url + "?developmentWindowEndMs=" + sessionEnd, auth("wrong"))).status, 401);
    assert.deepEqual(await (await fetch(url, auth("fixture"))).json(), base);
    assert.equal(requests.length, 0);
    const result = await (await fetch(url + "?developmentWindowEndMs=" + sessionEnd, auth("fixture"))).json();
    assert.deepEqual(result, { ...base, ...trail });
    assert.deepEqual(requests, [{
      exchange: "NYMEX", symbol: "CLZ6", fromMs: start, windowEndMs: sessionEnd, cutoffMs: cutoff,
      tickSize: 0.01, groupTicks: 4, valueAreaPercent: 68, minTradeVolume: 2, maxTradeVolume: 30,
    }]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
