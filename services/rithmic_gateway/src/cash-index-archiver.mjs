import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

// Permanent daily archive of REAL cash-index session OHLC (SPX, SPY, QQQ...).
//
// The market-data plan serves a completed session's true minute bars but not
// the current session's, and nothing guarantees how long the provider keeps
// history. The desk's replays must never depend on that: minutes after each
// cash close this archiver pulls the finished session's minute bars and
// writes them to the collector's own disk, next to the Rithmic archive —
// every day, retried until complete, backfilled on startup. ~390 bars per
// ticker per day is a few hundred kilobytes; retention is effectively free.

const QUANTDATA_ORIGIN = "https://api.quantdata.us";
const DEFAULT_TICKERS = ["SPX", "SPY", "QQQ", "NDX", "IWM"];
const DIR_NAME = "cash-index";
const CHECK_INTERVAL_MS = 10 * 60_000;
// A full regular session is 390 one-minute bars. Below this the provider is
// still assembling the session (or it was a half day) — keep retrying.
const COMPLETE_BAR_THRESHOLD = 350;
const MAX_ATTEMPTS_PER_DATE = 14;
const BACKFILL_SESSIONS = 10;
const REQUEST_SPACING_MS = 1_500;

const NY_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

function newYorkNow(nowMs = Date.now()) {
  const parts = Object.fromEntries(
    NY_PARTS.formatToParts(new Date(nowMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
    weekday: parts.weekday,
  };
}

function isWeekend(weekday) {
  return weekday === "Sat" || weekday === "Sun";
}

function shiftDateKey(dateKey, days) {
  const value = new Date(`${dateKey}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekdayOf(dateKey) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" })
    .format(new Date(`${dateKey}T12:00:00Z`));
}

// Session dates whose archives should exist, newest first, excluding weekends.
function recentSessionDates(latestCompleteDate, count) {
  const dates = [];
  let cursor = latestCompleteDate;
  while (dates.length < count) {
    if (!isWeekend(weekdayOf(cursor))) dates.push(cursor);
    cursor = shiftDateKey(cursor, -1);
  }
  return dates;
}

function parseSessionCandles(payload) {
  if (!payload || typeof payload !== "object" || !payload.data || typeof payload.data !== "object") return [];
  const candles = [];
  for (const [timestamp, raw] of Object.entries(payload.data)) {
    if (!raw || typeof raw !== "object") continue;
    const time = Number.isFinite(Number(timestamp)) && Number(timestamp) > 10_000_000_000
      ? Number(timestamp)
      : Date.parse(timestamp);
    const open = Number(raw.openPrice ?? raw.open ?? raw.o);
    const high = Number(raw.highPrice ?? raw.high ?? raw.h);
    const low = Number(raw.lowPrice ?? raw.low ?? raw.l);
    const close = Number(raw.closePrice ?? raw.close ?? raw.c);
    if (!Number.isFinite(time) || !Number.isFinite(open) || !Number.isFinite(high)
      || !Number.isFinite(low) || !Number.isFinite(close)) continue;
    candles.push({
      timestamp: time,
      open,
      high,
      low,
      close,
      volume: Number(raw.volume ?? raw.totalVolume ?? raw.v) || 0,
    });
  }
  return candles.sort((left, right) => left.timestamp - right.timestamp);
}

export class CashIndexArchiver {
  constructor({ dir, apiKey, tickers, fetchImpl, archiveResponse = null, log = () => {}, now = () => Date.now() }) {
    this.dir = dir ? join(dir, DIR_NAME) : null;
    this.apiKey = apiKey || null;
    this.tickers = (tickers && tickers.length ? tickers : DEFAULT_TICKERS)
      .map((ticker) => String(ticker).trim().toUpperCase())
      .filter(Boolean);
    this.fetchImpl = fetchImpl || fetch;
    this.archiveResponse = typeof archiveResponse === "function" ? archiveResponse : null;
    this.log = log;
    this.now = now;
    this.timer = null;
    this.running = false;
    this.attempts = new Map();
    this.lastError = null;
    this.lastRunAt = null;
    this.archivedToday = new Set();
  }

  get enabled() {
    return Boolean(this.dir && this.apiKey);
  }

  status() {
    return {
      enabled: this.enabled,
      tickers: this.tickers,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
    };
  }

  start() {
    if (!this.enabled || this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce().catch((error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
      });
    }, CHECK_INTERVAL_MS);
    if (typeof this.timer.unref === "function") this.timer.unref();
    // Startup pass covers the backfill window immediately.
    void this.runOnce().catch((error) => {
      this.lastError = error instanceof Error ? error.message : String(error);
    });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  #paths(ticker, sessionDate) {
    const dayDir = join(this.dir, sessionDate);
    return {
      dayDir,
      file: join(dayDir, `${ticker}.json`),
    };
  }

  async readSession(ticker, sessionDate) {
    if (!this.dir) return null;
    const { file } = this.#paths(String(ticker).toUpperCase(), sessionDate);
    try {
      const raw = JSON.parse(await readFile(file, "utf8"));
      return raw && Array.isArray(raw.candles) ? raw : null;
    } catch {
      return null;
    }
  }

  // The most recent session whose regular hours have completed: today after
  // 16:10 New York on a weekday, otherwise walk back to the prior weekday.
  latestCompletedSessionDate(nowMs = this.now()) {
    const ny = newYorkNow(nowMs);
    let candidate = ny.date;
    if (isWeekend(ny.weekday) || ny.minutes < 16 * 60 + 10) {
      candidate = shiftDateKey(candidate, -1);
      while (isWeekend(weekdayOf(candidate))) candidate = shiftDateKey(candidate, -1);
    }
    return candidate;
  }

  async runOnce() {
    if (!this.enabled || this.running) return;
    this.running = true;
    this.lastRunAt = new Date(this.now()).toISOString();
    try {
      const dates = recentSessionDates(this.latestCompletedSessionDate(), BACKFILL_SESSIONS);
      for (const sessionDate of dates) {
        for (const ticker of this.tickers) {
          await this.#archiveSession(ticker, sessionDate);
        }
      }
    } finally {
      this.running = false;
    }
  }

  async #archiveSession(ticker, sessionDate) {
    const key = `${ticker}:${sessionDate}`;
    const existing = await this.readSession(ticker, sessionDate);
    if (existing?.complete) return;
    const attempts = this.attempts.get(key) ?? 0;
    if (attempts >= MAX_ATTEMPTS_PER_DATE) return;
    this.attempts.set(key, attempts + 1);
    try {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS));
      const response = await this.fetchImpl(`${QUANTDATA_ORIGIN}/v1/equities/tool/stock-price-over-time`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sessionDate,
          aggregationPeriod: "1m",
          filter: { ticker },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`provider answered ${response.status}`);
      }
      const payload = await response.json();
      this.archiveResponse?.({
        path: "/v1/equities/tool/stock-price-over-time",
        requestBody: Buffer.from(JSON.stringify({
          sessionDate,
          aggregationPeriod: "1m",
          filter: { ticker },
        })),
        payload: Buffer.from(JSON.stringify(payload)),
      });
      const candles = parseSessionCandles(payload);
      if (!candles.length) {
        // A holiday or unpublished session. Counted attempts stop the retries
        // eventually; nothing is written because nothing exists.
        this.log(`[cash-index] ${key}: provider returned no bars (attempt ${attempts + 1})`);
        return;
      }
      // Never regress a stored session: only replace when the new pull holds
      // at least as many bars as what is already on disk.
      if (existing && existing.candles.length > candles.length) return;
      const complete = candles.length >= COMPLETE_BAR_THRESHOLD;
      const { dayDir, file } = this.#paths(ticker, sessionDate);
      mkdirSync(dayDir, { recursive: true });
      const record = {
        schema: 1,
        ticker,
        sessionDate,
        aggregationPeriod: "1m",
        provider: "KwantData",
        archivedAt: new Date(this.now()).toISOString(),
        bars: candles.length,
        complete,
        candles,
      };
      await writeFile(`${file}.partial`, JSON.stringify(record), "utf8");
      await rename(`${file}.partial`, file);
      if (complete) this.attempts.delete(key);
      this.log(`[cash-index] archived ${key}: ${candles.length} bars${complete ? "" : " (partial, will retry)"}`);
    } catch (error) {
      this.lastError = `${key}: ${error instanceof Error ? error.message : String(error)}`;
      this.log(`[cash-index] ${key} failed: ${this.lastError}`);
    }
  }
}
