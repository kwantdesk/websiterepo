#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  CashIndexArchiver,
  DEFAULT_CASH_INDEX_TICKERS,
  isCashSessionOpen,
} from "../src/cash-index-archiver.mjs";

const ROOT = process.env.RITHMIC_RECORD_DIR || "/recordings";
const FROM = process.env.CASH_INDEX_HISTORY_FROM || "2025-01-01";
const TO = process.env.CASH_INDEX_HISTORY_TO || new Date().toISOString().slice(0, 10);
const REQUEST_SPACING_MS = Math.max(1_500, Number(process.env.CASH_INDEX_HISTORY_REQUEST_SPACING_MS) || 1_500);
const STATE_DIR = join(ROOT, "cash-index");
const STATE_FILE = join(STATE_DIR, "backfill-state.json");
const ACTIVE_FILE = join(STATE_DIR, ".history-backfill-active");

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`));
}

function weekdayDates(from, to) {
  const dates = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function loadState() {
  try {
    const parsed = JSON.parse(await readFile(STATE_FILE, "utf8"));
    return parsed && typeof parsed.jobs === "object" ? parsed : { schema: 1, jobs: {} };
  } catch {
    return { schema: 1, jobs: {} };
  }
}

async function saveState(state) {
  const temporary = `${STATE_FILE}.partial`;
  state.updatedAt = new Date().toISOString();
  await writeFile(temporary, JSON.stringify(state), "utf8");
  await rename(temporary, STATE_FILE);
}

if (!validDate(FROM) || !validDate(TO) || FROM > TO) {
  throw new Error("CASH_INDEX_HISTORY_FROM/TO must be a valid ascending YYYY-MM-DD range.");
}
if (!process.env.QUANTDATA_API_KEY) {
  throw new Error("QUANTDATA_API_KEY is required for the cash-underlying history backfill.");
}

mkdirSync(STATE_DIR, { recursive: true });
if (isCashSessionOpen()) {
  process.stderr.write("[cash-history] US cash market is open; historical provider work is deferred.\n");
  process.exitCode = 75;
} else {
  const state = await loadState();
  const dates = weekdayDates(FROM, TO);
  const archiver = new CashIndexArchiver({
    dir: ROOT,
    apiKey: process.env.QUANTDATA_API_KEY,
    tickers: DEFAULT_CASH_INDEX_TICKERS,
    requestSpacingMs: REQUEST_SPACING_MS,
    log: (line) => process.stdout.write(`${line}\n`),
  });
  let failed = 0;
  let completed = 0;
  let empty = 0;

  const clearMarker = async () => rm(ACTIVE_FILE, { force: true }).catch(() => {});
  process.once("SIGTERM", () => { void clearMarker().finally(() => process.exit(143)); });
  process.once("SIGINT", () => { void clearMarker().finally(() => process.exit(130)); });

  try {
    await writeFile(ACTIVE_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), "utf8");
    for (const sessionDate of dates) {
      for (const ticker of DEFAULT_CASH_INDEX_TICKERS) {
        if (isCashSessionOpen()) {
          await saveState(state);
          process.stderr.write("[cash-history] market-open boundary reached; checkpoint saved.\n");
          process.exitCode = 75;
          break;
        }
        const key = `${ticker}:${sessionDate}`;
        const job = state.jobs[key];
        if (job?.status === "complete" || job?.status === "no-data") continue;

        await writeFile(ACTIVE_FILE, JSON.stringify({ pid: process.pid, key, updatedAt: new Date().toISOString() }), "utf8");
        const result = await archiver.archiveSession(ticker, sessionDate, {
          acceptHistoricalHalfDay: true,
        });
        const attempts = Number(job?.attempts || 0) + (result.status === "existing" ? 0 : 1);
        if (result.status === "complete" || result.status === "existing") {
          state.jobs[key] = { status: "complete", bars: result.bars, attempts };
          completed += 1;
        } else if (result.status === "empty" && attempts >= 3) {
          state.jobs[key] = { status: "no-data", bars: 0, attempts };
          empty += 1;
        } else {
          state.jobs[key] = {
            status: result.status,
            bars: result.bars,
            attempts,
            error: result.error || null,
          };
          failed += 1;
        }
        await saveState(state);
      }
      if (process.exitCode === 75) break;
    }
  } finally {
    await clearMarker();
  }

  process.stdout.write(`[cash-history] pass complete: ${completed} completed, ${empty} confirmed no-data, ${failed} retryable.\n`);
  if (failed && !process.exitCode) process.exitCode = 1;
}
