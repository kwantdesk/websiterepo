import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
import {calculateIndicatorSeries} from '../src/lib/chartIndicatorEngine.ts';
import {CHART_INTERVAL_OPTIONS,supportsChartInterval} from '../src/lib/chartIntervals.ts';
import {MARKET_INDEX_DEFINITIONS} from '../src/lib/marketIndices.ts';
import {futuresTickSize} from '../src/lib/eventBars.ts';
import {LiveDeltaPaneModel} from '../src/lib/liveDeltaPanes.ts';
import vm from 'node:vm';
const theme={primary:'#fff',secondary:'#ccc',positive:'#0f0',negative:'#f00',muted:'#888'};
const source=readFileSync('src/lib/databento.ts','utf8');
const file=ts.createSourceFile('catalog.ts',source,ts.ScriptTarget.Latest,true);
let futures;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='DATABENTO_FUTURES')futures=Function('return ('+node.initializer.getText(file)+')')();ts.forEachChild(node,visit);}
visit(file);
const instruments=[...futures.map(i=>({symbol:i.symbol.split('.')[0],broker:'Databento'})),...MARKET_INDEX_DEFINITIONS.map(i=>({symbol:i.symbol,broker:'Market Index'}))];
const observations=[];
test('actual pane formatter and flat domains preserve fractional price-study values',()=>{
 const source=readFileSync('src/components/ChartIndicatorPanes.tsx','utf8');
 const file=ts.createSourceFile('pane.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const functions=file.statements.filter(n=>ts.isFunctionDeclaration(n)&&['compact','formatPaneValue','seriesDomain'].includes(n.name?.text)).map(n=>n.getText(file)).join('\n');
 const sandbox={};vm.createContext(sandbox);vm.runInContext(ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nglobalThis.format=formatPaneValue;globalThis.domain=seriesDomain;',sandbox);
 for(const id of ['standard-deviation','average-true-range-atr']){
  assert.equal(Number(sandbox.format(.00000035,id)),.00000035);
  assert.equal(Number(sandbox.format(.125,id)),.125);
  const domain=sandbox.domain([{key:id,data:[{time:1,value:.00000035}]}]);
  assert.ok(domain.min>0&&domain.max-domain.min<.0000001);
 }
 assert.equal(sandbox.format(1500,'volume'),'1.5K');
});
function oracle(candles,id,length){
 const result=[];let atr;
 const tr=candles.map((c,i)=>Math.max(c.high-c.low,i?Math.abs(c.high-candles[i-1].close):0,i?Math.abs(c.low-candles[i-1].close):0));
 for(let i=length-1;i<candles.length;i++){
  let value;
  if(id==='average-true-range-atr'){atr=i===length-1?tr.slice(0,length).reduce((a,b)=>a+b,0)/length:(atr*(length-1)+tr[i])/length;value=atr;}
  else{const values=candles.slice(i-length+1,i+1).map(c=>c.close);const mean=values.reduce((a,b)=>a+b,0)/length;value=Math.sqrt(values.reduce((n,v)=>n+(v-mean)**2,0)/length);}
  result.push({time:candles[i].timestamp/1000,value});
 }
 return result;
}
for(const instrument of instruments)test(instrument.symbol+' ATR/StdDev: every permitted interval, settings, live continuation and replay',()=>{
 const tick=instrument.broker==='Databento'?futuresTickSize(instrument.symbol):.01;
 const base=instrument.symbol==='6J'?.006:instrument.symbol==='6M'?.05:30000*tick;
 for(const interval of CHART_INTERVAL_OPTIONS){
  if(!supportsChartInterval(interval.id,instrument.broker)){observations.push({...instrument,interval:interval.id,status:'unsupported-source-interval'});continue;}
  // Deliberately irregular timestamps also exercise event-chart input. These
  // are deterministic calculation fixtures, not assertions of live coverage.
  const step=interval.kind==='second'?interval.value*1000:interval.kind==='minute'?interval.value*60000:61000;
  const candles=Array.from({length:65},(_,i)=>({timestamp:1700000000000+i*step+(interval.requiresOrderFlow?i%3:0),open:base+(i%7)*tick,high:base+(8+i%11)*tick,low:base-(2+i%3)*tick,close:base+(i%13)*tick,volume:10}));
  for(const id of ['average-true-range-atr','standard-deviation'])for(const length of [2,14,20,30]){
   const instance={indicatorId:id,instanceId:id,enabled:true,settings:{length}};
   const out=calculateIndicatorSeries(instance,candles,theme,{instrument:instrument.symbol,tickSize:tick});
   const expected=oracle(candles,id,length);
   assert.equal(out[0].data.length,expected.length);
   out[0].data.forEach((p,i)=>{assert.equal(p.time,expected[i].time);assert.ok(Math.abs(p.value-expected[i].value)<=Math.max(1e-12,tick*1e-4),instrument.symbol+' '+interval.id+' '+id+' incorrect value '+p.value+' vs '+expected[i].value);});
   const model=new LiveDeltaPaneModel();model.hydrate(candles.slice(0,55));model.observeSnapshot(candles);
   const group={key:id,indicatorId:id,settings:{length},series:[]};
   assert.deepEqual(model.calculate(group,{candles,theme,instrument:instrument.symbol,tickSize:tick})[0].data,out[0].data);
   const clock=candles[45].timestamp;
   const replay=calculateIndicatorSeries(instance,candles,theme,{replayTimestampMs:clock});
   assert.ok(replay[0].data.every(p=>p.time*1000<=clock));
   assert.deepEqual(replay[0].data,calculateIndicatorSeries(instance,candles.filter(c=>c.timestamp<=clock),theme)[0].data);
  }
  observations.push({...instrument,interval:interval.id,status:'calculation-live-model-replay-pass'});
 }
});
test('long lengths require real warmup; no fabricated pre-window values',()=>{
 for(const id of ['average-true-range-atr','standard-deviation']){
  const candles=Array.from({length:501},(_,i)=>({timestamp:1000+i*1000,open:100,high:102,low:99,close:100,volume:1}));
  assert.equal(calculateIndicatorSeries({indicatorId:id,instanceId:id,enabled:true,settings:{length:500}},candles.slice(0,499),theme)[0].data.length,0);
  const out=calculateIndicatorSeries({indicatorId:id,instanceId:id,enabled:true,settings:{length:500}},candles,theme)[0].data;
  assert.equal(out.length,2);assert.equal(out[0].value,id==='standard-deviation'?0:3);
 }
 mkdirSync('tmp',{recursive:true});writeFileSync('tmp/atr-standard-deviation-matrix.json',JSON.stringify({instruments:instruments.length,intervals:CHART_INTERVAL_OPTIONS.length,observations},null,2));
});

test('ATR line appearance is retained in replay and live model calculations', () => {
  const indicatorId = 'average-true-range-atr';
  const candles = Array.from({ length: 16 }, (_, index) => ({
    timestamp: 1700000000000 + index * 60_000,
    open: 100, high: 102 + index, low: 99, close: 100, volume: 1,
  }));
  const instance = { indicatorId, instanceId: 'atr', enabled: true, settings: { length: 14, lineStyle: 'dotted', lineWidth: 3 } };
  const [defaultPlot] = calculateIndicatorSeries({ ...instance, settings: { length: 14 } }, candles, theme);
  assert.equal(defaultPlot.lineStyle, 'solid');
  assert.equal(defaultPlot.lineWidth, 2);
  const [replayPlot] = calculateIndicatorSeries(instance, candles, theme, { replayTimestampMs: candles[14].timestamp });
  assert.equal(replayPlot.lineStyle, 'dotted');
  assert.equal(replayPlot.lineWidth, 3);
  assert.deepEqual(replayPlot.data, defaultPlot.data.slice(0, 2));

  const model = new LiveDeltaPaneModel();
  model.hydrate(candles);
  const [livePlot] = model.calculate({ key: 'atr', indicatorId, settings: instance.settings, series: [] }, { candles, theme });
  assert.equal(livePlot.lineStyle, 'dotted');
  assert.equal(livePlot.lineWidth, 3);
  assert.deepEqual(livePlot.data, defaultPlot.data);
});
