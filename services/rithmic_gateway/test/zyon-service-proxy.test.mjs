import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import {
  ZyonServiceProxy,
  zyonServiceProxyContract,
} from "../src/zyon-service-proxy.mjs";

const subject = "8f3b0a7d-2f69-4dc4-9ad8-bc6a76fb4441";
const serviceToken = "z".repeat(48);

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
    write(chunk) {
      this.chunks.push(Buffer.from(chunk));
      return true;
    },
    end(chunk) {
      if (chunk) this.chunks.push(Buffer.from(chunk));
      this.ended = true;
    },
    destroy(error) {
      this.destroyed = true;
      this.destroyError = error;
    },
    text() { return Buffer.concat(this.chunks).toString("utf8"); },
  };
}

test("forwards only the fixed ZYON route and binds it to the verified ticket subject", async () => {
  let captured;
  const proxy = new ZyonServiceProxy({
    origin: "https://zyon.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response(
        '{"type":"activity","label":"Reading context"}\n' +
        '{"type":"complete","payload":{"text":"Ready"}}\n',
        { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
      );
    },
  });
  const downstream = responseRecorder();
  await proxy.forward(
    request("POST", '{"messages":[{"role":"user","content":"Review NQ"}]}', {
      accept: "application/x-ndjson",
      authorization: "Bearer public-desktop-ticket-must-not-be-forwarded",
    }),
    downstream,
    new URL("https://feed.example/v1/zyon/messages"),
    { subject },
  );

  assert.equal(captured.url, "https://zyon.internal.example/api/zyon");
  assert.equal(captured.init.headers[zyonServiceProxyContract.serviceTokenHeader], serviceToken);
  assert.equal(captured.init.headers[zyonServiceProxyContract.subjectHeader], subject);
  assert.equal(captured.init.headers.Authorization, undefined);
  assert.equal(captured.init.headers.Accept, "application/x-ndjson");
  assert.equal(downstream.status, 200);
  assert.equal(downstream.headers["X-KwantDesk-Data-Edge"], "ZYON-VPS");
  assert.match(downstream.text(), /"type":"complete"/);
  assert.equal(downstream.ended, true);
});

test("fails closed without a verified UUID principal and never calls upstream", async () => {
  let calls = 0;
  const proxy = new ZyonServiceProxy({
    origin: "https://zyon.internal.example",
    serviceToken,
    fetchImpl: async () => { calls += 1; return new Response("{}"); },
  });
  await assert.rejects(
    proxy.forward(
      request("GET"),
      responseRecorder(),
      new URL("https://feed.example/v1/zyon/health?root=NQ"),
      null,
    ),
    (error) => error.code === "zyon_desktop_identity_required" && error.status === 401,
  );
  assert.equal(calls, 0);
});

test("rejects open-proxy paths, duplicate or unknown query keys, bad roots, and oversized bodies", async () => {
  const proxy = new ZyonServiceProxy({
    origin: "https://zyon.internal.example",
    serviceToken,
    fetchImpl: async () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
  });
  assert.equal(proxy.canHandle("POST", "/v1/zyon/messages"), true);
  assert.equal(proxy.canHandle("POST", "/v1/zyon/messages/"), false);
  assert.equal(proxy.canHandle("GET", "/api/zyon"), false);

  for (const url of [
    "https://feed.example/v1/zyon/health?root=YM",
    "https://feed.example/v1/zyon/health?root=NQ&root=ES",
    "https://feed.example/v1/zyon/health?target=https%3A%2F%2Fevil.example",
  ]) {
    await assert.rejects(
      proxy.forward(request("GET"), responseRecorder(), new URL(url), { subject }),
      (error) => error.code === "zyon_invalid_query" && error.status === 400,
    );
  }
  await assert.rejects(
    proxy.forward(
      request("POST", "{}", { "content-length": String(zyonServiceProxyContract.maximumRequestBytes + 1) }),
      responseRecorder(),
      new URL("https://feed.example/v1/zyon/messages"),
      { subject },
    ),
    (error) => error.code === "zyon_request_too_large" && error.status === 413,
  );
});

test("configuration is paired, bounded, and health never exposes the service token", () => {
  assert.throws(
    () => new ZyonServiceProxy({ origin: "https://zyon.internal.example" }),
    /configured together/,
  );
  assert.throws(
    () => new ZyonServiceProxy({ origin: "https://zyon.internal.example/path", serviceToken }),
    /must not contain/,
  );
  const health = new ZyonServiceProxy({
    origin: "https://zyon.internal.example",
    serviceToken,
  }).health();
  assert.deepEqual(health, { configured: true, origin: "https://zyon.internal.example" });
  assert.doesNotMatch(JSON.stringify(health), new RegExp(serviceToken));
});

test("GAMEPLAN analyst memory uses a fixed bounded account archive and rejects broader bodies", async () => {
  const captured = [];
  const proxy = new ZyonServiceProxy({
    origin: "https://zyon.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured.push({ url: String(url), init });
      return new Response('{"storage":"supabase","memory":[]}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await proxy.forward(
    request("GET"),
    responseRecorder(),
    new URL("https://feed.example/v1/zyon/gameplan-analyst-archive?root=NQ"),
    { subject },
  );
  assert.equal(
    captured[0].url,
    "https://zyon.internal.example/api/kwantbot/archive?root=NQ&messageLimit=1&memoryLimit=600&contextLimit=1",
  );

  const id = "gameplan-analyst-nq-49f31f64-4f31-4c27-9af3-000000000001";
  const createdAt = "2026-08-30T01:02:03.000Z";
  const valid = JSON.stringify({
    memory: [{
      id,
      root: "NQ",
      type: "context",
      createdAt,
      price: 24120,
      levelId: "2026-08-30:newyork:THE HINGE:24110:24125",
      levelName: "THE HINGE",
      zone: [24110, 24125],
      reasoning: "Completed-window evidence.",
      detail: "Kwant Desk Gameplan Live Market Analyst",
      analyst: {
        modelVersion: "gameplan-live-analyst-v1",
        id,
        root: "NQ",
        generatedAt: createdAt,
        price: 24120,
        nearestLevel: { id: "2026-08-30:newyork:THE HINGE:24110:24125" },
      },
    }],
  });
  await proxy.forward(
    request("POST", valid),
    responseRecorder(),
    new URL("https://feed.example/v1/zyon/gameplan-analyst-archive"),
    { subject },
  );
  assert.equal(captured[1].url, "https://zyon.internal.example/api/kwantbot/archive");
  assert.equal(captured[1].init.headers.authorization, undefined);
  assert.equal(captured[1].init.headers[zyonServiceProxyContract.subjectHeader], subject);

  for (const invalid of [
    JSON.stringify({ messages: [] }),
    JSON.stringify({ memory: [{ ...JSON.parse(valid).memory[0], root: "ES" }] }),
    JSON.stringify({ memory: [{ ...JSON.parse(valid).memory[0], type: "trade" }] }),
  ]) {
    await assert.rejects(
      proxy.forward(
        request("POST", invalid),
        responseRecorder(),
        new URL("https://feed.example/v1/zyon/gameplan-analyst-archive"),
        { subject },
      ),
      (error) => error.code === "zyon_invalid_request" && error.status === 400,
    );
  }
});

test("KwantBot archive exposes a separate bounded desktop route with full paging and batch validation", async () => {
  const captured = [];
  const proxy = new ZyonServiceProxy({
    origin: "https://zyon.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured.push({ url: String(url), init });
      return new Response('{"configured":true,"messages":[],"memory":[],"contexts":[]}', {
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await proxy.forward(
    request("GET"),
    responseRecorder(),
    new URL("https://feed.example/v1/kwantbot/archive?root=NQ&messageLimit=180&memoryLimit=600&contextLimit=24"),
    { subject },
  );
  assert.equal(
    captured[0].url,
    "https://zyon.internal.example/api/kwantbot/archive?root=NQ&messageLimit=180&memoryLimit=600&contextLimit=24",
  );

  const createdAt = "2026-08-30T14:30:00.000Z";
  const body = JSON.stringify({
    messages: [{
      id: "kwantbot-system-1",
      root: "NQ",
      kind: "system",
      text: "Interpreter online.",
      createdAt,
      dedupeKey: "context:1",
    }],
    memory: [{
      id: "memory-price-1",
      root: "NQ",
      type: "price",
      createdAt,
      price: 24120,
    }],
    contexts: [{
      snapshotKey: "NQ:123",
      context: {
        root: "NQ",
        generatedAt: createdAt,
        levels: [],
        options: {},
      },
    }],
  });
  await proxy.forward(
    request("POST", body),
    responseRecorder(),
    new URL("https://feed.example/v1/kwantbot/archive"),
    { subject },
  );
  assert.equal(captured[1].url, "https://zyon.internal.example/api/kwantbot/archive");
  assert.equal(captured[1].init.headers[zyonServiceProxyContract.subjectHeader], subject);

  for (const invalid of [
    JSON.stringify({}),
    JSON.stringify({ messages: [{ ...JSON.parse(body).messages[0], root: "YM" }] }),
    JSON.stringify({ contexts: [{ snapshotKey: "NQ:1", context: { root: "NQ" } }] }),
  ]) {
    await assert.rejects(
      proxy.forward(
        request("POST", invalid),
        responseRecorder(),
        new URL("https://feed.example/v1/kwantbot/archive"),
        { subject },
      ),
      (error) => error.code === "zyon_invalid_request" && error.status === 400,
    );
  }
  await assert.rejects(
    proxy.forward(
      request("GET"),
      responseRecorder(),
      new URL("https://feed.example/v1/kwantbot/archive?download=yes"),
      { subject },
    ),
    (error) => error.code === "zyon_invalid_query" && error.status === 400,
  );
});

test("GAMEPLAN locking uses one fixed version-bound mutation and rejects broader bodies", async () => {
  let captured;
  const proxy = new ZyonServiceProxy({
    origin: "https://zyon.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response('{"object":{"id":"precord:zyon-gameplan-12345678"}}', {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  const valid = JSON.stringify({
    draftId: "zyon-gameplan-12345678",
    expectedUpdatedAt: "2026-08-30T01:02:03.000Z",
  });
  await proxy.forward(
    request("POST", valid, { authorization: "Bearer must-not-forward" }),
    responseRecorder(),
    new URL("https://feed.example/v1/zyon/gameplan-lock"),
    { subject },
  );
  assert.equal(captured.url, "https://zyon.internal.example/api/zyon/gameplan-lock");
  assert.equal(captured.init.body.toString("utf8"), valid);
  assert.equal(captured.init.headers.authorization, undefined);
  assert.equal(captured.init.headers[zyonServiceProxyContract.subjectHeader], subject);

  for (const invalid of [
    JSON.stringify({ draftId: "short", expectedUpdatedAt: "2026-08-30T01:02:03.000Z" }),
    JSON.stringify({ draftId: "zyon-gameplan-12345678", expectedUpdatedAt: "not-a-date" }),
    JSON.stringify({ draftId: "zyon-gameplan-12345678", expectedUpdatedAt: "2026-08-30T01:02:03.000Z", object: {} }),
  ]) {
    await assert.rejects(
      proxy.forward(
        request("POST", invalid),
        responseRecorder(),
        new URL("https://feed.example/v1/zyon/gameplan-lock"),
        { subject },
      ),
      (error) => error.code === "zyon_invalid_request" && error.status === 400,
    );
  }
});
