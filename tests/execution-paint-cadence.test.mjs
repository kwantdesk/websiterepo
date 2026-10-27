import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as tape from '../src/lib/executionTape.ts';
import * as continuity from '../src/lib/executionStreamContinuity.ts';
import {futuresVenue} from '../src/lib/futuresVenue.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createExecutionPaintScheduler} from '../src/lib/executionPaintScheduler.ts';
function harness(){let visible=true,id=0;const frames=new Map(),timers=new Map();const batches=[];let pending=[];
 const scheduler=createExecutionPaintScheduler(()=>{batches.push(pending);pending=[];},{visible:()=>visible,requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:id=>frames.delete(id),delay:(fn,ms)=>{assert.equal(ms,750);timers.set(++id,fn);return id;},cancelDelay:id=>timers.delete(id)});
 return {scheduler,frames,timers,batches,enqueue:value=>{pending.push(value);scheduler.schedule();},visible:value=>{visible=value;scheduler.visibilityChanged();},paint:()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());}};
}
test('every visible ES/NQ/gold pane flushes at the next frame without a selection throttle',()=>{
 for(const symbol of ['ES','NQ','GC']){const h=harness();for(let i=0;i<200;i++)h.enqueue({symbol,sequence:i});assert.equal(h.frames.size,1);assert.equal(h.timers.size,0);h.paint();assert.equal(h.batches[0].length,200);assert.equal(h.batches[0][199].sequence,199);h.enqueue({symbol,sequence:200});h.paint();assert.equal(h.batches.length,2);}
});
test('hidden batches resume on the next frame without losing executions or duplicate flushes',()=>{
 const h=harness();h.visible(false);h.enqueue(1);h.enqueue(2);assert.equal(h.timers.size,1);h.visible(true);assert.equal(h.timers.size,0);assert.equal(h.frames.size,1);h.paint();assert.deepEqual(h.batches,[[1,2]]);h.visible(false);h.enqueue(3);h.scheduler.cancel();assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
});

test('actual execution worker engine publishes at 8ms with ordered lossless deduplication',async()=>{
 const source=fs.readFileSync(new URL('../src/lib/executionTapeEngine.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 let stream,id=0;const timers=new Map(),batches=[];
 class Source {listeners=new Map();constructor(){stream=this;}addEventListener(type,fn){this.listeners.set(type,fn);}close(){}emit(type,payload){this.listeners.get(type)?.({data:JSON.stringify(payload)});}}
 const exports={};vm.runInNewContext(js,{exports,require:name=>name.includes('executionTape')?tape:name.includes('executionStreamContinuity')?continuity:{futuresVenue},EventSource:Source,fetch:async()=>({ok:true,json:async()=>({url:"https://feed.kwantdesk.com/browser-stream?ticket=test",expiresAt:Date.now()+300000,transport:"direct-vps"})}),AbortSignal:{timeout:()=>undefined},URL,URLSearchParams,Date,setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>++id,clearInterval:()=>{}});
 const engine=exports.createExecutionTapeEngine('NQ','NQZ6',{onSeed:()=>{},onTrades:rows=>batches.push(rows),onStatus:()=>{},onContinuity:()=>{}});engine.start();await new Promise(resolve=>setImmediate(resolve));
 stream.emit('seed',{streamId:'test',batchSequence:0,continuity:'continuous',records:[]});
 for(let i=1;i<=100;i++)stream.emit('trades',{streamId:'test',batchSequence:i,continuity:'continuous',records:[{eventId:String(i),recordIndex:i,timestamp:Date.now()+i,open:20000,high:20000,low:20000,close:20000,volume:1,askVolume:1,trades:1,aggressor:'BUY'}]});
 const timer=[...timers.values()].find(item=>item.ms===8);assert.ok(timer,'worker must not add the old 40ms batching delay');timer.fn();assert.equal(batches.length,1);assert.equal(batches[0].length,100);assert.equal(batches[0][99].eventId,'100');engine.stop();
});
