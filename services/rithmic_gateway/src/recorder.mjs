import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { constants as zlibConstants, createGzip } from "node:zlib";

import { chicagoTradingDate } from "./trading-session.mjs";

// Append-only capture of the live Rithmic stream.
//
// Why raw and not bars: bars can always be derived from the raw stream, and
// the raw stream can never be derived back out of bars. Rithmic's History
// Plant can replay time bars and tick bars, but the SDK contains no
// depth-by-order replay — L3 order-book history cannot be bought back after
// the fact at any price. Every session not recorded is permanently gone.
//
// Throughput matters here. Full L3 on four CME instruments produces thousands
// of messages a second, and writing each one individually saturates the event
// loop and buffers without bound. Records are therefore batched and flushed
// on a timer, and a saturated stream drops with an explicit counted marker
// rather than silently losing data or exhausting memory.

const DEFAULT_FLUSH_MS = 250;
// Headroom for the gzip transform to absorb bursts before the drop guard
// engages. NQ arrives in bursts an order of magnitude above its average, so
// this needs to cover a burst rather than the mean. On a 4 GB box a few
// hundred MB of transient buffer is far cheaper than losing depth messages
// that cannot be re-requested from Rithmic.
const DEFAULT_MAX_PENDING_BYTES = 384 * 1024 * 1024;

function instrumentFileName(exchange, symbol, compress) {
  const base = `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.ndjson`;
  return compress ? `${base}.gz` : base;
}

// The collector emits `instrument: "CME:NQU6"` as a single key on book events
// and explicit exchange/symbol fields on raw wire messages. Accept both.
function resolveInstrument(record) {
  const payload = record.payload || record;
  const exchange = Array.isArray(record.exchange)
    ? record.exchange[0]
    : record.exchange || (Array.isArray(payload.exchange) ? payload.exchange[0] : payload.exchange);
  const symbol = Array.isArray(record.symbol)
    ? record.symbol[0]
    : record.symbol || (Array.isArray(payload.symbol) ? payload.symbol[0] : payload.symbol);
  if (exchange && symbol) {
    return {
      exchange: String(exchange).toUpperCase(),
      symbol: String(symbol).toUpperCase(),
    };
  }
  // The final DBO snapshot packet deliberately omits exchange/symbol and
  // identifies the request through user_msg. Filing those completions under
  // UNKNOWN separated the atomic boundary from the snapshot it completed.
  for (const message of payload.userMsg || []) {
    const match = String(message).match(/^dbo-(?:snapshot|resync):([^:]+):(.+)$/i);
    if (match) {
      return { exchange: match[1].toUpperCase(), symbol: match[2].toUpperCase() };
    }
  }
  const key = String(record.instrument || "");
  const separator = key.indexOf(":");
  if (separator > 0) {
    return {
      exchange: key.slice(0, separator).toUpperCase(),
      symbol: key.slice(separator + 1).toUpperCase(),
    };
  }
  return { exchange: "UNKNOWN", symbol: "UNKNOWN" };
}

// receivedAt arrives as an ISO string; a bare Number() cast yields NaN and
// would silently file every record under the wrong trading date.
function toEpochMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export class MarketDataRecorder {
  constructor(options = {}) {
    this.dir = options.dir || null;
    this.enabled = Boolean(options.enabled && this.dir);
    this.compress = options.compress !== false;
    this.gzipLevel = Number.isFinite(Number(options.gzipLevel)) ? Number(options.gzipLevel) : 1;
    this.flushMs = Number(options.flushMs) > 0 ? Number(options.flushMs) : DEFAULT_FLUSH_MS;
    this.maxPendingBytes = Number(options.maxPendingBytes) > 0
      ? Number(options.maxPendingBytes)
      : DEFAULT_MAX_PENDING_BYTES;
    this.streams = new Map();
    this.buffers = new Map();
    this.counts = new Map();
    this.dropped = new Map();
    this.tradingDate = null;
    this.lastError = null;
    this.detach = null;
    this.flushTimer = null;
    this.startedAt = null;
  }

  status() {
    return {
      enabled: this.enabled,
      dir: this.dir,
      compress: this.compress,
      tradingDate: this.tradingDate,
      startedAt: this.startedAt,
      recorded: Object.fromEntries(this.counts),
      // Non-zero means the disk could not keep up and the loss is known and
      // counted, never silent.
      dropped: Object.fromEntries(this.dropped),
      lastError: this.lastError,
    };
  }

  // Rotation follows the CME trading day (17:00 Chicago), not the calendar
  // day, so an overnight session lands in one file instead of being split
  // across midnight UTC.
  streamFor(exchange, symbol, timestampMs) {
    const tradingDate = chicagoTradingDate(timestampMs);
    if (tradingDate !== this.tradingDate) {
      this.flush();
      this.closeStreams();
      this.tradingDate = tradingDate;
    }
    const key = `${exchange}:${symbol}`;
    const existing = this.streams.get(key);
    if (existing) return existing;

    const dayDir = join(this.dir, tradingDate);
    if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });
    const file = createWriteStream(
      join(dayDir, instrumentFileName(exchange, symbol, this.compress)),
      { flags: "a" },
    );
    file.on("error", (error) => {
      this.lastError = error.message;
    });
    // Raw L3 measured at ~93 GB/day uncompressed across four instruments,
    // which fills a modest VM disk in hours. This text is extremely
    // repetitive and compresses roughly an order of magnitude. Appending
    // produces a multi-member gzip file, which gunzip/zcat read normally.
    let stream = file;
    if (this.compress) {
      // Level 1, not the default 6. Measured on a 2-vCPU box at full L3 on
      // four instruments, level 6 could not keep up and the backpressure
      // guard dropped ~45% of the busiest instrument. This data is hugely
      // repetitive, so level 1 still compresses about an order of magnitude
      // for a fraction of the CPU. Throughput beats ratio: a smaller file
      // with holes in it is worth less than a slightly larger complete one.
      const gzip = createGzip({ level: this.gzipLevel });
      gzip.on("error", (error) => {
        this.lastError = error.message;
      });
      gzip.pipe(file);
      stream = gzip;
    }
    this.streams.set(key, stream);
    return stream;
  }

  write(record) {
    if (!this.enabled) return;
    const { exchange, symbol } = resolveInstrument(record);
    const key = `${exchange}:${symbol}`;
    try {
      const stream = this.streamFor(exchange, symbol, toEpochMs(record.receivedAt));
      // Respect backpressure. If the OS write buffer is already saturated,
      // count the loss instead of growing the heap until the process dies.
      if (stream.writableLength > this.maxPendingBytes) {
        this.dropped.set(key, (this.dropped.get(key) ?? 0) + 1);
        return;
      }
      const buffer = this.buffers.get(key);
      if (buffer) buffer.push(JSON.stringify(record));
      else this.buffers.set(key, [JSON.stringify(record)]);
      this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  // One write per instrument per tick of the flush timer rather than one per
  // message. This is what keeps the event loop responsive enough for /health
  // to answer while several thousand messages a second are arriving.
  flush() {
    if (!this.enabled || !this.buffers.size) return;
    for (const [key, lines] of this.buffers) {
      if (!lines.length) continue;
      const stream = this.streams.get(key);
      if (!stream) continue;
      const dropped = this.dropped.get(key) ?? 0;
      if (dropped && !this.reportedDropped?.get?.(key)) {
        // Surface the discontinuity in the file itself, not only in /health.
        lines.unshift(
          JSON.stringify({
            type: "DROPPED",
            instrument: key,
            droppedMessages: dropped,
            receivedAt: new Date().toISOString(),
            note: "Writer could not keep up. Messages in this interval were not recorded.",
          }),
        );
        this.reportedDropped = this.reportedDropped ?? new Map();
        this.reportedDropped.set(key, dropped);
      }
      stream.write(`${lines.join("\n")}\n`);
      lines.length = 0;
      // Finish the deflate block on every flush. Without this the gzip stream
      // is only decodable once cleanly ended, so a container kill left a
      // truncated member and the next start appended a fresh member behind
      // it — producing "invalid block type" and an archive that could not be
      // read back at all. Sync-flushing costs a little ratio and makes the
      // file readable up to the last flush no matter how the process dies.
      if (this.compress && typeof stream.flush === "function") {
        stream.flush(zlibConstants.Z_SYNC_FLUSH);
      }
    }
  }

  // A disconnect is data loss. It is recorded explicitly on every open
  // instrument file so a later reader sees the discontinuity instead of
  // silently joining two sides of a hole.
  writeGapMarker(reason, timestampMs = Date.now()) {
    if (!this.enabled || !this.streams.size) return;
    for (const key of this.streams.keys()) {
      const [exchange, symbol] = key.split(":");
      const line = JSON.stringify({
        type: "GAP",
        exchange,
        symbol,
        reason,
        receivedAt: timestampMs,
        note: "Stream interrupted. Data between this marker and the next record was not observed.",
      });
      const buffer = this.buffers.get(key);
      if (buffer) buffer.push(line);
      else this.buffers.set(key, [line]);
    }
    this.flush();
  }

  attach(client) {
    if (!this.enabled) return () => {};
    this.startedAt = new Date().toISOString();
    let connected = false;

    // Prefer the decoded wire message: it is the only stream that carries the
    // actual depth and quote values. Fall back to the book-store event for
    // sources that do not emit rawMessage (the RTrader Excel client).
    let sawRawMessage = false;
    const onRawMessage = (record) => {
      sawRawMessage = true;
      this.write(record);
    };
    const onMarketData = (event) => {
      if (sawRawMessage) return;
      this.write(event);
    };
    const onStatus = (health) => {
      if (connected && !health.connected) {
        this.writeGapMarker(health.lastError || "connection lost");
      }
      connected = Boolean(health.connected);
    };

    client.on("rawMessage", onRawMessage);
    client.on("marketData", onMarketData);
    client.on("status", onStatus);
    this.flushTimer = setInterval(() => this.flush(), this.flushMs);
    if (typeof this.flushTimer.unref === "function") this.flushTimer.unref();

    this.detach = () => {
      client.off("rawMessage", onRawMessage);
      client.off("marketData", onMarketData);
      client.off("status", onStatus);
      if (this.flushTimer) clearInterval(this.flushTimer);
      this.flushTimer = null;
    };
    return this.detach;
  }

  // A manifest makes completeness checkable rather than assumed.
  async writeManifest() {
    if (!this.enabled || !this.tradingDate) return;
    const manifest = {
      tradingDate: this.tradingDate,
      writtenAt: new Date().toISOString(),
      provider: "Rithmic",
      note: "Raw decoded Rithmic wire messages, append-only. GAP marks observed disconnects; DROPPED marks writer saturation.",
      recorded: Object.fromEntries(this.counts),
      dropped: Object.fromEntries(this.dropped),
    };
    try {
      await writeFile(
        join(this.dir, this.tradingDate, "manifest.json"),
        JSON.stringify(manifest, null, 2),
        "utf8",
      );
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  closeStreams() {
    for (const stream of this.streams.values()) stream.end();
    this.streams.clear();
    this.buffers.clear();
  }

  async close() {
    if (this.detach) this.detach();
    this.detach = null;
    this.flush();
    await this.writeManifest();
    this.closeStreams();
  }
}
