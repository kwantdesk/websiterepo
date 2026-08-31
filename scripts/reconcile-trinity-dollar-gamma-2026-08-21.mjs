#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_PATH = "C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json";
const INTERVAL_PATH = path.resolve(ROOT, "tmp/quantdata-interval-map-2026-08-21.json");
const AS_OF = Date.parse("2026-08-21T14:00:00.000Z");
const EXPIRY = "2026-08-21";
const SYMBOLS = ["SPX", "SPY", "QQQ"];
const SPOT = { SPX: 7665.14, SPY: 764.45, QQQ: 711.55 };

function materializedFrame(payload) {
  const timestamps = Object.keys(payload?.data ?? {})
    .map(Number)
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp <= AS_OF + 1_000)
    .sort((left, right) => left - right);
  const timestamp = timestamps.at(-1);
  if (!Number.isFinite(timestamp)) return null;
  const expiries = {};
  for (const frameTimestamp of timestamps) {
    for (const [expiry, strikes] of Object.entries(payload.data[String(frameTimestamp)] ?? {})) {
      const expiryState = expiries[expiry] ?? {};
      for (const [strike, update] of Object.entries(strikes ?? {})) {
        expiryState[strike] = { ...(expiryState[strike] ?? {}), ...(update ?? {}) };
      }
      expiries[expiry] = expiryState;
    }
  }
  return { timestamp, expiries };
}

function strikeCell(frame, strike) {
  const bucket = frame?.expiries?.[EXPIRY] ?? {};
  const cell = bucket[Number(strike).toFixed(1)] ?? bucket[String(Number(strike))] ?? {};
  return {
    call1Pct: Number(cell.CALL ?? 0) || 0,
    put1Pct: Number(cell.PUT ?? 0) || 0,
    present: Object.keys(cell).length > 0,
  };
}

function metrics(rows, key) {
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(rows.length, 1);
  const sse = rows.reduce((sum, row) => sum + (row.target - row[key]) ** 2, 0);
  const sst = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  return {
    n: rows.length,
    coverage: rows.filter((row) => row.present).length / Math.max(rows.length, 1),
    rmse: Math.sqrt(sse / Math.max(rows.length, 1)),
    mae: rows.reduce((sum, row) => sum + Math.abs(row.target - row[key]), 0) / Math.max(rows.length, 1),
    r2: sst ? 1 - sse / sst : 0,
    sign: rows.reduce((sum, row) => sum + (Math.sign(row.target) === Math.sign(row[key]) ? 1 : 0), 0) / Math.max(rows.length, 1),
  };
}

function correlation(rows, leftKey, rightKey) {
  const leftMean = rows.reduce((sum, row) => sum + row[leftKey], 0) / Math.max(rows.length, 1);
  const rightMean = rows.reduce((sum, row) => sum + row[rightKey], 0) / Math.max(rows.length, 1);
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (const row of rows) {
    const left = row[leftKey] - leftMean;
    const right = row[rightKey] - rightMean;
    numerator += left * right;
    leftSquare += left * left;
    rightSquare += right * right;
  }
  return numerator / Math.sqrt(Math.max(leftSquare * rightSquare, Number.EPSILON));
}

function fitScale(rows, key) {
  const denominator = rows.reduce((sum, row) => sum + row[key] ** 2, 0);
  const scale = denominator
    ? rows.reduce((sum, row) => sum + row[key] * row.target, 0) / denominator
    : 0;
  const fittedKey = `${key}Fitted`;
  for (const row of rows) row[fittedKey] = row[key] * scale;
  return { scale, ...metrics(rows, fittedKey) };
}

function money(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(3)}M`;
}

const targetPayload = JSON.parse(fs.readFileSync(TARGET_PATH, "utf8"));
const intervalPayload = JSON.parse(fs.readFileSync(INTERVAL_PATH, "utf8"));
const targets = targetPayload.targets?.["1000"];
if (!targets) throw new Error("Missing Trinity 10:00 ET target lattice.");

const frames = Object.fromEntries(SYMBOLS.map((symbol) => {
  const frame = materializedFrame(intervalPayload[symbol]);
  if (!frame) throw new Error(`Missing QuantData frame for ${symbol}.`);
  return [symbol, frame];
}));

const rows = [];
for (const symbol of SYMBOLS) {
  for (const targetRow of targets[symbol] ?? []) {
    const strike = Number(targetRow.strike);
    const target = Number(targetRow.value);
    const cell = strikeCell(frames[symbol], strike);
    const divisor = SPOT[symbol] * 0.01;
    const callDollar = cell.call1Pct / divisor;
    const putDollar = cell.put1Pct / divisor;
    rows.push({
      symbol,
      strike,
      target,
      ...cell,
      callDollar,
      putDollar,
      structuralDollar: callDollar + putDollar,
      callMinusPutDollar: callDollar - putDollar,
      dealerMirrorDollar: -callDollar - putDollar,
      dealerCallShortDollar: -callDollar + putDollar,
      dealerPutShortDollar: callDollar - putDollar,
      grossDollar: Math.abs(callDollar) + Math.abs(putDollar),
    });
  }
}

const candidates = [
  "structuralDollar",
  "callMinusPutDollar",
  "dealerMirrorDollar",
  "dealerCallShortDollar",
  "dealerPutShortDollar",
  "grossDollar",
];

const report = {
  asOf: new Date(AS_OF).toISOString(),
  expiry: EXPIRY,
  frames: Object.fromEntries(SYMBOLS.map((symbol) => [symbol, new Date(frames[symbol].timestamp).toISOString()])),
  spots: SPOT,
  overall: {},
  bySymbol: {},
  selectedRows: [],
};

for (const candidate of candidates) {
  report.overall[candidate] = {
    raw: metrics(rows, candidate),
    fitted: fitScale(rows, candidate),
    correlation: correlation(rows, candidate, "target"),
  };
}

for (const symbol of SYMBOLS) {
  const symbolRows = rows.filter((row) => row.symbol === symbol);
  report.bySymbol[symbol] = {};
  for (const candidate of candidates) {
    report.bySymbol[symbol][candidate] = {
      raw: metrics(symbolRows, candidate),
      fitted: fitScale(symbolRows, candidate),
      correlation: correlation(symbolRows, candidate, "target"),
    };
  }
}

const selected = {
  SPX: new Set([7700, 7690, 7680, 7675, 7670, 7665, 7640, 7610]),
  SPY: new Set([775, 770, 768, 767, 766, 765, 764, 763, 762, 761, 760]),
  QQQ: new Set([717, 716, 715, 714, 713, 712, 711, 710, 709, 708, 700]),
};
report.selectedRows = rows.filter((row) => selected[row.symbol]?.has(row.strike)).map((row) => ({
  symbol: row.symbol,
  strike: row.strike,
  target: row.target,
  call1Pct: row.call1Pct,
  put1Pct: row.put1Pct,
  callDollar: row.callDollar,
  putDollar: row.putDollar,
  structuralDollar: row.structuralDollar,
  callMinusPutDollar: row.callMinusPutDollar,
  present: row.present,
}));

const outputPath = path.resolve(ROOT, "tmp/trinity-dollar-gamma-2026-08-21.json");
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Exact frame: ${Object.entries(report.frames).map(([symbol, timestamp]) => `${symbol} ${timestamp}`).join(" | ")}`);
console.log(`Rows: ${rows.length}; cells present: ${rows.filter((row) => row.present).length}`);
console.log("Candidate                         raw RMSE       raw R2   sign    fitted scale   fitted RMSE  correlation");
for (const candidate of candidates) {
  const item = report.overall[candidate];
  console.log(`${candidate.padEnd(32)} ${money(item.raw.rmse).padStart(12)} ${item.raw.r2.toFixed(4).padStart(9)} ${(item.raw.sign * 100).toFixed(1).padStart(5)}% ${item.fitted.scale.toFixed(6).padStart(14)} ${money(item.fitted.rmse).padStart(12)} ${item.correlation.toFixed(4).padStart(12)}`);
}
console.log("\nSelected exact rows (Trinity vs QuantData dollar-gamma):");
for (const row of report.selectedRows) {
  console.log(`${row.symbol.padEnd(3)} ${String(row.strike).padStart(7)} target ${money(row.target).padStart(12)}  call ${money(row.callDollar).padStart(12)}  put ${money(row.putDollar).padStart(12)}  sum ${money(row.structuralDollar).padStart(12)}  diff ${money(row.callMinusPutDollar).padStart(12)}  ${row.present ? "present" : "missing"}`);
}
console.log(`\nWrote ${outputPath}`);
