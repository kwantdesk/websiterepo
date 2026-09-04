import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { chicagoTradingDate, cmeSessionBounds } from "./trading-session.mjs";
import { resolveInstrument, toEpochMs } from "./recorder.mjs";

/**
 * Permanent minute-bar archive of REAL Rithmic futures trades.
 *
 * The desk already recorded every print - tens of millions a day - but nothing
 * ever turned them into bars, so chart history was served by a vendor instead.
 * When that vendor's licence lapsed to a delayed window, charts fell back to
 * whatever the live stream had accumulated since the pane opened: a few hours.
 * The tape to rebuild those sessions was sitting on the collector's own disk
 * the whole time.
 *
 * Reading it per request is not an option - one session of raw L3 is gigabytes
 * and a single archive scan measured 119 seconds. Bars have to be accumulated
 * as the prints arrive and written down, which is what this does. It is the
 * futures counterpart of the cash-index archiver, and deliberately the same
 * shape: aggregate continuously, persist per trading date, reload on boot.
 *
 * A day of one-minute bars for one instrument is ~1,400 rows. Ten instruments
 * for a year is a few hundred megabytes. Retention is effectively free, and
 * from here the desk's history belongs to the desk rather than to a
 * subscription.
 */

/**
 * A history request that failed for a reason worth telling the caller, with
 * the status it should answer. It lived in the vendor history module; that
 * module is gone from this path, and the error is a property of the route
 * rather than of any provider.
 */
export class HistoryRequestError extends Error {
  constructor(message, status = 400, code = "history_request_invalid") {
    super(message);
    this.name = "HistoryRequestError";
    this.status = status;
    this.code = code;
  }
}

const DIR_NAME = "bars";
const BAR_MS = 60_000;
const DEFAULT_FLUSH_MS = 15_000;
// A trading date's file is rewritten whole on each flush, so only the dates
// still being written are worth holding open. Two covers the session roll.
const MAX_OPEN_TRADING_DATES = 2;
const MAX_SERVED_BARS = 200_000;

/**
 * Rows are stored positionally rather than as objects. It is the difference
 * between ~40 bytes and ~140 bytes a bar across every instrument and every
 * session, for a file nothing reads by hand.
 */
const encodeBar = (bar) => [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v];
const decodeBar = (row) => (Array.isArray(row)
  ? { t: row[0], o: row[1], h: row[2], l: row[3], c: row[4], v: row[5] }
  // Accept the object form too, so a file written by a future version - or
  // hand-repaired - still loads rather than being silently dropped.
  : { t: row.t ?? row.timestamp, o: row.o ?? row.open, h: row.h ?? row.high, l: row.l ?? row.low, c: row.c ?? row.close, v: row.v ?? row.volume });

function instrumentFileName(exchange, symbol) {
  return `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.json`;
}

function contractRoot(symbol) {
  return String(symbol || "").toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/u, "");
}

/**
 * The exchange's own timestamp, not our arrival time.
 *
 * A bar built from receivedAt drifts with our scheduling and would not line up
 * with anybody else's chart. Rithmic sends seconds-since-epoch plus
 * microseconds; only fall back to arrival when it sends neither.
 */
export function tradeTimestampMs(payload, receivedAt) {
  const seconds = Number(payload?.ssboe ?? payload?.sourceSsboe);
  const micros = Number(payload?.usecs ?? payload?.sourceUsecs ?? 0);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1_000 + (Number.isFinite(micros) ? Math.floor(micros / 1_000) : 0);
  }
  const parsed = Date.parse(receivedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** A print, or one of the many other messages on the same stream. */
export function tradeFromRecord(record) {
  const payload = record?.payload || record;
  if (!payload) return null;
  const price = Number(payload.tradePrice);
  const size = Number(payload.tradeSize);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(size) || size <= 0) return null;
  const timestamp = tradeTimestampMs(payload, record?.receivedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return { price, size, timestamp };
}

export function parseIntervalMs(interval) {
  const match = String(interval || "1m").trim().match(/^(\d+)\s*(s|m|h|d|D|W|M)$/);
  if (!match) return BAR_MS;
  const value = Math.max(1, Number(match[1]));
  const rawUnit = match[2];
  if (rawUnit === "M") return value * 30 * 86_400_000;
  const unit = rawUnit.toLowerCase();
  const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 7 * 86_400_000 };
  return value * (units[unit] ?? 60_000);
}

/**
 * Roll stored minutes up to the requested interval.
 *
 * Anything below a minute cannot be produced from minute bars, and returning
 * the minutes relabelled would be inventing resolution we do not have - the
 * caller is told by getting the minutes back unchanged rather than a series
 * that claims to be seconds.
 */
export function resampleBars(bars, intervalMs, interval = "") {
  if (!Number.isFinite(intervalMs) || intervalMs <= BAR_MS) return bars;
  const buckets = new Map();
  for (const bar of bars) {
    const tradingDate = chicagoTradingDate(bar.t);
    let identity;
    let timestamp;
    if (/^\d+D$/.test(interval)) {
      identity = `D:${tradingDate}`;
      timestamp = cmeSessionBounds(tradingDate)?.startMs ?? bar.t;
    } else if (/^\d+W$/.test(interval)) {
      const date = new Date(`${tradingDate}T00:00:00Z`);
      const mondayOffset = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - mondayOffset);
      identity = `W:${date.toISOString().slice(0, 10)}`;
      timestamp = bar.t;
    } else if (/^\d+M$/.test(interval)) {
      identity = `M:${tradingDate.slice(0, 7)}`;
      timestamp = bar.t;
    } else {
      timestamp = Math.floor(bar.t / intervalMs) * intervalMs;
      identity = `T:${timestamp}`;
    }
    const existing = buckets.get(identity);
    if (!existing) {
      buckets.set(identity, { t: timestamp, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v });
      continue;
    }
    existing.h = Math.max(existing.h, bar.h);
    existing.l = Math.min(existing.l, bar.l);
    existing.c = bar.c;
    existing.v += bar.v;
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t);
}

/** Trading dates covering a window, oldest first. */
export function tradingDatesBetween(fromMs, toMs) {
  const dates = [];
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return dates;
  let cursor = chicagoTradingDate(fromMs);
  const last = chicagoTradingDate(toMs);
  // Bounded so a malformed range cannot spin: a decade of sessions is already
  // far more than any chart asks for.
  for (let guard = 0; guard < 4_000; guard += 1) {
    dates.push(cursor);
    if (cursor === last) break;
    const bounds = cmeSessionBounds(cursor);
    if (!bounds) break;
    const next = chicagoTradingDate(bounds.endMs + 60_000);
    if (next === cursor) break;
    cursor = next;
  }
  return dates;
}

export class FuturesBarArchive {
  constructor(options = {}) {
    this.dir = join(String(options.dir || "recordings"), DIR_NAME);
    this.enabled = options.enabled !== false;
    this.flushMs = Number.isFinite(Number(options.flushMs))
      ? Number(options.flushMs)
      : DEFAULT_FLUSH_MS;
    // tradingDate -> instrumentKey -> Map<bucketMs, bar>
    this.open = new Map();
    this.dirty = new Set();
    this.startedAt = null;
    this.lastError = null;
    this.lastFlushAt = null;
    this.aggregated = new Map();
    this.flushTimer = null;
    this.detach = () => {};
  }

  status() {
    return {
      enabled: this.enabled,
      dir: this.dir,
      startedAt: this.startedAt,
      lastFlushAt: this.lastFlushAt,
      openTradingDates: [...this.open.keys()],
      aggregated: Object.fromEntries(this.aggregated),
      lastError: this.lastError,
    };
  }

  dayDir(tradingDate) {
    return join(this.dir, tradingDate);
  }

  barsFor(tradingDate, exchange, symbol) {
    let day = this.open.get(tradingDate);
    if (!day) {
      day = new Map();
      this.open.set(tradingDate, day);
      // Oldest first: a rolled session is flushed before it is evicted.
      while (this.open.size > MAX_OPEN_TRADING_DATES) {
        const oldest = [...this.open.keys()].sort()[0];
        if (oldest === tradingDate) break;
        this.open.delete(oldest);
      }
    }
    const key = `${exchange}:${symbol}`;
    let bars = day.get(key);
    if (!bars) {
      bars = new Map();
      day.set(key, bars);
    }
    return bars;
  }

  record(record) {
    if (!this.enabled) return;
    const trade = tradeFromRecord(record);
    if (!trade) return;
    const { exchange, symbol } = resolveInstrument(record);
    if (exchange === "UNKNOWN" || symbol === "UNKNOWN") return;
    /*
     * Filed under the trading date of the PRINT. Using arrival time would put
     * the minutes either side of the 17:00 roll in the wrong session file, and
     * that is exactly the seam a chart shows most plainly.
     */
    const tradingDate = chicagoTradingDate(trade.timestamp);
    const bars = this.barsFor(tradingDate, exchange, symbol);
    const bucket = Math.floor(trade.timestamp / BAR_MS) * BAR_MS;
    const existing = bars.get(bucket);
    if (!existing) {
      bars.set(bucket, {
        t: bucket, o: trade.price, h: trade.price, l: trade.price, c: trade.price, v: trade.size,
      });
    } else {
      if (trade.price > existing.h) existing.h = trade.price;
      if (trade.price < existing.l) existing.l = trade.price;
      existing.c = trade.price;
      existing.v += trade.size;
    }
    this.dirty.add(`${tradingDate} ${exchange} ${symbol}`);
    const key = `${exchange}:${symbol}`;
    this.aggregated.set(key, (this.aggregated.get(key) ?? 0) + 1);
  }

  attach(client) {
    if (!this.enabled) return () => {};
    this.startedAt = new Date().toISOString();

    /*
     * The same two streams the recorder listens to, and the same rule: the
     * decoded wire message is preferred, and the book-store event is only used
     * by sources that do not emit one. Listening to both without this guard
     * would count every print twice and double every bar's volume.
     */
    let sawRawMessage = false;
    const onRawMessage = (record) => {
      sawRawMessage = true;
      this.record(record);
    };
    const onMarketData = (event) => {
      if (sawRawMessage) return;
      this.record(event);
    };
    client.on("rawMessage", onRawMessage);
    client.on("marketData", onMarketData);

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
      });
    }, this.flushMs);
    if (typeof this.flushTimer.unref === "function") this.flushTimer.unref();

    this.detach = () => {
      client.off?.("rawMessage", onRawMessage);
      client.off?.("marketData", onMarketData);
      if (this.flushTimer) clearInterval(this.flushTimer);
      this.flushTimer = null;
    };
    return this.detach;
  }

  /**
   * Merge the in-memory session into what is already on disk and rewrite it.
   *
   * A restart mid-session must not lose the bars built before it, and a
   * backfill written by the offline script must not be erased by the first
   * live flush after it - so the file is read, merged, and written whole
   * through a temporary name so a crash cannot leave a half-written session.
   */
  async flush() {
    if (!this.enabled || !this.dirty.size) return;
    const pending = [...this.dirty];
    this.dirty.clear();
    const byDate = new Map();
    for (const entry of pending) {
      const [tradingDate, exchange, symbol] = entry.split(" ");
      if (!byDate.has(tradingDate)) byDate.set(tradingDate, []);
      byDate.get(tradingDate).push({ exchange, symbol });
    }

    for (const [tradingDate, instruments] of byDate) {
      const dayDir = this.dayDir(tradingDate);
      try {
        if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        continue;
      }
      for (const { exchange, symbol } of instruments) {
        const live = this.open.get(tradingDate)?.get(`${exchange}:${symbol}`);
        if (!live || !live.size) continue;
        const file = join(dayDir, instrumentFileName(exchange, symbol));
        try {
          const merged = new Map();
          for (const bar of await this.readFile(file)) merged.set(bar.t, bar);
          // The live bar wins: it is the one still receiving prints.
          for (const bar of live.values()) merged.set(bar.t, bar);
          const rows = [...merged.values()].sort((a, b) => a.t - b.t).map(encodeBar);
          const temporary = `${file}.tmp`;
          await writeFile(temporary, JSON.stringify({ tradingDate, exchange, symbol, bars: rows }));
          await rename(temporary, file);
          this.lastFlushAt = new Date().toISOString();
        } catch (error) {
          this.lastError = error instanceof Error ? error.message : String(error);
          // Put it back so the next flush retries rather than losing the day.
          this.dirty.add(`${tradingDate} ${exchange} ${symbol}`);
        }
      }
    }
  }

  async readFile(file) {
    try {
      const text = await readFile(file, "utf8");
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : parsed?.bars;
      if (!Array.isArray(rows)) return [];
      return rows
        .map(decodeBar)
        .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.c));
    } catch {
      // Absent or unreadable is simply "no bars for that session".
      return [];
    }
  }

  /**
   * Reload the sessions still on disk so a restart does not begin the day
   * with an empty chart. Only the dates that can still be written to are
   * opened; everything older is served from disk on demand.
   */
  async restore(nowMs = Date.now()) {
    if (!this.enabled) return;
    const dates = [chicagoTradingDate(nowMs)];
    const previous = cmeSessionBounds(dates[0]);
    if (previous) dates.unshift(chicagoTradingDate(previous.startMs - 60_000));
    for (const tradingDate of dates) {
      const dayDir = this.dayDir(tradingDate);
      if (!existsSync(dayDir)) continue;
      let names = [];
      try {
        names = readdirSync(dayDir).filter((name) => name.endsWith(".json"));
      } catch { continue; }
      for (const name of names) {
        const match = name.match(/^([A-Z0-9]+)-([A-Z0-9]+)\.json$/i);
        if (!match) continue;
        const bars = await this.readFile(join(dayDir, name));
        if (!bars.length) continue;
        const target = this.barsFor(tradingDate, match[1].toUpperCase(), match[2].toUpperCase());
        for (const bar of bars) target.set(bar.t, bar);
      }
    }
  }

  /**
   * Serve history for a window. Bars come from the archived sessions plus the
   * one still being built, so the live edge is continuous with the past
   * rather than arriving as a separate seam.
   */
  async load({ exchange, symbol, interval, fromMs, toMs, limit }) {
    const upper = String(exchange || "").toUpperCase();
    const upperSymbol = String(symbol || "").toUpperCase();
    const end = Number.isFinite(Number(toMs)) && Number(toMs) > 0 ? Number(toMs) : Date.now();
    const requestedFrom = Number(fromMs);
    const start = Number.isFinite(requestedFrom) && requestedFrom > 0
      ? requestedFrom
      : end - 5 * 86_400_000;
    const intervalMs = parseIntervalMs(interval);
    const merged = new Map();

    for (const tradingDate of tradingDatesBetween(start, end)) {
      const live = this.open.get(tradingDate)?.get(`${upper}:${upperSymbol}`);
      const file = join(this.dayDir(tradingDate), instrumentFileName(upper, upperSymbol));
      const exactBars = await this.readFile(file);
      // History Plant continuous bars are keyed by product root (NQ), while
      // the live archive is keyed by active contract (NQU6). Fall back only
      // when that exact contract has no session file, preserving captured
      // live truth and keeping micros separate from their parent products.
      const archived = exactBars.length
        ? exactBars
        : await this.readFile(join(
            this.dayDir(tradingDate),
            instrumentFileName(upper, contractRoot(upperSymbol)),
          ));
      for (const bar of archived) merged.set(bar.t, bar);
      if (live) for (const bar of live.values()) merged.set(bar.t, bar);
    }

    const bars = [...merged.values()]
      .filter((bar) => bar.t >= start && bar.t <= end)
      .sort((a, b) => a.t - b.t);
    const resampled = resampleBars(bars, intervalMs, String(interval || ""));
    const cap = Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.min(Number(limit), MAX_SERVED_BARS)
      : MAX_SERVED_BARS;
    const served = resampled.length > cap ? resampled.slice(-cap) : resampled;

    return {
      exchange: upper,
      symbol: upperSymbol,
      interval: String(interval || "1m"),
      source: "Rithmic recorded trade tape",
      startMs: start,
      endMs: end,
      candles: served.map((bar) => ({
        timestamp: bar.t,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      })),
    };
  }
}
