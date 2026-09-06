import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAuctionGapHistoryEnvelope } from '../src/lib/auctionGapHistoryEnvelope.ts';
const execution = (i, patch = {}) => ({ eventId: `e${i}`, recordIndex: i, timestamp: 1000 + i,
  open: 100 + i, high: 100 + i, low: 100 + i, close: 100 + i,
  volume: 10, trades: 1, bidVolume: 0, askVolume: 10, aggressor: 'BUY', sideSemanticsVersion: 2, ...patch });
const envelope = (patch = {}) => ({ revision: 1,
  request: { symbol: 'NQ', contractSymbol: 'NQU6', timeframe: '1m', fromMs: 1000, toMs: 2000 },
  payload: { schemaVersion: 'kwantify-market-data-v3', provider: 'Rithmic', contractSymbol: 'NQU6',
    fromMs: 1000, toMs: 2000, sourceRecordCount: 2, truncated: false,
    historicalAvailable: true, coverageComplete: true, executionOrderComplete: true,
    records: [execution(0), execution(1)], ...patch } });

test('affirmative exact envelope produces a copied version-2 atomic execution tape', () => {
  const input = envelope(), before = structuredClone(input);
  const result = validateAuctionGapHistoryEnvelope(input, 'NQU6');
  assert.equal(result.status, 'ready'); assert.equal(result.coverage, 'complete');
  assert.equal(result.records.length, 2); assert.notEqual(result.records, input.payload.records);
  assert.equal(result.records[0].delta, 10); assert.deepEqual(input, before);
});

test('current retained-tape gateway claim is never promoted to complete history', () => {
  const result = validateAuctionGapHistoryEnvelope(envelope({ historicalAvailable: false }), 'NQU6');
  assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'historical-coverage-unproved');
  assert.equal(result.coverage, 'partial'); assert.deepEqual(result.records, []);
});

test('wrong contract/schema/provider/bounds/truncation/count each fail explicitly', () => {
  const cases = [
    [envelope({ contractSymbol: 'NQZ6' }), 'contract-mismatch'],
    [envelope({ schemaVersion: 'kwantify-market-data-v2' }), 'unsupported-source-schema'],
    [envelope({ provider: 'Unknown' }), 'unsupported-source-schema'],
    [envelope({ fromMs: 1001 }), 'coverage-bounds-mismatch'],
    [envelope({ toMs: 1999 }), 'coverage-bounds-mismatch'],
    [envelope({ truncated: true }), 'historical-coverage-unproved'],
    [envelope({ sourceRecordCount: 3 }), 'record-count-mismatch'],
  ];
  for (const [input, reason] of cases) assert.equal(validateAuctionGapHistoryEnvelope(input, 'NQU6').reason, reason);
});

test('legacy, aggregated, flow-only and malformed executions cannot pass', () => {
  const variants = [
    { sideSemanticsVersion: 1 }, { high: 101 }, { flowOnly: true }, { volume: 0 },
    { bidVolume: 8, askVolume: 8 }, { timestamp: 999 }, { trades: 0 },
  ];
  for (const patch of variants) {
    const input = envelope({ records: [execution(0, patch), execution(1)] });
    assert.equal(validateAuctionGapHistoryEnvelope(input, 'NQU6').reason, 'invalid-execution-record');
  }
});

test('source timestamp ordering and identities remain strict while same-ms response order is preserved', () => {
  assert.equal(validateAuctionGapHistoryEnvelope(envelope({ records: [execution(0), execution(1, { timestamp: 999 })] }), 'NQU6').reason,
    'invalid-execution-record');
  const sameMs = validateAuctionGapHistoryEnvelope(envelope({ records: [execution(1, { timestamp: 1000 }), execution(0, { timestamp: 1000 })] }), 'NQU6');
  assert.equal(sameMs.status, 'ready'); assert.deepEqual(sameMs.records.map(row => row.recordIndex), [1, 0]);
  assert.equal(validateAuctionGapHistoryEnvelope(envelope({ records: [execution(0), execution(1, { eventId: 'e0' })] }), 'NQU6').reason,
    'duplicate-execution');
});

test('an archive must positively attest complete execution ordering', () => {
  assert.equal(validateAuctionGapHistoryEnvelope(envelope({ executionOrderComplete: false }), 'NQU6').reason,
    'historical-coverage-unproved');
});
