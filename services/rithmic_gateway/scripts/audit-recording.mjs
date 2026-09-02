#!/usr/bin/env node
/**
 * Is the collector recording the current session without gaps?
 *
 * Answers it from evidence rather than from a health flag: a feed can report
 * "connected" while writing nothing, and a bar file can look full while
 * missing the minutes that mattered. Everything below is measured off disk.
 *
 * A missing minute is not automatically a fault - a thin instrument genuinely
 * does not trade every minute overnight - so the report separates minutes with
 * no prints from evidence of actual loss: dropped records, GAP markers written
 * by the recorder when the feed dropped, and damaged members in the tape.
 *
 *   node scripts/audit-recording.mjs [--dir /recordings] [--date YYYY-MM-DD]
 *                                    [--symbol NQU6] [--since 120]
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { readArchiveRecords } from "../src/archive-reader.mjs";
import { chicagoTradingDate, cmeSessionBounds } from "../src/trading-session.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const ROOT = flag("dir", "/recordings");
const DATE = flag("date", chicagoTradingDate(Date.now()));
const ONLY = flag("symbol");
// How many minutes back to judge "is it recording RIGHT NOW".
const SINCE_MIN = Number(flag("since", "120"));

const pad = (value, width) => String(value).padStart(width);

async function barCoverage(tradingDate, exchange, symbol) {
  const file = join(ROOT, "bars", tradingDate, `${exchange}-${symbol}.json`);
  if (!existsSync(file)) return null;
  let rows = [];
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    rows = (Array.isArray(parsed) ? parsed : parsed?.bars) ?? [];
  } catch { return null; }
  const times = rows
    .map((row) => (Array.isArray(row) ? row[0] : row?.t))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!times.length) return { bars: 0, gaps: [], first: null, last: null };

  const gaps = [];
  for (let index = 1; index < times.length; index += 1) {
    const minutes = (times[index] - times[index - 1]) / 60_000;
    if (minutes > 1) gaps.push({ minutes: Math.round(minutes), after: times[index - 1] });
  }
  return { bars: times.length, gaps, first: times[0], last: times.at(-1) };
}

async function main() {
  const now = Date.now();
  const bounds = cmeSessionBounds(DATE);
  const dayDir = join(ROOT, DATE);
  console.log(`recording audit - trading date ${DATE}`);
  console.log(`session ${bounds ? new Date(bounds.startMs).toISOString() : "?"} -> `
    + `${bounds ? new Date(bounds.endMs).toISOString() : "?"}`);
  console.log(`now ${new Date(now).toISOString()}\n`);

  if (!existsSync(dayDir)) {
    console.log(`NO TAPE for ${DATE} at ${dayDir} - the collector wrote nothing for this session.`);
    process.exitCode = 1;
    return;
  }

  const names = readdirSync(dayDir)
    .filter((name) => /\.ndjson(\.gz)?$/i.test(name) && !name.startsWith("UNKNOWN-"));

  const elapsedMinutes = bounds
    ? Math.max(0, Math.floor((Math.min(now, bounds.endMs) - bounds.startMs) / 60_000))
    : null;

  console.log("instrument      tape     bars  covered  gaps>1m  worst  damaged  GAPs  stale");
  let problems = 0;

  for (const name of names) {
    const match = name.match(/^([A-Z0-9]+)-([A-Z0-9]+)\.ndjson/i);
    if (!match) continue;
    const exchange = match[1].toUpperCase();
    const symbol = match[2].toUpperCase();
    if (ONLY && symbol !== ONLY.toUpperCase()) continue;

    const tapeBytes = statSync(join(dayDir, name)).size;
    const coverage = await barCoverage(DATE, exchange, symbol);

    // Only the recent tail is scanned: reading a whole session here would take
    // minutes and starve the collector, which is how the gateway was taken
    // down once already.
    let gapMarkers = 0;
    let damaged = 0;
    if (tapeBytes < 64 * 1024 * 1024) {
      const summary = await readArchiveRecords(
        join(dayDir, name),
        (record) => { if (record?.type === "GAP" || record?.type === "DROPPED") gapMarkers += 1; },
      );
      damaged = summary.breaks;
    } else {
      damaged = -1; // not scanned
    }

    const bars = coverage?.bars ?? 0;
    const gaps = coverage?.gaps ?? [];
    const worst = gaps.reduce((most, gap) => Math.max(most, gap.minutes), 0);
    const covered = elapsedMinutes ? `${Math.min(100, Math.round((bars / elapsedMinutes) * 100))}%` : "-";
    const staleMin = coverage?.last ? Math.round((now - coverage.last) / 60_000) : null;
    const stale = staleMin === null ? "-" : `${staleMin}m`;

    // The judgement: a bar that has not advanced in a while during a live
    // session is the real alarm, whatever the coverage percentage says.
    if (staleMin !== null && staleMin > SINCE_MIN) problems += 1;
    if (gapMarkers > 0) problems += 1;

    console.log(
      `${(exchange + ":" + symbol).padEnd(15)}`
      + `${pad((tapeBytes / 1e6).toFixed(0) + "M", 5)}`
      + `${pad(bars, 9)}`
      + `${pad(covered, 9)}`
      + `${pad(gaps.length, 9)}`
      + `${pad(worst ? worst + "m" : "-", 7)}`
      + `${pad(damaged < 0 ? "n/s" : damaged, 9)}`
      + `${pad(gapMarkers, 6)}`
      + `${pad(stale, 7)}`,
    );

    for (const gap of gaps.sort((a, b) => b.minutes - a.minutes).slice(0, 3)) {
      if (gap.minutes >= 5) {
        console.log(`                 ^ ${gap.minutes}m missing after ${new Date(gap.after).toISOString()}`);
      }
    }
  }

  console.log("\ncovered  = bars against minutes elapsed in the session; below 100% is normal");
  console.log("           overnight, when a thin instrument genuinely does not trade every minute.");
  console.log("damaged  = gzip members the reader had to skip (n/s = tape too large to scan here).");
  console.log("GAPs     = markers the recorder wrote because the FEED dropped. Any is a real loss.");
  console.log("stale    = minutes since that instrument's newest bar.");
  console.log(problems ? `\n${problems} instrument(s) need attention.` : "\nNo feed loss recorded.");
  if (problems) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
