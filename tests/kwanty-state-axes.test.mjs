import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateProfileGeometry,drawProfile} from '../public/kwanty-app/profile-chart.js';
import {stateAxisLabels,stateCrosshairReadout,statePriceScale} from '../public/kwanty-app/state-axes.js';
import {chartRegion,panChartView,zoomChartView} from '../public/kwanty-app/chart-interaction.js';

const time=Date.UTC(2026,9,20,14,30);
const view={startTime:time,endTime:time+3_600_000,minPrice:98.25,maxPrice:102.75};
const payload={ticker:'QQQ',spot:100.25,strikes:[[100,2,3,[]],[101,-4,5,[]]]};
const geometry=(extra={})=>calculateProfileGeometry(1000,600,{package:'state',payload,view,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function context(){const calls=[],ctx={measureText:text=>({width:String(text).length*6})};for(const name of ['save','restore','clearRect','fillRect','fillText','beginPath','moveTo','lineTo','stroke','fill','rect','roundRect','clip','arc','setLineDash'])ctx[name]=(...args)=>calls.push({name,args});return{ctx,calls};}

test('State always reserves a right-hand price scale independently of profile alignment',()=>{
 for(const alignment of ['left','center','right']){
  const g=geometry({settings:{profileBarAlignment:alignment}});
  assert.equal(g.priceAxisSide,'right');assert.equal(g.left,18);assert.equal(g.right,912);
  assert.equal(chartRegion('state',g,{x:g.right+20,y:200}),'price-axis');
  assert.equal(chartRegion('state',g,{x:5,y:200}),null);
  assert.equal(chartRegion('state',g,{x:300,y:g.bottom+10}),'time-axis');
 }
 const classic=calculateProfileGeometry(1000,600,{package:'classic',payload,view});
 assert.equal(classic.priceAxisSide,'left');assert.equal(classic.left,56);
});

test('crosshair uses the exact cursor coordinate, not nearest candle time/price or strike',()=>{
 const g=geometry({priceHistory:[{time,spot:99},{time:time+60_000,spot:101}]});
 const stamp=time+123_456,price=100.375;
 const hit=stateCrosshairReadout(g,{x:g.timeX(stamp),y:g.priceY(price)},{timeZone:'UTC'});
 near(hit.time,stamp);near(hit.price,price);assert.equal(hit.priceText,'100.38');
 assert.match(hit.timeText,/14:32:03/);assert.match(hit.timeText,/Oct/);
 assert.notEqual(hit.time,time+60_000);assert.notEqual(hit.price,101);
 assert.equal(stateCrosshairReadout(g,{x:g.left-1,y:g.top}),null);
});

test('price decimals adapt to tight zoom without whole-number labels or duplicates',()=>{
 for(const [min,max]of [[98.25,102.75],[.00101,.00109],[29_899.12,29_899.18]]){
  const scale=statePriceScale(min,max,500),texts=scale.values.map(v=>v.toFixed(scale.decimals));
  assert.ok(scale.values.length>1);assert.equal(new Set(texts).size,texts.length);
  assert.ok(scale.decimals>=2);assert.ok(scale.values.every(v=>v>=min-1e-8&&v<=max+1e-8));
 }
 assert.deepEqual(statePriceScale(NaN,10,500).values,[]);
});

test('axes use the exact viewport after pan and zoom and preserve independent exposure units',()=>{
 const original=geometry();
 const moved=panChartView('state',original,view,{region:'plot',dx:120,dy:37});
 const zoomed=zoomChartView('state',original,moved,{x:300,y:200,deltaY:-100,ctrlKey:true,region:'plot'});
 const g=geometry({view:zoomed});
 const point={x:g.left+(g.right-g.left)*.34,y:g.top+(g.bottom-g.top)*.62};
 const cursor=stateCrosshairReadout(g,point,{timeZone:'UTC'});
 near(cursor.time,g.startTime+.34*(g.endTime-g.startTime));
 near(cursor.price,g.minPrice+.38*(g.maxPrice-g.minPrice));
 const labels=stateAxisLabels(g,{timeZone:'UTC'});
 for(const tick of labels.time)near(g.hitTest(tick.x,(g.top+g.bottom)/2).time,tick.value);
 for(const tick of labels.price)near(g.hitTest((g.left+g.right)/2,tick.y).price,tick.value);
 assert.equal(zoomed.minExposure,undefined);
});

test('time labels honour timezone, DST and seconds when zoomed in',()=>{
 const g=geometry({view:{...view,startTime:Date.UTC(2026,10,1,5,30),endTime:Date.UTC(2026,10,1,6,30)}});
 const utc=stateAxisLabels(g,{timeZone:'UTC'}),ny=stateAxisLabels(g,{timeZone:'America/New_York'});
 assert.match(utc.time[0].text,/05:30/);assert.match(ny.time[0].text,/01:30/);
 assert.match(ny.time.at(-1).text,/01:30/);assert.equal(utc.time[0].value,ny.time[0].value);
 const early=stateCrosshairReadout(g,{x:g.left,y:g.priceY(100)},{timeZone:'America/New_York'});
 const late=stateCrosshairReadout(g,{x:g.right,y:g.priceY(100)},{timeZone:'America/New_York'});
 assert.match(early.timeText,/GMT-4/);assert.match(late.timeText,/GMT-5/);
 const tight=geometry({view:{...view,endTime:time+60_000}});
 assert.match(stateAxisLabels(tight,{timeZone:'UTC'}).time[0].text,/14:30:00/);
 assert.doesNotThrow(()=>stateAxisLabels(g,{timeZone:'invalid-zone'}));
});

test('time ticks land on actual clock boundaries instead of rounding arbitrary fractional-minute coordinates',()=>{
 const g=geometry({view:{...view,startTime:time+13_456,endTime:time+90*60_000}});
 const labels=stateAxisLabels(g,{timeZone:'UTC'});
 assert.ok(labels.time.length>=2);
 assert.ok(labels.time.every(tick=>tick.value%60_000===0));
 const tight=geometry({view:{...view,endTime:time+5000}});
 const cursor=stateCrosshairReadout(tight,{x:tight.timeX(time+1234),y:tight.priceY(100)} ,{timeZone:'UTC'});
 assert.match(cursor.timeText,/14:30:01\.234/);
});

test('no history invents no time axis or cursor timestamp',()=>{
 const g=geometry({view:{minPrice:99,maxPrice:102}});
 assert.deepEqual(stateAxisLabels(g).time,[]);
 const cursor=stateCrosshairReadout(g,{x:200,y:200});
 assert.equal(cursor.time,null);assert.equal(cursor.timeText,null);assert.ok(cursor.price>99);
});

test('State paints time along bottom and price/cursor labels on right without overlapping skew row',()=>{
 const {ctx,calls}=context();
 const options={package:'state',category:'gamma_zero',payload:{...payload,mini_contracts:[[100,.2,.3,4,[1,2,3]]]},view,settings:{timeZone:'UTC',showCrosshairs:true,ivSkew:true}};
 const g=calculateProfileGeometry(1000,600,options);
 const result=drawProfile(ctx,1000,600,{...options,hover:{x:g.timeX(time+123_456),y:g.priceY(100.375)}});
 assert.equal(result.crosshair.priceText,'100.38');
 assert.ok(calls.some(c=>c.name==='fillText'&&c.args[0]==='100.38'&&c.args[1]>g.right));
 assert.ok(calls.some(c=>c.name==='fillText'&&String(c.args[0]).includes('14:32:03')&&c.args[2]>g.bottom));
 assert.ok(calls.some(c=>c.name==='fillText'&&c.args[2]===g.bottom+21));
 assert.ok(calls.some(c=>c.name==='fillText'&&c.args[2]===g.bottom+43));
 assert.ok(calls.every(c=>c.args.every(a=>typeof a!=='number'||Number.isFinite(a))));
});

test('crosshair hiding and leaving the plot removes axis badges',()=>{
 for(const hover of [null,{x:1,y:1},{x:200,y:200}]){
  const {ctx}=context();
  const g=drawProfile(ctx,1000,600,{package:'state',payload,view,settings:{showCrosshairs:false},hover});
  assert.equal(g.crosshair,null);
 }
});
