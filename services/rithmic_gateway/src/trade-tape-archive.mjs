import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { constants as zlibConstants, createGzip } from "node:zlib";
import { join } from "node:path";

import { chicagoTradingDate } from "./trading-session.mjs";
import { resolveInstrument } from "./recorder.mjs";
import { tradeFromRecord } from "./futures-bar-archive.mjs";
import { readArchiveRecords } from "./archive-reader.mjs";

/**
 * Every print, compactly, so range and volume bars have a history.
 *
 * Minute bars cannot produce them. A 40-range bar closes when price has
 * travelled forty ticks and a volume bar when a contract count is reached, so
 * both are built from individual prints and neither can be derived from an
 * OHLC minute - the path within the minute is exactly the information they
 * need. The website asked the vendor for a raw trades feed to build them, and
 * that subscription is gone, so those chart types have had no history at all.
 *
 * The prints are in the raw tape, but that is not a serving format: a session
 * is 2.2 GB and extracting one took 198 seconds, which is how the gateway was
 * taken down once already. This writes the same prints in the four fields a
 * bar builder actually needs, which is roughly a hundredth of the size and
 * fast enough to answer a request.
 *
 * Append-only, one gzip stream per session, exactly like the recorder - a
 * whole-file rewrite is affordable for 1,400 minute bars and is not for
 * 400,000 prints.
 */

const DIR_NAME = "trades";
const DEFAULT_FLUSH_MS = 5_000;
// Enough to matter, small enough that a kill loses little. Matches the
// recorder's reasoning: throughput beats ratio when the alternative is a hole.
const GZIP_LEVEL = 1;

/**
 * Which instruments get a tape.
 *
 * Not everything: a tape is ~400,000 rows a session per instrument and the
 * disk is the binding constraint. These four are the ones event bars are
 * actually traded on - the Nasdaq and S&P minis and their micros.
 *
 * Order matters. Roots are matched by PREFIX so a contract roll does not
 * silently stop the tape, and the micros are checked first: "NQ" is not a
 * prefix of "MNQU6", but listing them the other way round invites a later
 * edit that makes one root swallow another.
 */
export const DEFAULT_TAPE_ROOTS = ["MNQ", "MES", "NQ", "ES"];

/*
 * Exported so the backfill classifies a print exactly as the live tape does.
 * A second copy of this would drift, and a delta bar built from backfilled
 * prints would then disagree with the same bar built live - silently, because
 * both look like perfectly ordinary bars.
 */
export const sideCode = (payload) => {
  const raw = payload?.aggressor ?? payload?.side;
  if (raw === null || raw === undefined || raw === "") return 0;

  /*
   * On the wire Rithmic sends the aggressor as an enum, not a word: 1 = buy,
   * 2 = sell. book-store.mjs has mapped those two values all along; this read
   * the field as text, so every live print stringified to "1", matched no
   * branch, and was stored as "the feed did not say". Measured on the live
   * tape before the fix: 4,060 of 4,060 prints sided 0, which would have made
   * every delta bar built from this tape read flat.
   *
   * Anything other than 1 or 2 stays 0. An unrecognised code means we do not
   * know the side, and a guessed side is worse than an absent one.
   */
  if (typeof raw === "number" || /^-?\d+$/.test(String(raw).trim())) {
    const code = Number(raw);
    if (code === 1) return 1;
    if (code === 2) return -1;
    return 0;
  }

  const text = String(raw).trim().toUpperCase();
  /*
   * ASK and BID name the side that was HIT, so they invert: a trade at the ask
   * is a buyer lifting it. These are tested before the B/S prefixes because
   * "BID" starts with a B - the previous ordering classified every
   * bid-hitting, i.e. seller-aggressive, print as a buy.
   */
  if (text === "ASK") return 1;
  if (text === "BID") return -1;
  if (text.startsWith("B")) return 1;
  if (text.startsWith("S")) return -1;
  return 0;
};

/** [timestamp, price, size, side] - the four fields a bar builder needs. */
export const encodeTrade = (trade, side) => [trade.timestamp, trade.price, trade.size, side];

export const decodeTrade = (row) => (Array.isArray(row)
  ? { timestamp: row[0], price: row[1], size: row[2], side: row[3] ?? 0 }
  : null);

export function instrumentFileName(exchange, symbol) {
  return `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.trades.ndjson.gz`;
}

/*
 * Backfilled prints live in a sidecar, never in the live file.
 *
 * The collector holds the live tape open and appends to it, so rewriting that
 * file would strand the open handle and send the rest of the session to a file
 * nothing reads. A sidecar also means a backfill can run at any time, against
 * the session in progress, without a restart - and a restart writes a GAP
 * marker into the archive, so "just restart it" is not free either.
 *
 * The two never overlap: the backfill stops at the live tape's earliest print.
 */
export function backfillFileName(exchange, symbol) {
  return `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.trades.backfill.ndjson.gz`;
}

export class TradeTapeArchive {
  constructor(options = {}) {
    this.dir = join(String(options.dir || "recordings"), DIR_NAME);
    this.enabled = options.enabled !== false;
    this.roots = (options.roots || DEFAULT_TAPE_ROOTS).map((root) => root.toUpperCase());
    this.flushMs = Number.isFinite(Number(options.flushMs)) ? Number(options.flushMs) : DEFAULT_FLUSH_MS;
    this.streams = new Map();
    this.files = new Map();
    this.buffers = new Map();
    this.counts = new Map();
    this.tradingDate = null;
    this.lastError = null;
    this.flushTimer = null;
    this.detach = () => {};
  }

  status() {
    return {
      enabled: this.enabled,
      dir: this.dir,
      roots: this.roots,
      tradingDate: this.tradingDate,
      written: Object.fromEntries(this.counts),
      lastError: this.lastError,
    };
  }

  /** NQU6 -> NQ, so a contract roll does not silently stop the tape. */
  #wanted(symbol) {
    const upper = String(symbol || "").toUpperCase();
    /*
     * Prefix, so NQU6 keeps taping as NQZ6 when the contract rolls. The
     * micros are distinct roots rather than a variant: MNQU6 does not start
     * with "NQ", so a tape configured only for the minis silently records
     * nothing for them - which is exactly what happened before this.
     */
    return this.roots.some((root) => upper.startsWith(root));
  }

  #streamFor(exchange, symbol, tradingDate) {
    if (tradingDate !== this.tradingDate) {
      this.flush();
      // Handles taken and maps emptied before any await, the same rule the
      // recorder learned: a stream created after the roll must not be swept
      // out by the close of the one before it.
      const rolled = { streams: this.streams, files: this.files };
      this.streams = new Map();
      this.files = new Map();
      this.tradingDate = tradingDate;
      for (const stream of rolled.streams.values()) stream.end();
    }
    const key = `${exchange}:${symbol}`;
    const existing = this.streams.get(key);
    if (existing) return existing;

    const dayDir = join(this.dir, tradingDate);
    if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });
    const file = createWriteStream(join(dayDir, instrumentFileName(exchange, symbol)), { flags: "a" });
    file.on("error", (error) => { this.lastError = error.message; });
    const gzip = createGzip({ level: GZIP_LEVEL });
    gzip.on("error", (error) => { this.lastError = error.message; });
    gzip.pipe(file);
    this.streams.set(key, gzip);
    this.files.set(key, file);
    return gzip;
  }

  record(record) {
    if (!this.enabled) return;
    const trade = tradeFromRecord(record);
    if (!trade) return;
    const { exchange, symbol } = resolveInstrument(record);
    if (exchange === "UNKNOWN" || !this.#wanted(symbol)) return;
    const tradingDate = chicagoTradingDate(trade.timestamp);
    const key = `${exchange}:${symbol}`;
    try {
      this.#streamFor(exchange, symbol, tradingDate);
      const line = JSON.stringify(encodeTrade(trade, sideCode(record?.payload || record)));
      const buffer = this.buffers.get(key);
      if (buffer) buffer.push(line);
      else this.buffers.set(key, [line]);
      this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  flush() {
    if (!this.enabled || !this.buffers.size) return;
    for (const [key, lines] of this.buffers) {
      const stream = this.streams.get(key);
      if (!stream || !lines.length) continue;
      stream.write(`${lines.join("\n")}\n`);
      /*
       * Sync-flush after every batch, or the tape is write-only until the
       * session closes.
       *
       * Deflate holds its output until it has enough to emit, so a chart
       * asking for the last hour got an empty response while thousands of
       * prints sat in the compressor - measured live: 2,744 written, 0
       * readable. A sync flush ends the deflate block so what is on disk can
       * be read straight back, at the cost of a slightly larger file. The
       * exposure archiver does the same thing for the same reason.
       */
      try { stream.flush(zlibConstants.Z_SYNC_FLUSH); } catch { /* closing */ }
      lines.length = 0;
    }
  }

  attach(client) {
    if (!this.enabled) return () => {};
    // The same two streams the recorder listens to, and the same rule: prefer
    // the decoded wire message, or every print is counted twice.
    let sawRawMessage = false;
    const onRawMessage = (record) => { sawRawMessage = true; this.record(record); };
    const onMarketData = (event) => { if (!sawRawMessage) this.record(event); };
    client.on("rawMessage", onRawMessage);
    client.on("marketData", onMarketData);
    this.flushTimer = setInterval(() => this.flush(), this.flushMs);
    if (typeof this.flushTimer.unref === "function") this.flushTimer.unref();
    this.detach = () => {
      client.off?.("rawMessage", onRawMessage);
      client.off?.("marketData", onMarketData);
      if (this.flushTimer) clearInterval(this.flushTimer);
      this.flushTimer = null;
    };
    return this.detach;
  }

  /** Ends every stream and waits for the gzip trailer to reach disk. */
  async close(timeoutMs = 4_000) {
    if (this.detach) this.detach();
    this.detach = null;
    this.flush();
    const streams = this.streams;
    const files = this.files;
    this.streams = new Map();
    this.files = new Map();
    this.buffers.clear();
    await Promise.all([...streams].map(([key, stream]) => new Promise((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      const timer = setTimeout(() => { this.lastError = `timed out closing ${key}`; done(); }, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
      const target = files.get(key) ?? stream;
      target.once("close", () => { clearTimeout(timer); done(); });
      target.once("error", () => { clearTimeout(timer); done(); });
      stream.end();
    })));
  }

  /**
   * Prints for a window, oldest first.
   *
   * Bounded by count as well as by time: an event-bar chart asks for a few
   * hours, and handing back a whole session unasked is megabytes nobody
   * requested.
   */
  async load({ exchange, symbol, fromMs, toMs, limit = 500_000 }) {
    const upper = String(exchange || "").toUpperCase();
    const upperSymbol = String(symbol || "").toUpperCase();
    const end = Number.isFinite(Number(toMs)) && Number(toMs) > 0 ? Number(toMs) : Date.now();
    const start = Number.isFinite(Number(fromMs)) && Number(fromMs) > 0
      ? Number(fromMs)
      : end - 6 * 60 * 60_000;

    const trades = [];
    /*
     * Every trading date the window touches, not just its ends.
     *
     * This took only the first and last, so a five-day chart request read two
     * session files and silently skipped everything between them - a range
     * chart asking for a week showed three sessions and looked like the
     * archive simply had no more.
     *
     * Stepped in six-hour increments rather than calendar days: a CME trading
     * date runs about twenty-three hours from 17:00 Chicago, so it does not
     * line up with a calendar day, and the boundary moves with US daylight
     * saving. Six hours cannot step over a session.
     */
    const dates = new Set();
    for (let at = start; at < end; at += 6 * 60 * 60_000) dates.add(chicagoTradingDate(at));
    dates.add(chicagoTradingDate(end));
    /*
     * Newest session first, stopping once the limit is met.
     *
     * The cap used to be applied after reading everything: a six-day NQ
     * request loaded 6.8 million prints, sorted them, and returned the newest
     * 500,000 - so the box did thirteen times the work to serve the same
     * answer, on a machine that is also carrying the live feed. Reading
     * backwards means the sessions that get skipped are the ones that would
     * have been discarded anyway.
     */
    let truncated = false;
    const ordered = [...dates].sort().reverse();
    for (const tradingDate of ordered) {
      if (trades.length >= limit) { truncated = true; break; }
      // Recorded live and backfilled from the raw archive, in that order. A
      // session recorded before the tape existed has only the sidecar; the one
      // in progress has both, meeting at the live tape's first print.
      for (const name of [
        instrumentFileName(upper, upperSymbol),
        backfillFileName(upper, upperSymbol),
      ]) {
        const file = join(this.dir, tradingDate, name);
        if (!existsSync(file)) continue;
        await readArchiveRecords(file, (row) => {
          const trade = decodeTrade(row);
          if (!trade || trade.timestamp < start || trade.timestamp > end) return;
          trades.push(trade);
        });
      }
    }
    trades.sort((left, right) => left.timestamp - right.timestamp);
    const kept = trades.length > limit ? trades.slice(-limit) : trades;
    return {
      exchange: upper,
      symbol: upperSymbol,
      source: "Rithmic recorded trade tape",
      startMs: start,
      endMs: end,
      /*
       * Say so when the window was cut short. A range chart that simply stops
       * part-way through the requested history is indistinguishable from one
       * whose archive genuinely ends there, and the caller needs to be able to
       * tell those apart.
       */
      truncated: truncated || trades.length > limit,
      earliestMs: kept.length ? kept[0].timestamp : null,
      trades: kept,
    };
  }
}
