import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { constants as zlibConstants, createGzip } from "node:zlib";

import { chicagoTradingDate } from "./trading-session.mjs";

// Durable capture of the options exposure surfaces.
//
// Futures already have a permanent archive: the recorder writes raw L3 to disk
// and every futures study can be rebuilt from it. Options had nothing. Every
// GEX surface — Map, Cal, VUE, BOX, the Gamma page — fetches from the provider
// on demand, holds it in a short cache, and then it is gone. There is exactly
// one durable options writer in the product and it stores order flow, not
// exposure. So gamma history did not accumulate at all: yesterday's surface
// could not be drawn today at any price, because the provider serves the live
// surface and nothing kept a copy.
//
// This sits on the provider boundary rather than in any one feature. Every
// exposure request in the product passes through the vendor edge, so one
// writer here archives Map, Cal, VUE, BOX and Gamma at once, and a surface
// added later is captured without touching this file.
//
// Why the whole payload and not parsed greeks: the same reasoning as the raw
// L3 tape. Exposure can always be derived from the provider's response; the
// response cannot be derived back out of a derived number. A field we do not
// read today is one we would otherwise have thrown away.

const DEFAULT_FLUSH_MS = 1_000;
// Exposure payloads are large (the gamma heatmap surface measured ~8.4 MB) and
// arrive far less often than raw ticks, so the pending ceiling is a fraction of
// the recorder's. Blowing through this means the disk cannot keep up, which is
// counted rather than silently dropped.
const DEFAULT_MAX_PENDING_BYTES = 64 * 1024 * 1024;
// A payload identical to the one already on disk carries no information. The
// desk polls these surfaces every 15-30s per pane while the provider updates
// them roughly once a minute, so the same bytes arrive many times over. Keeping
// the last hash per request and appending only on change is what makes a month
// of gamma affordable — without it this archive is mostly duplicates.
const DEFAULT_MAX_TRACKED_KEYS = 4_000;

// `/v1/options/exposure-by-strike` -> `options-exposure-by-strike`, so one file
// per surface per trading date. Anything unexpected in a path is flattened
// rather than trusted: this string becomes a filename.
export function endpointSlug(path) {
  const cleaned = String(path || "")
    .replace(/^\/+/, "")
    .replace(/^v\d+\//, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return cleaned || "unknown";
}

// The request is what makes a payload meaningful — the same endpoint serves
// SPX and NDX. Hashing it keeps the dedupe key bounded regardless of body size.
export function requestKey(path, requestBody) {
  return createHash("sha1")
    .update(String(path || ""))
    .update("\n")
    .update(requestBody ?? "")
    .digest("hex");
}

export class ExposureArchiver {
  constructor(options = {}) {
    this.dir = options.dir ? join(options.dir, "exposure") : null;
    this.enabled = Boolean(options.enabled && this.dir);
    this.compress = options.compress !== false;
    this.gzipLevel = Number.isFinite(Number(options.gzipLevel)) ? Number(options.gzipLevel) : 1;
    this.flushMs = Number(options.flushMs) > 0 ? Number(options.flushMs) : DEFAULT_FLUSH_MS;
    this.maxPendingBytes = Number(options.maxPendingBytes) > 0
      ? Number(options.maxPendingBytes)
      : DEFAULT_MAX_PENDING_BYTES;
    this.maxTrackedKeys = Number(options.maxTrackedKeys) > 0
      ? Number(options.maxTrackedKeys)
      : DEFAULT_MAX_TRACKED_KEYS;
    this.streams = new Map();
    // The gzip head is what we write to, but the FILE is what has to be on
    // disk before a shutdown can be called finished. Ending the head resolves
    // long before the bytes land, so both are tracked.
    this.files = new Map();
    this.buffers = new Map();
    this.counts = new Map();
    this.skipped = new Map();
    this.dropped = new Map();
    this.lastHashes = new Map();
    this.tradingDate = null;
    this.lastError = null;
    this.lastArchivedAt = null;
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
      lastArchivedAt: this.lastArchivedAt,
      // Frames actually written, per surface.
      archived: Object.fromEntries(this.counts),
      // Unchanged repeats that were correctly not written. A healthy ratio is
      // heavily skewed to skipped; archived climbing as fast as requests means
      // the dedupe is not matching and the archive is filling with duplicates.
      skipped: Object.fromEntries(this.skipped),
      // Non-zero means the disk could not keep up. Known and counted.
      dropped: Object.fromEntries(this.dropped),
      lastError: this.lastError,
    };
  }

  // Rotation has to happen BEFORE the dedupe check, not inside the stream
  // lookup that follows it: a surface that has not moved since yesterday would
  // otherwise match the retained hash, be skipped, and never reach the code
  // that turns the day over — so the new session would open with a hole in the
  // one frame a replay most needs.
  rollTradingDate(timestampMs) {
    // The rest of the archive rotates on the CME trading date and replay reads
    // it that way, so this matches rather than inventing a second convention.
    // 17:00 Chicago is after the cash close, so a New York options session
    // stays whole inside one file.
    const tradingDate = chicagoTradingDate(timestampMs);
    if (tradingDate === this.tradingDate) return;
    this.flush();
    this.closeStreams();
    this.tradingDate = tradingDate;
    this.lastHashes.clear();
  }

  streamFor(slug) {
    const existing = this.streams.get(slug);
    if (existing) return existing;

    const dayDir = join(this.dir, this.tradingDate);
    if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });
    const file = createWriteStream(
      join(dayDir, this.compress ? `${slug}.ndjson.gz` : `${slug}.ndjson`),
      { flags: "a" },
    );
    file.on("error", (error) => {
      this.lastError = error.message;
    });
    let stream = file;
    if (this.compress) {
      // Level 1 for the same reason as the tape: these payloads are highly
      // repetitive JSON, so the cheap level still compresses hard, and CPU on
      // this box belongs to the collector.
      const gzip = createGzip({ level: this.gzipLevel });
      gzip.on("error", (error) => {
        this.lastError = error.message;
      });
      gzip.pipe(file);
      stream = gzip;
    }
    this.streams.set(slug, stream);
    this.files.set(slug, file);
    return stream;
  }

  /**
   * Archive one provider response. Returns true when a frame was written and
   * false when it was an unchanged repeat, so callers can be tested on the
   * dedupe rather than on the side effect.
   */
  archive({ path, requestBody, payload, receivedAtMs = Date.now() }) {
    if (!this.enabled) return false;
    if (!payload || payload.length === 0) return false;

    this.rollTradingDate(receivedAtMs);

    const key = requestKey(path, requestBody);
    const hash = createHash("sha1").update(payload).digest("hex");
    const slug = endpointSlug(path);

    if (this.lastHashes.get(key) === hash) {
      this.skipped.set(slug, (this.skipped.get(slug) || 0) + 1);
      return false;
    }

    try {
      // Opens the day's file. The batch itself is written by flush(), which
      // looks the stream up again.
      this.streamFor(slug);
      const buffer = this.buffers.get(slug) || [];
      if (!this.buffers.has(slug)) this.buffers.set(slug, buffer);

      const line = JSON.stringify({
        ts: receivedAtMs,
        path,
        // Kept verbatim so a replay knows which symbol/expiry/greek this frame
        // answers without having to guess from the payload's shape.
        request: safeJson(requestBody),
        sha1: hash,
        payload: safeJson(payload),
      });

      const pending = buffer.reduce((total, entry) => total + entry.length, 0);
      if (pending + line.length > this.maxPendingBytes) {
        this.dropped.set(slug, (this.dropped.get(slug) || 0) + 1);
        return false;
      }

      buffer.push(line);
      // Only after a successful buffer: recording the hash first would skip the
      // retry of a frame that never reached the disk.
      this.lastHashes.set(key, hash);
      if (this.lastHashes.size > this.maxTrackedKeys) {
        // Oldest insertion first — a key that has not been seen in a long time
        // is the cheapest one to forget, and forgetting it costs one duplicate.
        const oldest = this.lastHashes.keys().next().value;
        this.lastHashes.delete(oldest);
      }
      this.counts.set(slug, (this.counts.get(slug) || 0) + 1);
      this.lastArchivedAt = new Date(receivedAtMs).toISOString();
      return true;
    } catch (error) {
      this.lastError = error.message;
      return false;
    }
  }

  flush() {
    for (const [slug, buffer] of this.buffers) {
      if (!buffer.length) continue;
      const stream = this.streams.get(slug);
      if (!stream) continue;
      const chunk = `${buffer.join("\n")}\n`;
      buffer.length = 0;
      try {
        stream.write(chunk);
        // Sync-flush each batch so a killed process loses at most the current
        // batch rather than the whole gzip window. Same trade the tape makes.
        if (this.compress) stream.flush(zlibConstants.Z_SYNC_FLUSH);
      } catch (error) {
        this.lastError = error.message;
      }
    }
  }

  // Resolves once every file has actually closed. Callers that need the
  // archive to be complete on disk — a graceful shutdown, or a test reading
  // back what it wrote — must await this; ending a stream only starts the work.
  closeStreams() {
    const closing = [];
    for (const [slug, stream] of this.streams) {
      const file = this.files.get(slug);
      closing.push(new Promise((resolve) => {
        const done = () => resolve();
        if (file) {
          file.once("close", done);
          file.once("error", done);
        } else {
          done();
        }
        try {
          stream.end();
        } catch (error) {
          this.lastError = error.message;
          done();
        }
      }));
    }
    this.streams.clear();
    this.files.clear();
    this.buffers.clear();
    return Promise.all(closing);
  }

  start() {
    if (!this.enabled || this.flushTimer) return;
    this.startedAt = new Date().toISOString();
    this.flushTimer = setInterval(() => this.flush(), this.flushMs);
    this.flushTimer.unref?.();
  }

  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
    return this.closeStreams();
  }
}

// Payloads arrive as Buffers of provider JSON. Storing the parsed object keeps
// the archive one self-describing NDJSON line per frame; a payload that is not
// JSON is kept as text rather than dropped, because an unreadable frame is
// still evidence of what the provider said.
function safeJson(value) {
  if (value == null) return null;
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
