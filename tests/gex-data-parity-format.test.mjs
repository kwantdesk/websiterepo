import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {currencyAuto,currencyAbbreviated,abbreviatedTick} from '../public/gex-data-app/number-format.js';
import {niceValueDomain} from '../public/gex-data-app/exposure-models.js';
const app=readFileSync(new URL('../public/gex-data-app/app.js',import.meta.url),'utf8');
test('observed reference strike/price ticks retain cents for fractional values',()=>{
 const context={currencyAuto};vm.runInNewContext(app.slice(app.indexOf('function chartStrikeLabel('),app.indexOf('function drawIntervalProfile('))+'\nthis.label=chartStrikeLabel;',context);
 assert.equal(context.label(775),'$775');assert.equal(context.label(772.5),'$772.50');assert.equal(context.label(757.5),'$757.50');assert.equal(context.label(NaN),'—');
});
test('Dark Flow reference axis uses zero-decimal abbreviation without changing header precision',()=>{
 assert.equal(currencyAbbreviated(3_500_000_000),'$4 B');assert.equal(currencyAbbreviated(500_000_000),'$500 M');
 assert.equal(currencyAbbreviated(23_440_000_000,2),'$23.44 B');
 assert.match(app,/money:true,formatter:value=>currencyAbbreviated\(value\),label:"Notional Value"/);
});

test('contract overlay plots and labels the same nice underlying domain',()=>{
 const domain=niceValueDomain(760.63,773.18);assert.equal(domain.min,760);assert.equal(domain.max,775);
 const render=app.slice(app.indexOf('  function renderOhlcQuant('),app.indexOf('  function renderContractStatsQuant('));
 assert.match(render,/niceValueDomain\(Math.min\(\.\.\.spotValues\),Math.max\(\.\.\.spotValues\)\)/);
 assert.match(render,/min:smin,max:smax,formatter:chartStrikeLabel,rightSide:true/);
 assert.match(render,/label:"Option Volume",steps:4,formatter:value=>abbreviate\(value,1\)/);
 assert.match(render,/drawHorizontalTicks\(ctx,left,right,volumeTop,bottom,0,vmax\)/);
});

test('net exposure overview keeps signed net values and expiration labels keep calendar year',()=>{
 const render=app.slice(app.indexOf('  function renderExposureProfileQuant('),app.indexOf('  function renderNetDriftQuant('));
 assert.match(render,/byExpiration&&display==='NET'\?point.call\+point.put:Math.abs\(point.call\)\+Math.abs\(point.put\)/);
 assert.match(render,/if\(!byExpiration\)legend.push/);
 assert.match(render,/timeZone:'UTC',year:'numeric',month:'short',day:'numeric'/);
});

test('exposure-axis labels drop insignificant zeroes, not meaningful precision',()=>{
 assert.equal(abbreviatedTick(7_500_000_000),'7.5 B');assert.equal(abbreviatedTick(-250_000_000),'-250 M');assert.equal(abbreviatedTick(.25),'0.25');assert.equal(abbreviatedTick(null),'—');
});

test('Net Drift nice axes cover observed SPY stock and signed volume without clipping',()=>{
 assert.deepEqual([niceValueDomain(760.63,773.18).min,niceValueDomain(760.63,773.18).max],[760,775]);
 assert.deepEqual([niceValueDomain(-356000,7000).min,niceValueDomain(-356000,7000).max],[-400000,100000]);
 const render=app.slice(app.indexOf('  function renderNetDriftQuant('),app.indexOf('  function renderDarkFlowQuant('));
 assert.match(render,/niceValueDomain\(spotMin,spotMax\)/);assert.match(render,/niceValueDomain\(volumeMin,volumeMax\)/);
 assert.match(render,/label:"Volume",steps:5/);assert.match(render,/individual:true,title:'Net Drift · Individual Prints'/);
});
