import type {OptionsVwapEvent,OptionsVwapPayload} from './optionsVwap';
import {bigOptionsFeed} from './bigBlocksOptionsFeed';
import {exchangeClockParts} from './exchangeClock';
type Listener=(payload:OptionsVwapPayload|null,error:string|null)=>void;
const feeds=new Map<string,{listeners:Set<Listener>;payload:OptionsVwapPayload|null;stop:()=>void}>();
function currentSession(date:string){const p=exchangeClockParts(Date.now(),'America/New_York');return date===`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`&&p.weekday>0&&p.weekday<6&&p.hour>=9&&p.hour<=16;}
export function subscribeOptionsVwap(symbol:string,from:string,to:string,listener:Listener,options:{live?:boolean}={}){
 const key=`${symbol}|${from}|${to}|${options.live===true}`;let feed=feeds.get(key);
 if(!feed){let timer:ReturnType<typeof setTimeout>|undefined,stopped=false,etag='',failures=0,stopLive:(()=>void)|undefined;const controller=new AbortController();
  const live=new Map<string,OptionsVwapEvent>(),cancelled=new Set<string>();let archive:OptionsVwapPayload|null=null;
  const entry={listeners:new Set<Listener>(),payload:null as OptionsVwapPayload|null,stop(){stopped=true;clearTimeout(timer);controller.abort();stopLive?.();}};feed=entry;feeds.set(key,entry);
  const publish=()=>{if(stopped||!archive)return;const ledger=new Map(archive.ids.map((id,i)=>[id,archive!.events[i]]));
   for(const [id,event] of live){const previous=ledger.get(id);ledger.set(id,previous&&previous[0]===event[0]&&previous[1]===event[1]&&previous[2]===event[2]&&previous[3]===event[3]?[...event.slice(0,4),Math.min(event[4],previous[4])] as OptionsVwapEvent:event);}
   for(const id of cancelled)ledger.delete(id);
   const ordered=[...ledger.entries()].sort((a,b)=>a[1][0]-b[1][0]);entry.payload={...archive,ids:ordered.map(([id])=>id),events:ordered.map(([,event])=>event)};
   for(const callback of entry.listeners)callback(entry.payload,null);
  };
  const load=async()=>{let delay=15000;try{
   if(typeof document!=='undefined'&&document.hidden){delay=60000;return;}
   // This is the EXISTING shared options flow subscription, not another paid
   // vendor poll per chart. History/replay and completed dates never start it.
   if(options.live&&currentSession(to)&&!stopLive)stopLive=bigOptionsFeed.subscribe(symbol,(payload)=>{
    if(stopped||!payload)return;const received=Date.parse(payload.asOf);
    for(const row of payload.rows){if(row.ticker!==symbol||row.parentId)continue;
     if(/CANCEL/i.test(row.tradeType)){cancelled.add(row.id);live.delete(row.id);continue;}
     if(cancelled.has(row.id)||!row.stockPrice||row.stockPrice<=0||!Number.isInteger(row.size)||row.size<=0||row.contractType==='UNKNOWN')continue;
     if(!live.has(row.id)&&live.size>=100000)continue;
     const event:OptionsVwapEvent=[row.tradeTime,row.stockPrice,row.size,row.contractType==='CALL'?1:-1,Math.max(row.tradeTime,received)];const previous=live.get(row.id);
     if(previous&&previous[0]===event[0]&&previous[1]===event[1]&&previous[2]===event[2]&&previous[3]===event[3])event[4]=previous[4];live.set(row.id,event);
    }publish();
   },{refreshMs:15000});
   if(stopLive&&!currentSession(to)){stopLive();stopLive=undefined;}
   const r=await fetch('/api/options-vwap?'+new URLSearchParams({symbol,from,to}),{credentials:'same-origin',cache:'no-store',headers:etag?{'If-None-Match':etag}:{},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
   if(r.status===202){delay=2000;return;}
   if(r.status===304){failures=0;return;}
   const payload=await r.json();if(!r.ok)throw Error(payload.error||'Options VWAP unavailable');
   if(payload.schemaVersion!==1||payload.symbol!==symbol||payload.from!==from||payload.to!==to||payload.coverage?.kind!=='observed-options-contracts'||!Array.isArray(payload.events)||payload.events.length>100000||!Array.isArray(payload.ids)||payload.ids.length!==payload.events.length||payload.ids.some((id:unknown)=>typeof id!=='string'||id.length>200)||payload.events.some((e:unknown)=>!Array.isArray(e)||e.length!==5||!e.every(Number.isFinite)))throw Error('Invalid recorded options data');
   if(stopped)return;archive=payload;etag=r.headers.get('etag')||'';failures=0;publish();
   if(Date.parse(to+'T23:59:59Z')<Date.now()-86400000)delay=300000;
  }catch(error){if(stopped)return;delay=Math.min(120000,15000*2**Math.min(++failures,3));for(const callback of entry.listeners)callback(entry.payload,error instanceof Error?error.message:'Options VWAP unavailable');}
  finally{if(!stopped)timer=setTimeout(load,delay);}};
  queueMicrotask(()=>{if(!stopped)void load();});
 }
 const active=feed;active.listeners.add(listener);if(active.payload)listener(active.payload,null);let released=false;
 return()=>{if(released)return;released=true;active.listeners.delete(listener);if(!active.listeners.size){active.stop();feeds.delete(key);}};
}
