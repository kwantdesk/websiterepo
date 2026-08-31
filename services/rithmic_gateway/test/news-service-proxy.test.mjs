import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import {
  NewsServiceProxy,
  newsServiceProxyContract,
} from "../src/news-service-proxy.mjs";

const subject = "8f3b0a7d-2f69-4dc4-9ad8-bc6a76fb4441";
const serviceToken = "n".repeat(48);

function request(method, body = "", headers = {}) {
  const stream = Readable.from(body ? [Buffer.from(body)] : []);
  stream.method = method;
  stream.headers = headers;
  return stream;
}

function responseRecorder() {
  return {
    status: null,
    headers: null,
    chunks: [],
    ended: false,
    headersSent: false,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
      this.headersSent = true;
    },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); return true; },
    end(chunk) { if (chunk) this.chunks.push(Buffer.from(chunk)); this.ended = true; },
    destroy(error) { this.destroyed = true; this.destroyError = error; },
    text() { return Buffer.concat(this.chunks).toString("utf8"); },
  };
}

test("forwards only fixed NEWS routes with a verified subject and strips the desktop bearer", async () => {
  const requests = [];
  const proxy = new NewsServiceProxy({
    origin: "https://news.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  for (const [method, path, body] of [
    ["GET", "/v1/news/calendar?from=2026-08-01&to=2026-09-01", ""],
    ["GET", "/v1/news/intelligence?refresh=1", ""],
    ["POST", "/v1/news/analyst", '{"message":"What changed?","instrument":"NQ","history":[]}'],
    ["GET", "/v1/news/friends", ""],
    ["POST", "/v1/news/share", '{"eventId":"event-1","timeZone":"UTC","targets":[]}'],
  ]) {
    const downstream = responseRecorder();
    await proxy.forward(
      request(method, body, { authorization: "Bearer public-desktop-ticket" }),
      downstream,
      new URL(`https://feed.example${path}`),
      { subject },
    );
    assert.equal(downstream.status, 200);
    assert.equal(downstream.headers["X-KwantDesk-Data-Edge"], "NEWS-VPS");
    assert.equal(downstream.text(), '{"ok":true}');
  }

  assert.equal(requests[0].url, "https://news.internal.example/api/economic-calendar?from=2026-08-01&to=2026-09-01");
  assert.equal(requests[1].url, "https://news.internal.example/api/macro-intelligence?refresh=1");
  assert.equal(requests[2].url, "https://news.internal.example/api/macro-intelligence");
  assert.equal(requests[3].url, "https://news.internal.example/api/news-sharing");
  assert.equal(requests[4].url, "https://news.internal.example/api/news-sharing");
  assert.equal(Buffer.from(requests[2].init.body).toString("utf8"), '{"message":"What changed?","instrument":"NQ","history":[]}');
  assert.equal(Buffer.from(requests[4].init.body).toString("utf8"), '{"eventId":"event-1","timeZone":"UTC","targets":[]}');
  for (const captured of requests) {
    assert.equal(captured.init.headers[newsServiceProxyContract.serviceTokenHeader], serviceToken);
    assert.equal(captured.init.headers[newsServiceProxyContract.subjectHeader], subject);
    assert.equal(captured.init.headers.Authorization, undefined);
  }
});

test("rejects unverified identities, open-proxy paths and malformed calendar scopes", async () => {
  let calls = 0;
  const proxy = new NewsServiceProxy({
    origin: "https://news.internal.example",
    serviceToken,
    fetchImpl: async () => {
      calls += 1;
      return new Response("{}", { headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(proxy.canHandle("GET", "/v1/news/calendar"), true);
  assert.equal(proxy.canHandle("GET", "/v1/news/calendar/"), false);
  assert.equal(proxy.canHandle("GET", "/api/economic-calendar"), false);

  await assert.rejects(
    proxy.forward(
      request("GET"),
      responseRecorder(),
      new URL("https://feed.example/v1/news/intelligence"),
      null,
    ),
    (error) => error.code === "news_desktop_identity_required" && error.status === 401,
  );

  for (const [method, url] of [
    ["GET", "https://feed.example/v1/news/calendar"],
    ["GET", "https://feed.example/v1/news/calendar?from=2026-08-01&to=2026-12-15"],
    ["GET", "https://feed.example/v1/news/calendar?from=bad&to=2026-08-02"],
    ["GET", "https://feed.example/v1/news/calendar?from=2026-08-01&from=2026-08-02&to=2026-08-03"],
    ["GET", "https://feed.example/v1/news/intelligence?refresh=2"],
    ["GET", "https://feed.example/v1/news/intelligence?target=https%3A%2F%2Fevil.example"],
    ["GET", "https://feed.example/v1/news/friends?target=someone"],
    ["POST", "https://feed.example/v1/news/share?event=1"],
  ]) {
    await assert.rejects(
      proxy.forward(request(method), responseRecorder(), new URL(url), { subject }),
      (error) => error.code === "news_invalid_query" && error.status === 400,
    );
  }
  assert.equal(calls, 0);
});

test("bounds analyst request bodies and service configuration", async () => {
  const proxy = new NewsServiceProxy({
    origin: "https://news.internal.example",
    serviceToken,
    fetchImpl: async () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
  });
  await assert.rejects(
    proxy.forward(
      request("POST", "{}", { "content-length": String(newsServiceProxyContract.maximumRequestBytes + 1) }),
      responseRecorder(),
      new URL("https://feed.example/v1/news/analyst"),
      { subject },
    ),
    (error) => error.code === "news_request_too_large" && error.status === 413,
  );
  assert.throws(() => new NewsServiceProxy({ origin: "https://news.internal.example" }), /configured together/);
  assert.throws(
    () => new NewsServiceProxy({ origin: "https://news.internal.example/path", serviceToken }),
    /must not contain/,
  );
  const health = proxy.health();
  assert.deepEqual(health, { configured: true, origin: "https://news.internal.example" });
  assert.doesNotMatch(JSON.stringify(health), new RegExp(serviceToken));
});
