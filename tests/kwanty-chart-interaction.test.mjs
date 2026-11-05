import test from 'node:test';
import assert from 'node:assert/strict';
import {chartRegion, panChartView, zoomChartView} from '../public/kwanty-app/chart-interaction.js';

const t = Date.UTC(2026, 9, 20, 14);
const profile = {left:56,right:956,top:34,bottom:434,minPrice:90,maxPrice:110,minExposure:-10,maxExposure:30,startTime:t,endTime:t+3_600_000,alignment:'center'};
const orderflow = {...profile,minValue:-100,maxValue:300,spotDomain:[90,110],priceAxisVisible:true};
const near = (a,b) => assert.ok(Math.abs(a-b) < Math.max(1,Math.abs(a),Math.abs(b))*1e-12, `${a} != ${b}`);
const zoom = (pkg,g,region,extra={}) => zoomChartView(pkg,g,{keep:'saved'},{x:281,y:134,deltaY:-100,region,...extra});

test('regions distinguish price, metric, time and exposure axes including right-aligned profiles',()=>{
  assert.equal(chartRegion('classic',profile,{x:20,y:100}),'price-axis');
  assert.equal(chartRegion('state',{...profile,alignment:'right'},{x:980,y:100}),'price-axis');
  assert.equal(chartRegion('state',{...profile,alignment:'right'},{x:20,y:100}),null);
  assert.equal(chartRegion('classic',profile,{x:100,y:20}),'exposure-axis');
  assert.equal(chartRegion('classic',profile,{x:100,y:460}),'time-axis');
  assert.equal(chartRegion('orderflow',orderflow,{x:20,y:100}),'metric-axis');
  assert.equal(chartRegion('orderflow',orderflow,{x:980,y:100}),'price-axis');
  assert.equal(chartRegion('orderflow',{...orderflow,priceAxisVisible:false},{x:980,y:100}),null);
  assert.equal(chartRegion('classic',profile,{x:100,y:100}),'plot');
});

test('Classic and State normal wheel zoom price time independently of exposure',()=>{
  for(const pkg of ['classic','state']){
    const next=zoom(pkg,profile,'plot');
    assert.equal(next.keep,'saved');assert.equal(next.minExposure,undefined);assert.equal(next.minPrice,undefined);
    const ratio=.25;
    near(next.startTime+ratio*(next.endTime-next.startTime),t+ratio*3_600_000);
    assert.ok(next.endTime-next.startTime<3_600_000);
  }
});

test('exposure axis affects exposure only, anchored beneath cursor',()=>{
  for(const gesture of [{region:'exposure-axis'}]){
    const next=zoom('classic',profile,gesture.region,gesture);
    near(next.minExposure+.25*(next.maxExposure-next.minExposure),0);
    assert.equal(next.startTime,undefined);assert.equal(next.minPrice,undefined);
  }
});

test('reference Ctrl+wheel scales the vertical chart domain, not time or exposure',()=>{
 for(const pkg of ['classic','state']){const next=zoom(pkg,profile,'plot',{ctrlKey:true});assert.ok(next.maxPrice-next.minPrice<20);assert.equal(next.startTime,undefined);assert.equal(next.minExposure,undefined);}
 const next=zoom('orderflow',orderflow,'plot',{ctrlKey:true});assert.ok(next.maxValue-next.minValue<400);assert.equal(next.startTime,undefined);assert.ok(next.maxSpot-next.minSpot<20);
});

test('Ctrl-wheel stays vertical across plot and axes in Classic and State',()=>{
 for(const pkg of ['classic','state'])for(const region of ['plot','time-axis','exposure-axis','price-axis']){
  const initial={startTime:t,endTime:t+3_600_000,minExposure:-10,maxExposure:30};
  const next=zoomChartView(pkg,profile,initial,{x:281,y:134,deltaY:-120,ctrlKey:true,region});
  near(next.maxPrice-next.minPrice,18);assert.equal(next.startTime,initial.startTime);assert.equal(next.endTime,initial.endTime);assert.equal(next.minExposure,-10);assert.equal(next.maxExposure,30);
 }
});
test('rapid Ctrl-wheel events accumulate before paint and reverse without time drift',()=>{
 const gesture={x:281,y:134,deltaY:-120,ctrlKey:true,region:'plot'};
 const first=zoomChartView('classic',profile,{},gesture),second=zoomChartView('classic',profile,first,gesture);
 near(first.maxPrice-first.minPrice,18);near(second.maxPrice-second.minPrice,16.2);
 const reversed=zoomChartView('classic',profile,second,{...gesture,deltaY:120});
 near(reversed.minPrice,first.minPrice);near(reversed.maxPrice,first.maxPrice);
 assert.equal(second.startTime,undefined);assert.equal(second.minExposure,undefined);
 assert.deepEqual(zoomChartView('classic',profile,first,{...gesture,deltaY:0}),first);
});

test('vertical price and metric wheel scales remain independent and cursor-anchored',()=>{
  const result=zoom('orderflow',orderflow,'price-axis');
  near(result.minSpot+.75*(result.maxSpot-result.minSpot),105);
  assert.equal(result.minValue,undefined);assert.equal(result.startTime,undefined);
  const metric=zoom('orderflow',orderflow,'metric-axis');
  near(metric.minValue+.75*(metric.maxValue-metric.minValue),200);
  assert.equal(metric.minSpot,undefined);
  const classic=zoom('classic',profile,'price-axis');
  near(classic.minPrice+.75*(classic.maxPrice-classic.minPrice),105);
});

test('profile plot drag moves time and price, retaining unrelated saved ranges',()=>{
  const view={minExposure:-20,maxExposure:20,minSpot:1,maxSpot:2,extra:true};
  const next=panChartView('state',profile,view,{dx:90,dy:40,region:'plot'});
  near(next.startTime,t-360_000);near(next.endTime,t+3_240_000);
  near(next.minPrice,92);near(next.maxPrice,112);
  assert.equal(next.minExposure,-20);assert.equal(next.maxExposure,20);assert.equal(next.extra,true);
  assert.deepEqual(view,{minExposure:-20,maxExposure:20,minSpot:1,maxSpot:2,extra:true});
});

test('control-drag exposure cannot overwrite price time viewport',()=>{
  const next=panChartView('classic',profile,{startTime:t+1,endTime:t+2},{dx:90,dy:0,region:'plot',ctrlKey:true});
  near(next.minExposure,-14);near(next.maxExposure,26);
  assert.equal(next.startTime,t+1);assert.equal(next.endTime,t+2);
});

test('Orderflow drag keeps price manual scale while moving metric and time',()=>{
  const next=panChartView('orderflow',orderflow,{minSpot:95,maxSpot:105},{dx:90,dy:40});
  near(next.startTime,t-360_000);near(next.minValue,-60);near(next.maxValue,340);
  assert.equal(next.minSpot,95);assert.equal(next.maxSpot,105);
});

test('axis drag rescales selected vertical domain only; time-axis drag pans time only',()=>{
  const next=panChartView('orderflow',orderflow,{}, {dx:100,dy:100,region:'price-axis'});
  near((next.minSpot+next.maxSpot)/2,100);assert.ok(next.maxSpot-next.minSpot>20);
  assert.equal(next.minValue,undefined);assert.equal(next.startTime,undefined);
  const time=panChartView('classic',profile,{}, {dx:90,dy:200,region:'time-axis'});
  assert.equal(time.minPrice,undefined);near(time.startTime,t-360_000);
});

test('invalid, empty and degenerate geometry never produces NaN viewport overrides',()=>{
  for(const g of [null,{}, {...profile,right:56},{...profile,bottom:34},{...profile,minPrice:NaN,maxPrice:Infinity},{...profile,startTime:null,endTime:null}]){
    for(const next of [zoomChartView('classic',g,{keep:1},{x:100,y:100,deltaY:100}),panChartView('classic',g,{keep:1},{dx:5,dy:5})]){
      assert.equal(next.keep,1);
      for(const value of Object.values(next))assert.ok(Number.isFinite(value));
    }
  }
  assert.deepEqual(zoomChartView('classic',profile,{keep:1},{x:NaN,y:100,deltaY:1}),{keep:1});
  assert.deepEqual(panChartView('classic',profile,{keep:1},{dx:NaN,dy:1}),{keep:1});
});

test('line/page wheel units normalize and extreme inputs stay finite',()=>{
  const pixels=zoom('classic',profile,'plot',{deltaY:16});
  const lines=zoom('classic',profile,'plot',{deltaY:1,deltaMode:1});
  assert.deepEqual(lines,pixels);
  const pages=zoom('classic',profile,'plot',{deltaY:1,deltaMode:2});
  const height=zoom('classic',profile,'plot',{deltaY:400});
  assert.deepEqual(pages,height);
  const tiny={...profile,startTime:t,endTime:t+1000};
  const result=zoom('classic',tiny,'plot',{deltaY:-1e100});
  near(result.endTime-result.startTime,1000);
  for(const value of Object.values(result))if(typeof value==='number')assert.ok(Number.isFinite(value));
});

test('source State and Classic price-axis drag pans the domain without changing magnification or unrelated axes',()=>{
 for(const pkg of ['state','classic'])for(const side of ['left','right']){const g={...profile,priceAxisSide:side},view={startTime:t+1000,endTime:t+2000,minExposure:-7,maxExposure:13,saved:true},next=panChartView(pkg,g,view,{dx:19,dy:100,region:'price-axis'});near(next.minPrice,95);near(next.maxPrice,115);near(next.maxPrice-next.minPrice,20);const y=(range,value)=>g.bottom-(value-range.minPrice)/(range.maxPrice-range.minPrice)*(g.bottom-g.top);near(y(next,100)-y({minPrice:90,maxPrice:110},100),100);assert.equal(next.startTime,view.startTime);assert.equal(next.endTime,view.endTime);assert.equal(next.minExposure,-7);assert.equal(next.maxExposure,13);assert.equal(next.saved,true);assert.equal(view.minPrice,undefined);const reverse=panChartView(pkg,{...g,minPrice:next.minPrice,maxPrice:next.maxPrice},next,{dx:0,dy:-100,region:'price-axis'});near(reverse.minPrice,90);near(reverse.maxPrice,110);}
 const sourceLike={...profile,minPrice:7520,maxPrice:7640,top:34,bottom:634},moved=panChartView('state',sourceLike,{}, {dx:0,dy:100,region:'price-axis'});near(moved.minPrice,7540);near(moved.maxPrice,7660);near(moved.maxPrice-moved.minPrice,120);
 const metric=panChartView('orderflow',orderflow,{}, {dx:0,dy:100,region:'metric-axis'});assert.ok(metric.maxValue-metric.minValue>400,'unverified OrderFlow axis semantics remain unchanged');
});
