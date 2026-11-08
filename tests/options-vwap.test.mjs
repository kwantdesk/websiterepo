import assert from 'node:assert/strict';import test from 'node:test';
import {calculateOptionsVwap} from '../src/lib/optionsVwap.ts';
const start=Date.UTC(2026,10,6,14,30),bar=(timestamp,volume=999999)=>({timestamp,open:1,high:1,low:1,close:1,volume});
const event=(offset,price,size,side=1,received=start+offset)=>[start+offset,price,size,side,received];
test('weights the reported UNDERLYING by executed option size, not candle/futures volume',()=>{const bars=[bar(start),bar(start+60000)];const events=[event(1,100,1),event(2,200,3,-1),event(60001,300,4)];const result=calculateOptionsVwap(events,bars);assert.equal(result[0].value,175);assert.equal(result[1].value,237.5);assert.deepEqual(calculateOptionsVwap(events,bars.map(b=>({...b,volume:0,close:90000}))),result);});
test('calls and puts settings select actual contracts before accumulating',()=>{const events=[event(1,100,1),event(2,200,3,-1)];assert.equal(calculateOptionsVwap(events,[bar(start)],{side:'calls'})[0].value,100);assert.equal(calculateOptionsVwap(events,[bar(start)],{side:'puts'})[0].value,200);});
test('replay excludes future executions and late-received observations',()=>{const events=[event(1,100,1),event(2,200,1,1,start+120000),event(90000,1000,10)];assert.equal(calculateOptionsVwap(events,[bar(start),bar(start+60000)],{},start+60000)[0].value,100);});
test('session reset uses New York dates independently of machine timezone',()=>{const next=Date.UTC(2026,10,9,14,30);const values=calculateOptionsVwap([event(1,100,1),[next,200,1,1,next]],[bar(start),bar(next)]);assert.equal(values[1].value,200);assert.equal(values[1].breakBefore,true);});
test('weekly reset retains earlier days but resets on Monday',()=>{const thu=start-86400000,mon=start+3*86400000;const values=calculateOptionsVwap([[thu,100,1,1,thu],event(1,200,1),[mon,400,1,1,mon]],[bar(thu),bar(start),bar(mon)],{reset:'week'});assert.deepEqual(values.map(v=>v.value),[100,150,400]);});
test('no volume means no invented line and all timeframes consume the same contract sums',()=>{assert.deepEqual(calculateOptionsVwap([],[bar(start)]),[]);const events=[event(1,100,1),event(60001,200,3)];const minute=calculateOptionsVwap(events,[bar(start),bar(start+60000)]),five=calculateOptionsVwap(events,[bar(start)],{},null,start+5*60000);assert.equal(minute.at(-1).value,five.at(-1).value);});
import {subscribeOptionsVwap} from '../src/lib/optionsVwapFeed.ts';
test('two panels share one options reader and release the scheduled refresh when removed',async()=>{const original=globalThis.fetch;let reads=0;const payload={schemaVersion:1,symbol:'SPY',from:'2026-11-02',to:'2026-11-06',ids:['id1'],events:[[Date.UTC(2026,10,6),700,1,1,Date.UTC(2026,10,6)]],coverage:{kind:'observed-options-contracts',complete:false}};globalThis.fetch=async()=>{reads++;return new Response(JSON.stringify(payload),{headers:{ETag:'"fixture"','Content-Type':'application/json'}})};const received=[];let stop1,stop2;try{stop1=subscribeOptionsVwap('SPY',payload.from,payload.to,p=>{if(p)received.push(p)});stop2=subscribeOptionsVwap('SPY',payload.from,payload.to,p=>{if(p)received.push(p)});await new Promise(r=>setImmediate(r));assert.equal(reads,1);assert.equal(received.length,2);assert.equal(received[0],received[1]);}finally{stop1?.();stop2?.();globalThis.fetch=original;}});
test('live options prints share the existing paced feed and deduplicate archive IDs',async()=>{const originalFetch=globalThis.fetch,originalNow=Date.now;const now=Date.UTC(2026,10,6,15);Date.now=()=>now;let flowReads=0,archiveReads=0;const seen=[];const event=[now-30000,700,1,1,now-30000];globalThis.fetch=async url=>{if(String(url).startsWith('/api/gex-flow?')){flowReads++;return new Response(JSON.stringify({schemaVersion:1,consolidatedAvailable:true,sessionDate:'2026-11-06',asOf:new Date(now).toISOString(),marketOpen:true,refreshAfterMs:3000,rows:[{id:'a',ticker:'SPY',parentId:null,stockPrice:700,size:1,contractType:'CALL',tradeTime:now-30000,tradeType:'REGULAR'},{id:'b',ticker:'SPY',parentId:null,stockPrice:705,size:3,contractType:'PUT',tradeTime:now-10000,tradeType:'REGULAR'}]}));}archiveReads++;return new Response(JSON.stringify({schemaVersion:1,symbol:'SPY',from:'2026-11-06',to:'2026-11-06',ids:['a'],events:[event],coverage:{kind:'observed-options-contracts',complete:false}}));};const {bigOptionsFeed,createBigOptionsFeed}=await import('../src/lib/bigBlocksOptionsFeed.ts');const originalSubscribe=bigOptionsFeed.subscribe;bigOptionsFeed.subscribe=createBigOptionsFeed(globalThis.fetch).subscribe;let stop;try{stop=subscribeOptionsVwap('SPY','2026-11-06','2026-11-06',p=>{if(p)seen.push(p)},{live:true});await new Promise(r=>setImmediate(r));assert.equal(flowReads,1);assert.equal(archiveReads,1);const payload=seen.at(-1);assert.equal(payload.events.length,2);assert.equal(payload.events.reduce((sum,e)=>sum+e[2],0),4);assert.equal(calculateOptionsVwap(payload.events,[bar(now-60000)],{},null,now+1)[0].value,703.75);}finally{stop?.();bigOptionsFeed.subscribe=originalSubscribe;globalThis.fetch=originalFetch;Date.now=originalNow;}});
import {defaultIndicatorSettings,normalizeStoredIndicator} from '../src/lib/chartIndicatorConfig.ts';
import {CHART_INDICATOR_CATALOG} from '../src/lib/chartIndicatorCatalog.ts';
import {indicatorCompatibility} from '../src/lib/indicatorInstrumentCompatibility.ts';
test('Options VWAP is a single restorable study and refuses futures-volume substitution',()=>{const matches=CHART_INDICATOR_CATALOG.filter(d=>d.id==='options-vwap');assert.equal(matches.length,1);const settings={...defaultIndicatorSettings('options-vwap'),side:'puts',reset:'week',lineWidth:4,lineColor:'#FF3300',useThemeColors:false};const restored=normalizeStoredIndicator({instanceId:'saved-vwap',indicatorId:'options-vwap',enabled:true,settings});assert.equal(restored.enabled,true);for(const key of ['side','reset','lineWidth','lineColor','useThemeColors'])assert.equal(restored.settings[key],settings[key]);for(const symbol of ['SPX','SPY','QQQ','NDX','AMD'])assert.equal(indicatorCompatibility(matches[0],symbol).canAdd,true);for(const symbol of ['NQ','ES','VIX'])assert.equal(indicatorCompatibility(matches[0],symbol).canAdd,false);});

import {OptionsVwapLedger} from '../src/lib/optionsVwapLedger.ts';
test('ledger retains over 100000 prints and conserves exact weighted volume across grouping',()=>{
 const ledger=new OptionsVwapLedger(),raw=[];
 for(let i=0;i<100005;i++){const e=event(i%59000,100+i%7,1+i%3,i%2?1:-1,start+60000);raw.push(e);ledger.upsert(String(i),e);}
 assert.equal(ledger.size,100005);const grouped=ledger.snapshot().events;assert.ok(grouped.length<200);
 const volume=raw.reduce((s,e)=>s+e[2],0),notional=raw.reduce((s,e)=>s+e[1]*e[2],0);
 assert.equal(grouped.reduce((s,e)=>s+e[2],0),volume);
 assert.ok(Math.abs(calculateOptionsVwap(grouped,[bar(start)],{},null,start+60000)[0].value-notional/volume)<1e-8);
 for(const side of ['calls','puts'])assert.ok(Math.abs(calculateOptionsVwap(grouped,[bar(start)],{side},null,start+60000)[0].value-calculateOptionsVwap(raw,[bar(start)],{side},null,start+60000)[0].value)<1e-8);
});
test('ledger deduplicates, applies corrections and cannot resurrect cancelled prints',()=>{
 const ledger=new OptionsVwapLedger();ledger.upsert('a',event(1,100,2));ledger.upsert('a',event(1,100,2));assert.equal(ledger.size,1);
 ledger.upsert('a',event(1,200,3,1,start+100));ledger.upsert('a',event(1,100,2,1,start+50));assert.equal(ledger.snapshot().events[0][1],200);
 ledger.cancel('a');ledger.upsert('a',event(1,100,2));assert.equal(ledger.size,0);
 ledger.cancel('not-seen');assert.equal(ledger.upsert('not-seen',event(1,100,1)),false);
});
for(const status of [202,503,'pending'])test('live line publishes without waiting for archive '+status,async()=>{
 const originalFetch=globalThis.fetch,originalNow=Date.now;const now=Date.UTC(2026,10,6,15);Date.now=()=>now;
 const {bigOptionsFeed}=await import('../src/lib/bigBlocksOptionsFeed.ts');const originalSubscribe=bigOptionsFeed.subscribe;
 let emit,stop,resolveArchive;const seen=[];
 bigOptionsFeed.subscribe=(_symbol,listener)=>{emit=listener;return()=>{};};
 globalThis.fetch=()=>status==='pending'?new Promise(resolve=>{resolveArchive=resolve;}):Promise.resolve(new Response(status===202?'':JSON.stringify({error:'archive offline'}),{status}));
 try{
 stop=subscribeOptionsVwap('SPY','2026-11-06','2026-11-06',(p)=>{if(p)seen.push(p);},{live:true});await new Promise(r=>setImmediate(r));
 emit({sessionDate:'2026-11-06',asOf:new Date(now).toISOString(),rows:[{id:'live',ticker:'SPY',parentId:null,stockPrice:700,size:5,contractType:'CALL',tradeTime:now-1000,tradeType:'REGULAR'}]},null);
 assert.equal(seen.at(-1).events[0][1],700);assert.equal(seen.at(-1).events[0][2],5);
 if(resolveArchive){resolveArchive(new Response(JSON.stringify({schemaVersion:1,symbol:'SPY',from:'2026-11-06',to:'2026-11-06',asOf:new Date(now-5000).toISOString(),ids:['live','older'],events:[[now-1000,600,1,1,now-5000],[now-2000,690,5,-1,now-5000]],coverage:{kind:'observed-options-contracts',complete:false,sessions:['2026-11-06']}})));await new Promise(r=>setImmediate(r));assert.equal(seen.at(-1).events.reduce((s,e)=>s+e[2],0),10);assert.equal(calculateOptionsVwap(seen.at(-1).events,[bar(now-60000)],{},null,now+1)[0].value,695);}
 const count=seen.length;emit({sessionDate:'2026-11-05',asOf:new Date(now).toISOString(),rows:[]},null);assert.equal(seen.length,count);
 }finally{stop?.();bigOptionsFeed.subscribe=originalSubscribe;globalThis.fetch=originalFetch;Date.now=originalNow;}
});
