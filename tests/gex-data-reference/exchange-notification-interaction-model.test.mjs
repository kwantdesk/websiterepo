import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationColumnFields,notificationSort,notificationFilterExpression,notificationRequest,notificationCursor,validateNotificationRequest} from '../../public/gex-data-app/exchange-notification-interaction-model.js';
import {EXCHANGE_NOTIFICATION_COLUMNS} from '../../public/gex-data-app/equity-renderers.js';
import {validateGexDataRequest} from '../../src/lib/gexDataPolicy.ts';

test('notification headers use documented public singular sorts and the source shared Date/Time field',()=>{
  assert.deepEqual(notificationSort(),{field:'CREATED_TIME',direction:'DESCENDING'});
  for(const name of ['date','time','createdTime'])assert.equal(notificationColumnFields(name)[0].field,'CREATED_TIME');
  for(const field of ['CREATED_TIME','TICKER','TYPE'])for(const direction of ['ASCENDING','DESCENDING'])assert.deepEqual(notificationSort({field,direction}),{field,direction});
  const schema=EXCHANGE_NOTIFICATION_COLUMNS;assert.equal(schema.length,4);for(const column of schema){assert.equal(column.directSort,true);assert.equal(column.lockWhenSorted,true);}
  assert.equal(schema[0].sharedSortIndicator,true);assert.equal(schema[1].sharedSortIndicator,true);
  for(const sort of [[{field:'TYPE',direction:'DESCENDING'}],{field:'PRICE',direction:'ASCENDING'},{field:'TYPE',direction:'DESCENDING',extra:1}])assert.throws(()=>validateGexDataRequest('exchange-notifications',{sort}),/supported/);
});

test('real exchange notification plus-suffix tickers survive both picker request and header validation',()=>{
  const body={sessionDate:'2026-11-09',filter:{tickers:['DSX+']}};
  assert.doesNotThrow(()=>validateGexDataRequest('exchange-notifications',body));
  assert.deepEqual(notificationFilterExpression([{field:'TICKER',operator:'EQUALS',value:'DSX+'}]).filters[0].values,['DSX+']);
  assert.throws(()=>validateGexDataRequest('net-drift',body),/ticker/);
  assert.throws(()=>notificationFilterExpression([{field:'TICKER',operator:'EQUALS',value:'DSX+<script>'}]),/valid/);
});

test('positive notification values are OR alternatives; multiple exclusions are scalar inequalities joined by AND',()=>{
  const type=notificationColumnFields('type')[0];assert.equal(type.type,'enum');assert.equal(type.rawChoiceLabels,true);assert.ok(type.choices.includes('REG_SHO'));assert.deepEqual(type.operatorLabels,{EQUALS:'is',DOES_NOT_EQUAL:'is not'});
  const positive=notificationFilterExpression([{field:'TYPE',operator:'EQUALS',value:['LUDP','REG_SHO']}]);
  assert.deepEqual(positive.filters[0].values,['LUDP','REG_SHO']);
  const negative=notificationFilterExpression([{field:'TYPE',operator:'DOES_NOT_EQUAL',value:['LUDP','REG_SHO']}]);
  assert.equal(negative.conjunction,'AND');assert.deepEqual(negative.filters.map(item=>item.values),[['LUDP'],['REG_SHO']]);
  const matches=(expression,value)=>expression.filters.every(item=>item.operation==='DOES_NOT_EQUAL'?!item.values.includes(value):item.values.includes(value));
  assert.equal(matches(negative,'LUDP'),false);assert.equal(matches(negative,'REG_SHO'),false);assert.equal(matches(negative,'T1'),true);
  assert.throws(()=>notificationFilterExpression([{field:'TYPE',operator:'GREATER_THAN',value:'LUDP'}]),/Unsupported/);
});

test('notification request keeps authoritative range/filter groups and never combines a negative header with a contradictory positive toolbar filter',()=>{
  const base={timeRange:{startTime:'2026-10-16T04:00:00.000Z',endTime:'2026-10-20T04:00:00.000Z'},filter:{types:['LUDP','REG_SHO'],tickers:['SPY','QQQ']},filterExpression:{field:'TICKER',operation:'EQUALS',values:['SPY']}},copy=structuredClone(base);
  const request=notificationRequest(base,{filters:[{field:'TYPE',operator:'DOES_NOT_EQUAL',value:['LUDP','REG_SHO']}]});
  assert.equal(request.size,100);assert.equal(request.filter.types,undefined);assert.deepEqual(request.filter.tickers,['SPY','QQQ']);assert.equal(request.filterExpression.conjunction,'AND');assert.deepEqual(base,copy);
  const preserved=notificationRequest(base,{preserveTickerFilter:true,filters:[{field:'TICKER',operator:'DOES_NOT_EQUAL',value:['SPY']}]});assert.deepEqual(preserved.filter.tickers,['SPY','QQQ']);
  assert.deepEqual(notificationCursor({nextSearchAfter:['clock',0,'id']}),['clock',0,'id']);assert.equal(notificationCursor({}),null);assert.throws(()=>notificationCursor({nextSearchAfter:'bad'}),/cursor/);
  assert.throws(()=>validateNotificationRequest({sessionDate:'2026-10-16',timeRange:base.timeRange}),/one notification/);
});
