import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { gzip, gunzip } from "node:zlib";
import { join } from "node:path";
import { promisify } from "node:util";

import { runArchiveFold } from "./archive-fold-worker-client.mjs";
import { optionsSessionOpen } from "./live-session-guard.mjs";
import { chicagoTradingDate } from "./trading-session.mjs";
import { parseIntervalMs, tradingDatesBetween } from "./futures-bar-archive.mjs";
import {
  backfillFileName, instrumentFileName,
} from "./trade-tape-archive.mjs";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Per-bar aggressor flow: the bid/ask split behind every time-based chart.
 *
 * Footprint, CVD, delta and Big Trades all need to know which side was
 * aggressive, which an OHLC bar does not carry. The website used to rebuild
 * this by streaming the vendor's raw trades for the whole window; that
 * subscription is gone, and because the flow request and the bar request were
 * the same call, its failure took the BARS down with it - every time-based
 * chart fell back to whatever it had accumulated live, which is why they all
 * showed only the last few minutes.
 *
 * The prints are already on this disk. The work is done here rather than by
 * shipping them: a five-day NQ window is 1.5 million prints and 6 MB gzipped,
 * per pane, per load - which would have traded a broken chart for a slow one.
 * Aggregated here it is about 1,400 rows.
 *
 * Computed once per session and cached beside the bars. A completed session
 * can never change, so it is read from disk forever after; only the session in
 * progress is recomputed, and then at most once a minute.
 */

const MINUTE_MS = 60_000;
const DIR_NAME = "flow";
/**
 * How many prints one session may hold in memory while being aggregated.
 *
 * Deliberately above the serving cap: this reads exactly one session at a
 * time and the whole point is that no caller ever receives them.
 */
const SESSION_PRINT_CEILING = 5_000_000;
/** Strongest prints kept per minute, for Big Trades. */
const EXECUTIONS_PER_MINUTE = 12;
/** Bound on what a single response may carry back. */
const MAX_EXECUTIONS = 50_000;
/** How stale the live session's flow may get before it is rebuilt. */
const LIVE_REBUILD_MS = 60_000;

const flowFileName = (exchange, symbol) =>
  `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.flow.json.gz`;

/**
 * Fold prints into one row per minute.
 *
 * `deltaHigh` and `deltaLow` are the running cumulative delta's extremes
 * WITHIN the minute, measured from where the minute started. Stored that way
 * they compose exactly onto any larger interval - the cumulative path across a
 * five-minute bar is the running total at each minute's start plus that
 * minute's own path - so a 5m, 15m or 1h bar gets the true delta high and low
 * rather than the largest of its minutes'.
 */
export function foldPrintsToMinutes(trades) {
  const minutes = new Map();
  const strongest = new Map();
  for (const trade of trades) {
    const size = Number(trade.size) || 0;
    const side = Number(trade.side) || 0;
    if (size <= 0) continue;
    const bucket = Math.floor(trade.timestamp / MINUTE_MS) * MINUTE_MS;
    let row = minutes.get(bucket);
    if (!row) {
      row = {
        t: bucket, volume: 0, trades: 0, askVolume: 0, bidVolume: 0,
        delta: 0, deltaHigh: 0, deltaLow: 0,
      };
      minutes.set(bucket, row);
    }
    row.volume += size;
    row.trades += 1;
    const delta = side > 0 ? size : side < 0 ? -size : 0;
    if (side > 0) row.askVolume += size;
    if (side < 0) row.bidVolume += size;
    row.delta += delta;
    if (row.delta > row.deltaHigh) row.deltaHigh = row.delta;
    if (row.delta < row.deltaLow) row.deltaLow = row.delta;

    /*
     * A print the feed gave no side for carries no delta, so it is not a Big
     * Trade candidate - the same test the vendor path applied. Keeping the
     * strongest few per minute rather than the latest is what stops Big Trades
     * appearing to begin at the moment the indicator was switched on.
     */
    if (delta === 0) continue;
    const keep = strongest.get(bucket) ?? [];
    keep.push([trade.timestamp, trade.price, size, delta]);
    keep.sort((left, right) => right[2] - left[2] || left[0] - right[0]);
    if (keep.length > EXECUTIONS_PER_MINUTE) keep.length = EXECUTIONS_PER_MINUTE;
    strongest.set(bucket, keep);
  }
  return {
    minutes: [...minutes.values()].sort((left, right) => left.t - right.t),
    executions: [...strongest.values()].flat().sort((left, right) => left[0] - right[0]),
  };
}

/**
 * Roll minute rows up to a chart interval.
 *
 * Volumes and trade counts add. The delta extremes are rebuilt by walking the
 * running total, which is why they were stored relative to each minute.
 */
export function resampleFlow(minutes, intervalMs) {
  if (!Number.isFinite(intervalMs) || intervalMs <= MINUTE_MS) {
    return new Map(minutes.map((row) => [row.t, row]));
  }
  const buckets = new Map();
  for (const row of minutes) {
    const bucket = Math.floor(row.t / intervalMs) * intervalMs;
    let target = buckets.get(bucket);
    if (!target) {
      target = {
        t: bucket, volume: 0, trades: 0, askVolume: 0, bidVolume: 0,
        delta: 0, deltaHigh: 0, deltaLow: 0,
      };
      buckets.set(bucket, target);
    }
    target.volume += row.volume;
    target.trades += row.trades;
    target.askVolume += row.askVolume;
    target.bidVolume += row.bidVolume;
    // The running total at this minute's start, plus this minute's own path.
    const high = target.delta + row.deltaHigh;
    const low = target.delta + row.deltaLow;
    if (high > target.deltaHigh) target.deltaHigh = high;
    if (low < target.deltaLow) target.deltaLow = low;
    target.delta += row.delta;
  }
  return buckets;
}

export class BarFlowArchive {
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
   * path.
   *
   * Serialised on purpose: the whole failure being fixed is several folds
   * landing on the event loop at once.
   */
  startWarming(intervalMs = 20_000) {
    if (!this.enabled || this.warmTimer) return () => {};
    const tick = async () => {
      if (!this.maintenanceAllowed()) return;
      const next = this.pending.values().next();
      if (next.done) return;
      this.pending.delete(next.value);
      const [exchange, symbol, tradingDate] = String(next.value).split(":");
      try {
        await this.sessionFlow(tradingDate, exchange, symbol, true);
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
   * One session's minute flow, from disk when it is already known.
   *
   * `foldIfMissing` false means "answer from what is already folded, or not at
   * all". Folding reads a whole session of prints, and the gateway is one Node
   * process: doing that inside a request blocks the event loop that also
   * serves options, GEX, quotes and the live feed. It took the desk down at
   * the open, so no request path is allowed to trigger it.
   */
  async sessionFlow(tradingDate, exchange, symbol, foldIfMissing = true) {
    const key = `${exchange}:${symbol}:${tradingDate}`;
    const live = tradingDate === chicagoTradingDate(Date.now());
    const cached = this.memory.get(key);
    if (cached && (!live || Date.now() - cached.builtAt < LIVE_REBUILD_MS)) return cached;
    if (cached && live && !foldIfMissing) {
      // Stale by a minute is fine; re-folding a growing live session inside a
      // request is not. The warmer refreshes it.
      this.pending.add(key);
      return cached;
    }

    const file = join(this.dir, tradingDate, flowFileName(exchange, symbol));
    if (!live && !cached && existsSync(file)) {
      try {
        const parsed = JSON.parse((await gunzipAsync(await readFile(file))).toString("utf8"));
        if (Array.isArray(parsed?.minutes)) {
          const restored = { ...parsed, builtAt: Date.now() };
          this.memory.set(key, restored);
          return restored;
        }
      } catch (error) {
        // A damaged cache is not a reason to serve no flow; rebuild it.
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!foldIfMissing) {
      // Nothing folded yet for this session: the caller gets no flow rather
      // than a stalled gateway. The warmer below fills it in shortly.
      this.pending.add(`${exchange}:${symbol}:${tradingDate}`);
      return null;
    }
    const built = await runArchiveFold({
      kind: "bar-flow",
      files: this.#tapeFiles(tradingDate, exchange, symbol),
      tradingDate,
      ceiling: SESSION_PRINT_CEILING,
    });
    const entry = { ...built, builtAt: Date.now() };
    this.memory.set(key, entry);

    /*
     * Only a completed session is written to disk. Caching the session in
     * progress would freeze it at whatever the market had done by the time the
     * first chart asked, and every later request would read that stale file
     * back rather than the prints that have arrived since.
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
   * Flow for a window, keyed by the bar timestamps a chart will ask about.
   *
   * An instrument with no tape returns nothing rather than failing: only the
   * four event-bar contracts are taped, and a chart on any other instrument
   * must still get its bars.
   */
  async load({ exchange, symbol, interval, fromMs, toMs }) {
    if (!this.enabled) return { flow: new Map(), executions: [] };
    const upper = String(exchange || "").toUpperCase();
    const upperSymbol = String(symbol || "").toUpperCase();
    const end = Number(toMs) > 0 ? Number(toMs) : Date.now();
    const start = Number(fromMs) > 0 ? Number(fromMs) : end - 24 * 60 * 60_000;
    const intervalMs = parseIntervalMs(interval) || MINUTE_MS;

    const minutes = [];
    const executions = [];
    for (const tradingDate of tradingDatesBetween(start, end)) {
      if (!this.#tapeFiles(tradingDate, upper, upperSymbol).length) continue;
      const session = await this.sessionFlow(tradingDate, upper, upperSymbol, false);
      if (!session) continue;
      for (const row of session.minutes) {
        if (row.t + MINUTE_MS <= start || row.t > end) continue;
        minutes.push(row);
      }
      for (const execution of session.executions) {
        if (execution[0] < start || execution[0] > end) continue;
        executions.push(execution);
      }
    }
    minutes.sort((left, right) => left.t - right.t);
    executions.sort((left, right) => left[0] - right[0]);
    return {
      flow: resampleFlow(minutes, intervalMs),
      // Newest kept: Big Trades is drawn on the visible right-hand side.
      executions: executions.length > MAX_EXECUTIONS ? executions.slice(-MAX_EXECUTIONS) : executions,
    };
  }
}
