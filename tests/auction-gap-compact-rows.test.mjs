import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAuctionGapCompactRows } from '../src/lib/auctionGapCompactRows.ts';

const candle = (timestamp = 1_000, patch = {}) => ({
  timestamp, open: 100, high: 100.5, low: 99.75, close: 100.25, volume: 10, ...patch,
});
const rows = () => [
  { tickIndex: 399, bidVolume: 2, askVolume: 0, unknownVolume: 0 },
  { tickIndex: 400, bidVolume: 0, askVolume: 3, unknownVolume: 0 },
  { tickIndex: 401, bidVolume: 0, askVolume: 0, unknownVolume: 3 },
  { tickIndex: 402, bidVolume: 0, askVolume: 2, unknownVolume: 0 },
];
const envelope = (bar, patch = {}) => ({
  schemaVersion: 'kwantify-auction-gap-rows-v1', provider: 'Rithmic', contractSymbol: 'NQU6',
  coverageComplete: true, executionOrderComplete: true, rows: [bar], ...patch,
});

test('accepts and copies exact time-bar rows reconciled to chart geometry and volume', () => {
  const input = envelope({ chartIndex: 0, timestamp: 1_000, endTime: 61_000,
    openTick: 400, highTick: 402, lowTick: 399, closeTick: 401, volume: 10, rows: rows() });
  const before = structuredClone(input);
  const result = validateAuctionGapCompactRows(input, [candle()], 'nqu6', 0.25);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.bars[0].rows.map(row => row.tickIndex), [399, 400, 401, 402]);
  assert.notEqual(result.bars[0].rows, input.rows[0].rows);
  assert.deepEqual(input, before);
});

test('accepts event rows only when source ownership matches the chart candle', () => {
  const candles = [candle(1_000, { sourceStartTimestamp: 1_000, sourceEndTimestamp: 1_250 })];
  const input = envelope({ chartIndex: 0, timestamp: 1_000,
    sourceStartTimestamp: 1_000, sourceEndTimestamp: 1_250, rows: rows() });
  assert.equal(validateAuctionGapCompactRows(input, candles, 'NQU6', 0.25).status, 'ready');
  input.rows[0].sourceEndTimestamp = 1_251;
  assert.equal(validateAuctionGapCompactRows(input, candles, 'NQU6', 0.25).reason, 'event-geometry-mismatch');
});

test('rejects unsupported, wrong-contract, and unproved envelopes without partial output', () => {
  const bar = { chartIndex: 0, timestamp: 1_000, endTime: 61_000,
    openTick: 400, highTick: 402, lowTick: 399, closeTick: 401, volume: 10, rows: rows() };
  const cases = [
    [envelope(bar, { schemaVersion: 'legacy' }), 'unsupported-source-schema'],
    [envelope(bar, { contractSymbol: 'NQZ6' }), 'contract-mismatch'],
    [envelope(bar, { coverageComplete: false, reason: 'historical-coverage-unproved', rows: [] }), 'historical-coverage-unproved'],
    [envelope(bar, { executionOrderComplete: false }), 'historical-coverage-unproved'],
  ];
  for (const [input, reason] of cases) {
    const result = validateAuctionGapCompactRows(input, [candle()], 'NQU6', 0.25);
    assert.equal(result.status, 'unavailable'); assert.equal(result.reason, reason); assert.deepEqual(result.bars, []);
  }
});

test('rejects bar identity, tick geometry, ordering, price range, and volume mismatches', () => {
  const base = { chartIndex: 0, timestamp: 1_000, endTime: 61_000,
    openTick: 400, highTick: 402, lowTick: 399, closeTick: 401, volume: 10, rows: rows() };
  const cases = [
    [{ ...base, chartIndex: 1 }, 'bar-identity-mismatch'],
    [{ ...base, highTick: 403 }, 'time-geometry-mismatch'],
    [{ ...base, rows: [base.rows[1], base.rows[0], ...base.rows.slice(2)] }, 'invalid-price-row'],
    [{ ...base, rows: [{ ...base.rows[0], tickIndex: 398 }, ...base.rows.slice(1)] }, 'invalid-price-row'],
    [{ ...base, rows: [{ ...base.rows[0], bidVolume: 1 }, ...base.rows.slice(1)] }, 'source-volume-mismatch'],
  ];
  for (const [bar, reason] of cases) {
    assert.equal(validateAuctionGapCompactRows(envelope(bar), [candle()], 'NQU6', 0.25).reason, reason);
  }
});

test('rejects omitted, extra, and ambiguous bar geometry', () => {
  assert.equal(validateAuctionGapCompactRows(envelope({ chartIndex: 0, timestamp: 1_000, rows: rows() }),
    [candle()], 'NQU6', 0.25).reason, 'ambiguous-bar-geometry');
  assert.equal(validateAuctionGapCompactRows(envelope({ chartIndex: 0, timestamp: 1_000, endTime: 61_000,
    sourceStartTimestamp: 1_000, sourceEndTimestamp: 1_100,
    openTick: 400, highTick: 402, lowTick: 399, closeTick: 401, volume: 10, rows: rows() }),
    [candle()], 'NQU6', 0.25).reason, 'ambiguous-bar-geometry');
  assert.equal(validateAuctionGapCompactRows(envelope({ chartIndex: 0, timestamp: 1_000, endTime: 61_000,
    openTick: 400, highTick: 402, lowTick: 399, closeTick: 401, volume: 10, rows: rows() }, { rows: [] }),
    [candle()], 'NQU6', 0.25).reason, 'bar-count-mismatch');
});
