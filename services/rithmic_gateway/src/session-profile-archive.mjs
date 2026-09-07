import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { gzip, gunzip } from "node:zlib";
import { join } from "node:path";
import { promisify } from "node:util";

import { runArchiveFold } from "./archive-fold-worker-client.mjs";
import { optionsSessionOpen } from "./live-session-guard.mjs";
import { chicagoTradingDate } from "./trading-session.mjs";
import { tradingDatesBetween } from "./futures-bar-archive.mjs";
import {
  backfillFileName, instrumentFileName,
} from "./trade-tape-archive.mjs";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Traded volume per price, per minute - the substrate every volume profile is
 * summed from.
 *
 * The profile route builds from the live in-memory execution ring, which is
 * bounded. Measured mid-session: it reached back only to 14:04Z, so a request
 * for that day's Asia window (00:00-07:00Z) came back covering 00:00-01:01,
 * London's covered 14:04-15:59 of 08:00-16:00, and New York's missed the cash
 * open. As the day rolls forward each session falls out of the ring in turn,
 * which is why the daily profiles "kept disappearing" - and the ones that
 * survived were silently built over a fraction of their window.
 *
 * Reading the recorded tape per request fixed the coverage and took the desk
 * down twice: the gateway is one Node process, so a whole-session read on the
 * request path blocks the event loop that also serves options, GEX, quotes and
 * the live feed. This is that fix done the way bar flow does it - folded once
 * per session, cached to disk, and never folded inside a request.
 *
 * Minutes are the unit because a profile SUMS: the volume traded at a price
 * over a window is the sum over the minutes in it, so any window that starts
 * and ends on a minute boundary is reconstructed exactly. Every session the
 * product offers - Globex, Asia, London, New York, RTH, Overnight, and custom
 * windows, which are minute-granular - is such a window.
 */

const MINUTE_MS = 60_000;
const DIR_NAME = "profiles";
/** One session at a time, and nobody ever receives these. */
const SESSION_PRINT_CEILING = 5_000_000;
/** How stale the live session's fold may get before it is rebuilt. */
const LIVE_REBUILD_MS = 60_000;
const PROFILE_FOLD_SCHEMA = 2;

const profileFileName = (exchange, symbol) =>
  `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.profile.json.gz`;

/**
 * Fold prints into one price histogram per minute.
 *
 * Prices are kept in TICKS as integers. A profile keys on exact price
 * equality, and 29,131.75 does not survive a float round trip reliably enough
 * to be a map key - two prints at the same price landing in two rows would
 * split a level and move the POC.
 */
export function foldPrintsToMinuteLevels(trades, tickSize) {
  const tick = Number(tickSize) > 0 ? Number(tickSize) : 0.25;
  const minutes = new Map();
  const minuteLastTrade = new Map();
  for (const trade of trades) {
    const size = Number(trade.size) || 0;
    if (size <= 0) continue;
    const priceTicks = Math.round(Number(trade.price) / tick);
    if (!Number.isFinite(priceTicks)) continue;
    const bucket = Math.floor(trade.timestamp / MINUTE_MS) * MINUTE_MS;
    minuteLastTrade.set(bucket, Math.max(minuteLastTrade.get(bucket) ?? bucket, trade.timestamp));
    let levels = minutes.get(bucket);
    if (!levels) {
      levels = new Map();
      minutes.set(bucket, levels);
    }
    let row = levels.get(priceTicks);
    if (!row) {
      row = { volume: 0, askVolume: 0, bidVolume: 0, trades: 0, sizes: new Map() };
      levels.set(priceTicks, row);
    }
    row.volume += size;
    row.trades += 1;
    const side = Number(trade.side) || 0;
    // A print the feed gave no side for still counts as VOLUME - it traded -
    // but it cannot be attributed to a buyer or a seller, so it moves neither
    // half of the delta.
    if (side > 0) row.askVolume += size;
    else if (side < 0) row.bidVolume += size;
    let sized = row.sizes.get(size);
    if (!sized) {
      sized = { ask: 0, bid: 0, unknown: 0 };
      row.sizes.set(size, sized);
    }
    if (side > 0) sized.ask += 1;
    else if (side < 0) sized.bid += 1;
    else sized.unknown += 1;
  }
  return [...minutes.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([t, levels]) => ({
      t,
      last: minuteLastTrade.get(t) ?? t,
      // Compact rows: [priceTicks, volume, askVolume, bidVolume, trades].
      levels: [...levels.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([priceTicks, row]) => [
          priceTicks,
          row.volume,
          row.askVolume,
          row.bidVolume,
          row.trades,
          // Exact individual-print size distribution. Without this, applying
          // Filter min/max to a completed session was impossible: the fold had
          // already merged every print and the route returned no profile.
          [...row.sizes.entries()]
            .sort((left, right) => left[0] - right[0])
            .map(([size, counts]) => [size, counts.ask, counts.bid, counts.unknown]),
        ]),
    }));
}

/**
 * Sum the minutes inside a window into one price histogram.
 *
 * End-exclusive, so two adjacent sessions never both claim the minute on their
 * shared boundary.
 */
export function sumMinuteLevels(minutes, fromMs, toMs, filters = {}) {
  const minTradeVolume = Math.max(0, Number(filters.minTradeVolume) || 0);
  const maxTradeVolume = Math.max(0, Number(filters.maxTradeVolume) || 0);
  const filtered = minTradeVolume > 0 || maxTradeVolume > 0;
  const totals = new Map();
  let coverageStartMs = null;
  let coverageEndMs = null;
  for (const minute of minutes) {
    if (minute.t < fromMs || minute.t >= toMs) continue;
    if (coverageStartMs === null || minute.t < coverageStartMs) coverageStartMs = minute.t;
    const minuteCoverageEnd = Number.isFinite(Number(minute.last))
      ? Number(minute.last)
      : minute.t + MINUTE_MS - 1;
    if (coverageEndMs === null || minuteCoverageEnd > coverageEndMs) coverageEndMs = minuteCoverageEnd;
    for (const [priceTicks, volume, askVolume, bidVolume, trades, sizes] of minute.levels) {
      if (!filtered) {
        let row = totals.get(priceTicks);
        if (!row) {
          row = { volume: 0, askVolume: 0, bidVolume: 0, trades: 0 };
          totals.set(priceTicks, row);
        }
        row.volume += volume;
        row.askVolume += askVolume;
        row.bidVolume += bidVolume;
        row.trades += trades;
        continue;
      }
      // Schema-2 folds retain counts by exact execution size, so arbitrary
      // min/max settings remain exact for completed sessions as well as live
      // ones. Older folds are invalidated on load and rebuilt by the warmer.
      let acceptedVolume = 0;
      let acceptedAskVolume = 0;
      let acceptedBidVolume = 0;
      let acceptedTrades = 0;
      for (const [sizeValue, askCount, bidCount, unknownCount] of sizes ?? []) {
        const size = Number(sizeValue);
        if (size < minTradeVolume || (maxTradeVolume > 0 && size > maxTradeVolume)) continue;
        const ask = Number(askCount) || 0;
        const bid = Number(bidCount) || 0;
        const unknown = Number(unknownCount) || 0;
        acceptedVolume += size * (ask + bid + unknown);
        acceptedAskVolume += size * ask;
        acceptedBidVolume += size * bid;
        acceptedTrades += ask + bid + unknown;
      }
      if (!acceptedTrades) continue;
      let row = totals.get(priceTicks);
      if (!row) {
        row = { volume: 0, askVolume: 0, bidVolume: 0, trades: 0 };
        totals.set(priceTicks, row);
      }
      row.volume += acceptedVolume;
      row.askVolume += acceptedAskVolume;
      row.bidVolume += acceptedBidVolume;
      row.trades += acceptedTrades;
    }
  }
  return {
    totals,
    coverageStartMs,
    coverageEndMs,
  };
}

/**
 * Materialise the unfiltered whole-session histogram once.
 *
 * Weekly profiles used to walk every price row of every minute on every
 * request. A busy NQ week contains hundreds of thousands of those rows even
 * though the result has only a few hundred prices. Session folds are immutable
 * once complete, so retain that small reduction beside the minute detail.
 * Custom/session filters still use the minutes and remain exact.
 */
export function aggregateSessionMinuteLevels(minutes) {
  const { totals, coverageStartMs, coverageEndMs } = sumMinuteLevels(
    minutes,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  );
  return {
    coverageStartMs,
    coverageEndMs,
    // Compact rows: [priceTicks, volume, askVolume, bidVolume, trades].
    levels: [...totals.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([priceTicks, row]) => [
        priceTicks,
        row.volume,
        row.askVolume,
        row.bidVolume,
        row.trades,
      ]),
  };
}

function sessionAggregate(entry) {
  if (entry?.aggregate && Array.isArray(entry.aggregate.levels)) return entry.aggregate;
  const aggregate = aggregateSessionMinuteLevels(entry?.minutes ?? []);
  if (entry) entry.aggregate = aggregate;
  return aggregate;
}

export class SessionProfileArchive {
  constructor(options = {}) {
    this.dir = join(String(options.dir || "recordings"), DIR_NAME);
    this.tapeDir = join(String(options.dir || "recordings"), "trades");
    this.enabled = options.enabled !== false;
    this.memory = new Map();
    this.pending = new Set();
    this.warmTimer = null;
    this.warmKickTimer = null;
    this.warmTick = null;
    this.warmingKey = null;
    this.lastError = null;
    this.maintenanceAllowed = options.maintenanceAllowed || (() => !optionsSessionOpen());
  }

  status() {
    return {
      enabled: this.enabled,
      dir: this.dir,
      cached: this.memory.size,
      pending: this.pending.size,
      warming: this.warmingKey,
      maintenancePaused: !this.maintenanceAllowed(),
      lastError: this.lastError,
    };
  }

  queueWarm(key) {
    if (key !== this.warmingKey) this.pending.add(key);
    this.scheduleWarm();
  }

  scheduleWarm(delayMs = 0) {
    if (!this.warmTick || this.warmKickTimer || !this.pending.size) return;
    this.warmKickTimer = setTimeout(() => {
      this.warmKickTimer = null;
      void this.warmTick();
    }, Math.max(0, delayMs));
    if (typeof this.warmKickTimer.unref === "function") this.warmKickTimer.unref();
  }

  async waitForWarmKeys(keys, timeoutMs) {
    if (!this.warmTick || !keys.length || timeoutMs <= 0) return;
    const wanted = new Set(keys);
    const deadline = Date.now() + timeoutMs;
    while (
      Date.now() < deadline
      && (wanted.has(this.warmingKey) || [...wanted].some((key) => this.pending.has(key)))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  /**
   * Fold the sessions requests have asked for, one at a time, off the request
   * path. Serialised deliberately: several folds landing on the event loop at
   * once is the failure this exists to avoid.
   */
  startWarming(intervalMs = 20_000) {
    if (!this.enabled || this.warmTimer) return () => {};
    const tick = async () => {
      if (this.warmingKey || !this.maintenanceAllowed()) return;
      const next = this.pending.values().next();
      if (next.done) return;
      this.pending.delete(next.value);
      this.warmingKey = next.value;
      const [exchange, symbol, tradingDate, tick_] = String(next.value).split(":");
      try {
        await this.sessionLevels(tradingDate, exchange, symbol, Number(tick_), true);
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      } finally {
        this.warmingKey = null;
        // The worker queue serialises disk-heavy folds. Start its next item
        // promptly instead of making every missing trading day pay another
        // full 20-second timer interval.
        this.scheduleWarm(25);
      }
    };
    this.warmTick = tick;
    this.warmTimer = setInterval(() => { void tick(); }, intervalMs);
    if (typeof this.warmTimer.unref === "function") this.warmTimer.unref();
    this.scheduleWarm();
    return () => {
      if (this.warmTimer) clearInterval(this.warmTimer);
      if (this.warmKickTimer) clearTimeout(this.warmKickTimer);
      this.warmTimer = null;
      this.warmKickTimer = null;
      this.warmTick = null;
    };
  }

  #tapeFiles(tradingDate, exchange, symbol) {
    const dayDir = join(this.tapeDir, tradingDate);
    return [instrumentFileName(exchange, symbol), backfillFileName(exchange, symbol)]
      .map((name) => join(dayDir, name))
      .filter((file) => existsSync(file));
  }

  /**
   * One session's minute histograms.
   *
   * `foldIfMissing` false means "answer from what is already folded, or not at
   * all" - no request path is allowed to trigger a fold.
   */
  async sessionLevels(tradingDate, exchange, symbol, tickSize, foldIfMissing = true) {
    const key = `${exchange}:${symbol}:${tradingDate}:${tickSize}`;
    const live = tradingDate === chicagoTradingDate(Date.now());
    const cached = this.memory.get(key);
    if (cached && (!live || Date.now() - cached.builtAt < LIVE_REBUILD_MS)) return cached;
    if (cached && live && !foldIfMissing) {
      // Stale by a minute is fine; re-folding a growing live session inside a
      // request is not.
      this.queueWarm(key);
      return cached;
    }

    const file = join(this.dir, tradingDate, profileFileName(exchange, symbol));
    if (!live && !cached && existsSync(file)) {
      try {
        const parsed = JSON.parse((await gunzipAsync(await readFile(file))).toString("utf8"));
        if (
          parsed?.schemaVersion === PROFILE_FOLD_SCHEMA
          && Array.isArray(parsed?.minutes)
          && parsed.tickSize === tickSize
        ) {
          const restored = { ...parsed, builtAt: Date.now() };
          // Schema-2 files predate the materialised whole-session reduction.
          // Build it once on cold restore, then every weekly request is O(price
          // levels) rather than O(minutes x price levels).
          sessionAggregate(restored);
          this.memory.set(key, restored);
          return restored;
        }
      } catch (error) {
        // A damaged cache is not a reason to serve nothing; rebuild it.
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!foldIfMissing) {
      this.queueWarm(key);
      return null;
    }

    const built = await runArchiveFold({
      kind: "session-profile",
      files: this.#tapeFiles(tradingDate, exchange, symbol),
      tradingDate,
      tickSize,
      ceiling: SESSION_PRINT_CEILING,
    });
    const entry = { ...built, schemaVersion: PROFILE_FOLD_SCHEMA, builtAt: Date.now() };
    sessionAggregate(entry);
    this.memory.set(key, entry);

    /*
     * Only a completed session is written to disk. Caching the session in
     * progress would freeze it at whatever the market had done when the first
     * chart asked, and every later request would read that back instead of the
     * prints that have arrived since.
     */
    if (!live && built.minutes.length) {
      try {
        const dayDir = join(this.dir, tradingDate);
        if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });
        const temporary = `${file}.tmp`;
        await writeFile(temporary, await gzipAsync(Buffer.from(JSON.stringify(built)), { level: 6 }));
        await rename(temporary, file);
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    }
    return entry;
  }

  /**
   * The traded volume per price over a window, or null when nothing is folded
   * for it yet.
   *
   * Null rather than an empty profile: "nobody has counted this yet" and "no
   * volume traded here" have to stay distinguishable, or a chart draws an
   * empty profile over a session that was actually busy.
   */
  async load({
    exchange,
    symbol,
    tickSize,
    fromMs,
    toMs,
    minTradeVolume = 0,
    maxTradeVolume = 0,
    waitForWarmMs = 0,
  }) {
    if (!this.enabled) return null;
    const upper = String(exchange || "").toUpperCase();
    const upperSymbol = String(symbol || "").toUpperCase();
    const end = Number(toMs) > 0 ? Number(toMs) : Date.now();
    const start = Number(fromMs) > 0 ? Number(fromMs) : end - 24 * 60 * 60_000;
    const tick = Number(tickSize) > 0 ? Number(tickSize) : 0.25;

    // Restore independent completed days concurrently. The old serial awaits
    // made a cold weekly request pay five gzip+JSON restore times in sequence.
    const availableDates = tradingDatesBetween(start, end).filter(
      (tradingDate) => this.#tapeFiles(tradingDate, upper, upperSymbol).length,
    );
    const keys = availableDates.map((tradingDate) => `${upper}:${upperSymbol}:${tradingDate}:${tick}`);
    const sessions = (await Promise.all(
      availableDates.map(async (tradingDate) => {
        return this.sessionLevels(tradingDate, upper, upperSymbol, tick, false);
      }),
    )).filter(Boolean);
    if (sessions.length < availableDates.length && waitForWarmMs > 0) {
      // Folding remains outside the gateway event loop in the shared worker.
      // Hold this one profile request briefly so the chart receives the result
      // from that first request instead of waiting for the browser's next
      // 15-second reconciliation cycle.
      await this.waitForWarmKeys(keys, waitForWarmMs);
      return this.load({
        exchange,
        symbol,
        tickSize,
        fromMs,
        toMs,
        minTradeVolume,
        maxTradeVolume,
        waitForWarmMs: 0,
      });
    }
    if (!sessions.length) return null;

    const filtered = minTradeVolume > 0 || maxTradeVolume > 0;
    const totals = new Map();
    let coverageStartMs = null;
    let coverageEndMs = null;
    const addRow = (priceTicks, volume, askVolume, bidVolume, trades) => {
      let row = totals.get(priceTicks);
      if (!row) {
        row = { volume: 0, askVolume: 0, bidVolume: 0, trades: 0 };
        totals.set(priceTicks, row);
      }
      row.volume += volume;
      row.askVolume += askVolume;
      row.bidVolume += bidVolume;
      row.trades += trades;
    };
    for (const session of sessions) {
      const aggregate = sessionAggregate(session);
      const wholeSession = !filtered
        && aggregate.coverageStartMs !== null
        && aggregate.coverageEndMs !== null
        && aggregate.coverageStartMs >= start
        && aggregate.coverageEndMs < end;
      if (wholeSession) {
        coverageStartMs = coverageStartMs === null
          ? aggregate.coverageStartMs
          : Math.min(coverageStartMs, aggregate.coverageStartMs);
        coverageEndMs = coverageEndMs === null
          ? aggregate.coverageEndMs
          : Math.max(coverageEndMs, aggregate.coverageEndMs);
        for (const [priceTicks, volume, askVolume, bidVolume, trades] of aggregate.levels) {
          addRow(priceTicks, volume, askVolume, bidVolume, trades);
        }
        continue;
      }
      const partial = sumMinuteLevels(session.minutes, start, end, {
        minTradeVolume,
        maxTradeVolume,
      });
      if (partial.coverageStartMs !== null) {
        coverageStartMs = coverageStartMs === null
          ? partial.coverageStartMs
          : Math.min(coverageStartMs, partial.coverageStartMs);
      }
      if (partial.coverageEndMs !== null) {
        coverageEndMs = coverageEndMs === null
          ? partial.coverageEndMs
          : Math.max(coverageEndMs, partial.coverageEndMs);
      }
      for (const [priceTicks, row] of partial.totals) {
        addRow(priceTicks, row.volume, row.askVolume, row.bidVolume, row.trades);
      }
    }
    return {
      tickSize: tick,
      coverageStartMs,
      coverageEndMs,
      levels: [...totals.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([priceTicks, row]) => ({
          price: priceTicks * tick,
          volume: row.volume,
          askVolume: row.askVolume,
          bidVolume: row.bidVolume,
          delta: row.askVolume - row.bidVolume,
          trades: row.trades,
        })),
    };
  }
}
