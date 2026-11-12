import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { LiveDeltaPaneModel, LIVE_DELTA_PANE_INTERVAL_MS, isLiveDeltaPane, isLivePriceStudy, deltaPaneIdentity } from '../src/lib/liveDeltaPanes.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import { LIVE_CHART_CANDLE_EVENT, LIVE_CHART_EXECUTION_EVENT } from '../src/lib/chartLiveEvents.ts';
import { mergeMonthlyRecordedFlow } from '../src/lib/institutionalMarketData.ts';
const start=Date.UTC(2026,10,5,8);
const theme={primary:'#fff',secondary:'#ccc',positive:'#0f0',negative:'#f00',muted:'#888'};
const candle=(i,ask=10,bid=3)=>({timestamp:start+i*60000,open:100,high:101,low:99,close:100,volume:ask+bid,askVolume:ask,bidVolume:bid,askTrades:ask,bidTrades:bid,delta:ask-bid});
const group=(id,settings={})=>({key:id,indicatorId:id,settings,series:[]});
const ids=['cumulative-volume-delta','delta-cumulative-candlestick','delta-cumulative-histogram','delta-bar'];
const input=(candles)=>({candles,theme,instrument:'NQ',tickSize:0.25});

test("monthly flow only enriches matching closed candles with missing classified volume", () => {
  const flow = [candle(0), candle(1), candle(2), candle(3)];
  const priceOnly = flow.map(({ askVolume, bidVolume, delta, ...bar }) => bar);
  priceOnly[1] = { ...priceOnly[1], volume: 99 };
  priceOnly[2] = { ...flow[2], askVolume: 9, bidVolume: 4, delta: 5 };
  const result = mergeMonthlyRecordedFlow(priceOnly, flow);
  assert.equal(result[0].delta, 7);
  assert.equal(result[1], priceOnly[1]);
  assert.equal(result[2], priceOnly[2]);
  assert.equal(result[3], priceOnly[3]);
});

test("monthly CVD and Delta retain old bars and match the full engine after a live batch", () => {
  const rows = Array.from({ length: 4500 }, (_, i) => candle(i, 10 + i % 7, 3));
  const studies = [group("cumulative-volume-delta", { displayStyle: "line", showBidAskVolumes: true }),
    group("delta-bar"), group("delta-cumulative-candlestick", { resetToSession: false, showAverage: true })];
  const next = candle(rows.length, 40, 3);
  const chart = harness(studies, { ...input(rows), preserveEarlierHistory: true });
  try {
    chart.flush();
    chart.executions([...rows.slice(-32), next]);
    chart.flush();
    for (const study of chart.output) {
      const expected = calculateIndicatorSeries({
        instanceId: study.key, indicatorId: study.indicatorId, enabled: true, settings: study.settings,
      }, [...rows, next], theme);
      assert.deepEqual(study.series.map(({ data }) => data), expected.map(({ data }) => data));
    }
  } finally {
    chart.dispose();
  }
});

test('ATR and deviation hydrate next frame and update independently of delayed parent samples', () => {
 const rows=Array.from({length:30},(_,i)=>({...candle(i),close:100+i*.25,high:110+i*.25,low:90+i*.25}));
 const studies=['average-true-range-atr','standard-deviation'].map(id=>group(id,{length:14}));
 const h=harness(studies,input(rows),'price');
 try {
  assert.equal([...h.timers.values()][0].ms,0,'first paint does not wait for the sampler');
  h.flush();
  for(const g of h.output) assert.ok(g.series[0].data.length);
  const next={...rows.at(-1),high:140,close:125};
  h.emit(next);h.emit({...next,high:145,close:130});
  assert.equal(h.timers.size,1,'burst is coalesced');
  assert.equal([...h.timers.values()][0].ms,100);
  h.flush();
  for(const g of h.output){
   const expected=calculateIndicatorSeries({instanceId:g.key,indicatorId:g.indicatorId,enabled:true,settings:g.settings},[...rows.slice(0,-1),{...next,high:145,close:130}],theme);
   assert.deepEqual(g.series[0].data,expected[0].data);
  }
  assert.equal(h.timers.size,0,'no idle polling');
  h.update({groups:studies.map(g=>({...g,settings:{length:5}}))});h.flush();
  assert.equal(h.output[0].series[0].label,'ATR 5');
  h.update({key:undefined,scope:'replay'});
  h.emit({...next,timestamp:next.timestamp+60000});assert.equal(h.timers.size,0);
 } finally { h.dispose(); }
});

test('price studies consume execution-only event-bar batches with source-to-chart alignment', () => {
 const rows=Array.from({length:30},(_,i)=>({...candle(i),close:100+i,high:110+i,low:90+i}));
 const h=harness([group('standard-deviation',{length:5})],{...input(rows),mapTime:t=>t+1000},'price');
 try{h.flush();h.executions([...rows,{...rows.at(-1),timestamp:start+30*60000,close:140,high:150}]);h.flush();
 assert.equal(h.output[0].series[0].data.at(-1).time,(start+30*60000)/1000+1000);
 }finally{h.dispose();}
});

test('price-study tail snapshots retain loaded history and contract changes reset the model', () => {
 const rows=Array.from({length:60},(_,i)=>({...candle(i),close:100+i,high:110+i,low:90+i}));
 const h=harness([group('average-true-range-atr',{length:14})],input(rows),'price');
 try{
  h.flush();const before=h.output[0].series[0].data.length;
  h.executions([{...rows.at(-1),timestamp:start+60*60000,high:200}]);h.flush();
  assert.equal(h.output[0].series[0].data.length,before+1);
  h.update({scope:'ES:5m',inputs:input(rows.map(c=>({...c,high:102,low:99,close:100})))});h.flush();
  assert.equal(h.output[0].series[0].data.at(-1).value,3);
 }finally{h.dispose();}
});
test('live execution candles advance all delta panes across four bars while parent history is unchanged',()=>{
 const history=[candle(0)];const model=new LiveDeltaPaneModel();const inputs=input(history);model.hydrate(history);
 for(let i=1;i<=4;i++){
  model.observe(candle(i,i*10,3));model.hydrate(history);
  for(const id of ids){const [series]=model.calculate(group(id),inputs);assert.equal(series.data.at(-1).time,(start+i*60000)/1000);}
 }
 assert.equal(model.calculate(group('delta-bar'),inputs)[0].data.at(-1).value,37);
 assert.equal(model.calculate(group('cumulative-volume-delta'),inputs)[0].data.at(-1).value,95);
});
test('ordinary engine parity includes reset modes, filters, trade counts, averages and bid/ask plots',()=>{
 const rows=Array.from({length:60},(_,i)=>candle(i,10+i,20));const model=new LiveDeltaPaneModel();model.hydrate(rows.slice(0,50));for(const row of rows.slice(50))model.observe(row);
 for(const id of ids)for(const settings of [{},{displayStyle:'line',showBidAskVolumes:true,filteredEnabled:true,filterMinVolume:50},{inputData:'Aggregate Trades',periodMode:'minutes',periodValue:5},{resetToSession:false,showAverage:true,averageLength:5,filterMaxVolume:55}]){
  const actual=model.calculate(group(id,settings),input(rows));
  const expected=calculateIndicatorSeries({instanceId:id,indicatorId:id,enabled:true,settings},rows,theme,{instrument:'NQ',tickSize:0.25}).map(s=>({...s,groupKey:id}));assert.deepEqual(actual,expected);
 }
});
test('stale parent hydration cannot erase live tail; missing classified input is never manufactured',()=>{
 const model=new LiveDeltaPaneModel();const rows=[candle(0)];model.hydrate(rows);model.observe(candle(1,30,2));model.hydrate([...rows]);
 assert.equal(model.calculate(group('delta-bar'),input(rows))[0].data.at(-1).value,28);
 model.observe({...candle(2),askVolume:undefined,bidVolume:undefined});
 assert.equal(model.calculate(group('delta-bar'),input(rows))[0].data.at(-1).time,(start+60000)/1000);
});
test('event-chart points use the same remapped price-bar coordinates',()=>{
 const model=new LiveDeltaPaneModel();model.hydrate([candle(0),candle(1)]);
 const [series]=model.calculate(group('delta-bar'),{...input([]),mapTime:time=>time===start/1000?123:undefined});assert.deepEqual(series.data.map(p=>p.time),[123]);
});
function harness(groups,inputs,mode="delta"){
 const source=readFileSync(new URL('../src/components/useLiveDeltaPanes.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export function useLiveDeltaPanes','function useLiveDeltaPanes');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const refs=[],states=[],effects=[];let cursor=0,queued=[],timers=new Map(),next=0,output,props={groups,inputs,key:'pane',scope:'NQ:1m'};
 const window=new EventTarget();const equal=(a,b)=>a&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const useRef=value=>{const i=cursor++;return refs[i]??=( {current:value} );};
 const useState=value=>{const i=cursor++;if(!(i in states))states[i]=value;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;render();}];};
 const useEffect=(fn,deps)=>{const i=cursor++;if(!equal(effects[i]?.deps,deps))queued.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});};
 const hook=new Function('useEffect','useRef','useState','LIVE_CHART_CANDLE_EVENT','LIVE_CHART_EXECUTION_EVENT','deltaPaneIdentity','isLiveDeltaPane','isLivePriceStudy','LIVE_DELTA_PANE_INTERVAL_MS','LiveDeltaPaneModel','window','setTimeout','clearTimeout','requestAnimationFrame','cancelAnimationFrame',code+';return useLiveDeltaPanes;')(useEffect,useRef,useState,LIVE_CHART_CANDLE_EVENT,LIVE_CHART_EXECUTION_EVENT,deltaPaneIdentity,isLiveDeltaPane,isLivePriceStudy,LIVE_DELTA_PANE_INTERVAL_MS,LiveDeltaPaneModel,window,(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},id=>timers.delete(id),fn=>{const id=++next;timers.set(id,{fn,ms:0});return id;},id=>timers.delete(id));
 function render(){cursor=0;output=hook(props.groups,props.scope,props.key,props.inputs,mode);const q=queued;queued=[];for(const effect of q)effect();}
 render();return {get output(){return output;},get timers(){return timers;},emit(c,key='pane'){window.dispatchEvent(new CustomEvent(LIVE_CHART_CANDLE_EVENT,{detail:{key,candle:c}}));},executions(candles,key='pane'){window.dispatchEvent(new CustomEvent(LIVE_CHART_EXECUTION_EVENT,{detail:{key,candles,records:[],tape:[],continuity:'continuous'}}));},flush(){const q=[...timers.values()];timers.clear();for(const t of q)t.fn();},update(p){props={...props,...p};render();},dispose(){for(const effect of effects)effect?.cleanup?.();}};
}
test('actual pane hook paints without parent rerenders and does not create an idle timer loop',()=>{
 const h=harness(ids.map(id=>group(id)),input([candle(0)]));try{
 h.flush();assert.equal(h.timers.size,0);
 for(let i=1;i<=4;i++){h.emit(candle(i));assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].ms,200);h.flush();assert.equal(h.timers.size,0);for(const g of h.output)assert.equal(g.series[0].data.at(-1).time,(start+i*60000)/1000);}
 h.emit(candle(10),'unrelated');assert.equal(h.timers.size,0);
 h.update({key:undefined,scope:'replay:100'});h.emit(candle(11));assert.equal(h.timers.size,0);assert.ok(h.output.every(g=>g.series.length===0));
 }finally{h.dispose();}
});
test('actual hook switches settings and contract scope without leaking previous cumulative values',()=>{
 const h=harness([group('cumulative-volume-delta')],input([candle(0)]));try{h.flush();h.emit(candle(1,50,3));h.flush();
 h.update({scope:'ES:5m',inputs:input([candle(0,2,10)])});h.flush();assert.equal(h.output[0].series[0].data.at(-1).value,-8);
 }finally{h.dispose();}
});

test('execution-only delivery advances CVD and Delta with no price-paint events or parent updates',()=>{
 const h=harness(ids.map(id=>group(id)),input([candle(0)]));try{h.flush();
 const bars=[candle(0)];for(let i=1;i<=4;i++){bars.push(candle(i,i*10,3));h.executions(bars);h.flush();for(const g of h.output)assert.equal(g.series[0].data.at(-1).time,(start+i*60000)/1000);}
 assert.equal(h.output.find(g=>g.indicatorId==='delta-bar').series[0].data.at(-1).value,37);
 assert.equal(h.output.find(g=>g.indicatorId==='cumulative-volume-delta').series[0].data.at(-1).value,95);
 // Receiving the same canonical candle through both channels cannot double count.
 h.emit(bars.at(-1));h.flush();assert.equal(h.output.find(g=>g.indicatorId==='cumulative-volume-delta').series[0].data.at(-1).value,95);
 h.executions([candle(10)],'other');assert.equal(h.timers.size,0);
 h.update({key:undefined,scope:'replay'});h.executions([candle(11)]);assert.equal(h.timers.size,0);
 }finally{h.dispose();}
});

test('coalesced execution snapshots retain all skipped second-bar flow, not only the last four bars',()=>{
 const h=harness(ids.map(id=>group(id)),input([candle(0)]));try{h.flush();const bars=Array.from({length:20},(_,i)=>candle(i,10,3));h.executions(bars);h.flush();
 const cvd=h.output.find(g=>g.indicatorId==='cumulative-volume-delta').series[0].data;assert.equal(cvd.length,20);assert.equal(cvd.at(-1).value,140);
 }finally{h.dispose();}
});


test('Volume paints on the next animation frame, keeps every received bar, and honors a filter that hides all bars',()=>{
 const h=harness([group('volume')],input([candle(0)]),'volume');try{
 h.flush();for(let i=1;i<=4;i++){h.emit(candle(i,10+i,2));assert.equal([...h.timers.values()][0].ms,0);h.flush();assert.equal(h.output[0].series[0].data.at(-1).value,12+i);}
 const batch=Array.from({length:1000},(_,i)=>candle(i,10+i,2));h.executions(batch);h.flush();assert.equal(h.output[0].series[0].data.length,1000);
 h.update({groups:[group('volume',{minimumTotalVolume:1e7})]});h.flush();assert.equal(h.output[0].series[0].data.length,0);
 h.emit(candle(1000,20,2),'other');assert.equal(h.timers.size,0);
 h.update({key:undefined,scope:'replay'});h.emit(candle(1001));assert.equal(h.timers.size,0);
 }finally{h.dispose();}
});
