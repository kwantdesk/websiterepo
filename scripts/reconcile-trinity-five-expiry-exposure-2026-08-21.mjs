#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const TARGET_PATH = "C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json";
const MODES = ["RAW", "PER_ONE_DOLLAR_MOVE", "PER_ONE_PERCENT_MOVE"];
const TICKERS = ["SPX", "SPY", "QQQ"];
const EXPIRY_COUNT = 5;

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
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt));
      continue;
    }
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  throw new Error(`${endpoint} exhausted its retry budget.`);
}

function exposureSurface(payload, ticker) {
  const exposureMap = payload?.data?.[ticker]?.exposureMap;
  if (!exposureMap || typeof exposureMap !== "object") return null;
  const expirations = Object.keys(exposureMap)
    .filter((expiration) => expiration >= SESSION_DATE)
    .sort();
  return { exposureMap, expirations };
}

function cellParts(cell) {
  if (!cell || typeof cell !== "object") return { call: 0, put: 0, net: 0, gross: 0 };
  const call = Number(cell.callExposure ?? cell.CALL ?? cell.call ?? 0) || 0;
  const put = Number(cell.putExposure ?? cell.PUT ?? cell.put ?? 0) || 0;
  return { call, put, net: call + put, gross: Math.abs(call) + Math.abs(put) };
}

function strikeParts(surface, strike, count = EXPIRY_COUNT) {
  const result = { call: 0, put: 0, net: 0, gross: 0 };
  const selected = surface.expirations.slice(0, count);
  for (const expiration of selected) {
    const bucket = surface.exposureMap[expiration];
    const direct = bucket?.[String(strike)] ?? bucket?.[Number(strike).toFixed(1)];
    const parts = cellParts(direct);
    result.call += parts.call;
    result.put += parts.put;
    result.net += parts.net;
    result.gross += parts.gross;
  }
  return result;
}

function olsOne(rows, key, intercept = false) {
  if (!intercept) {
    const denominator = rows.reduce((sum, row) => sum + row[key] ** 2, 0);
    const scale = denominator ? rows.reduce((sum, row) => sum + row[key] * row.target, 0) / denominator : 0;
    return score(rows, (row) => scale * row[key], { scale });
  }
  const meanX = rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
  const meanY = rows.reduce((sum, row) => sum + row.target, 0) / rows.length;
  const denominator = rows.reduce((sum, row) => sum + (row[key] - meanX) ** 2, 0);
  const scale = denominator ? rows.reduce((sum, row) => sum + (row[key] - meanX) * (row.target - meanY), 0) / denominator : 0;
  const offset = meanY - scale * meanX;
  return score(rows, (row) => offset + scale * row[key], { scale, offset });
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

function olsMany(rows, keys, ridge = 1e-8) {
  const columns = ["__intercept", ...keys];
  const matrix = columns.map((left, i) => columns.map((right, j) => rows.reduce((sum, row) => {
    const x = left === "__intercept" ? 1 : row[left];
    const y = right === "__intercept" ? 1 : row[right];
    return sum + x * y;
  }, 0) + (i === j && i > 0 ? ridge : 0)));
  const vector = columns.map((column) => rows.reduce((sum, row) => sum + (column === "__intercept" ? 1 : row[column]) * row.target, 0));
  const coefficients = solveLinear(matrix, vector);
  return score(rows, (row) => coefficients.reduce((sum, value, index) => sum + value * (columns[index] === "__intercept" ? 1 : row[columns[index]]), 0), {
    coefficients: Object.fromEntries(columns.map((column, index) => [column, coefficients[index]])),
  });
}

function score(rows, predict, detail = {}) {
  const predictions = rows.map(predict);
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / rows.length;
  const squaredError = rows.reduce((sum, row, index) => sum + (row.target - predictions[index]) ** 2, 0);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  const sign = rows.reduce((sum, row, index) => sum + (Math.sign(row.target) === Math.sign(predictions[index]) ? 1 : 0), 0) / rows.length;
  return { ...detail, r2: total ? 1 - squaredError / total : 0, rmse: Math.sqrt(squaredError / rows.length), sign, predictions };
}

function compactMoney(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(2)}M`;
}

const targetPayload = JSON.parse(fs.readFileSync(TARGET_PATH, "utf8"));
const targetAt1000 = targetPayload.targets?.["1000"];
if (!targetAt1000) throw new Error("The 10:00 ET Trinity target lattice is missing.");

const surfaces = new Map();
for (const ticker of TICKERS) {
  for (const mode of MODES) {
    const payload = await quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate: SESSION_DATE,
      greekMode: "GAMMA",
      representationMode: mode,
      filter: { ticker },
    });
    const surface = exposureSurface(payload, ticker);
    if (!surface) throw new Error(`No ${mode} exposure surface was returned for ${ticker}.`);
    surfaces.set(`${ticker}:${mode}`, surface);
  }
}

const rows = [];
for (const ticker of TICKERS) {
  for (const targetRow of targetAt1000[ticker]) {
    const row = { ticker: ticker === "SPX" ? "SPXW" : ticker, strike: Number(targetRow.strike), target: Number(targetRow.value) };
    for (const mode of MODES) {
      const surface = surfaces.get(`${ticker}:${mode}`);
      for (let count = 1; count <= EXPIRY_COUNT; count += 1) {
        const parts = strikeParts(surface, row.strike, count);
        for (const [part, value] of Object.entries(parts)) row[`${mode}_${count}_${part}`] = value;
      }
    }
    rows.push(row);
  }
}

console.log(`# Trinity five-expiry exposure reconciliation — ${SESSION_DATE} 10:00 ET`);
console.log(`Rows: ${rows.length} (${TICKERS.join(", ")})`);
for (const ticker of TICKERS) {
  const surface = surfaces.get(`${ticker}:PER_ONE_PERCENT_MOVE`);
  console.log(`${ticker} first five expirations: ${surface.expirations.slice(0, EXPIRY_COUNT).join(", ")}`);
}

const candidates = [];
for (const mode of MODES) {
  for (let count = 1; count <= EXPIRY_COUNT; count += 1) {
    for (const part of ["call", "put", "net", "gross"]) {
      const key = `${mode}_${count}_${part}`;
      candidates.push({ name: key, noIntercept: olsOne(rows, key, false), intercept: olsOne(rows, key, true) });
    }
  }
}
candidates.sort((left, right) => right.intercept.r2 - left.intercept.r2);

console.log("\nBest one-factor inventory candidates:");
console.log("| Candidate | R² | RMSE | Sign | Scale | Offset |");
console.log("|---|---:|---:|---:|---:|---:|");
for (const candidate of candidates.slice(0, 12)) {
  const fit = candidate.intercept;
  console.log(`| ${candidate.name} | ${fit.r2.toFixed(4)} | ${compactMoney(fit.rmse)} | ${(fit.sign * 100).toFixed(1)}% | ${fit.scale.toFixed(6)} | ${compactMoney(fit.offset)} |`);
}

const componentModels = [];
for (const mode of MODES) {
  for (let count = 1; count <= EXPIRY_COUNT; count += 1) {
    const keys = [`${mode}_${count}_call`, `${mode}_${count}_put`];
    componentModels.push({ name: `${mode}_${count}_call+put`, keys, fit: olsMany(rows, keys) });
  }
}
componentModels.sort((left, right) => right.fit.r2 - left.fit.r2);
console.log("\nBest call/put component models:");
console.log("| Candidate | R² | RMSE | Sign | Coefficients |");
console.log("|---|---:|---:|---:|---|");
for (const candidate of componentModels.slice(0, 8)) {
  console.log(`| ${candidate.name} | ${candidate.fit.r2.toFixed(4)} | ${compactMoney(candidate.fit.rmse)} | ${(candidate.fit.sign * 100).toFixed(1)}% | ${JSON.stringify(candidate.fit.coefficients)} |`);
}

const expiryKeys = [];
for (let count = 1; count <= EXPIRY_COUNT; count += 1) {
  const prefix = `PER_ONE_PERCENT_MOVE_${count}`;
  const priorPrefix = count > 1 ? `PER_ONE_PERCENT_MOVE_${count - 1}` : null;
  for (const part of ["call", "put"]) {
    const key = `EXP_${count}_${part}`;
    for (const row of rows) row[key] = row[`${prefix}_${part}`] - (priorPrefix ? row[`${priorPrefix}_${part}`] : 0);
    expiryKeys.push(key);
  }
}
const expiryModel = olsMany(rows, expiryKeys, 1e-4);
console.log("\nPer-expiration call/put model (diagnostic, not a production formula):");
console.log(JSON.stringify({ r2: expiryModel.r2, rmse: expiryModel.rmse, sign: expiryModel.sign, coefficients: expiryModel.coefficients }, null, 2));

console.log("\nLeave-one-symbol-out validation for the best call/put model family:");
for (const holdout of ["SPXW", "SPY", "QQQ"]) {
  const train = rows.filter((row) => row.ticker !== holdout);
  const test = rows.filter((row) => row.ticker === holdout);
  const keys = componentModels[0].keys;
  const trained = olsMany(train, keys);
  const coefficients = trained.coefficients;
  const tested = score(test, (row) => coefficients.__intercept + keys.reduce((sum, key) => sum + coefficients[key] * row[key], 0));
  console.log(`- hold out ${holdout}: R² ${tested.r2.toFixed(4)}, RMSE ${compactMoney(tested.rmse)}, sign ${(tested.sign * 100).toFixed(1)}%`);
}

const best = componentModels[0];
console.log("\nSelected target rows under the best component model:");
console.log("| Ticker | Strike | Trinity | Predicted | Error |");
console.log("|---|---:|---:|---:|---:|");
rows.forEach((row, index) => {
  if (![7680, 760, 708].includes(row.strike)) return;
  const predicted = best.fit.predictions[index];
  console.log(`| ${row.ticker} | ${row.strike} | ${compactMoney(row.target)} | ${compactMoney(predicted)} | ${compactMoney(predicted - row.target)} |`);
});
