import test from 'node:test';
import assert from 'node:assert/strict';
import {abbreviate,currencyAbbreviated,currencyAuto} from '../../public/gex-data-app/number-format.js';
test('source abbreviations retain fractional trailing zeros but omit integer decimals',()=>{
  assert.equal(abbreviate(31900000000),'31.90 B');assert.equal(abbreviate(7000000),'7 M');assert.equal(abbreviate(210140),'210.14 K');assert.equal(currencyAbbreviated(-880190000,2),'-$880.19 M');assert.equal(currencyAbbreviated(880190000),'$880 M');assert.equal(currencyAuto(700),'$700');assert.equal(currencyAuto(700.1),'$700.10');assert.equal(abbreviate(null),'—');
});

test('negative abbreviation rounds the positive magnitude before adding its sign at half boundaries',()=>{
  assert.equal(abbreviate(1_235_000,2),'1.24 M');
  assert.equal(abbreviate(-1_235_000,2),'-1.24 M');
  assert.equal(abbreviate(-300_000_000,2),'-300 M');
  assert.equal(currencyAbbreviated(-1_235_000,2),'-$1.24 M');
  for(const digits of [0,1,2])for(const value of [0.5,1.235,1_235,12_350,1_235_000,999_995,1_235_000_000,1_235_000_000_000]){
    assert.equal(abbreviate(-value,digits),'-'+abbreviate(value,digits),`${value} with ${digits} digits`);
  }
});

test('negative zero remains unsigned and invalid inputs remain unavailable',()=>{
  assert.equal(abbreviate(-0),'0');assert.equal(abbreviate('-0'),'0');
  assert.equal(currencyAbbreviated(-0,2),'$0');
  for(const value of [null,undefined,'',NaN,Infinity,-Infinity,'not-a-number'])assert.equal(abbreviate(value),'—');
});
