import test from 'node:test';
import assert from 'node:assert/strict';
import {GAINERS_COLUMNS,gainersModel} from '../../public/gex-data-app/options-models.js';
import {formatTableValue} from '../../public/gex-data-app/table-view.js';

test('actual Gainers ratio column renders native literal zero and two-digit abbreviation without changing sorting',()=>{
  const column=GAINERS_COLUMNS.find(column=>column.key==='premiumRatio');
  const input={ZERO:{bullishPremium:0,bearishPremium:100},ONE:{bullishPremium:100,bearishPremium:100},FRACTION:{bullishPremium:100,bearishPremium:123.4},LARGE:{bullishPremium:1,bearishPremium:1234567}};
  const before=structuredClone(input),rows=gainersModel(input).rows;
  assert.deepEqual(Object.fromEntries(rows.map(row=>[row.ticker,formatTableValue(row.premiumRatio,column,row,{timeZone:'UTC'})])),{ZERO:'0',ONE:'1',FRACTION:'1.23',LARGE:'1.23 M'});
  assert.equal(rows.find(row=>row.ticker==='LARGE').premiumRatio,1234567);
  assert.equal(typeof column.compareRows,'function');assert.deepEqual(input,before);
});
