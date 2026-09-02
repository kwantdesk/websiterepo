#!/usr/bin/env node
/**
 * Extract the compact trade tape for sessions recorded before the tape existed.
 *
 * Range, volume, renko and tick bars are built from individual prints, so they
 * cannot be derived from the minute-bar archive at any resolution: a 40-range
 * bar closes when price has travelled forty ticks, and the path taken WITHIN a
 * minute is exactly what an OHLC minute throws away. Those prints are in the
 * raw recorder archive, but a 2.2 GB session that takes ~200 seconds to scan is
 * not something a chart request can wait on - hence the compact tape, and hence
 * this, to fill in the sessions that predate it.
 *
 * Writes a sidecar beside the live tape, which the loader reads as one series.
 * The sidecar stops at the live tape's first print, so the two are exactly
 * complementary - and a backfill can therefore run against the session in
 * progress without stopping the collector.
 *
 *   node scripts/backfill-trade-tape.mjs [--dir /recordings] [--date 2026-09-01]
 *                                        [--days 7] [--dry] [--redo]
 *
 * Run it niced. A cold scan of these files pegged a core and took the whole
 * gateway down once already:
 *
 *   nice -n 19 ionice -c 3 node scripts/backfill-trade-tape.mjs --days 7
 */
import { createWriteStream, existsSync, readdirSync, mkdirSync } from "node:fs";
import { rename, unlink } from "node:fs/promises";
import { constants as zlibConstants, createGzip } from "node:zlib";
import { join } from "node:path";

import { readArchiveRecords } from "../src/archive-reader.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";
import { tradeFromRecord } from "../src/futures-bar-archive.mjs";
import {
  DEFAULT_TAPE_ROOTS, backfillFileName, decodeTrade, encodeTrade, instrumentFileName, sideCode,
} from "../src/trade-tape-archive.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const ROOT = flag("dir", "/recordings");
const ONLY_DATE = flag("date");
const DAYS = Number(flag("days", "7"));
const DRY = args.includes("--dry");
const REDO = args.includes("--redo");
// Level 1, like the live tape: throughput beats ratio when the alternative is
// a hole, and this already competes with the collector for the same core.
const GZIP_LEVEL = 1;

const roots = DEFAULT_TAPE_ROOTS.map((root) => root.toUpperCase());
const wanted = (symbol) => roots.some((root) => String(symbol).toUpperCase().startsWith(root));

/**
 * The live tape's earliest print, or null if there is no live tape yet.
 *
 * The backfill stops here. Everything before it is missing from the live tape
 * - the collector only starts recording when it starts - and everything from
 * here on it already has, so a cut at this timestamp makes the two files
 * exactly complementary without needing to dedupe prints that legitimately
 * repeat at the same price, size and millisecond.
 */
async function liveTapeStart(file) {
  if (!existsSync(file)) return null;
  let earliest = null;
  await readArchiveRecords(file, (row) => {
    const trade = decodeTrade(row);
    if (!trade) return;
    if (earliest === null || trade.timestamp < earliest) earliest = trade.timestamp;
  });
  return earliest;
}

async function writeTape(file, rows) {
  const temporary = `${file}.tmp`;
  await new Promise((resolve, reject) => {
    const out = createWriteStream(temporary);
    const gzip = createGzip({ level: GZIP_LEVEL });
    gzip.on("error", reject);
    out.on("error", reject);
    out.on("close", resolve);
    gzip.pipe(out);
    // In batches, so a session's worth of prints is never one giant string.
    for (let index = 0; index < rows.length; index += 10_000) {
      gzip.write(`${rows.slice(index, index + 10_000).join("\n")}\n`);
    }
    gzip.flush(zlibConstants.Z_SYNC_FLUSH);
    gzip.end();
  });
  await rename(temporary, file);
}

async function backfillFile(tradingDate, name) {
  const match = name.match(/^([A-Z0-9]+)-([A-Z0-9]+)\.ndjson(\.gz)?$/i);
  if (!match) return null;
  const exchange = match[1].toUpperCase();
  const symbol = match[2].toUpperCase();
  if (exchange === "UNKNOWN" || symbol === "UNKNOWN" || !wanted(symbol)) return null;

  const dayDir = join(ROOT, "trades", tradingDate);
  const target = join(dayDir, backfillFileName(exchange, symbol));
  if (existsSync(target) && !REDO) return { exchange, symbol, skipped: "already backfilled" };

  /*
   * Never write the live file. The collector holds it open and appends to it,
   * so publishing over it by rename would strand that handle and the rest of
   * the session would go to a file nothing reads.
   */
  const cutoff = await liveTapeStart(join(dayDir, instrumentFileName(exchange, symbol)));
  const rows = [];
  let gaps = 0;
  // Member by member, so a truncated member costs only itself. Piping the
  // whole file through one gunzip aborts at the first break and discards
  // everything after it - a third of a session on a day the collector was
  // restarted.
  const summary = await readArchiveRecords(join(ROOT, tradingDate, name), (record) => {
    if (record?.type === "GAP" || record?.type === "DROPPED") { gaps += 1; return; }
    const trade = tradeFromRecord(record);
    if (!trade) return;
    // The print's own trading date, not the file's: the last minutes before
    // 17:00 Chicago belong to the session that is ending.
    if (chicagoTradingDate(trade.timestamp) !== tradingDate) return;
    // Stop where the live tape begins, so the pair is complementary.
    if (cutoff !== null && trade.timestamp >= cutoff) return;
    rows.push(encodeTrade(trade, sideCode(record?.payload || record)));
  });

  if (!rows.length) {
    return { exchange, symbol, prints: 0, gaps, breaks: summary.breaks, cutoff };
  }
  rows.sort((left, right) => left[0] - right[0]);

  if (!DRY) {
    if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });
    await writeTape(target, rows.map((row) => JSON.stringify(row)));
  }
  return {
    exchange, symbol, prints: rows.length, gaps, breaks: summary.breaks, cutoff,
    from: new Date(rows[0][0]).toISOString(),
    to: new Date(rows[rows.length - 1][0]).toISOString(),
  };
}

async function main() {
  if (!existsSync(ROOT)) {
    process.stderr.write(`no recordings directory at ${ROOT}\n`);
    process.exit(1);
  }
  let dates = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (ONLY_DATE) dates = dates.filter((date) => date === ONLY_DATE);
  // Newest first, and bounded: the recent sessions are the ones being traded,
  // and an unbounded run is hours of disk on a box serving a live feed.
  else if (Number.isFinite(DAYS) && DAYS > 0) dates = dates.slice(-DAYS);

  if (!dates.length) {
    process.stdout.write("no recorded trading dates found\n");
    return;
  }
  process.stdout.write(
    `${DRY ? "[dry run] " : ""}taping ${dates.length} session(s) for ${roots.join(", ")} from ${ROOT}\n`,
  );

  let taped = 0;
  let prints = 0;
  for (const tradingDate of [...dates].reverse()) {
    const names = readdirSync(join(ROOT, tradingDate)).filter((name) => /\.ndjson(\.gz)?$/i.test(name));
    process.stdout.write(`\n${tradingDate}\n`);
    for (const name of names) {
      const began = Date.now();
      let result;
      try {
        result = await backfillFile(tradingDate, name);
      } catch (error) {
        // One unreadable file must not end the run - every other session is
        // still worth having.
        process.stdout.write(`  ${name}  FAILED: ${error.message}\n`);
        // Drop the half-written temp rather than leave it to be mistaken for a
        // tape; the rename is what publishes a file, so nothing else is dirty.
        const stem = name.replace(/\.ndjson(\.gz)?$/i, "");
        await unlink(join(ROOT, "trades", tradingDate, `${stem}.trades.ndjson.gz.tmp`)).catch(() => {});
        continue;
      }
      if (!result) continue;
      if (result.skipped) {
        process.stdout.write(`  ${result.exchange}:${result.symbol}  skipped (${result.skipped})\n`);
        continue;
      }
      taped += result.prints ? 1 : 0;
      prints += result.prints;
      process.stdout.write(
        `  ${result.exchange}:${result.symbol}  ${result.prints.toLocaleString()} prints`
        + `${result.from ? `  ${result.from.slice(11, 16)}Z -> ${result.to.slice(11, 16)}Z` : ""}`
        + `${result.cutoff ? `  (live tape takes over ${new Date(result.cutoff).toISOString().slice(11, 16)}Z)` : ""}`
        + `${result.gaps ? `  (${result.gaps} gap markers)` : ""}`
        + `${result.breaks ? `  [${result.breaks} damaged members skipped]` : ""}`
        + `  ${((Date.now() - began) / 1000).toFixed(1)}s\n`,
      );
    }
  }
  process.stdout.write(
    `\n${DRY ? "nothing written (dry run)" : `${taped} tape(s), ${prints.toLocaleString()} prints`
      + ` under ${join(ROOT, "trades")}`}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
