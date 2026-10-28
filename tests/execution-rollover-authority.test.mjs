import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { executionCandlePaintBatch, mergeHistoricalAndLiveCandleSeries } from '../src/lib/liveCandleAuthority.ts';
import { ObservedCandleHistory } from '../src/lib/observedCandleHistory.ts';
import { applyInstitutionalTradesToCandles } from '../src/lib/institutionalMarketData.ts';

const bar = (timestamp, extra = {}) => ({ timestamp, open:100, high:103, low:98, close:101, volume:10, ...extra });
const print = (timestamp, price) => ({timestamp, open:price, high:price, low:price, close:price, volume:1, trades:1});
const text = fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx', import.meta.url), 'utf8');
const source = ts.createSourceFile('Workspace.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const find = predicate => { let result; const visit = node => { if (predicate(node)) result=node; ts.forEachChild(node,visit); }; visit(source); return result; };

test('actual execution rollover publication retains the final close and wick before the next candle', () => {
  const before = [bar(60000, {sourceEndTimestamp:119800})];
  const records = [print(119900, 115), print(119950, 99), print(120010, 106)];
  const next = applyInstitutionalTradesToCandles(before, records, '1m', 'NQ');
  const scope='NQ:1m:live';
  const oldBuffer=new ObservedCandleHistory();
  oldBuffer.observe(scope,before[0],119800);
  oldBuffer.observe(scope,next.at(-1),120010); // Previous tail-only publication.
  assert.equal(oldBuffer.merge(scope,next)[0].close,101,'negative control reproduces the stale rendered close');
  assert.equal(next[0].close,99,'the execution writer already has the actual final close');
  const buffer=new ObservedCandleHistory();
  buffer.observe(scope,before[0],119800);
  const batch=find(node => ts.isVariableDeclaration(node) && node.name.getText(source)==='paintBatch');
  const publish=find(node => ts.isForOfStatement(node) && node.expression.getText(source)==='paintBatch');
  assert.ok(batch); assert.ok(publish);
  const received=[];
  const ctx=vm.createContext({previousCandles:before,reconciledCandles:next,latest:next.at(-1),pane:{id:scope,timeframe:'1m'},
    document:{visibilityState:'visible'},
    isEventBasedChartInterval:()=>false,executionCandlePaintBatch,LIVE_CHART_CANDLE_EVENT:'candle',
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
    window:{dispatchEvent:event=>{received.push(event.detail);buffer.observe(scope,event.detail.candle,event.detail.sourceTimestampMs);}},
  });
  vm.runInContext(ts.transpileModule(`var ${batch.getText(source)};\n${publish.getText(source)}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  assert.deepEqual(received.map(d=>[d.candle.timestamp,d.sourceTimestampMs]),[[60000,119950],[120000,120010]]);
  for(let i=0;i<20;i++) {
    const painted=buffer.merge(scope,[before[0],next[1]]);
    assert.deepEqual([painted[0].open,painted[0].high,painted[0].low,painted[0].close],[100,115,98,99]);
  }
});

test('one batch crossing several buckets publishes every real bar and works after prefix trimming',()=>{
  const previous=[bar(60000),bar(120000)];
  const next=[bar(120000),bar(180000),bar(240000)];
  assert.deepEqual(executionCandlePaintBatch(previous,next),next);
  assert.deepEqual(executionCandlePaintBatch(next,[...next.slice(0,-1),bar(240000,{close:102})]).map(b=>b.timestamp),[240000]);
  assert.deepEqual(executionCandlePaintBatch(previous,[]),[]);
});

test('the execution writer establishes live authority without depending on quote arrival',()=>{
  const loop=find(node=>ts.isForOfStatement(node)&&node.expression.getText(source)==='records'
    &&node.statement.getText(source).includes('liveTailStartTimestampRef.current'));
  assert.ok(loop);
  const ctx=vm.createContext({records:[print(120010,101),print(120005,100)],liveTailStartTimestampRef:{current:null}});
  const code=ts.transpileModule(loop.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInContext(code,ctx);
  assert.equal(ctx.liveTailStartTimestampRef.current,120005);
  ctx.records=[print(180000,102),print(NaN,100)];
  vm.runInContext(code,ctx);
  assert.equal(ctx.liveTailStartTimestampRef.current,120005);
});

test('recorded NQ prints reproduce archived OHLC through the renderer across batch sizes and stale refreshes',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/nq-executions-20261026-open.json',import.meta.url),'utf8'));
  for(const size of [1,2,7,32,120,349]) {
    const buffer=new ObservedCandleHistory();
    let held=[];
    for(let i=0;i<fixture.records.length;i+=size) {
      const next=applyInstitutionalTradesToCandles(held,fixture.records.slice(i,i+size),'1m','NQ');
      for(const candle of executionCandlePaintBatch(held,next)) buffer.observe('recorded',candle,candle.sourceEndTimestamp);
      held=next;
      // Exercise full redraws with an older close/wick, not merely aggregation.
      buffer.merge('recorded',held.map(c=>({...c,high:Math.max(c.open,c.close),low:Math.min(c.open,c.close)})));
    }
    const rendered=buffer.merge('recorded',held);
    assert.deepEqual(rendered.map(b=>[b.timestamp,b.open,b.high,b.low,b.close,b.volume]),fixture.bars.map(b=>b.slice(0,6)),`batch ${size}`);
  }
});

test('actual recovery expression retains observed bodies/wicks while backfilling a missing historical candle',()=>{
  const fn=find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='mergeHistoricalWithLiveTail');
  const call=find(node=>ts.isCallExpression(node)&&node.expression.getText(source)==='mergeHistoricalWithLiveTail'
    && node.arguments[0]?.getText(source).includes('historical)'));
  assert.ok(fn); assert.ok(call,'recovery must use the live-authority merge');
  const now=Date.now(); const start=Math.floor(now/60000)*60000-180000;
  const live=[bar(start),bar(start+120000,{open:108,high:117,low:105,close:111}),bar(start+180000)];
  const historical=[bar(start),bar(start+60000),bar(start+120000,{open:90,high:100,low:89,close:91})];
  const ctx=vm.createContext({latestCandlesRef:{current:live},liveTailStartTimestampRef:{current:start+1},pane:{timeframe:'1m'},historical,seam:[],
    mergeChartHistory:(a,b)=>[...new Map([...a,...b].map(c=>[c.timestamp,c])).values()].sort((a,b)=>a.timestamp-b.timestamp),
    isEventBasedChartInterval:()=>false,mergeHistoricalAndLiveCandleSeries,
    getTimeframeBucketStart:timestamp=>Math.floor(timestamp/60000)*60000,
  });
  vm.runInContext(ts.transpileModule(`${fn.getText(source)}\nvar result=${call.getText(source)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  assert.equal(ctx.result.length,4);
  assert.deepEqual([ctx.result[2].open,ctx.result[2].high,ctx.result[2].low,ctx.result[2].close],[108,117,89,111]);
});
