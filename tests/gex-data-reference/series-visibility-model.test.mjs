import test from 'node:test';
import assert from 'node:assert/strict';
import {toolSeriesOptions,toolSeriesVisibility,setToolSeriesVisibility} from '../../public/gex-data-app/series-visibility-model.js';

test('source defaults preserve current charts and existing Net Drift presentation controls',()=>{
  assert.deepEqual(toolSeriesVisibility('dark-flow'),{notional:true,underlying:true});
  assert.deepEqual(toolSeriesVisibility('net-drift'),{call:true,put:true,net:false,underlying:true});
  assert.deepEqual(toolSeriesVisibility('max-pain'),{call:true,put:true});
  assert.deepEqual(toolSeriesVisibility('net-drift',{driftNet:'SHOW',driftUnderlying:'HIDE'}),{call:true,put:true,net:true,underlying:false});
});

test('toggling one series preserves other controls and survives persisted JSON',()=>{
  const original={ticker:'SPY',date:'2026-10-16',driftNet:'SHOW',driftBands:'SHOW'},first=setToolSeriesVisibility('net-drift',original,'call',false),saved=JSON.parse(JSON.stringify(setToolSeriesVisibility('net-drift',first,'put',false)));
  assert.deepEqual(original,{ticker:'SPY',date:'2026-10-16',driftNet:'SHOW',driftBands:'SHOW'});
  assert.deepEqual(toolSeriesVisibility('net-drift',saved),{call:false,put:false,net:true,underlying:true});assert.equal(saved.ticker,'SPY');assert.equal(saved.driftBands,'SHOW');
  const restored=setToolSeriesVisibility('net-drift',saved,'call',true);assert.equal(toolSeriesVisibility('net-drift',restored).call,true);assert.equal(toolSeriesVisibility('net-drift',restored).put,false);
});

test('last-series protection distinguishes a required area, price line and Max Pain marker',()=>{
  const dark=setToolSeriesVisibility('dark-flow',{},'underlying',false);assert.deepEqual(toolSeriesVisibility('dark-flow',dark),{notional:true,underlying:false});assert.deepEqual(setToolSeriesVisibility('dark-flow',dark,'notional',false),dark);
  const pain=setToolSeriesVisibility('max-pain',{},'call',false);assert.deepEqual(setToolSeriesVisibility('max-pain',pain,'put',false),pain);
  const drift={driftCalls:'HIDE',driftPuts:'HIDE',driftNet:'HIDE',driftUnderlying:'SHOW'};assert.deepEqual(setToolSeriesVisibility('net-drift',drift,'underlying',false),drift);
  assert.equal(toolSeriesVisibility('net-drift',setToolSeriesVisibility('net-drift',drift,'call',true)).call,true);
});

test('unknown options do not alter controls or leak mutation into shared definitions',()=>{
  const options=toolSeriesOptions('max-pain');options[0].label='changed';assert.equal(toolSeriesOptions('max-pain')[0].label,'Calls');
  assert.deepEqual(toolSeriesOptions('unknown'),[]);assert.deepEqual(toolSeriesVisibility('unknown'),{});assert.deepEqual(setToolSeriesVisibility('max-pain',{saved:7},'unknown',false),{saved:7});
});
