#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

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

const ROOT = process.cwd();
const CACHE_PATH = path.resolve(ROOT, "tmp/quantdata-interval-map-2026-08-21.json");
const OPENING_PATH = path.resolve(ROOT, "scripts/trinity-opening-lattice-2026-08-21.json");
const EXTRA_PATH = path.resolve(ROOT, "scripts/trinity-extra-lattices-2026-08-21.json");
const FULL_PATH = "C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json";
const OUTPUT_PATH = path.resolve(ROOT, "tmp/trinity-decaying-state-2026-08-21.json");
const FRONT_EXPIRY = "2026-08-21";
const SYMBOLS = ["SPXW", "SPY", "QQQ"];
const QUANTDATA_SYMBOL = { SPXW: "SPX", SPY: "SPY", QQQ: "QQQ" };

function normalizeRows(rows) {
  if (Array.isArray(rows)) {
    return rows.map((row) => Array.isArray(row)
      ? { strike: Number(row[0]), value: Number(row[1]) }
      : { strike: Number(row.strike), value: Number(row.value) });
  }
  return Object.entries(rows || {}).map(([strike, value]) => ({ strike: Number(strike), value: Number(value) }));
}

function loadTargets() {
  const result = new Map();
  const put = (label, symbol, rows) => {
    for (const row of normalizeRows(rows)) result.set(`${label}:${symbol}:${row.strike}`, row.value);
  };
  const opening = JSON.parse(fs.readFileSync(OPENING_PATH, "utf8"));
  put("0400", "SPXW", opening.targets?.SPX);
  put("0400", "SPY", opening.targets?.SPY);
  put("0400", "QQQ", opening.targets?.QQQ);

  const full = JSON.parse(fs.readFileSync(FULL_PATH, "utf8"));
  for (const [source, label] of [["930", "0930"], ["945", "0945"], ["1000", "1000"]]) {
    put(label, "SPXW", full.targets?.[source]?.SPX);
    put(label, "SPY", full.targets?.[source]?.SPY);
    put(label, "QQQ", full.targets?.[source]?.QQQ);
  }

  const extra = JSON.parse(fs.readFileSync(EXTRA_PATH, "utf8"));
  const labels = { "09:35:00": "0935", "09:40:00": "0940", "09:50:00": "0950", "09:55:00": "0955" };
  for (const [iso, snapshot] of Object.entries(extra)) {
    const label = labels[iso.slice(11, 19)];
    if (!label) continue;
    for (const symbol of SYMBOLS) put(label, symbol, snapshot?.[symbol]?.values);
  }
  return result;
}

function buildFrames(payload) {
  const data = payload?.data || {};
  return Object.keys(data).map(Number).filter(Number.isFinite).sort((a, b) => a - b).map((timestamp) => ({
    timestamp,
    bucket: data[String(timestamp)]?.[FRONT_EXPIRY] || {},
  }));
}

function cell(frame, strike) {
  const raw = frame?.bucket?.[Number(strike).toFixed(1)] ?? frame?.bucket?.[String(Number(strike))] ?? {};
  const call = Number(raw.CALL ?? 0) || 0;
  const put = Number(raw.PUT ?? 0) || 0;
  return { call, put, net: call + put, gross: Math.abs(call) + Math.abs(put) };
}

function transitionFrames(frames, start, end) {
  return frames.filter((frame) => frame.timestamp > start + 1_000 && frame.timestamp <= end + 1_000);
}

function previousFrame(frames, timestamp) {
  let found = null;
  for (const frame of frames) {
    if (frame.timestamp >= timestamp - 1_000) break;
    found = frame;
  }
  return found;
}

function solve(matrix, vector) {
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

function fitRidge(rows, keys, ridge) {
  const means = Object.fromEntries(keys.map((key) => [key, rows.reduce((sum, row) => sum + row[key], 0) / rows.length]));
  const scales = Object.fromEntries(keys.map((key) => {
    const variance = rows.reduce((sum, row) => sum + (row[key] - means[key]) ** 2, 0) / rows.length;
    return [key, Math.sqrt(variance) || 1];
  }));
  const x = rows.map((row) => [1, ...keys.map((key) => (row[key] - means[key]) / scales[key])]);
  const size = keys.length + 1;
  const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) =>
    x.reduce((sum, values) => sum + values[i] * values[j], 0) + (i === j && i > 0 ? ridge : 0)));
  const vector = Array.from({ length: size }, (_, i) => x.reduce((sum, values, index) => sum + values[i] * rows[index].response, 0));
  const coefficients = solve(matrix, vector);
  return {
    coefficients,
    means,
    scales,
    predictResponse(row) {
      return coefficients[0] + keys.reduce((sum, key, index) =>
        sum + coefficients[index + 1] * ((row[key] - means[key]) / scales[key]), 0);
    },
  };
}

function metrics(rows, predictor) {
  const values = rows.map((row) => ({ row, predicted: predictor(row) }));
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(1, rows.length);
  const sse = values.reduce((sum, entry) => sum + (entry.row.target - entry.predicted) ** 2, 0);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  return {
    rows: rows.length,
    rmse: Math.sqrt(sse / Math.max(1, rows.length)),
    mae: values.reduce((sum, entry) => sum + Math.abs(entry.row.target - entry.predicted), 0) / Math.max(1, rows.length),
    r2: total ? 1 - sse / total : 0,
    sign: values.reduce((sum, entry) => sum + (Math.sign(entry.row.target) === Math.sign(entry.predicted) ? 1 : 0), 0) / Math.max(1, rows.length),
  };
}

function money(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(3)}M`;
}

const targets = loadTargets();
const payloads = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
const framesBySymbol = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, buildFrames(payloads[QUANTDATA_SYMBOL[symbol]])]));

const featureSets = {
  levelCallPut: ["levelCall", "levelPut"],
  deltaCallPut: ["deltaCall", "deltaPut"],
  levelNetGross: ["levelNet", "levelGross"],
  deltaNetGross: ["deltaNet", "deltaGross"],
  levelAndDelta: ["levelCall", "levelPut", "deltaCall", "deltaPut"],
};

function rowsForRho(rho) {
  const rows = [];
  for (let snapshotIndex = 2; snapshotIndex < SNAPSHOTS.length; snapshotIndex += 1) {
    const prior = SNAPSHOTS[snapshotIndex - 1];
    const current = SNAPSHOTS[snapshotIndex];
    for (const symbol of SYMBOLS) {
      const frames = transitionFrames(framesBySymbol[symbol], prior.timestamp, current.timestamp);
      if (!frames.length) continue;
      const strikeEntries = [...targets.entries()].filter(([key]) => key.startsWith(`${current.label}:${symbol}:`));
      for (const [key, target] of strikeEntries) {
        const strike = Number(key.split(":").at(-1));
        const previousTarget = targets.get(`${prior.label}:${symbol}:${strike}`);
        if (!Number.isFinite(previousTarget)) continue;
        const row = {
          symbol,
          label: current.label,
          strike,
          target,
          previousTarget,
          stateCarry: rho ** frames.length * previousTarget,
          decayMass: 0,
          levelCall: 0,
          levelPut: 0,
          levelNet: 0,
          levelGross: 0,
          deltaCall: 0,
          deltaPut: 0,
          deltaNet: 0,
          deltaGross: 0,
        };
        let priorMinuteFrame = previousFrame(framesBySymbol[symbol], frames[0].timestamp);
        for (let index = 0; index < frames.length; index += 1) {
          const frame = frames[index];
          const weight = rho ** (frames.length - 1 - index);
          const now = cell(frame, strike);
          const before = cell(priorMinuteFrame, strike);
          row.decayMass += weight;
          row.levelCall += weight * now.call;
          row.levelPut += weight * now.put;
          row.levelNet += weight * now.net;
          row.levelGross += weight * now.gross;
          row.deltaCall += weight * (now.call - before.call);
          row.deltaPut += weight * (now.put - before.put);
          row.deltaNet += weight * (now.net - before.net);
          row.deltaGross += weight * (now.gross - before.gross);
          priorMinuteFrame = frame;
        }
        row.response = row.target - row.stateCarry;
        rows.push(row);
      }
    }
  }
  return rows;
}

const rhoGrid = [0, 0.25, 0.5, 0.7, 0.8, 0.85, 0.9, 0.925, 0.95, 0.96, 0.97, 0.975, 0.98, 0.985, 0.99, 0.9925, 0.995, 0.9975, 0.999, 1];
const ridgeGrid = [0.01, 0.1, 1, 10, 100, 1000];
const candidates = [];

// Select hyperparameters without ever looking at 10:00: train through 09:45,
// validate on 09:50 and 09:55, then refit through 09:55 for the 10:00 holdout.
for (const rho of rhoGrid) {
  const allRows = rowsForRho(rho);
  for (const [featureName, keys] of Object.entries(featureSets)) {
    for (const ridge of ridgeGrid) {
      for (const scope of ["global", "perSymbol"]) {
        const validationPredictions = new Map();
        let valid = true;
        for (const validationLabel of ["0950", "0955"]) {
          const allowed = validationLabel === "0950" ? new Set(["0935", "0940", "0945"]) : new Set(["0935", "0940", "0945", "0950"]);
          for (const symbol of scope === "perSymbol" ? SYMBOLS : ["ALL"]) {
            const train = allRows.filter((row) => allowed.has(row.label) && (symbol === "ALL" || row.symbol === symbol));
            const test = allRows.filter((row) => row.label === validationLabel && (symbol === "ALL" || row.symbol === symbol));
            if (train.length <= keys.length + 2 || !test.length) { valid = false; break; }
            const model = fitRidge(train, ["decayMass", ...keys], ridge);
            for (const row of test) validationPredictions.set(row, row.stateCarry + model.predictResponse(row));
          }
          if (!valid) break;
        }
        if (!valid) continue;
        const validationRows = allRows.filter((row) => ["0950", "0955"].includes(row.label));
        const validation = metrics(validationRows, (row) => validationPredictions.get(row));

        const holdoutPredictions = new Map();
        for (const symbol of scope === "perSymbol" ? SYMBOLS : ["ALL"]) {
          const train = allRows.filter((row) => row.label !== "1000" && (symbol === "ALL" || row.symbol === symbol));
          const test = allRows.filter((row) => row.label === "1000" && (symbol === "ALL" || row.symbol === symbol));
          const model = fitRidge(train, ["decayMass", ...keys], ridge);
          for (const row of test) holdoutPredictions.set(row, row.stateCarry + model.predictResponse(row));
        }
        const holdoutRows = allRows.filter((row) => row.label === "1000");
        const holdout = metrics(holdoutRows, (row) => holdoutPredictions.get(row));
        candidates.push({ rho, featureName, keys, ridge, scope, validation, holdout, holdoutPredictions, allRows });
      }
    }
  }
}

candidates.sort((a, b) => a.validation.rmse - b.validation.rmse);
const best = candidates[0];
const persistenceRows = best.allRows.filter((row) => row.label === "1000");
const persistence = metrics(persistenceRows, (row) => row.previousTarget);

console.log(`# Trinity decaying-state reconciliation — 2026-08-21`);
console.log(`Selection uses 09:50 and 09:55 only; 10:00 remains untouched.`);
console.log(`\nBest pre-10:00 state: rho ${best.rho}, ${best.featureName}, ${best.scope}, ridge ${best.ridge}`);
console.log(`- validation: RMSE ${money(best.validation.rmse)}, MAE ${money(best.validation.mae)}, R² ${best.validation.r2.toFixed(5)}, sign ${(best.validation.sign * 100).toFixed(2)}%`);
console.log(`- untouched 10:00: RMSE ${money(best.holdout.rmse)}, MAE ${money(best.holdout.mae)}, R² ${best.holdout.r2.toFixed(5)}, sign ${(best.holdout.sign * 100).toFixed(2)}%`);
console.log(`- untouched 10:00 persistence: RMSE ${money(persistence.rmse)}, MAE ${money(persistence.mae)}, R² ${persistence.r2.toFixed(5)}, sign ${(persistence.sign * 100).toFixed(2)}%`);

console.log(`\nTop pre-10:00 candidates:`);
console.log(`| rho | features | scope | ridge | validation RMSE | 10:00 RMSE | 10:00 sign |`);
console.log(`|---:|---|---|---:|---:|---:|---:|`);
for (const candidate of candidates.slice(0, 20)) {
  console.log(`| ${candidate.rho} | ${candidate.featureName} | ${candidate.scope} | ${candidate.ridge} | ${money(candidate.validation.rmse)} | ${money(candidate.holdout.rmse)} | ${(candidate.holdout.sign * 100).toFixed(2)}% |`);
}

const keyStrikes = { SPXW: [7640, 7675, 7680, 7690, 7700], SPY: [760, 764, 766, 768, 775], QQQ: [700, 708, 712, 714, 717] };
console.log(`\nUntouched 10:00 exact-strike comparison:`);
console.log(`| symbol | strike | Trinity | 09:55 persistence | state model | error |`);
console.log(`|---|---:|---:|---:|---:|---:|`);
const exact = [];
for (const symbol of SYMBOLS) {
  for (const strike of keyStrikes[symbol]) {
    const row = persistenceRows.find((entry) => entry.symbol === symbol && entry.strike === strike);
    if (!row) continue;
    const predicted = best.holdoutPredictions.get(row);
    exact.push({ symbol, strike, target: row.target, persistence: row.previousTarget, predicted, error: predicted - row.target });
    console.log(`| ${symbol} | ${strike} | ${money(row.target)} | ${money(row.previousTarget)} | ${money(predicted)} | ${money(predicted - row.target)} |`);
  }
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
  selectedWithout1000: {
    rho: best.rho,
    featureName: best.featureName,
    keys: best.keys,
    ridge: best.ridge,
    scope: best.scope,
    validation: best.validation,
    holdout: best.holdout,
    persistence,
  },
  exact,
  leaderboard: candidates.slice(0, 50).map(({ holdoutPredictions, allRows, keys, ...candidate }) => candidate),
}, null, 2));
console.log(`\nWrote ${OUTPUT_PATH}`);
