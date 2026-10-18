import test from 'node:test';
import assert from 'node:assert/strict';
import {abbreviate,currencyAbbreviated,currencyAuto} from '../../public/gex-data-app/number-format.js';
test('source abbreviations retain fractional trailing zeros but omit integer decimals',()=>{
  assert.equal(abbreviate(31900000000),'31.90 B');assert.equal(abbreviate(7000000),'7 M');assert.equal(abbreviate(210140),'210.14 K');assert.equal(currencyAbbreviated(-880190000,2),'-$880.19 M');assert.equal(currencyAbbreviated(880190000),'$880 M');assert.equal(currencyAuto(700),'$700');assert.equal(currencyAuto(700.1),'$700.10');assert.equal(abbreviate(null),'—');
});
