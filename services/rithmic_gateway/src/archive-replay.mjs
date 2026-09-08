import { createReadStream, existsSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { createGunzip } from "node:zlib";

import { readArchiveRecords } from "./archive-reader.mjs";
import { decodeTrade } from "./trade-tape-archive.mjs";
import { chicagoTradingDate } from "./trading-session.mjs";

// Rebuild the session from our own archive on startup.
//
// The volume profile, big trades and the effort indicators are all computed
// from the collector's in-memory trade tape, which starts empty on every
// process start. Without this, a restart at 14:00 leaves the profile holding
// twenty minutes of tape and rendering as a near-flat block, because a
// hundred levels each holding single-digit volume have no shape. Rithmic has
// no depth-by-order replay to recover it from, but we recorded it ourselves,
// so read it back.
//
// Only trades are replayed. The depth book is deliberately not restored: a
// resting order book from before a restart is stale by definition, and the
// live snapshot rebuilds it within seconds. Trades are historical facts and
// stay true.

const TRADE_TEMPLATE_ID = 150;
const COMPACT_TRADE_FILE = /^([A-Z0-9]+)-(.+)\.trades(?:\.backfill)?\.ndjson(?:\.gz)?$/;

function tradeFilesFor(dir, tradingDate) {
  const dayDir = join(dir, tradingDate);
  if (!existsSync(dayDir)) return [];
  return readdirSync(dayDir)
    .filter((name) => name.endsWith(".ndjson") || name.endsWith(".ndjson.gz"))
    .filter((name) => !name.startsWith("UNKNOWN-"))
    .map((name) => join(dayDir, name));
}

async function replayFile(path, book) {
  let replayed = 0;
  let skipped = 0;
  let truncated = false;
  const input = path.endsWith(".gz")
    ? createReadStream(path).pipe(createGunzip())
    : createReadStream(path);
  // Streamed line by line: a session file is large enough that reading it
  // whole would spike memory at exactly the moment the process is starting.
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of lines) {
      if (!line) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        // A partially written trailing line is expected after an unclean stop.
        skipped += 1;
        continue;
      }
      // GAP and DROPPED markers are integrity records, not market data.
      if (record.templateId !== TRADE_TEMPLATE_ID || !record.payload) continue;
      try {
        if (book.applyTrade(record.payload)) replayed += 1;
      } catch {
        skipped += 1;
      }
    }
  } catch (error) {
    // A live archive is an unterminated gzip stream: it decodes correctly up
    // to the last sync-flush and then reports "unexpected end of file". That
    // is the normal state of a file still being written, not a failure — and
    // for a genuinely damaged file it still recovers everything readable
    // before the damage. Keep what was replayed and record that the tail was
    // unreadable rather than discarding a whole session.
    truncated = true;
    if (!/unexpected end of file/i.test(String(error?.message ?? ""))) {
      skipped += 1;
    }
  }
  return { replayed, skipped, truncated };
}

export async function replayArchiveIntoBook(args) {
  const { dir, book, now = Date.now(), log = () => {} } = args;
  if (!dir || !existsSync(dir)) {
    return { tradingDate: null, files: 0, replayed: 0, skipped: 0, reason: "no archive directory" };
  }
  const tradingDate = chicagoTradingDate(now);
  const files = tradeFilesFor(dir, tradingDate);
  if (!files.length) {
    return { tradingDate, files: 0, replayed: 0, skipped: 0, reason: "no recording for this session yet" };
  }

  let replayed = 0;
  let skipped = 0;
  for (const path of files) {
    try {
      const result = await replayFile(path, book);
      replayed += result.replayed;
      skipped += result.skipped;
      log(
        `[replay] ${path.split(/[\\/]/).pop()}: ${result.replayed} trades`
          + (result.truncated ? " (tail unreadable - recovered what was flushed)" : ""),
      );
    } catch (error) {
      // A corrupt file must not stop the collector from starting.
      log(`[replay] ${path}: FAILED ${error instanceof Error ? error.message : error}`);
    }
  }
  return { tradingDate, files: files.length, replayed, skipped, reason: null };
}

/**
 * Restore the live execution ring from the compact trade tape.
 *
 * The raw L3 session is deliberately not a startup source. A normal session
 * is multiple gigabytes and mostly depth messages; scanning it on the gateway
 * event loop made /health and every vendor proxy stop responding for minutes.
 * The compact tape contains the exact same prints in four fields and is about
 * one hundredth of the size, so restoring it preserves the data without
 * taking the live desk down.
 */
export async function replayCompactTradeTapeIntoBook(args) {
  const { dir, book, now = Date.now(), log = () => {} } = args;
  const tradingDate = chicagoTradingDate(now);
  const dayDir = join(String(dir || ""), "trades", tradingDate);
  if (!dir || !existsSync(dayDir)) {
    return {
      tradingDate,
      files: 0,
      replayed: 0,
      skipped: 0,
      reason: "no compact trade tape for this session yet",
    };
  }

  const files = readdirSync(dayDir)
    .filter((name) => COMPACT_TRADE_FILE.test(name))
    // Backfill is older than the live tape by construction.
    .sort((left, right) => Number(right.includes(".backfill.")) - Number(left.includes(".backfill.")));
  if (!files.length) {
    return {
      tradingDate,
      files: 0,
      replayed: 0,
      skipped: 0,
      reason: "no compact trade tape for this session yet",
    };
  }

  const byInstrument = new Map();
  let skipped = 0;
  for (const name of files) {
    const match = name.match(COMPACT_TRADE_FILE);
    if (!match) continue;
    const [, exchange, symbol] = match;
    const key = `${exchange}:${symbol}`;
    const entry = byInstrument.get(key) || { exchange, symbol, trades: [] };
    byInstrument.set(key, entry);
    const summary = await readArchiveRecords(join(dayDir, name), (row) => {
      const trade = decodeTrade(row);
      if (!trade || !Number.isFinite(Number(trade.timestamp)) || !Number.isFinite(Number(trade.price))
        || !Number.isFinite(Number(trade.size)) || Number(trade.size) <= 0) {
        skipped += 1;
        return;
      }
      entry.trades.push(trade);
      // Bound memory while reading an unusually busy contract. Trimming in a
      // batch avoids Array.shift/splice on every print after the cap.
      if (entry.trades.length > book.maxTrades + 4_096) {
        entry.trades.splice(0, entry.trades.length - book.maxTrades);
      }
    });
    skipped += summary.malformed;
    log(`[replay] ${name}: ${summary.records} compact trades${summary.breaks ? ` (${summary.breaks} damaged member(s) recovered)` : ""}`);
  }

  let replayed = 0;
  for (const entry of byInstrument.values()) {
    const trades = entry.trades
      .sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
      .slice(-book.maxTrades);
    for (const trade of trades) {
      const timestamp = Number(trade.timestamp);
      if (book.applyTrade({
        exchange: entry.exchange,
        symbol: entry.symbol,
        tradePrice: Number(trade.price),
        tradeSize: Number(trade.size),
        aggressor: Number(trade.side) > 0 ? 1 : Number(trade.side) < 0 ? 2 : 0,
        ssboe: Math.floor(timestamp / 1_000),
        usecs: (timestamp % 1_000) * 1_000,
      })) replayed += 1;
    }
  }

  return { tradingDate, files: files.length, replayed, skipped, reason: null };
}
