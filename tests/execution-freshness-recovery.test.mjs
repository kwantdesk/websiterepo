import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createExecutionFreshnessGuard} from '../src/lib/executionFreshness.ts';
import * as tape from '../src/lib/executionTape.ts';
import * as continuity from '../src/lib/executionStreamContinuity.ts';
import {futuresVenue} from '../src/lib/futuresVenue.ts';
import {createWorkerTradeBackpressure} from '../src/lib/workerTradeBackpressure.ts';

function clock() {
  let now=1_000_000,id=0;const timers=new Map();
  return {now:()=>now,timers,schedule:(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;},cancel:id=>timers.delete(id),
    advance(ms){const end=now+ms;for(;;){const first=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();}now=end;}};
}

test('a confirmed missing execution triggers recovery despite a healthy heartbeat; normal delivery wins the grace period',()=>{
  const c=clock();let latest=c.now(),recoveries=0;
  const guard=createExecutionFreshnessGuard({...c,latestExecution:()=>latest,recover:()=>recoveries++});
  c.advance(10);guard.witness(c.now());c.advance(500);latest=c.now();c.advance(500);assert.equal(recoveries,0);
  c.advance(10);guard.witness(c.now());c.advance(1000);assert.equal(recoveries,1);
  guard.witness(c.now());c.advance(1000);assert.equal(recoveries,1,'one recovery at most per cooldown');
  c.advance(14000);assert.equal(recoveries,2,'a later confirmed missing print gets a trailing recovery even if the market then goes quiet');
  guard.dispose();
});

test('unknown, stale and future clocks cannot manufacture recovery evidence; disposal cancels its timer',()=>{
  const c=clock();let recovered=0;
  const guard=createExecutionFreshnessGuard({...c,latestExecution:()=>0,recover:()=>recovered++});
  for(const value of [NaN,0,c.now()-5001,c.now()+1001])guard.witness(value);
  assert.equal(c.timers.size,0);
  guard.witness(c.now());assert.equal(c.timers.size,1);guard.dispose();c.advance(10000);assert.equal(recovered,0);
});

test('actual shared worker wiring ignores book/cached/other-contract observations and refreshes the existing execution engine',async()=>{
  const c=clock(),before={window:globalThis.window,Worker:globalThis.Worker,now:Date.now};let worker;
  class FakeWorker {
    callbacks=new Map();sent=[];constructor(){worker=this;}
    addEventListener(name,fn){this.callbacks.set(name,fn);}postMessage(message){this.sent.push(message);}
    emit(message){this.callbacks.get('message')({data:message,currentTarget:this});}
  }
  globalThis.window={setTimeout:c.schedule,clearTimeout:c.cancel};globalThis.Worker=FakeWorker;Date.now=c.now;
  let unsubscribe;
  try {
    const {subscribeRithmicIndicatorTrades,witnessRithmicExecution}=await import('../src/lib/rithmicIndicatorStream.ts');
    let repairs=0;unsubscribe=subscribeRithmicIndicatorTrades({symbol:'NQ',contractSymbol:'NQZ6',onTrades(){},onRecovery(){repairs++;}});
    const key='NQ:NQZ6';
    worker.emit({type:'seed',key,records:[{timestamp:c.now(),close:100}]});worker.emit({type:'status',key,status:'connected'});
    c.advance(10);
    for(const flags of [{isTrade:false},{isTrade:true,cached:true},{isTrade:true,contractSymbol:'NQU6'}])
      witnessRithmicExecution({symbol:'NQ',contractSymbol:'NQZ6',timestamp:c.now(),...flags});
    c.advance(1100);assert.equal(repairs,0);
    witnessRithmicExecution({symbol:'NQ',contractSymbol:'NQZ6',timestamp:c.now(),isTrade:true});
    worker.emit({type:'trades',key,records:[{timestamp:c.now(),open:100,high:100,low:100,close:100,volume:1,trades:1,delta:0}]});
    c.advance(1000);assert.equal(repairs,0,'an independently witnessed print delivered during the grace period does not reset the stream');
    c.advance(10);witnessRithmicExecution({symbol:'NQ',contractSymbol:'NQZ6',timestamp:c.now(),isTrade:true});
    c.advance(1000);assert.equal(repairs,1);
    assert.equal(worker.sent.filter(m=>m.type==='subscribe').length,1);
    assert.deepEqual(worker.sent.find(m=>m.type==='reconnect'),{type:'reconnect',key});
  }finally{unsubscribe?.();Date.now=before.now;if(before.window===undefined)delete globalThis.window;else globalThis.window=before.window;if(before.Worker===undefined)delete globalThis.Worker;else globalThis.Worker=before.Worker;}
});

test('the actual worker reconnect command preserves pending lossless batches and the existing engine',()=>{
  let receive,handlers,created=0,reconnected=0;const sent=[];
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/marketTape.worker.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
    {exports,require:name=>name.includes('workerTradeBackpressure')?{createWorkerTradeBackpressure}:{createExecutionTapeEngine:(_s,_c,h)=>{created++;handlers=h;return {start(){},stop(){},reconnect(){reconnected++;}};}},
      self:{addEventListener:(_name,fn)=>receive=fn,postMessage:message=>sent.push(message)}});
  const send=data=>receive({data});
  send({type:'subscribe',key:'NQ:NQZ6',symbol:'NQ',contractSymbol:'NQZ6'});
  handlers.onTrades([{id:1}]);handlers.onTrades([{id:2}]);
  send({type:'reconnect',key:'NQ:NQZ6'});assert.equal(reconnected,1);assert.equal(created,1);
  send({type:'ack',key:'NQ:NQZ6'});
  assert.deepEqual(sent.filter(row=>row.type==='trades').flatMap(row=>row.records.map(r=>r.id)),[1,2]);
});

test('actual engine times out a missing seed even while heartbeats keep arriving',async()=>{
  const c=clock(),sources=[],intervals=[];let fetches=0;
  class Source {handlers=new Map();closed=false;constructor(){sources.push(this);}addEventListener(n,f){this.handlers.set(n,f);}close(){this.closed=true;}emit(n,p={}){this.handlers.get(n)?.({data:JSON.stringify(p)});}}
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/executionTapeEngine.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
    {exports,require:name=>name.includes('executionTape')?tape:name.includes('executionStreamContinuity')?continuity:{futuresVenue},Date:{now:c.now},URL,URLSearchParams,AbortSignal,EventSource:Source,
      fetch:async()=>{fetches++;return {ok:true,json:async()=>({url:'https://feed.kwantdesk.com/browser-stream?ticket=fixture',transport:'direct-vps',expiresAt:c.now()+300000})};},
      setTimeout:c.schedule,clearTimeout:c.cancel,setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){}});
  const engine=exports.createExecutionTapeEngine('NQ','NQZ6',{onSeed(){},onTrades(){},onStatus(){},onContinuity(){}});
  try{
    engine.start();await new Promise(setImmediate);sources[0].emit('heartbeat');c.advance(6000);sources[0].emit('heartbeat');intervals[0]();
    assert.equal(sources[0].closed,true,'heartbeat activity cannot mask an absent seed');
    c.advance(250);await new Promise(setImmediate);assert.equal(fetches,2);
    sources[1].emit('seed',{streamId:'fresh',batchSequence:0,continuity:'continuous',records:[]});c.advance(6000);sources[1].emit('heartbeat');intervals.at(-1)();
    assert.equal(sources[1].closed,false,'a genuinely quiet seeded market remains connected');
  }finally{engine.stop();}
});
