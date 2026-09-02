import { parentPort, workerData } from "node:worker_threads";

import { readArchiveRecords } from "./archive-reader.mjs";
import { foldPrintsToMinutes } from "./bar-flow-archive.mjs";
import { foldPrintsToMinuteLevels } from "./session-profile-archive.mjs";
import { chicagoTradingDate } from "./trading-session.mjs";
import { decodeTrade } from "./trade-tape-archive.mjs";

async function readSession(files, tradingDate, ceiling) {
  const trades = [];
  for (const file of files) {
    await readArchiveRecords(file, (row) => {
      if (trades.length >= ceiling) return;
      const trade = decodeTrade(row);
      if (!trade || chicagoTradingDate(trade.timestamp) !== tradingDate) return;
      trades.push(trade);
    });
  }
  trades.sort((left, right) => left.timestamp - right.timestamp);
  return trades;
}

async function run() {
  const trades = await readSession(
    Array.isArray(workerData?.files) ? workerData.files : [],
    String(workerData?.tradingDate || ""),
    Number(workerData?.ceiling) || 5_000_000,
  );
  if (workerData?.kind === "bar-flow") return foldPrintsToMinutes(trades);
  if (workerData?.kind === "session-profile") {
    const tickSize = Number(workerData.tickSize) > 0 ? Number(workerData.tickSize) : 0.25;
    return { tickSize, minutes: foldPrintsToMinuteLevels(trades, tickSize) };
  }
  throw new Error("Unsupported archive fold job.");
}

try {
  parentPort?.postMessage({ ok: true, value: await run() });
} catch (error) {
  parentPort?.postMessage({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
