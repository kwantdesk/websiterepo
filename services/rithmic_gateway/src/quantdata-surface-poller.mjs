/**
 * Pulls every options surface on a schedule so the archive does not depend on
 * anyone having the page open.
 *
 * The exposure archiver captures whole payloads on the vendor boundary, which
 * is the right place - but it only ever sees what the PRODUCT requests. So the
 * archive is a record of what was looked at, not of what the market did:
 * measured on disk, 4.0 GB on a day the desk was in use against 4.6 MB on a
 * day GEX was broken. A surface nobody opened that session is simply gone, and
 * QuantData sells no history for it.
 *
 * Requests go out through the gateway's own vendor edge over loopback rather
 * than straight to the provider. That is deliberate: the edge already holds
 * the credential, the response cache, the in-flight coalescing and the
 * exposure archiver, so polling this way archives the payload and shares a
 * cache hit with a pane asking for the same thing. Calling the provider
 * directly - which three other modules in this service still do - bypasses all
 * four.
 *
 * The quota is the constraint that shapes everything else. It is 240 requests
 * a minute for the whole account, shared with the desk's own panes, and
 * exhausting it is not a degraded surface but a dead one: every GEX page
 * answers 429 at once. So this poller has a hard budget it will not exceed, it
 * spaces its requests, it slows down outside the options session, and it
 * yields the budget it is not using rather than reserving it.
 */

const SESSION_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour12: false,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** US options hours, which is when these surfaces actually move. */
export function optionsSessionOpen(nowMs = Date.now()) {
  const parts = Object.fromEntries(
    SESSION_CLOCK.formatToParts(new Date(nowMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  const minutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  // 09:30 to 16:15 New York, with a little either side so the open and the
  // settlement print are both captured.
  return minutes >= 9 * 60 + 20 && minutes <= 16 * 60 + 20;
}

/**
 * What to pull, and how often.
 *
 * Cadence is per surface because they do not move alike: exposure repriced
 * every minute is the whole point of the archive, while a term structure or an
 * IV rank changing three times a day does not justify the quota. `everyMs` is
 * the session cadence; outside the session everything falls back to `idleMs`.
 */
export const DEFAULT_SURFACES = [
  { path: "/v1/options/tool/exposure-by-strike", everyMs: 60_000, greekMode: "GAMMA" },
  { path: "/v1/options/tool/exposure-by-strike", everyMs: 60_000, greekMode: "DELTA" },
  { path: "/v1/options/tool/exposure-by-strike", everyMs: 300_000, greekMode: "VANNA" },
  { path: "/v1/options/tool/exposure-by-strike", everyMs: 300_000, greekMode: "CHARM" },
  { path: "/v1/options/tool/interval-map", everyMs: 60_000 },
  { path: "/v1/options/tool/open-interest-by-strike", everyMs: 900_000 },
  { path: "/v1/options/tool/max-pain", everyMs: 300_000 },
  { path: "/v1/options/tool/net-drift", everyMs: 300_000 },
  { path: "/v1/options/tool/volatility-skew", everyMs: 900_000 },
  { path: "/v1/options/tool/term-structure", everyMs: 900_000 },
  { path: "/v1/options/tool/iv-rank", everyMs: 900_000 },
  { path: "/v1/options/tool/contract-statistics", everyMs: 300_000 },
];

export const DEFAULT_TICKERS = ["SPX", "SPY", "QQQ", "NDX", "IWM"];

/** New York session date, which is what the provider keys its surfaces on. */
export function sessionDateFor(nowMs = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(nowMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function requestBodyFor(surface, ticker, nowMs = Date.now()) {
  const sessionDate = sessionDateFor(nowMs);
  const body = { sessionDate, filter: { ticker } };
  if (surface.greekMode) {
    body.greekMode = surface.greekMode;
    body.representationMode = "PER_ONE_PERCENT_MOVE";
  }
  return body;
}

/** A stable identity for one (surface, ticker) job. */
export const jobKey = (surface, ticker) =>
  `${surface.path}|${surface.greekMode ?? ""}|${ticker}`;

/**
 * The jobs due at this moment, oldest-overdue first.
 *
 * Pure so the schedule can be tested without a clock or a network: given what
 * ran when, it says what should run now and never more than the budget allows.
 */
export function dueJobs({
  surfaces = DEFAULT_SURFACES,
  tickers = DEFAULT_TICKERS,
  lastRunAt = new Map(),
  nowMs = Date.now(),
  budget = Infinity,
  sessionOpen = optionsSessionOpen(nowMs),
  idleMs = 900_000,
} = {}) {
  const due = [];
  for (const surface of surfaces) {
    // Outside the session nothing is repriced quickly, so a fast cadence would
    // spend quota to archive the same bytes the dedupe would then discard.
    const interval = sessionOpen ? surface.everyMs : Math.max(surface.everyMs, idleMs);
    for (const ticker of tickers) {
      const key = jobKey(surface, ticker);
      const last = lastRunAt.get(key);
      const overdueBy = last === undefined ? Infinity : nowMs - last - interval;
      if (overdueBy >= 0) due.push({ surface, ticker, key, overdueBy });
    }
  }
  /*
   * Most overdue first, so a surface that has been starved by the budget is
   * the next one taken rather than being passed over every cycle by a fast
   * surface that has only just come due.
   */
  due.sort((left, right) => right.overdueBy - left.overdueBy);
  return Number.isFinite(budget) ? due.slice(0, Math.max(0, budget)) : due;
}

export class QuantDataSurfacePoller {
  constructor(options = {}) {
    this.origin = options.origin || "http://127.0.0.1:8793";
    this.token = options.token || "";
    this.enabled = options.enabled !== false && Boolean(this.token);
    this.surfaces = options.surfaces || DEFAULT_SURFACES;
    this.tickers = options.tickers || DEFAULT_TICKERS;
    /*
     * A hard ceiling on requests per minute, well under the account's 240 so
     * the desk's own panes always have room. Exhausting the quota does not
     * degrade a surface, it kills every GEX page at once.
     */
    this.budgetPerMinute = Number.isFinite(options.budgetPerMinute) ? options.budgetPerMinute : 45;
    this.spacingMs = Number.isFinite(options.spacingMs) ? options.spacingMs : 400;
    this.tickMs = Number.isFinite(options.tickMs) ? options.tickMs : 15_000;
    this.idleMs = Number.isFinite(options.idleMs) ? options.idleMs : 900_000;
    this.fetch = options.fetchImpl || fetch;
    this.log = options.log || (() => {});

    this.lastRunAt = new Map();
    this.timer = null;
    this.inFlight = false;
    this.stats = { requests: 0, ok: 0, rateLimited: 0, failed: 0, lastAt: null, lastError: null };
  }

  status() {
    return {
      enabled: this.enabled,
      budgetPerMinute: this.budgetPerMinute,
      sessionOpen: optionsSessionOpen(),
      tracked: this.lastRunAt.size,
      ...this.stats,
    };
  }

  start() {
    if (!this.enabled || this.timer) return;
    this.log(`[qd-surfaces] polling ${this.surfaces.length} surfaces x ${this.tickers.length} tickers, `
      + `budget ${this.budgetPerMinute}/min`);
    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        this.stats.lastError = error instanceof Error ? error.message : String(error);
      });
    }, this.tickMs);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(nowMs = Date.now()) {
    if (!this.enabled || this.inFlight) return 0;
    this.inFlight = true;
    try {
      // The budget is per minute; a tick may only spend its own share of it.
      const share = Math.max(1, Math.round((this.budgetPerMinute * this.tickMs) / 60_000));
      const jobs = dueJobs({
        surfaces: this.surfaces,
        tickers: this.tickers,
        lastRunAt: this.lastRunAt,
        nowMs,
        budget: share,
        idleMs: this.idleMs,
      });
      let spent = 0;
      for (const job of jobs) {
        /*
         * Marked BEFORE the request, against the TICK's clock rather than the
         * wall clock, so a surface that fails waits its turn like any other
         * instead of being retried on the next tick - and so the schedule is
         * testable without sleeping through real intervals.
         */
        this.lastRunAt.set(job.key, nowMs);
        const refused = await this.#pull(job, nowMs);
        spent += 1;
        // A rate limit stops the whole tick. Continuing through the remaining
        // jobs is what turns one refusal into a spent quota.
        if (refused) break;
        if (this.spacingMs > 0) await new Promise((resolve) => setTimeout(resolve, this.spacingMs));
      }
      return spent;
    } finally {
      this.inFlight = false;
    }
  }

  async #pull(job, nowMs = Date.now()) {
    const url = `${this.origin}/v1/vendors/quantdata${job.surface.path}`;
    this.stats.requests += 1;
    this.stats.lastAt = new Date().toISOString();
    try {
      const response = await this.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(requestBodyFor(job.surface, job.ticker)),
      });
      // The body has to be consumed for the edge to archive it and for the
      // socket to be released.
      await response.text();
      if (response.status === 429) {
        this.stats.rateLimited += 1;
        /*
         * Back every job off rather than only this one. A 429 is an account
         * level signal: continuing to ask for the other surfaces would spend
         * the quota the desk's own panes are waiting on.
         */
        const holdUntil = nowMs + 60_000;
        for (const key of this.lastRunAt.keys()) this.lastRunAt.set(key, holdUntil);
        // Surfaces never polled yet have no entry, so give them one too.
        for (const surface of this.surfaces) {
          for (const ticker of this.tickers) this.lastRunAt.set(jobKey(surface, ticker), holdUntil);
        }
        this.log("[qd-surfaces] rate limited; holding all surfaces for 60s");
        return true;
      }
      if (response.ok) this.stats.ok += 1;
      else {
        this.stats.failed += 1;
        this.stats.lastError = `${job.surface.path} ${job.ticker}: HTTP ${response.status}`;
      }
    } catch (error) {
      this.stats.failed += 1;
      this.stats.lastError = error instanceof Error ? error.message : String(error);
    }
    return false;
  }
}
