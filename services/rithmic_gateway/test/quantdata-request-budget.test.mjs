import test from "node:test";
import assert from "node:assert/strict";
import { QuantDataRequestBudget, canonicalQuantDataRequest, quantDataRetryUntil } from "../src/quantdata-request-budget.mjs";

const PATH = "/v1/options/tool/net-drift";
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function harness(options = {}, fetcher = async () => new Response('{"data":{}}')) {
  let now = 0, id = 0;
  const timers = new Map(), calls = [];
  const scheduler = new QuantDataRequestBudget({ apiKey: "test-only", now: () => now,
    setTimeoutImpl: (fn, delay) => { const key = ++id; timers.set(key, { fn, at: now + delay }); return key; },
    clearTimeoutImpl: key => timers.delete(key),
    fetchImpl: async (...args) => { calls.push({ at: now, url: args[0], init: args[1] }); return fetcher(...args); }, ...options });
  return { scheduler, calls, timers, now: () => now, async advance(ms) {
    const end = now + ms; await flush();
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
    }
    now = end; await flush();
  } };
}
const request = (h, ticker, extra = {}) => h.scheduler.request(PATH, { body: { filter: { ticker } }, ...extra });

test("canonical request identity sorts objects, preserves array order and endpoint scope", () => {
  const a = canonicalQuantDataRequest(PATH, { b: [2, 1], a: { z: 1, x: 2 } });
  const b = canonicalQuantDataRequest(PATH, Buffer.from('{"a":{"x":2,"z":1},"b":[2,1]}'));
  assert.equal(a.key, b.key); assert.equal(a.body, b.body);
  assert.notEqual(a.key, canonicalQuantDataRequest(PATH, { b: [1, 2], a: { z: 1, x: 2 } }).key);
  assert.notEqual(a.key, canonicalQuantDataRequest("/v1/options/tool/heat-map", JSON.parse(a.body)).key);
});

test("invalid endpoint/body/cycles/depth and unsupported values fail closed", () => {
  for (const path of ["https://other.example/v1/options", "/v1/options/../secret", "/v1/options?token=x", "/v1//options", "/v1/%2e"]) assert.throws(() => canonicalQuantDataRequest(path, {}));
  const cyclic = {}; cyclic.self = cyclic;
  let nested = {}; for (let i = 0; i < 35; i++) nested = { nested };
  for (const body of [null, [], "oops", { x: undefined }, { x: NaN }, { x: Infinity }, { sparse: new Array(3) }, cyclic, nested, { date: new Date() }]) assert.throws(() => canonicalQuantDataRequest(PATH, body));
});

test("coalesced consumers spend one start and fetch adapter returns independently readable responses", async () => {
  const h = harness();
  const first = h.scheduler.fetch(PATH, { body: '{"b":2,"a":1}' });
  const second = h.scheduler.fetch(PATH, { body: { a: 1, b: 2 } });
  const [a, b] = await Promise.all([first, second]);
  assert.equal(h.calls.length, 1); assert.equal(await a.text(), await b.text());
  assert.equal(h.calls[0].url, `https://api.quantdata.us${PATH}`);
  assert.equal(h.calls[0].init.headers.Authorization, "Bearer test-only");
  assert.equal(h.scheduler.status().retainedRequestBytes, 0); assert.equal(h.timers.size, 0);
  h.scheduler.close();
});

test("minimum spacing applies across different keys, not merely within one pane", async () => {
  const h = harness({ minSpacingMs: 1 });
  const jobs = [request(h, "SPY"), request(h, "QQQ"), request(h, "SPX")];
  await h.advance(349); assert.deepEqual(h.calls.map(c => c.at), [0]);
  await h.advance(1); assert.deepEqual(h.calls.map(c => c.at), [0, 350]);
  await h.advance(350); await Promise.all(jobs); assert.deepEqual(h.calls.map(c => c.at), [0, 350, 700]);
  h.scheduler.close();
});

test("sliding minute cap cannot reset at a calendar minute boundary", async () => {
  const h = harness({ budgetPerMinute: 2 });
  const jobs = [request(h, "SPY"), request(h, "QQQ"), request(h, "SPX"), request(h, "NDX")];
  await h.advance(59_999); assert.deepEqual(h.calls.map(c => c.at), [0, 350]);
  await h.advance(1); assert.deepEqual(h.calls.map(c => c.at), [0, 350, 60_000]);
  await h.advance(350); await Promise.all(jobs); assert.equal(h.calls[3].at, 60_350);
  h.scheduler.close();
});

test("burst cap applies independently of minute headroom", async () => {
  const h = harness({ burstLimit: 1 });
  const a = request(h, "SPY"), b = request(h, "QQQ");
  await h.advance(999); assert.equal(h.calls.length, 1);
  await h.advance(1); await Promise.all([a, b]); assert.equal(h.calls[1].at, 1000); h.scheduler.close();
});

test("configuration cannot raise default reservation above180/min or provider burst20", () => {
  const h = harness({ budgetPerMinute: 1000, burstLimit: 1000 });
  assert.equal(h.scheduler.status().limitPerMinute, 180); assert.equal(h.scheduler.burstLimit, 20); h.scheduler.close();
});

test("provider lower runtime limit is authoritative and never raised by a later header", async () => {
  let count = 0;
  const h = harness({}, async () => new Response("{}", { headers: { "x-ratelimit-limit": ++count === 1 ? "1" : "240" } }));
  const a = request(h, "SPY"), b = request(h, "QQQ");
  await h.advance(59_999); assert.equal(h.calls.length, 1); assert.equal(h.scheduler.status().limitPerMinute, 1);
  await h.advance(1); await Promise.all([a, b]); assert.equal(h.scheduler.status().limitPerMinute, 1); h.scheduler.close();
});

test("429 full90-second Retry-After blocks every other request key without automatic retry", async () => {
  let first = true;
  const h = harness({}, async () => first ? (first = false, new Response("limited", { status: 429, headers: { "retry-after": "90" } })) : new Response("{}"));
  const a = request(h, "SPY"), b = request(h, "QQQ");
  assert.equal((await a).status, 429);
  await h.advance(89_999); assert.equal(h.calls.length, 1);
  await h.advance(1); await b; assert.equal(h.calls[1].at, 90_000); assert.equal(h.calls.length, 2); h.scheduler.close();
});

test("Retry-After supports HTTP date and malformed value conservatively", () => {
  assert.equal(quantDataRetryUntil(new Headers({ "retry-after": "Thu, 01 Jan 1970 00:02:00 GMT" }), 0), 120_000);
  assert.equal(quantDataRetryUntil(new Headers({ "retry-after": "broken" }), 0), 60_000);
  assert.equal(quantDataRetryUntil(new Headers({ "retry-after": "-1" }), 0), 60_000);
  assert.equal(quantDataRetryUntil(new Headers({ "retry-after": "3000000" }), 0), 3_000_000_000);
});

test("exhausted runtime remaining pauses all keys until reset; low remaining paces", async () => {
  let first = true;
  const h = harness({}, async () => new Response("{}", { headers: first ? (first = false, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "7" }) : {} }));
  const a = request(h, "SPY"), b = request(h, "QQQ");
  await h.advance(6999); assert.equal(h.calls.length, 1);
  await h.advance(1); await Promise.all([a, b]); assert.equal(h.calls[1].at, 7000); h.scheduler.close();
  const paced = harness({}, async () => new Response("{}", { headers: { "x-ratelimit-remaining": "2", "x-ratelimit-reset": "10" } }));
  const c = request(paced, "SPY"), d = request(paced, "QQQ");
  await paced.advance(4999); assert.equal(paced.calls.length, 1);
  await paced.advance(1); await Promise.all([c, d]); assert.equal(paced.calls[1].at, 5000); paced.scheduler.close();
});

test("normal remaining headroom does not serialize a workspace over the full refill window", async () => {
  const h = harness({}, async () => new Response("{}", { headers: {
    "x-ratelimit-limit": "240", "x-ratelimit-remaining": "19", "x-ratelimit-reset": "55",
  } }));
  const jobs = Array.from({ length: 12 }, (_, index) => request(h, 'T' + index));
  await h.advance(3850); await Promise.all(jobs);
  assert.equal(h.calls.length, 12);
  assert.equal(h.calls.at(-1).at, 3850);
  assert.equal(h.scheduler.status().limitPerMinute, 180);
  h.scheduler.close();
});

test("queue count/bytes, per-request size and coalesced waiter count are bounded", async () => {
  const h = harness({ maxPending: 1, maxWaitersPerRequest: 1 }, () => new Promise(() => {}));
  const a = request(h, "SPY"); const rejection = assert.rejects(a, { code: "scheduler_closed" });
  await assert.rejects(request(h, "QQQ"), { code: "queue_full" });
  await assert.rejects(request(h, "SPY"), { code: "queue_full" });
  h.scheduler.close(); await rejection; await flush(); assert.equal(h.timers.size, 0); assert.equal(h.scheduler.status().running, 0);
  const bytes = harness({ maxRequestBytes: 20, maxQueuedBytes: 10 });
  await assert.rejects(bytes.scheduler.request(PATH, { body: { long: "a".repeat(21) } }), { code: "request_too_large" });
  await assert.rejects(bytes.scheduler.request(PATH, { body: { abc: "xyz" } }), { code: "queue_full" }); bytes.scheduler.close();
});

test("canceling one shared consumer preserves the other; canceling last aborts acquisition", async () => {
  let finish;
  const h = harness({}, () => new Promise(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const a = request(h, "SPY", { signal: controller.signal }), b = request(h, "SPY");
  const rejected = assert.rejects(a, { name: "AbortError" }); controller.abort(); await rejected;
  assert.equal(h.calls[0].init.signal.aborted, false); finish(new Response("{}")); await b;
  const second = new AbortController(); const c = request(h, "QQQ", { signal: second.signal });
  const canceled = assert.rejects(c, { name: "AbortError" }); second.abort(); await canceled;
  await flush(); assert.equal(h.scheduler.status().waiters, 0); assert.equal(h.scheduler.status().pending, 0); h.scheduler.close();
});

test("queued cancellation removes timer/identity and an aborted caller never starts", async () => {
  const h = harness(); await request(h, "SPY");
  const controller = new AbortController(); const queued = request(h, "QQQ", { signal: controller.signal });
  const rejected = assert.rejects(queued, { name: "AbortError" }); controller.abort(); await rejected;
  await h.advance(1000); assert.equal(h.calls.length, 1); assert.equal(h.timers.size, 0);
  await assert.rejects(request(h, "QQQ", { signal: controller.signal }), { name: "AbortError" }); h.scheduler.close();
});

test("timeout closes hung fetch and releases slots even when injected fetch ignores abort", async () => {
  const h = harness({ requestTimeoutMs: 50 }, () => new Promise(() => {}));
  const a = request(h, "SPY"), checked = assert.rejects(a, { code: "request_timeout" });
  await h.advance(50); await checked; assert.equal(h.calls[0].init.signal.aborted, true);
  assert.equal(h.scheduler.status().running, 0); assert.equal(h.scheduler.status().pending, 0); assert.equal(h.timers.size, 0); h.scheduler.close();
});

test("streaming response size is bounded with or without Content-Length", async () => {
  for (const headers of [{ "content-length": "100" }, {}]) {
    const h = harness({ maxResponseBytes: 4 }, async () => new Response("12345", { headers }));
    await assert.rejects(request(h, "SPY"), { code: "response_too_large" });
    assert.equal(h.scheduler.status().retainedRequestBytes, 0); h.scheduler.close();
  }
});

test("close rejects active and queued callers, aborts transport and cleans every timer", async () => {
  const h = harness({}, () => new Promise(() => {}));
  const a = request(h, "SPY"), b = request(h, "QQQ");
  const all = [assert.rejects(a, { code: "scheduler_closed" }), assert.rejects(b, { code: "scheduler_closed" })];
  h.scheduler.close(); await Promise.all(all); await flush();
  assert.equal(h.calls[0].init.signal.aborted, true); assert.equal(h.timers.size, 0);
  assert.equal(h.scheduler.status().pending, 0); assert.equal(h.scheduler.status().running, 0); assert.equal(h.scheduler.status().waiters, 0);
  await assert.rejects(request(h, "SPY"), { code: "scheduler_closed" }); h.scheduler.close();
});

test("a refusal blocks other keys at header arrival even while its response body stalls", async () => {
  let streamController;
  const h = harness({ requestTimeoutMs: 1000 }, async () => new Response(new ReadableStream({ start(controller) { streamController = controller; } }), { status: 429, headers: { "retry-after": "90" } }));
  const a = request(h, "SPY"), b = request(h, "QQQ");
  const first = assert.rejects(a, { code: "request_timeout" });
  const second = assert.rejects(b, { code: "scheduler_closed" });
  await h.advance(999); assert.equal(h.calls.length, 1); assert.equal(h.scheduler.status().blockedUntil, 90_000);
  await h.advance(1); await first; assert.equal(h.calls.length, 1); assert.ok(streamController);
  h.scheduler.close(); await second;
});

test("a canceled active identity cannot poison a new subscriber of the same request", async () => {
  let finish;
  const h = harness({}, () => new Promise(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const a = request(h, "SPY", { signal: controller.signal });
  const first = assert.rejects(a, { name: "AbortError" }); controller.abort(); await first;
  const b = request(h, "SPY");
  await h.advance(350); assert.equal(h.calls.length, 2); finish(new Response("fresh"));
  assert.equal((await b).body.toString(), "fresh"); assert.equal(h.scheduler.status().pending, 0); h.scheduler.close();
});

test("the total consumer bound spans identities, not just followers of one key", async () => {
  const h = harness({ maxWaiters: 2 }, () => new Promise(() => {}));
  const a = request(h, "SPY"), b = request(h, "QQQ");
  const checked = [assert.rejects(a, { code: "scheduler_closed" }), assert.rejects(b, { code: "scheduler_closed" })];
  await assert.rejects(request(h, "SPX"), { code: "queue_full" });
  h.scheduler.close(); await Promise.all(checked); await flush(); assert.equal(h.timers.size, 0);
});

test("the fetch adapter rejects unsupported verbs and handles bodyless statuses", async () => {
  const h = harness({}, async () => new Response(null, { status: 204 }));
  await assert.rejects(h.scheduler.fetch(PATH, { method: "GET" }), { status: 405 });
  const response = await h.scheduler.fetch(PATH); assert.equal(response.status, 204); assert.equal(await response.text(), ""); h.scheduler.close();
});
