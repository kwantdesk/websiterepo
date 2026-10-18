import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFieldsForTool, findFilterField, expressionToDraft, draftToExpression } from '../../public/gex-data-app/filter-editor-model.js';

test('field maps follow source tool capabilities and consolidation distinctions',()=>{
  assert.equal(filterFieldsForTool('interval-map').length,0);
  assert.equal(filterFieldsForTool('max-pain').length,0);
  assert.equal(filterFieldsForTool('exchange-notifications').length,2);
  assert.equal(filterFieldsForTool('equity-prints').length,11);
  assert.ok(filterFieldsForTool('order-flow-consolidated').some(value=>value.api==='IS_GOLDEN_SWEEP'));
  assert.ok(!filterFieldsForTool('net-drift').some(value=>value.api==='IS_GOLDEN_SWEEP'));
  assert.ok(!filterFieldsForTool('heat-map').some(value=>value.api==='TRADE_CONSOLIDATION_TYPE'));
  assert.ok(filterFieldsForTool('heat-map').some(value=>value.api==='ZOMMA'));
});

test('supported aliases and raw dollar amounts round-trip without cents conversion',()=>{
  const fields=filterFieldsForTool('net-drift');
  const draft=expressionToDraft({conjunction:'AND',filters:[{field:'premium',operation:'>=',value:100000},{field:'symbol',operation:'eq',values:['SPY','QQQ']}]},fields);
  assert.equal(draft.filters[0].operation,'GREATER_THAN_OR_EQUAL_TO');
  assert.deepEqual(draftToExpression(draft,fields),{conjunction:'AND',filters:[{field:'PREMIUM',operation:'GREATER_THAN_OR_EQUAL_TO',values:[100000]},{field:'TICKER',operation:'EQUALS',values:['SPY','QQQ']}]});
  assert.equal(findFilterField(fields,'moneyType').api,'MONEY_TYPE');
});

test('incomplete draft text is retained but validation is explicit',()=>{
  const fields=filterFieldsForTool('contract-statistics');
  const draft={field:'PREMIUM',operation:'GREATER_THAN',text:'-'};
  assert.throws(()=>draftToExpression(draft,fields),/number/);
  assert.equal(draft.text,'-');
  draft.text='0';assert.deepEqual(draftToExpression(draft,fields).values,[0]);
  draft.text='1,000';assert.deepEqual(draftToExpression(draft,fields).values,[1,0]);
});

test('booleans/dates/integers and per-field operators are validated',()=>{
  const fields=filterFieldsForTool('contract-statistics');
  assert.deepEqual(draftToExpression({field:'IS_UNUSUAL',operation:'EQUALS',text:'false'},fields).values,[false]);
  assert.throws(()=>draftToExpression({field:'IS_UNUSUAL',operation:'GREATER_THAN',text:'true'},fields),/operator/);
  assert.throws(()=>draftToExpression({field:'SIZE',operation:'EQUALS',text:'1.2'},fields),/integer/);
  assert.throws(()=>draftToExpression({field:'DTE',operation:'EQUALS',text:'1'},fields),/operator/);
  assert.throws(()=>draftToExpression({field:'EXPIRATION_DATE',operation:'EQUALS',text:'2026-02-30'},fields),/date/);
});

test('unknown and source-only unverified fields/operations never silently apply',()=>{
  const fields=filterFieldsForTool('net-drift');
  for(const name of ['EXCHANGE_GROUP','PENNY_PROGRAM'])assert.throws(()=>draftToExpression({field:name,operation:'EQUALS',text:'true'},fields),/not verified/);
  assert.throws(()=>draftToExpression({field:'TICKER',operation:'CONTAINS',text:'SP'},fields),/unsupported comparison/);
  assert.throws(()=>draftToExpression({field:'MISSING',operation:'EQUALS',text:'x'},fields),/Unsupported source field/);
});

test('nested sets retain AND/OR and enforce API recursion limits',()=>{
  const fields=filterFieldsForTool('net-drift');
  const leaf={field:'TICKER',operation:'EQUALS',text:'SPY'};
  const draft={conjunction:'OR',filters:[{conjunction:'AND',filters:[leaf,{field:'PREMIUM',operation:'GREATER_THAN',text:'100000'}]},{field:'CONTRACT_TYPE',operation:'EQUALS',text:'PUT'}]};
  assert.equal(draftToExpression(draft,fields).filters[0].conjunction,'AND');
  let deep=leaf;for(let index=0;index<6;index++)deep={conjunction:'AND',filters:[deep]};
  assert.throws(()=>draftToExpression(deep,fields),/depth/);
});
