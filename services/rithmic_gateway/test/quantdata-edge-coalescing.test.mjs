import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import {
  VendorDataEdge,
  quantDataCacheKey,
  quantDataRefusalHoldMs,
  MAX_QUANTDATA_REFUSAL_HOLD_MS,
  MIN_QUANTDATA_REFUSAL_HOLD_MS,
} from "../src/vendor-data-edge.mjs";

/**
 * One upstream QuantData call serves every pane that asked for it.
 *
 * The edge cached responses but never coalesced in-flight ones. A cache is
 * only populated once a response ARRIVES, so every pane asking during the same
 * in-flight window was a miss and its own upstream request. Six panes on the
 * same underlyings all refresh at the bell, and a single desk exhausted a 240
 * request/minute quota: x-ratelimit-remaining 0, every GEX surface answering
 * 429, GEX Map and GEX VUE frozen.
 */

const CONFIG = {
  quantDataApiKey: "test-key",
  quantDataMinSpacingMs: 0,
  quantDataCacheMs: 2_500,
  vendorRequestTimeoutMs: 5_000,
};

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = null;
    this.headers = null;
    this.chunks = [];
  }
  writeHead(status, headers) { this.statusCode = status; this.headers = headers; }
  end(body) { if (body) this.chunks.push(body); this.emit("done"); }
  get text() { return Buffer.concat(this.chunks.map((c) => Buffer.from(c))).toString("utf8"); }
}

// The edge reads the body with `for await`, so this has to be a real stream.
function request(bodyText) {
  const stream = Readable.from([Buffer.from(bodyText)]);
  stream.method = "POST";
  stream.headers = { "content-type": "application/json" };
  return stream;
}

const url = (path = "/v1/vendors/quantdata/v1/options/tool/exposure-by-strike") =>
  new URL(`https://gateway.internal${path}`);

function upstreamOk(bodyText, { delayMs = 10, headers = {} } = {}) {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json", ...headers }),
      arrayBuffer: async () => new TextEncoder().encode(bodyText).buffer,
    };
  };
}

test("identical concurrent requests make ONE upstream call", async () => {
  let upstreamCalls = 0;
  const edge = new VendorDataEdge(CONFIG, async (...args) => {
    upstreamCalls += 1;
    return upstreamOk(JSON.stringify({ ticker: "SPX", ok: true }))(...args);
  });

  const responses = Array.from({ length: 6 }, () => new FakeResponse());
  await Promise.all(responses.map((response) =>
    edge.handle(request(JSON.stringify({ ticker: "SPX" })), response, url())));

  assert.equal(upstreamCalls, 1, `six panes made ${upstreamCalls} upstream calls`);
  for (const response of responses) {
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.text), { ticker: "SPX", ok: true });
  }
  assert.equal(edge.metrics.quantDataCoalescedRequests, 5);
});

test("a different ticker is never served another's answer", async () => {
  /*
   * The whole point of keying on the body. Collapsing NDX onto SPX's response
   * would be fabricated data drawn confidently on the wrong chart - far worse
   * than the outage it was meant to fix.
   */
  let calls = 0;
  const edge = new VendorDataEdge(CONFIG, async (target, init) => {
    calls += 1;
    const ticker = JSON.parse(Buffer.from(init.body).toString("utf8")).ticker;
    return upstreamOk(JSON.stringify({ ticker }))(target, init);
  });

  const spx = new FakeResponse();
  const ndx = new FakeResponse();
  await Promise.all([
    edge.handle(request(JSON.stringify({ ticker: "SPX" })), spx, url()),
    edge.handle(request(JSON.stringify({ ticker: "NDX" })), ndx, url()),
  ]);

  assert.equal(calls, 2, "two different tickers were collapsed into one call");
  assert.equal(JSON.parse(spx.text).ticker, "SPX");
  assert.equal(JSON.parse(ndx.text).ticker, "NDX");
});

test("the same body on a different tool is a different request", async () => {
  let calls = 0;
  const edge = new VendorDataEdge(CONFIG, async (target, init) => {
    calls += 1;
    return upstreamOk(JSON.stringify({ target: String(target) }))(target, init);
  });
  await Promise.all([
    edge.handle(request(JSON.stringify({ ticker: "SPX" })), new FakeResponse(),
      url("/v1/vendors/quantdata/v1/options/tool/exposure-by-strike")),
    edge.handle(request(JSON.stringify({ ticker: "SPX" })), new FakeResponse(),
      url("/v1/vendors/quantdata/v1/options/tool/interval-map")),
  ]);
  assert.equal(calls, 2, "two different tools were collapsed into one call");
});

test("a settled response is still served from cache", async () => {
  // Coalescing must not have replaced the cache, only complemented it.
  let calls = 0;
  const edge = new VendorDataEdge(CONFIG, async (...args) => {
    calls += 1;
    return upstreamOk(JSON.stringify({ ok: true }), { delayMs: 0 })(...args);
  });
  await edge.handle(request(JSON.stringify({ ticker: "SPX" })), new FakeResponse(), url());
  const second = new FakeResponse();
  await edge.handle(request(JSON.stringify({ ticker: "SPX" })), second, url());
  assert.equal(calls, 1, "the cached response went upstream again");
  assert.equal(edge.metrics.quantDataCacheHits, 1);
});

test("a refusal is held rather than re-spent", async () => {
  /*
   * Only successes were cached, so while the quota was exhausted every repeat
   * request went upstream and spent more of the quota being refused. The hole
   * dug itself deeper exactly when it needed to stop.
   */
  let calls = 0;
  const edge = new VendorDataEdge(CONFIG, async () => {
    calls += 1;
    return {
      ok: false,
      status: 429,
      headers: new Headers({ "content-type": "application/json", "retry-after": "1" }),
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ detail: "Rate limit exceeded." })).buffer,
    };
  });

  const first = new FakeResponse();
  await edge.handle(request(JSON.stringify({ ticker: "SPX" })), first, url());
  assert.equal(first.statusCode, 429);

  const second = new FakeResponse();
  await edge.handle(request(JSON.stringify({ ticker: "SPX" })), second, url());
  assert.equal(calls, 1, "a rate-limited request was sent upstream again immediately");
  // The caller still learns the truth: it is rate limited, and the provider said so.
  assert.equal(second.statusCode, 429);
  assert.match(second.text, /Rate limit exceeded/);
});

test("the refusal hold honours the provider and stays bounded", () => {
  assert.equal(quantDataRefusalHoldMs(new Headers({ "retry-after": "3" })), 3_000);
  // Absent, malformed, or hostile values cannot strand a surface.
  assert.equal(quantDataRefusalHoldMs(new Headers()), MIN_QUANTDATA_REFUSAL_HOLD_MS);
  assert.equal(quantDataRefusalHoldMs(new Headers({ "retry-after": "nonsense" })), MIN_QUANTDATA_REFUSAL_HOLD_MS);
  assert.equal(quantDataRefusalHoldMs(new Headers({ "retry-after": "99999" })), MAX_QUANTDATA_REFUSAL_HOLD_MS);
});

test("the cache key separates path and body", () => {
  const a = quantDataCacheKey("/v1/options/tool/exposure-by-strike", Buffer.from('{"ticker":"SPX"}'));
  const b = quantDataCacheKey("/v1/options/tool/exposure-by-strike", Buffer.from('{"ticker":"NDX"}'));
  const c = quantDataCacheKey("/v1/options/tool/interval-map", Buffer.from('{"ticker":"SPX"}'));
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(a, quantDataCacheKey("/v1/options/tool/exposure-by-strike", Buffer.from('{"ticker":"SPX"}')));
});

test("an upstream failure does not wedge the next request", async () => {
  // A rejected in-flight entry must be cleared, or one network blip would
  // permanently poison that surface for as long as the process lives.
  let calls = 0;
  const edge = new VendorDataEdge(CONFIG, async (...args) => {
    calls += 1;
    if (calls === 1) throw new Error("connection reset");
    return upstreamOk(JSON.stringify({ ok: true }), { delayMs: 0 })(...args);
  });

  const failed = new FakeResponse();
  await edge.handle(request(JSON.stringify({ ticker: "SPX" })), failed, url());
  // The edge answers an upstream throw with a 502 rather than rejecting.
  assert.equal(failed.statusCode, 502);

  const second = new FakeResponse();
  await edge.handle(request(JSON.stringify({ ticker: "SPX" })), second, url());
  assert.equal(second.statusCode, 200, "the surface stayed poisoned after one failure");
  assert.equal(calls, 2);
});
