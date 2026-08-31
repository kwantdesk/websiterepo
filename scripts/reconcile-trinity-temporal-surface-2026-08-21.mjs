#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SESSION_DATE = "2026-08-21";
const FRONT_EXPIRY = "2026-08-21";
const TICKERS = ["SPX", "SPY", "QQQ"];
const DISPLAY = { SPX: "SPXW", SPY: "SPY", QQQ: "QQQ" };
const SNAPSHOTS = [
  ["0400", "2026-08-21T08:00:00.000Z"],
  ["0930", "2026-08-21T13:30:00.000Z"],
  ["0935", "2026-08-21T13:35:00.000Z"],
  ["0940", "2026-08-21T13:40:00.000Z"],
  ["0945", "2026-08-21T13:45:00.000Z"],
  ["0950", "2026-08-21T13:50:00.000Z"],
  ["0955", "2026-08-21T13:55:00.000Z"],
  ["1000", "2026-08-21T14:00:00.000Z"],
].map(([label, iso]) => ({ label, timestamp: Date.parse(iso) }));

const CACHE_PATH = path.resolve(process.cwd(), "tmp/quantdata-interval-map-2026-08-21.json");
const OPENING_PATH = path.resolve(process.cwd(), "scripts/trinity-opening-lattice-2026-08-21.json");
const EXTRA_PATH = path.resolve(process.cwd(), "scripts/trinity-extra-lattices-2026-08-21.json");
const FULL_PATH = "C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json";

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

function normalizeTargetRows(rows) {
  if (Array.isArray(rows)) {
    return rows.map((row) => Array.isArray(row)
      ? { strike: Number(row[0]), value: Number(row[1]) }
      : { strike: Number(row.strike), value: Number(row.value) });
  }
  return Object.entries(rows || {}).map(([strike, value]) => ({ strike: Number(strike), value: Number(value) }));
}

function loadTargets() {
  const result = new Map();
  const putRows = (label, ticker, rows) => {
    for (const row of normalizeTargetRows(rows)) result.set(`${label}:${ticker}:${row.strike}`, row.value);
  };

  const opening = JSON.parse(fs.readFileSync(OPENING_PATH, "utf8"));
  for (const ticker of TICKERS) putRows("0400", DISPLAY[ticker], opening.targets?.[ticker]);

  const full = JSON.parse(fs.readFileSync(FULL_PATH, "utf8"));
  for (const [key, label] of [["930", "0930"], ["945", "0945"], ["1000", "1000"]]) {
    for (const ticker of TICKERS) putRows(label, DISPLAY[ticker], full.targets?.[key]?.[ticker]);
  }

  const extra = JSON.parse(fs.readFileSync(EXTRA_PATH, "utf8"));
  const labels = { "09:35:00": "0935", "09:40:00": "0940", "09:50:00": "0950", "09:55:00": "0955" };
  for (const [iso, snapshot] of Object.entries(extra)) {
    const hhmmss = iso.slice(11, 19);
    const label = labels[hhmmss];
    if (!label) continue;
    for (const ticker of ["SPXW", "SPY", "QQQ"]) putRows(label, ticker, snapshot?.[ticker]?.values);
  }
  return result;
}

async function loadIntervalPayloads() {
  if (fs.existsSync(CACHE_PATH)) return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  const payloads = {};
  for (const ticker of TICKERS) {
    payloads[ticker] = await quantDataPost("/options/tool/interval-map", {
      sessionDate: SESSION_DATE,
      aggregationPeriod: "1m",
      greekMode: "GAMMA",
      representationMode: "RAW",
      filter: { ticker },
    });
  }
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(payloads));
  return payloads;
}

function buildFrames(payload) {
  const data = payload?.data || {};
  return Object.keys(data)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .map((timestamp) => ({ timestamp, bucket: data[String(timestamp)]?.[FRONT_EXPIRY] || {} }));
}

function nearestFrame(frames, timestamp) {
  let candidate = null;
  for (const frame of frames) {
    if (frame.timestamp > timestamp + 1_000) break;
    candidate = frame;
  }
  return candidate;
}

function cellAt(frame, strike) {
  const key = Number(strike).toFixed(1);
  const cell = frame?.bucket?.[key] ?? frame?.bucket?.[String(Number(strike))] ?? {};
  const call = Number(cell.CALL ?? cell.call ?? cell.callExposure ?? 0) || 0;
  const put = Number(cell.PUT ?? cell.put ?? cell.putExposure ?? 0) || 0;
  return { call, put, net: call + put, diff: call - put, gross: Math.abs(call) + Math.abs(put) };
}

function sumCells(frames, strike, startExclusive, endInclusive) {
  const sum = { call: 0, put: 0, net: 0, diff: 0, gross: 0 };
  for (const frame of frames) {
    if (frame.timestamp <= startExclusive || frame.timestamp > endInclusive + 1_000) continue;
    const cell = cellAt(frame, strike);
    for (const key of Object.keys(sum)) sum[key] += cell[key];
  }
  return sum;
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

function fitRidge(train, keys, ridge = 1) {
  const means = Object.fromEntries(keys.map((key) => [key, train.reduce((sum, row) => sum + row[key], 0) / train.length]));
  const scales = Object.fromEntries(keys.map((key) => {
    const variance = train.reduce((sum, row) => sum + (row[key] - means[key]) ** 2, 0) / train.length;
    return [key, Math.sqrt(variance) || 1];
  }));
  const columns = ["__intercept", ...keys];
  const x = train.map((row) => [1, ...keys.map((key) => (row[key] - means[key]) / scales[key])]);
  const matrix = columns.map((_, i) => columns.map((__, j) => x.reduce((sum, row) => sum + row[i] * row[j], 0) + (i === j && i > 0 ? ridge : 0)));
  const vector = columns.map((_, i) => x.reduce((sum, row, rowIndex) => sum + row[i] * train[rowIndex].targetDelta, 0));
  const coefficients = solveLinear(matrix, vector);
  return {
    coefficients,
    predictDelta: (row) => coefficients[0] + keys.reduce((sum, key, index) => sum + coefficients[index + 1] * ((row[key] - means[key]) / scales[key]), 0),
  };
}

function metrics(rows, predict) {
  const predictions = rows.map(predict);
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(1, rows.length);
  const sse = rows.reduce((sum, row, index) => sum + (row.target - predictions[index]) ** 2, 0);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  return {
    rows: rows.length,
    rmse: Math.sqrt(sse / Math.max(1, rows.length)),
    mae: rows.reduce((sum, row, index) => sum + Math.abs(row.target - predictions[index]), 0) / Math.max(1, rows.length),
    r2: total ? 1 - sse / total : 0,
    sign: rows.reduce((sum, row, index) => sum + (Math.sign(row.target) === Math.sign(predictions[index]) ? 1 : 0), 0) / Math.max(1, rows.length),
  };
}

function money(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(3)}M`;
}

const targets = loadTargets();
const payloads = await loadIntervalPayloads();
const framesByTicker = Object.fromEntries(TICKERS.map((ticker) => [DISPLAY[ticker], buildFrames(payloads[ticker])]));
const rows = [];

for (let snapshotIndex = 1; snapshotIndex < SNAPSHOTS.length; snapshotIndex += 1) {
  const snapshot = SNAPSHOTS[snapshotIndex];
  const previousSnapshot = SNAPSHOTS[snapshotIndex - 1];
  for (const ticker of Object.values(DISPLAY)) {
    const frames = framesByTicker[ticker];
    const currentFrame = nearestFrame(frames, snapshot.timestamp);
    const previousFrame = nearestFrame(frames, previousSnapshot.timestamp);
    const lagFrames = Object.fromEntries([1, 5, 10, 15, 30, 60].map((minutes) => [minutes, nearestFrame(frames, snapshot.timestamp - minutes * 60_000)]));
    const tickerTargets = [...targets.entries()].filter(([key]) => key.startsWith(`${snapshot.label}:${ticker}:`));
    const availableStrikes = tickerTargets.map(([key]) => Number(key.split(":").at(-1))).sort((a, b) => a - b);
    for (let strikeIndex = 0; strikeIndex < availableStrikes.length; strikeIndex += 1) {
      const strike = availableStrikes[strikeIndex];
      const target = targets.get(`${snapshot.label}:${ticker}:${strike}`);
      const previousTarget = targets.get(`${previousSnapshot.label}:${ticker}:${strike}`);
      if (!Number.isFinite(target) || !Number.isFinite(previousTarget)) continue;
      const current = cellAt(currentFrame, strike);
      const previous = cellAt(previousFrame, strike);
      const row = {
        ticker,
        label: snapshot.label,
        strike,
        target,
        previousTarget,
        targetDelta: target - previousTarget,
        elapsedMinutes: (snapshot.timestamp - previousSnapshot.timestamp) / 60_000,
        tickerSPXW: ticker === "SPXW" ? 1 : 0,
        tickerSPY: ticker === "SPY" ? 1 : 0,
        tickerQQQ: ticker === "QQQ" ? 1 : 0,
      };
      for (const part of ["call", "put", "net", "diff", "gross"]) {
        row[`cur_${part}`] = current[part];
        row[`step_${part}`] = current[part] - previous[part];
        for (const [minutes, frame] of Object.entries(lagFrames)) row[`d${minutes}_${part}`] = current[part] - cellAt(frame, strike)[part];
        const flow = sumCells(frames, strike, previousSnapshot.timestamp, snapshot.timestamp);
        row[`flow_${part}`] = flow[part];
      }
      const previousStrike = availableStrikes[strikeIndex - 1];
      const nextStrike = availableStrikes[strikeIndex + 1];
      for (const part of ["net", "call", "put"]) {
        const previousNeighbor = Number.isFinite(previousStrike) ? cellAt(currentFrame, previousStrike)[part] : current[part];
        const nextNeighbor = Number.isFinite(nextStrike) ? cellAt(currentFrame, nextStrike)[part] : current[part];
        row[`neighbor_${part}`] = previousNeighbor + current[part] + nextNeighbor;
        const previousNeighborPrior = Number.isFinite(previousStrike) ? cellAt(previousFrame, previousStrike)[part] : previous[part];
        const nextNeighborPrior = Number.isFinite(nextStrike) ? cellAt(previousFrame, nextStrike)[part] : previous[part];
        row[`neighborStep_${part}`] = row[`neighbor_${part}`] - (previousNeighborPrior + previous[part] + nextNeighborPrior);
      }
      rows.push(row);
    }
  }
}

console.log(`# Trinity temporal-surface reconciliation — ${SESSION_DATE}`);
console.log(`Transition rows: ${rows.length}`);
for (const ticker of Object.values(DISPLAY)) {
  const frames = framesByTicker[ticker];
  console.log(`- ${ticker}: ${frames.length} one-minute frames, ${new Date(frames[0]?.timestamp).toISOString()} → ${new Date(frames.at(-1)?.timestamp).toISOString()}`);
}

console.log("\nRepresentative raw front-expiry histories:");
for (const [ticker, strike] of [["SPXW", 7680], ["SPY", 760], ["SPY", 766], ["QQQ", 708], ["QQQ", 714], ["QQQ", 717]]) {
  const frames = framesByTicker[ticker];
  const values = SNAPSHOTS.slice(1).map((snapshot) => {
    const cell = cellAt(nearestFrame(frames, snapshot.timestamp), strike);
    const target = targets.get(`${snapshot.label}:${ticker}:${strike}`);
    return `${snapshot.label}:raw ${money(cell.net)}, Trinity ${money(target)}`;
  });
  console.log(`- ${ticker} ${strike}: ${values.join(" | ")}`);
}

const featureSets = {
  step: ["step_call", "step_put"],
  stepNet: ["step_net", "step_diff", "step_gross"],
  flow: ["flow_call", "flow_put"],
  shortChanges: ["d1_call", "d1_put", "d5_call", "d5_put", "d10_call", "d10_put"],
  mediumChanges: ["d5_call", "d5_put", "d15_call", "d15_put", "d30_call", "d30_put"],
  levelAndStep: ["cur_call", "cur_put", "step_call", "step_put"],
  spatialStep: ["step_call", "step_put", "neighborStep_call", "neighborStep_put", "neighborStep_net"],
  fullTemporal: [
    "cur_call", "cur_put", "step_call", "step_put", "flow_call", "flow_put",
    "d1_call", "d1_put", "d5_call", "d5_put", "d10_call", "d10_put",
    "d15_call", "d15_put", "d30_call", "d30_put", "d60_call", "d60_put",
    "neighborStep_call", "neighborStep_put", "neighborStep_net",
  ],
};

const intradayRows = rows.filter((row) => row.label !== "0930");
const train = intradayRows.filter((row) => row.label !== "1000");
const final = intradayRows.filter((row) => row.label === "1000");
const persistence = metrics(final, (row) => row.previousTarget);
console.log(`\nUntouched 10:00 persistence: RMSE ${money(persistence.rmse)}, MAE ${money(persistence.mae)}, R² ${persistence.r2.toFixed(5)}, sign ${(persistence.sign * 100).toFixed(2)}% (${persistence.rows} rows)`);

const ranked = [];
for (const [name, keys] of Object.entries(featureSets)) {
  for (const ridge of [0.01, 0.1, 1, 10, 100, 1000]) {
    for (const perSymbol of [false, true]) {
      const predictions = new Map();
      let valid = true;
      for (const ticker of perSymbol ? ["SPXW", "SPY", "QQQ"] : ["ALL"]) {
        const modelTrain = ticker === "ALL" ? train : train.filter((row) => row.ticker === ticker);
        const modelTest = ticker === "ALL" ? final : final.filter((row) => row.ticker === ticker);
        if (modelTrain.length <= keys.length + 2) { valid = false; break; }
        const model = fitRidge(modelTrain, keys, ridge);
        for (const row of modelTest) predictions.set(row, row.previousTarget + model.predictDelta(row));
      }
      if (!valid) continue;
      const result = metrics(final, (row) => predictions.get(row));
      ranked.push({ name, ridge, perSymbol, ...result });
    }
  }
}
ranked.sort((a, b) => a.rmse - b.rmse);
console.log("\nBest untouched 10:00 temporal models (trained only through 09:55):");
console.log("| Features | Scope | Ridge | RMSE | MAE | R² | Sign |");
console.log("|---|---|---:|---:|---:|---:|---:|");
for (const result of ranked.slice(0, 20)) console.log(`| ${result.name} | ${result.perSymbol ? "per symbol" : "global"} | ${result.ridge} | ${money(result.rmse)} | ${money(result.mae)} | ${result.r2.toFixed(5)} | ${(result.sign * 100).toFixed(2)}% |`);

console.log("\nRolling-origin validation (one unseen timestamp at a time):");
const rollingPersistenceRows = intradayRows.filter((row) => ["0950", "0955", "1000"].includes(row.label));
const rollingPersistence = metrics(rollingPersistenceRows, (row) => row.previousTarget);
console.log(`- persistence: RMSE ${money(rollingPersistence.rmse)}, MAE ${money(rollingPersistence.mae)}, R² ${rollingPersistence.r2.toFixed(5)}, sign ${(rollingPersistence.sign * 100).toFixed(2)}% (${rollingPersistence.rows} rows)`);
const rollingResults = [];
for (const [name, keys] of Object.entries(featureSets)) {
  for (const ridge of [0.1, 1, 10, 100]) {
    const predicted = [];
    for (const testLabel of ["0950", "0955", "1000"]) {
      const testIndex = SNAPSHOTS.findIndex((snapshot) => snapshot.label === testLabel);
      const allowedLabels = new Set(SNAPSHOTS.slice(1, testIndex).map((snapshot) => snapshot.label).filter((label) => label !== "0930"));
      const rollingTrain = intradayRows.filter((row) => allowedLabels.has(row.label));
      const rollingTest = intradayRows.filter((row) => row.label === testLabel);
      if (rollingTrain.length <= keys.length + 2) continue;
      const model = fitRidge(rollingTrain, keys, ridge);
      for (const row of rollingTest) predicted.push({ ...row, prediction: row.previousTarget + model.predictDelta(row) });
    }
    if (!predicted.length) continue;
    const result = metrics(predicted, (row) => row.prediction);
    rollingResults.push({ name, ridge, ...result });
  }
}
rollingResults.sort((a, b) => a.rmse - b.rmse);
for (const result of rollingResults.slice(0, 12)) console.log(`- ${result.name} ridge ${result.ridge}: RMSE ${money(result.rmse)}, MAE ${money(result.mae)}, R² ${result.r2.toFixed(5)}, sign ${(result.sign * 100).toFixed(2)}% (${result.rows} rows)`);

console.log("\n10:00 benchmark by symbol:");
for (const ticker of ["SPXW", "SPY", "QQQ"]) {
  const tickerRows = final.filter((row) => row.ticker === ticker);
  const result = metrics(tickerRows, (row) => row.previousTarget);
  console.log(`- ${ticker} persistence: RMSE ${money(result.rmse)}, MAE ${money(result.mae)}, sign ${(result.sign * 100).toFixed(2)}%`);
}
