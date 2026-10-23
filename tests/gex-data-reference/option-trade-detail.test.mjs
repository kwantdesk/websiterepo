import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { OPTION_TRADE_DETAIL_ENDPOINT, UNCONSOLIDATED_COLUMNS, optionTradeDetailRequest, unconsolidatedTradeRows } from '../../public/gex-data-app/option-trade-detail-model.js';

const app = readFileSync(new URL('../../public/gex-data-app/app.js', import.meta.url), 'utf8');
const netDriftRenderer = app.slice(app.indexOf('  function renderNetDriftQuant('), app.indexOf('  function renderDarkFlowQuant('));

function clickNetDriftBucket(times, period, index = 0) {
  const rows = times.map(time => ({ time, call: 10, put: 5, spot: 100 }));
  let chart, detail;
  const context = {
    parseNetDrift: () => rows,
    getControl: key => ({ ticker: 'SPY', period, driftUnderlying: 'SHOW' }[key] || 'HIDE'),
    buildRequest: () => ({}), activeTool: { id: 'net-drift' },
    gexTimeZone: () => 'UTC', CHART_COLORS: {}, compact: String, formatPrice: String,
    setSummary() {}, displayChartTime: String,
    quantCanvas: options => { chart = options; return {}; },
    openTradeDetail: value => { detail = value; },
  };
  // Execute the real renderer's click handler, not a duplicate range formula.
  vm.runInNewContext(netDriftRenderer + '\nthis.render = renderNetDriftQuant;', context);
  context.render({});
  chart.onClick(rows[index], index);
  return detail;
}

test('Net Drift clicked buckets do not absorb missing intervals before the next row', () => {
  const start = Date.parse('2026-10-23T14:00:00Z');
  for (const [period, duration] of [['1m', 60000], ['5m', 300000], ['1h', 3600000]]) {
    const detail = clickNetDriftBucket([start, start + duration * 5], period);
    assert.equal(detail.timeRange.startTime, new Date(start).toISOString());
    assert.equal(detail.timeRange.endTime, new Date(start + duration).toISOString(), period);
    assert.equal(detail.individual, true);
  }
});

test('Net Drift final and contiguous buckets retain each offered interval duration', () => {
  const start = Date.parse('2026-10-23T14:00:00.123Z');
  for (const period of ['1m', '2m', '3m', '4m', '5m', '10m', '15m', '20m', '30m', '1h', '2h', '4h']) {
    const duration = Number.parseInt(period, 10) * (period.endsWith('h') ? 3600000 : 60000);
    for (const [times, index] of [[[start], 0], [[start, start + duration], 0], [[start, start + duration], 1]]) {
      const detail = clickNetDriftBucket(times, period, index);
      assert.equal(detail.timeRange.startTime, new Date(times[index]).toISOString());
      assert.equal(detail.timeRange.endTime, new Date(times[index] + duration).toISOString(), period);
    }
  }
});

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
