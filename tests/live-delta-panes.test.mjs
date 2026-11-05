import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { LiveDeltaPaneModel, LIVE_DELTA_PANE_INTERVAL_MS, isLiveDeltaPane, deltaPaneIdentity } from '../src/lib/liveDeltaPanes.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import { LIVE_CHART_CANDLE_EVENT } from '../src/lib/chartLiveEvents.ts';
const start=Date.UTC(2026,10,5,8);
const theme={primary:'#fff',secondary:'#ccc',positive:'#0f0',negative:'#f00',muted:'#888'};
const candle=(i,ask=10,bid=3)=>({timestamp:start+i*60000,open:100,high:101,low:99,close:100,volume:ask+bid,askVolume:ask,bidVolume:bid,askTrades:ask,bidTrades:bid,delta:ask-bid});
const group=(id,settings={})=>({key:id,indicatorId:id,settings,series:[]});
const ids=['cumulative-volume-delta','delta-cumulative-candlestick','delta-cumulative-histogram','delta-bar'];
const input=(candles)=>({candles,theme,instrument:'NQ',tickSize:0.25});
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
function harness(groups,inputs){
 const source=readFileSync(new URL('../src/components/useLiveDeltaPanes.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export function useLiveDeltaPanes','function useLiveDeltaPanes');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const refs=[],states=[],effects=[];let cursor=0,queued=[],timers=new Map(),next=0,output,props={groups,inputs,key:'pane',scope:'NQ:1m'};
 const window=new EventTarget();const equal=(a,b)=>a&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const useRef=value=>{const i=cursor++;return refs[i]??=( {current:value} );};
 const useState=value=>{const i=cursor++;if(!(i in states))states[i]=value;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;render();}];};
 const useEffect=(fn,deps)=>{const i=cursor++;if(!equal(effects[i]?.deps,deps))queued.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});};
 const hook=new Function('useEffect','useRef','useState','LIVE_CHART_CANDLE_EVENT','deltaPaneIdentity','isLiveDeltaPane','LIVE_DELTA_PANE_INTERVAL_MS','LiveDeltaPaneModel','window','setTimeout','clearTimeout',code+';return useLiveDeltaPanes;')(useEffect,useRef,useState,LIVE_CHART_CANDLE_EVENT,deltaPaneIdentity,isLiveDeltaPane,LIVE_DELTA_PANE_INTERVAL_MS,LiveDeltaPaneModel,window,(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},id=>timers.delete(id));
 function render(){cursor=0;output=hook(props.groups,props.scope,props.key,props.inputs);const q=queued;queued=[];for(const effect of q)effect();}
 render();return {get output(){return output;},get timers(){return timers;},emit(c,key='pane'){window.dispatchEvent(new CustomEvent(LIVE_CHART_CANDLE_EVENT,{detail:{key,candle:c}}));},flush(){const q=[...timers.values()];timers.clear();for(const t of q)t.fn();},update(p){props={...props,...p};render();},dispose(){for(const effect of effects)effect?.cleanup?.();}};
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
