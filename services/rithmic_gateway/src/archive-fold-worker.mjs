import { parentPort, workerData } from "node:worker_threads";

import { readArchiveRecords } from "./archive-reader.mjs";
import { foldPrintsToMinutes } from "./bar-flow-archive.mjs";
import {
  aggregateSessionMinuteLevels,
  foldPrintsToMinuteLevels,
} from "./session-profile-archive.mjs";
import { chicagoTradingDate } from "./trading-session.mjs";
import { decodeTrade } from "./trade-tape-archive.mjs";
import { createExactFootprintFold } from "./exact-footprint-fold.mjs";

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
  if (workerData?.kind === "exact-footprint") {
    const fold = createExactFootprintFold(workerData);
    for (const file of workerData.files ?? []) await readArchiveRecords(file, row => {
      const trade = decodeTrade(row);
      if (trade) fold.add(trade);
    });
    return fold.result();
  }
  if (workerData?.kind === "exact-tape-window") {
    const rows = [];
    const limit = Math.min(100000, Math.max(1, Number(workerData.limit) || 100000));
    let sourceRecordCount = 0;
    for (const file of workerData.files ?? []) await readArchiveRecords(file, row => {
      const trade = decodeTrade(row);
      if (!trade || trade.timestamp < workerData.fromMs || trade.timestamp >= workerData.toMs) return;
      sourceRecordCount++;
      if (rows.length < limit) rows.push(row);
    });
    const truncated = sourceRecordCount > limit;
    if (!truncated) rows.sort((a, b) => a[0] - b[0]);
    return { records: truncated ? [] : rows, truncated, sourceRecordCount };
  }
  const trades = await readSession(
    Array.isArray(workerData?.files) ? workerData.files : [],
    String(workerData?.tradingDate || ""),
    Number(workerData?.ceiling) || 5_000_000,
  );
  if (workerData?.kind === "bar-flow") return foldPrintsToMinutes(trades);
  if (workerData?.kind === "session-profile") {
    const tickSize = Number(workerData.tickSize) > 0 ? Number(workerData.tickSize) : 0.25;
    const minutes = foldPrintsToMinuteLevels(trades, tickSize);
    return {
      schemaVersion: 2,
      tickSize,
      minutes,
      aggregate: aggregateSessionMinuteLevels(minutes),
    };
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
