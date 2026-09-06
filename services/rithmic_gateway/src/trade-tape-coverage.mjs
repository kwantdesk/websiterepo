import { readFile, rename, writeFile } from "node:fs/promises";

export const TRADE_TAPE_COVERAGE_SCHEMA = "kwantify-trade-tape-coverage-v1";

export function coverageFileName(exchange, symbol) {
  return `${String(exchange).toUpperCase()}-${String(symbol).toUpperCase()}.trades.backfill.coverage.json`;
}

const finite = (value) => value !== null && value !== undefined && value !== ""
  && Number.isFinite(Number(value));

/**
 * Evidence produced while extracting the compact tape from the raw recorder.
 *
 * This deliberately describes only what was observed; it does not claim that
 * a whole trading session was covered. A consumer may affirm a requested
 * sub-window only when it sits inside these bounds and integrityComplete is
 * true. GAP/DROPPED markers and damaged gzip members always fail closed.
 */
export function createBackfillCoverageReceipt(input) {
  const exchange = String(input.exchange || "").toUpperCase();
  const symbol = String(input.symbol || "").toUpperCase();
  const tradingDate = String(input.tradingDate || "");
  const observationFromMs = finite(input.observationFromMs) ? Number(input.observationFromMs) : null;
  const observationToMs = finite(input.observationToMs) ? Number(input.observationToMs) : null;
  const sourcePrintCount = Number.isSafeInteger(Number(input.sourcePrintCount))
    ? Math.max(0, Number(input.sourcePrintCount)) : 0;
  const gapMarkers = Number.isSafeInteger(Number(input.gapMarkers))
    ? Math.max(0, Number(input.gapMarkers)) : 0;
  const damagedMembers = Number.isSafeInteger(Number(input.damagedMembers))
    ? Math.max(0, Number(input.damagedMembers)) : 0;
  const boundsValid = observationFromMs !== null && observationToMs !== null
    && observationFromMs <= observationToMs;
  return {
    schemaVersion: TRADE_TAPE_COVERAGE_SCHEMA,
    provider: "Rithmic",
    source: "raw-recorder-backfill",
    exchange,
    symbol,
    tradingDate,
    observationFromMs,
    observationToMs,
    sourcePrintCount,
    gapMarkers,
    damagedMembers,
    integrityComplete: boundsValid && gapMarkers === 0 && damagedMembers === 0,
    executionOrderComplete: boundsValid,
  };
}

export function provesCoverageWindow(receipt, request) {
  if (!receipt || receipt.schemaVersion !== TRADE_TAPE_COVERAGE_SCHEMA
    || receipt.provider !== "Rithmic" || receipt.integrityComplete !== true
    || receipt.executionOrderComplete !== true) return false;
  const exchange = String(request.exchange || "").toUpperCase();
  const symbol = String(request.symbol || "").toUpperCase();
  const fromMs = Number(request.fromMs);
  const toMs = Number(request.toMs);
  return receipt.exchange === exchange && receipt.symbol === symbol
    && finite(fromMs) && finite(toMs) && fromMs <= toMs
    && finite(receipt.observationFromMs) && finite(receipt.observationToMs)
    && Number(receipt.observationFromMs) <= fromMs
    && Number(receipt.observationToMs) >= toMs;
}

/**
 * Prove the market intervals the chart actually contains, rather than one
 * continuous wall-clock span. CME maintenance/weekend closures contain no bars
 * and therefore do not need invented coverage; every supplied bar interval
 * still has to be fully covered by healthy same-contract evidence. Adjacent
 * receipts may meet exactly, but any positive hole fails.
 */
export function provesCoverageIntervals(receipts, request, intervals) {
  if (!Array.isArray(receipts) || !Array.isArray(intervals) || !intervals.length) return false;
  const exchange = String(request.exchange || "").toUpperCase();
  const symbol = String(request.symbol || "").toUpperCase();
  const healthy = receipts.filter((receipt) => receipt
    && receipt.exchange === exchange && receipt.symbol === symbol
    && receipt.schemaVersion === TRADE_TAPE_COVERAGE_SCHEMA
    && receipt.provider === "Rithmic" && receipt.integrityComplete === true
    && receipt.executionOrderComplete === true
    && finite(receipt.observationFromMs) && finite(receipt.observationToMs)
    && Number(receipt.observationFromMs) <= Number(receipt.observationToMs))
    .map((receipt) => [Number(receipt.observationFromMs), Number(receipt.observationToMs)])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  if (!healthy.length) return false;
  return intervals.every((interval) => {
    const fromMs = Number(interval?.fromMs);
    const toMs = Number(interval?.toMs);
    if (!finite(interval?.fromMs) || !finite(interval?.toMs) || fromMs >= toMs) return false;
    let through = fromMs;
    for (const [start, end] of healthy) {
      if (end < through) continue;
      if (start > through) break;
      through = Math.max(through, end);
      if (through >= toMs) return true;
    }
    return false;
  });
}

export async function writeCoverageReceipt(file, receipt) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

export async function readCoverageReceipt(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}
