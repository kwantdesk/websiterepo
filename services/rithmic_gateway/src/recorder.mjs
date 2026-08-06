import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chicagoTradingDate } from "./trading-session.mjs";

// Append-only capture of the live Rithmic stream.
//
// Why raw and not bars: bars can always be derived from the raw stream, and
// the raw stream can never be derived back out of bars. Rithmic's History
// Plant can replay time bars and tick bars, but the SDK contains no
// depth-by-order replay — L3 order-book history cannot be bought back after
// the fact at any price. Every session not recorded is permanently gone.
//
// Integrity rules, matching the desk's: a gap is written down as a gap. The
// recorder never interpolates across a disconnect and never lets a reader
// assume continuity it did not observe.

function instrumentFileName(exchange, symbol) {
  return `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.ndjson`;
}

export class MarketDataRecorder {
  constructor(options = {}) {
    this.dir = options.dir || null;
    this.enabled = Boolean(options.enabled && this.dir);
    this.streams = new Map();
    this.counts = new Map();
    this.tradingDate = null;
    this.lastError = null;
    this.detach = null;
    this.startedAt = null;
  }

  status() {
    return {
      enabled: this.enabled,
      dir: this.dir,
      tradingDate: this.tradingDate,
      startedAt: this.startedAt,
      recorded: Object.fromEntries(this.counts),
      lastError: this.lastError,
    };
  }

  // Rotation follows the CME trading day (17:00 Chicago), not the calendar
  // day, so an overnight session lands in one file instead of being split
  // across midnight UTC.
  streamFor(exchange, symbol, timestampMs) {
    const tradingDate = chicagoTradingDate(timestampMs);
    if (tradingDate !== this.tradingDate) {
      this.closeStreams();
      this.tradingDate = tradingDate;
    }
    const key = `${exchange}:${symbol}`;
    const existing = this.streams.get(key);
    if (existing) return existing;

    const dayDir = join(this.dir, tradingDate);
    if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });
    const stream = createWriteStream(join(dayDir, instrumentFileName(exchange, symbol)), {
      flags: "a",
    });
    stream.on("error", (error) => {
      this.lastError = error.message;
    });
    this.streams.set(key, stream);
    return stream;
  }

  write(record) {
    if (!this.enabled) return;
    const exchange = record.exchange || "UNKNOWN";
    const symbol = record.symbol || "UNKNOWN";
    const timestampMs = Number(record.receivedAt) || Date.now();
    try {
      const stream = this.streamFor(exchange, symbol, timestampMs);
      stream.write(`${JSON.stringify(record)}\n`);
      const key = `${exchange}:${symbol}`;
      this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  // A disconnect is data loss. It is recorded explicitly on every open
  // instrument file so a later reader sees the discontinuity instead of
  // silently joining two sides of a hole.
  writeGapMarker(reason, timestampMs = Date.now()) {
    if (!this.enabled || !this.streams.size) return;
    for (const [key, stream] of this.streams) {
      const [exchange, symbol] = key.split(":");
      stream.write(
        `${JSON.stringify({
          type: "GAP",
          exchange,
          symbol,
          reason,
          receivedAt: timestampMs,
          note: "Stream interrupted. Data between this marker and the next record was not observed.",
        })}\n`,
      );
    }
  }

  attach(client) {
    if (!this.enabled) return () => {};
    this.startedAt = new Date().toISOString();
    let connected = false;

    const onMarketData = (event) => this.write(event);
    const onStatus = (health) => {
      // Only the transition matters; status fires on every heartbeat.
      if (connected && !health.connected) {
        this.writeGapMarker(health.lastError || "connection lost");
      }
      connected = Boolean(health.connected);
    };

    client.on("marketData", onMarketData);
    client.on("status", onStatus);
    this.detach = () => {
      client.off("marketData", onMarketData);
      client.off("status", onStatus);
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
      note: "Raw normalized Rithmic stream, append-only. GAP records mark observed discontinuities.",
      recorded: Object.fromEntries(this.counts),
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
  }

  async close() {
    if (this.detach) this.detach();
    this.detach = null;
    await this.writeManifest();
    this.closeStreams();
  }
}
