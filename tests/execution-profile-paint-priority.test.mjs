import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createExecutionPaintScheduler,createExecutionStudyScheduler} from '../src/lib/executionPaintScheduler.ts';
import {applyInstitutionalTradesToVolumeProfile} from '../src/lib/institutionalMarketData.ts';

function harness(checkpoint){
 let active=true,id=0,now=0;const timers=new Map(),commits=[];
 const env={active:()=>active,checkpoint,delay:(fn,ms)=>{timers.set(++id,{fn,at:now+ms,ms});return id},cancelDelay:id=>timers.delete(id)};
 const scheduler=createExecutionStudyScheduler(rows=>commits.push(rows),env);
 return {scheduler,timers,commits,active(value){active=value;scheduler.visibilityChanged()},advance(ms){now+=ms;for(const[id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn()}}};
}

test('profile checkpoints never block or throttle the candle frame and retain every print',()=>{
 const h=harness();const frames=[];let painted=0;
 const candle=createExecutionPaintScheduler(()=>painted++,{visible:()=>true,requestFrame:fn=>{frames.push(fn);return frames.length},cancelFrame(){},delay(){throw Error('visible prices cannot use study timer')},cancelDelay(){}});
 for(let frame=0;frame<6;frame++){
  h.scheduler.push(Array.from({length:200},(_,i)=>frame*200+i));candle.schedule();frames.shift()();h.advance(16);
 }
 assert.equal(painted,6);assert.equal(h.commits.length,0,'heavy profile work must not run inside the price frame');
 h.advance(4);assert.equal(h.commits.length,1);assert.deepEqual(h.commits[0],Array.from({length:1200},(_,i)=>i));
 h.scheduler.push([1200]);h.advance(100);assert.deepEqual(h.commits[1],[1200],'quiet trailing print must commit without another trade');
});

test('foreground resume accelerates a pending background checkpoint and cancellation clears it',()=>{
 const h=harness();h.active(false);h.scheduler.push([1]);assert.equal([...h.timers.values()][0].ms,3000);
 h.advance(200);h.active(true);assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].ms,100);
 h.advance(100);assert.deepEqual(h.commits,[[1]]);h.scheduler.push([2]);h.scheduler.cancel();h.advance(3000);
 assert.deepEqual(h.commits,[[1]]);assert.equal(h.timers.size,0);
});

test('coalesced profile folds equal per-frame folds for totals, delta, POC, VA and VWAP',()=>{
 const start=Date.UTC(2026,10,9,14,30),levels=Array.from({length:4000},(_,i)=>({price:27000+i*.25,volume:10,bidVolume:5,askVolume:5,delta:0,trades:2}));
 const base={schemaVersion:'kwantify-volume-profile-v1',provider:'Rithmic',source:'test',root:'NQ',contractSymbol:'NQZ6',period:'custom',startMs:start,endMs:start+60000,tickSize:.25,groupTicks:1,valueAreaPercent:70,minTradeVolume:0,maxTradeVolume:0,totalVolume:40000,bidVolume:20000,askVolume:20000,delta:0,trades:8000,poc:27500,vah:27800,val:27200,vwap:27499.875,standardDeviation:288,levels,developingPoc:[],developingValueArea:[],developingVwap:[],asOf:new Date(start).toISOString()};
 const frames=Array.from({length:120},(_,f)=>Array.from({length:20},(_,i)=>({timestamp:start+f*16+i/100,close:27500+((f+i)%20)*.25,volume:1,bidVolume:i%2?1:0,askVolume:i%2?0:1,trades:1})));
 let each=base,batched=base,updates=0;const h=harness();
 for(const rows of frames){each=applyInstitutionalTradesToVolumeProfile(each,rows);h.scheduler.push(rows);h.advance(16);}
 h.advance(100);for(const rows of h.commits){batched=applyInstitutionalTradesToVolumeProfile(batched,rows);updates++;}
 assert.equal(each.totalVolume,42400);assert.ok(Math.abs(batched.standardDeviation-each.standardDeviation)<1e-7,'floating-point accumulation must remain sub-tick');assert.deepEqual({...batched,standardDeviation:0},{...each,standardDeviation:0});assert.ok(updates<20,`expected fewer than 20 model rebuilds, got ${updates}`);
});

test('workspace keeps deferred profile work separate from exact price and protection paths',()=>{
 const workspace=fs.readFileSync(new URL('../src/components/KwantifyWorkspace.tsx',import.meta.url),'utf8');
 assert.match(workspace,/const profileScheduler = createExecutionStudyScheduler/);
 assert.match(workspace,/if \(needsLiveVolumeProfiles\) profileScheduler.push\(records\)/);
 assert.match(workspace,/profileScheduler.cancel\(\)/);
 assert.doesNotMatch(workspace,/const flushProfileRecords|profileSyncTimer/);
 assert.match(workspace,/paintInCurrentFrame: document.visibilityState === "visible"/);
});


test('a coalesced batch preserves every minute checkpoint and arrival order',()=>{
 const h=harness(row=>Math.floor(row.timestamp/60000));
 const rows=[{timestamp:59990,id:1},{timestamp:60000,id:2},{timestamp:60001,id:3},{timestamp:59999,id:4},{timestamp:60002,id:5}];
 h.scheduler.push(rows);h.advance(100);
 assert.deepEqual(h.commits.map(batch=>batch.map(row=>row.id)),[[1],[2,3],[4],[5]]);
 assert.deepEqual(h.commits.flat(),rows);
});
