#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const EXPIRATION = "2026-08-21";
const OPENING_FILE = process.env.TRINITY_OPENING_LATTICE
  || "scripts/trinity-opening-lattice-2026-08-21.json";
const FULL_FILE = process.env.TRINITY_FULL_LATTICES
  || "C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json";

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
  const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function strikeKey(value) {
  return Number(value).toFixed(1);
}

function exposureMap(payload, ticker) {
  const root = payload?.data?.[ticker] ?? payload?.data;
  return root?.exposureMap?.[EXPIRATION] ?? {};
}

function exposureAt(map, strike) {
  return map[strikeKey(strike)] ?? map[String(Number(strike))] ?? {};
}

function solveLinear(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    }
    [a[column], a[pivot]] = [a[pivot], a[column]];
    if (Math.abs(a[column][column]) < 1e-12) a[column][column] = 1e-12;
    const divisor = a[column][column];
    for (let j = column; j <= n; j += 1) a[column][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const scale = a[row][column];
      for (let j = column; j <= n; j += 1) a[row][j] -= scale * a[column][j];
    }
  }
  return a.map((row) => row[n]);
}

function designValue(row, name) {
  if (name === "intercept") return 1;
  return number(row[name]);
}

function metrics(rows, predictions) {
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(1, rows.length);
  const sse = rows.reduce((sum, row, index) => sum + (row.target - predictions[index]) ** 2, 0);
  const sst = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  const sign = rows.filter((row, index) => Math.sign(row.target) === Math.sign(predictions[index])).length / Math.max(1, rows.length);
  const direction = rows.filter((row, index) => Math.sign(row.target - row.opening) === Math.sign(predictions[index] - row.opening)).length / Math.max(1, rows.length);
  return {
    rmse: Math.sqrt(sse / Math.max(1, rows.length)),
    r2: sst ? 1 - sse / sst : 0,
    sign,
    direction,
  };
}

function fit(rows, features, includeIntercept = false) {
  const names = includeIntercept ? ["intercept", ...features] : features;
  const x = rows.map((row) => names.map((name) => designValue(row, name)));
  const y = rows.map((row) => row.target);
  const xtx = names.map((_, i) => names.map((__, j) => x.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const xty = names.map((_, i) => x.reduce((sum, row, index) => sum + row[i] * y[index], 0));
  const ridge = Math.max(...xtx.map((row, index) => Math.abs(row[index])), 1) * 1e-12;
  for (let index = 0; index < xtx.length; index += 1) xtx[index][index] += ridge;
  const weights = solveLinear(xtx, xty);
  const predictions = x.map((row) => row.reduce((sum, value, index) => sum + value * weights[index], 0));
  return {
    features: names,
    weights,
    predictions,
    ...metrics(rows, predictions),
  };
}

function predict(row, model) {
  return model.features.reduce((sum, name, index) => sum + designValue(row, name) * model.weights[index], 0);
}

function symbolHoldout(rows, features, includeIntercept = false) {
  const predictions = [];
  const testRows = [];
  for (const symbol of [...new Set(rows.map((row) => row.symbol))]) {
    const train = rows.filter((row) => row.symbol !== symbol);
    const test = rows.filter((row) => row.symbol === symbol);
    const model = fit(train, features, includeIntercept);
    for (const row of test) {
      testRows.push(row);
      predictions.push(predict(row, model));
    }
  }
  return metrics(testRows, predictions);
}

function money(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(2)}M`;
}

const openingPayload = JSON.parse(fs.readFileSync(path.resolve(OPENING_FILE), "utf8"));
const fullPayload = JSON.parse(fs.readFileSync(path.resolve(FULL_FILE), "utf8"));
const currentPayload = fullPayload?.targets?.["1000"];
if (!openingPayload?.targets || !currentPayload) throw new Error("Trinity opening/current lattices are unavailable.");

const sourceTicker = { SPX: "SPX", SPXW: "SPX", SPY: "SPY", QQQ: "QQQ" };
const exposureByTicker = {};
for (const ticker of ["SPX", "SPY", "QQQ"]) {
  exposureByTicker[ticker] = await quantDataPost("/options/tool/exposure-by-strike", {
    sessionDate: SESSION_DATE,
    greekMode: "GAMMA",
    representationMode: "PER_ONE_PERCENT_MOVE",
    filter: { ticker, expirationDate: EXPIRATION },
  });
}

const rows = [];
for (const [symbol, currentNodes] of Object.entries(currentPayload)) {
  const openingNodes = openingPayload.targets[symbol] ?? [];
  const openingByStrike = new Map(openingNodes.map(([strike, value]) => [number(strike), number(value)]));
  const ticker = sourceTicker[symbol];
  const exposure = exposureMap(exposureByTicker[ticker], ticker);
  for (const node of currentNodes) {
    const strike = number(node.strike);
    if (!openingByStrike.has(strike)) continue;
    const risk = exposureAt(exposure, strike);
    const callExposure = number(risk.callExposure);
    const putExposure = number(risk.putExposure);
    const opening = openingByStrike.get(strike);
    rows.push({
      symbol: symbol === "SPX" ? "SPXW" : symbol,
      strike,
      target: number(node.value),
      opening,
      callExposure,
      putExposure,
      netExposure: callExposure + putExposure,
      grossExposure: callExposure - putExposure,
      absExposure: Math.abs(callExposure) + Math.abs(putExposure),
      residual: number(node.value) - opening,
    });
  }
}

const candidateFamilies = [
  ["opening"],
  ["opening", "netExposure"],
  ["opening", "callExposure", "putExposure"],
  ["opening", "netExposure", "grossExposure"],
  ["opening", "callExposure", "putExposure", "absExposure"],
];

const results = [];
for (const features of candidateFamilies) {
  for (const intercept of [false, true]) {
    const model = fit(rows, features, intercept);
    results.push({
      features,
      intercept,
      ...model,
      holdout: symbolHoldout(rows, features, intercept),
    });
  }
}
results.sort((left, right) => left.holdout.rmse - right.holdout.rmse || left.rmse - right.rmse);

console.log(`# Trinity opening carry + structural exposure — ${SESSION_DATE} 10:00 ET`);
console.log(`\nMatched rows: ${rows.length}.`);
console.log("\n| Features | Intercept | R² | RMSE | Sign | Direction | Holdout R² | Holdout RMSE | Holdout sign | Holdout direction |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const result of results) {
  console.log(`| ${result.features.join(" + ")} | ${result.intercept ? "yes" : "no"} | ${result.r2.toFixed(4)} | ${money(result.rmse)} | ${(result.sign * 100).toFixed(1)}% | ${(result.direction * 100).toFixed(1)}% | ${result.holdout.r2.toFixed(4)} | ${money(result.holdout.rmse)} | ${(result.holdout.sign * 100).toFixed(1)}% | ${(result.holdout.direction * 100).toFixed(1)}% |`);
}

const best = results[0];
console.log(`\nBest coefficients: ${best.features.map((name, index) => `${name}=${best.weights[index].toExponential(6)}`).join(", ")}`);
console.log("\n| Symbol | Strike | 04:00 | 10:00 | Predicted | Error | Call exposure | Put exposure |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
for (const row of rows.filter((item) => [7680, 7675, 7640, 775, 768, 766, 764, 760, 717, 714, 708, 700].includes(item.strike))) {
  const predicted = predict(row, best);
  console.log(`| ${row.symbol} | ${row.strike} | ${money(row.opening)} | ${money(row.target)} | ${money(predicted)} | ${money(predicted - row.target)} | ${money(row.callExposure)} | ${money(row.putExposure)} |`);
}

console.log(`\nJSON_RESULT=${JSON.stringify({ rows: rows.length, results: results.map(({ predictions, ...result }) => result) })}`);
