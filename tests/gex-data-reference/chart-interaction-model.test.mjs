import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWheelDelta,wheelDeltaToScale,scaleAroundPivot,lerpZoomStep,panZoomWindow,wheelZoomWindow,sliderMinimumSpan,sliderBarWindow,sliderHandleWindow,sliderTrackClick,heatMapPlainWheel,cursorTooltipPlacement,chartGestureDistance} from '../../public/gex-data-app/chart-interaction-model.js';

test('source wheel normalization and exact tier boundaries',()=>{
  assert.equal(normalizeWheelDelta({deltaY:40}),-120);
  assert.equal(normalizeWheelDelta({deltaY:40,wheelDelta:120}),120);
  assert.equal(wheelDeltaToScale(120).scale,1/1.1);
  assert.equal(wheelDeltaToScale(121).scale,1/1.2);
  assert.equal(wheelDeltaToScale(360).scale,1/1.2);
  assert.equal(wheelDeltaToScale(361).scale,1/1.4);
  assert.equal(wheelDeltaToScale(-120).scale,1.1);
});
test('zoom-in follows pointer but zoom-out follows center',()=>{
  assert.deepEqual(scaleAroundPivot({start:20,end:80},.5,0),{start:20,end:50});
  const input={start:20,end:80};
  assert.equal(wheelZoomWindow(input,100,120,0).window.start,20);
  assert.deepEqual(wheelZoomWindow(input,100,-120,0),wheelZoomWindow(input,100,-120,1));
  assert.equal(wheelZoomWindow({start:0,end:100},100,-120,.2).handled,false);
  assert.deepEqual(wheelZoomWindow({start:0,end:1},100,120,0).window,{start:0,end:1});
});
test('fractional pan preserves width and clamps either edge',()=>{
  assert.deepEqual(panZoomWindow({start:20,end:40},.25,100),{start:15,end:35});
  assert.deepEqual(panZoomWindow({start:20,end:40},5,100),{start:0,end:20});
  assert.deepEqual(panZoomWindow({start:20,end:40},-5,100),{start:80,end:100});
});
test('slider whole-window drag and source minimum span',()=>{
  assert.equal(sliderMinimumSpan(1001),10);
  assert.equal(sliderMinimumSpan(1001,0),0);
  assert.deepEqual(sliderBarWindow({start:10,end:30},-100,100,101),{start:0,end:20});
  assert.deepEqual(sliderBarWindow({start:10,end:30},10,100,101,{inverted:true}),{start:0,end:20});
  assert.deepEqual(sliderHandleWindow({start:10,end:30},'start',30,101),{start:29,end:30});
  assert.deepEqual(sliderHandleWindow({start:10,end:30},'start',30,101,{minSpan:0}),{start:30,end:30});
});
test('track click moves nearest edge; inside selection does not jump',()=>{
  assert.deepEqual(sliderTrackClick({start:20,end:40},60,101),{window:{start:20,end:60},handle:'end'});
  assert.equal(sliderTrackClick({start:20,end:40},30,101).handle,null);
});
test('heat plain wheel moves three vertical categories and clamps',()=>{
  assert.deepEqual(heatMapPlainWheel({start:10,end:20},-1,100),{start:13,end:23});
  assert.deepEqual(heatMapPlainWheel({start:0,end:10},100,100),{start:0,end:10});
});
test('tooltip flips independently; pan threshold is Manhattan distance',()=>{
  assert.deepEqual(cursorTooltipPlacement(90,90,100,100,20,20),{left:54,top:54});
  assert.equal(chartGestureDistance({x:0,y:0},{x:2,y:2}),4);
  assert.deepEqual(lerpZoomStep({start:0,end:100},{start:10,end:90}).next,{start:1.5,end:98.5});
  assert.equal(lerpZoomStep({start:9.95,end:90.05},{start:10,end:90}).converged,true);
});
