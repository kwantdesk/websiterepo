import test from "node:test";
import assert from "node:assert/strict";

import {
  QuantDataSurfacePoller,
  DEFAULT_SURFACES,
  DEFAULT_TICKERS,
  dueJobs,
  jobKey,
  optionsSessionOpen,
  requestBodyFor,
  sessionDateFor,
} from "../src/quantdata-surface-poller.mjs";

/**
 * The options archive stops depending on someone having the page open.
 *
 * The exposure archiver captures whole payloads at the vendor boundary, but it
 * only ever sees what the product requests - so the archive recorded what was
 * looked at rather than what the market did. Measured on disk: 4.0 GB on a day
 * the desk was in use against 4.6 MB on a day GEX was broken, and QuantData
 * sells no history to fill that back in.
 *
 * The constraint is the quota: 240 requests a minute for the whole account,
 * shared with the desk's own panes. Exhausting it does not degrade a surface,
 * it kills every GEX page at once - which is exactly what happened the day
 * this was written.
 */

const SESSION = Date.parse("2026-09-02T15:00:00Z"); // 11:00 New York, Wednesday
const OVERNIGHT = Date.parse("2026-09-02T04:00:00Z"); // midnight New York

let passed = 0;

test("it recognises the options session that must be protected", () => {
  assert.equal(optionsSessionOpen(SESSION), true);
  assert.equal(optionsSessionOpen(OVERNIGHT), false);
  // Weekends move nothing.
  // Options do not trade at the weekend; both days must be closed.
  assert.equal(optionsSessionOpen(Date.parse("2026-09-05T15:00:00Z")), false, "Saturday must be closed");
  assert.equal(optionsSessionOpen(Date.parse("2026-09-06T15:00:00Z")), false, "Sunday must be closed");
});

test("every surface is due on the first pass", () => {
  const due = dueJobs({ lastRunAt: new Map(), nowMs: SESSION, sessionOpen: true });
  assert.equal(due.length, DEFAULT_SURFACES.length * DEFAULT_TICKERS.length);
});

test("the budget is a hard ceiling", () => {
  /*
   * The whole point. Spending more than this takes quota the desk's own panes
   * are waiting on, and a 429 is not a degraded surface but a dead GEX page.
   */
  const due = dueJobs({ lastRunAt: new Map(), nowMs: SESSION, budget: 7, sessionOpen: true });
  assert.equal(due.length, 7);
});

test("the most overdue surface is taken first", () => {
  /*
   * Without this a fast surface that has only just come due is always picked
   * ahead of one the budget has been starving, and the starved one never runs.
   */
  const lastRunAt = new Map();
  const surfaces = DEFAULT_SURFACES.slice(0, 3);
  for (const surface of surfaces) {
    for (const ticker of DEFAULT_TICKERS) lastRunAt.set(jobKey(surface, ticker), SESSION - 60_000);
  }
  const starved = jobKey(surfaces[2], "IWM");
  lastRunAt.set(starved, SESSION - 3_600_000);
  const due = dueJobs({ surfaces, tickers: DEFAULT_TICKERS, lastRunAt, nowMs: SESSION, budget: 1, sessionOpen: true });
  assert.equal(due[0].key, starved, "the starved surface was passed over again");
});

test("a surface just polled is not polled again", () => {
  const surfaces = [DEFAULT_SURFACES[0]];
  const lastRunAt = new Map([[jobKey(surfaces[0], "SPX"), SESSION - 10_000]]);
  const due = dueJobs({ surfaces, tickers: ["SPX"], lastRunAt, nowMs: SESSION, sessionOpen: true });
  assert.equal(due.length, 0);
  // ...and is once its interval has passed.
  const later = dueJobs({ surfaces, tickers: ["SPX"], lastRunAt, nowMs: SESSION + 61_000, sessionOpen: true });
  assert.equal(later.length, 1);
});

test("overnight cadence collapses to the idle interval", () => {
  /*
   * Nothing is repriced quickly out of session, so a fast cadence would spend
   * quota to archive bytes the dedupe then discards.
   */
  const surfaces = [DEFAULT_SURFACES[0]];
  const lastRunAt = new Map([[jobKey(surfaces[0], "SPX"), OVERNIGHT - 120_000]]);
  const due = dueJobs({
    surfaces, tickers: ["SPX"], lastRunAt, nowMs: OVERNIGHT, sessionOpen: false, idleMs: 900_000,
  });
  assert.equal(due.length, 0, "a two-minute-old surface was re-polled overnight");
});

test("the request carries the session date and greek the provider expects", () => {
  const body = requestBodyFor(DEFAULT_SURFACES[0], "SPX", SESSION);
  assert.equal(body.filter.ticker, "SPX");
  assert.equal(body.sessionDate, sessionDateFor(SESSION));
  assert.equal(body.greekMode, "GAMMA");
  assert.equal(body.representationMode, "PER_ONE_PERCENT_MOVE");
  /*
   * Each surface builds its own body because they genuinely differ - a generic
   * one had ten of forty-four live requests refused with HTTP 400. iv-rank in
   * particular takes NO session date and refuses the request without a
   * look-back and a maturity.
   */
  const ivRank = DEFAULT_SURFACES.find((surface) => surface.id === "iv-rank");
  const ivBody = requestBodyFor(ivRank, "SPY", SESSION);
  assert.equal(ivBody.sessionDate, undefined, "iv-rank does not accept a session date");
  assert.equal(ivBody.lookBackPeriod, 252);
  assert.equal(ivBody.maturity, 30);
  assert.equal(ivBody.filter.ticker, "SPY");

  // interval-map is refused without both an aggregation period and a greek.
  const interval = DEFAULT_SURFACES.find((surface) => surface.id === "interval-gex");
  const intervalBody = requestBodyFor(interval, "QQQ", SESSION);
  assert.equal(intervalBody.aggregationPeriod, "1m");
  assert.equal(intervalBody.greekMode, "GAMMA");

  // max-pain is refused without an expiration date.
  const maxPain = DEFAULT_SURFACES.find((surface) => surface.id === "max-pain");
  assert.equal(requestBodyFor(maxPain, "SPX", SESSION).filter.expirationDate, sessionDateFor(SESSION));

  // term-structure wants a RANGE, not a date.
  const term = DEFAULT_SURFACES.find((surface) => surface.id === "term-structure");
  const termBody = requestBodyFor(term, "SPX", SESSION);
  assert.ok(termBody.filter.expirationDateRange?.startDate);
  assert.ok(termBody.filter.expirationDateRange?.endDate > termBody.filter.expirationDateRange?.startDate);

  // Every surface must be buildable; one without a builder throws at runtime.
  for (const surface of DEFAULT_SURFACES) {
    assert.equal(typeof surface.build, "function", `${surface.id} has no body builder`);
    assert.ok(surface.id, "a surface has no id");
    assert.ok(requestBodyFor(surface, "SPX", SESSION).filter.ticker === "SPX", `${surface.id} lost its ticker`);
  }
});

test("it goes through the vendor edge, never straight to the provider", async () => {
  /*
   * The edge holds the credential, the response cache, the in-flight
   * coalescing and the exposure archiver. Calling the provider directly - as
   * three other modules in this service still do - bypasses all four, so the
   * payload would not be archived at all.
   */
  const seen = [];
  const poller = new QuantDataSurfacePoller({
    origin: "http://127.0.0.1:8793",
    token: "test-token",
    surfaces: [DEFAULT_SURFACES[0]],
    tickers: ["SPX"],
    spacingMs: 0,
    fetchImpl: async (url, init) => {
      seen.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
      return { ok: true, status: 200, text: async () => "{}" };
    },
  });
  await poller.tick(OVERNIGHT);
  assert.equal(seen.length, 1);
  assert.match(seen[0].url, /^http:\/\/127\.0\.0\.1:8793\/v1\/vendors\/quantdata\//);
  assert.ok(!/api\.quantdata\.us/.test(seen[0].url), "it called the provider directly");
  assert.equal(seen[0].auth, "Bearer test-token");
  assert.equal(seen[0].body.filter.ticker, "SPX");
});

test("a 429 holds every surface, not just the one refused", async () => {
  /*
   * A rate limit is an account-level signal. Continuing to ask for the other
   * surfaces spends the quota the desk's own panes are waiting on, which is
   * how a slow GEX page becomes a dead one.
   */
  let calls = 0;
  const poller = new QuantDataSurfacePoller({
    token: "test-token",
    surfaces: DEFAULT_SURFACES.slice(0, 3),
    tickers: DEFAULT_TICKERS,
    spacingMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 429, text: async () => "rate limited" };
    },
  });
  await poller.tick(OVERNIGHT);
  const afterFirst = calls;
  assert.equal(afterFirst, 1, "it kept asking after being refused");
  // Nothing is due again until the hold expires.
  await poller.tick(OVERNIGHT + 30_000);
  assert.equal(calls, afterFirst, "it polled again during the hold");
  assert.equal(poller.status().rateLimited, 1);
});

test("a failure does not become a retry storm", async () => {
  // A surface that errors waits its turn like any other.
  let calls = 0;
  const poller = new QuantDataSurfacePoller({
    token: "test-token",
    surfaces: [DEFAULT_SURFACES.find((surface) => surface.id === "max-pain")],
    tickers: ["SPX"],
    spacingMs: 0,
    fetchImpl: async () => { calls += 1; throw new Error("connection reset"); },
  });
  await poller.tick(OVERNIGHT);
  await poller.tick(OVERNIGHT + 1_000);
  await poller.tick(OVERNIGHT + 2_000);
  assert.equal(calls, 1, "a failing surface was retried on every tick");
  assert.equal(poller.status().failed, 1);
});

test("it stays well inside the account quota", () => {
  /*
   * 240 a minute is the whole account, shared with the desk. A poller that
   * could consume most of it would be trading the live product for the
   * archive.
   */
  const poller = new QuantDataSurfacePoller({ token: "t" });
  assert.ok(poller.budgetPerMinute <= 60, `budget ${poller.budgetPerMinute} is too close to the 240 limit`);
  assert.ok(poller.spacingMs > 0, "requests are not spaced");
});

test("an explicit enable flag still cannot spend live-session quota", async () => {
  let calls = 0;
  const poller = new QuantDataSurfacePoller({
    token: "test-token",
    surfaces: [DEFAULT_SURFACES[0]],
    tickers: ["SPX"],
    spacingMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, text: async () => "{}" };
    },
  });
  assert.equal(await poller.tick(SESSION), 0);
  assert.equal(calls, 0, "the archive stole quota from the live GEX desk");
});

test("it does nothing without a token", async () => {
  let calls = 0;
  const poller = new QuantDataSurfacePoller({ token: "", fetchImpl: async () => { calls += 1; } });
  assert.equal(poller.status().enabled, false);
  await poller.tick(SESSION);
  assert.equal(calls, 0);
});

console.log(`quantdata surface poller: ${passed} inline checks`);
