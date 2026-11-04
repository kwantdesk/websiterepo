import test from 'node:test';
import assert from 'node:assert/strict';
import {optionTapeField,optionTapeColumnFields,optionTapeSort,optionTapeFilterExpression,optionTapeSessionRange,optionTapeCursor,mergeOptionTapeRows,optionTapeRequest,validateOptionTapeRequest} from '../public/gex-data-app/option-tape-interaction-model.js';
import {additionalToolRequest} from '../public/gex-data-app/additional-tool-requests.js';
import {validateGexDataRequest} from '../src/lib/gexDataPolicy.ts';
const raw='order-flow-unconsolidated',consolidated='order-flow-consolidated';

test('atomic column metadata maps only licensed fields, with explicit server sorting',()=>{
  assert.deepEqual(optionTapeColumnFields('contract').map(value=>value.field),['TICKER','EXPIRATION_DATE','STRIKE_PRICE','CONTRACT_TYPE']);
  assert.deepEqual(optionTapeColumnFields('bidAskSpread').map(value=>value.field),['BID_PRICE','ASK_PRICE','BID_ASK_SPREAD']);
  assert.equal(optionTapeField('greeks.delta').field,'DELTA');assert.equal(optionTapeField('sentimentType').field,'SENTIMENT');
  assert.deepEqual(optionTapeSort(null),{field:'tradeTime',direction:'DESCENDING'});
  assert.deepEqual(optionTapeSort({key:'premium',direction:1}),{field:'PREMIUM',direction:'ASCENDING'});
  assert.deepEqual(optionTapeSort({field:'greeks.delta',direction:-1}),{field:'DELTA',direction:'DESCENDING'});
  for(const field of ['contract','id','greeks','invented'])assert.throws(()=>optionTapeSort({field,direction:1}));
  assert.throws(()=>optionTapeSort({field:'tradeConsolidationType',direction:1},raw));
});

test('server header filters preserve dollar/IV units and OR values; never use Contains',()=>{
  const expression=optionTapeFilterExpression([{key:'premium',operator:'>=',value:'100000'},{field:'TRADE_SIDE',operator:'EQUALS',value:['AA','A']},{key:'greeks.delta',operator:'<',value:'.5'},{key:'impliedVolatility',operator:'>=',value:4.76837158203125},{key:'isETF',operator:'=',value:false}]);
  assert.deepEqual(expression,{conjunction:'AND',filters:[{field:'PREMIUM',operation:'GREATER_THAN_OR_EQUAL_TO',values:[100000]},{field:'TRADE_SIDE',operation:'EQUALS',values:['ABOVE_ASK','ASK']},{field:'DELTA',operation:'LESS_THAN',values:[.5]},{field:'IMPLIED_VOLATILITY',operation:'GREATER_THAN_OR_EQUAL_TO',values:[4.76837158203125]},{field:'IS_ETF',operation:'EQUALS',values:[false]}]});
  assert.equal(optionTapeFilterExpression([{key:'premium',value:''}]),null);
  assert.deepEqual(optionTapeFilterExpression([{key:'size',value:0}]).filters[0].values,[0]);
  for(const item of [{key:'ticker',operator:'CONTAINS',value:'SP'},{key:'premium',value:'$100K'},{key:'size',value:1.5},{key:'expirationDate',value:'2026-02-30'},{key:'tradeTime',value:'2026-10-16'}])assert.throws(()=>optionTapeFilterExpression([item]));
});

test('IV percent literals retain percentage points while Sigma remains an independent raw number',()=>{
  const filters=optionTapeFilterExpression([{field:'IMPLIED_VOLATILITY',operator:'>=',value:'20%'},{field:'SIGMA',operator:'<',value:'.2'}]).filters;
  assert.deepEqual(filters,[{field:'IMPLIED_VOLATILITY',operation:'GREATER_THAN_OR_EQUAL_TO',values:[20]},{field:'SIGMA',operation:'LESS_THAN',values:[.2]}]);
  assert.deepEqual(optionTapeFilterExpression([{key:'impliedVolatility',value:' 20.5 % '}]).filters[0].values,[20.5]);
  assert.deepEqual(optionTapeFilterExpression([{key:'impliedVolatility',value:'0%'}]).filters[0].values,[0]);
  for(const item of [{field:'SIGMA',value:'20%'},{field:'IMPLIED_VOLATILITY',value:'20%%'},{field:'IMPLIED_VOLATILITY',value:'NaN%'}])assert.throws(()=>optionTapeFilterExpression([item]));
});

test('private date selections use same-day sessionDate or DST-correct whole NY calendar ranges, never guessed RTH',()=>{
  assert.deepEqual(optionTapeSessionRange({}),{});
  assert.deepEqual(optionTapeSessionRange({startDate:'2026-10-16'}),{sessionDate:'2026-10-16'});
  assert.deepEqual(optionTapeSessionRange({endDate:'2026-10-16'}),{sessionDate:'2026-10-16'});
  assert.deepEqual(optionTapeSessionRange({startDate:'2026-03-07',endDate:'2026-03-08'}),{timeRange:{startTime:'2026-03-07T05:00:00.000Z',endTime:'2026-03-09T04:00:00.000Z'}});
  assert.deepEqual(optionTapeSessionRange({startDate:'2026-10-31',endDate:'2026-11-01'}),{timeRange:{startTime:'2026-10-31T04:00:00.000Z',endTime:'2026-11-02T05:00:00.000Z'}});
  assert.throws(()=>optionTapeSessionRange({startDate:'2026-10-17',endDate:'2026-10-16'}));
  assert.throws(()=>optionTapeSessionRange({startDate:'2026-02-30'}));
});

test('both real tape policies accept first-page statistics and stable global queries without double composition',()=>{
  const original={sessionDate:'2026-10-16',filter:{tickers:['SPY','QQQ']},filterExpression:{field:'PREMIUM',operation:'>=',value:1000},size:100},saved=structuredClone(original);
  for(const tool of [raw,consolidated]){
    const body=optionTapeRequest(tool,{sort:{field:'size',direction:-1},filters:[{field:'DELTA',operator:'>=',value:.4}]},original);
    assert.equal(body.includeStatistics,true);assert.equal(body.sort.field,'SIZE');
    assert.deepEqual(body.filterExpression.filters[0],original.filterExpression);
    assert.deepEqual(validateGexDataRequest(tool,body),body);
    assert.equal(additionalToolRequest(tool,{},body),body);
    assert.equal(body.filterExpression.filters.length,2);
    const next=optionTapeRequest(tool,{}, {...body,searchAfter:['opaque','cursor','remains-intact']});
    assert.equal(next.includeStatistics,false);assert.deepEqual(next.filterExpression,body.filterExpression);
  }
  assert.deepEqual(original,saved);
  assert.throws(()=>validateGexDataRequest(raw,{...original,includeComprisingTrades:true}));
  assert.throws(()=>validateGexDataRequest(raw,{...original,filter:{tradeConsolidationTypes:['SWEEP']}}));
  assert.throws(()=>validateGexDataRequest(raw,{...original,filterExpression:{field:'IS_GOLDEN_SWEEP',operation:'=',value:true}}));
  assert.throws(()=>validateGexDataRequest(raw,{...original,sessionDateRange:{startDate:'2026-10-16'}}));
});

test('opaque cursors are returned verbatim, rows dedupe only real IDs and preserve server order',()=>{
  const cursor=['1747137612000','id with punctuation / + =','unknown future component'];
  const parsed=optionTapeCursor({nextSearchAfter:cursor});assert.deepEqual(parsed,cursor);assert.notEqual(parsed,cursor);
  assert.equal(optionTapeCursor({}),null);assert.equal(optionTapeCursor({nextSearchAfter:null}),null);
  assert.throws(()=>optionTapeCursor({nextSearchAfter:[123,'id']}));
  const first={id:'same',premium:1},next={id:'same',premium:2},unknown={premium:5};
  assert.deepEqual(mergeOptionTapeRows([first,unknown],[next,{id:'older'},unknown]),[next,unknown,{id:'older'},unknown]);
});

test('public raw page maximum is1000 while existing website budget remains100',()=>{
  assert.doesNotThrow(()=>validateOptionTapeRequest(raw,{size:1000}));
  assert.throws(()=>validateOptionTapeRequest(consolidated,{size:101}));
  assert.throws(()=>validateGexDataRequest(raw,{size:1000}),/between 1 and 100/);
  for(const body of [{includeStatistics:'true'},{sort:{field:'contract',direction:'DESCENDING'}},{filterExpression:{field:'TICKER',operation:'CONTAINS',value:'SP'}},{sessionDate:'2026-10-16',timeRange:{startTime:'2026-10-16T00:00:00Z',endTime:'2026-10-17T00:00:00Z'}}])assert.throws(()=>validateOptionTapeRequest(raw,body));
});
