#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { loadConfig } from "../src/config.mjs";
import { RithmicHistoryPlantClient } from "../src/history-plant-client.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const ROOT = flag("dir", "/recordings");
const EXCHANGE = String(flag("exchange", "CME")).toUpperCase();
const SYMBOL = String(flag("symbol", "")).toUpperCase();
const FROM = flag("from", "2025-01-01");
const TO = flag("to", new Date().toISOString().slice(0, 10));
const SAFETY_BYTES = Number(flag("weekly-budget-bytes", String(36 * 1024 ** 3)));
const STATE_FILE = join(ROOT, "history-import", "state.json");

if (!SYMBOL) throw new Error("--symbol is required (an exact futures contract, e.g. NQH5).");
if (!/^\d{4}-\d{2}-\d{2}$/.test(FROM) || !/^\d{4}-\d{2}-\d{2}$/.test(TO)) {
  throw new Error("--from and --to must be YYYY-MM-DD.");
}

const startSec = Math.floor(Date.parse(`${FROM}T00:00:00Z`) / 1_000);
const finishSec = Math.floor((Date.parse(`${TO}T00:00:00Z`) + 86_400_000 - 1) / 1_000);
const config = loadConfig();
if (!config.configured) throw new Error("Rithmic credentials are not configured.");

async function readState() {
  try { return JSON.parse(await readFile(STATE_FILE, "utf8")); } catch { return { version: 1, jobs: {}, weeklyBytes: {} }; }
}

async function atomicJson(file, value) {
  const temporary = `${file}.tmp`;
  mkdirSync(dirname(file), { recursive: true });
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, file);
}

function isoWeekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-W${String(Math.ceil((((date - yearStart) / 86_400_000) + 1) / 7)).padStart(2, "0")}`;
}

const state = await readState();
const week = isoWeekKey();
const alreadyUsed = Number(state.weeklyBytes?.[week] || 0);
if (alreadyUsed >= SAFETY_BYTES) throw new Error(`Weekly History Plant safety budget already reached (${alreadyUsed} bytes).`);
const jobKey = `${EXCHANGE}:${SYMBOL}:${FROM}:${TO}:1m`;
if (state.jobs?.[jobKey]?.status === "complete" && !args.includes("--redo")) {
  process.stdout.write(`${jobKey} already complete; use --redo to replace/merge it.\n`);
  process.exit(0);
}

const days = new Map();
let rows = 0;
let invalid = 0;
const client = new RithmicHistoryPlantClient(config);
try {
  const transfer = await client.replayMinuteBars({
    exchange: EXCHANGE,
    symbol: SYMBOL,
    startSec,
    finishSec,
    onBar: (row) => {
      const t = Number(row.marker) * 1_000;
      const bar = [t, Number(row.openPrice), Number(row.highPrice), Number(row.lowPrice), Number(row.closePrice), Number(row.volume || 0)];
      if (!Number.isFinite(t) || t <= 0 || !bar.slice(1, 5).every(Number.isFinite)
        || bar[2] < Math.max(bar[1], bar[4]) || bar[3] > Math.min(bar[1], bar[4]) || bar[2] < bar[3]) {
        invalid += 1;
        return;
      }
      const day = chicagoTradingDate(t);
      if (!days.has(day)) days.set(day, new Map());
      days.get(day).set(t, bar);
      rows += 1;
    },
  });
  if (!rows) throw new Error(`History Plant returned no minute bars for ${EXCHANGE}:${SYMBOL}.`);
  for (const [tradingDate, incoming] of days) {
    const dir = join(ROOT, "bars", tradingDate);
    const file = join(dir, `${EXCHANGE}-${SYMBOL}.json`);
    const merged = new Map();
    if (existsSync(file)) {
      try {
        const parsed = JSON.parse(await readFile(file, "utf8"));
        for (const bar of parsed.bars || []) merged.set(Number(bar[0]), bar);
      } catch {}
    }
    for (const [timestamp, bar] of incoming) merged.set(timestamp, bar);
    mkdirSync(dir, { recursive: true });
    await atomicJson(file, {
      tradingDate,
      exchange: EXCHANGE,
      symbol: SYMBOL,
      source: "Rithmic History Plant minute bars",
      bars: [...merged.values()].sort((a, b) => a[0] - b[0]),
    });
  }
  state.jobs ||= {};
  state.weeklyBytes ||= {};
  state.weeklyBytes[week] = alreadyUsed + transfer.bytesReceived;
  state.jobs[jobKey] = {
    status: "complete",
    completedAt: new Date().toISOString(),
    rows,
    invalid,
    sessions: days.size,
    bytesReceived: transfer.bytesReceived,
  };
  await atomicJson(STATE_FILE, state);
  process.stdout.write(JSON.stringify({ jobKey, rows, invalid, sessions: days.size, bytesReceived: transfer.bytesReceived }) + "\n");
} catch (error) {
  state.jobs ||= {};
  state.jobs[jobKey] = { status: "failed", failedAt: new Date().toISOString(), error: error.message };
  await atomicJson(STATE_FILE, state);
  throw error;
} finally {
  client.close();
}
