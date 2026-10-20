import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {drawProfile} from '../public/kwanty-app/profile-chart.js';
import {renderOrderflow} from '../public/kwanty-app/orderflow-chart.js';

// Recording Canvas2D arithmetic fixture: actual renderers, no mocked renderer,
// network, provider or production fallback. Colours identify price paint calls.
function canvas(){
  const calls=[],ctx={measureText:text=>({width:String(text).length*6})};
  for(const method of ['save','restore','clearRect','fillRect','fillText','beginPath','moveTo','lineTo','stroke','fill','rect','roundRect','clip','arc','setLineDash'])ctx[method]=(...args)=>calls.push({method,args,fill:ctx.fillStyle,stroke:ctx.strokeStyle});
  return {ctx,calls};
}
const minute=60_000,time=Date.UTC(2026,9,20,14),up='#123456',down='#654321',priceColor='#fedcba';
const bar=(index=0,extra={})=>({time:time+index*minute,open:100,high:105,low:98,close:103,...extra});
const prices=[bar(),bar(1,{open:103,high:108,low:102,close:107}),bar(2,{open:107,high:109,low:100,close:101})];
const line=prices.map(c=>({time:c.time,spot:c.close}));
const record=(index=0,extra={})=>({timestamp:(time+index*minute)/1000,ticker:'QQQ',spot:900,zgr:10+index,...extra});
const settings={spotViewMode:'candles',candleUp:{color:up},candleDown:{color:down},spotColor:priceColor,spotIsCustomized:true,showGrid:false,showMajorLevels:false};
const payload={ticker:'QQQ',spot:100,strikes:[[100,2,3,[]]]};
const view={startTime:time,endTime:time+120*minute,minPrice:90,maxPrice:120,minExposure:-5,maxExposure:5};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const priceBodies=calls=>calls.filter(c=>['roundRect','fillRect'].includes(c.method)&&[up,down].includes(c.fill));
const order=(options={})=>{const result=canvas();return {...result,geometry:renderOrderflow(result.ctx,1000,500,{ticker:'QQQ',metric:'net-gex',records:[record()],priceHistory:prices,priceLine:line,settings,view,...options})};};
const profile=(options={})=>{const result=canvas();return {...result,geometry:drawProfile(result.ctx,1000,500,{package:'classic',payload,priceHistory:prices,settings,candleInterval:minute,view,...options})};};

test('one real Orderflow observation has a visible current metric label, never an invented curve',()=>{
 const result=order({records:[record(2,{zgr:-29428.66})]});
 assert.ok(result.calls.some(call=>call.method==='fillText'&&call.args[0]==='Latest -29,428.66'));
 assert.equal(result.geometry.data.series[0].values.length,1);assert.equal(result.geometry.data.series[0].values[0].raw,-29428.66);
});

test('Classic and State draw explicit real OHLC wicks and bodies rather than positioning spot candles',()=>{
  for(const pkg of ['classic','state']){
    const {geometry:g,calls}=profile({package:pkg});assert.deepEqual(g.history.map(c=>[c.open,c.high,c.low,c.close]),prices.map(c=>[c.open,c.high,c.low,c.close]));
    assert.equal(priceBodies(calls).length,3);
    const wicks=calls.filter(c=>c.method==='lineTo'&&[up,down].includes(c.stroke));
    assert.equal(wicks.length,3);near(wicks[0].args[1],g.priceY(98));
  }
});

test('Orderflow real OHLC input is not reconstructed from positioning snapshots',()=>{
  const {geometry:g,calls}=order({records:[record(0,{spot:999}),record(1,{spot:1})]});
  assert.deepEqual(g.data.candles.map(c=>[c.open,c.high,c.low,c.close]),prices.map(c=>[c.open,c.high,c.low,c.close]));
  assert.equal(priceBodies(calls).length,3);const wicks=calls.filter(c=>c.method==='lineTo'&&[up,down].includes(c.stroke));
  near(wicks[0].args[1],g.spotY(98));
});

test('explicit empty authoritative candle arrays never fall back to spot-only snapshot OHLC',()=>{
  for(const records of [[record(),record(1,{spot:999})],[]]){
    const {geometry:g,calls}=order({records,priceHistory:[],priceLine:[]});assert.deepEqual(g.data.candles,[]);assert.deepEqual(g.data.pricePoints,[]);assert.equal(priceBodies(calls).length,0);
  }
  const p=profile({priceHistory:[]});assert.deepEqual(p.geometry.history,[]);assert.equal(priceBodies(p.calls).length,0);
});

test('external live price line paints Orderflow with one or zero positioning observations',()=>{
  for(const records of [[record()],[]]){
    const {geometry:g,calls}=order({records,priceHistory:[],settings:{...settings,spotViewMode:'line'},view:{}});
    assert.deepEqual(g.data.pricePoints,line);assert.equal(g.startTime,time);assert.equal(g.endTime,time+2*minute);
    const pricePath=calls.filter(c=>['moveTo','lineTo'].includes(c.method)&&c.stroke===priceColor);
    assert.equal(pricePath.length,3);near(pricePath[0].args[0],g.timeX(time));near(pricePath[2].args[1],g.spotY(101));
    assert.ok(!calls.some(c=>c.method==='fillText'&&c.args[0]==='No Orderflow observations available'));
  }
});

test('price multiplier and offset change OHLC/price only, never raw metric exposure',()=>{
  const {geometry:g}=order({records:[record(),record(1)],settings:{...settings,priceMultiplier:2,priceOffset:5}});
  assert.deepEqual([g.data.candles[0].open,g.data.candles[0].high,g.data.candles[0].low,g.data.candles[0].close],[205,215,201,211]);
  assert.deepEqual(g.data.series[0].values.map(p=>p.raw),[10,11]);assert.equal(g.data.pricePoints[0].spot,211);
  const p=profile({conversion:2,conversionOffset:5});assert.equal(p.geometry.rows[0].strike,205);assert.equal(p.geometry.rows[0].volume,2);assert.equal(p.geometry.history[0].low,201);
});

test('manual Orderflow price-axis and metric-axis domains apply independently',()=>{
  const {geometry:g}=order({view:{...view,minSpot:95,maxSpot:115,minValue:-20,maxValue:50}});
  assert.deepEqual(g.spotDomain,[95,115]);assert.equal(g.minValue,-20);assert.equal(g.maxValue,50);
  near(g.spotY(95),g.bottom);near(g.spotY(115),g.top);near(g.valueY(-20),g.bottom);near(g.valueY(50),g.top);
});

test('manual time/price/exposure/metric viewport remains fixed when live price history grows',()=>{
  const pinned={...view,minSpot:95,maxSpot:115,minValue:-20,maxValue:50};
  const extra=bar(3,{high:500,close:400}),options={priceHistory:[...prices,extra],priceLine:[...line,{time:extra.time,spot:400}],view:pinned};
  const before=order({view:pinned}).geometry,after=order(options).geometry;
  for(const key of ['startTime','endTime','minValue','maxValue'])assert.equal(after[key],before[key]);assert.deepEqual(after.spotDomain,before.spotDomain);
  const p0=profile({view:pinned}).geometry,p1=profile(options).geometry;
  for(const key of ['startTime','endTime','minPrice','maxPrice','minExposure','maxExposure'])assert.equal(p1[key],p0[key]);
});

test('live profile spot override follows independent quote not stale positioning spot',()=>{
  for(const pkg of ['classic','state']){
    const {geometry:g,calls}=profile({package:pkg,spotPrice:107});assert.equal(g.spot,107);
    assert.ok(calls.some(c=>c.method==='fillText'&&c.args[0]==='107.00'));
    assert.equal(payload.spot,100);
  }
});

test('price candle bodies grow with time-axis zoom instead of depending on total retained history count',()=>{
  const narrow={...view,endTime:time+60*minute};
  for(const render of [profile,order]){
    const wide=priceBodies(render().calls),zoomed=priceBodies(render({view:narrow}).calls);
    assert.equal(wide.length,3);assert.equal(zoomed.length,3);assert.ok(zoomed[0].args[2]>wide[0].args[2]);
    const retained=[...prices,...Array.from({length:200},(_,index)=>bar(index+200))];
    const sameWindow=priceBodies(render({view:narrow,priceHistory:retained}).calls).filter(c=>c.args[0]>=0&&c.args[0]<1000);
    near(sameWindow[0].args[2],zoomed[0].args[2]);
  }
});

test('candle interval enablement is driven by real candle availability, not positioning snapshot count',async()=>{
  const app=await readFile(new URL('../public/kwanty-app/app.js',import.meta.url),'utf8');
  const timeline=app.slice(app.indexOf('function syncTimeline()'),app.indexOf('function stopReplay()'));
  assert.match(timeline,/interval\.disabled=priceState\(\)\.candles\.length===0/);
  assert.doesNotMatch(timeline,/interval\.disabled=state\.records\.length/);
  assert.doesNotMatch(app,/collectCandles\(/);
});

test('Classic and State hit-test genuine nearest candle OHLC independently of profile strikes',()=>{
  for(const pkg of ['classic','state']){
    const g=profile({package:pkg}).geometry,hit=g.hitTest(g.timeX(time+minute+10_000),g.priceY(107));
    assert.equal(hit.candle.time,time+minute);assert.deepEqual([hit.candle.open,hit.candle.high,hit.candle.low,hit.candle.close],[103,108,102,107]);
    assert.equal(hit.spot,107);assert.equal(hit.pricePoint.time,time+minute);assert.equal(g.hitTest(0,0),null);
    const lineOnly=profile({package:pkg,priceHistory:line,settings:{...settings,spotViewMode:'line'}}).geometry;
    const quote=lineOnly.hitTest(lineOnly.timeX(time+minute),lineOnly.priceY(107));assert.equal(quote.candle,null);assert.equal(quote.spot,107);
  }
});

test('Orderflow hover follows independent price timestamps without carrying distant metric observations',()=>{
  const g=order({records:[record(360,{zgr:999})]}).geometry;
  const hit=g.hitTest({x:g.timeX(time+minute),y:g.spotY(107)});
  assert.equal(hit.time,time+minute);assert.equal(hit.spot,107);assert.equal(hit.candle.close,107);assert.equal(hit.record,null);assert.equal(hit.index,-1);
  assert.ok(hit.series.every(series=>series.raw===null&&series.value===null));
  const nearby=order({records:[record(1,{zgr:45})]}).geometry.hitTest({time:time+minute});
  assert.equal(nearby.time,time+minute);assert.equal(nearby.series[0].raw,45);assert.equal(nearby.record.zgr,45);
});

test('Orderflow hover can resolve line-only prices without candles or any positioning records',()=>{
  const g=order({records:[],priceHistory:[],settings:{...settings,spotViewMode:'line'}}).geometry;
  const hit=g.hitTest({time:time+minute+15_000});assert.equal(hit.time,time+minute);assert.equal(hit.spot,107);assert.equal(hit.candle,null);assert.equal(hit.record,null);
  assert.equal(g.hitTest({time:time-minute}),null);
});

test('explicit OHLC without a separate price line still owns the price domain and hover time',()=>{
  const g=order({records:[record(360,{spot:999})],priceLine:undefined,view:{}}).geometry;
  assert.equal(g.startTime,time);assert.equal(g.endTime,time+2*minute);assert.deepEqual(g.data.pricePoints,line);
  const hit=g.hitTest({time:time+minute});assert.equal(hit.spot,107);assert.equal(hit.candle.close,107);assert.equal(hit.record,null);
});

test('external price input sorting is isolated and keeps hover/candles chronological',()=>{
  const reversed=[...prices].reverse(),reversedLine=[...line].reverse();
  const g=order({priceHistory:reversed,priceLine:reversedLine,records:[]}).geometry;
  assert.deepEqual(g.data.candles.map(c=>c.time),prices.map(c=>c.time));assert.deepEqual(g.data.pricePoints.map(c=>c.time),line.map(c=>c.time));
  assert.equal(g.hitTest({time:time+minute}).candle.close,107);assert.equal(reversed[0].time,time+2*minute);assert.equal(reversedLine[0].time,time+2*minute);
});

test('legacy Orderflow callers without explicit price arrays retain positioning-time hit semantics',()=>{
  const {ctx}=canvas();const g=renderOrderflow(ctx,1000,500,{ticker:'QQQ',metric:'net-gex',records:[record(),record(10)],settings:{...settings,spotViewMode:'line',candleBucketMs:0}});
  const hit=g.hitTest({time:time+6*minute});assert.equal(hit.time,time+10*minute);assert.equal(hit.record.zgr,20);assert.equal(hit.series[0].raw,20);
});
