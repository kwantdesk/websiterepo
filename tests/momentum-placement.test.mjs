import test from 'node:test';
import assert from 'node:assert/strict';
import {CHART_INDICATOR_CATALOG} from '../src/lib/chartIndicatorCatalog.ts';
import {defaultIndicatorSettings,normalizeStoredIndicator,normalizePaneIndicatorState} from '../src/lib/chartIndicatorConfig.ts';
import {calculateIndicatorSeries} from '../src/lib/chartIndicatorEngine.ts';
import {MOMENTUM_INDICATOR_IDS,momentumOnChart,momentumScaleMargins} from '../src/lib/momentumPlacement.ts';
import {alignIndicatorSeriesToEventBars,buildEventIndicatorTimeMap} from '../src/lib/eventIndicatorAlignment.ts';
const theme={primary:'#eee',secondary:'#aaa',positive:'#0f0',negative:'#f00',muted:'#888'};
const candles=Array.from({length:320},(_,i)=>({timestamp:1700000000000+i*60000,open:28000+i%25,close:28000+i%33,high:28040+i%37,low:27950+i%21,volume:100+i}));
const definitions=CHART_INDICATOR_CATALOG.filter(d=>d.category==='Momentum');
test('complete momentum category is supported, without converting trend price overlays',()=>{
 assert.equal(definitions.length,14);assert.equal(MOMENTUM_INDICATOR_IDS.size,14);
 assert.equal(momentumOnChart({indicatorId:'moving-average',settings:{chartArea:'chart'}}),false);
});
for(const definition of definitions)test(definition.name+': placement, persistence, independent scale, replay and event alignment',()=>{
 const settings=defaultIndicatorSettings(definition.id);
 assert.equal(settings.chartArea,'pane');
 const instance={indicatorId:definition.id,instanceId:'momentum-test',enabled:true,settings};
 const bottom=calculateIndicatorSeries(instance,candles,theme);
 assert.ok(bottom.some(s=>s.data.length),'real calculated output required');
 assert.ok(bottom.every(s=>s.placement==='pane'));
 const onChart=normalizeStoredIndicator({...instance,settings:{...settings,chartArea:'chart'}});
 assert.equal(onChart.settings.chartArea,'chart');assert.equal(momentumOnChart(onChart),true);
 const chart=calculateIndicatorSeries(onChart,candles,theme);
 assert.equal(chart.length,bottom.length);
 chart.forEach((s,i)=>{
  assert.equal(s.placement,'overlay');assert.ok(s.priceScaleId.startsWith('momentum-momentum-test'));
  assert.notEqual(s.priceScaleId,'right');assert.equal(s.independentScale,true);
  assert.deepEqual(s.data,bottom[i].data,'placement cannot transform indicator values');
 });
 const restored=normalizePaneIndicatorState(JSON.parse(JSON.stringify({p:[onChart]}))).p[0];
 assert.equal(restored.settings.chartArea,'chart');
 const back=normalizeStoredIndicator({...restored,settings:{...restored.settings,chartArea:'pane'}});
 assert.deepEqual(calculateIndicatorSeries(back,candles,theme),bottom);
 assert.equal(calculateIndicatorSeries({...onChart,enabled:false},candles,theme).length,0);
 const clock=candles[230].timestamp;
 const replay=calculateIndicatorSeries(onChart,candles,theme,{replayTimestampMs:clock});
 assert.ok(replay.every(s=>s.data.every(p=>p.time*1000<=clock)));
 const times=new Map(candles.map((c,i)=>[c.timestamp,2000000+i]));
 const aligned=alignIndicatorSeriesToEventBars(chart,buildEventIndicatorTimeMap(candles,times));
 aligned.forEach(s=>s.data.forEach(p=>assert.ok(p.time>=2000000&&p.time<2000320)));
 const other=calculateIndicatorSeries({...onChart,instanceId:'second'},candles,theme);
 assert.notEqual(chart[0].priceScaleId,other[0].priceScaleId);
});
test('unrecognized placement safely restores the conventional pane',()=>{
 for(const id of MOMENTUM_INDICATOR_IDS) assert.equal(normalizeStoredIndicator({indicatorId:id,instanceId:id,enabled:true,settings:{chartArea:'garbage'}}).settings.chartArea,'pane');
});
test('overlay scale stays above docked panes without changing the candle margins',()=>{
 for(const [top,bottom] of [[.08,.08],[.08,.6],[.5,.08],[.45,.45]]){
  const actual=momentumScaleMargins(top,bottom);
  assert.equal(actual.bottom,bottom);assert.ok(actual.top>top);assert.ok(actual.top+actual.bottom<1);
 }
});
