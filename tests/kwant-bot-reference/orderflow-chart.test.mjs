import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDERFLOW_METRICS, collectOrderflowCandles, makeOrderflowSeries, orderflowPriceTicks, orderflowThemeColor, orderflowTimestamp, renderOrderflow } from '../../public/kwanty-app/orderflow-chart.js';

// Explicitly synthetic arithmetic fixtures; never production fallbacks.
test('hex and named default colors retain source light conversion without recoloring customized values',()=>{assert.equal(orderflowThemeColor('#ffffff','white',true),'#4b5563');assert.equal(orderflowThemeColor('#00ffff','cyan',true),'#0369a1');assert.equal(orderflowThemeColor('#ffffff','white',true,true),'#ffffff')});
const sample = (timestamp, fields = {}) => ({ timestamp, ticker: 'SPX', spot: 5000, zcvr: 10, ocvr: -3, zgr: 40, ogr: 7, agg_dex: 100, one_agg_dex: 20, agg_call_dex: 140, agg_put_dex: -40, one_agg_call_dex: 30, one_agg_put_dex: -10, dexoflow: 5, one_dexoflow: -2, gexoflow: 9, one_gexoflow: 1, cvroflow: -8, one_cvroflow: 2, ...fields });
const base = 1770000000;

test('native units and aggregate values are neither divided nor recumulated', () => {
  const data = makeOrderflowSeries({ records: [sample(base), sample(base + 60, { agg_dex: 120 })], metric: 'aggregate-dex' });
  assert.deepEqual(data.series[0].values.map(point => point.raw), [100, 120]);
  assert.equal(data.points[0].time, base * 1000);
  assert.equal(orderflowTimestamp(base * 1000), base * 1000);
});
test('stable last observation wins duplicate timestamp/instrument and samples sort', () => {
  const data = makeOrderflowSeries({ records: [sample(base + 60), sample(base), sample(base, { zgr: 99 })], metric: 'net-gex' });
  assert.deepEqual(data.series[0].values.map(point => point.raw), [99, 40]);
});
test('expiry both selects latest/next while combine overlays exposure and flow', () => {
  const records = [sample(base), sample(base + 60, { dexoflow: 6 })];
  assert.deepEqual(makeOrderflowSeries({ records, metric: 'net-gex', expiry: 'both' }).series.map(series => series.values[0].raw), [40, 7]);
  assert.deepEqual(makeOrderflowSeries({ records, metric: 'net-gex', combine: true }).series.map(series => series.values[0].raw), [40, 9]);
  assert.deepEqual(makeOrderflowSeries({ records, metric: 'dex-orderflow', expiry: 'both' }).series[0].values.map(point => point.raw), [3, 4]);
  assert.equal(makeOrderflowSeries({ records, metric: 'net-gex', expiry: 'one' }).series[0].values[0].raw, 7);
  const combinedNext = makeOrderflowSeries({ records, metric: 'dex-orderflow', expiry: 'one', combine: true });
  assert.equal(combinedNext.series[0].positiveColor, 'orange');
  assert.deepEqual(combinedNext.series.map(series => series.values[0].raw), [-2, 20, 30, -10]);
  const both = makeOrderflowSeries({ records, metric: 'net-gex', expiry: 'both', combine: true });
  assert.deepEqual(both.series.map(series => series.values[0].raw), [40, 7, 10]);
});
test('source default latest and next palettes are distinct where shipped', () => {
  assert.deepEqual(ORDERFLOW_METRICS['aggregate-dex'].colors, ['cyan', '#ae4ad5', '#008B8B', '#800080']);
  assert.deepEqual(ORDERFLOW_METRICS['dex-orderflow'].colors, ['magenta', 'orange', 'orange', '#1e4c8c']);
  assert.deepEqual(ORDERFLOW_METRICS['gex-orderflow'].colors, ['yellow', 'red', 'red', '#006400']);
});
test('missing values stay gaps and threshold does not mutate raw source', () => {
  const records = [sample(base, { zgr: null }), sample(base + 60, { zgr: 4 }), sample(base + 120, { zgr: 0 })];
  const data = makeOrderflowSeries({ records, metric: 'net-gex', threshold: 5 });
  assert.deepEqual(data.series[0].values.map(point => point.value), [null, 4, null]);
  assert.deepEqual(data.series[0].values.map(point => point.raw), [null, 4, 0]);
  assert.equal(records[1].zgr, 4);
  assert.equal(makeOrderflowSeries({ records: [sample(base, { one_dexoflow: null })], metric: 'dex-orderflow', expiry: 'both' }).series[0].values[0].raw, null);
  const flow = makeOrderflowSeries({ records: [sample(base)], metric: 'net-gex', combine: true, thresholds: { 'gex orderflow': 10 } });
  assert.equal(flow.series[0].values[0].value, 40);
  assert.equal(flow.series[1].values[0].value, null);
  assert.equal(flow.series[1].values[0].raw, 9);
});
test('vanna/charm remain selected-expiry series and per-sign visibility masks', () => {
  const records = [sample(base, { zvanna: 2, ovanna: -4 }), sample(base + 60, { zvanna: -2 })];
  assert.equal(makeOrderflowSeries({ records, metric: 'net-vanna', combine: true }).series.length, 1);
  const values = makeOrderflowSeries({ records, metric: 'net-vanna', settings: { showPositive: false } }).series[0].values;
  assert.deepEqual(values.map(point => point.value), [null, -2]);
  const combined = makeOrderflowSeries({ records: [sample(base)], metric: 'net-gex', expiry: 'both', settings: { showPositive: true, showNextPositive: false } });
  assert.equal(combined.series[0].values[0].value, 40);
  assert.equal(combined.series[1].values[0].value, null);
});
test('spot only interpolates inside observed endpoints and only prices multiply', () => {
  const records = [sample(base, { spot: null }), sample(base + 60, { spot: 100 }), sample(base + 120, { spot: null }), sample(base + 180, { spot: 120 }), sample(base + 240, { spot: null })];
  const data = makeOrderflowSeries({ records, settings: { priceMultiplier: 2, priceOffset: 3 } });
  assert.deepEqual(data.points.map(point => point.spot), [null, 203, 223, 243, null]);
  assert.equal(data.series[0].values[0].raw, 10);
  assert.equal(data.points[2].spotInterpolated, true);
});
test('mixed instruments fail closed; explicit ticker filtering does not cross-contaminate', () => {
  const records = [sample(base), sample(base, { ticker: 'NDX', zcvr: 99 })];
  assert.equal(makeOrderflowSeries({ records }).error, 'MIXED_INSTRUMENTS');
  assert.equal(makeOrderflowSeries({ records, ticker: 'NDX' }).series[0].values[0].raw, 99);
});
test('only source history levels carry, not instantaneous gamma fields or metrics', () => {
  const data = makeOrderflowSeries({ records: [sample(base, { major: 5010 }), sample(base + 60, { zcvr: null })], settings: { majorLevels: [{ field: 'major', color: 'lime' }] } });
  assert.deepEqual(data.levels[0].values.map(point => point.value), [5010, null]);
  assert.equal(data.series[0].values[1].value, null);
  const history = makeOrderflowSeries({ records: [sample(base, { zero_gamma: 5010 }), sample(base + 60)], settings: { majorLevels: [{ field: 'zero_gamma' }] } });
  assert.deepEqual(history.levels[0].values.map(point => point.value), [5010, 5010]);
});
test('aggregate DEX includes supplied call/put series without invented splits', () => {
  const result = makeOrderflowSeries({ records: [sample(base)], metric: 'aggregate-dex', expiry: 'both' });
  assert.deepEqual(result.series.map(series => series.field), ['agg_dex','one_agg_dex','agg_call_dex','one_agg_call_dex','agg_put_dex','one_agg_put_dex']);
  assert.deepEqual(result.series.map(series => series.values[0].raw), [100,20,140,30,-40,-10]);
  const absent = makeOrderflowSeries({ records: [sample(base, { agg_call_dex: null })], metric: 'aggregate-dex' });
  assert.equal(absent.series.find(series => series.field === 'agg_call_dex').values[0].value, null);
});
test('light default palettes convert exactly but custom colors are preserved', () => {
  assert.equal(orderflowThemeColor('cyan','cyan',true), '#0369a1');
  assert.equal(orderflowThemeColor('cyan','cyan',true,true), 'cyan');
  assert.equal(orderflowThemeColor('#abcdef','cyan',true), '#abcdef');
  const result = makeOrderflowSeries({ records: [sample(base)], metric: 'aggregate-dex', settings: { lightMode:true, series:{agg_call_dex:{color:'#aabbcc',showPositive:false}} } });
  assert.equal(result.series[0].positiveColor, '#0369a1');
  assert.equal(result.series.find(series => series.field === 'agg_call_dex').positiveColor, '#aabbcc');
  assert.equal(result.series.find(series => series.field === 'agg_call_dex').values[0].value, null);
});

function mockCanvas() {
  const calls = [];
  const ctx = new Proxy({ calls }, { get(target, key) { if (key in target) return target[key]; return (...args) => calls.push([key, ...args]); }, set(target, key, value) { calls.push(['set', key, value]); target[key] = value; return true; } });
  return ctx;
}
test('render geometry has independent spot scale and exact time hit-testing', () => {
  const ctx = mockCanvas(), start = base * 1000;
  const geometry = renderOrderflow(ctx, 800, 320, { records: [sample(base, { spot: 4999 }), sample(base + 60, { spot: 5001 })], view: { startTime: start, endTime: start + 120000, minValue: -50, maxValue: 50 } });
  assert.equal(geometry.timeX(start), geometry.left);
  assert.equal(geometry.timeX(start + 120000), geometry.right);
  assert.equal(geometry.hitTest({ x: geometry.timeX(start + 59000) }).time, start + 60000);
  assert.equal(geometry.hitTest({ time: start - 1 }), null);
  assert.notEqual(geometry.valueY(10), geometry.spotY(5000));
  assert.ok(ctx.calls.some(call => call[0] === 'fillRect'));
});
test('viewport is kept when observations grow; empty render remains explicit', () => {
  const start = base * 1000, view = { startTime: start + 15000, endTime: start + 45000 };
  const a = renderOrderflow(mockCanvas(), 800, 300, { records: [sample(base)], view });
  const b = renderOrderflow(mockCanvas(), 800, 300, { records: [sample(base), sample(base + 60)], view });
  assert.equal(a.startTime, b.startTime); assert.equal(a.endTime, b.endTime);
  const empty = mockCanvas(); renderOrderflow(empty, 800, 300);
  assert.ok(empty.calls.some(call => call[0] === 'fillText' && /No Orderflow observations/.test(call[1])));
});
test('pixel hover selects second timestamp and crosshair uses its plotted coordinate', () => {
  const records = [sample(base), sample(base + 60)], ctx = mockCanvas();
  const geometry = renderOrderflow(ctx, 800, 320, { records, hover: { x: 720, y: 100 } });
  assert.equal(geometry.hitTest({ x: 720 }).time, (base + 60) * 1000);
  const crosshairStart = ctx.calls.findLastIndex(call => call[0] === 'setLineDash' && call[1]?.join(',') === '3,3');
  const move = ctx.calls.slice(crosshairStart).find(call => call[0] === 'moveTo');
  assert.deepEqual(move, ['moveTo', geometry.timeX((base + 60) * 1000), geometry.top]);
  const hidden = mockCanvas();
  renderOrderflow(hidden, 800, 320, { records, hover: { x: 720, y: 100 }, settings: { showCrosshairs: false } });
  assert.ok(!hidden.calls.some(call => call[0] === 'setLineDash' && call[1]?.join(',') === '3,3'));
});
test('light mode uses readable neutral axes and grid over light background', () => {
  const ctx = mockCanvas();
  renderOrderflow(ctx, 800, 320, { records: [sample(base)], settings: { lightMode: true } });
  assert.ok(ctx.calls.some(call => call[0] === 'set' && call[1] === 'fillStyle' && call[2] === '#ffffff'));
  assert.ok(ctx.calls.some(call => call[0] === 'set' && call[1] === 'fillStyle' && call[2] === '#353535'));
  assert.ok(ctx.calls.some(call => call[0] === 'set' && call[1] === 'strokeStyle' && call[2] === '#dddddd'));
});
test('price axis remains meaningful for enabled major overlay when spot is hidden', () => {
  const geometry = renderOrderflow(mockCanvas(), 800, 320, { records: [sample(base, { z_mlgamma: 5100 })], showSpot:false, settings:{majorLevels:[{field:'z_mlgamma',color:'cyan'}]} });
  assert.equal(geometry.priceAxisVisible,true);
  assert.ok(geometry.spotDomain[0] > 5000);
  assert.equal(renderOrderflow(mockCanvas(),800,320,{records:[sample(base)],showSpot:false}).priceAxisVisible,false);
});
test('source candle buckets use actual observations only, no invented empty intervals',()=>{
  const aligned=base-base%60,records=[sample(aligned+1,{spot:100,zgr:10,gexoflow:2}),sample(aligned+10,{spot:120,zgr:20,gexoflow:3}),sample(aligned+20,{spot:90,zgr:30,gexoflow:4}),sample(aligned+181,{spot:110,zgr:50,gexoflow:1})];
  const candles=collectOrderflowCandles(records,60000);
  assert.deepEqual(candles.map(candle=>[candle.time,candle.open,candle.high,candle.low,candle.close,candle.observations]),[[aligned*1000,100,120,90,90,3],[(aligned+180)*1000,110,110,110,110,1]]);
  const data=makeOrderflowSeries({records,metric:'net-gex',combine:true,thresholds:{'gex orderflow':8},settings:{spotViewMode:'candles',candleBucketMs:60000}});
  assert.deepEqual(data.series[0].values.map(point=>point.raw),[20,50]);
  assert.deepEqual(data.series[1].values.map(point=>point.raw),[9,1]);
  assert.deepEqual(data.series[1].values.map(point=>point.value),[9,null]);
  assert.equal(data.sourceObservationCount,4);
  assert.equal(data.points.length,2);
  const disjoint=makeOrderflowSeries({records:[sample(aligned+1,{gexoflow:5,one_gexoflow:null}),sample(aligned+10,{gexoflow:null,one_gexoflow:2})],metric:'gex-orderflow',expiry:'both',settings:{spotViewMode:'candles',candleBucketMs:60000}});
  assert.equal(disjoint.series[0].values[0].raw,null); // never combine unmatched timestamps
});
test('source exposure renders lines without area fills, flows dashed stems',()=>{
  const records=[sample(base,{zgr:10}),sample(base+60,{zgr:-10})],line=mockCanvas();
  renderOrderflow(line,800,320,{records,metric:'net-gex',showSpot:false});
  assert.equal(line.calls.filter(call=>call[0]==='fillRect').length,1); // background only
  assert.ok(!line.calls.some(call=>call[0]==='fill'));
  const flow=mockCanvas();renderOrderflow(flow,800,320,{records,metric:'gex-orderflow',showSpot:false});
  assert.ok(flow.calls.some(call=>call[0]==='setLineDash'&&call[1]?.join(',')==='2,2'));
  assert.equal(flow.calls.filter(call=>call[0]==='fillRect').length,1);
});
test('hidden positive side does not erase the visible negative zero-crossing segment',()=>{
  const ctx=mockCanvas();const geometry=renderOrderflow(ctx,800,320,{records:[sample(base,{zgr:10}),sample(base+60,{zgr:-10})],metric:'net-gex',showSpot:false,settings:{showPositive:false}});
  const crossingX=geometry.timeX((base+30)*1000);
  assert.ok(ctx.calls.some(call=>call[0]==='moveTo'&&call[1]===crossingX&&call[2]===geometry.valueY(0)));
});
test('axis tooltips and crosshairs are independent controls',()=>{
  const records=[sample(base),sample(base+60)];
  const badge=mockCanvas();renderOrderflow(badge,800,320,{records,hover:{x:400,y:100},settings:{showCrosshairs:false,showAxisTooltips:true}});
  assert.ok(badge.calls.some(call=>call[0]==='fillRect'&&call[3]<800));
  assert.ok(!badge.calls.some(call=>call[0]==='setLineDash'&&call[1]?.join(',')==='3,3'));
  const crosshair=mockCanvas();renderOrderflow(crosshair,800,320,{records,hover:{x:400,y:100},settings:{showCrosshairs:true,showAxisTooltips:false}});
  assert.equal(crosshair.calls.filter(call=>call[0]==='fillRect').length,1);
  assert.ok(crosshair.calls.some(call=>call[0]==='setLineDash'&&call[1]?.join(',')==='3,3'));
});
test('source price tick increments and display decimals do not add K/M scaling',()=>{
  const integers=orderflowPriceTicks(7600,7700,300);assert.equal(integers.increment,10);assert.equal(integers.decimals,0);
  const fractions=orderflowPriceTicks(100,101,300);assert.equal(fractions.increment,.1);assert.equal(fractions.decimals,2);
  const ctx=mockCanvas();renderOrderflow(ctx,800,320,{records:[sample(base,{zgr:1000000}),sample(base+60,{zgr:2000000})],metric:'net-gex',showSpot:false});
  assert.ok(ctx.calls.some(call=>call[0]==='fillText'&&call[1]==='1,500,000'));
});
test('major overlay display, size and line style settings are honored',()=>{
  const records=[sample(base,{z_mlgamma:5100}),sample(base+60,{z_mlgamma:5101})],ctx=mockCanvas();
  const result=renderOrderflow(ctx,800,320,{records,settings:{majorLevels:[{field:'z_mlgamma',size:3,lineType:'dashed'},{field:'z_msgamma',display:false}]}});
  assert.equal(result.data.levels.length,1);
  assert.ok(ctx.calls.some(call=>call[0]==='set'&&call[1]==='lineWidth'&&call[2]===3));
  assert.ok(ctx.calls.some(call=>call[0]==='setLineDash'&&call[1]?.join(',')==='8,4'));
});

test('latest-only major levels paint at their genuine observation, never as invented session lines',()=>{
  const ctx=mockCanvas(),time=base*1000;
  const geometry=renderOrderflow(ctx,800,320,{records:[sample(base,{z_mlgamma:5100})],showSpot:false,settings:{majorLevels:[{field:'z_mlgamma',color:'cyan'}]},view:{startTime:time-60000,endTime:time+60000}});
  assert.ok(ctx.calls.some(call=>call[0]==='arc'&&call[1]===geometry.timeX(time)&&call[2]===geometry.spotY(5100)));
  assert.deepEqual(geometry.data.levels[0].values,[{time,value:5100}]);
  const absent=mockCanvas();renderOrderflow(absent,800,320,{records:[sample(base)],showSpot:false,settings:{showPositive:false,showNegative:false,majorLevels:[{field:'z_mlgamma'}]}});
  assert.ok(!absent.calls.some(call=>call[0]==='arc'));
});

test('every supplied Orderflow metric produces a visible latest-only mark for each enabled expiry',()=>{
  for(const metric of Object.keys(ORDERFLOW_METRICS))for(const expiry of ['zero','one','both']){
    const records=[sample(base,{zvanna:3,ovanna:-4,zcharm:5,ocharm:-6})],ctx=mockCanvas();
    const geometry=renderOrderflow(ctx,800,320,{records,metric,expiry,showSpot:false,view:{startTime:base*1000-60000,endTime:base*1000+60000}});
    assert.ok(geometry.data.series.every(series=>series.values[0].value!==null),`${metric}/${expiry} retains every supplied metric`);
    for(const series of geometry.data.series){const point=series.values[0],x=geometry.timeX(point.time),y=geometry.valueY(point.value);
      assert.ok(ctx.calls.some(call=>series.flow?call[0]==='lineTo'&&call[1]===x&&call[2]===y:call[0]==='arc'&&call[1]===x&&call[2]===y),`${metric}/${expiry}/${series.id} paints actual value`);
    }
  }
});
