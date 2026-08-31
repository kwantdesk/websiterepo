import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { JournalServiceProxy } from "../src/journal-service-proxy.mjs";

const subject = "8f3b0a7d-2f69-4dc4-9ad8-bc6a76fb4441";
const serviceToken = "j".repeat(48);

function request(method, body = "", headers = {}) {
  const stream = Readable.from(body ? [Buffer.from(body)] : []);
  stream.method = method; stream.headers = headers; return stream;
}

function responseRecorder() {
  return {
    status: null, headers: null, chunks: [], headersSent: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); return true; },
    end(chunk) { if (chunk) this.chunks.push(Buffer.from(chunk)); },
    destroy(error) { this.destroyError = error; },
    text() { return Buffer.concat(this.chunks).toString("utf8"); },
  };
}

test("forwards only fixed identity-bound Journal routes and strips the desktop bearer", async () => {
  const captured = [];
  const proxy = new JournalServiceProxy({
    origin: "https://journal.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured.push({ url: String(url), init });
      return new Response('{"cloud":true}', { headers: { "Content-Type": "application/json" } });
    },
  });
  const cases = [
    ["GET", "/v1/journal/state", ""],
    ["POST", "/v1/journal/state", '{"action":"create-account","account":"Desk"}'],
    ["DELETE", "/v1/journal/state?tradeId=manual%3Aone", ""],
    ["GET", "/v1/journal/analysis?account=Overall%20Journal", ""],
    ["POST", "/v1/journal/analysis", JSON.stringify({
      account: "Overall Journal",
      evidence: { version: 1, account: "Overall Journal", fingerprint: "ja1-test-3", performance: { trades: 3 } },
    })],
  ];
  for (const [method, path, body] of cases) {
    const downstream = responseRecorder();
    await proxy.forward(request(method, body, { "content-type": "application/json", authorization: "Bearer public-ticket" }), downstream, new URL(`https://feed.example${path}`), { subject });
    assert.equal(downstream.status, 200);
    assert.equal(downstream.headers["X-KwantDesk-Data-Edge"], "JOURNAL-VPS");
  }
  assert.deepEqual(captured.map((item) => item.url), [
    "https://journal.internal.example/api/journal",
    "https://journal.internal.example/api/journal",
    "https://journal.internal.example/api/journal?tradeId=manual%3Aone",
    "https://journal.internal.example/api/journal/analysis?account=Overall%20Journal",
    "https://journal.internal.example/api/journal/analysis",
  ]);
  for (const item of captured) {
    assert.equal(item.init.headers["x-kwantdesk-internal-journal-token"], serviceToken);
    assert.equal(item.init.headers["x-kwantdesk-desktop-subject"], subject);
    assert.equal(item.init.headers.Authorization, undefined);
  }
});

test("rejects open-proxy paths, malformed delete scopes and unsupported mutations", async () => {
  let calls = 0;
  const proxy = new JournalServiceProxy({
    origin: "https://journal.internal.example",
    serviceToken,
    fetchImpl: async () => { calls += 1; return new Response("{}", { headers: { "Content-Type": "application/json" } }); },
  });
  assert.equal(proxy.canHandle("GET", "/v1/journal/state"), true);
  assert.equal(proxy.canHandle("GET", "/v1/journal/analysis"), true);
  assert.equal(proxy.canHandle("GET", "/api/journal"), false);
  await assert.rejects(proxy.forward(request("GET"), responseRecorder(), new URL("https://feed.example/v1/journal/state"), null), (error) => error.code === "journal_desktop_identity_required");
  for (const [method, path, body] of [
    ["GET", "/v1/journal/state?target=https%3A%2F%2Fevil.example", ""],
    ["DELETE", "/v1/journal/state?tradeId=one&evidenceId=two", ""],
    ["DELETE", "/v1/journal/state?tradeId=%2Fetc%2Fpasswd", ""],
    ["POST", "/v1/journal/state", '{"action":"proxy","url":"https://evil.example"}'],
    ["GET", "/v1/journal/analysis?target=https%3A%2F%2Fevil.example", ""],
    ["POST", "/v1/journal/analysis", '{"account":"Desk","evidence":{"version":1,"account":"Other","fingerprint":"x","performance":{"trades":3}}}'],
  ]) await assert.rejects(
    proxy.forward(request(method, body, { "content-type": "application/json" }), responseRecorder(), new URL(`https://feed.example${path}`), { subject }),
    (error) => error.status === 400,
  );
  assert.equal(calls, 0);
});

test("configuration is paired and never exposes the service token in health", () => {
  assert.throws(() => new JournalServiceProxy({ origin: "https://journal.internal.example" }), /configured together/);
  const proxy = new JournalServiceProxy({ origin: "https://journal.internal.example", serviceToken });
  assert.equal(proxy.health().configured, true);
  assert.doesNotMatch(JSON.stringify(proxy.health()), new RegExp(serviceToken));
});
