import test from 'node:test';
import assert from 'node:assert/strict';
import {equityPrintSort,equityPrintColumnFields,equityPrintFilterExpression,equityPrintRequest,equityPrintCursor} from '../../public/gex-data-app/equity-print-interaction-model.js';
test('public equity header sorts use canonical fields and never source-private cents names',()=>{
  assert.deepEqual(equityPrintSort(),{field:'TRADE_TIME',direction:'DESCENDING'});
  assert.deepEqual(equityPrintSort({field:'printType',direction:1}),{field:'PRINT_TYPE',direction:'ASCENDING'});
  assert.deepEqual(equityPrintColumnFields('ticker').map(field=>field.field),['TICKER','PRINT_TYPE']);
  assert.deepEqual(equityPrintColumnFields('bidAsk').map(field=>field.field),['BID_PRICE','ASK_PRICE']);
  assert.throws(()=>equityPrintSort({field:'priceInCents',direction:1}),/supported/);
});
test('equity header expressions preserve dollar/zero/boolean/OR values and AND with existing groups',()=>{
  const filters=[{field:'PRICE',operator:'GREATER_THAN_OR_EQUAL_TO',value:0},{field:'TRADE_SIDE',operator:'EQUALS',value:'A, AA'},{field:'IS_DELAYED_PRINT',operator:'EQUALS',value:false}];
  assert.deepEqual(equityPrintFilterExpression(filters).filters.map(item=>item.values),[[0],['ASK','ABOVE_ASK'],[false]]);
  const base={sessionDate:'2026-10-16',filter:{tickers:['SPY'],priceRange:{min:1.25}},filterExpression:{field:'TICKER',operation:'EQUALS',values:['SPY']}},before=structuredClone(base);
  const request=equityPrintRequest(base,{filters,sort:{field:'NOTIONAL_VALUE',direction:-1}});
  assert.equal(request.filter.priceRange.min,1.25);assert.equal(request.filterExpression.filters[1].filters[0].values[0],0);assert.equal(request.sort.field,'NOTIONAL_VALUE');assert.equal(request.size,100);assert.equal(request.includeStatistics,undefined);assert.deepEqual(base,before);
});
test('opaque equity cursor handles omitted/null and preserves values and ordering without coercion',()=>{
  assert.equal(equityPrintCursor({}),null);assert.equal(equityPrintCursor({nextSearchAfter:null}),null);
  const value=['1792187990000','id',0],cursor=equityPrintCursor({nextSearchAfter:value});assert.deepEqual(cursor,value);assert.notEqual(cursor,value);
});
