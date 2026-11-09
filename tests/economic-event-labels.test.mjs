import test from 'node:test';
import assert from 'node:assert/strict';
import {economicEventLabel} from '../src/lib/economicEventLabels.ts';

test('recognisable trader names preserve release frequency and revision qualifiers',()=>{
 for(const [input,expected] of [
  ['Core Inflation Rate YoY','Core CPI y/y'],['Inflation Rate MoM','CPI m/m'],
  ['Core Consumer Price Index (YoY)','Core CPI (y/y)'],
  ['Core Producer Price Index (MoM)','Core PPI (m/m)'],
  ['Producer Prices Change YoY','PPI y/y'],
  ['Gross Domestic Product Growth Rate QoQ 2nd Est','GDP Growth Rate q/q 2nd Est'],
  ['Final CPI m/m','Final CPI m/m'],['Federal Open Market Committee Statement','FOMC Statement'],
 ])assert.equal(economicEventLabel(input,'USD'),expected);
});

test('US monetary policy names are specific and do not relabel other central banks',()=>{
 assert.equal(economicEventLabel('Fed Interest Rate Decision','USD'),'FOMC Rate Decision');
 assert.equal(economicEventLabel('Fed Press Conference','USD'),'FOMC Press Conference');
 assert.equal(economicEventLabel('Fed Minutes','USD'),'FOMC Meeting Minutes');
 assert.equal(economicEventLabel('ECB Interest Rate Decision','EUR'),'ECB Interest Rate Decision');
 assert.equal(economicEventLabel('Interest Rate Decision','GBP'),'Interest Rate Decision');
});

test('different inflation measures and unrelated releases are preserved',()=>{
 for(const name of ['Core PCE Price Index','Inflation Expectations','Harmonised Inflation Rate YoY','Core Inflation Expectations','GDP Price Index','Retail Sales','CPI Trimmed Mean'])
  assert.equal(economicEventLabel(name,'USD'),name.replace('YoY','y/y'));
});

test('label normalization is idempotent for the saved calendar cache',()=>{
 for(const name of ['Core Inflation Rate YoY','Fed Interest Rate Decision','Producer Prices Change MoM']){
  const once=economicEventLabel(name,'USD');assert.equal(economicEventLabel(once,'USD'),once);
 }
});
