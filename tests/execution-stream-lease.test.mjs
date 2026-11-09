import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {signBrowserStreamTicket} from '../src/lib/browserStreamTicket.ts';
import {verifyBrowserStreamTicket} from '../services/rithmic_gateway/src/browser-stream-edge.mjs';
import {requestExecutionStreamLease} from '../src/lib/executionTapeEngine.ts';
import * as tape from '../src/lib/executionTape.ts';import * as continuity from '../src/lib/executionStreamContinuity.ts';import {futuresVenue} from '../src/lib/futuresVenue.ts';
const origin='https://www.kwantdesk.com',key='lease-test-only';
const compile=path=>ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function issuer(){const exports={};vm.runInNewContext(compile('../src/lib/executionStreamLease.server.ts'),{exports,require:name=>name==='server-only'?{}:name.includes('GatewayEnv')?{marketDataGatewayToken:()=>key,marketDataGatewayUrlCandidatesForPath:()=>['https://feed.kwantdesk.com']}:{signBrowserStreamTicket},URL,URLSearchParams,Response,Date});return exports.executionStreamLeaseResponse;}

test('history negotiation signs the selected clock and immutable generation for its isolated VPS route',async()=>{
 const response=issuer()(new Request(origin+'/api/example'),'/v1/heatmap/replay/chunk','?historyLease=1&symbol=ES&throughMs=123&generation=123-abcdef');
 const lease=await response.json();const url=new URL(lease.url);
 assert.equal(url.pathname,'/liquidity-history');assert.equal(url.origin,'https://feed.kwantdesk.com');
 const ticket=verifyBrowserStreamTicket(url.searchParams.get('ticket'),key,origin);
 assert.equal(ticket.path,'/v1/heatmap/replay/chunk');assert(!ticket.search.includes('historyLease'));
 assert(ticket.search.includes('throughMs=123'));assert(ticket.search.includes('generation=123-abcdef'));
});
test('authenticated lease negotiation returns a finite exact-scope URL, never a cross-origin redirect',async()=>{
 const issue=issuer(),query='?exchange=COMEX&symbol=MGC&contractSymbol=MGCZ6&seedLimit=128&streamLease=1';
 const response=issue(new Request(origin+'/api/institutional-market-data/v1/market-data/trades'+query),'/v1/market-data/trades',query);
 assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);assert.equal(response.headers.get('cache-control'),'private, no-store');
 const lease=await response.json(),url=new URL(lease.url),scope=verifyBrowserStreamTicket(url.searchParams.get('ticket'),key,origin);
 assert.equal(scope.path,'/v1/market-data/trades');assert.equal(scope.search,'?exchange=COMEX&symbol=MGC&contractSymbol=MGCZ6&seedLimit=128');assert(!lease.url.includes(key));assert.equal(scope.exp*1000,lease.expiresAt);
 assert.equal(issue(new Request(origin),'/v1/market-data/trades','?symbol=NQ'),null,'old clients retain their existing transport');
 assert.equal(issue(new Request(origin),'/v1/market-data/quotes','?symbols=NQ'),null,'old callers are not silently migrated');
 assert.equal(issue(new Request('https://attacker.example'),'/v1/market-data/trades','?streamLease=1').status,503);
});
test('quotes, cash indices and liquidity lease the exact live request without the old redirect flag',async()=>{
 for(const path of ['/v1/market-data/quotes','/v1/market-data/index-stream','/v1/heatmap/stream']){
  const response=issuer()(new Request(origin+'/api/example'),path,'?symbols=NQ,SPX&afterTimestamp=123&streamLease=1');
  assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);
  const lease=await response.json(),url=new URL(lease.url),scope=verifyBrowserStreamTicket(url.searchParams.get('ticket'),key,origin);
  assert.equal(scope.path,path);assert.equal(scope.search,'?symbols=NQ%2CSPX&afterTimestamp=123');
 }
 assert.equal(issuer()(new Request(origin),'/v1/orders','?streamLease=1'),null);
});
test('client leases retain venue/root/contract and reject unexpected hosts, credentials, scope and expiry',async()=>{
 const old=globalThis.fetch;const valid={url:'https://feed.kwantdesk.com/browser-stream?ticket=test',expiresAt:Date.now()+300000,transport:'direct-vps'};let lease=valid,seen;
 globalThis.fetch=async url=>{seen=new URL(url,origin);return {ok:true,json:async()=>lease}};
 try{const query=new URLSearchParams({exchange:'COMEX',symbol:'MGC',contractSymbol:'MGCZ6',seedLimit:'128'});assert.equal((await requestExecutionStreamLease(query)).url,valid.url);assert.equal(seen.searchParams.get('streamLease'),'1');assert.equal(seen.searchParams.get('contractSymbol'),'MGCZ6');assert(!query.has('streamLease'));
  for(const bad of [{url:'https://attacker.example/browser-stream?ticket=test'},{url:'https://u:p@feed.kwantdesk.com/browser-stream?ticket=test'},{url:'https://feed.kwantdesk.com/v1/orders?ticket=test'},{url:valid.url+'&symbol=ES'},{expiresAt:Date.now()-1},{expiresAt:Date.now()+900000},{transport:'proxy'}]){lease={...valid,...bad};await assert.rejects(requestExecutionStreamLease(query));}
 }finally{globalThis.fetch=old}
});
test('planned renewal has no outage backoff and reconnect seed dedup retains new actual prints',async()=>{
 const exports={},timers=new Map(),sources=[],requests=[],seeds=[],batches=[];let id=0;const now=Date.now();
 class Source{listeners=new Map();closed=false;constructor(url){assert.equal(new URL(url).origin,'https://feed.kwantdesk.com');sources.push(this)}addEventListener(n,f){this.listeners.set(n,f)}close(){this.closed=true}emit(n,p){this.listeners.get(n)?.({data:JSON.stringify(p)})}}
 vm.runInNewContext(compile('../src/lib/executionTapeEngine.ts'),{exports,require:name=>name.includes('executionTape')?tape:name.includes('executionStreamContinuity')?continuity:{futuresVenue},URL,URLSearchParams,Date,AbortSignal,EventSource:Source,fetch:async url=>{requests.push(url);return {ok:true,json:async()=>({url:'https://feed.kwantdesk.com/browser-stream?ticket=test',transport:'direct-vps',expiresAt:now+300000})}},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),setInterval:()=>++id,clearInterval:()=>{}});
 const engine=exports.createExecutionTapeEngine('NQ','NQZ6',{onStatus(){},onContinuity(){},onSeed:r=>seeds.push(r),onTrades:r=>batches.push(r)}),record=i=>({eventId:String(i),recordIndex:i,timestamp:now+i,open:100,high:100,low:100,close:100,volume:1,trades:1});
 engine.start();await new Promise(setImmediate);sources[0].emit('seed',{streamId:'first',batchSequence:0,continuity:'continuous',records:[record(1)]});
 const leaseTimer=[...timers.values()].find(t=>t.ms>280000);assert.ok(leaseTimer);leaseTimer.fn();await new Promise(setImmediate);const reconnect=[...timers.values()].find(t=>t.ms===0);assert.ok(reconnect,'planned renewal cannot wait four seconds');reconnect.fn();await new Promise(setImmediate);
 assert.equal(sources[0].closed,true);assert.equal(new URL(requests[1],origin).searchParams.get('seedLimit'),'4096');sources[1].emit('seed',{streamId:'next',batchSequence:0,continuity:'continuous',records:[record(1),record(2)]});
 [...timers.values()].find(t=>t.ms===8).fn();assert.equal(seeds.length,1);assert.equal(batches.length,1);assert.equal(batches[0].length,1);assert.equal(batches[0][0].eventId,'2');
 sources[1].onerror();const fastRetry=[...timers.entries()].find(([,timer])=>timer.ms===250);
 assert.ok(fastRetry,'an established stream retries promptly');
 timers.delete(fastRetry[0]);fastRetry[1].fn();await new Promise(setImmediate);
 sources[2].emit('seed',{streamId:'recovered',batchSequence:0,continuity:'continuous',records:[record(2)]});
 sources[2].onerror();assert.ok([...timers.values()].some(timer=>timer.ms===4000),'rapid failures still back off');
 engine.stop();
});


test('a delayed renewal lease must not stop admitted live prints or status',async()=>{
 const exports={},timers=new Map(),sources=[],batches=[],statuses=[];let id=0,requests=0,resolveRenewal;const now=Date.now();
 const lease=()=>({ok:true,json:async()=>({url:'https://feed.kwantdesk.com/browser-stream?ticket=test',transport:'direct-vps',expiresAt:now+300000})});
 class Source{listeners=new Map();closed=false;constructor(){sources.push(this)}addEventListener(n,f){this.listeners.set(n,f)}close(){this.closed=true}emit(n,p){if(!this.closed)this.listeners.get(n)?.({data:JSON.stringify(p)})}}
 vm.runInNewContext(compile('../src/lib/executionTapeEngine.ts'),{exports,require:name=>name.includes('executionTape')?tape:name.includes('executionStreamContinuity')?continuity:{futuresVenue},URL,URLSearchParams,Date,AbortSignal,EventSource:Source,fetch:()=>++requests===1?Promise.resolve(lease()):new Promise(r=>resolveRenewal=r),setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),setInterval:()=>++id,clearInterval:()=>{}});
 const engine=exports.createExecutionTapeEngine('NQ','NQZ6',{onStatus:s=>statuses.push(s),onContinuity(){},onSeed(){},onTrades:r=>batches.push(...r)}),record=i=>({eventId:String(i),recordIndex:i,timestamp:now+i,open:100,high:100,low:100,close:100,volume:1,trades:1});
 engine.start();await new Promise(setImmediate);sources[0].emit('seed',{streamId:'first',batchSequence:0,continuity:'continuous',records:[record(1)]});
 const renewal=[...timers.entries()].find(([,t])=>t.ms>280000);timers.delete(renewal[0]);renewal[1].fn();
 // The old engine closes before even requesting its replacement lease.
 const scheduled=[...timers.entries()].find(([,t])=>t.ms===0);if(scheduled){timers.delete(scheduled[0]);scheduled[1].fn();}
 await new Promise(setImmediate);assert.equal(requests,2);assert.equal(sources[0].closed,false,'healthy tape must stay open while authentication is pending');assert.equal(statuses.at(-1),'connected');
 sources[0].emit('trades',{streamId:'first',batchSequence:1,continuity:'continuous',records:[record(2)]});[...timers.values()].find(t=>t.ms===8).fn();assert.deepEqual(batches.map(r=>r.eventId),['2']);
 resolveRenewal(lease());await new Promise(setImmediate);const handoff=[...timers.entries()].find(([,t])=>t.ms===0);assert.ok(handoff);timers.delete(handoff[0]);handoff[1].fn();await new Promise(setImmediate);
 assert.equal(sources.length,2);sources[1].emit('seed',{streamId:'next',batchSequence:0,continuity:'continuous',records:[record(1),record(2),record(3)]});[...timers.values()].find(t=>t.ms===8).fn();assert.deepEqual(batches.map(r=>r.eventId),['2','3']);engine.stop();
});

for (const outcome of ['failed', 'stopped']) test(`a ${outcome} renewal cannot replace or interrupt the wrong stream`, async () => {
 const exports = {}, timers = new Map(), sources = [], statuses = [];
 let timerId = 0, requests = 0, settleRenewal;
 const response = () => ({ok:true,json:async()=>({url:'https://feed.kwantdesk.com/browser-stream?ticket=test',transport:'direct-vps',expiresAt:Date.now()+300000})});
 class Source {
  listeners = new Map(); closed = false;
  constructor(){sources.push(this)}
  addEventListener(name, callback){this.listeners.set(name,callback)}
  close(){this.closed=true}
  emit(name, payload){if(!this.closed)this.listeners.get(name)?.({data:JSON.stringify(payload)})}
 }
 vm.runInNewContext(compile('../src/lib/executionTapeEngine.ts'), {
  exports, require:name=>name.includes('executionTape')?tape:name.includes('executionStreamContinuity')?continuity:{futuresVenue},
  URL,URLSearchParams,Date,AbortSignal,EventSource:Source,
  fetch:()=>++requests===1?Promise.resolve(response()):new Promise((resolve,reject)=>{settleRenewal=outcome==='failed'?()=>reject(new Error('temporary authentication outage')):()=>resolve(response())}),
  setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId},clearTimeout:id=>timers.delete(id),setInterval:()=>++timerId,clearInterval:()=>{},
 });
 const engine=exports.createExecutionTapeEngine('ES','ESZ6',{onStatus:s=>statuses.push(s),onContinuity(){},onSeed(){},onTrades(){}});
 engine.start();await new Promise(setImmediate);
 sources[0].emit('seed',{streamId:'healthy',batchSequence:0,continuity:'continuous',records:[]});
 const timer=[...timers.entries()].find(([,t])=>t.ms>280000);
 timers.delete(timer[0]);timer[1].fn();await new Promise(setImmediate);
 assert.equal(requests,2);assert.equal(sources[0].closed,false);
 if(outcome==='stopped')engine.stop();
 settleRenewal();await new Promise(setImmediate);
 assert.equal(sources.length,1,'a failed or cancelled renewal must not open an orphan stream');
 if(outcome==='failed'){
  assert.equal(sources[0].closed,false);assert.equal(statuses.at(-1),'connected');
  assert.ok([...timers.values()].some(t=>t.ms===4000),'renewal retries while the old stream remains healthy');
  engine.stop();
 }
 assert.equal(sources[0].closed,true);assert.equal(timers.size,0,'stopping cancels scheduled work');
});
