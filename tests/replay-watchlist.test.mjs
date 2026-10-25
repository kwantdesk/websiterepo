import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {prepareReplayWatchlistCandles,replayWatchlistQuote,createReplayWatchlistCache} from '../src/lib/replayWatchlist.ts';
const start=Date.UTC(2026,9,23,13,30),end=start+6.5*3600000;
const bar=(minute,close=100+minute)=>({timestamp:start+minute*60000,open:100,high:1000,low:1,close});
const quote=(rows,clock,prints=[])=>replayWatchlistQuote(rows,prints,start+clock,start,end);

test('minute prices reveal only completed closes, not the forming final OHLC',()=>{
 const rows=[bar(0,101),bar(1,999),bar(2,888)];
 assert.equal(quote(rows,59999),null);assert.equal(quote(rows,60000).price,101);
 assert.equal(quote(rows,119999).price,101);assert.equal(quote(rows,120000).price,999);
 assert.equal(quote(rows,60000).change,1);assert.equal(quote(rows,60000).changePercent,1);
 assert.equal(quote(rows,-1),null);assert.equal(quote(rows,24*3600000),null);
});
test('real observed executions update intraminute while future/flow/summary rows cannot',()=>{
 const rows=[bar(0,101)],prints=[{timestamp:start+61000,close:102},{timestamp:start+62000,close:900,flowOnly:true},{timestamp:start+63000,close:800,footprintSummary:{}},{timestamp:start+65000,close:999}];
 const q=quote(rows,64000,prints);assert.equal(q.price,102);assert.equal(q.resolution,'execution');assert.equal(q.asOf,start+61000);
 assert.equal(quote(rows,60500,prints).price,101);
 assert.equal(quote(rows,64000,[...prints,{timestamp:start+70000,close:123456}]).price,102);
});
test('backward scrubbing and independent symbols never retain a later/live price',()=>{
 const a=[bar(0,101),bar(1,102)],b=[bar(0,501),bar(1,502)];
 assert.equal(quote(a,120000).price,102);assert.equal(quote(a,60000).price,101);assert.equal(quote(b,60000).price,501);
 assert.equal(quote([],120000),null);assert.equal(quote(a,300000),null);
 const late=[bar(10,110)];assert.equal(quote(late,660000).change,null);
 assert.deepEqual(prepareReplayWatchlistCandles([bar(-1),bar(1),bar(0),{...bar(3),close:NaN},bar(1440)],start,end),[bar(0),bar(1)]);
});
test('history cache shares duplicate rows, caps concurrent reads and drops abandoned queued dates',async()=>{
 const cache=createReplayWatchlistCache(2,4),finish=[];let calls=0,running=0,max=0;
 const load=()=>new Promise(resolve=>{calls++;max=Math.max(max,++running);finish.push(()=>{running--;resolve([bar(0)]);});});
 const a=cache.acquire('a',load),duplicate=cache.acquire('a',load),b=cache.acquire('b',load),old=cache.acquire('old-date',load);
 old.release();assert.equal(calls,2);a.release();finish.shift()();await duplicate.promise;await new Promise(r=>setImmediate(r));
 assert.equal(calls,2);assert.deepEqual(await old.promise,[]);finish.shift()();await b.promise;
 const again=cache.acquire('a',load);await again.promise;assert.equal(calls,2);assert.equal(max,2);again.release();duplicate.release();b.release();
});
test('live numbers are unmounted in replay; requests depend on source/date, not clock ticks',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const code=read('src/components/KwantifyWorkspace.tsx'),component=read('src/components/ReplayWatchlistNumbers.tsx');
 assert.match(code,/chartSurfaceActive && gexVueReplay.active\s*\? <ReplayWatchlistNumbers[\s\S]*?: <LiveWatchlistNumbers/);
 assert.match(code,/readReplayWatchlistPrints[\s\S]*?::flow::replay-/);
 assert.match(component,/\[key,load,rowKey,broker,symbol,startMs,endMs\]/);assert.doesNotMatch(component,/setInterval|setTimeout|subscribeLive/);
 assert.match(component,/Recorded 1m close/);
});
