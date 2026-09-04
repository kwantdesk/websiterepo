#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const FROM = process.env.RITHMIC_HISTORY_FROM || "2025-01-01";
const TO = process.env.RITHMIC_HISTORY_TO || new Date().toISOString().slice(0, 10);
const ROOT = process.env.RITHMIC_RECORD_DIR || "/recordings";
const BUDGET = process.env.RITHMIC_HISTORY_WEEKLY_BUDGET_BYTES || String(36 * 1024 ** 3);
const importer = fileURLToPath(new URL("./import-history-plant-bars.mjs", import.meta.url));

// Highest-liquidity roots lead the queue, then every enabled CME-group root.
// Parents and micros remain distinct: MNQ history is never relabelled NQ.
const instruments = [
  ["CME", "NQ"], ["CME", "ES"], ["CME", "MNQ"], ["CME", "MES"],
  ["CBOT", "YM"], ["CME", "RTY"], ["CBOT", "MYM"], ["CME", "M2K"],
  ["NYMEX", "CL"], ["COMEX", "GC"], ["NYMEX", "MCL"], ["COMEX", "MGC"],
  ["NYMEX", "NG"], ["COMEX", "SI"], ["COMEX", "HG"], ["NYMEX", "QM"],
  ["NYMEX", "QG"], ["NYMEX", "RB"], ["NYMEX", "HO"], ["NYMEX", "PL"], ["NYMEX", "PA"],
  ["CBOT", "ZN"], ["CBOT", "TN"], ["CBOT", "ZB"], ["CBOT", "UB"], ["CBOT", "ZF"], ["CBOT", "ZT"],
  ["CME", "10Y"], ["CME", "SR3"], ["CME", "6E"], ["CME", "M6E"], ["CME", "6J"],
  ["CME", "6B"], ["CME", "M6B"], ["CME", "6A"], ["CME", "M6A"], ["CME", "6C"],
  ["CME", "6S"], ["CME", "6N"], ["CME", "6M"], ["CME", "BTC"], ["CME", "MBT"],
  ["CME", "ETH"], ["CME", "MET"], ["CBOT", "ZC"], ["CBOT", "ZS"], ["CBOT", "ZW"],
  ["CBOT", "ZM"], ["CBOT", "ZL"], ["CME", "LE"], ["CME", "HE"], ["CME", "GF"],
  ["COMEX", "SIL"],
];

let failures = 0;
for (const [exchange, symbol] of instruments) {
  const result = spawnSync(process.execPath, [
    importer, "--dir", ROOT, "--exchange", exchange, "--symbol", symbol,
    "--from", FROM, "--to", TO, "--weekly-budget-bytes", BUDGET,
  ], { stdio: "inherit" });
  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(`[history-backfill] ${exchange}:${symbol} failed; continuing.\n`);
  }
}
if (failures) {
  process.stderr.write(`[history-backfill] queue ended with ${failures} failed root(s); rerun is checkpoint-safe.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`[history-backfill] all ${instruments.length} roots complete.\n`);
}
