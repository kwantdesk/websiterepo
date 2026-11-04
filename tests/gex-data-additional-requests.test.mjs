import test from 'node:test';
import assert from 'node:assert/strict';
import {additionalToolRequest,validateAdditionalToolRequest} from '../public/gex-data-app/additional-tool-requests.js';
import {GEX_DATA_TOOLS,validateGexDataRequest} from '../src/lib/gexDataPolicy.ts';

const session={sessionDate:'2026-10-16',filter:{ticker:'SPY'}};
const ids=['net-flow','volatility-skew','volatility-drift','term-structure','open-interest-by-strike','open-interest-by-expiration','open-interest-over-time','open-interest-change'];

test('all eight documented tools route through the existing options transport and policy',()=>{
  for(const id of ids){
    assert.deepEqual(GEX_DATA_TOOLS[id],{surface:'options'});
    const request=additionalToolRequest(id,{},session);
    assert.deepEqual(validateGexDataRequest(id,request),request);
  }
  assert.equal(GEX_DATA_TOOLS['order-flow-unconsolidated'].path,'order-flow/unconsolidated');
  assert.throws(()=>validateGexDataRequest('not-a-tool',{}),/Unsupported/);
});

test('Net Flow selects its true metric and preserves canonical filters and source interval, never a drift alias',()=>{
  const base={...session,filter:{ticker:'SPY',moneyTypes:['OUT_OF_THE_MONEY']},filterExpression:{conjunction:'AND',filters:[{field:'tradeSideCode',operation:'=',values:['AA','A']}]}};
  const saved=structuredClone(base);
  assert.deepEqual(additionalToolRequest('net-flow',{flowMetric:'NET_VOLUME',period:'5m'},base),{...base,dataMode:'NET_VOLUME',aggregationPeriod:'5m'});
  assert.deepEqual(base,saved);
  assert.equal(additionalToolRequest('net-flow',{},session).dataMode,'NET_PREMIUM');
  for(const dataMode of ['PREMIUM','NET_DELTA','',null])assert.throws(()=>validateGexDataRequest('net-flow',{...session,dataMode}),/metric/);
});

test('skew preserves snapshot and expiry/leg filters while removing unrelated chart-only request fields',()=>{
  const base={snapshotTime:'2026-10-16T18:00:00Z',aggregationPeriod:'5m',filter:{ticker:'SPY',expirationDates:['2026-10-19']}};
  assert.deepEqual(additionalToolRequest('volatility-skew',{contractTypeOptional:'PUT'},base),{snapshotTime:base.snapshotTime,filter:{ticker:'SPY',expirationDates:['2026-10-19'],contractTypes:['PUT']}});
  const cleared=additionalToolRequest('volatility-skew',{contractTypeOptional:''},{...session,filter:{ticker:'SPY',contractTypes:['CALL']}});
  assert.equal(cleared.filter.contractTypes,undefined);
});

test('fixed-minute volatility drift uses a singular expiry and cannot leak aggregation or snapshot selectors',()=>{
  assert.deepEqual(additionalToolRequest('volatility-drift',{}, {...session,aggregationPeriod:'5m',snapshotTime:'2026-10-16T18:00:00Z',filter:{ticker:'SPY',expirationDates:['2026-10-19']}}),{sessionDate:'2026-10-16',filter:{ticker:'SPY',expirationDate:'2026-10-19'}});
  assert.throws(()=>validateGexDataRequest('volatility-drift',{...session,aggregationPeriod:'5m'}),/aggregationPeriod/);
  assert.throws(()=>validateGexDataRequest('volatility-drift',{...session,timeRange:{startTime:'2026-10-16T16:00:00Z',endTime:'2026-10-16T17:00:00Z'}}),/timeRange/);
});

test('term structure keeps both signed delta legs available for source-backed absolute-magnitude chart filtering',()=>{
  const body=additionalToolRequest('term-structure',{deltaMin:'0.3',deltaMax:'0.7',moneyType:'ATM,OTM',expiryStart:'2026-10-16',expiryEnd:'2026-12-31',minStrike:'700',maxStrike:'800'},session);
  assert.deepEqual(body,{sessionDate:'2026-10-16',filter:{ticker:'SPY',expirationDateRange:{startDate:'2026-10-16',endDate:'2026-12-31'},moneyTypes:['AT_THE_MONEY','OUT_OF_THE_MONEY'],strikePriceRange:{min:700,max:800}}});
  assert.equal(body.filter.deltaRange,undefined,'positive-only wire bounds would remove all puts');
  for(const controls of [{deltaMin:-.1},{deltaMax:1.1},{deltaMin:.8,deltaMax:.3},{deltaMax:'foo'}])assert.throws(()=>additionalToolRequest('term-structure',controls,session),/delta magnitude/);
});

test('OI by strike accepts only one expiry while OI by expiry accepts only one positive strike',()=>{
  assert.deepEqual(additionalToolRequest('open-interest-by-strike',{expiry:'2026-10-19'}, {...session,aggregationPeriod:'1m',filter:{ticker:'SPY',strikePrices:[770]}}),{sessionDate:'2026-10-16',filter:{ticker:'SPY',expirationDate:'2026-10-19'}});
  assert.deepEqual(additionalToolRequest('open-interest-by-expiration',{strike:'770'}, {...session,filter:{ticker:'SPY',expirationDates:['2026-10-19']}}),{sessionDate:'2026-10-16',filter:{ticker:'SPY',strikePrice:770}});
  for(const strike of ['0','-1','NaN','Infinity','770,771'])assert.throws(()=>additionalToolRequest('open-interest-by-expiration',{strike},session));
  assert.throws(()=>additionalToolRequest('open-interest-by-strike',{}, {...session,filter:{ticker:'SPY',expirationDates:['2026-10-19','2026-10-20']}}),/one expiration/);
});

test('OI over time intrinsically requests all available sessions without an unsupported time-range selector',()=>{
  const base={...session,aggregationPeriod:'1m',snapshotTime:'2026-10-16T18:00:00Z',timeRange:{startTime:'2026-10-01T00:00:00Z',endTime:'2026-10-17T00:00:00Z'}};
  assert.deepEqual(additionalToolRequest('open-interest-over-time',{expiry:'2026-10-19',strike:'770',rangeStart:'2026-10-01',rangeEnd:'2026-10-16'},base),{filter:{ticker:'SPY',expirationDate:'2026-10-19',strikePrice:770}});
  assert.throws(()=>validateGexDataRequest('open-interest-over-time',session),/sessionDate/);
});

test('OI change preserves server-side pagination and sorting while leaving visualization settings local',()=>{
  const input={...session,aggregationPeriod:'1m',size:50,searchAfter:['18102','id'],sort:{field:'changeInOpenInterest',direction:'DESCENDING'},includes:['TICKER','CHANGE_IN_OPEN_INTEREST']};
  const expected={...input};delete expected.aggregationPeriod;
  assert.deepEqual(additionalToolRequest('open-interest-change',{oiChart:'line'},input),expected);
  assert.equal(additionalToolRequest('open-interest-change',{},session).size,100);
  assert.throws(()=>validateGexDataRequest('open-interest-change',{...session,size:101}),/Page size/);
  assert.throws(()=>validateGexDataRequest('open-interest-change',{...session,includes:['TICKER'],excludes:['ID']}),/not both/);
});

test('OI change requests global change-descending rank before pagination, including the unfiltered full market',()=>{
  const input={sessionDate:'2026-11-02'},saved=structuredClone(input);
  const body=additionalToolRequest('open-interest-change',{},input);
  assert.deepEqual(body,{sessionDate:'2026-11-02',filter:{},size:100,sort:{field:'changeInOpenInterest',direction:'DESCENDING'}});
  assert.deepEqual(validateGexDataRequest('open-interest-change',body),body);assert.deepEqual(input,saved);
  const cursor=['174061','real-contract-record'];const next=additionalToolRequest('open-interest-change',{}, {...body,searchAfter:cursor});
  assert.deepEqual(next.sort,body.sort);assert.deepEqual(next.searchAfter,cursor);assert.equal(next.filter.ticker,undefined);assert.equal(next.filter.tickers,undefined);
  const chosen={field:'PERCENT_CHANGE_IN_OPEN_INTEREST',direction:'ASCENDING'};
  assert.deepEqual(additionalToolRequest('open-interest-change',{}, {...body,sort:chosen}).sort,chosen);
  for(const field of ['CHANGE_IN_OPEN_INTEREST','changeInOpenInterest','change in open interest','createdTime','CURRENT_OPEN_INTEREST','ticker'])validateGexDataRequest('open-interest-change',{sort:{field,direction:'DESCENDING'}});
  for(const sort of [null,{},[],{field:'PREMIUM',direction:'DESCENDING'},{field:'changeInOpenInterest',direction:'DOWN'},{field:'changeInOpenInterest',direction:1},{field:'changeInOpenInterest',direction:'DESCENDING',extra:true}])assert.throws(()=>validateGexDataRequest('open-interest-change',{sort}),/sort/);
});

test('OI change saved sort controls apply to the complete licensed query and never override an explicit sort',()=>{
  const controls={oiSortField:'PREVIOUS_OPEN_INTEREST',oiSortDirection:'ASCENDING'},base={sessionDate:'2026-11-02',filter:{tickers:['SPY','QQQ'],contractTypes:['CALL']},searchAfter:['2500','contract-id'],size:50};
  const saved=structuredClone({controls,base}),request=additionalToolRequest('open-interest-change',controls,base);
  assert.deepEqual(request.sort,{field:'PREVIOUS_OPEN_INTEREST',direction:'ASCENDING'});assert.deepEqual(request.filter,base.filter);assert.equal(request.sessionDate,base.sessionDate);assert.deepEqual(request.searchAfter,base.searchAfter);assert.equal(request.size,50);
  assert.deepEqual(validateGexDataRequest('open-interest-change',request),request);assert.deepEqual({controls,base},saved);
  const override={field:'percentChangeInOpenInterest',direction:'DESCENDING'};
  assert.deepEqual(additionalToolRequest('open-interest-change',controls,{...base,sort:override}).sort,override);
  assert.deepEqual(additionalToolRequest('open-interest-change',{oiSortDirection:'ASCENDING'},{}).sort,{field:'changeInOpenInterest',direction:'ASCENDING'});
  for(const controls of [{oiSortField:'PREMIUM'},{oiSortDirection:'ASC'},{oiSortDirection:'DOWN'},{oiSortField:42}])assert.throws(()=>additionalToolRequest('open-interest-change',controls,base),/sort/);
});

test('restricted endpoints reject unsupported filters and groups rather than silently broadening an active selection',()=>{
  const group={conjunction:'AND',filters:[{field:'ticker',operation:'=',values:['SPY']}]};
  for(const id of ids.filter(id=>!['net-flow','open-interest-change'].includes(id))){
    const base=additionalToolRequest(id,{},session);
    assert.throws(()=>validateGexDataRequest(id,{...base,filterExpression:group}),/filterExpression/);
    assert.throws(()=>additionalToolRequest(id,{}, {...session,filterExpression:group}),/filter groups/);
    assert.throws(()=>validateGexDataRequest(id,{...base,filter:{...base.filter,unknownField:true}}),/unknownField/);
  }
});

test('dates, scalar tickers, contract types and selector combinations validate before any provider request',()=>{
  for(const date of ['2026-02-30','not-a-date','2026-13-01'])assert.throws(()=>additionalToolRequest('volatility-drift',{expiry:date},session));
  for(const ticker of ['',[],['SPY','QQQ'],'https://evil.invalid'])assert.throws(()=>validateGexDataRequest('volatility-skew',{filter:{ticker}}));
  assert.throws(()=>additionalToolRequest('volatility-skew',{contractTypeOptional:'FUTURE'},session),/contract type/);
  assert.throws(()=>additionalToolRequest('term-structure',{expiryStart:'2026-12-31',expiryEnd:'2026-10-16'},session),/range end/);
  assert.throws(()=>validateGexDataRequest('net-flow',{...session,dataMode:'NET_PREMIUM',timeRange:{startTime:'2026-10-16T16:00:00Z',endTime:'2026-10-16T17:00:00Z'}}),/one session/);
  assert.throws(()=>validateGexDataRequest('volatility-skew',{...session,snapshotTime:'2026-10-16T18:00:00Z'}),/one session/);
  assert.throws(()=>validateAdditionalToolRequest('term-structure',{filter:{ticker:'SPY',deltaRange:{min:.6,max:.4}}}),/delta range/);
  assert.throws(()=>validateAdditionalToolRequest('term-structure',{filter:{ticker:'SPY',moneyTypes:['toString']}}),/moneyness/);
});

test('unrelated existing tools remain unchanged and the request builder never mutates their identity',()=>{
  assert.equal(additionalToolRequest('net-drift',{},session),session);
  assert.equal(additionalToolRequest('iv-rank',{},session),session);
  assert.deepEqual(validateGexDataRequest('net-drift',session),session);
  assert.deepEqual(validateGexDataRequest('order-flow-unconsolidated',{size:100,filter:{tickers:['SPY','QQQ']}}),{size:100,filter:{tickers:['SPY','QQQ']}});
});

test('public IV Rank rejects unsupported maturity zero locally and preserves valid integer windows',()=>{
  for(const maturity of [1,30,365])for(const lookBackPeriod of [1,365]){
    const body={filter:{ticker:'SPY'},maturity,lookBackPeriod},saved=structuredClone(body);
    assert.equal(additionalToolRequest('iv-rank',{},body),body);
    assert.deepEqual(validateGexDataRequest('iv-rank',body),body);
    assert.deepEqual(body,saved);
  }
  for(const value of [0,-1,366,1.5,null,'1',NaN,Infinity]){
    const maturityBody={filter:{ticker:'SPY'},maturity:value,lookBackPeriod:365};
    assert.throws(()=>additionalToolRequest('iv-rank',{},maturityBody),/maturity.*1 and 365/);
    assert.throws(()=>validateGexDataRequest('iv-rank',maturityBody),/maturity.*1 and 365/);
    assert.throws(()=>validateGexDataRequest('iv-rank',{filter:{ticker:'SPY'},maturity:1,lookBackPeriod:value}),/lookback.*1 and 365/);
  }
});
