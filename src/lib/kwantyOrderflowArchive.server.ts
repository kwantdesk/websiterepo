import "server-only";
import {isOrderflowArchiveConfigured,persistOrderflowFrame,readArchivedSessionFrames} from "@/lib/gexBotOrderflowArchive.server";

type Row = Record<string, unknown>;
const clock=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"});
const fields=["zcvr","ocvr","zgr","ogr","zvanna","ovanna","zcharm","ocharm","agg_dex","one_agg_dex","gexoflow","one_gexoflow","dexoflow","one_dexoflow","cvroflow","one_cvroflow"];
const numericFields=[...fields,"spot","agg_call_dex","one_agg_call_dex","agg_put_dex","one_agg_put_dex","net_dex","one_net_dex","net_call_dex","one_net_call_dex","net_put_dex","one_net_put_dex","z_mlgamma","z_msgamma","o_mlgamma","o_msgamma","zero_mcall","zero_mput","one_mcall","one_mput"];
function project(row:Row):Row{const next:Row={ticker:row.ticker,timestamp:Number(row.timestamp)};for(const key of numericFields)if(typeof row[key]==="number"&&Number.isFinite(row[key]))next[key]=row[key];return next;}
export function orderflowSessionDate(timestamp:unknown){const time=Number(timestamp);return Number.isFinite(time)&&time>0&&time<1e11?clock.format(new Date(time*1000)):null;}
export function validOrderflowRow(value:unknown,ticker:string,date?:string):value is Row {
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const row=value as Row,session=orderflowSessionDate(row.timestamp);
 return /^[A-Z][A-Z0-9_]{0,31}$/.test(ticker)&&row.ticker===ticker&&session!==null&&(!date||session===date)&&fields.some(field=>typeof row[field]==="number"&&Number.isFinite(row[field]));
}
/** Reuse the existing durable archive. No vendor requests, timers or new poller. */
export function createKwantyOrderflowArchive(deps={configured:isOrderflowArchiveConfigured,write:persistOrderflowFrame,read:readArchivedSessionFrames,now:Date.now}){
 const writes=new Map<string,number>(),cache=new Map<string,{until:number;job:Promise<{data:Row[];availability:string;sessionDate:string}>}>();
 return {
  async record(value:unknown){
   if(!deps.configured()||!value||typeof value!=="object")return;
   const row=value as Row,ticker=String(row.ticker??""),date=orderflowSessionDate(row.timestamp);
   if(!date||!validOrderflowRow(row,ticker)||Number(row.timestamp)*1000>deps.now()+60000||deps.now()-Number(row.timestamp)*1000>90*86400000)return;
   // At most one actual accepted observation per instrument/source minute.
   // The payload keeps its exact source timestamp; never synthesize a frame.
   const key=`${ticker}:${Math.floor(Number(row.timestamp)/60)}`,now=deps.now();
   if((writes.get(key)??0)>now)return;
   writes.set(key,Infinity);while(writes.size>512)writes.delete(writes.keys().next().value!);
   try{await deps.write({ticker,sessionKey:date,frameTimestamp:Math.floor(Number(row.timestamp)/60)*60000,payload:project(row)});cache.delete(`${ticker}:${date}`);}
   catch{writes.set(key,now+60_000);}
  },
  async session(ticker:string,date:string){
   const key=`${ticker}:${date}`,existing=cache.get(key),now=deps.now();if(existing&&existing.until>now)return existing.job;
   const job=(async()=>{
    if(!deps.configured())return {data:[],availability:"unavailable",sessionDate:date};
    try{
     const rows=await deps.read({ticker,sessionKey:date}),unique=new Map<number,Row>();
     for(const row of rows)if(validOrderflowRow(row,ticker,date))unique.set(Number(row.timestamp),project(row));
     const data=[...unique.values()].sort((a,b)=>Number(a.timestamp)-Number(b.timestamp)).slice(-600);
     return {data,availability:data.length?"recorded":"empty",sessionDate:date};
    }catch{return {data:[],availability:"unavailable",sessionDate:date};}
   })();
   cache.delete(key);cache.set(key,{until:now+60_000,job});while(cache.size>8)cache.delete(cache.keys().next().value!);return job;
  }
 };
}
export const kwantyOrderflowArchive=createKwantyOrderflowArchive();
