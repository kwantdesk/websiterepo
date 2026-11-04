import test from 'node:test';
import assert from 'node:assert/strict';
import {netFlowTooltipModel,netFlowTooltipRows,netFlowMinuteDetailRequest,NET_FLOW_DETAIL_ENDPOINT} from '../../public/gex-data-app/net-flow-interaction-model.js';
import {validateGexDataRequest,GEX_DATA_TOOLS} from '../../src/lib/gexDataPolicy.ts';

// Actual licensed SPY Oct16 first / 10:08 / final buckets, converted once to
// dollars by netFlowRows. This is a three-observation test, not a full-day proof.
const rows=[{time:1792157400000,call:5788028,put:5521052,spot:772.91},{time:1792159680000,call:2049629,put:2316823,spot:771.28},{time:1792181640000,call:957377,put:1782946,spot:762.74}];

test('Net Flow tooltip matches source premium precision, labels, full-input shares and first-spot change',()=>{
  const before=structuredClone(rows),model=netFlowTooltipModel(rows,rows[1]);
  assert.equal(model.timeLabel,'10:08 AM on October 16, 2026');assert.deepEqual(model.call,{label:'Call Premium',value:'$2 M',share:'23.30% of total'});assert.deepEqual(model.put,{label:'Put Premium',value:'$2.3 M',share:'24.08% of total'});
  assert.deepEqual(model.spot,{label:'Stock Price',value:'$771.28',change:'-0.21%',direction:'down'});assert.equal(model.hint,'Click for more information');
  assert.ok(netFlowTooltipRows(rows,rows[1]).includes('Call Premium: $2 M (23.30% of total)'));assert.deepEqual(rows,before);
});

test('Net Flow volume keeps contracts unscaled and source two-decimal abbreviation',()=>{
  const model=netFlowTooltipModel(rows,rows[1],{mode:'NET_VOLUME'});assert.equal(model.call.label,'Call Volume');assert.equal(model.put.label,'Put Volume');assert.equal(model.call.value,'2.05 M');assert.equal(model.put.value,'2.32 M');assert.equal(model.call.share,'23.30% of total');
});

test('tooltip clock/date follows website timezone including DST and cross-date display',()=>{
  assert.equal(netFlowTooltipModel(rows,rows[1],{timeZone:'Australia/Brisbane'}).timeLabel,'12:08 AM on October 17, 2026');
  const standard=[{time:Date.parse('2026-11-02T14:30:00Z'),call:0,put:0,spot:700}];assert.equal(netFlowTooltipModel(standard,standard[0]).timeLabel,'9:30 AM on November 2, 2026');
  assert.equal(netFlowTooltipModel(standard,standard[0]).spot.value,'$700');assert.equal(netFlowTooltipModel(standard,standard[0]).spot.change,'0.00%');
});

test('actual zeros remain zero; missing legs/first spot never create quotes, ratios or a future baseline',()=>{
  const source=[{time:rows[0].time,call:0,put:null,spot:null},{time:rows[1].time,call:0,put:5,spot:700}];
  const first=netFlowTooltipModel(source,source[0]);assert.equal(first.call.value,'$0');assert.equal(first.call.share,'0.00% of total');assert.equal(first.put.value,'—');assert.equal(first.put.share,'—');assert.equal(first.spot,null);
  assert.equal(netFlowTooltipModel(source,source[1]).spot.change,'—');assert.deepEqual(netFlowTooltipRows(source,null),[]);assert.throws(()=>netFlowTooltipModel(rows,rows[0],{mode:'BAD'}));
});

test('raw minute drilldown preserves actual scope and uses a fixed exclusive minute end even across missing buckets',()=>{
  const base={sessionDate:'2026-10-16',timeRange:{startTime:'2026-10-16T00:00:00Z',endTime:'2026-10-17T00:00:00Z'},aggregationPeriod:'5m',dataMode:'NET_PREMIUM',snapshotTime:'2026-10-16T15:00:00Z',includeComprisingTrades:true,
    filter:{tickers:['SPY','QQQ'],expirationDates:['2026-10-19'],moneyTypes:['AT_THE_MONEY'],tradeSides:['ASK'],strikePrices:[750,760]},filterExpression:{field:'PREMIUM',operation:'>=',value:1000}},before=structuredClone(base),request=netFlowMinuteDetailRequest({base,row:rows[1],cursor:['1792159680000','opaque-id']});
  assert.equal(NET_FLOW_DETAIL_ENDPOINT,'order-flow-unconsolidated');assert.equal(GEX_DATA_TOOLS[NET_FLOW_DETAIL_ENDPOINT].path,'order-flow/unconsolidated');
  assert.deepEqual(request.timeRange,{startTime:'2026-10-16T14:08:00.000Z',endTime:'2026-10-16T14:09:00.000Z'});assert.deepEqual(request.filter,base.filter);assert.deepEqual(request.filterExpression,base.filterExpression);assert.deepEqual(request.sort,{field:'TRADE_TIME',direction:'DESCENDING'});assert.equal(request.size,100);assert.deepEqual(request.searchAfter,['1792159680000','opaque-id']);
  assert.deepEqual(Object.keys(request).sort(),['filter','filterExpression','searchAfter','size','sort','timeRange']);assert.deepEqual(validateGexDataRequest(NET_FLOW_DETAIL_ENDPOINT,request),request);
  request.filter.tickers.push('AAPL');assert.deepEqual(base,before);
  assert.equal(netFlowMinuteDetailRequest({row:rows[0]}).timeRange.endTime,'2026-10-16T13:31:00.000Z');
});

test('detail request rejects invalid clocks and unsupported consolidated filters via shared request builder',()=>{
  for(const timestamp of [undefined,null,NaN,Infinity,'1792159680000',1.5,1e30])assert.throws(()=>netFlowMinuteDetailRequest({timestamp}));
  assert.throws(()=>netFlowMinuteDetailRequest({row:rows[0],base:{filter:{tradeConsolidationTypes:['SWEEP']}}}),/consolidated-only/);
  assert.throws(()=>netFlowMinuteDetailRequest({row:rows[0],base:{filterExpression:{field:'IS_GOLDEN_SWEEP',operation:'=',value:true}}}),/consolidated-only/);
});

test('minute drilldown intersects partial active time ranges without widening an exclusive edge or mutating input',()=>{
  const row=rows[1],base={filter:{ticker:'SPY'},timeRange:{startTime:'2026-10-16T14:08:12.345Z',endTime:'2026-10-16T14:08:58.999Z'}},before=structuredClone(base);
  assert.deepEqual(netFlowMinuteDetailRequest({base,row}).timeRange,base.timeRange);assert.deepEqual(base,before);
  assert.deepEqual(netFlowMinuteDetailRequest({base:{timeRange:{startTime:'2026-10-16T14:08:42Z',endTime:'2026-10-16T14:09:24Z'}},row}).timeRange,{startTime:'2026-10-16T14:08:42.000Z',endTime:'2026-10-16T14:09:00.000Z'});
  for(const timeRange of [{startTime:'2026-10-16T14:09:00Z',endTime:'2026-10-16T14:09:01Z'},{startTime:'2026-10-16T14:07:00Z',endTime:'2026-10-16T14:08:00Z'},{startTime:'bad',endTime:'bad'}])assert.throws(()=>netFlowMinuteDetailRequest({base:{timeRange},row}),/time range|overlap/);
});
