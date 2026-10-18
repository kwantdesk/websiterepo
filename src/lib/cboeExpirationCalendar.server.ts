import {createHash} from 'node:crypto';
import {unstable_cache} from 'next/cache';
import snapshot from '@/data/cboe-options-2026.json';
import {parseCboeCalendar} from './cboeExpirationPdf.server';
import {CALENDAR_CHECK_MS,CBOE_CALENDAR_URL,type ExpirationCalendar,type ExpirationCalendarResponse} from './optionsExpirationCalendar';

const seed=snapshot as ExpirationCalendar;
type Entry={calendar:ExpirationCalendar|null;checkedAt:number;attemptedAt:number;failed:boolean;availableYears:number[]};
const shared=globalThis as typeof globalThis&{__cboeExpiration?:{entries:Map<number,Entry>;pending:Promise<void>|null}};
const state=shared.__cboeExpiration??(shared.__cboeExpiration={entries:new Map(),pending:null});
export function discoverCalendarSources(html:string,now=new Date()){
  const result=new Map<number,string>();
  for(const match of html.matchAll(/https:\/\/cdn\.cboe\.com\/resources\/options\/Cboe(20\d{2})OPTIONSCalendar\.pdf/g)){const year=Number(match[1]);if(year>=2026&&year<=now.getUTCFullYear()+1)result.set(year,match[0]);}
  return result;
}
async function readSource(url:string,maximum:number){
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000),redirect:'error',headers:{Accept:url.endsWith('.pdf')?'application/pdf':'text/html'}});
  if(!response.ok||Number(response.headers.get('content-length'))>maximum)throw Error('Cboe source unavailable.');
  const reader=response.body?.getReader();if(!reader)throw Error('Empty Cboe source.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maximum)throw Error('Cboe source exceeds safe size.');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return {bytes,lastModified:response.headers.get('last-modified'),etag:response.headers.get('etag')};
}
const fetchVerifiedCalendar=unstable_cache(async(year:number)=>{
  const landing=await readSource(CBOE_CALENDAR_URL,1_000_000),sources=discoverCalendarSources(new TextDecoder().decode(landing.bytes));
  if(!sources.size)throw Error('Cboe calendar links need review.');
  const availableYears=[...sources.keys()].sort((a,b)=>a-b),url=sources.get(year);
  if(!url)throw Error('This year has not been published.');
  const source=await readSource(url,5_000_000),hash=createHash('sha256').update(source.bytes).digest('hex'),retrievedAt=new Date().toISOString();
  const calendar=year===seed.year&&seed.source.sha256===hash?{...seed,source:{...seed.source,retrievedAt,lastModified:source.lastModified,etag:source.etag}}:await parseCboeCalendar(source.bytes,year,{url,retrievedAt,lastModified:source.lastModified,etag:source.etag});
  return {calendar,checkedAt:Date.now(),availableYears};
},['cboe-options-source-v1'],{revalidate:CALENDAR_CHECK_MS/1000});
export async function getCboeExpirationCalendar(year:number):Promise<ExpirationCalendarResponse>{
  const now=Date.now(),cached=state.entries.get(year);
  if(!cached||now-cached.attemptedAt>(cached.failed?15*60*1000:CALENDAR_CHECK_MS)){
    if(state.pending)await state.pending;
    const newer=state.entries.get(year);
    if(!newer||Date.now()-newer.attemptedAt>(newer.failed?15*60*1000:CALENDAR_CHECK_MS)){
      state.pending=(async()=>{
        let availableYears=newer?.availableYears??[2026];
        try{
          const result=await fetchVerifiedCalendar(year);availableYears=result.availableYears;
          state.entries.set(year,{...result,attemptedAt:Date.now(),failed:Date.now()-result.checkedAt>CALENDAR_CHECK_MS});
        }catch{state.entries.set(year,{calendar:newer?.calendar??(year===seed.year?seed:null),checkedAt:newer?.checkedAt??Date.parse(seed.source.retrievedAt),attemptedAt:Date.now(),failed:true,availableYears});}
        while(state.entries.size>3)state.entries.delete(state.entries.keys().next().value!);
      })().finally(()=>{state.pending=null;});
      await state.pending;
    }
  }
  const entry=state.entries.get(year)??{calendar:year===seed.year?seed:null,checkedAt:Date.parse(seed.source.retrievedAt),attemptedAt:Date.now(),failed:true,availableYears:[2026]};
  return {calendar:entry.calendar,availableYears:entry.availableYears,checkedAt:new Date(entry.checkedAt).toISOString(),nextCheckAt:new Date(entry.attemptedAt+(entry.failed?15*60*1000:CALENDAR_CHECK_MS)).toISOString(),status:entry.failed?(entry.calendar?'stale':'unavailable'):'current',message:entry.failed?(entry.calendar?'Cboe could not be reverified. Showing the last verified calendar; check the official source before relying on a date.':'Cboe has not supplied a verified calendar for this year.'):null};
}
