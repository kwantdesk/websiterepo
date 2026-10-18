import test from 'node:test';
import assert from 'node:assert/strict';
import {HEAT_METRICS,heatMetricFor,heatCellValue,heatCellColor,niceValueDomain,exposureLegs,exposureValueDomain,exposureStrikeWindow,heatMapInitialWindow,drawExposureBars} from '../../public/gex-data-app/exposure-models.js';

test('heat metric inventory preserves 8 net and 19 metrics for each leg',()=>{
  assert.equal(HEAT_METRICS.length,46);
  assert.equal(new Set(HEAT_METRICS.map(metric=>metric.apiName)).size,46);
  assert.equal(HEAT_METRICS.filter(metric=>metric.supportsMVC).length,4);
  assert.equal(heatMetricFor('NET_GAMMA_EXPOSURE').sourceName,'GAMMA_EXPOSURE');
  assert.equal(heatMetricFor('PUT_THETA').format,'decimal');
  assert.equal(heatMetricFor('CALL_IMPLIED_VOLATILITY').format,'percent');
});

test('paired heat data sums exposure legs but subtracts other paired metrics',()=>{
  assert.equal(heatCellValue({callValue:10,putValue:-3},'NET_GAMMA_EXPOSURE'),7);
  assert.equal(heatCellValue({callValue:10,putValue:3},'NET_VOLUME'),7);
  assert.equal(heatCellValue({value:0,callValue:10},'CALL_GAMMA'),0);
});

test('leg heat colors remain leg-specific even when the Greek is negative',()=>{
  assert.equal(heatCellColor(-100,'CALL_THETA',100,-100),'#00FF00e6');
  assert.equal(heatCellColor(100,'PUT_GAMMA',100,-100),'#FF0000e6');
  assert.equal(heatCellColor(100,'NET_GAMMA_EXPOSURE',100,-100,true),'#7D1AD6');
  assert.equal(heatCellColor(0,'NET_GAMMA_EXPOSURE',100,-100),'transparent');
});

test('nice value domain is outward rounded and IV is not hard-coded to zero through 100',()=>{
  assert.deepEqual(niceValueDomain(42,58),{min:40,max:60,ticks:[40,42.5,45,47.5,50,52.5,55,57.5,60]});
  const single=niceValueDomain(50,50);assert.ok(single.min<50&&single.max>50);
  assert.deepEqual(niceValueDomain(NaN,5),{min:0,max:1,ticks:[0,.25,.5,.75,1]});
});

test('net exposure splits positive and negative parts; calls/puts are not netted in split mode',()=>{
  assert.deepEqual(exposureLegs({call:10,put:-30},'NET').map(leg=>leg.value),[0,-20]);
  assert.deepEqual(exposureLegs({call:10,put:-30},'SPLIT').map(leg=>leg.value),[10,-30]);
  const domain=exposureValueDomain([{call:11,put:-30}],'SPLIT');
  assert.ok(domain.max>=30&&domain.min<=-30);
});

test('initial exposure window keeps 5 to 40 neighbors and roughly eight percent',()=>{
  const strikes=Array.from({length:201},(_,index)=>index);
  assert.deepEqual(exposureStrikeWindow(strikes,100),[92,108]);
  assert.deepEqual(exposureStrikeWindow(Array.from({length:201},(_,i)=>90+i/10),100),[60,140]);
  assert.deepEqual(exposureStrikeWindow([10,30,50,70,90,100,110,130,150,170,190],100),[0,10]);
});

test('heat map initial window is source pixel based and centered around nearest actual spot',()=>{
  const strikes=Array.from({length:401},(_,i)=>i+500),expiries=Array.from({length:50},(_,i)=>String(i));
  assert.deepEqual(heatMapInitialWindow(560,500,expiries,strikes,763),{horizontal:[0,7],vertical:[253,273]});
  assert.deepEqual(heatMapInitialWindow(560,500,expiries,strikes,763,true),{horizontal:[260,267],vertical:[0,15]});
  assert.equal(heatMapInitialWindow(560,500,expiries,strikes,NaN),null);
});

test('exposure canvas uses numeric strike geometry, excludes zeros and centers split legs',()=>{
  const rectangles=[],ctx=new Proxy({measureText:text=>({width:String(text).length*7}),fillRect:(...rect)=>rectangles.push(rect)},{get:(target,key)=>key in target?target[key]:(()=>{})});
  const points=[{strike:100,call:10,put:-20},{strike:101,call:0,put:0},{strike:110,call:30,put:-5}];
  const frame=drawExposureBars(ctx,700,500,points,{display:'SPLIT',categoryFormatter:point=>String(point.strike),valueFormatter:String});
  assert.equal(rectangles.length,4);
  assert.equal(rectangles[0][0],rectangles[1][0],'source exposure split bars overlap instead of being grouped');
  assert.ok(frame.categoryPixel(points[2],2)-frame.categoryPixel(points[1],1)>8*(frame.categoryPixel(points[1],1)-frame.categoryPixel(points[0],0)));
  assert.ok(frame.domain.min<=-30&&frame.domain.max>=30);
});
