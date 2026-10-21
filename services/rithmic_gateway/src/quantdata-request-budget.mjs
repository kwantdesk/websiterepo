import { createHash } from "node:crypto";

const ORIGIN = "https://api.quantdata.us";
const MINUTE = 60_000;
const MAX_TIMER = 2_147_483_647;
const failure = (message, code, status = 503) => Object.assign(new Error(message), { code, status });
const aborted = () => Object.assign(new Error("The data request was aborted."), { name: "AbortError", code: "ABORT_ERR" });

function integer(value, fallback, minimum, maximum) {
  return Number.isSafeInteger(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function canonical(value, seen = new Set(), depth = 0) {
  if (depth > 32) throw failure("Request nesting is too deep.", "invalid_request", 400);
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (!value || typeof value !== "object" || seen.has(value)) throw failure("Request must contain finite JSON values.", "invalid_request", 400);
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw failure("Request must be a JSON object.", "invalid_request", 400);
  seen.add(value);
  const result = Array.isArray(value)
    ? `[${Array.from({ length: value.length }, (_, index) => {
      if (!Object.hasOwn(value, index)) throw failure("Sparse JSON arrays are not supported.", "invalid_request", 400);
      return canonical(value[index], seen, depth + 1);
    }).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key], seen, depth + 1)}`).join(",")}}`;
  seen.delete(value);
  return result;
}

/** Stable JSON object ordering; arrays retain their semantic order. No URL/credential is accepted. */
export function canonicalQuantDataRequest(path, body = {}) {
  if (typeof path !== "string" || path.length > 512 || !/^\/v1\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(path)) throw failure("Unsupported data endpoint.", "invalid_request", 400);
  let value = body;
  if (typeof body === "string" || Buffer.isBuffer(body) || body instanceof Uint8Array) {
    try { value = JSON.parse(Buffer.isBuffer(body) || body instanceof Uint8Array ? Buffer.from(body).toString("utf8") : body); }
    catch { throw failure("Request must contain valid JSON.", "invalid_request", 400); }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw failure("Request must be a JSON object.", "invalid_request", 400);
  const serialized = canonical(value);
  return { path, body: serialized, bytes: Buffer.byteLength(serialized), key: createHash("sha256").update(path).update("\n").update(serialized).digest("hex") };
}

function headerNumber(headers, name) {
  const raw = headers?.get?.(name);
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Retry-After seconds or HTTP-date. No short clamp that reopens the account early. */
export function quantDataRetryUntil(headers, now, fallbackMs = MINUTE) {
  const raw = headers?.get?.("retry-after");
  if (raw !== null && raw !== undefined && String(raw).trim()) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds < 0) return now + fallbackMs;
    const date = Number.isFinite(seconds) ? now + seconds * 1000 : Date.parse(raw);
    if (Number.isFinite(date) && date <= 8_640_000_000_000_000) return Math.max(now, date);
  }
  return now + fallbackMs;
}

/** Adapt existing provider clients without turning the scheduler into an open proxy. */
export function createQuantDataBudgetFetch(budget) {
  return async (input, init = {}) => {
    let url;
    try { url = new URL(String(input)); }
    catch { throw failure("Unsupported data endpoint.", "invalid_request", 400); }
    if (url.origin !== ORIGIN || url.username || url.password || url.search || url.hash) throw failure("Unsupported data endpoint.", "invalid_request", 400);
    if (!budget) throw failure("Provider credential is required.", "provider_unconfigured");
    return budget.fetch(url.pathname, init);
  };
}

/**
 * A SINGLE instance must own every upstream REST caller for one provider account.
 * Does not cache successes or retry refusals. It buffers each response once for
 * independent consumers; consumer cancellation cannot cancel another consumer.
 * All starts count, including failures/aborted requests. No provider key escapes.
 */
export class QuantDataRequestBudget {
  constructor({ apiKey, fetchImpl = fetch, now = Date.now, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout,
    budgetPerMinute = 180, burstLimit = 4, minSpacingMs = 350, maxConcurrent = 2,
    maxPending = 32, maxWaiters = 64, maxWaitersPerRequest = 16, maxRequestBytes = 128_000,
    maxQueuedBytes = 2_000_000, maxResponseBytes = 12_000_000, requestTimeoutMs = 30_000 } = {}) {
    if (typeof apiKey !== "string" || !apiKey.trim()) throw failure("Provider credential is required.", "provider_unconfigured");
    this.apiKey = apiKey.trim(); this.fetchImpl = fetchImpl; this.now = now;
    this.setTimeout = setTimeoutImpl; this.clearTimeout = clearTimeoutImpl;
    this.limit = integer(budgetPerMinute, 180, 1, 180);
    this.burstLimit = integer(burstLimit, 4, 1, 20);
    this.spacing = integer(minSpacingMs, 350, 350, MINUTE);
    this.maxConcurrent = integer(maxConcurrent, 2, 1, 8);
    this.maxPending = integer(maxPending, 32, 1, 256);
    this.maxWaiters = integer(maxWaiters, 64, 1, 1024);
    this.maxWaitersPerRequest = integer(maxWaitersPerRequest, 16, 1, 128);
    this.maxRequestBytes = integer(maxRequestBytes, 128_000, 2, 1_000_000);
    this.maxQueuedBytes = integer(maxQueuedBytes, 2_000_000, 2, 16_000_000);
    this.maxResponseBytes = integer(maxResponseBytes, 12_000_000, 1, 32_000_000);
    this.timeoutMs = integer(requestTimeoutMs, 30_000, 1, 120_000);
    this.jobs = new Map(); this.queue = []; this.starts = []; this.bytes = 0; this.waiters = 0;
    this.running = 0; this.nextStartAt = 0; this.blockedUntil = 0; this.headerPaceUntil = 0;
    this.wake = null; this.closed = false;
  }

  status() {
    this.#prune(this.now());
    return { closed: this.closed, pending: this.jobs.size, queued: this.queue.length, running: this.running,
      retainedRequestBytes: this.bytes, waiters: this.waiters, startsInMinute: this.starts.length,
      limitPerMinute: this.limit, blockedUntil: this.blockedUntil || null };
  }

  request(path, { body = {}, signal } = {}) {
    if (this.closed) return Promise.reject(failure("The data scheduler is closed.", "scheduler_closed"));
    if (signal?.aborted) return Promise.reject(aborted());
    let prepared;
    try {
      // Bound encoded input before parsing/canonicalizing hostile strings.
      if ((typeof body === "string" || Buffer.isBuffer(body) || body instanceof Uint8Array) && Buffer.byteLength(body) > this.maxRequestBytes) throw failure("Request is too large.", "request_too_large", 413);
      prepared = canonicalQuantDataRequest(path, body);
      if (prepared.bytes > this.maxRequestBytes) throw failure("Request is too large.", "request_too_large", 413);
    } catch (error) { return Promise.reject(error); }
    let job = this.jobs.get(prepared.key);
    if (this.waiters >= this.maxWaiters || (job && job.waiters.size >= this.maxWaitersPerRequest)) return Promise.reject(failure("The data queue is busy.", "queue_full"));
    if (!job) {
      if (this.jobs.size >= this.maxPending || this.bytes + prepared.bytes > this.maxQueuedBytes) return Promise.reject(failure("The data queue is busy.", "queue_full"));
      job = { ...prepared, waiters: new Set(), controller: null, timeout: null, started: false, settled: false };
      this.jobs.set(job.key, job); this.queue.push(job); this.bytes += job.bytes;
    }
    const promise = new Promise((resolve, reject) => {
      const waiter = { resolve, reject, signal, abort: null };
      waiter.abort = () => {
        if (!job.waiters.delete(waiter)) return;
        this.waiters--; signal?.removeEventListener("abort", waiter.abort); reject(aborted());
        if (!job.waiters.size) {
          // Remove identity immediately: a new consumer cannot join a canceled fetch.
          this.#release(job);
          if (job.started) job.controller.abort();
          else this.queue = this.queue.filter(item => item !== job);
          this.#pump();
        }
      };
      job.waiters.add(waiter); this.waiters++;
      signal?.addEventListener("abort", waiter.abort, { once: true });
      if (signal?.aborted) waiter.abort();
    });
    this.#pump();
    return promise;
  }

  /** Fetch-compatible adapter. Headers are fixed; arbitrary auth cannot bypass identity. */
  async fetch(path, { body = {}, signal, method = "POST" } = {}) {
    if (method !== "POST") throw failure("Only POST data requests are supported.", "invalid_request", 405);
    const entry = await this.request(path, { body, signal });
    return new Response([204, 205, 304].includes(entry.status) ? null : entry.body,
      { status: entry.status, headers: entry.headers });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.wake !== null) this.clearTimeout(this.wake);
    this.wake = null;
    for (const job of this.jobs.values()) {
      this.#settle(job, failure("The data scheduler is closed.", "scheduler_closed"));
      if (job.timeout !== null) this.clearTimeout(job.timeout);
      job.controller?.abort();
    }
    this.queue = []; this.starts = [];
  }

  #prune(now) { this.starts = this.starts.filter(time => time > now - MINUTE); }

  #pump() {
    if (this.closed) return;
    if (this.wake !== null) { this.clearTimeout(this.wake); this.wake = null; }
    if (!this.queue.length || this.running >= this.maxConcurrent) return;
    const now = this.now(); this.#prune(now);
    let due = Math.max(now, this.nextStartAt, this.blockedUntil, this.headerPaceUntil);
    if (this.starts.length >= this.limit) due = Math.max(due, this.starts[this.starts.length - this.limit] + MINUTE);
    const burst = this.starts.filter(time => time > now - 1000);
    if (burst.length >= this.burstLimit) due = Math.max(due, burst[burst.length - this.burstLimit] + 1000);
    if (due > now) {
      this.wake = this.setTimeout(() => { this.wake = null; this.#pump(); }, Math.min(MAX_TIMER, due - now));
      this.wake?.unref?.(); return;
    }
    const job = this.queue.shift();
    if (!job.waiters.size) { this.#release(job); this.#pump(); return; }
    job.started = true; job.controller = new AbortController(); this.running++;
    this.starts.push(now); this.nextStartAt = now + this.spacing;
    void this.#run(job);
    this.#pump();
  }

  #observe(response) {
    const now = this.now(), headers = response.headers;
    const limit = headerNumber(headers, "x-ratelimit-limit");
    if (limit !== null && limit >= 1) this.limit = Math.min(this.limit, Math.floor(limit));
    const remaining = headerNumber(headers, "x-ratelimit-remaining");
    const reset = headerNumber(headers, "x-ratelimit-reset");
    // Public API defines Reset as seconds remaining, not an epoch timestamp.
    if (remaining !== null && reset !== null && reset <= 86400) {
      if (remaining === 0) this.blockedUntil = Math.max(this.blockedUntil, now + reset * 1000);
      // Reset describes FULL refill, not the next available token. Pacing every
      // healthy response by Reset/Remaining turned 19 remaining /55s into a
      // three-second delay per tool, stranding ordinary multi-panel loads.
      // The provider documents proactive pacing only for low headroom (<10).
      else if (remaining < 10) this.headerPaceUntil = Math.max(this.headerPaceUntil, now + reset * 1000 / remaining);
    }
    if (response.status === 429) this.blockedUntil = Math.max(this.blockedUntil, quantDataRetryUntil(headers, now));
    this.#pump();
  }

  async #run(job) {
    let response, reader, onAbort;
    try {
      const cancellation = new Promise((_, reject) => {
        onAbort = () => { void reader?.cancel().catch(() => {}); reject(aborted()); };
        job.controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      const timeout = new Promise((_, reject) => {
        job.timeout = this.setTimeout(() => {
          reject(failure("The provider request timed out.", "request_timeout", 504)); job.controller.abort();
        }, this.timeoutMs);
        job.timeout?.unref?.();
      });
      const work = async () => {
        response = await this.fetchImpl(`${ORIGIN}${job.path}`, { method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
          body: job.body, signal: job.controller.signal });
        if (job.controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw aborted(); }
        // Headers can arrive before a slow response body: stop other keys now.
        this.#observe(response);
        const length = headerNumber(response.headers, "content-length");
        if (length !== null && length > this.maxResponseBytes) throw failure("The provider response is too large.", "response_too_large", 502);
        const chunks = []; let bytes = 0;
        if (response.body) {
          reader = response.body.getReader();
          try {
            while (true) {
              const item = await reader.read(); if (item.done) break;
              bytes += item.value.byteLength;
              if (bytes > this.maxResponseBytes) { await reader.cancel().catch(() => {}); throw failure("The provider response is too large.", "response_too_large", 502); }
              chunks.push(Buffer.from(item.value));
            }
          } finally { reader.releaseLock(); reader = null; }
        }
        return { status: response.status, headers: [...response.headers.entries()], body: Buffer.concat(chunks, bytes), fetchedAt: this.now() };
      };
      const result = await Promise.race([work(), timeout, cancellation]);
      this.#settle(job, null, result);
    } catch (error) {
      job.controller.abort();
      void response?.body?.cancel().catch(() => {});
      this.#settle(job, error);
    } finally {
      if (job.timeout !== null) this.clearTimeout(job.timeout);
      job.controller.signal.removeEventListener("abort", onAbort);
      job.timeout = null; this.running--; this.#release(job); this.#pump();
    }
  }

  #release(job) {
    if (this.jobs.get(job.key) !== job) return;
    this.jobs.delete(job.key); this.bytes -= job.bytes;
  }

  #settle(job, error, result) {
    if (job.settled) return;
    job.settled = true;
    for (const waiter of job.waiters) {
      this.waiters--; waiter.signal?.removeEventListener("abort", waiter.abort);
      if (error) waiter.reject(error); else waiter.resolve(result);
    }
    job.waiters.clear(); this.#release(job);
  }
}
