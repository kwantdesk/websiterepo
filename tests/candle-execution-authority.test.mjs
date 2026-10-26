import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { recordDatabentoLiveTick, readDatabentoLiveTail } from '../src/lib/chartLiveEvents.ts';
import { ObservedCandleHistory } from '../src/lib/observedCandleHistory.ts';
import { applyInstitutionalTradesToCandles } from '../src/lib/institutionalMarketData.ts';
import { recordDatabentoLiveExecutions } from '../src/lib/chartLiveEvents.ts';

test('book midpoints, unclassified quotes and cached quotes cannot create execution candles', () => {
  const instrument = 'EXECUTION_AUTHORITY_TEST';
  const timestamp = Date.now();
  for (const flags of [{isTrade:false}, {}, {isTrade:true,cached:true}]) {
    recordDatabentoLiveTick({instrument, timestamp, mid:999, ...flags});
  }
  assert.deepEqual(readDatabentoLiveTail(instrument), []);
  recordDatabentoLiveTick({instrument, timestamp, mid:100, isTrade:true, size:1});
  assert.equal(readDatabentoLiveTail(instrument).at(-1).high, 100);
});

test('closing-bar paint uses observations received after React prepared its render', () => {
  const sourceText = fs.readFileSync(new URL('../src/components/Chart.tsx', import.meta.url), 'utf8');
  const source = ts.createSourceFile('Chart.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let closing;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'closing' && node.initializer?.getText(source).includes('seriesCandles')) closing=node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(closing, 'exercise the actual rollover paint expression');
  const scope='test:NQ:1m:live';
  const first={timestamp:60000,open:100,high:103,low:99,close:102};
  const next={timestamp:120000,open:105,high:105,low:105,close:105};
  const buffer=new ObservedCandleHistory();
  buffer.observe(scope,first,61000);
  const stale=buffer.merge(scope,[first,next]);
  buffer.observe(scope,{...first,high:112,low:95,close:108},119999);
  buffer.observe(scope,next,120001);
  const ctx=vm.createContext({seriesCandles:stale,observedCandleHistoryRef:{current:buffer},observedCandleScope:scope});
  const js=ts.transpileModule('var '+closing.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInContext(js,ctx);
  assert.deepEqual([ctx.closing.open,ctx.closing.high,ctx.closing.low,ctx.closing.close],[100,112,95,108]);
});

test('late executions extend true extrema without rewinding the current close', () => {
  const trade=(timestamp,price)=>({timestamp,open:price,high:price,low:price,close:price,volume:1,trades:1,delta:0});
  let bars=applyInstitutionalTradesToCandles([], [trade(61000,100),trade(63000,105)], '1m','NQ');
  bars=applyInstitutionalTradesToCandles(bars,[trade(62000,90)],'1m','NQ');
  assert.deepEqual([bars[0].open,bars[0].high,bars[0].low,bars[0].close],[100,105,90,105]);
});

test('349 recorded NQ opening executions reproduce the VPS archive under every batch partition', () => {
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/nq-executions-20261026-open.json',import.meta.url),'utf8'));
  const expected=fixture.bars.map(b=>b.slice(0,6));
  assert.equal(fixture.records.length,349);
  for(const batchSize of [1,2,7,32,120,349]) {
    let bars=[];
    for(let i=0;i<fixture.records.length;i+=batchSize) bars=applyInstitutionalTradesToCandles(bars,fixture.records.slice(i,i+batchSize),'1m','NQ');
    assert.deepEqual(bars.map(b=>[b.timestamp,b.open,b.high,b.low,b.close,b.volume]),expected,`batch size ${batchSize}`);
  }
  // The source really did jump between minutes. Do not force a previous-close
  // open, manufacture intervening executions or erase a legitimate price gap.
  assert.notEqual(expected[0][4],expected[1][1]);
});

test('the live startup cache retains every exact print, including an intrabatch wick', () => {
  const instrument='LOSSLESS_CACHE_TEST';
  const timestamp=Math.floor(Date.now()/1000)*1000;
  recordDatabentoLiveExecutions(instrument,[100,115,90,102].map((price,i)=>({
    timestamp:timestamp+i,open:price,high:price,low:price,close:price,volume:1,trades:1,delta:0,
  })));
  const b=readDatabentoLiveTail(instrument).at(-1);
  assert.deepEqual([b.open,b.high,b.low,b.close,b.volume],[100,115,90,102,4]);
});

test('plain CME charts subscribe to exact executions even without an indicator', () => {
  const text=fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
  const source=ts.createSourceFile('Workspace.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let gate;
  const visit=node=>{
    if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='requiresExecutionStream')gate=node.initializer.getText(source);
    ts.forEachChild(node,visit);
  };visit(source);
  for(const timeframe of ['1m','3m','5m']) {
    const enabled=vm.runInNewContext(gate,{pane:{broker:'Databento',timeframe},needsOrderFlowHistory:false,needsLiveVolumeProfiles:false,isEventBasedChartInterval:()=>false});
    assert.equal(enabled,true);
  }
  assert.equal(text.includes('recordDatabentoLiveTick('),false,'watchlist/HTTP quotes never repopulate the execution cache');
});

test('two chart subscribers share one stream and populate the execution cache once', async () => {
  const originalWindow=globalThis.window, originalWorker=globalThis.Worker;
  let worker, creations=0;
  class FakeWorker {
    listeners=new Map();
    constructor(){worker=this;creations++;}
    addEventListener(type,fn){this.listeners.set(type,fn);}
    postMessage(){}
    emit(message){this.listeners.get('message')({data:message,currentTarget:this});}
  }
  globalThis.window={}; globalThis.Worker=FakeWorker;
  try {
    const {subscribeRithmicIndicatorTrades}=await import('../src/lib/rithmicIndicatorStream.ts');
    let deliveries=0;
    const args={symbol:'CACHE_FANOUT_TEST',contractSymbol:'CACHE_FANOUT_Z6',onTrades:()=>deliveries++};
    const unsubscribeA=subscribeRithmicIndicatorTrades(args),unsubscribeB=subscribeRithmicIndicatorTrades(args);
    const timestamp=Date.now();
    worker.emit({type:'trades',key:'CACHE_FANOUT_TEST:CACHE_FANOUT_Z6',records:[{
      timestamp,open:100,high:100,low:100,close:100,volume:7,trades:1,delta:7,
    }]});
    assert.equal(creations,1);
    assert.equal(deliveries,2);
    assert.equal(readDatabentoLiveTail(args.symbol).at(-1).volume,7);
    unsubscribeA();unsubscribeB();
  } finally {
    if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
    if(originalWorker===undefined)delete globalThis.Worker;else globalThis.Worker=originalWorker;
  }
});
