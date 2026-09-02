#!/usr/bin/env node
/**
 * Build minute bars for sessions that were recorded before the bar archive
 * existed.
 *
 * The collector has been writing every print to disk the whole time, but the
 * bar layer only starts accumulating from the moment it is deployed - so
 * without this, history would begin today and every earlier session would stay
 * a hole even though the tape for it is sitting right there.
 *
 * Reads the raw NDJSON.gz per trading date, aggregates one-minute OHLCV, and
 * writes the same files the live archive writes. Existing bars are merged,
 * never replaced, so running it twice is safe and running it while the
 * collector is live cannot lose the session in progress.
 *
 *   node scripts/backfill-futures-bars.mjs [--dir /recordings] [--date 2026-09-01] [--dry]
 */
import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

import { readArchiveRecords } from "../src/archive-reader.mjs";

import { chicagoTradingDate } from "../src/trading-session.mjs";
import { tradeFromRecord } from "../src/futures-bar-archive.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const ROOT = flag("dir", "/recordings");
const ONLY_DATE = flag("date");
const DRY = args.includes("--dry");
const BAR_MS = 60_000;

const encode = (bar) => [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v];

async function readExisting(file) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    const rows = Array.isArray(parsed) ? parsed : parsed?.bars;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => (Array.isArray(row)
        ? { t: row[0], o: row[1], h: row[2], l: row[3], c: row[4], v: row[5] }
        : row))
      .filter((bar) => Number.isFinite(bar?.t));
  } catch {
    return [];
  }
}

async function backfillFile(tradingDate, name) {
  const match = name.match(/^([A-Z0-9]+)-([A-Z0-9]+)\.ndjson(\.gz)?$/i);
  if (!match) return null;
  const exchange = match[1].toUpperCase();
  const symbol = match[2].toUpperCase();
  if (exchange === "UNKNOWN" || symbol === "UNKNOWN") return null;

  const source = join(ROOT, tradingDate, name);
  const bars = new Map();
  let prints = 0;
  let gaps = 0;
  let breaks = 0;

  /*
   * Read member by member so a truncated one costs only itself. Piping the
   * whole file through a single gunzip aborted at the first break and
   * discarded everything after it - which is a third of a session on a day
   * the collector was restarted.
   */
  const summary = await readArchiveRecords(source, (record) => {
    if (record?.type === "GAP" || record?.type === "DROPPED") { gaps += 1; return; }
    const trade = tradeFromRecord(record);
    if (!trade) return;
    // The print's own trading date, not the file's: the last minutes before
    // 17:00 Chicago belong to the session that is ending.
    if (chicagoTradingDate(trade.timestamp) !== tradingDate) return;
    prints += 1;
    const bucket = Math.floor(trade.timestamp / BAR_MS) * BAR_MS;
    const existing = bars.get(bucket);
    if (!existing) {
      bars.set(bucket, {
        t: bucket, o: trade.price, h: trade.price, l: trade.price, c: trade.price, v: trade.size,
      });
    } else {
      if (trade.price > existing.h) existing.h = trade.price;
      if (trade.price < existing.l) existing.l = trade.price;
      existing.c = trade.price;
      existing.v += trade.size;
    }
  });
  breaks = summary.breaks;

  if (!bars.size) return { exchange, symbol, prints, bars: 0, gaps, breaks };

  const outDir = join(ROOT, "bars", tradingDate);
  const outFile = join(outDir, `${exchange}-${symbol}.json`);
  if (!DRY) {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const merged = new Map();
    // Anything already on disk wins nothing and loses nothing: the live
    // archive may be writing this same session right now.
    for (const bar of await readExisting(outFile)) merged.set(bar.t, bar);
    for (const bar of bars.values()) if (!merged.has(bar.t)) merged.set(bar.t, bar);
    const rows = [...merged.values()].sort((a, b) => a.t - b.t).map(encode);
    const temporary = `${outFile}.tmp`;
    await writeFile(temporary, JSON.stringify({ tradingDate, exchange, symbol, bars: rows }));
    await rename(temporary, outFile);
  }
  return { exchange, symbol, prints, bars: bars.size, gaps, breaks };
}

async function main() {
  if (!existsSync(ROOT)) {
    process.stderr.write(`no recordings directory at ${ROOT}\n`);
    process.exit(1);
  }
  const dates = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .filter((date) => !ONLY_DATE || date === ONLY_DATE)
    .sort();

  if (!dates.length) {
    process.stdout.write("no recorded trading dates found\n");
    return;
  }
  process.stdout.write(`${DRY ? "[dry run] " : ""}backfilling ${dates.length} session(s) from ${ROOT}\n`);

  for (const tradingDate of dates) {
    const names = readdirSync(join(ROOT, tradingDate))
      .filter((name) => /\.ndjson(\.gz)?$/i.test(name));
    process.stdout.write(`\n${tradingDate}  (${names.length} instrument file(s))\n`);
    for (const name of names) {
      const began = Date.now();
      const result = await backfillFile(tradingDate, name);
      if (!result) continue;
      process.stdout.write(
        `  ${result.exchange}:${result.symbol}  ${result.bars} bars from ${result.prints} prints`
        + `${result.gaps ? ` (${result.gaps} gap markers)` : ""}`
        + `${result.breaks ? ` [${result.breaks} damaged members skipped]` : ""}`
        + `  ${((Date.now() - began) / 1000).toFixed(1)}s\n`,
      );
    }
  }
  process.stdout.write(`\n${DRY ? "nothing written (dry run)" : `bars written under ${join(ROOT, "bars")}`}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
