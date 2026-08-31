#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const EXPIRATION = SESSION_DATE;
const FINAL_TIME = Date.parse("2026-08-21T10:00:00-04:00");
const HISTORY_FILE = path.resolve("tmp/trinity-inventory-tape-2026-05-01-to-2026-08-21.json");
const FULL_LATTICE_FILE = "C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json";
const EXTRA_LATTICE_FILE = path.resolve("scripts/trinity-extra-lattices-2026-08-21.json");
const OPENING_LATTICE_FILE = path.resolve("scripts/trinity-opening-lattice-2026-08-21.json");
const INPUT_CACHE_FILE = path.resolve("tmp/trinity-dealer-inventory-inputs-2026-08-21.json");
const OUTPUT_FILE = path.resolve("tmp/trinity-dealer-inventory-fit-2026-08-21.json");
const DAY = 86_400_000;

const HORIZONS = [
  ["5m", 5 * 60_000],
  ["15m", 15 * 60_000],
  ["30m", 30 * 60_000],
  ["1h", 60 * 60_000],
  ["session", 6.5 * 60 * 60_000],
  ["1d", DAY],
  ["2d", 2 * DAY],
  ["5d", 5 * DAY],
  ["10d", 10 * DAY],
  ["20d", 20 * DAY],
  ["40d", 40 * DAY],
  ["all", Number.POSITIVE_INFINITY],
];

const SPOTS = {
  "0400": { SPXW: 7641.16, SPY: 762.57, QQQ: 710.91 },
  "0935": { SPXW: 7667.93, SPY: 764.98, QQQ: 712.67 },
  "0940": { SPXW: 7668.89, SPY: 764.95, QQQ: 712.00 },
  "0950": { SPXW: 7668.07, SPY: 764.73, QQQ: 711.92 },
  "0955": { SPXW: 7662.78, SPY: 764.44, QQQ: 710.64 },
  "1000": { SPXW: 7665.14, SPY: 764.45, QQQ: 711.55 },
};

function readDotEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = { ...readDotEnv(path.resolve(".env.local")), ...process.env };
const gatewayUrl = String(env.KWANTIFY_MARKET_DATA_GATEWAY_URL || "").replace(/\/$/, "");
const gatewayToken = String(env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN || "");

async function quantDataPost(endpoint, body) {
  if (!gatewayUrl || !gatewayToken) throw new Error("The VPS market-data gateway is not configured.");
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(`${gatewayUrl}/v1/vendors/quantdata/v1${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${gatewayToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    if (response.status === 429 && attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  throw new Error(`${endpoint} exhausted retries.`);
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function strikeKey(value) {
  return numeric(value).toFixed(1);
}

function exposureMap(payload, ticker) {
  const root = payload?.data?.[ticker] ?? payload?.data;
  return root?.exposureMap?.[EXPIRATION] ?? {};
}

function valueAt(map, strike) {
  return map?.[strikeKey(strike)] ?? map?.[String(numeric(strike))] ?? {};
}

function targetRows(values) {
  if (Array.isArray(values)) return values.map((row) => Array.isArray(row)
    ? { strike: numeric(row[0]), value: numeric(row[1]) }
    : { strike: numeric(row?.strike), value: numeric(row?.value) });
  return Object.entries(values ?? {}).map(([strike, value]) => ({ strike: numeric(strike), value: numeric(value) }));
}

function interpolateSpot(timeKey, symbol) {
  if (SPOTS[timeKey]?.[symbol]) return SPOTS[timeKey][symbol];
  const minute = Number(timeKey.slice(0, 2)) * 60 + Number(timeKey.slice(2));
  const known = Object.entries(SPOTS)
    .filter(([, spots]) => spots[symbol])
    .map(([key, spots]) => ({ minute: Number(key.slice(0, 2)) * 60 + Number(key.slice(2)), spot: spots[symbol] }))
    .sort((left, right) => left.minute - right.minute);
  const before = [...known].reverse().find((row) => row.minute <= minute) ?? known[0];
  const after = known.find((row) => row.minute >= minute) ?? known.at(-1);
  if (before.minute === after.minute) return before.spot;
  const weight = (minute - before.minute) / (after.minute - before.minute);
  return before.spot + weight * (after.spot - before.spot);
}

function loadSnapshots() {
  const snapshots = [];
  const opening = JSON.parse(fs.readFileSync(OPENING_LATTICE_FILE, "utf8"));
  snapshots.push({ key: "0400", time: Date.parse(`${SESSION_DATE}T04:00:00-04:00`), data: opening.targets });

  const full = JSON.parse(fs.readFileSync(FULL_LATTICE_FILE, "utf8"));
  for (const [key, data] of Object.entries(full.targets ?? {})) {
    snapshots.push({ key: key.padStart(4, "0"), time: Date.parse(`${SESSION_DATE}T${key.slice(0, -2).padStart(2, "0")}:${key.slice(-2)}:00-04:00`), data });
  }

  const extra = JSON.parse(fs.readFileSync(EXTRA_LATTICE_FILE, "utf8"));
  for (const [timestamp, symbols] of Object.entries(extra)) {
    const date = new Date(timestamp);
    const key = `${String(date.getUTCHours() - 4).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}`;
    const data = {};
    for (const [symbol, payload] of Object.entries(symbols)) {
      data[symbol] = targetRows(payload.values).map(({ strike, value }) => [strike, value]);
      SPOTS[key] ??= {};
      SPOTS[key][symbol] = numeric(payload.spot);
    }
    snapshots.push({ key, time: Date.parse(timestamp), data });
  }

  return snapshots.sort((left, right) => left.time - right.time);
}

async function loadInventoryInputs() {
  if (fs.existsSync(INPUT_CACHE_FILE)) return JSON.parse(fs.readFileSync(INPUT_CACHE_FILE, "utf8"));
  const inputs = {};
  for (const ticker of ["SPX", "SPY", "QQQ"]) {
    const [oi, exposure] = await Promise.all([
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
    inputs[ticker] = { oi: oi?.data ?? {}, exposure: exposureMap(exposure, ticker) };
  }
  fs.writeFileSync(INPUT_CACHE_FILE, JSON.stringify(inputs));
  return inputs;
}

function buildTradeIndex(tape) {
  const index = {};
  for (const [ticker, trades] of Object.entries(tape)) {
    index[ticker] = new Map();
    for (const trade of trades) {
      const key = `${strikeKey(trade.strike)}:${trade.type}`;
      const list = index[ticker].get(key) ?? [];
      list.push({ time: numeric(trade.timestamp), side: trade.side, size: numeric(trade.size) });
      index[ticker].set(key, list);
    }
    for (const list of index[ticker].values()) list.sort((left, right) => left.time - right.time);
  }
  return index;
}

function summarize(list, start, end) {
  let buy = 0;
  let sell = 0;
  for (const trade of list ?? []) {
    if (trade.time <= start) continue;
    if (trade.time > end) break;
    if (trade.side === "BUY") buy += trade.size;
    else if (trade.side === "SELL") sell += trade.size;
  }
  return { buy, sell, dealerNet: sell - buy, classified: sell + buy };
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < size; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    }
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    if (Math.abs(augmented[pivot][pivot]) < 1e-12) return null;
    const divisor = augmented[pivot][pivot];
    for (let column = pivot; column <= size; column += 1) augmented[pivot][column] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= size; column += 1) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map((row) => row[size]);
}

function fitRidge(rows, ridge) {
  const width = rows[0].features.length;
  const scales = Array.from({ length: width }, (_, column) => {
    const rms = Math.sqrt(rows.reduce((sum, row) => sum + row.features[column] ** 2, 0) / rows.length);
    return rms || 1;
  });
  const matrix = Array.from({ length: width }, () => Array(width).fill(0));
  const vector = Array(width).fill(0);
  for (const row of rows) {
    const normalized = row.features.map((value, column) => value / scales[column]);
    for (let left = 0; left < width; left += 1) {
      vector[left] += normalized[left] * row.target;
      for (let right = 0; right < width; right += 1) matrix[left][right] += normalized[left] * normalized[right];
    }
  }
  for (let index = 1; index < width; index += 1) matrix[index][index] += ridge;
  const normalizedWeights = solveLinearSystem(matrix, vector);
  if (!normalizedWeights) return null;
  return { weights: normalizedWeights.map((value, column) => value / scales[column]), scales };
}

function predict(model, row) {
  return row.features.reduce((sum, value, index) => sum + value * model.weights[index], 0);
}

function metrics(rows, predictions) {
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(rows.length, 1);
  const sse = rows.reduce((sum, row, index) => sum + (row.target - predictions[index]) ** 2, 0);
  const sst = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  const sign = rows.filter((row, index) => Math.sign(row.target) === Math.sign(predictions[index])).length / Math.max(rows.length, 1);
  return { rmse: Math.sqrt(sse / Math.max(rows.length, 1)), r2: sst ? 1 - sse / sst : 0, sign };
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  const amount = Math.abs(value);
  if (amount >= 1e9) return `${sign}$${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${sign}$${(amount / 1e6).toFixed(2)}M`;
  if (amount >= 1e3) return `${sign}$${(amount / 1e3).toFixed(1)}K`;
  return `${sign}$${amount.toFixed(0)}`;
}

const snapshots = loadSnapshots();
const tape = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
const inputs = await loadInventoryInputs();
const tradeIndex = buildTradeIndex(tape);
const tickerForSymbol = { SPX: "SPX", SPXW: "SPX", SPY: "SPY", QQQ: "QQQ" };

const featureNames = ["intercept", "spotDistance", "spotDistanceAbs", "spotDistanceSq", "callExposure", "putExposure", "grossExposure", "netExposure", "callOi", "putOi", "oiImbalance"];
for (const [name] of HORIZONS) {
  for (const suffix of ["callNet", "putNet", "callTotal", "putTotal", "callTanhOi", "putTanhOi", "callRatioOi", "putRatioOi"]) {
    featureNames.push(`${name}:${suffix}`);
  }
}

const rows = [];
for (const snapshot of snapshots) {
  for (const [inputSymbol, rawNodes] of Object.entries(snapshot.data ?? {})) {
    const symbol = inputSymbol === "SPX" ? "SPXW" : inputSymbol;
    const ticker = tickerForSymbol[symbol];
    const spot = interpolateSpot(snapshot.key, symbol);
    for (const node of targetRows(rawNodes)) {
      const oi = valueAt(inputs[ticker].oi, node.strike);
      const exposure = valueAt(inputs[ticker].exposure, node.strike);
      const callOi = Math.max(0, numeric(oi.callOpenInterest));
      const putOi = Math.max(0, numeric(oi.putOpenInterest));
      const callExposure = numeric(exposure.callExposure);
      const putExposure = numeric(exposure.putExposure);
      const callUnit = callOi ? Math.abs(callExposure) / callOi : 0;
      const putUnit = putOi ? Math.abs(putExposure) / putOi : 0;
      const distance = spot ? (node.strike - spot) / spot : 0;
      const features = [1, distance, Math.abs(distance), distance ** 2, callExposure, putExposure, Math.abs(callExposure) + Math.abs(putExposure), callExposure - putExposure, callOi, putOi, (callOi - putOi) / Math.max(callOi + putOi, 1)];
      for (const [, duration] of HORIZONS) {
        const start = Number.isFinite(duration) ? snapshot.time - duration : 0;
        const call = summarize(tradeIndex[ticker].get(`${strikeKey(node.strike)}:CALL`), start, snapshot.time);
        const put = summarize(tradeIndex[ticker].get(`${strikeKey(node.strike)}:PUT`), start, snapshot.time);
        const callRatio = call.classified ? call.dealerNet / call.classified : 0;
        const putRatio = put.classified ? put.dealerNet / put.classified : 0;
        features.push(
          call.dealerNet * callUnit,
          put.dealerNet * putUnit,
          call.classified * callUnit,
          put.classified * putUnit,
          callOi * Math.tanh(callOi ? call.dealerNet / callOi : 0) * callUnit,
          putOi * Math.tanh(putOi ? put.dealerNet / putOi : 0) * putUnit,
          callOi * callRatio * callUnit,
          putOi * putRatio * putUnit,
        );
      }
      rows.push({ snapshot: snapshot.key, time: snapshot.time, symbol, ticker, strike: node.strike, spot, target: node.value, features });
    }
  }
}

const finalRows = rows.filter((row) => row.time === FINAL_TIME);
const preFinalRows = rows.filter((row) => row.time < FINAL_TIME);
const ridgeCandidates = [0.01, 0.1, 1, 10, 100, 1000];
const validationTimes = [...new Set(preFinalRows.map((row) => row.time))].filter((time) => time > preFinalRows[0].time).sort((a, b) => a - b);
const candidates = [];
for (const ridge of ridgeCandidates) {
  const predictions = [];
  const validationRows = [];
  for (const time of validationTimes) {
    const train = preFinalRows.filter((row) => row.time < time);
    const test = preFinalRows.filter((row) => row.time === time);
    if (!train.length || !test.length) continue;
    const model = fitRidge(train, ridge);
    if (!model) continue;
    validationRows.push(...test);
    predictions.push(...test.map((row) => predict(model, row)));
  }
  candidates.push({ ridge, ...metrics(validationRows, predictions) });
}
candidates.sort((left, right) => left.rmse - right.rmse);

const bestRidge = candidates[0].ridge;
const model = fitRidge(preFinalRows, bestRidge);
const finalPredictions = finalRows.map((row) => predict(model, row));
const finalMetrics = metrics(finalRows, finalPredictions);
const previousRows = rows.filter((row) => row.snapshot === "0955");
const previousByNode = new Map(previousRows.map((row) => [`${row.symbol}:${strikeKey(row.strike)}`, row.target]));
const persistencePredictions = finalRows.map((row) => previousByNode.get(`${row.symbol}:${strikeKey(row.strike)}`) ?? 0);
const persistenceMetrics = metrics(finalRows, persistencePredictions);

const bySymbol = {};
for (const symbol of ["SPXW", "SPY", "QQQ"]) {
  const selected = finalRows.map((row, index) => ({ row, prediction: finalPredictions[index], persistence: persistencePredictions[index] })).filter(({ row }) => row.symbol === symbol);
  bySymbol[symbol] = {
    model: metrics(selected.map(({ row }) => row), selected.map(({ prediction }) => prediction)),
    persistence: metrics(selected.map(({ row }) => row), selected.map(({ persistence }) => persistence)),
  };
}

const reference = new Set(["SPXW:7680.0", "SPXW:7675.0", "SPXW:7640.0", "SPY:775.0", "SPY:768.0", "SPY:766.0", "SPY:764.0", "SPY:760.0", "QQQ:717.0", "QQQ:714.0", "QQQ:708.0", "QQQ:700.0"]);
const samples = finalRows.map((row, index) => ({
  symbol: row.symbol,
  strike: row.strike,
  target: row.target,
  prediction: finalPredictions[index],
  persistence: persistencePredictions[index],
  error: finalPredictions[index] - row.target,
})).filter((row) => reference.has(`${row.symbol}:${strikeKey(row.strike)}`));

const output = {
  method: "cross-sectional dealer inventory with rolling OPRA horizons; 10:00 ET held out",
  trainingSnapshots: snapshots.filter((snapshot) => snapshot.time < FINAL_TIME).map((snapshot) => snapshot.key),
  finalSnapshot: "1000",
  featureNames,
  validation: candidates,
  selectedRidge: bestRidge,
  final: finalMetrics,
  persistence: persistenceMetrics,
  bySymbol,
  samples,
  weights: featureNames.map((name, index) => ({ name, weight: model.weights[index] })).sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight)),
};
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

console.log("# Trinity dealer-inventory reconstruction — 2026-08-21");
console.log("10:00 ET is a strict final holdout; ridge selection uses only earlier visible snapshots.\n");
console.log("## Walk-forward selection\n");
console.log("| Ridge | RMSE | R² | Sign |");
console.log("|---:|---:|---:|---:|");
for (const candidate of candidates) console.log(`| ${candidate.ridge} | ${formatMoney(candidate.rmse)} | ${candidate.r2.toFixed(4)} | ${(candidate.sign * 100).toFixed(1)}% |`);
console.log("\n## Untouched 10:00 ET result\n");
console.log(`- dealer-inventory model: RMSE ${formatMoney(finalMetrics.rmse)}, R² ${finalMetrics.r2.toFixed(4)}, sign ${(finalMetrics.sign * 100).toFixed(1)}%`);
console.log(`- 09:55 persistence: RMSE ${formatMoney(persistenceMetrics.rmse)}, R² ${persistenceMetrics.r2.toFixed(4)}, sign ${(persistenceMetrics.sign * 100).toFixed(1)}%`);
for (const [symbol, result] of Object.entries(bySymbol)) console.log(`- ${symbol}: model ${formatMoney(result.model.rmse)} vs persistence ${formatMoney(result.persistence.rmse)}`);
console.log("\n## Reference nodes\n");
console.log("| Symbol | Strike | Trinity | Model | 09:55 persistence | Error |");
console.log("|---|---:|---:|---:|---:|---:|");
for (const row of samples) console.log(`| ${row.symbol} | ${row.strike} | ${formatMoney(row.target)} | ${formatMoney(row.prediction)} | ${formatMoney(row.persistence)} | ${formatMoney(row.error)} |`);
console.log(`\nFull diagnostics: ${OUTPUT_FILE}`);
