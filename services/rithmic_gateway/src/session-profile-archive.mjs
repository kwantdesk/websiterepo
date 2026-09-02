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

export class SessionProfileArchive {
  constructor(options = {}) {
    this.dir = join(String(options.dir || "recordings"), DIR_NAME);
    this.tapeDir = join(String(options.dir || "recordings"), "trades");
    this.enabled = options.enabled !== false;
    this.memory = new Map();
    this.pending = new Set();
    this.warmTimer = null;
    this.lastError = null;
    this.maintenanceAllowed = options.maintenanceAllowed || (() => !optionsSessionOpen());
  }

  status() {
    return {
      enabled: this.enabled,
      dir: this.dir,
      cached: this.memory.size,
      pending: this.pending.size,
      maintenancePaused: !this.maintenanceAllowed(),
      lastError: this.lastError,
    };
  }

  /**
   * Fold the sessions requests have asked for, one at a time, off the request
   * path. Serialised deliberately: several folds landing on the event loop at
   * once is the failure this exists to avoid.
   */
  startWarming(intervalMs = 20_000) {
    if (!this.enabled || this.warmTimer) return () => {};
    const tick = async () => {
      if (!this.maintenanceAllowed()) return;
      const next = this.pending.values().next();
      if (next.done) return;
      this.pending.delete(next.value);
      const [exchange, symbol, tradingDate, tick_] = String(next.value).split(":");
      try {
        await this.sessionLevels(tradingDate, exchange, symbol, Number(tick_), true);
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    };
    this.warmTimer = setInterval(() => { void tick(); }, intervalMs);
    if (typeof this.warmTimer.unref === "function") this.warmTimer.unref();
    return () => {
      if (this.warmTimer) clearInterval(this.warmTimer);
      this.warmTimer = null;
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
      this.pending.add(key);
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
          this.memory.set(key, restored);
          return restored;
        }
      } catch (error) {
        // A damaged cache is not a reason to serve nothing; rebuild it.
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!foldIfMissing) {
      this.pending.add(key);
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
  async load({ exchange, symbol, tickSize, fromMs, toMs, minTradeVolume = 0, maxTradeVolume = 0 }) {
    if (!this.enabled) return null;
    const upper = String(exchange || "").toUpperCase();
    const upperSymbol = String(symbol || "").toUpperCase();
    const end = Number(toMs) > 0 ? Number(toMs) : Date.now();
    const start = Number(fromMs) > 0 ? Number(fromMs) : end - 24 * 60 * 60_000;
    const tick = Number(tickSize) > 0 ? Number(tickSize) : 0.25;

    const minutes = [];
    let folded = false;
    for (const tradingDate of tradingDatesBetween(start, end)) {
      if (!this.#tapeFiles(tradingDate, upper, upperSymbol).length) continue;
      const session = await this.sessionLevels(tradingDate, upper, upperSymbol, tick, false);
      if (!session) continue;
      folded = true;
      minutes.push(...session.minutes);
    }
    if (!folded) return null;
    minutes.sort((left, right) => left.t - right.t);

    const { totals, coverageStartMs, coverageEndMs } = sumMinuteLevels(minutes, start, end, {
      minTradeVolume,
      maxTradeVolume,
    });
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
