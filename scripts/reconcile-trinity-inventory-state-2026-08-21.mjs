#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const PRIOR_DATE = "2026-08-20";
const EXPIRATION = "2026-08-21";
const TARGET_FILE = process.env.TRINITY_FULL_LATTICES
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
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

function keyForStrike(strike) {
  return Number(strike).toFixed(1);
}

function oiAt(payload, strike) {
  const data = payload?.data;
  if (!data || typeof data !== "object") return {};
  return data[keyForStrike(strike)] ?? data[String(Number(strike))] ?? {};
}

function exposureMap(payload, ticker) {
  const root = payload?.data?.[ticker] ?? payload?.data;
  return root?.exposureMap?.[EXPIRATION] ?? {};
}

function exposureAt(map, strike) {
  return map[keyForStrike(strike)] ?? map[String(Number(strike))] ?? {};
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function fit(rows, featureNames, includeIntercept = true) {
  const names = includeIntercept ? ["intercept", ...featureNames] : featureNames;
  const x = rows.map((row) => names.map((name) => name === "intercept" ? 1 : number(row[name])));
  const y = rows.map((row) => row.target);
  const xtx = names.map((_, i) => names.map((__, j) => x.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const xty = names.map((_, i) => x.reduce((sum, row, index) => sum + row[i] * y[index], 0));
  const ridge = Math.max(...xtx.map((row, index) => Math.abs(row[index])), 1) * 1e-12;
  for (let i = 0; i < xtx.length; i += 1) xtx[i][i] += ridge;
  const coefficients = solveLinear(xtx, xty);
  const predictions = x.map((row) => row.reduce((sum, value, index) => sum + value * coefficients[index], 0));
  return metrics(rows, predictions, Object.fromEntries(names.map((name, index) => [name, coefficients[index]])));
}

function fitScale(rows, featureName) {
  const numerator = rows.reduce((sum, row) => sum + number(row[featureName]) * row.target, 0);
  const denominator = rows.reduce((sum, row) => sum + number(row[featureName]) ** 2, 0);
  const scale = denominator ? numerator / denominator : 0;
  return metrics(rows, rows.map((row) => number(row[featureName]) * scale), { [featureName]: scale });
}

function metrics(rows, predictions, coefficients) {
  const actual = rows.map((row) => row.target);
  const mean = actual.reduce((sum, value) => sum + value, 0) / Math.max(actual.length, 1);
  const sse = actual.reduce((sum, value, index) => sum + (value - predictions[index]) ** 2, 0);
  const sst = actual.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sign = actual.reduce((sum, value, index) => sum + (Math.sign(value) === Math.sign(predictions[index]) ? 1 : 0), 0) / Math.max(actual.length, 1);
  return { coefficients, predictions, rmse: Math.sqrt(sse / Math.max(actual.length, 1)), r2: sst ? 1 - sse / sst : 0, sign };
}

function holdout(rows, featureNames, includeIntercept = true) {
  const errors = [];
  const signs = [];
  for (const symbol of ["SPXW", "SPY", "QQQ"]) {
    const training = rows.filter((row) => row.symbol !== symbol);
    const testing = rows.filter((row) => row.symbol === symbol);
    const model = fit(training, featureNames, includeIntercept);
    const names = includeIntercept ? ["intercept", ...featureNames] : featureNames;
    for (const row of testing) {
      const prediction = names.reduce((sum, name) => sum + (name === "intercept" ? 1 : number(row[name])) * number(model.coefficients[name]), 0);
      errors.push((row.target - prediction) ** 2);
      signs.push(Math.sign(row.target) === Math.sign(prediction) ? 1 : 0);
    }
  }
  return {
    rmse: Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / Math.max(errors.length, 1)),
    sign: signs.reduce((sum, value) => sum + value, 0) / Math.max(signs.length, 1),
  };
}

function money(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `${value < 0 ? "-" : ""}$${(absolute / 1e9).toFixed(2)}B`;
  return `${value < 0 ? "-" : ""}$${(absolute / 1e6).toFixed(2)}M`;
}

const targetPayload = JSON.parse(fs.readFileSync(TARGET_FILE, "utf8"));
const targetAtTen = targetPayload?.targets?.["1000"] ?? targetPayload?.targets?.[1000];
if (!targetAtTen) throw new Error("The Trinity target file does not contain a 10:00 ET lattice.");

const tickerMap = { SPXW: "SPX", SPX: "SPX", SPY: "SPY", QQQ: "QQQ" };
const payloads = {};
for (const ticker of ["SPX", "SPY", "QQQ"]) {
  const [priorOi, currentOi, currentExposure] = await Promise.all([
    quantDataPost("/options/tool/open-interest-by-strike", {
      sessionDate: PRIOR_DATE,
      filter: { ticker, expirationDate: EXPIRATION },
    }),
    quantDataPost("/options/tool/open-interest-by-strike", {
      sessionDate: SESSION_DATE,
      filter: { ticker, expirationDate: EXPIRATION },
    }),
    quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate: SESSION_DATE,
      greekMode: "GAMMA",
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker, expirationDate: EXPIRATION },
    }),
  ]);
  payloads[ticker] = { priorOi, currentOi, currentExposure };
}

const rows = [];
for (const [targetSymbol, nodes] of Object.entries(targetAtTen)) {
  const ticker = tickerMap[targetSymbol] ?? targetSymbol;
  const source = payloads[ticker];
  const exposure = exposureMap(source.currentExposure, ticker);
  for (const node of nodes) {
    const prior = oiAt(source.priorOi, node.strike);
    const current = oiAt(source.currentOi, node.strike);
    const currentRisk = exposureAt(exposure, node.strike);
    const priorCallOi = number(prior.callOpenInterest);
    const priorPutOi = number(prior.putOpenInterest);
    const currentCallOi = number(current.callOpenInterest);
    const currentPutOi = number(current.putOpenInterest);
    const callExposure = number(currentRisk.callExposure);
    const putExposure = number(currentRisk.putExposure);
    const callUnit = currentCallOi > 0 ? callExposure / currentCallOi : 0;
    const putUnit = currentPutOi > 0 ? Math.abs(putExposure) / currentPutOi : 0;
    const priorCallRisk = priorCallOi * callUnit;
    const priorPutRisk = -priorPutOi * putUnit;
    const currentCallRisk = currentCallOi * callUnit;
    const currentPutRisk = -currentPutOi * putUnit;
    rows.push({
      symbol: targetSymbol === "SPX" ? "SPXW" : targetSymbol,
      ticker,
      strike: number(node.strike),
      target: number(node.value),
      priorCallOi,
      priorPutOi,
      currentCallOi,
      currentPutOi,
      deltaCallOi: currentCallOi - priorCallOi,
      deltaPutOi: currentPutOi - priorPutOi,
      callExposure,
      putExposure,
      netExposure: callExposure + putExposure,
      grossExposure: callExposure - putExposure,
      priorCallRisk,
      priorPutRisk,
      priorNetRisk: priorCallRisk + priorPutRisk,
      priorGrossRisk: priorCallRisk - priorPutRisk,
      currentCallRisk,
      currentPutRisk,
      deltaCallRisk: currentCallRisk - priorCallRisk,
      deltaPutRisk: currentPutRisk - priorPutRisk,
      deltaNetRisk: (currentCallRisk + currentPutRisk) - (priorCallRisk + priorPutRisk),
    });
  }
}

const oneFactorNames = [
  "netExposure", "grossExposure", "callExposure", "putExposure",
  "priorNetRisk", "priorGrossRisk", "priorCallRisk", "priorPutRisk",
  "deltaNetRisk", "deltaCallRisk", "deltaPutRisk",
  "currentCallOi", "currentPutOi", "priorCallOi", "priorPutOi", "deltaCallOi", "deltaPutOi",
];
const oneFactor = oneFactorNames.map((name) => ({ name, ...fitScale(rows, name) }))
  .sort((a, b) => b.r2 - a.r2);

const families = [
  ["callExposure", "putExposure"],
  ["priorCallRisk", "priorPutRisk"],
  ["deltaCallRisk", "deltaPutRisk"],
  ["priorCallRisk", "priorPutRisk", "deltaCallRisk", "deltaPutRisk"],
  ["priorCallOi", "priorPutOi", "deltaCallOi", "deltaPutOi"],
  ["callExposure", "putExposure", "priorCallRisk", "priorPutRisk", "deltaCallRisk", "deltaPutRisk"],
];
const multi = families.map((features) => {
  const model = fit(rows, features, true);
  return { features, ...model, holdout: holdout(rows, features, true) };
}).sort((a, b) => a.holdout.rmse - b.holdout.rmse);

console.log(`# Trinity inventory-state reconciliation — ${SESSION_DATE} 10:00 ET`);
console.log(`\nRows: ${rows.length}; SPXW ${rows.filter((row) => row.symbol === "SPXW").length}; SPY ${rows.filter((row) => row.symbol === "SPY").length}; QQQ ${rows.filter((row) => row.symbol === "QQQ").length}.`);
console.log("\n## One-factor candidates (no intercept)");
console.log("\n| Feature | Scale | R² | RMSE | Sign |");
console.log("|---|---:|---:|---:|---:|");
for (const result of oneFactor.slice(0, 12)) {
  console.log(`| ${result.name} | ${number(result.coefficients[result.name]).toExponential(4)} | ${result.r2.toFixed(4)} | ${money(result.rmse)} | ${(result.sign * 100).toFixed(1)}% |`);
}

console.log("\n## Physically interpretable multifeature candidates");
console.log("\n| Features | R² | RMSE | Sign | Symbol holdout RMSE | Holdout sign | Coefficients |");
console.log("|---|---:|---:|---:|---:|---:|---|");
for (const result of multi) {
  const coefficients = Object.entries(result.coefficients).map(([name, value]) => `${name}=${number(value).toExponential(3)}`).join("; ");
  console.log(`| ${result.features.join(" + ")} | ${result.r2.toFixed(4)} | ${money(result.rmse)} | ${(result.sign * 100).toFixed(1)}% | ${money(result.holdout.rmse)} | ${(result.holdout.sign * 100).toFixed(1)}% | ${coefficients} |`);
}

const best = multi[0];
console.log("\n## Best cross-symbol model sample");
console.log(`\n${best.features.join(" + ")} (selected by leave-one-symbol-out RMSE).`);
console.log("\n| Symbol | Strike | Trinity | Predicted | Error | QD net exposure | Prior net risk | OI delta risk |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
const names = ["intercept", ...best.features];
for (const row of rows.filter((item) => [7680, 7675, 7640, 775, 768, 766, 764, 760, 717, 714, 708, 700].includes(item.strike))) {
  const predicted = names.reduce((sum, name) => sum + (name === "intercept" ? 1 : number(row[name])) * number(best.coefficients[name]), 0);
  console.log(`| ${row.symbol} | ${row.strike} | ${money(row.target)} | ${money(predicted)} | ${money(predicted - row.target)} | ${money(row.netExposure)} | ${money(row.priorNetRisk)} | ${money(row.deltaNetRisk)} |`);
}

console.log(`\nJSON_RESULT=${JSON.stringify({ rows: rows.length, oneFactor: oneFactor.slice(0, 12).map(({ predictions, ...value }) => value), multi: multi.map(({ predictions, ...value }) => value) })}`);
