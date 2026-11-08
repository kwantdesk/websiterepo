import type {OptionsVwapEvent,OptionsVwapPayload} from './optionsVwap';
import {bigOptionsFeed} from './bigBlocksOptionsFeed';
import {exchangeClockParts} from './exchangeClock';
import {OptionsVwapLedger} from './optionsVwapLedger';
type Listener=(payload:OptionsVwapPayload|null,error:string|null)=>void;
const feeds=new Map<string,{listeners:Set<Listener>;payload:OptionsVwapPayload|null;stop:()=>void}>();
function currentSession(date:string){const p=exchangeClockParts(Date.now(),'America/New_York');return date===`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`&&p.weekday>0&&p.weekday<6&&p.hour>=9&&p.hour<=16;}
export function subscribeOptionsVwap(symbol:string,from:string,to:string,listener:Listener,options:{live?:boolean}={}){
 const key=`${symbol}|${from}|${to}|${options.live===true}`;let feed=feeds.get(key);
 if(!feed){
  let timer:ReturnType<typeof setTimeout>|undefined,stopped=false,etag='',failures=0,stopLive:(()=>void)|undefined;
  const controller=new AbortController(),ledger=new OptionsVwapLedger();
  // Live observations do not wait for old compressed recordings to load.
  let metadata:OptionsVwapPayload={schemaVersion:1,symbol,from,to,asOf:new Date().toISOString(),ids:[],events:[],coverage:{kind:'observed-options-contracts',complete:false,sessions:[],missing:[],truncated:false},refreshAfterMs:15000};
  const entry={listeners:new Set<Listener>(),payload:null as OptionsVwapPayload|null,stop(){stopped=true;clearTimeout(timer);controller.abort();stopLive?.();}};
  feed=entry;feeds.set(key,entry);
  const publish=()=>{
   if(stopped)return;
   const snapshot=ledger.snapshot();
   entry.payload={...metadata,...snapshot};
   for(const callback of entry.listeners)callback(entry.payload,null);
  };
  const load=async()=>{let delay=15000;try{
   if(typeof document!=='undefined'&&document.hidden){delay=60000;return;}
   if(options.live&&currentSession(to)&&!stopLive)stopLive=bigOptionsFeed.subscribe(symbol,(payload,error)=>{
    if(stopped)return;
    if(payload&&payload.sessionDate===to){
     const received=Date.parse(payload.asOf);
     for(const row of payload.rows){
      if(row.ticker!==symbol||row.parentId)continue;
      if(/CANCEL/i.test(row.tradeType)){ledger.cancel(row.id);continue;}
      if(!row.stockPrice||row.stockPrice<=0||!Number.isInteger(row.size)||row.size<=0||row.contractType==='UNKNOWN')continue;
      const event:OptionsVwapEvent=[row.tradeTime,row.stockPrice,row.size,row.contractType==='CALL'?1:-1,Math.max(row.tradeTime,received)];
      ledger.upsert(row.id,event);
     }
     metadata={...metadata,asOf:payload.asOf,coverage:{...metadata.coverage,sessions:[...new Set([...(metadata.coverage.sessions??[]),payload.sessionDate])].sort()}};
     publish();
    }
    if(error)for(const callback of entry.listeners)callback(entry.payload,error);
   },{refreshMs:15000});
   if(stopLive&&!currentSession(to)){stopLive();stopLive=undefined;}
   const r=await fetch('/api/options-vwap?'+new URLSearchParams({symbol,from,to}),{credentials:'same-origin',cache:'no-store',headers:etag?{'If-None-Match':etag}:{},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
   if(r.status===202){delay=2000;return;}
   if(r.status===304){failures=0;return;}
   const payload=await r.json();if(!r.ok)throw Error(payload.error||'Options VWAP history unavailable');
   if(payload.schemaVersion!==1||payload.symbol!==symbol||payload.from!==from||payload.to!==to||payload.coverage?.kind!=='observed-options-contracts'||!Array.isArray(payload.events)||payload.events.length>100000||!Array.isArray(payload.ids)||payload.ids.length!==payload.events.length||payload.ids.some((id:unknown)=>typeof id!=='string'||id.length>200)||payload.events.some((e:unknown)=>!Array.isArray(e)||e.length!==5||!e.every(Number.isFinite)))throw Error('Invalid recorded options data');
   if(stopped)return;
   for(let i=0;i<payload.ids.length;i++)ledger.upsert(payload.ids[i],payload.events[i]);
   if(Array.isArray(payload.cancelledIds))for(const id of payload.cancelledIds)if(typeof id==='string')ledger.cancel(id);
   metadata={...payload,asOf:metadata.asOf>payload.asOf?metadata.asOf:payload.asOf};
   etag=r.headers.get('etag')||'';failures=0;publish();
   if(Date.parse(to+'T23:59:59Z')<Date.now()-86400000)delay=300000;
  }catch(error){if(stopped)return;delay=Math.min(120000,15000*2**Math.min(++failures,3));for(const callback of entry.listeners)callback(entry.payload,error instanceof Error?error.message:'Options VWAP history unavailable');}
  finally{if(!stopped)timer=setTimeout(load,delay);}};
  queueMicrotask(()=>{if(!stopped)void load();});
 }
 const active=feed;active.listeners.add(listener);if(active.payload)listener(active.payload,null);let released=false;
 return()=>{if(released)return;released=true;active.listeners.delete(listener);if(!active.listeners.size){active.stop();feeds.delete(key);}};
}
