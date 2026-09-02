import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createGzip } from "node:zlib";
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
 * disk is the binding constraint. Event bars are a futures chart type and are
 * used on the majors, so those are what earn the space.
 */
export const DEFAULT_TAPE_ROOTS = ["NQ", "ES"];

const sideCode = (payload) => {
  const aggressor = String(payload?.aggressor ?? payload?.side ?? "").toUpperCase();
  if (aggressor.startsWith("B") || aggressor === "ASK") return 1;
  if (aggressor.startsWith("S") || aggressor === "BID") return -1;
  return 0;
};

/** [timestamp, price, size, side] - the four fields a bar builder needs. */
export const encodeTrade = (trade, side) => [trade.timestamp, trade.price, trade.size, side];

export const decodeTrade = (row) => (Array.isArray(row)
  ? { timestamp: row[0], price: row[1], size: row[2], side: row[3] ?? 0 }
  : null);

function instrumentFileName(exchange, symbol) {
  return `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.trades.ndjson.gz`;
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
    const dates = new Set([chicagoTradingDate(start), chicagoTradingDate(end)]);
    for (const tradingDate of [...dates].sort()) {
      const file = join(this.dir, tradingDate, instrumentFileName(upper, upperSymbol));
      if (!existsSync(file)) continue;
      await readArchiveRecords(file, (row) => {
        const trade = decodeTrade(row);
        if (!trade || trade.timestamp < start || trade.timestamp > end) return;
        trades.push(trade);
      });
    }
    trades.sort((left, right) => left.timestamp - right.timestamp);
    return {
      exchange: upper,
      symbol: upperSymbol,
      source: "Rithmic recorded trade tape",
      startMs: start,
      endMs: end,
      trades: trades.length > limit ? trades.slice(-limit) : trades,
    };
  }
}
