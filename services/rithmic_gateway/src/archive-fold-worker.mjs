import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import { dirname } from "node:path";
import { parentPort, threadId, workerData } from "node:worker_threads";

import { readArchiveRecords } from "./archive-reader.mjs";
import { foldPrintsToMinutes } from "./bar-flow-archive.mjs";
import {
  aggregateSessionMinuteLevels,
  createMinuteLevelFold,
  foldPrintsToMinuteLevels,
} from "./session-profile-archive.mjs";
import { chicagoTradingDate } from "./trading-session.mjs";
import { decodeTrade, TradeTapeArchive } from "./trade-tape-archive.mjs";
import { createExactFootprintFold } from "./exact-footprint-fold.mjs";
import { buildDevelopingProfileSeries } from "./developing-profile.mjs";

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
  if (workerData?.kind === "developing-volume-profile") {
    const { files, args } = workerData;
    const minutes = [];
    for (const file of files) {
      const session = JSON.parse(gunzipSync(await readFile(file)).toString("utf8"));
      if (session.schemaVersion !== 2 || session.historyPlant === true
        || session.tickSize !== args.tickSize || !Array.isArray(session.minutes)) return null;
      minutes.push(...session.minutes);
    }
    if (!files.length && workerData.tradeFiles?.length) {
      // Only the gateway's owned recorder files may be passed to this job.
      const fold = createMinuteLevelFold(args.tickSize);
      for (const file of workerData.tradeFiles) await readArchiveRecords(file, (row) => {
        const trade = decodeTrade(row);
        if (trade && trade.timestamp >= args.fromMs && trade.timestamp < args.toMs) fold.add(trade);
      });
      minutes.push(...fold.result());
    }
    const coveredThrough = minutes.reduce((latest, minute) => Math.max(latest, minute.last ?? minute.t), 0);
    const tail = (args.tailTrades ?? []).filter((trade) => trade.timestamp > coveredThrough);
    const tolerance = 5 * 60_000;
    const first = minutes.find((minute) => minute.t >= args.fromMs)?.t ?? tail[0]?.timestamp;
    if (!Number.isFinite(first) || first > args.fromMs + tolerance) return null;
    // Preserve the verified prefix if the available live suffix starts
    // after a coverage gap.
    const tailTrades = coveredThrough && tail[0]?.timestamp > coveredThrough + tolerance ? [] : tail;
    return buildDevelopingProfileSeries({ ...args, tailTrades, minutes });
  }
  if (workerData?.kind === "chart-event-history" || workerData?.kind === "chart-time-history") {
    const archive = new TradeTapeArchive({ dir: workerData.dir, enabled: false });
    return workerData.kind === "chart-event-history"
      ? archive.loadEventBars(workerData.args) : archive.loadTimeBars(workerData.args);
  }
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
    const profile = {
      schemaVersion: 2,
      tickSize,
      minutes,
      aggregate: aggregateSessionMinuteLevels(minutes),
    };
    const snapshot = workerData.activeSnapshotFile;
    if (snapshot && minutes.length && trades.length < workerData.ceiling) {
      try {
        await mkdir(dirname(snapshot), { recursive: true });
        const temporary = snapshot + "." + threadId + ".tmp";
        await writeFile(temporary, gzipSync(JSON.stringify(profile), { level: 1 }));
        await rename(temporary, snapshot);
      } catch (error) {
        // A read-only snapshot failure must not break the regular profile.
        profile.activeSnapshotError = error instanceof Error ? error.message : String(error);
      }
    }
    return profile;
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
