#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const SESSION_OPEN_ISO = "2026-08-21T13:30:00.000Z";
const CUTOFF_ISO = "2026-08-21T14:00:01.000Z";
const INPUT_PATH = path.resolve(process.cwd(), "tmp/reconcile-opra-gex-2026-08-21.out.txt");
const OUTPUT_PATH = path.resolve(process.cwd(), "tmp/trinity-premium-flow-2026-08-21.json");

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
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      continue;
    }
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  throw new Error(`${endpoint} exhausted its retry budget.`);
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inputRows() {
  const text = fs.readFileSync(INPUT_PATH, "utf8");
  const line = text.split(/\r?\n/).find((value) => value.startsWith("JSON_RESULT="));
  if (!line) throw new Error(`Missing JSON_RESULT in ${INPUT_PATH}`);
  return JSON.parse(line.slice("JSON_RESULT=".length)).rows;
}

function sideNode(payload, type, side) {
  const node = payload?.data?.[type]?.[side] || {};
  return { premium: finite(node.premium), volume: finite(node.volume), count: finite(node.count) };
}

function summarizeType(payload, type) {
  const buySides = ["ABOVE_ASK", "ASK"].map((side) => sideNode(payload, type, side));
  const sellSides = ["BID", "BELOW_BID"].map((side) => sideNode(payload, type, side));
  const mid = sideNode(payload, type, "MID_MARKET");
  const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
  const boughtPremium = sum(buySides, "premium");
  const soldPremium = sum(sellSides, "premium");
  const boughtVolume = sum(buySides, "volume");
  const soldVolume = sum(sellSides, "volume");
  return {
    boughtPremium,
    soldPremium,
    netCustomerPremium: boughtPremium - soldPremium,
    grossDirectionalPremium: boughtPremium + soldPremium,
    boughtVolume,
    soldVolume,
    netCustomerVolume: boughtVolume - soldVolume,
    grossDirectionalVolume: boughtVolume + soldVolume,
    midPremium: mid.premium,
    midVolume: mid.volume,
    averageBoughtPremiumPerContract: boughtVolume > 0 ? boughtPremium / boughtVolume : 0,
    averageSoldPremiumPerContract: soldVolume > 0 ? soldPremium / soldVolume : 0,
  };
}

async function fetchStrike(row) {
  const ticker = row.ticker === "SPXW" ? "SPX" : row.ticker;
  const payload = await quantDataPost("/options/tool/contract-trade-side-statistics", {
    timeRange: { startTime: SESSION_OPEN_ISO, endTime: CUTOFF_ISO },
    dataMode: "PREMIUM",
    filter: { ticker, expirationDate: SESSION_DATE, strikePrice: row.strike },
  });
  return { ...row, sourceTicker: ticker, call: summarizeType(payload, "CALL"), put: summarizeType(payload, "PUT") };
}

function solveLeastSquares(rows, keys, ridge = 1e-12) {
  const n = keys.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  const vector = Array(n).fill(0);
  for (const row of rows) {
    const values = keys.map((key) => finite(row.features[key]));
    for (let i = 0; i < n; i += 1) {
      vector[i] += values[i] * row.target;
      for (let j = 0; j < n; j += 1) matrix[i][j] += values[i] * values[j];
    }
  }
  for (let i = 0; i < n; i += 1) matrix[i][i] += ridge;
  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[best][pivot])) best = row;
    }
    [matrix[pivot], matrix[best]] = [matrix[best], matrix[pivot]];
    [vector[pivot], vector[best]] = [vector[best], vector[pivot]];
    const divisor = matrix[pivot][pivot];
    if (Math.abs(divisor) < 1e-18) continue;
    for (let column = pivot; column < n; column += 1) matrix[pivot][column] /= divisor;
    vector[pivot] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = matrix[row][pivot];
      for (let column = pivot; column < n; column += 1) matrix[row][column] -= factor * matrix[pivot][column];
      vector[row] -= factor * vector[pivot];
    }
  }
  return vector;
}

function metrics(rows, predictions) {
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / rows.length;
  const residual = rows.reduce((sum, row, index) => sum + (row.target - predictions[index]) ** 2, 0);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  return {
    n: rows.length,
    rmse: Math.sqrt(residual / rows.length),
    mae: rows.reduce((sum, row, index) => sum + Math.abs(row.target - predictions[index]), 0) / rows.length,
    r2: total > 0 ? 1 - residual / total : 0,
    sign: rows.filter((row, index) => Math.sign(row.target) === Math.sign(predictions[index])).length / rows.length,
  };
}

function fit(rows, keys) {
  const coefficients = solveLeastSquares(rows, keys);
  const predictions = rows.map((row) => keys.reduce((sum, key, index) => sum + coefficients[index] * row.features[key], 0));
  return { keys, coefficients, ...metrics(rows, predictions) };
}

const baseline = inputRows();
const enriched = [];
for (let index = 0; index < baseline.length; index += 4) {
  const batch = await Promise.all(baseline.slice(index, index + 4).map(fetchStrike));
  enriched.push(...batch);
}

for (const row of enriched) {
  const spot = row.ticker === "SPXW" ? 7665.14 : row.ticker === "SPY" ? 764.45 : 711.55;
  const onePercent = 100 * spot * spot * 0.01;
  const callPremium = row.call.netCustomerPremium;
  const putPremium = row.put.netCustomerPremium;
  const callVolume = row.call.netCustomerVolume;
  const putVolume = row.put.netCustomerVolume;
  row.features = {
    callPremium,
    putPremium,
    dealerPremium: -(callPremium + putPremium),
    directionalPremium: callPremium - putPremium,
    callPremiumGamma: callPremium * row.callGamma,
    putPremiumGamma: putPremium * row.putGamma,
    dealerPremiumGamma: -(callPremium * row.callGamma + putPremium * row.putGamma),
    directionalPremiumGamma: callPremium * row.callGamma - putPremium * row.putGamma,
    callFlowGex: -callVolume * row.callGamma * onePercent,
    putFlowGex: -putVolume * row.putGamma * onePercent,
    directDealerFlowGex: -(callVolume * row.callGamma + putVolume * row.putGamma) * onePercent,
    directionalFlowGex: (callVolume * row.callGamma - putVolume * row.putGamma) * onePercent,
    structuralGex: row.oiPerOnePercent,
    grossOiGex: row.grossOiPerOnePercent,
    intercept: 1,
  };
}

const featureSets = {
  dealerPremium: ["dealerPremium"],
  directionalPremium: ["directionalPremium"],
  dealerPremiumGamma: ["dealerPremiumGamma"],
  directionalPremiumGamma: ["directionalPremiumGamma"],
  callPutPremium: ["callPremium", "putPremium"],
  callPutPremiumGamma: ["callPremiumGamma", "putPremiumGamma"],
  callPutFlowGex: ["callFlowGex", "putFlowGex"],
  premiumAndFlow: ["callPremium", "putPremium", "callFlowGex", "putFlowGex"],
  premiumFlowAndOi: ["callPremium", "putPremium", "callFlowGex", "putFlowGex", "structuralGex", "grossOiGex"],
};

const fits = Object.fromEntries(Object.entries(featureSets).map(([name, keys]) => [name, fit(enriched, keys)]));
const symbolFits = Object.fromEntries([...new Set(enriched.map((row) => row.ticker))].map((ticker) => [
  ticker,
  Object.fromEntries(Object.entries(featureSets).map(([name, keys]) => [name, fit(enriched.filter((row) => row.ticker === ticker), keys)])),
]));

const output = { sessionDate: SESSION_DATE, cutoff: CUTOFF_ISO, rows: enriched, fits, symbolFits };
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
console.log(JSON.stringify({ output: OUTPUT_PATH, fits, symbolFits }, null, 2));
