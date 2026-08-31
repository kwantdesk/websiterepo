#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const FRONT_EXPIRY = "2026-08-21";
const CUTOFF_MS = Date.parse("2026-08-21T14:00:01.000Z");
const TARGET_PATH = "C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json";
const MODES = ["RAW", "PER_ONE_DOLLAR_MOVE", "PER_ONE_PERCENT_MOVE"];
const TICKERS = ["SPX", "SPY", "QQQ"];
const SPOTS = { SPXW: 7665.14, SPY: 764.45, QQQ: 711.55 };

function readDotEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = { ...readDotEnv(path.resolve(process.cwd(), ".env.local")), ...process.env };
const gatewayUrl = String(env.KWANTIFY_MARKET_DATA_GATEWAY_URL || "").replace(/\/$/, "");
const gatewayToken = String(env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN || "");
if (!gatewayUrl || !gatewayToken) throw new Error("The VPS market-data gateway is not configured.");

async function quantDataPost(endpoint, body) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
      continue;
    }
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  throw new Error(`${endpoint} exhausted its retry budget.`);
}

function nearestFrame(payload) {
  const data = payload?.data;
  if (!data || typeof data !== "object") return null;
  const timestamp = Object.keys(data)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value <= CUTOFF_MS)
    .sort((left, right) => left - right)
    .at(-1);
  return Number.isFinite(timestamp) ? { timestamp, bucket: data[String(timestamp)] } : null;
}

function strikeCell(frame, strike, expiry = FRONT_EXPIRY) {
  const expiryBucket = frame?.bucket?.[expiry];
  const strikeKey = Number(strike).toFixed(1);
  const cell = expiryBucket?.[strikeKey] ?? expiryBucket?.[String(Number(strike))];
  const call = Number(cell?.CALL ?? cell?.call ?? cell?.callExposure ?? 0) || 0;
  const put = Number(cell?.PUT ?? cell?.put ?? cell?.putExposure ?? 0) || 0;
  return { cell, call, put };
}

function solveLinear(matrix, vector) {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    if (Math.abs(divisor) < 1e-12) continue;
    for (let j = column; j <= n; j += 1) augmented[column][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let j = column; j <= n; j += 1) augmented[row][j] -= factor * augmented[column][j];
    }
  }
  return augmented.map((row) => row[n]);
}

function fitLinear(train, keys, { intercept = true, ridge = 1e-8 } = {}) {
  const columns = intercept ? ["__intercept", ...keys] : [...keys];
  const matrix = columns.map((left, i) => columns.map((right, j) => train.reduce((sum, row) => {
    const x = left === "__intercept" ? 1 : row[left];
    const y = right === "__intercept" ? 1 : row[right];
    return sum + x * y;
  }, 0) + (i === j && columns[i] !== "__intercept" ? ridge : 0)));
  const vector = columns.map((column) => train.reduce((sum, row) => sum + (column === "__intercept" ? 1 : row[column]) * row.target, 0));
  const coefficients = solveLinear(matrix, vector);
  return {
    columns,
    coefficients,
    predict: (row) => coefficients.reduce((sum, value, index) => sum + value * (columns[index] === "__intercept" ? 1 : row[columns[index]]), 0),
  };
}

function metrics(rows, predict) {
  const predictions = rows.map(predict);
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(1, rows.length);
  const sse = rows.reduce((sum, row, index) => sum + (row.target - predictions[index]) ** 2, 0);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  return {
    r2: total ? 1 - sse / total : 0,
    rmse: Math.sqrt(sse / Math.max(1, rows.length)),
    sign: rows.reduce((sum, row, index) => sum + (Math.sign(row.target) === Math.sign(predictions[index]) ? 1 : 0), 0) / Math.max(1, rows.length),
  };
}

function evaluate(rows, keys, options = {}) {
  const model = fitLinear(rows, keys, options);
  return { keys, model, ...metrics(rows, model.predict) };
}

function money(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(3)}M`;
}

const targetPayload = JSON.parse(fs.readFileSync(TARGET_PATH, "utf8"));
const targetAt1000 = targetPayload.targets?.["1000"];
if (!targetAt1000) throw new Error("The 10:00 ET Trinity target lattice is missing.");

const frames = new Map();
for (const ticker of TICKERS) {
  for (const mode of MODES) {
    const payload = await quantDataPost("/options/tool/interval-map", {
      sessionDate: SESSION_DATE,
      aggregationPeriod: "1m",
      greekMode: "GAMMA",
      representationMode: mode,
      filter: { ticker },
    });
    const frame = nearestFrame(payload);
    if (!frame) throw new Error(`No interval frame was returned for ${ticker}:${mode}.`);
    frames.set(`${ticker}:${mode}`, frame);
  }
}

const rows = [];
for (const ticker of TICKERS) {
  const displayTicker = ticker === "SPX" ? "SPXW" : ticker;
  for (const targetRow of targetAt1000[ticker]) {
    const strike = Number(targetRow.strike);
    const row = {
      ticker: displayTicker,
      strike,
      target: Number(targetRow.value),
      spot: SPOTS[displayTicker],
      distance: strike - SPOTS[displayTicker],
      distancePct: (strike / SPOTS[displayTicker]) - 1,
    };
    for (const mode of MODES) {
      const { call, put } = strikeCell(frames.get(`${ticker}:${mode}`), strike);
      const prefix = mode;
      row[`${prefix}_call`] = call;
      row[`${prefix}_put`] = put;
      row[`${prefix}_sum`] = call + put;
      row[`${prefix}_diff`] = call - put;
      row[`${prefix}_dealer`] = -call + put;
      row[`${prefix}_gross`] = Math.abs(call) + Math.abs(put);
      row[`${prefix}_absDiff`] = Math.abs(call) - Math.abs(put);
      row[`${prefix}_sumDistance`] = (call + put) * row.distancePct;
      row[`${prefix}_diffDistance`] = (call - put) * row.distancePct;
    }
    rows.push(row);
  }
}

console.log(`# Trinity exact front-expiry interval reconciliation — ${SESSION_DATE} 10:00 ET`);
console.log(`Rows: ${rows.length}`);
for (const [key, frame] of frames) {
  const expirations = Object.keys(frame.bucket || {}).sort();
  console.log(`- ${key}: frame ${new Date(frame.timestamp).toISOString()}, expirations ${expirations.slice(0, 8).join(", ")}`);
}
const sample = strikeCell(frames.get("SPY:PER_ONE_PERCENT_MOVE"), 760);
console.log(`Sample SPY 760 cell keys: ${Object.keys(sample.cell || {}).join(", ")}`);

const candidates = [];
for (const mode of MODES) {
  for (const part of ["call", "put", "sum", "diff", "dealer", "gross", "absDiff", "sumDistance", "diffDistance"]) {
    for (const intercept of [false, true]) {
      candidates.push({ name: `${mode}_${part}${intercept ? "+i" : ""}`, ...evaluate(rows, [`${mode}_${part}`], { intercept }) });
    }
  }
  candidates.push({ name: `${mode}_call+put`, ...evaluate(rows, [`${mode}_call`, `${mode}_put`]) });
  candidates.push({ name: `${mode}_call+put+distance`, ...evaluate(rows, [`${mode}_call`, `${mode}_put`, "distancePct"]) });
}
candidates.sort((left, right) => left.rmse - right.rmse);

console.log("\nBest global front-expiry candidates:");
console.log("| Candidate | R² | RMSE | Sign | Coefficients |");
console.log("|---|---:|---:|---:|---|");
for (const candidate of candidates.slice(0, 16)) {
  const coefficients = Object.fromEntries(candidate.model.columns.map((column, index) => [column, candidate.model.coefficients[index]]));
  console.log(`| ${candidate.name} | ${candidate.r2.toFixed(4)} | ${money(candidate.rmse)} | ${(candidate.sign * 100).toFixed(1)}% | ${JSON.stringify(coefficients)} |`);
}

console.log("\nPer-symbol best candidates:");
for (const ticker of ["SPXW", "SPY", "QQQ"]) {
  const tickerRows = rows.filter((row) => row.ticker === ticker);
  const ranked = [];
  for (const mode of MODES) {
    for (const part of ["call", "put", "sum", "diff", "dealer", "gross", "absDiff"]) {
      ranked.push({ name: `${mode}_${part}`, ...evaluate(tickerRows, [`${mode}_${part}`], { intercept: false }) });
      ranked.push({ name: `${mode}_${part}+i`, ...evaluate(tickerRows, [`${mode}_${part}`], { intercept: true }) });
    }
    ranked.push({ name: `${mode}_call+put`, ...evaluate(tickerRows, [`${mode}_call`, `${mode}_put`]) });
  }
  ranked.sort((left, right) => left.rmse - right.rmse);
  const best = ranked[0];
  const coefficients = Object.fromEntries(best.model.columns.map((column, index) => [column, best.model.coefficients[index]]));
  console.log(`- ${ticker}: ${best.name}, R² ${best.r2.toFixed(4)}, RMSE ${money(best.rmse)}, sign ${(best.sign * 100).toFixed(1)}%, ${JSON.stringify(coefficients)}`);
}

console.log("\nLeave-one-symbol-out for selected global families:");
for (const keys of [
  ["RAW_call", "RAW_put"],
  ["PER_ONE_DOLLAR_MOVE_call", "PER_ONE_DOLLAR_MOVE_put"],
  ["PER_ONE_PERCENT_MOVE_call", "PER_ONE_PERCENT_MOVE_put"],
]) {
  console.log(`- ${keys.join(" + ")}`);
  for (const holdout of ["SPXW", "SPY", "QQQ"]) {
    const train = rows.filter((row) => row.ticker !== holdout);
    const test = rows.filter((row) => row.ticker === holdout);
    const model = fitLinear(train, keys);
    const result = metrics(test, model.predict);
    console.log(`  ${holdout}: R² ${result.r2.toFixed(4)}, RMSE ${money(result.rmse)}, sign ${(result.sign * 100).toFixed(1)}%`);
  }
}

console.log("\nKey rows with exact interval inputs:");
console.log("| Ticker | Strike | Trinity | RAW call | RAW put | $1 call | $1 put | 1% call | 1% put |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const row of rows) {
  if (!((row.ticker === "SPXW" && [7680, 7640].includes(row.strike)) || (row.ticker === "SPY" && [760, 764, 766, 768, 775].includes(row.strike)) || (row.ticker === "QQQ" && [700, 708, 712, 714, 717].includes(row.strike)))) continue;
  console.log(`| ${row.ticker} | ${row.strike} | ${money(row.target)} | ${money(row.RAW_call)} | ${money(row.RAW_put)} | ${money(row.PER_ONE_DOLLAR_MOVE_call)} | ${money(row.PER_ONE_DOLLAR_MOVE_put)} | ${money(row.PER_ONE_PERCENT_MOVE_call)} | ${money(row.PER_ONE_PERCENT_MOVE_put)} |`);
}
