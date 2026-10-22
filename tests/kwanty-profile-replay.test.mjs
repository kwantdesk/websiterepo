import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileReplay} from '../public/kwanty-app/profile-replay.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createStateSources} from '../public/kwanty-app/state-sources.js';
import {createSessionHistory} from '../public/kwanty-app/session-history.js';
const row={ticker:'QQQ',timestamp:1792612800,profilePage:0},envelope={ticker:'QQQ',package:'state',category:'gamma_zero',sessionDate:'2026-10-21',profilePages:[{first:row.timestamp,last:row.timestamp,count:1}]};
test('an empty session is not cached forever; retry remains request-driven and bounded',async()=>{
 let calls=0,time=0;const history=createSessionHistory(async()=>({data:++calls===1?[]:[row]}),{now:()=>time});
 assert.deepEqual(await history.read('QQQ','2026-10-21'),[]);await history.read('QQQ','2026-10-21');assert.equal(calls,1);time=30001;assert.deepEqual(await history.read('QQQ','2026-10-21'),[row]);assert.equal(calls,2);
});
test('State paged timeline retains early observations beyond the old 1200-row cap',async()=>{
 const rows=Array.from({length:5000},(_,i)=>({...row,timestamp:row.timestamp-4999+i,spot:725})),panel={ticker:'QQQ',greek:'gamma',greekExpiry:'zero'};
 const sources=createStateSources({api:async()=>({...envelope,data:rows}),onChange(){},createPrices:()=>({setActive(){},select(){},dispose(){}})});
 sources.reconcile([panel],{active:true,date:'2026-10-21',live:false});await sources.refresh();assert.equal(sources.get(panel).records.length,5000);assert.equal(sources.get(panel).records[0].timestamp,rows[0].timestamp);sources.dispose();
});
test('replay fetches one exact page, never fabricates profile data while pending',async()=>{
 let calls=0,changes=0;const original={ticker:'QQQ',timestamp:row.timestamp,mini_contracts:[[725,123,-3]]};
 const replay=createProfileReplay({api:async path=>{calls++;assert.match(path,/package=state&category=gamma_zero&date=2026-10-21&page=0/);return {...envelope,page:0,data:[original]};},onChange:()=>changes++});
 assert.equal(replay.select(envelope,row),row);assert.equal(replay.ready(envelope,row),false);replay.select(envelope,row);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1);assert.equal(changes,1);assert.equal(replay.ready(envelope,row),true);assert.deepEqual(replay.select(envelope,row),original);
});
test('wrong instrument and category cannot contaminate replay; failed frames remain unavailable',async()=>{
 const replay=createProfileReplay({api:async()=>({...envelope,page:0,category:'delta_zero',data:[{...row,ticker:'SPX'}]}),onChange(){}});
 replay.select(envelope,row);await new Promise(resolve=>setImmediate(resolve));assert.equal(replay.error(envelope,row),true);assert.equal(replay.ready(envelope,row),false);assert.equal(replay.select(envelope,row),row);
 assert.equal(replay.select(null,row),row);assert.equal(replay.ready(null,row),true);
});
const app=readFileSync(new URL('../public/kwanty-app/app.js',import.meta.url),'utf8');
test('history retries only a bounded in-progress index, not auth or ordinary failures',async()=>{
 let calls=0;const context={DOMException,Date,AbortSignal,clearTimeout(){},setTimeout(callback){queueMicrotask(callback);return 0;},decodeSessionTransport:value=>value,botFetch:async()=>{calls++;return calls<3?Response.json({error:calls===1?'EOD_INDEX_BUSY':'EOD_INDEX_BUILDING'},{status:503}):Response.json({data:[row]});}};
 vm.runInNewContext(app.slice(app.indexOf('async function api('),app.indexOf('function query()'))+';this.callApi=api;',context);
 assert.equal((await context.callApi('history?selection')).data.length,1);assert.equal(calls,3);
 for(const status of [401,403,429,502]){calls=0;context.botFetch=async()=>{calls++;return Response.json({error:'DENIED'},{status});};await assert.rejects(()=>context.callApi('history?selection'));assert.equal(calls,1);}
 const controller=new AbortController();controller.abort();await assert.rejects(()=>context.callApi('history?selection',controller.signal),{name:'AbortError'});
});
test('Play at the loaded close restarts at the first saved frame and waits for missing profile pages',()=>{
 let clicked,frame,ready=false;const state={records:[{timestamp:100},{timestamp:101},{timestamp:102}],replayIndex:2,auto:false,playing:false,historyMode:'2026-10-21'},button={textContent:'',addEventListener:(type,fn)=>clicked=fn};
 const context={state,$:selector=>selector==='#playPause'?button:{value:'1'},performance:{now:()=>0},invalidateRequests(){},replayFrameReady:()=>ready,requestAnimationFrame:fn=>{frame=fn;return 1;},seekSnapshot:(rows,time)=>Math.min(2,Math.floor(time/1000)-100),syncTimeline(){},renderSummary(){},drawAll(){},updateHealth(){},stopReplay(){state.playing=false;}};
 vm.runInNewContext('let playTimer;'+app.slice(app.indexOf("$('#playPause').addEventListener"),app.indexOf("$$('[data-seek]').forEach(b=>b.addEventListener")),context);
 clicked();assert.equal(state.replayIndex,0);frame(1000);assert.equal(state.replayIndex,0,'missing page must not consume playback time');ready=true;frame(2000);assert.equal(state.replayIndex,1);frame(3000);assert.equal(state.replayIndex,2);assert.equal(state.playing,false);
});
