import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
import {CHART_INTERVAL_OPTIONS,MAX_CHART_HISTORY_BARS,parseChartIntervalInput,supportsChartInterval} from '../src/lib/chartIntervals.ts';
import {applyMarketTradesToEventBars,futuresTickSize} from '../src/lib/eventBars.ts';
import {createEventBarBuilder,buildEventBars} from '../services/rithmic_gateway/src/event-bar-builder.mjs';
import {resampleBars,parseIntervalMs} from '../services/rithmic_gateway/src/futures-bar-archive.mjs';
import {chartTimeBucketStartMs} from '../services/rithmic_gateway/src/chart-time-bucket.mjs';
import {MARKET_INDEX_DEFINITIONS} from '../src/lib/marketIndices.ts';
function literal(path,name){const text=readFileSync(path,'utf8'),file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);let value;function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(file)===name)value=Function('return ('+n.initializer.getText(file)+')')();ts.forEachChild(n,walk)}walk(file);return value}
const futures=literal('src/lib/databento.ts','DATABENTO_FUTURES').map(r=>({...r,root:r.symbol.split('.')[0]}));
const events=CHART_INTERVAL_OPTIONS.filter(r=>!['second','minute','time'].includes(r.kind)),times=CHART_INTERVAL_OPTIONS.filter(r=>['second','minute','time'].includes(r.kind));
const outcomes=[];mkdirSync('tmp',{recursive:true});writeFileSync('tmp/chart-interval-audit-catalog.json',JSON.stringify({futures,intervals:CHART_INTERVAL_OPTIONS,indices:MARKET_INDEX_DEFINITIONS},null,2));
for(const instrument of futures)test(instrument.root+' / every preset: history equals live continuation, exact flow and instrument ticks',()=>{
 const tick=futuresTickSize(instrument.symbol),base=Math.max(Math.round(100/tick)*tick,1000*tick),T=Date.parse('2026-10-26T13:30:00Z');
 const tape=Array.from({length:256},(_,i)=>({timestamp:T+Math.floor(i/3)*31,price:Math.round((base/tick+((i*17)%151)-75))*tick,size:1+(i*19)%280,trades:1,delta:i%4===0?0:(i%2?1:-1)*(1+(i*19)%280)}));
 for(const {id}of events){
  const expected=buildEventBars(tape,id,instrument.symbol);let live=[];
  for(let i=0;i<tape.length;i+=7)live=applyMarketTradesToEventBars(live,tape.slice(i,i+7),id,instrument.symbol);
  assert.deepEqual(live,expected,instrument.root+' '+id+' history/live drift');
  assert.equal(expected.reduce((n,b)=>n+b.volume,0),tape.reduce((n,t)=>n+t.size,0),id+' duplicated/lost executions');
  for(const b of expected){assert.ok(b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close),id+' invalid OHLC');assert.ok(b.sourceStartTimestamp<=b.sourceEndTimestamp);}
  outcomes.push({instrument:instrument.root,interval:id,kind:'execution',historyLiveParity:true,flowConserved:true});
 }
 for(const {id}of times){
  const rows=tape.map(t=>({t:t.timestamp,o:t.price,h:t.price,l:t.price,c:t.price,v:t.size})),duration=parseIntervalMs(id);
  if(duration>60000){const aggregate=resampleBars(rows,duration,id);assert.equal(aggregate.reduce((n,b)=>n+b.v,0),tape.reduce((n,t)=>n+t.size,0));assert.ok(aggregate.every(b=>b.t===chartTimeBucketStartMs(b.t,id)));}
  assert.ok(supportsChartInterval(id,'Databento'));
  outcomes.push({instrument:instrument.root,interval:id,kind:'time',bucketRouting:true});
 }
});
test('live event continuation preserves more than 5,000 loaded bars',()=>{const t=Date.parse('2026-10-26T13:30:00Z');const rows=Array.from({length:6001},(_,i)=>({timestamp:t+i,price:100+i%2*.25,size:1,trades:1,delta:1}));const before=buildEventBars(rows,'1t','NQ');const after=applyMarketTradesToEventBars(before,[{...rows.at(-1),timestamp:t+7000}],'1t','NQ');assert.equal(after.length,6002);assert.deepEqual(after[0],before[0]);assert.equal(MAX_CHART_HISTORY_BARS,500000)});
test('Renko capital R stays Renko, lowercase range remains range',()=>{assert.equal(parseChartIntervalInput('4R'),'4R');assert.equal(parseChartIntervalInput('4r'),'4r');assert.equal(parseChartIntervalInput('4 renko'),'4R')});
test('fractional tick Renko closes on its exact threshold',()=>{for(const root of ['GC','RTY','6J','6M','NG','HG','ZL']){const tick=futuresTickSize(root),price=Math.round(100/tick)*tick;const rows=[{timestamp:1000,price,size:1},{timestamp:2000,price:price+4*tick,size:1}];assert.equal(buildEventBars(rows,'4R',root).length,2,root)}});
test('calendar aggregation and live bucket share CME day, Sunday week, month and DST boundaries',()=>{const sunday=Date.parse('2026-11-01T23:01:00Z'),monday=Date.parse('2026-11-02T23:01:00Z');assert.equal(chartTimeBucketStartMs(sunday,'1W'),chartTimeBucketStartMs(monday,'1W'));assert.equal(chartTimeBucketStartMs(sunday,'1D'),Date.parse('2026-11-01T23:00:00Z'));assert.equal(chartTimeBucketStartMs(Date.parse('2026-11-30T23:01:00Z'),'1M'),Date.parse('2026-11-30T23:00:00Z'));assert.equal(chartTimeBucketStartMs(Date.parse('2026-03-08T22:01:00Z'),'1D'),Date.parse('2026-03-08T22:00:00Z'))});
test('every non-futures instrument has an explicit capability outcome for every preset',()=>{for(const row of MARKET_INDEX_DEFINITIONS)for(const interval of CHART_INTERVAL_OPTIONS)outcomes.push({instrument:row.symbol,interval:interval.id,broker:'Market Index',supported:supportsChartInterval(interval.id,'Market Index'),reason:supportsChartInterval(interval.id,'Market Index')?'captured quote candles':'exact execution/second feed is not provided by this quote source'});writeFileSync('tmp/chart-interval-engine-matrix.json',JSON.stringify({futures:futures.length,indices:MARKET_INDEX_DEFINITIONS.length,intervals:CHART_INTERVAL_OPTIONS.length,rows:outcomes},null,2));assert.equal(outcomes.length,(futures.length+MARKET_INDEX_DEFINITIONS.length)*CHART_INTERVAL_OPTIONS.length)});
