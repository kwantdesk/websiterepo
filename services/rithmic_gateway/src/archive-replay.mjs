import { createReadStream, existsSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { createGunzip } from "node:zlib";

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
