#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SESSION_DATE = '2026-08-21';
const SESSION_DAY = Date.parse(`${SESSION_DATE}T00:00:00Z`);
const INTERVAL_PATH = path.resolve(ROOT, 'tmp/quantdata-interval-map-2026-08-21.json');
const FULL_PATH = 'C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json';
const EXTRA_PATH = path.resolve(ROOT, 'scripts/trinity-extra-lattices-2026-08-21.json');
const SYMBOL_MAP = { SPXW: 'SPX', SPY: 'SPY', QQQ: 'QQQ' };
const TIMES = [
  ['930', Date.parse('2026-08-21T13:30:00Z')],
  ['935', Date.parse('2026-08-21T13:35:00Z')],
  ['940', Date.parse('2026-08-21T13:40:00Z')],
  ['945', Date.parse('2026-08-21T13:45:00Z')],
  ['950', Date.parse('2026-08-21T13:50:00Z')],
  ['955', Date.parse('2026-08-21T13:55:00Z')],
  ['1000', Date.parse('2026-08-21T14:00:00Z')],
];
const BUCKETS = [
  ['d0', 0, 0],
  ['d1_7', 1, 7],
  ['d8_30', 8, 30],
  ['d31_90', 31, 90],
  ['d91_365', 91, 365],
  ['d366p', 366, Infinity],
];

function parseTargets() {
  const full = JSON.parse(fs.readFileSync(FULL_PATH, 'utf8'));
  const extra = JSON.parse(fs.readFileSync(EXTRA_PATH, 'utf8'));
  const result = new Map();
  for (const [key] of TIMES) result.set(key, new Map());
  for (const [key, bySymbol] of Object.entries(full.targets)) {
    for (const [sourceSymbol, values] of Object.entries(bySymbol)) {
      const symbol = sourceSymbol === 'SPX' ? 'SPXW' : sourceSymbol;
      result.get(key).set(symbol, new Map(values.map((row) => [Number(row.strike), Number(row.value)])));
    }
  }
  for (const [iso, bySymbol] of Object.entries(extra)) {
    const key = String(Number(iso.slice(11, 16).replace(':', '')));
    for (const [symbol, payload] of Object.entries(bySymbol)) {
      result.get(key).set(symbol, new Map(Object.entries(payload.values).map(([strike, value]) => [Number(strike), Number(value)])));
    }
  }
  return result;
}

function nearestFrame(payload, wanted) {
  const timestamps = Object.keys(payload.data || {}).map(Number);
  const timestamp = timestamps.reduce((best, current) => Math.abs(current - wanted) < Math.abs(best - wanted) ? current : best);
  return { timestamp, expiries: payload.data[timestamp] };
}

function cell(expiries, expiry, strike) {
  const strikeMap = expiries?.[expiry];
  if (!strikeMap) return {};
  return strikeMap[strike.toFixed(1)] ?? strikeMap[String(strike)] ?? {};
}

function bucketFor(expiry) {
  const days = Math.round((Date.parse(`${expiry}T00:00:00Z`) - SESSION_DAY) / 86_400_000);
  return BUCKETS.find(([, min, max]) => days >= min && days <= max)?.[0] ?? null;
}

function exposureFeatures(frame, strike) {
  const features = {};
  for (const [name] of BUCKETS) {
    features[`${name}_call`] = 0;
    features[`${name}_put`] = 0;
  }
  features.all_call = 0;
  features.all_put = 0;
  features.invSqrt_call = 0;
  features.invSqrt_put = 0;
  features.invDay_call = 0;
  features.invDay_put = 0;
  for (const expiry of Object.keys(frame.expiries || {})) {
    const bucket = bucketFor(expiry);
    if (!bucket) continue;
    const node = cell(frame.expiries, expiry, strike);
    const call = Number(node.CALL || 0);
    const put = Number(node.PUT || 0);
    const days = Math.max(0.25, (Date.parse(`${expiry}T20:00:00Z`) - frame.timestamp) / 86_400_000);
    features[`${bucket}_call`] += call;
    features[`${bucket}_put`] += put;
    features.all_call += call;
    features.all_put += put;
    features.invSqrt_call += call / Math.sqrt(days);
    features.invSqrt_put += put / Math.sqrt(days);
    features.invDay_call += call / days;
    features.invDay_put += put / days;
  }
  return features;
}

function solve(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    [a[column], a[pivot]] = [a[pivot], a[column]];
    const divisor = a[column][column] || 1e-18;
    for (let j = column; j <= n; j += 1) a[column][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = a[row][column];
      for (let j = column; j <= n; j += 1) a[row][j] -= factor * a[column][j];
    }
  }
  return a.map((row) => row[n]);
}

function fit(train, keys, ridge = 1) {
  const means = Object.fromEntries(keys.map((key) => [key, train.reduce((sum, row) => sum + row[key], 0) / train.length]));
  const scales = Object.fromEntries(keys.map((key) => {
    const variance = train.reduce((sum, row) => sum + (row[key] - means[key]) ** 2, 0) / train.length;
    return [key, Math.sqrt(variance) || 1];
  }));
  const columns = ['intercept', ...keys];
  const x = train.map((row) => [1, ...keys.map((key) => (row[key] - means[key]) / scales[key])]);
  const matrix = columns.map((_, i) => columns.map((__, j) => x.reduce((sum, row) => sum + row[i] * row[j], 0) + (i === j && i ? ridge : 0)));
  const vector = columns.map((_, i) => x.reduce((sum, row, rowIndex) => sum + row[i] * train[rowIndex].target, 0));
  const coefficients = solve(matrix, vector);
  return {
    keys, means, scales, coefficients,
    predict(row) { return coefficients[0] + keys.reduce((sum, key, index) => sum + coefficients[index + 1] * ((row[key] - means[key]) / scales[key]), 0); },
  };
}

function metrics(rows, predict) {
  const predictions = rows.map(predict);
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / rows.length;
  const sse = rows.reduce((sum, row, index) => sum + (row.target - predictions[index]) ** 2, 0);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  return {
    rmse: Math.sqrt(sse / rows.length),
    mae: rows.reduce((sum, row, index) => sum + Math.abs(row.target - predictions[index]), 0) / rows.length,
    r2: 1 - sse / total,
    sign: rows.reduce((sum, row, index) => sum + (Math.sign(row.target) === Math.sign(predictions[index])), 0) / rows.length,
  };
}

function money(value) { return `${value < 0 ? '-' : ''}$${Math.abs(value / 1e6).toFixed(3)}M`; }

const interval = JSON.parse(fs.readFileSync(INTERVAL_PATH, 'utf8'));
const targets = parseTargets();
const frames = new Map();
for (const [key, timestamp] of TIMES) {
  for (const [symbol, dataSymbol] of Object.entries(SYMBOL_MAP)) frames.set(`${key}:${symbol}`, nearestFrame(interval[dataSymbol], timestamp));
}

const rows = [];
for (let timeIndex = 0; timeIndex < TIMES.length; timeIndex += 1) {
  const [timeKey] = TIMES[timeIndex];
  for (const symbol of Object.keys(SYMBOL_MAP)) {
    const currentTargets = targets.get(timeKey).get(symbol);
    const priorTargets = timeIndex ? targets.get(TIMES[timeIndex - 1][0]).get(symbol) : null;
    const frame = frames.get(`${timeKey}:${symbol}`);
    const priorFrame = timeIndex ? frames.get(`${TIMES[timeIndex - 1][0]}:${symbol}`) : null;
    for (const [strike, target] of currentTargets) {
      const row = { timeKey, timeIndex, symbol, strike, target, ...exposureFeatures(frame, strike) };
      if (priorTargets?.has(strike)) {
        row.prior = priorTargets.get(strike);
        const previous = exposureFeatures(priorFrame, strike);
        for (const key of Object.keys(previous)) row[`delta_${key}`] = row[key] - previous[key];
      }
      rows.push(row);
    }
  }
}

const train = rows.filter((row) => row.timeIndex >= 1 && row.timeKey !== '1000' && Number.isFinite(row.prior));
const test = rows.filter((row) => row.timeKey === '1000' && Number.isFinite(row.prior));
const bucketKeys = BUCKETS.flatMap(([name]) => [`delta_${name}_call`, `delta_${name}_put`]);
const families = [
  ['prior', ['prior']],
  ['prior+front', ['prior', 'delta_d0_call', 'delta_d0_put']],
  ['prior+all', ['prior', 'delta_all_call', 'delta_all_put']],
  ['prior+dteBuckets', ['prior', ...bucketKeys]],
  ['prior+weighted', ['prior', 'delta_invSqrt_call', 'delta_invSqrt_put', 'delta_invDay_call', 'delta_invDay_put']],
  ['prior+dteBuckets+weighted', ['prior', ...bucketKeys, 'delta_invSqrt_call', 'delta_invSqrt_put', 'delta_invDay_call', 'delta_invDay_put']],
];

console.log('# Trinity multi-expiry state reconciliation — 2026-08-21');
console.log(`Training rows ${train.length}; untouched 10:00 rows ${test.length}`);
console.log('| Model | Ridge | RMSE | MAE | R² | Sign |');
console.log('|---|---:|---:|---:|---:|---:|');
const ranked = [];
for (const [name, keys] of families) {
  for (const perSymbol of [false, true]) {
    for (const ridge of [0.01, 0.1, 1, 10, 100, 1000]) {
      const models = perSymbol
        ? Object.fromEntries(Object.keys(SYMBOL_MAP).map((symbol) => [symbol, fit(train.filter((row) => row.symbol === symbol), keys, ridge)]))
        : { ALL: fit(train, keys, ridge) };
      const predict = (row) => models[row.symbol]?.predict(row) ?? models.ALL.predict(row);
      const result = { name: `${name}${perSymbol ? ':symbol' : ':global'}`, ridge, keys, models, predict, ...metrics(test, predict) };
      ranked.push(result);
    }
  }
}
ranked.sort((a, b) => a.rmse - b.rmse);
for (const result of ranked.slice(0, 18)) console.log(`| ${result.name} | ${result.ridge} | ${money(result.rmse)} | ${money(result.mae)} | ${result.r2.toFixed(5)} | ${(result.sign * 100).toFixed(2)}% |`);

const best = ranked[0];
console.log(`\nBest: ${best.name}, ridge ${best.ridge}`);
for (const [symbol, model] of Object.entries(best.models)) {
  const normalized = Object.fromEntries(model.keys.map((key, index) => [key, model.coefficients[index + 1] / model.scales[key]]));
  console.log(`${symbol} raw-space coefficients: ${JSON.stringify(normalized)}`);
}
console.log('| Symbol | Strike | Trinity 09:55 | Trinity 10:00 | Prediction | Error |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const [symbol, strikes] of Object.entries({ SPXW: [7680, 7675, 7640], SPY: [760, 764, 766, 768, 775], QQQ: [700, 708, 712, 714, 717] })) {
  for (const strike of strikes) {
    const row = test.find((item) => item.symbol === symbol && item.strike === strike);
    const prediction = best.predict(row);
    console.log(`| ${symbol} | ${strike} | ${money(row.prior)} | ${money(row.target)} | ${money(prediction)} | ${money(prediction - row.target)} |`);
  }
}

for (const symbol of Object.keys(SYMBOL_MAP)) {
  const subset = test.filter((row) => row.symbol === symbol);
  const result = metrics(subset, best.predict);
  console.log(`${symbol}: RMSE ${money(result.rmse)}, MAE ${money(result.mae)}, R² ${result.r2.toFixed(5)}, sign ${(result.sign * 100).toFixed(2)}%`);
}
