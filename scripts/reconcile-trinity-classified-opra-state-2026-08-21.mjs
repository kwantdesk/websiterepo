#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FRONT_EXPIRY = "2026-08-21";
const SYMBOLS = ["SPXW", "SPY", "QQQ"];
const DATA_SYMBOL = { SPXW: "SPX", SPY: "SPY", QQQ: "QQQ" };
const SNAPSHOTS = [
  ["0930", "2026-08-21T13:30:00.000Z"],
  ["0935", "2026-08-21T13:35:00.000Z"],
  ["0940", "2026-08-21T13:40:00.000Z"],
  ["0945", "2026-08-21T13:45:00.000Z"],
  ["0950", "2026-08-21T13:50:00.000Z"],
  ["0955", "2026-08-21T13:55:00.000Z"],
  ["1000", "2026-08-21T14:00:00.000Z"],
].map(([label, iso]) => ({ label, timestamp: Date.parse(iso) }));

function normalizeRows(rows) {
  if (Array.isArray(rows)) return rows.map((row) => Array.isArray(row)
    ? { strike: Number(row[0]), value: Number(row[1]) }
    : { strike: Number(row.strike), value: Number(row.value) });
  return Object.entries(rows || {}).map(([strike, value]) => ({ strike: Number(strike), value: Number(value) }));
}

function loadTargets() {
  const result = new Map();
  const put = (label, symbol, rows) => {
    for (const row of normalizeRows(rows)) result.set(`${label}:${symbol}:${row.strike}`, row.value);
  };
  const full = JSON.parse(fs.readFileSync("C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json", "utf8"));
  for (const [source, label] of [["930", "0930"], ["945", "0945"], ["1000", "1000"]]) {
    put(label, "SPXW", full.targets[source].SPX);
    put(label, "SPY", full.targets[source].SPY);
    put(label, "QQQ", full.targets[source].QQQ);
  }
  const extra = JSON.parse(fs.readFileSync(path.resolve(ROOT, "scripts/trinity-extra-lattices-2026-08-21.json"), "utf8"));
  const labels = { "09:35:00": "0935", "09:40:00": "0940", "09:50:00": "0950", "09:55:00": "0955" };
  for (const [iso, panels] of Object.entries(extra)) {
    const label = labels[iso.slice(11, 19)];
    if (!label) continue;
    for (const symbol of SYMBOLS) put(label, symbol, panels[symbol]?.values);
  }
  return result;
}

function buildFrames(payload) {
  return Object.entries(payload?.data || {}).map(([timestamp, expirations]) => ({
    timestamp: Number(timestamp),
    bucket: expirations?.[FRONT_EXPIRY] || {},
  })).filter((frame) => Number.isFinite(frame.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
}

function rawCell(frame, strike) {
  const value = frame?.bucket?.[Number(strike).toFixed(1)] ?? frame?.bucket?.[String(Number(strike))] ?? {};
  return { call: Number(value.CALL ?? 0) || 0, put: Number(value.PUT ?? 0) || 0 };
}

function minute(timestamp) {
  return Math.floor(timestamp / 60_000) * 60_000;
}

function buildTapeIndex(rows) {
  const index = new Map();
  for (const trade of rows) {
    if (trade.expiration !== FRONT_EXPIRY) continue;
    const key = `${minute(Number(trade.timestamp))}:${Number(trade.strike)}:${trade.type}`;
    const counts = index.get(key) || { BUY: 0, SELL: 0, MID: 0 };
    const side = ["BUY", "SELL", "MID"].includes(trade.side) ? trade.side : "MID";
    counts[side] += Number(trade.size) || 0;
    index.set(key, counts);
  }
  return index;
}

function sideRatios(index, timestamp, strike, type) {
  const counts = index.get(`${minute(timestamp)}:${strike}:${type}`) || { BUY: 0, SELL: 0, MID: 0 };
  const classified = counts.BUY + counts.SELL;
  const all = classified + counts.MID;
  const dealerSigned = counts.SELL - counts.BUY;
  return {
    classifiedRatio: classified ? dealerSigned / classified : 0,
    allRatio: all ? dealerSigned / all : 0,
    majority: Math.sign(dealerSigned),
    dealerContracts: dealerSigned,
    classifiedContracts: classified,
    allContracts: all,
  };
}

function solve(matrix, vector) {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
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
  const vector = Array.from({ length: size }, (_, i) => x.reduce((sum, values, index) => sum + values[i] * rows[index].targetDelta, 0));
  const coefficients = solve(matrix, vector);
  return { coefficients, predict(row) { return coefficients[0] + keys.reduce((sum, key, index) => sum + coefficients[index + 1] * ((row[key] - means[key]) / scales[key]), 0); } };
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

function money(value) { return `${value < 0 ? "-" : ""}$${Math.abs(value / 1_000_000).toFixed(3)}M`; }

const targets = loadTargets();
const intervalPayloads = JSON.parse(fs.readFileSync(path.resolve(ROOT, "tmp/quantdata-interval-map-2026-08-21.json"), "utf8"));
const tape = JSON.parse(fs.readFileSync(path.resolve(ROOT, "tmp/trinity-inventory-tape-2026-08-17-to-2026-08-21.json"), "utf8"));
const framesBySymbol = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, buildFrames(intervalPayloads[DATA_SYMBOL[symbol]])]));
const tapeBySymbol = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, buildTapeIndex(tape[DATA_SYMBOL[symbol]])]));

const rows = [];
for (let snapshotIndex = 1; snapshotIndex < SNAPSHOTS.length; snapshotIndex += 1) {
  const prior = SNAPSHOTS[snapshotIndex - 1];
  const current = SNAPSHOTS[snapshotIndex];
  for (const symbol of SYMBOLS) {
    const frames = framesBySymbol[symbol].filter((frame) => frame.timestamp > prior.timestamp + 1_000 && frame.timestamp <= current.timestamp + 1_000);
    const allFrames = framesBySymbol[symbol];
    const strikeEntries = [...targets.entries()].filter(([key]) => key.startsWith(`${current.label}:${symbol}:`));
    for (const [key, target] of strikeEntries) {
      const strike = Number(key.split(":").at(-1));
      const previousTarget = targets.get(`${prior.label}:${symbol}:${strike}`);
      if (!Number.isFinite(previousTarget) || !frames.length) continue;
      const row = {
        symbol, label: current.label, strike, target, previousTarget, targetDelta: target - previousTarget,
        callClassifiedLevel: 0, putClassifiedLevel: 0, callAllLevel: 0, putAllLevel: 0,
        callClassifiedDelta: 0, putClassifiedDelta: 0, callAllDelta: 0, putAllDelta: 0,
        callMajorityDelta: 0, putMajorityDelta: 0,
        callDealerContracts: 0, putDealerContracts: 0,
      };
      for (const frame of frames) {
        const frameIndex = allFrames.indexOf(frame);
        const priorFrame = frameIndex > 0 ? allFrames[frameIndex - 1] : null;
        const now = rawCell(frame, strike);
        const before = rawCell(priorFrame, strike);
        for (const type of ["CALL", "PUT"]) {
          const lower = type.toLowerCase();
          const ratios = sideRatios(tapeBySymbol[symbol], frame.timestamp, strike, type);
          const levelMagnitude = Math.abs(now[lower]);
          const deltaMagnitude = Math.abs(now[lower] - before[lower]);
          row[`${lower}ClassifiedLevel`] += levelMagnitude * ratios.classifiedRatio;
          row[`${lower}AllLevel`] += levelMagnitude * ratios.allRatio;
          row[`${lower}ClassifiedDelta`] += deltaMagnitude * ratios.classifiedRatio;
          row[`${lower}AllDelta`] += deltaMagnitude * ratios.allRatio;
          row[`${lower}MajorityDelta`] += deltaMagnitude * ratios.majority;
          row[`${lower}DealerContracts`] += ratios.dealerContracts;
        }
      }
      rows.push(row);
    }
  }
}

const featureSets = {
  classifiedLevel: ["callClassifiedLevel", "putClassifiedLevel"],
  allLevel: ["callAllLevel", "putAllLevel"],
  classifiedDelta: ["callClassifiedDelta", "putClassifiedDelta"],
  allDelta: ["callAllDelta", "putAllDelta"],
  majorityDelta: ["callMajorityDelta", "putMajorityDelta"],
  dealerContracts: ["callDealerContracts", "putDealerContracts"],
  classifiedLevelAndDelta: ["callClassifiedLevel", "putClassifiedLevel", "callClassifiedDelta", "putClassifiedDelta"],
  allLevelAndDelta: ["callAllLevel", "putAllLevel", "callAllDelta", "putAllDelta"],
};

const candidates = [];
for (const [name, keys] of Object.entries(featureSets)) {
  for (const ridge of [0.01, 0.1, 1, 10, 100, 1000]) {
    for (const scope of ["global", "perSymbol"]) {
      const validationPredictions = new Map();
      let valid = true;
      for (const validationLabel of ["0950", "0955"]) {
        const allowed = validationLabel === "0950" ? new Set(["0935", "0940", "0945"]) : new Set(["0935", "0940", "0945", "0950"]);
        for (const symbol of scope === "perSymbol" ? SYMBOLS : ["ALL"]) {
          const train = rows.filter((row) => allowed.has(row.label) && (symbol === "ALL" || row.symbol === symbol));
          const test = rows.filter((row) => row.label === validationLabel && (symbol === "ALL" || row.symbol === symbol));
          if (train.length <= keys.length + 2 || !test.length) { valid = false; break; }
          const model = fitRidge(train, keys, ridge);
          for (const row of test) validationPredictions.set(row, row.previousTarget + model.predict(row));
        }
        if (!valid) break;
      }
      if (!valid) continue;
      const validationRows = rows.filter((row) => ["0950", "0955"].includes(row.label));
      const validation = metrics(validationRows, (row) => validationPredictions.get(row));
      const holdoutPredictions = new Map();
      for (const symbol of scope === "perSymbol" ? SYMBOLS : ["ALL"]) {
        const train = rows.filter((row) => row.label !== "1000" && (symbol === "ALL" || row.symbol === symbol));
        const test = rows.filter((row) => row.label === "1000" && (symbol === "ALL" || row.symbol === symbol));
        const model = fitRidge(train, keys, ridge);
        for (const row of test) holdoutPredictions.set(row, row.previousTarget + model.predict(row));
      }
      const holdoutRows = rows.filter((row) => row.label === "1000");
      const holdout = metrics(holdoutRows, (row) => holdoutPredictions.get(row));
      candidates.push({ name, keys, ridge, scope, validation, holdout, holdoutPredictions });
    }
  }
}

candidates.sort((a, b) => a.validation.rmse - b.validation.rmse);
const best = candidates[0];
const holdoutRows = rows.filter((row) => row.label === "1000");
const persistence = metrics(holdoutRows, (row) => row.previousTarget);
console.log(`# Trinity classified-OPRA state reconciliation — 2026-08-21`);
console.log(`Best selected before 10:00: ${best.name}, ${best.scope}, ridge ${best.ridge}`);
console.log(`- validation RMSE ${money(best.validation.rmse)}, MAE ${money(best.validation.mae)}, R² ${best.validation.r2.toFixed(5)}, sign ${(best.validation.sign * 100).toFixed(2)}%`);
console.log(`- untouched 10:00 RMSE ${money(best.holdout.rmse)}, MAE ${money(best.holdout.mae)}, R² ${best.holdout.r2.toFixed(5)}, sign ${(best.holdout.sign * 100).toFixed(2)}%`);
console.log(`- persistence RMSE ${money(persistence.rmse)}, MAE ${money(persistence.mae)}, R² ${persistence.r2.toFixed(5)}, sign ${(persistence.sign * 100).toFixed(2)}%`);
console.log(`\nTop candidates:`);
for (const candidate of candidates.slice(0, 20)) console.log(`- ${candidate.name} ${candidate.scope} ridge ${candidate.ridge}: validation ${money(candidate.validation.rmse)}, 10:00 ${money(candidate.holdout.rmse)}, sign ${(candidate.holdout.sign * 100).toFixed(2)}%`);

const keys = { SPXW: [7640, 7675, 7680, 7690, 7700], SPY: [760, 764, 766, 768, 775], QQQ: [700, 708, 712, 714, 717] };
console.log(`\nExact 10:00 comparison:`);
for (const symbol of SYMBOLS) for (const strike of keys[symbol]) {
  const row = holdoutRows.find((entry) => entry.symbol === symbol && entry.strike === strike);
  if (!row) continue;
  const predicted = best.holdoutPredictions.get(row);
  console.log(`- ${symbol} ${strike}: Trinity ${money(row.target)}, 09:55 ${money(row.previousTarget)}, classified ${money(predicted)}, error ${money(predicted - row.target)}`);
}
