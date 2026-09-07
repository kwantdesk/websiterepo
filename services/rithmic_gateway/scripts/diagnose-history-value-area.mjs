#!/usr/bin/env node
import { loadConfig } from "../src/config.mjs";
import { buildHistoryValueAreaProfile } from "../src/history-value-area.mjs";

const [, , symbol, start, end, tickSizeInput = "0.25"] = process.argv;
if (!symbol || !start || !end) {
  throw new Error("Usage: diagnose-history-value-area.mjs SYMBOL START_ISO END_ISO");
}
const startMs = Date.parse(start);
const endMs = Date.parse(end);
const tickSize = Number(tickSizeInput);
if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || !Number.isFinite(tickSize) || tickSize <= 0) {
  throw new Error("START_ISO and END_ISO must define a valid positive window.");
}
const profile = await buildHistoryValueAreaProfile(loadConfig(), {
  exchange: "CME",
  symbol: symbol.toUpperCase(),
  startMs,
  endMs,
  tickSize,
  valueAreaPercent: 0.7,
});
process.stdout.write(`${JSON.stringify(profile)}\n`);
