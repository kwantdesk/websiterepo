import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKET_MAP_SLIDER_MAX,MARKET_MAP_CAMERA_IDENTITY,marketMapMaxZoom,clampMarketMapCamera,wheelMarketMapCamera,panMarketMapCamera,marketMapCameraWindows,applyMarketMapWindow,marketMapWorldPoint} from '../../public/gex-data-app/market-map-interaction-model.js';
const identity={...MARKET_MAP_CAMERA_IDENTITY};
const almost=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('dynamic source maximum zoom considers only positive two-dimensional tiles',()=>{
  assert.equal(marketMapMaxZoom([]),50);
  assert.equal(marketMapMaxZoom([{width:100,height:100},{width:0,height:.001}]),50);
  assert.equal(marketMapMaxZoom([{width:4,height:.5}]),256);
  assert.equal(marketMapMaxZoom([{width:1e-9,height:1}]),100000);
});
test('camera clamps independent scales and translated viewport edges',()=>{
  assert.deepEqual(clampMarketMapCamera({zoomX:2,zoomY:4,offsetX:-1000,offsetY:10},100,50),{zoomX:2,zoomY:4,offsetX:-100,offsetY:0});
  assert.deepEqual(clampMarketMapCamera({zoomX:0,zoomY:100,offsetX:50,offsetY:-10000},100,50,20),{zoomX:1,zoomY:20,offsetX:0,offsetY:-950});
});
test('wheel preserves pointer world position and independent axis ratio',()=>{
  const old={zoomX:2,zoomY:3,offsetX:-40,offsetY:-90},pointer={x:25,y:35};
  const result=wheelMarketMapCamera(old,{...pointer,deltaY:-1,width:100,height:100,maxZoom:100});
  const before=marketMapWorldPoint(old,pointer.x,pointer.y),after=marketMapWorldPoint(result.camera,pointer.x,pointer.y);
  assert.equal(result.handled,true);almost(after.x,before.x);almost(after.y,before.y);
  almost(result.camera.zoomX,2.4);almost(result.camera.zoomY,3.6);
});
test('full outward wheel delegates to home plane',()=>{
  assert.equal(wheelMarketMapCamera(identity,{x:20,y:20,deltaY:1,width:100,height:100}).handled,false);
  assert.equal(wheelMarketMapCamera(identity,{x:20,y:20,deltaY:-1,width:100,height:100}).handled,true);
});
test('pan clamps geometry and only moves requested offsets',()=>{
  assert.deepEqual(panMarketMapCamera({zoomX:2,zoomY:4,offsetX:-40,offsetY:-90},500,-500,100,100),{zoomX:2,zoomY:4,offsetX:0,offsetY:-300});
});
test('camera navigator roundtrip uses999 not1000 and top-origin vertical axis',()=>{
  assert.equal(MARKET_MAP_SLIDER_MAX,999);
  const old={zoomX:2,zoomY:4,offsetX:-50,offsetY:-100};
  const windows=marketMapCameraWindows(old,100,100);
  assert.deepEqual(windows,{horizontal:{start:249.75,end:749.25},vertical:{start:249.75,end:499.5}});
  const horizontal=applyMarketMapWindow(identity,'horizontal',windows.horizontal,100,100);
  const both=applyMarketMapWindow(horizontal,'vertical',windows.vertical,100,100);
  assert.deepEqual(both,old);
  assert.equal(marketMapCameraWindows(old,0,100),null);
});
test('collapsed navigator range reaches maxZoom without invalid camera',()=>{
  const result=applyMarketMapWindow(identity,'horizontal',{start:500,end:500},100,100,200);
  assert.equal(result.zoomX,200);assert.equal(result.zoomY,1);
  assert.ok(result.offsetX>=-19900&&result.offsetX<=0);
});
