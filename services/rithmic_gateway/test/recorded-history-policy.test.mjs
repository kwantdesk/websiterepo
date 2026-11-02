import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import{join}from'node:path';import{tmpdir}from'node:os';import{gzipSync}from'node:zlib';
import {FuturesBarArchive} from '../src/futures-bar-archive.mjs';import{sessionTradeFiles}from'../src/trade-tape-archive.mjs';
import{RecordedCashHistory}from'../src/recorded-cash-history.mjs';import{rebuildRecordedHistory}from'../scripts/rebuild-recorded-history.mjs';
const t=Date.parse('2026-10-27T14:30:00Z'),day='2026-10-26';
test('imported provider bars never replace, fill or block captured live candles',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-history-'));try{
  await mkdir(join(dir,'bars',day),{recursive:true});
  for(const symbol of ['NQ','NQZ6'])await writeFile(join(dir,'bars',day,'CME-'+symbol+'.json'),JSON.stringify({source:'Rithmic History Plant minute bars',markerConvention:'bar-open',completedSession:true,bars:[[t,999,999,999,999,999],[t+60000,998,998,998,998,998]]}));
  const a=new FuturesBarArchive({dir});a.record({exchange:'CME',symbol:'NQZ6',payload:{ssboe:t/1000,tradePrice:100,tradeSize:2}});await a.flush();
  const result=await a.load({exchange:'CME',symbol:'NQZ6',interval:'1m',fromMs:t,toMs:t+120000});
  assert.deepEqual(result.candles,[{timestamp:t,open:100,high:100,low:100,close:100,volume:2}]);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('execution reads exclude historical-provider sidecars even if they exist',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-tape-'));try{await mkdir(join(dir,day));for(const n of ['CME-NQZ6.trades.ndjson.gz','CME-NQZ6.trades.backfill.ndjson.gz','CME-NQZ6.trades.history.ndjson.gz'])await writeFile(join(dir,day,n),'fixture');const files=sessionTradeFiles(dir,day,'CME','NQZ6');assert.equal(files.length,2);assert.ok(files.every(f=>!f.includes('.history.')))}finally{await rm(dir,{recursive:true,force:true})}
});
test('missing candle history is recovered from recorded executions without any network',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-recovery-'));const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('History must not make network requests')};try{
  await mkdir(join(dir,'trades',day),{recursive:true});await writeFile(join(dir,'trades',day,'CME-NQZ6.trades.ndjson.gz'),gzipSync([[t,100,2,1],[t+1000,102,3,-1]].map(JSON.stringify).join('\n')+'\n'));
  await rebuildRecordedHistory({dir,days:3,now:t+86400000,apply:true});const stored=JSON.parse(await readFile(join(dir,'bars',day,'CME-NQZ6.json'),'utf8'));assert.equal(stored.source,'VPS recorded live trades');assert.deepEqual(stored.bars[0].slice(0,6),[t,100,102,100,102,5]);
 }finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true})}
});
test('live cash observations survive restart and provide history without inventing volume',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-cash-'));try{const a=new RecordedCashHistory({dir});a.record({symbol:'META',timestamp:t,lastPrice:100,marketOpen:true},t);a.record({symbol:'META',timestamp:t+1000,lastPrice:103,marketOpen:true},t+1000);await a.close();const restored=new RecordedCashHistory({dir});const x=await restored.load({symbol:'META',from:t,to:t+60000});assert.deepEqual(x.candles,[{timestamp:t,open:100,high:103,low:100,close:103,volume:0}]);assert.equal(x.recordedOnly,true);await restored.close()}finally{await rm(dir,{recursive:true,force:true})}
});
test('old closing quotes and legacy downloaded cash sessions cannot become recorded history',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-cash-empty-'));try{await mkdir(join(dir,'cash-index','2026-10-27'),{recursive:true});await writeFile(join(dir,'cash-index','2026-10-27','META.json'),JSON.stringify({complete:true,candles:[{timestamp:t,open:999,high:999,low:999,close:999}]}));const a=new RecordedCashHistory({dir});a.record({symbol:'META',timestamp:t,lastPrice:999,marketOpen:false},t);a.record({symbol:'META',timestamp:t+60000,lastPrice:999,marketOpen:false},t+60000);assert.equal((await a.load({symbol:'META',from:t,to:t+120000})).candles.length,0);await a.close()}finally{await rm(dir,{recursive:true,force:true})}
});
test('cash recovery folds saved live responses and ignores old-session historical downloads',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-cash-recovery-'));try{
  await mkdir(join(dir,'exposure',day),{recursive:true});
  const frames=[{ts:t,path:'/v1/equities/tool/market-map',payload:{data:{META:{currentValue:100}}}},{ts:t+1000,path:'/v1/equities/tool/market-map',payload:{data:{META:{currentValue:103}}}}];
  await writeFile(join(dir,'exposure',day,'equities-tool-market-map.ndjson.gz'),gzipSync(frames.map(JSON.stringify).join('\n')+'\n'));
  await rebuildRecordedHistory({dir,days:4,now:t+2*86400000,apply:true});
  const archive=new RecordedCashHistory({dir});assert.equal((await archive.load({symbol:'META',from:t,to:t+60000})).candles[0].close,103);await archive.close();
 }finally{await rm(dir,{recursive:true,force:true})}
});
