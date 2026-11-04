import test from 'node:test';
import assert from 'node:assert/strict';
import { heatCellSelection, heatCellSnapshotRequest, heatCellTradeRequest, heatCellTradeSort, heatCellSnapshotHistory } from '../../public/gex-data-app/heat-cell-history-model.js';
import {HEAT_METRICS} from '../../public/gex-data-app/exposure-models.js';
import {optionTradeDetailTableSort} from '../../public/gex-data-app/option-trade-detail-model.js';

// Schema fixtures transcribed from official public Heat Map docs, not observed
// market values. Archive envelope is the actual ExposureArchiver serialization.
const T0 = Date.parse('2026-10-16T14:00:00Z'), T1 = T0 + 60_000;
const request = { sessionDate: '2026-10-16', dataMode: 'NET_GAMMA_EXPOSURE', filter: { ticker: 'SPY', moneyTypes: ['OUT_OF_THE_MONEY'] }, filterExpression: { field: 'PREMIUM', operator: 'GREATER_THAN', value: 1000 } };
const selection = overrides => heatCellSelection({ request, expirationDate: '2026-10-23', strikePrice: 700, sourceUnit: 'exact-source-exposure', ...overrides });
const capture = (ts, value = { callValue: 10, putValue: -3 }, overrides = {}) => ({ ts, path: '/v1/options/tool/heat-map', request: structuredClone(request), payload: { type: 'contract', data: { '2026-10-23': { '700.0': value } } }, ...overrides });

test('snapshot and individual trade requests preserve filters/DSL and exact cell without mutating source', () => {
  const before = structuredClone(request), cell = selection(), pinned = heatCellSnapshotRequest(cell, { snapshotTime: T0 });
  assert.equal(pinned.sessionDate, undefined);
  assert.equal(pinned.snapshotTime, new Date(T0).toISOString());
  assert.deepEqual(pinned.filter, { ...request.filter, expirationDates: ['2026-10-23'], strikePrices: [700] });
  assert.deepEqual(pinned.filterExpression, request.filterExpression);
  const trades = heatCellTradeRequest(cell, { cursor: ['actual-cursor', 'actual-id'] });
  assert.deepEqual(trades.searchAfter, ['actual-cursor', 'actual-id']);
  assert.equal(trades.sessionDate, '2026-10-16');
  assert.equal(trades.dataMode, undefined);
  assert.equal(trades.includeComprisingTrades, undefined);
  assert.deepEqual(trades.filter, pinned.filter);
  assert.deepEqual(trades.filterExpression, request.filterExpression);
  assert.deepEqual(request, before);
});

test('raw captured series retains source units/signs, sorts and clips to replay without forward fill', () => {
  const rows = heatCellSnapshotHistory([capture(T1, { callValue: 20, putValue: -7 }), capture(T0)], selection(), { throughMs: T0 });
  assert.deepEqual(rows.map(row => [row.time, row.call, row.put, row.value]), [[T0, 10, -3, 7]]);
  assert.equal(rows[0].sourceUnit, 'exact-source-exposure');
  assert.equal(rows[0].basis, 'observation');
  assert.equal(rows[0].strikePrice, 700);
});

test('complete SUM-mode snapshots are never accumulated twice', () => {
  const source = { ...request, dataMode: 'NET_PREMIUM' }, cell = selection({ request: source, sourceUnit: 'source-premium-unit' });
  const rows = heatCellSnapshotHistory([capture(T0, { callValue: 100, putValue: 20 }, { request: source }), capture(T1, { callValue: 100, putValue: 20 }, { request: source })], cell);
  assert.deepEqual(rows.map(row => row.value), [80, 80]);
  assert.equal(rows[1].call, 100);
});

test('zero is an observation, missing cells and projected legs remain null', () => {
  const rows = heatCellSnapshotHistory([capture(T0, { callValue: 0, putValue: 0 }), capture(T1, { callValue: 4 }), capture(T1 + 60_000, null)], selection());
  assert.equal(rows[0].value, 0);
  assert.equal(rows[1].put, null);
  assert.equal(rows[1].value, null);
  assert.equal(rows[2].call, null);
  assert.equal(rows[2].value, null);
});

test('other metric/ticker/session/filter/endpoint frames cannot leak into cell history', () => {
  const foreign = [
    capture(T0, undefined, { request: { ...request, dataMode: 'NET_DELTA_EXPOSURE' } }),
    capture(T0, undefined, { request: { ...request, filter: { ...request.filter, ticker: 'QQQ' } } }),
    capture(T0, undefined, { request: { ...request, sessionDate: '2026-10-15' } }),
    capture(T0, undefined, { request: { ...request, filterExpression: {} } }),
    capture(T0, undefined, { path: '/v1/options/tool/interval-map' }),
    capture(Date.parse('2026-11-03T15:00:00Z')),
  ];
  assert.deepEqual(heatCellSnapshotHistory(foreign, selection()), []);
});

test('explicit historical snapshot time survives later capture date; duplicates use latest genuine receipt', () => {
  const source = { ...request, snapshotTime: new Date(T0).toISOString() }; delete source.sessionDate;
  const rows = heatCellSnapshotHistory([capture(T1, { callValue: 10, putValue: -3 }, { request: source }), capture(Date.parse('2026-11-03T15:00:00Z'), { callValue: 12, putValue: -3 }, { request: source })], selection());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].time, T0);
  assert.equal(rows[0].value, 9);
  assert.equal(rows[0].basis, 'snapshot');
});

test('single-leg series preserves tiny IV and zero without borrowing any other cell', () => {
  const source = { ...request, dataMode: 'CALL_IMPLIED_VOLATILITY' }, cell = selection({ request: source });
  const single = value => ({ type: 'single', data: { '2026-10-23': { 700: { value }, 701: { value: 99 } } } });
  const rows = heatCellSnapshotHistory([capture(T0, null, { request: source, payload: single(.0476837) }), capture(T1, null, { request: source, payload: single(0) })], cell);
  assert.deepEqual(rows.map(row => row.value), [.0476837, 0]);
  assert.equal(rows[0].put, null);
  assert.deepEqual(heatCellTradeRequest(cell).filter.contractTypes, ['CALL']);
  assert.deepEqual(heatCellTradeRequest(selection({ request: { ...request, dataMode: 'PUT_GAMMA' } })).filter.contractTypes, ['PUT']);
});

test('pinned trade details stop at exact selected instant, including DST change days', () => {
  for (const [sessionDate, pinned, midnight] of [['2026-10-16', '2026-10-16T14:00:00Z', '2026-10-16T04:00:00.000Z'], ['2026-11-01', '2026-11-01T15:00:00Z', '2026-11-01T04:00:00.000Z']]) {
    const source = { ...request, snapshotTime: pinned }; delete source.sessionDate;
    const trades = heatCellTradeRequest(selection({ request: source, sessionDate }));
    assert.equal(trades.sessionDate, undefined);
    assert.equal(trades.timeRange.startTime, midnight);
    assert.equal(trades.timeRange.endTime, new Date(pinned).toISOString());
  }
});

test('rejects invalid cell selectors and consolidated-only trade fields instead of silent substitution', () => {
  assert.throws(() => selection({ strikePrice: NaN }));
  assert.throws(() => selection({ expirationDate: '2026-02-30' }));
  assert.throws(() => selection({ sessionDate: '2026-10-15' }));
  assert.throws(() => selection({ request: { ...request, dataMode: 'UNKNOWN' } }));
  assert.throws(() => heatCellSnapshotRequest(selection(), { snapshotTime: '2026-10-17T14:00:00Z' }));
  assert.throws(() => heatCellTradeRequest(selection({ request: { ...request, filter: { ...request.filter, tradeConsolidationTypes: ['BLOCK'] } } })));
  assert.deepEqual(heatCellSnapshotHistory([capture(1e20), capture(null)], selection()), []);
});

test('all46 Heat Map cell modes use source metadata ranking translated to supported public print fields',()=>{
  // Source381567@69140 in2ds-mayw4ligj.js;489583 uses filterField DESC.
  // These are field contracts, not invented market values or exposure guesses.
  const expected={NET_CHARM_EXPOSURE:'SIZE',NET_DELTA_EXPOSURE:'SIZE',NET_GAMMA_EXPOSURE:'SIZE',NET_VANNA_EXPOSURE:'SIZE',NET_OPEN_INTEREST:'OPEN_INTEREST',NET_PREMIUM:'PREMIUM',NET_TRADE_COUNT:'TRADE_TIME',NET_VOLUME:'SIZE'};
  for(const leg of ['CALL','PUT']){
    for(const name of ['ASK_PRICE','BID_PRICE','OPTION_PRICE','IMPLIED_VOLATILITY'])expected[`${leg}_${name}`]=name;
    for(const name of ['CHARM','COLOR','DELTA','GAMMA','OMEGA','RHO','SIGMA','SPEED','THETA','ULTIMA','VANNA','VEGA','VETA','VOMMA','ZOMMA'])expected[`${leg}_${name}`]=name;
  }
  assert.equal(Object.keys(expected).length,46);assert.equal(HEAT_METRICS.length,46);
  for(const metric of HEAT_METRICS){
    const sort={field:expected[metric.apiName],direction:'DESCENDING'},cell=selection({request:{...request,dataMode:metric.apiName}});
    assert.deepEqual(heatCellTradeSort(metric.apiName),sort,metric.apiName);
    assert.deepEqual(heatCellTradeRequest(cell).sort,sort,metric.apiName);
  }
  assert.throws(()=>heatCellTradeSort('UNKNOWN'),/supported/);
});

test('IV cell details request IV descending and show the IV column while hidden price/Sigma fields never pretend Premium',()=>{
  const iv=heatCellTradeRequest(selection({request:{...request,dataMode:'CALL_IMPLIED_VOLATILITY'}}));
  assert.deepEqual(iv.sort,{field:'IMPLIED_VOLATILITY',direction:'DESCENDING'});assert.deepEqual(iv.filter.contractTypes,['CALL']);
  assert.deepEqual(optionTradeDetailTableSort(iv),{sortKey:'impliedVolatility',sortDirection:-1});
  for(const mode of ['CALL_ASK_PRICE','PUT_BID_PRICE','CALL_SIGMA'])assert.deepEqual(optionTradeDetailTableSort(heatCellTradeRequest(selection({request:{...request,dataMode:mode}}))),{sortKey:null,sortDirection:-1});
});
