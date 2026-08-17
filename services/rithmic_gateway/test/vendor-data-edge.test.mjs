import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { VendorDataEdge } from "../src/vendor-data-edge.mjs";

function request(body = "{}") {
  const stream = Readable.from([Buffer.from(body)]);
  stream.method = "POST";
  stream.headers = { "content-type": "application/json" };
  return stream;
}

function responseCapture() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  stream.statusCode = 0;
  stream.headers = {};
  stream.headersSent = false;
  stream.writeHead = (status, headers) => {
    stream.statusCode = status;
    stream.headers = headers;
    stream.headersSent = true;
    return stream;
  };
  return {
    stream,
    body: () => Buffer.concat(chunks).toString("utf8"),
    finished: new Promise((resolve) => stream.on("finish", resolve)),
  };
}

const config = {
  databentoApiKey: "db-test",
  quantDataApiKey: "qd-test",
  massiveApiKey: "massive-test",
  massiveRestOrigin: "https://api.massive.com",
  massiveRequestTimeoutMs: 1_000,
  vendorRequestTimeoutMs: 1_000,
  quantDataMinSpacingMs: 1,
  quantDataCacheMs: 2_500,
};

test("KwantData credentials stay at the edge and identical reads coalesce through cache", async () => {
  let calls = 0;
  const edge = new VendorDataEdge(config, async (_url, init) => {
    calls += 1;
    assert.equal(init.headers.Authorization, "Bearer qd-test");
    return new Response('{"data":{"ok":true}}', {
      status: 200,
      headers: { "content-type": "application/json", "x-ratelimit-remaining": "99" },
    });
  });

  for (let index = 0; index < 2; index += 1) {
    const capture = responseCapture();
    await edge.handle(
      request('{"ticker":"QQQ"}'),
      capture.stream,
      new URL("http://gateway/v1/vendors/quantdata/v1/options/gex"),
    );
    await capture.finished;
    assert.equal(capture.stream.statusCode, 200);
    assert.match(capture.body(), /"ok":true/);
  }
  assert.equal(calls, 1);
  assert.equal(edge.health().quantDataCacheHits, 1);
});

test("Databento history is streamed and the browser-facing request never supplies its key", async () => {
  let upstreamAuthorization = "";
  const edge = new VendorDataEdge(config, async (_url, init) => {
    upstreamAuthorization = init.headers.Authorization;
    return new Response('{"close":"100"}\n', {
      status: 200,
      headers: { "content-type": "application/jsonl" },
    });
  });
  const req = request("dataset=GLBX.MDP3");
  req.headers["content-type"] = "application/x-www-form-urlencoded";
  const capture = responseCapture();
  await edge.handle(
    req,
    capture.stream,
    new URL("http://gateway/v1/vendors/databento/v0/timeseries.get_range"),
  );
  await capture.finished;
  assert.match(upstreamAuthorization, /^Basic /);
  assert.match(capture.body(), /"close":"100"/);
});

test("Massive credentials stay on the VPS edge and approved market data is streamed", async () => {
  let upstreamAuthorization = "";
  let upstreamUrl = "";
  const edge = new VendorDataEdge(config, async (url, init) => {
    upstreamUrl = String(url);
    upstreamAuthorization = init.headers.Authorization;
    return new Response('{"results":[{"ticker":"I:SPX"}]}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const req = request("");
  req.method = "GET";
  req.headers = { accept: "application/json" };
  const capture = responseCapture();
  await edge.handle(
    req,
    capture.stream,
    new URL("http://gateway/v1/vendors/massive/v3/snapshot?ticker.any_of=I%3ASPX&apiKey=browser-must-not-win"),
  );
  await capture.finished;
  assert.equal(upstreamAuthorization, "Bearer massive-test");
  assert.match(upstreamUrl, /api\.massive\.com\/v3\/snapshot/);
  assert.doesNotMatch(upstreamUrl, /apiKey=/);
  assert.match(capture.body(), /I:SPX/);
  assert.equal(edge.health().massiveRequests, 1);
});

test("rolling Databento chart restores coalesce behind the VPS cache", async () => {
  let calls = 0;
  const edge = new VendorDataEdge(config, async () => {
    calls += 1;
    return new Response('{"close":"100"}\n', {
      status: 200,
      headers: { "content-type": "application/jsonl" },
    });
  });
  const end = new Date(Date.now() - 20 * 60_000);
  const makeBody = (offsetMs) => new URLSearchParams({
    dataset: "GLBX.MDP3",
    symbols: "NQ.v.0",
    stype_in: "continuous",
    schema: "ohlcv-1m",
    start: new Date(end.getTime() - 10 * 24 * 60 * 60_000 + offsetMs).toISOString(),
    end: new Date(end.getTime() + offsetMs).toISOString(),
  }).toString();

  for (const offsetMs of [0, 2_000]) {
    const req = request(makeBody(offsetMs));
    req.headers["content-type"] = "application/x-www-form-urlencoded";
    const capture = responseCapture();
    await edge.handle(
      req,
      capture.stream,
      new URL("http://gateway/v1/vendors/databento/v0/timeseries.get_range"),
    );
    await capture.finished;
    assert.equal(capture.stream.statusCode, 200);
  }
  assert.equal(calls, 1);
  assert.equal(edge.health().databentoCacheHits, 1);
});

test("unknown vendor paths are rejected instead of becoming an open proxy", async () => {
  const edge = new VendorDataEdge(config, async () => {
    throw new Error("must not run");
  });
  const capture = responseCapture();
  await edge.handle(
    request(),
    capture.stream,
    new URL("http://gateway/v1/vendors/databento/v0/unknown"),
  );
  await capture.finished;
  assert.equal(capture.stream.statusCode, 404);
});
