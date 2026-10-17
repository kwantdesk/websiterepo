import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.mjs";
import { importHistoryTrades } from "../src/history-trade-import.mjs";
import { readArchiveRecords } from "../src/archive-reader.mjs";
import { BarFlowArchive } from "../src/bar-flow-archive.mjs";
import { SessionProfileArchive } from "../src/session-profile-archive.mjs";
import { futuresTickSize } from "../src/event-bar-builder.mjs";

export async function materializeRecoveredCandles(dir, exchange, symbol, tradingDate) {
  const tape = join(dir, "trades", tradingDate, `${exchange}-${symbol}.trades.history.ndjson.gz`);
  if (!existsSync(tape)) throw new Error("Completed provider replay is required.");
  const minutes = new Map();
  await readArchiveRecords(tape, ([at, price, size]) => {
    const t = Math.floor(at / 60000) * 60000;
    const row = minutes.get(t) ?? [t, price, price, price, price, 0];
    row[2] = Math.max(row[2], price); row[3] = Math.min(row[3], price); row[4] = price; row[5] += size;
    minutes.set(t, row);
  });
  const folder = join(dir, "bars", tradingDate), file = join(folder, `${exchange}-${symbol}.json`);
  mkdirSync(folder, { recursive: true });
  if (existsSync(file) && !existsSync(`${file}.before-history-trades`)) await writeFile(`${file}.before-history-trades`, await readFile(file));
  await writeFile(`${file}.tmp`, JSON.stringify({ tradingDate, exchange, symbol,
    source: "Rithmic History Plant individual trades", markerConvention: "bar-open",
    bars: [...minutes.values()].sort((a, b) => a[0] - b[0]) }));
  await rename(`${file}.tmp`, file);
  return minutes.size;
}

export async function restoreIndicatorHistory(config, { dir, symbol, exchange = "CME", tradingDate }) {
  const imported = await importHistoryTrades(config, { dir, symbol, exchange, tradingDate });
  const candles = await materializeRecoveredCandles(dir, exchange, symbol, tradingDate);
  const flow = await new BarFlowArchive({ dir }).sessionFlow(tradingDate, exchange, symbol);
  const profile = await new SessionProfileArchive({ dir }).sessionLevels(tradingDate, exchange, symbol, futuresTickSize(symbol));
  return { ...imported, candles, flowMinutes: flow.minutes.length, profileMinutes: profile.minutes.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, symbol, tradingDate, exchange = "CME"] = process.argv.slice(2);
  if (!dir || !/^[A-Z0-9]+$/.test(symbol ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(tradingDate ?? "")) {
    throw new Error("Usage: restore-indicator-history.mjs RECORD_DIR EXACT_CONTRACT SESSION_START_DATE [EXCHANGE]");
  }
  console.log(JSON.stringify(await restoreIndicatorHistory(loadConfig(), { dir, symbol, exchange, tradingDate })));
}
