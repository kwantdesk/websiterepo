#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXPIRY = '2026-08-21';
const SYMBOLS = ['SPXW', 'SPY', 'QQQ'];
const DATA_SYMBOL = { SPXW: 'SPX', SPY: 'SPY', QQQ: 'QQQ' };
const TRAIN_LABELS = new Set(['0930', '0935', '0940', '0945', '0950', '0955']);
const SNAPSHOTS = [
  ['0930', '2026-08-21T13:30:00.000Z'],
  ['0935', '2026-08-21T13:35:00.000Z'],
  ['0940', '2026-08-21T13:40:00.000Z'],
  ['0945', '2026-08-21T13:45:00.000Z'],
  ['0950', '2026-08-21T13:50:00.000Z'],
  ['0955', '2026-08-21T13:55:00.000Z'],
  ['1000', '2026-08-21T14:00:00.000Z'],
].map(([label, iso]) => ({ label, timestamp: Date.parse(iso) }));

function normalRows(rows) {
  if (Array.isArray(rows)) return rows.map((row) => Array.isArray(row)
    ? { strike: Number(row[0]), value: Number(row[1]) }
    : { strike: Number(row.strike), value: Number(row.value) });
  return Object.entries(rows || {}).map(([strike, value]) => ({ strike: Number(strike), value: Number(value) }));
}

function loadTargets() {
  const result = new Map();
  const put = (label, symbol, source) => {
    for (const row of normalRows(source)) result.set(`${label}:${symbol}:${row.strike}`, row.value);
  };
  const full = JSON.parse(fs.readFileSync('C:/Users/Karen/AppData/Local/Temp/trinity-full-lattices-2026-08-21.json', 'utf8'));
  for (const [source, label] of [['930', '0930'], ['945', '0945'], ['1000', '1000']]) {
    put(label, 'SPXW', full.targets[source].SPX);
    put(label, 'SPY', full.targets[source].SPY);
    put(label, 'QQQ', full.targets[source].QQQ);
  }
  const extra = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'scripts/trinity-extra-lattices-2026-08-21.json'), 'utf8'));
  const labels = { '09:35:00': '0935', '09:40:00': '0940', '09:50:00': '0950', '09:55:00': '0955' };
  for (const [iso, panels] of Object.entries(extra)) {
    const label = labels[iso.slice(11, 19)];
    if (!label) continue;
    for (const symbol of SYMBOLS) put(label, symbol, panels[symbol]?.values);
  }
  return result;
}

function buildFrames(payload) {
  return Object.entries(payload?.data || {}).map(([timestamp, expirations]) => ({
    timestamp: Number(timestamp), bucket: expirations?.[EXPIRY] || {},
  })).filter((frame) => Number.isFinite(frame.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
}

function nearestFrame(frames, timestamp) {
  let answer = null;
  for (const frame of frames) {
    if (frame.timestamp <= timestamp + 1000) answer = frame;
    else break;
  }
  return answer;
}

function rawCell(frame, strike) {
  const value = frame?.bucket?.[Number(strike).toFixed(1)] ?? frame?.bucket?.[String(Number(strike))] ?? {};
  return { call: Number(value.CALL ?? 0) || 0, put: Number(value.PUT ?? 0) || 0 };
}

function metrics(rows, predictions) {
  const mean = rows.reduce((sum, row) => sum + row.target, 0) / Math.max(rows.length, 1);
  const sse = rows.reduce((sum, row, index) => sum + (row.target - predictions[index]) ** 2, 0);
  const total = rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0);
  return {
    n: rows.length,
    rmse: Math.sqrt(sse / Math.max(rows.length, 1)),
    mae: rows.reduce((sum, row, index) => sum + Math.abs(row.target - predictions[index]), 0) / Math.max(rows.length, 1),
    r2: total ? 1 - sse / total : 0,
    sign: rows.reduce((sum, row, index) => sum + (Math.sign(row.target) === Math.sign(predictions[index]) ? 1 : 0), 0) / Math.max(rows.length, 1),
  };
}

function solve2(rows, ridge, priorCall = 0, priorPut = 0) {
  let aa = ridge;
  let ab = 0;
  let bb = ridge;
  let ay = ridge * priorCall;
  let by = ridge * priorPut;
  for (const row of rows) {
    aa += row.callUnit * row.callUnit;
    ab += row.callUnit * row.putUnit;
    bb += row.putUnit * row.putUnit;
    ay += row.callUnit * row.target;
    by += row.putUnit * row.target;
  }
  const determinant = aa * bb - ab * ab;
  if (Math.abs(determinant) < 1e-20) return { callContracts: 0, putContracts: 0 };
  return {
    callContracts: (ay * bb - by * ab) / determinant,
    putContracts: (by * aa - ay * ab) / determinant,
  };
}

function solve1(rows, key, ridge = 0) {
  let xx = ridge;
  let xy = 0;
  for (const row of rows) {
    xx += row[key] * row[key];
    xy += row[key] * row.target;
  }
  return xx ? xy / xx : 0;
}

const targets = loadTargets();
const interval = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'tmp/quantdata-interval-map-2026-08-21.json'), 'utf8'));
const inventoryInputs = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'tmp/trinity-dealer-inventory-inputs-2026-08-21.json'), 'utf8'));
const framesBySymbol = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, buildFrames(interval[DATA_SYMBOL[symbol]])]));
const rows = [];

for (const snapshot of SNAPSHOTS) {
  for (const symbol of SYMBOLS) {
    const frame = nearestFrame(framesBySymbol[symbol], snapshot.timestamp);
    for (const [key, target] of targets) {
      if (!key.startsWith(`${snapshot.label}:${symbol}:`)) continue;
      const strike = Number(key.split(':').at(-1));
      const raw = rawCell(frame, strike);
      const oi = inventoryInputs[DATA_SYMBOL[symbol]]?.oi?.[strike.toFixed(1)] || {};
      const callOi = Number(oi.callOpenInterest) || 0;
      const putOi = Number(oi.putOpenInterest) || 0;
      const callUnit = callOi > 0 ? raw.call / callOi : 0;
      const putUnit = putOi > 0 ? raw.put / putOi : 0;
      rows.push({
        symbol, strike, label: snapshot.label, timestamp: snapshot.timestamp, target,
        callOi, putOi, callUnit, putUnit,
        averageUnit: (callUnit + putUnit) / 2,
        oiWeightedUnit: (callOi * callUnit + putOi * putUnit) / Math.max(callOi + putOi, 1),
      });
    }
  }
}

const groups = new Map();
for (const row of rows) {
  const key = `${row.symbol}:${row.strike}`;
  const group = groups.get(key) || [];
  group.push(row);
  groups.set(key, group);
}

const testRows = [];
const methods = new Map();
const candidateRidges = [0, 1e-16, 1e-14, 1e-12, 1e-10, 1e-8, 1e-6, 1e-4, 1e-2, 1, 100];
for (const [key, group] of groups) {
  const train = group.filter((row) => TRAIN_LABELS.has(row.label));
  const test = group.find((row) => row.label === '1000');
  const prior = group.find((row) => row.label === '0955');
  if (!test || !prior || train.length < 4) continue;
  const model = { key, row: test, predictions: { persistence: prior.target } };
  const safeRatio = (numerator, denominator) => Math.abs(denominator) > 1e-12 ? numerator / denominator : 1;
  model.predictions.callReprice = prior.target * safeRatio(test.callUnit, prior.callUnit);
  model.predictions.putReprice = prior.target * safeRatio(test.putUnit, prior.putUnit);
  model.predictions.averageReprice = prior.target * safeRatio(test.averageUnit, prior.averageUnit);
  model.predictions.oiWeightedReprice = prior.target * safeRatio(test.oiWeightedUnit, prior.oiWeightedUnit);
  const oneAverage = solve1(train, 'averageUnit');
  const oneWeighted = solve1(train, 'oiWeightedUnit');
  model.predictions.oneAverage = oneAverage * test.averageUnit;
  model.predictions.oneWeighted = oneWeighted * test.oiWeightedUnit;
  for (const ridge of candidateRidges) {
    const fit = solve2(train, ridge);
    model.predictions[`twoFactor:${ridge}`] = fit.callContracts * test.callUnit + fit.putContracts * test.putUnit;
  }
  testRows.push(test);
  methods.set(key, model);
}

const names = Object.keys(methods.values().next().value?.predictions || {});
const results = {};
for (const name of names) {
  const predictions = testRows.map((row) => methods.get(`${row.symbol}:${row.strike}`).predictions[name]);
  results[name] = metrics(testRows, predictions);
}

const ranked = Object.entries(results).sort((a, b) => a[1].rmse - b[1].rmse);
console.log('Stable signed-inventory repricing test');
console.log('Training: 09:30-09:55. Untouched test: full 10:00 Trinity lattice.');
console.log(JSON.stringify(Object.fromEntries(ranked), null, 2));

const bestName = ranked[0][0];
for (const symbol of SYMBOLS) {
  console.log(`\n${symbol} largest 10:00 rows (${bestName})`);
  const selected = testRows.filter((row) => row.symbol === symbol)
    .sort((a, b) => Math.abs(b.target) - Math.abs(a.target)).slice(0, 12);
  for (const row of selected) {
    const state = methods.get(`${row.symbol}:${row.strike}`);
    const predicted = state.predictions[bestName];
    const prior = state.predictions.persistence;
    console.log(`${String(row.strike).padStart(7)} target ${(row.target / 1e6).toFixed(3).padStart(9)}M `
      + `pred ${(predicted / 1e6).toFixed(3).padStart(9)}M prior ${(prior / 1e6).toFixed(3).padStart(9)}M`);
  }
}

fs.writeFileSync(path.resolve(ROOT, 'tmp/trinity-stable-inventory-test-2026-08-21.json'), JSON.stringify({
  train: [...TRAIN_LABELS],
  test: '1000',
  ranked: Object.fromEntries(ranked),
  bestMethod: bestName,
  predictions: testRows.map((row) => ({
    symbol: row.symbol,
    strike: row.strike,
    target: row.target,
    ...methods.get(`${row.symbol}:${row.strike}`).predictions,
  })),
}, null, 2));
