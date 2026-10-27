import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { healClosedCandleIntegrity } from '../src/lib/institutionalMarketData.ts';

const bar=(timestamp,overrides={})=>({timestamp,open:100,high:112,low:95,close:108,volume:10,...overrides});

test('a deferred React commit cannot roll the futures execution writer back to an older candle array',()=>{
  const text=fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
  const source=ts.createSourceFile('Workspace.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let effect;
  const visit=node=>{
    if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('latestMarketIndexFrameRef.current === null'))effect=node.arguments[0];
    ts.forEachChild(node,visit);
  };visit(source);assert.ok(effect);
  const latest=[bar(60000),bar(120000,{open:109,high:114,close:113})];
  for(const broker of ['Databento','OANDA']){
    const ctx=vm.createContext({pane:{broker},candles:[bar(60000,{high:103,close:102})],
      latestCandlesRef:{current:latest},latestMarketIndexFrameRef:{current:null},latestFuturesRef:{current:{asOfMs:Infinity}}});
    vm.runInContext(ts.transpileModule(`(${effect.getText(source)})();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
    if(broker==='Databento')assert.equal(ctx.latestCandlesRef.current,latest,'preserve both newer executions and the rollover');
    else assert.equal(ctx.latestCandlesRef.current,ctx.candles,'other adapters retain their React-driven fallback');
  }
});

test('routine history snapshots backfill real missing bars without replacing closed bodies or wicks',()=>{
  const held=[bar(60000),bar(180000)];
  const partial=[bar(60000,{open:97,high:105,low:96,close:99}),bar(120000),bar(180000,{high:109,close:107})];
  const result=healClosedCandleIntegrity(held,partial,240000,false,'backfill-only');
  assert.equal(result.length,3);
  assert.deepEqual(result[0],held[0]);assert.deepEqual(result[2],held[1]);
  assert.equal(result[1].timestamp,120000);
});

test('routine flow repair changes flow fields without changing any OHLC geometry',()=>{
  const held=[bar(60000,{askVolume:5,bidVolume:5,delta:0})];
  const baked=[bar(60000,{open:90,high:91,low:85,close:86,askVolume:100,bidVolume:10,delta:90})];
  const result=healClosedCandleIntegrity(held,baked,120000,true,'backfill-only');
  assert.deepEqual([result[0].open,result[0].high,result[0].low,result[0].close],[100,112,95,108]);
  assert.equal(result[0].delta,90);
});

test('the actual background heal wiring preserves closed OHLC across twenty conflicting cached snapshots',async()=>{
  const text=fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
  const source=ts.createSourceFile('Workspace.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let declaration;
  const visit=node=>{
    if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='heal'&&node.initializer?.getText(source).includes('healClosedCandleIntegrity'))declaration=node;
    ts.forEachChild(node,visit);
  };visit(source);assert.ok(declaration);
  const initial=bar(60000,{askVolume:5,bidVolume:5,delta:0});
  const events=[];
  const ctx=vm.createContext({healing:false,cancelled:false,pane:{id:'NQ:1m',symbol:'NQ',timeframe:'1m',broker:'Databento'},period:'5d',needsOrderFlowHistory:true,
    controller:{signal:null},latestCandlesRef:{current:[initial]},timeframeDurationMs:()=>60000,
    healClosedCandleIntegrity,fetchWorkspaceCandles:async()=>ctx.downloaded,hasUsableOrderFlowHistory:()=>true,
    setOrderFlowHistoryReady:()=>{},startTransition:fn=>fn(),setCandles:()=>{},writeChartHistoryCache:async()=>{},
    window:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  });
  vm.runInContext(ts.transpileModule('var '+declaration.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  for(let i=0;i<20;i++){
    ctx.downloaded=[bar(60000,{open:80+i,high:200+i,low:70,close:90,askVolume:100,bidVolume:10,delta:90}),bar(120000)];
    await ctx.heal();
    const b=ctx.latestCandlesRef.current[0];
    assert.deepEqual([b.open,b.high,b.low,b.close],[100,112,95,108]);
    assert.equal(ctx.latestCandlesRef.current.length,2);
  }
  assert.equal(events.length,0,'routine flow/backfill must not bypass observation protection as a verified price correction');
});
