import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { constants as zlibConstants, createGunzip, createGzip } from "node:zlib";

import { RithmicBookStore } from "./book-store.mjs";

// LIQ MAP session replay from our OWN archive.
//
// The recorder captures every decoded Rithmic wire message — full depth-by-
// order plus trades — per instrument per CME trading day. Rithmic sells no
// depth-by-order history, so this archive is the only replayable copy of the
// book that exists anywhere, and it is already on this disk: replay costs no
// new data.
//
// A day file is far too large to re-walk per request (tens of GB uncompressed
// at full L3), so each completed session is distilled ONCE into a "replay
// pack": the archived events are streamed through a fresh book store exactly
// the way the live collector applies them, and a heatmap-shaped frame is
// captured every PACK_FRAME_MS of MARKET time. Frames are written into
// 30-minute chunk files so the browser can hold a bounded window around the
// replay clock instead of an entire session.

const TEMPLATE_TRADE = 150;
const TEMPLATE_BBO = 151;
const TEMPLATE_ORDER_BOOK = 156;
const TEMPLATE_DEPTH_SNAPSHOT = 116;
const TEMPLATE_DEPTH_SNAPSHOT_END = 161;
const TEMPLATE_DEPTH_UPDATE = 160;

const PACK_VERSION = 2;
const PACK_FRAME_MS = 2_000;
const PACK_DEPTH_LEVELS = 320;
const PACK_TRADE_LIMIT = 256;
const CHUNK_MS = 30 * 60_000;
const PACK_DIR_NAME = "heatmap-replay";

function packDir(archiveDir, tradingDate) {
  return join(archiveDir, PACK_DIR_NAME, tradingDate);
}

function instrumentBase(exchange, symbol) {
  return `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}`;
}

function archiveFileFor(archiveDir, tradingDate, exchange, symbol) {
  const dayDir = join(archiveDir, tradingDate);
  if (!existsSync(dayDir)) return null;
  const base = instrumentBase(exchange, symbol);
  for (const candidate of [`${base}.ndjson.gz`, `${base}.ndjson`]) {
    const path = join(dayDir, candidate);
    if (existsSync(path)) return path;
  }
  return null;
}

// The archive stores concrete contract files (CME-NQU6). Callers usually know
// only the root (NQ). Find the day's file for the root when no exact match.
function resolveArchiveFile(archiveDir, tradingDate, exchange, symbol) {
  const exact = archiveFileFor(archiveDir, tradingDate, exchange, symbol);
  if (exact) return { path: exact, symbol: String(symbol).toUpperCase() };
  const dayDir = join(archiveDir, tradingDate);
  if (!existsSync(dayDir)) return null;
  const wantedExchange = String(exchange).toUpperCase();
  const root = String(symbol).toUpperCase();
  const pattern = new RegExp(`^${wantedExchange}-(${root}[FGHJKMNQUVXZ]\\d{1,2})\\.ndjson(\\.gz)?$`);
  for (const name of readdirSync(dayDir)) {
    const match = pattern.exec(name);
    if (match) return { path: join(dayDir, name), symbol: match[1] };
  }
  return null;
}

// Standalone heatmap frame builder: the same shape the live /v1/heatmap
// endpoints serve (the browser's normalizeLiveSnapshot validates source,
// readOnly and fullDepth), without depending on the live client or config.
function replayFrame(snapshot, tick, after) {
  const bids = snapshot.bids.map((row) => [Math.round(row.price / tick), row.size, row.orders]);
  const asks = snapshot.asks.map((row) => [Math.round(row.price / tick), row.size, row.orders]);
  const trades = snapshot.trades
    .filter((trade) => Number(trade.sequence) > after)
    .slice(-PACK_TRADE_LIMIT)
    .map((trade) => ({
      id: trade.sequence,
      timestamp: trade.timestampMs,
      tick: Math.round(trade.price / tick),
      size: trade.size,
      side: trade.aggressor === "BUY" ? "buy" : "sell",
    }));
  const askVolume = Math.max(0, Number(snapshot.flowTotals?.askVolume) || 0);
  const bidVolume = Math.max(0, Number(snapshot.flowTotals?.bidVolume) || 0);
  let delta = 0;
  let volume = 0;
  for (const trade of trades) {
    volume += trade.size;
    delta += trade.side === "buy" ? trade.size : -trade.size;
  }
  const bestBid = bids[0]?.[0] || 0;
  const bestAsk = asks[0]?.[0] || 0;
  const bidTop = bids[0]?.[1] || 0;
  const askTop = asks[0]?.[1] || 0;
  const topTotal = bidTop + askTop;
  let bidDepth = 0;
  let askDepth = 0;
  let maxDepth = 0;
  for (const row of bids) {
    bidDepth += row[1];
    if (row[1] > maxDepth) maxDepth = row[1];
  }
  for (const row of asks) {
    askDepth += row[1];
    if (row[1] > maxDepth) maxDepth = row[1];
  }
  const depthTotal = bidDepth + askDepth;
  const wallThreshold = maxDepth * 0.6;
  let wallCount = 0;
  if (maxDepth) {
    for (const row of bids) if (row[1] >= wallThreshold) wallCount += 1;
    for (const row of asks) if (row[1] >= wallThreshold) wallCount += 1;
  }
  return {
    status: {
      connected: false,
      replay: true,
      readOnly: true,
      trading: false,
      provider: "Rithmic Archive",
      depthMode: snapshot.depthMode,
      fullDepth: snapshot.fullDepth,
      individualOrders: snapshot.individualOrders,
      contractSymbol: snapshot.symbol,
      bookValid: snapshot.bookValid,
      levels: bids.length + asks.length,
      stale: false,
    },
    snapshot: {
      id: snapshot.sequence,
      timestamp: snapshot.asOfMs,
      root: snapshot.symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, ""),
      contractSymbol: snapshot.symbol,
      tickSize: tick,
      bids,
      asks,
      bestBid,
      bestAsk,
      midTick: bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0,
      lastTick: snapshot.lastPrice ? Math.round(snapshot.lastPrice / tick) : 0,
      trades,
      cvd: askVolume - bidVolume,
      delta,
      volume,
      totalVolume: askVolume + bidVolume,
      imbalance: {
        bid: bidDepth,
        ask: askDepth,
        ratio: depthTotal ? bidDepth / depthTotal : 0.5,
      },
      microTick: topTotal
        ? (bestAsk * bidTop + bestBid * askTop) / topTotal
        : (bestBid + bestAsk) / 2,
      maxDepth,
      wallCount,
      tradeRate: trades.length,
      sweepScore: 0,
      absorptionScore: 0,
      changeTicks: 0,
      eventsSince: Math.max(1, snapshot.sequence - after),
      source: "rithmic-depth-by-order",
      fullDepth: snapshot.fullDepth,
      individualOrders: snapshot.individualOrders,
      bookValid: snapshot.bookValid,
      orderCount: snapshot.orderCount,
      latencyMs: 0,
      readOnly: true,
    },
  };
}

export class HeatmapReplayStore {
  constructor({ dir, tickSizeFor, log = () => {} }) {
    this.dir = dir || null;
    this.tickSizeFor = tickSizeFor;
    this.log = log;
    // Single-flight per (date, instrument): one build at a time, callers
    // observe progress rather than starting duplicate multi-minute walks.
    this.builds = new Map();
  }

  #manifestPath(tradingDate, exchange, symbol) {
    return join(packDir(this.dir, tradingDate), `${instrumentBase(exchange, symbol)}.manifest.json`);
  }

  async readManifest(tradingDate, exchange, symbol) {
    try {
      const raw = await readFile(this.#manifestPath(tradingDate, exchange, symbol), "utf8");
      const manifest = JSON.parse(raw);
      return manifest?.version === PACK_VERSION ? manifest : null;
    } catch {
      return null;
    }
  }

  buildStatus(tradingDate, exchange, symbol) {
    const build = this.builds.get(`${tradingDate}:${instrumentBase(exchange, symbol)}`);
    return build ? { building: true, ...build.progress } : null;
  }

  /**
   * Return the manifest when the pack exists; otherwise start (or observe) a
   * background build. The response tells the caller exactly which state it is
   * in — never a fabricated empty session.
   */
  async manifestOrBuild(tradingDate, exchange, symbol) {
    if (!this.dir) return { error: "The collector has no archive directory configured." };
    const manifest = await this.readManifest(tradingDate, exchange, symbol);
    if (manifest) return { manifest };
    const inFlight = this.buildStatus(tradingDate, exchange, symbol);
    if (inFlight) return inFlight;
    const archive = resolveArchiveFile(this.dir, tradingDate, exchange, symbol);
    if (!archive) {
      return { error: `No recorded session archive for ${exchange}:${symbol} on ${tradingDate}.` };
    }
    const key = `${tradingDate}:${instrumentBase(exchange, symbol)}`;
    const build = { progress: { events: 0, frames: 0 } };
    this.builds.set(key, build);
    build.promise = this.#buildPack(tradingDate, exchange, symbol, archive, build.progress)
      .catch((error) => {
        this.log(`[heatmap-replay] build failed for ${key}: ${error?.message || error}`);
      })
      .finally(() => {
        this.builds.delete(key);
      });
    return { building: true, ...build.progress };
  }

  async readChunk(tradingDate, exchange, symbol, chunkStartMs) {
    const manifest = await this.readManifest(tradingDate, exchange, symbol);
    if (!manifest) return null;
    const chunk = manifest.chunks.find((row) => Number(row.startMs) === Number(chunkStartMs));
    if (!chunk) return null;
    const path = join(packDir(this.dir, tradingDate), chunk.file);
    if (!existsSync(path)) return null;
    const frames = [];
    const input = createReadStream(path).pipe(createGunzip());
    const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
    for await (const line of lines) {
      if (!line) continue;
      try {
        frames.push(JSON.parse(line));
      } catch {
        // A torn trailing line only loses that single frame.
      }
    }
    return { manifest: { frameMs: manifest.frameMs, tickSize: manifest.tickSize }, chunk, frames };
  }

  async #buildPack(tradingDate, exchange, symbol, archive, progress) {
    const startedAt = Date.now();
    const dir = packDir(this.dir, tradingDate);
    mkdirSync(dir, { recursive: true });
    const base = instrumentBase(exchange, symbol);
    const tick = this.tickSizeFor(archive.symbol);
    const book = new RithmicBookStore({ maxTrades: 4_096 });

    const chunks = [];
    let currentChunk = null;
    let gaps = 0;
    let lastFrameMarketMs = 0;
    let lastFrameSequence = 0;

    const openChunk = (frameTimestamp) => {
      const startMs = Math.floor(frameTimestamp / CHUNK_MS) * CHUNK_MS;
      const file = `${base}.chunk-${startMs}.ndjson.gz`;
      const gzip = createGzip({ level: 6 });
      gzip.pipe(createWriteStream(join(dir, `${file}.partial`)));
      currentChunk = { startMs, endMs: startMs + CHUNK_MS, file, frames: 0, stream: gzip };
      return currentChunk;
    };
    const closeChunk = async () => {
      if (!currentChunk) return;
      const { stream, file, ...meta } = currentChunk;
      await new Promise((resolve) => {
        stream.end(() => resolve());
      });
      await rename(join(dir, `${file}.partial`), join(dir, file));
      chunks.push({ ...meta, file });
      currentChunk = null;
    };

    const captureFrame = async (marketMs) => {
      const snapshot = book.snapshot(archive.exchange || exchange, archive.symbol, PACK_DEPTH_LEVELS, {
        afterSequence: lastFrameSequence,
        tradeLimit: PACK_TRADE_LIMIT,
      });
      if (!snapshot || !snapshot.bookValid) return;
      // A one-sided ladder mid-build is not a market state worth replaying.
      if (!snapshot.bids.length || !snapshot.asks.length) return;
      const frame = replayFrame(snapshot, tick, lastFrameSequence);
      // Archive frames carry market time; never wall-clock at build time.
      frame.snapshot.timestamp = marketMs;
      lastFrameSequence = Number(snapshot.sequence) || lastFrameSequence;
      if (!currentChunk || marketMs >= currentChunk.endMs) {
        await closeChunk();
        openChunk(marketMs);
      }
      currentChunk.stream.write(`${JSON.stringify(frame)}\n`);
      if (typeof currentChunk.stream.flush === "function" && currentChunk.frames % 64 === 0) {
        currentChunk.stream.flush(zlibConstants.Z_SYNC_FLUSH);
      }
      currentChunk.frames += 1;
      progress.frames += 1;
    };

    const input = archive.path.endsWith(".gz")
      ? createReadStream(archive.path).pipe(createGunzip())
      : createReadStream(archive.path);
    const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
    try {
      for await (const line of lines) {
        if (!line) continue;
        let record;
        try {
          record = JSON.parse(line);
        } catch {
          continue;
        }
        if (record.type === "GAP" || record.type === "DROPPED") {
          gaps += 1;
          continue;
        }
        const payload = record.payload;
        if (!payload) continue;
        switch (record.templateId) {
          case TEMPLATE_TRADE: book.applyTrade(payload); break;
          case TEMPLATE_BBO: book.applyBbo(payload); break;
          case TEMPLATE_ORDER_BOOK: book.applyOrderBook(payload); break;
          case TEMPLATE_DEPTH_SNAPSHOT:
          case TEMPLATE_DEPTH_SNAPSHOT_END: book.applyDepthSnapshot(payload); break;
          case TEMPLATE_DEPTH_UPDATE: book.applyDepthUpdate(payload); break;
          default: continue;
        }
        progress.events += 1;
        // Never snapshot the book just to read the clock — that sorts the
        // whole ladder per event. The wire payload carries the exchange time.
        const seconds = Number(payload.sourceSsboe ?? payload.ssboe ?? 0);
        const micros = Number(payload.sourceUsecs ?? payload.usecs ?? 0);
        const marketMs = seconds > 0 ? seconds * 1_000 + Math.floor(micros / 1_000) : 0;
        if (marketMs > 0) {
          // Seed the frame clock on the first stamped event; capturing there
          // would freeze a half-built book into the pack's opening column.
          if (lastFrameMarketMs === 0) lastFrameMarketMs = marketMs;
          else if (marketMs - lastFrameMarketMs >= PACK_FRAME_MS) {
            lastFrameMarketMs = marketMs;
            await captureFrame(marketMs);
          }
        }
      }
    } catch (error) {
      // A live (still-writing) or damaged archive decodes up to its last sync
      // flush; keep every frame captured before the tail.
      if (!/unexpected end of file/i.test(String(error?.message ?? ""))) throw error;
    }
    await closeChunk();

    const manifest = {
      version: PACK_VERSION,
      tradingDate,
      exchange: String(exchange).toUpperCase(),
      root: String(symbol).toUpperCase(),
      contractSymbol: archive.symbol,
      tickSize: tick,
      frameMs: PACK_FRAME_MS,
      depthLevels: PACK_DEPTH_LEVELS,
      builtAt: new Date().toISOString(),
      buildMs: Date.now() - startedAt,
      events: progress.events,
      frames: progress.frames,
      gaps,
      startMs: chunks[0]?.startMs ?? null,
      endMs: chunks.at(-1)?.endMs ?? null,
      chunks: chunks.map(({ startMs, endMs, frames, file }) => ({ startMs, endMs, frames, file })),
    };
    await writeFile(this.#manifestPath(tradingDate, exchange, symbol), JSON.stringify(manifest), "utf8");
    this.log(
      `[heatmap-replay] built ${base} ${tradingDate}: ${progress.frames} frames from ${progress.events} events in ${Math.round((Date.now() - startedAt) / 1_000)}s${gaps ? ` (${gaps} gap/drop markers)` : ""}`,
    );
    return manifest;
  }
}
