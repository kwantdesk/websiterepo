import test from 'node:test';
import assert from 'node:assert/strict';
import { OPTION_TRADE_DETAIL_ENDPOINT, UNCONSOLIDATED_COLUMNS, optionTradeDetailRequest, unconsolidatedTradeRows } from '../../public/gex-data-app/option-trade-detail-model.js';

test('individual-print drilldown retains actual Net Drift scope and replaces session with interval', () => {
  const base = { sessionDate: '2026-10-16', aggregationPeriod: '5m', filter: { tickers: ['SPY', 'QQQ'], expirationDates: ['2026-10-16'], strikePrices: [600, 610], moneyTypes: ['OTM', 'ATM'] }, filterExpression: { field: 'PREMIUM', operation: '>=', value: 1000 }, includeComprisingTrades: true };
  const before = structuredClone(base), timeRange = { startTime: '2026-10-16T13:30:00Z', endTime: '2026-10-16T13:35:00Z' };
  const result = optionTradeDetailRequest({ base, timeRange, cursor: ['cursor-time', 'opaque-id'] });
  assert.equal(OPTION_TRADE_DETAIL_ENDPOINT, 'order-flow-unconsolidated');
  assert.deepEqual(result.filter, base.filter);
  assert.deepEqual(result.filterExpression, base.filterExpression);
  assert.deepEqual(result.timeRange, timeRange);
  assert.deepEqual(result.searchAfter, ['cursor-time', 'opaque-id']);
  assert.deepEqual(result.sort, { field: 'PREMIUM', direction: 'DESCENDING' });
  assert.equal(result.size, 100);
  assert.ok(!('sessionDate' in result) && !('aggregationPeriod' in result) && !('includeComprisingTrades' in result));
  result.filter.tickers.push('AAPL');
  assert.deepEqual(base, before);
});

test('raw detail rejects unsupported consolidated filters and invalid range or size', () => {
  assert.throws(() => optionTradeDetailRequest({ base: { filter: { tradeConsolidationTypes: ['SWEEP'] } } }), /consolidated-only/);
  assert.throws(() => optionTradeDetailRequest({ base: { filterExpression: { field: 'IS_GOLDEN_SWEEP', operation: '=', value: true } } }), /consolidated-only/);
  assert.throws(() => optionTradeDetailRequest({ size: 101 }));
  assert.throws(() => optionTradeDetailRequest({ timeRange: { startTime: 'bad', endTime: 'bad' } }));
});

test('raw rows preserve licensed values and omit an invented consolidation column', () => {
  const payload = { data: [{ id: 'a1b2c3d4-7890-4321-aabb-ccddeeff0011', osi: 'AAPL260516C00220000', ticker: 'AAPL', optionPrice: 2.85, premium: 28500, size: 100, tradeSideCode: 'ABOVE_ASK', greeks: { delta: .41234 } }], nextSearchAfter: ['time', 'id'] };
  const rows = unconsolidatedTradeRows(payload);
  assert.deepEqual(rows, payload.data);
  assert.notEqual(rows[0], payload.data[0]);
  assert.ok(!UNCONSOLIDATED_COLUMNS.some(column => column.key === 'tradeConsolidationType'));
  assert.ok(UNCONSOLIDATED_COLUMNS.some(column => column.key === 'premium'));
  assert.ok(UNCONSOLIDATED_COLUMNS.some(column => column.key === 'greeks.delta'));
  assert.throws(() => unconsolidatedTradeRows({ data: null }));
  assert.throws(() => unconsolidatedTradeRows({ data: [null] }));
});
