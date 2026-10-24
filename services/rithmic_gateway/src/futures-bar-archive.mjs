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

/** History Plant time-bar markers name the closing boundary. Older minute
 * imports saved that marker verbatim; live/replayed trades use bar-open time.
 * Normalize only the explicitly identified minute importer, never recorded
 * trades or files already migrated to the bar-open convention.
 */
export function historyPlantBarOpenTime(timestamp, source, markerConvention) {
  return source === "Rithmic History Plant minute bars" && markerConvention !== "bar-open"
    ? Number(timestamp) - BAR_MS : Number(timestamp);
}

/**
 * Rows are stored positionally rather than as objects. It is the difference
 * between ~40 bytes and ~140 bytes a bar across every instrument and every
 * session, for a file nothing reads by hand.
 */
// Optional source-order watermarks preserve real first/last execution order
// across restarts. Six-column legacy/import rows remain readable.
const encodeBar = (bar) => [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v, bar.f ?? null, bar.e ?? null];
const decodeBar = (row) => (Array.isArray(row)
  ? { t: row[0], o: row[1], h: row[2], l: row[3], c: row[4], v: row[5], f: row[6], e: row[7] }
  // Accept the object form too, so a file written by a future version - or
  // hand-repaired - still loads rather than being silently dropped.
  : { t: row.t ?? row.timestamp, o: row.o ?? row.open, h: row.h ?? row.high, l: row.l ?? row.low, c: row.c ?? row.close, v: row.v ?? row.volume, f: row.f, e: row.e });

function validArchivedBar(bar) {
  return [bar?.t, bar?.o, bar?.h, bar?.l, bar?.c, bar?.v].every(Number.isFinite)
    && bar.t > 0
    && bar.o > 0
    && bar.h > 0
    && bar.l > 0
    && bar.c > 0
    && bar.v >= 0
    && bar.h >= Math.max(bar.o, bar.c)
    && bar.l <= Math.min(bar.o, bar.c)
    && bar.h >= bar.l;
}

/**
 * Join canonical History Plant minutes with the desk's captured trade bars.
 *
 * History Plant is the exchange-side closed-bar baseline. A local recording
 * is valuable beyond that baseline and can fill a minute absent from it, but
 * it may have crossed a collector reconnect or an explicit recorder GAP. It
 * therefore cannot replace a canonical minute merely because the session has
 * an exact-contract file. This per-minute join is what prevents one partial
 * recording from hiding an otherwise complete historical session.
 */
export function mergeRithmicHistoryBars(historyPlantBars, recordedBars) {
  const merged = new Map();
  for (const bar of historyPlantBars) {
    if (validArchivedBar(bar)) merged.set(bar.t, bar);
  }
  for (const bar of recordedBars) {
    if (validArchivedBar(bar) && !merged.has(bar.t)) merged.set(bar.t, bar);
  }
  return [...merged.values()].sort((left, right) => left.t - right.t);
}

function instrumentFileName(exchange, symbol) {
  return `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.json`;
}

function contractRoot(symbol) {
  return String(symbol || "").toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/u, "");
}

function preferLiquidContractBar(target, bar) {
  if (!validArchivedBar(bar)) return;
  const existing = target.get(bar.t);
  // During the roll both contracts trade at the same timestamp. A continuous
  // chart must choose one contract, never sum them or alternate arbitrarily;
  // the more-liquid minute is the deterministic front-contract proxy when a
  // canonical History Plant root bar is not present.
  if (!existing || bar.v > existing.v) target.set(bar.t, bar);
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
    const payload = record?.payload || record;
    const seconds = Number(payload?.ssboe ?? payload?.sourceSsboe);
    const micros = Number(payload?.usecs ?? payload?.sourceUsecs ?? 0);
    const sourceTimeUs = Number.isFinite(seconds) && seconds > 0
      ? seconds * 1_000_000 + (Number.isFinite(micros) ? micros : 0)
      : trade.timestamp * 1000;
    const existing = bars.get(bucket);
    if (!existing) {
      bars.set(bucket, {
        t: bucket, o: trade.price, h: trade.price, l: trade.price, c: trade.price, v: trade.size,
        f: sourceTimeUs, e: sourceTimeUs,
      });
    } else {
      if (trade.price > existing.h) existing.h = trade.price;
      if (trade.price < existing.l) existing.l = trade.price;
      if (Number.isFinite(existing.f) && sourceTimeUs < existing.f) {
        existing.o = trade.price; existing.f = sourceTimeUs;
      }
      if (!Number.isFinite(existing.e) || sourceTimeUs >= existing.e) {
        existing.c = trade.price; existing.e = sourceTimeUs;
      }
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
          const metadata = {};
          const archived = await this.readFile(file, metadata);
          // A delayed snapshot after restart cannot reopen a completed,
          // reconciled session or strip its source/marker receipt.
          if (metadata.authoritativeSession) continue;
          for (const bar of archived) merged.set(bar.t, bar);
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

  async readFile(file, metadata) {
    try {
      const text = await readFile(file, "utf8");
      const parsed = JSON.parse(text);
      if (metadata) metadata.authoritativeSession = parsed?.source === "Rithmic History Plant individual trades"
        && parsed?.markerConvention === "bar-open";
      const rows = Array.isArray(parsed) ? parsed : parsed?.bars;
      if (!Array.isArray(rows)) return [];
      return rows
        .map(decodeBar)
        .map((bar) => ({ ...bar, t: historyPlantBarOpenTime(bar.t, parsed?.source, parsed?.markerConvention) }))
        .filter(validArchivedBar);
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
        for (const bar of bars) {
          // Legacy files lack source clocks. Their existing open stays known;
          // a delayed pre-restore print must not replace their saved close.
          // These are conservative order bounds, not invented executions.
          if (!Number.isFinite(bar.f)) bar.f = bar.t * 1000;
          if (!Number.isFinite(bar.e)) bar.e = Math.min(nowMs, bar.t + BAR_MS - .001) * 1000;
          target.set(bar.t, bar);
        }
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
      const openDay = this.open.get(tradingDate);
      const dayDir = this.dayDir(tradingDate);
      const file = join(dayDir, instrumentFileName(upper, upperSymbol));
      const metadata = {};
      const exactBars = await this.readFile(file, metadata);
      if (metadata.authoritativeSession && exactBars.length) {
        // This file was rebuilt from a reconciled, completed exact-contract
        // replay. Do not fill its genuine empty minutes with a stale root
        // archive or an old live snapshot from the maintenance break.
        for (const bar of exactBars) merged.set(bar.t, bar);
        continue;
      }
      // History Plant bars are stored by product root (NQ), while live capture
      // is stored by exact active contract (NQU6). Read BOTH. The old all-or-
      // nothing fallback discarded the complete History Plant session as soon
      // as one exact-contract minute existed, preserving every local gap and
      // partial wick for the chart.
      const root = contractRoot(upperSymbol);
      const historyPlantBars = root === upperSymbol
        ? []
        : await this.readFile(join(dayDir, instrumentFileName(upper, root)));
      const recordedByMinute = new Map();
      for (const bar of exactBars) preferLiquidContractBar(recordedByMinute, bar);
      // Read every concrete contract for this product. Otherwise asking for
      // NQZ6 after roll loses the locally-recorded NQU6 side of the requested
      // window whenever History Plant has not filled that older minute yet.
      if (existsSync(dayDir)) {
        let names = [];
        try { names = readdirSync(dayDir).filter((name) => name.endsWith(".json")); } catch {}
        for (const name of names) {
          const match = name.match(/^([A-Z0-9]+)-([A-Z0-9]+)\.json$/i);
          if (!match || match[1].toUpperCase() !== upper) continue;
          const candidateSymbol = match[2].toUpperCase();
          if (candidateSymbol === root || candidateSymbol === upperSymbol || contractRoot(candidateSymbol) !== root) continue;
          for (const bar of await this.readFile(join(dayDir, name))) {
            preferLiquidContractBar(recordedByMinute, bar);
          }
        }
      }
      if (openDay) {
        for (const [instrument, liveBars] of openDay) {
          const [liveExchange, liveSymbol] = instrument.split(":");
          if (liveExchange !== upper || contractRoot(liveSymbol) !== root) continue;
          for (const bar of liveBars.values()) preferLiquidContractBar(recordedByMinute, bar);
        }
      }
      const archived = mergeRithmicHistoryBars(historyPlantBars, [...recordedByMinute.values()]);
      for (const bar of archived) merged.set(bar.t, bar);
      if (recordedByMinute.size) {
        const canonicalEnd = historyPlantBars.at(-1)?.t ?? Number.NEGATIVE_INFINITY;
        for (const bar of recordedByMinute.values()) {
          if (!validArchivedBar(bar)) continue;
          const existing = merged.get(bar.t);
          // The current edge continues after History Plant's last closed bar.
          // If both sources contain that final minute, accept the live version
          // only when it has accumulated at least as much traded volume.
          if (
            !existing
            || bar.t > canonicalEnd
            || (bar.t === canonicalEnd && bar.v >= existing.v)
          ) merged.set(bar.t, bar);
        }
      }
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
      source: "Rithmic History Plant + recorded trade tape",
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
