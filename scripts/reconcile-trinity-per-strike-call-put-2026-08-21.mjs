#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXPIRY = '2026-08-21';
const SYMBOLS = ['SPXW', 'SPY', 'QQQ'];
const DATA_SYMBOL = { SPXW: 'SPX', SPY: 'SPY', QQQ: 'QQQ' };
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
    for (const row of normalRows(source)) result.set([label, symbol, row.strike].join(':'), row.value);
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

function rawCell(frame, strike) {
  const value = frame?.bucket?.[Number(strike).toFixed(1)] ?? frame?.bucket?.[String(Number(strike))] ?? {};
  return { call: Number(value.CALL ?? 0) || 0, put: Number(value.PUT ?? 0) || 0 };
}

function nearestFrame(frames, timestamp) {
  let answer = null;
  for (const frame of frames) {
    if (frame.timestamp <= timestamp + 1000) answer = frame;
    else break;
  }
  return answer;
}

function solve(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    [a[column], a[pivot]] = [a[pivot], a[column]];
    const divisor = a[column][column];
    if (Math.abs(divisor) < 1e-15) continue;
    for (let j = column; j <= n; j += 1) a[column][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = a[row][column];
      for (let j = column; j <= n; j += 1) a[row][j] -= factor * a[column][j];
    }
  }
  return a.map((row) => row[n]);
}

function ridgeFit(rows, keys, ridge, prior, intercept) {
  const scales = Object.fromEntries(keys.map((key) => [key, Math.max(...rows.map((row) => Math.abs(row[key])), 1)]));
  const x = rows.map((row) => [...(intercept ? [1] : []), ...keys.map((key) => row[key] / scales[key])]);
  const size = x[0].length;
  const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) =>
    x.reduce((sum, values) => sum + values[i] * values[j], 0) + (i === j && (!intercept || i > 0) ? ridge : 0)));
  const priorVector = prior
    ? [...(intercept ? [prior.intercept || 0] : []), ...keys.map((key) => (prior[key] || 0) * scales[key])]
    : Array(size).fill(0);
  const vector = Array.from({ length: size }, (_, i) => x.reduce((sum, values, index) => sum + values[i] * rows[index].target, 0)
    + ((!intercept || i > 0) ? ridge * priorVector[i] : 0));
  const coefficients = solve(matrix, vector);
  return {
    intercept: intercept ? coefficients[0] : 0,
    ...Object.fromEntries(keys.map((key, index) => [key, coefficients[index + (intercept ? 1 : 0)] / scales[key]])),
  };
}

function prediction(fit, row, keys) {
  return fit.intercept + keys.reduce((sum, key) => sum + fit[key] * row[key], 0);
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

function money(value) {
  return (value < 0 ? '-' : '') + '$' + Math.abs(value / 1e6).toFixed(3) + 'M';
}

const targets = loadTargets();
const interval = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'tmp/quantdata-interval-map-2026-08-21.json'), 'utf8'));
const framesBySymbol = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, buildFrames(interval[DATA_SYMBOL[symbol]])]));
const rows = [];
for (const snapshot of SNAPSHOTS) {
  for (const symbol of SYMBOLS) {
    const frame = nearestFrame(framesBySymbol[symbol], snapshot.timestamp);
    for (const [key, target] of targets) {
      if (!key.startsWith([snapshot.label, symbol, ''].join(':'))) continue;
      const strike = Number(key.split(':').at(-1));
      rows.push({ symbol, strike, label: snapshot.label, timestamp: snapshot.timestamp, target, ...rawCell(frame, strike) });
    }
  }
}

const TRAIN = new Set(['0930', '0935', '0940', '0945']);
const VALIDATE = new Set(['0950', '0955']);
const TEST = new Set(['1000']);
const KEYS = ['call', 'put'];

function runCandidate(settings) {
  const trainRows = rows.filter((row) => TRAIN.has(row.label));
  const globalPriors = new Map((settings.priorMode === 'symbol' ? SYMBOLS : ['ALL']).map((group) => {
    const selected = settings.priorMode === 'symbol' ? trainRows.filter((row) => row.symbol === group) : trainRows;
    return [group, ridgeFit(selected, KEYS, 1e-9, null, true)];
  }));
  const buckets = new Map();
  for (const row of trainRows) {
    const key = [row.symbol, row.strike].join(':');
    const bucket = buckets.get(key) || [];
    bucket.push(row);
    buckets.set(key, bucket);
  }
  const fits = new Map();
  for (const [key, bucket] of buckets) {
    const base = bucket[0];
    const fitRows = settings.deltaMode ? bucket.map((row) => ({
      ...row, target: row.target - base.target, call: row.call - base.call, put: row.put - base.put,
    })) : bucket;
    const symbol = key.split(':')[0];
    const prior = globalPriors.get(settings.priorMode === 'symbol' ? symbol : 'ALL');
    fits.set(key, {
      fit: ridgeFit(fitRows, KEYS, settings.ridge, prior, settings.intercept && !settings.deltaMode),
      base: settings.deltaMode ? base : null,
    });
  }
  const evaluate = (labels) => {
    const selected = rows.filter((row) => labels.has(row.label) && fits.has([row.symbol, row.strike].join(':')));
    const predictions = selected.map((row) => {
      const state = fits.get([row.symbol, row.strike].join(':'));
      if (!state.base) return prediction(state.fit, row, KEYS);
      return state.base.target + prediction(state.fit, {
        call: row.call - state.base.call, put: row.put - state.base.put,
      }, KEYS);
    });
    return { rows: selected, predictions, metrics: metrics(selected, predictions) };
  };
  return { validate: evaluate(VALIDATE), test: evaluate(TEST) };
}

const candidates = [];
for (const priorMode of ['global', 'symbol']) {
  for (const deltaMode of [false, true]) {
    for (const intercept of [false, true]) {
      if (deltaMode && intercept) continue;
      for (const ridge of [0, 1e-8, 1e-6, 1e-4, 1e-3, 1e-2, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000]) {
        const settings = { ridge, priorMode, deltaMode, intercept };
        candidates.push({ settings, result: runCandidate(settings) });
      }
    }
  }
}
candidates.sort((left, right) => left.result.validate.metrics.rmse - right.result.validate.metrics.rmse);
const best = candidates[0];
const persistenceRows = rows.filter((row) => TEST.has(row.label)).map((row) => ({
  ...row, prior: targets.get(['0955', row.symbol, row.strike].join(':')),
})).filter((row) => Number.isFinite(row.prior));
const persistence = metrics(persistenceRows, persistenceRows.map((row) => row.prior));

console.log('Per-strike carried call/put inventory reconstruction');
console.log('Model selection uses 09:50 and 09:55; 10:00 is untouched.');
console.log(JSON.stringify({ ...best.settings, validation: best.result.validate.metrics, untouched1000: best.result.test.metrics, persistence1000: persistence }, null, 2));
for (const symbol of SYMBOLS) {
  console.log('\n' + symbol + ' largest 10:00 rows');
  const selected = best.result.test.rows.map((row, index) => ({ row, predicted: best.result.test.predictions[index] }))
    .filter(({ row }) => row.symbol === symbol).sort((left, right) => Math.abs(right.row.target) - Math.abs(left.row.target));
  for (const { row, predicted } of selected.slice(0, 12)) {
    const prior = targets.get(['0955', symbol, row.strike].join(':'));
    console.log(String(row.strike).padStart(7) + ' target ' + money(row.target).padStart(11) + ' predicted ' + money(predicted).padStart(11) + ' persistence ' + money(prior).padStart(11));
  }
}

fs.writeFileSync(path.resolve(ROOT, 'tmp/trinity-per-strike-call-put-2026-08-21.json'), JSON.stringify({
  selected: best.settings,
  validation: best.result.validate.metrics,
  untouched1000: best.result.test.metrics,
  persistence1000: persistence,
  predictions: best.result.test.rows.map((row, index) => ({ ...row, prediction: best.result.test.predictions[index] })),
}, null, 2));

// State equation: carried call/put contracts plus signed OPRA contracts traded
// after the open, all repriced through the current front-expiry gamma surface.
const inventoryInputs = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'tmp/trinity-dealer-inventory-inputs-2026-08-21.json'), 'utf8'));
const tape = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'tmp/trinity-inventory-tape-2026-08-17-to-2026-08-21.json'), 'utf8'));
const OPEN = Date.parse('2026-08-21T13:30:00.000Z');
const BUCKETS = ['CB', 'CS', 'CM', 'PB', 'PS', 'PM'];

function tapeBucket(trade) {
  const prefix = trade.type === 'CALL' ? 'C' : trade.type === 'PUT' ? 'P' : '';
  const suffix = trade.side === 'BUY' ? 'B' : trade.side === 'SELL' ? 'S' : 'M';
  return prefix ? prefix + suffix : '';
}

const cumulativeByStrike = new Map();
for (const symbol of SYMBOLS) {
  const dataSymbol = DATA_SYMBOL[symbol];
  const groups = new Map();
  for (const trade of tape[dataSymbol] || []) {
    const timestamp = Number(trade.timestamp);
    if (trade.expiration !== EXPIRY || timestamp < OPEN || timestamp > SNAPSHOTS.at(-1).timestamp) continue;
    const key = Number(trade.strike);
    const bucket = groups.get(key) || [];
    bucket.push({ timestamp, bucket: tapeBucket(trade), size: Number(trade.size) || 0 });
    groups.set(key, bucket);
  }
  for (const [strike, trades] of groups) {
    trades.sort((left, right) => left.timestamp - right.timestamp);
    cumulativeByStrike.set([symbol, strike].join(':'), trades);
  }
}

for (const row of rows) {
  const oi = inventoryInputs[DATA_SYMBOL[row.symbol]]?.oi?.[Number(row.strike).toFixed(1)] || {};
  row.callUnit = (Number(oi.callOpenInterest) || 0) > 0 ? row.call / Number(oi.callOpenInterest) : 0;
  row.putUnit = (Number(oi.putOpenInterest) || 0) > 0 ? row.put / Number(oi.putOpenInterest) : 0;
  const totals = Object.fromEntries(BUCKETS.map((bucket) => [bucket, 0]));
  for (const trade of cumulativeByStrike.get([row.symbol, row.strike].join(':')) || []) {
    if (trade.timestamp > row.timestamp) break;
    if (Object.hasOwn(totals, trade.bucket)) totals[trade.bucket] += trade.size;
  }
  for (const bucket of BUCKETS) {
    const unit = bucket.startsWith('C') ? row.callUnit : row.putUnit;
    row['flow' + bucket] = totals[bucket] * unit;
  }
}

function smallFit(sourceRows, xKeys, yKey, ridge = 0) {
  const matrix = Array.from({ length: xKeys.length }, (_, i) => Array.from({ length: xKeys.length }, (_, j) =>
    sourceRows.reduce((sum, row) => sum + row[xKeys[i]] * row[xKeys[j]], 0) + (i === j ? ridge : 0)));
  const vector = xKeys.map((key) => sourceRows.reduce((sum, row) => sum + row[key] * row[yKey], 0));
  return solve(matrix, vector);
}

function residualizeGroups(sourceRows, flowKeys) {
  const result = [];
  const groups = new Map();
  for (const row of sourceRows) {
    const key = [row.symbol, row.strike].join(':');
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 3) continue;
    const baseKeys = ['callUnit', 'putUnit'];
    const yWeights = smallFit(group, baseKeys, 'target', 1e-12);
    const xWeights = Object.fromEntries(flowKeys.map((flowKey) => {
      const synthetic = group.map((row) => ({ ...row, synthetic: row[flowKey] }));
      return [flowKey, smallFit(synthetic, baseKeys, 'synthetic', 1e-12)];
    }));
    for (const row of group) {
      const projectedY = baseKeys.reduce((sum, key, index) => sum + row[key] * yWeights[index], 0);
      const residual = { ...row, target: row.target - projectedY };
      for (const flowKey of flowKeys) {
        residual[flowKey] = row[flowKey] - baseKeys.reduce((sum, key, index) => sum + row[key] * xWeights[flowKey][index], 0);
      }
      result.push(residual);
    }
  }
  return result;
}

function contractStateCandidate({ perSymbol, ridge }) {
  const train = rows.filter((row) => TRAIN.has(row.label) && (row.callUnit || row.putUnit));
  const baseFlowKeys = BUCKETS.map((bucket) => 'flow' + bucket);
  const flowKeys = perSymbol
    ? SYMBOLS.flatMap((symbol) => baseFlowKeys.map((key) => symbol + ':' + key))
    : baseFlowKeys;
  const expanded = train.map((row) => ({
    ...row,
    ...Object.fromEntries(flowKeys.map((key) => {
      const [maybeSymbol, rawKey] = key.includes(':') ? key.split(':') : [null, key];
      return [key, !maybeSymbol || maybeSymbol === row.symbol ? row[rawKey] : 0];
    })),
  }));
  const residual = residualizeGroups(expanded, flowKeys);
  const flowFit = ridgeFit(residual, flowKeys, ridge, null, false);
  const baseFits = new Map();
  const groups = new Map();
  for (const row of expanded) {
    const key = [row.symbol, row.strike].join(':');
    const group = groups.get(key) || [];
    group.push({
      ...row,
      targetAfterFlow: row.target - prediction(flowFit, row, flowKeys),
    });
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const weights = smallFit(group, ['callUnit', 'putUnit'], 'targetAfterFlow', 1e-12);
    baseFits.set(key, { callUnit: weights[0], putUnit: weights[1] });
  }
  const evaluate = (labels) => {
    const selected = rows.filter((row) => labels.has(row.label) && baseFits.has([row.symbol, row.strike].join(':')));
    const predictions = selected.map((sourceRow) => {
      const row = {
        ...sourceRow,
        ...Object.fromEntries(flowKeys.map((key) => {
          const [maybeSymbol, rawKey] = key.includes(':') ? key.split(':') : [null, key];
          return [key, !maybeSymbol || maybeSymbol === sourceRow.symbol ? sourceRow[rawKey] : 0];
        })),
      };
      const base = baseFits.get([row.symbol, row.strike].join(':'));
      return row.callUnit * base.callUnit + row.putUnit * base.putUnit + prediction(flowFit, row, flowKeys);
    });
    return { rows: selected, predictions, metrics: metrics(selected, predictions) };
  };
  return { flowFit, validate: evaluate(VALIDATE), test: evaluate(TEST) };
}

const stateCandidates = [];
for (const perSymbol of [false, true]) {
  for (const ridge of [0, 1e-8, 1e-6, 1e-4, 1e-3, 1e-2, 0.1, 1, 10, 100, 1000]) {
    const settings = { perSymbol, ridge };
    stateCandidates.push({ settings, result: contractStateCandidate(settings) });
  }
}
stateCandidates.sort((left, right) => left.result.validate.metrics.rmse - right.result.validate.metrics.rmse);
const bestState = stateCandidates[0];
console.log('\nCarried contract inventory + signed OPRA flow');
console.log(JSON.stringify({
  ...bestState.settings,
  validation: bestState.result.validate.metrics,
  untouched1000: bestState.result.test.metrics,
  persistence1000: persistence,
  flowWeights: bestState.result.flowFit,
}, null, 2));
for (const symbol of SYMBOLS) {
  console.log('\n' + symbol + ' state-equation 10:00 rows');
  const selected = bestState.result.test.rows.map((row, index) => ({ row, predicted: bestState.result.test.predictions[index] }))
    .filter(({ row }) => row.symbol === symbol).sort((left, right) => Math.abs(right.row.target) - Math.abs(left.row.target));
  for (const { row, predicted } of selected.slice(0, 12)) {
    const prior = targets.get(['0955', symbol, row.strike].join(':'));
    console.log(String(row.strike).padStart(7) + ' target ' + money(row.target).padStart(11) + ' predicted ' + money(predicted).padStart(11) + ' persistence ' + money(prior).padStart(11));
  }
}
