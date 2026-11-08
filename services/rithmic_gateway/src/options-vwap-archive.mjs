import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {join} from 'node:path';
const DAY=86400000;
const nyFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function optionsVwapQuery(url,now=Date.now()){
 const keys=[...url.searchParams.keys()];if(new Set(keys).size!==keys.length||keys.some(k=>!['symbol','from','to'].includes(k)))throw Error('Unsupported parameter');
 const symbol=url.searchParams.get('symbol')||'',from=url.searchParams.get('from'),to=url.searchParams.get('to');
 if(!/^[A-Z][A-Z.]{0,11}$/.test(symbol)||!date(from)||!date(to))throw Error('Invalid options range');
 const first=Date.parse(from+'T12:00:00Z'),last=Date.parse(to+'T12:00:00Z');
 if(last<first||last-first>9*DAY||last>now+DAY)throw Error('Choose up to ten calendar days');
 return {symbol,from,to};
}
// Read-only owned observations. No vendor calls and no fabricated missing prints.
export class OptionsVwapArchiveReader{
 constructor({dir,now=Date.now,maxRecords=100000}){this.dir=dir;this.now=now;this.maxRecords=maxRecords;this.cache=new Map();this.files=new Map();this.active=0;}
 async read(query){
  const key=JSON.stringify(query),old=this.cache.get(key);if(old&&old.expires>this.now())return old.promise;
  if(this.active>=1)throw Error('Archive busy');
  this.active++;const promise=this.load(query).finally(()=>{this.active--;});
  const entry={expires:Infinity,promise};this.cache.set(key,entry);if(this.cache.size>20)this.cache.delete(this.cache.keys().next().value);
  try{const result=await promise;entry.expires=this.now()+15000;return result;}catch(error){this.cache.delete(key);throw error;}
 }
 async file(session){
  const file=join(this.dir,'exposure',session,'options-tool-order-flow-consolidated.ndjson.gz'),info=await stat(file).catch(()=>null);
  if(!info)return null;const identity=`${info.size}|${info.mtimeMs}`,cached=this.files.get(file);
  if(cached?.identity===identity)return cached;
  const rows=new Map(),cancelled=new Set();let truncated=false,readError=null,bytes=0,skipped=0;
  if(info.size>32*1024*1024)return {rows,cancelled,truncated:true,readError:'compressed-size-limit',skipped};
  const source=createReadStream(file),gzip=createGunzip(),lines=createInterface({input:source.pipe(gzip),crlfDelay:Infinity});
  source.on('error',e=>{readError=e;lines.close();});gzip.on('error',e=>{readError=e;lines.close();});
  try{for await(const line of lines){bytes+=Buffer.byteLength(line);if(bytes>64*1024*1024){truncated=true;break;}
   let snapshot;try{snapshot=JSON.parse(line);}catch{truncated=true;continue;}
   const received=Number(snapshot.ts)||Date.parse(snapshot.ts),data=snapshot.payload?.data;
   if(!Array.isArray(data)||!Number.isFinite(received))continue;
   for(const row of data){if(typeof row.id!=='string'||row.id.length>200||typeof row.ticker!=='string'||row.parentId)continue;
    const id=row.ticker+':'+row.id,type=String(row.tradeType||'').toUpperCase();
    if(type==='CANCEL'||type==='CANCELLATION'){const original=row.originalTradeId||row.originalId||row.id;if(original){const key=row.ticker+':'+original;rows.delete(key);cancelled.add(key);}skipped++;continue;}
    if(cancelled.has(id))continue;
    const time=Number(row.tradeTime),price=Number(row.stockPrice),size=Number(row.size),side=row.contractType==='CALL'?1:row.contractType==='PUT'?-1:0;
    if(!side||!Number.isFinite(time)||time<1e12||!Number.isFinite(price)||price<=0||!Number.isInteger(size)||size<=0){skipped++;continue;}
    const previous=rows.get(id);if(!previous&&rows.size>=this.maxRecords){truncated=true;continue;}
    const same=previous&&previous.event[0]===time&&previous.event[1]===price&&previous.event[2]===size&&previous.event[3]===side;
    rows.set(id,{symbol:row.ticker,date:same?previous.date:nyFormatter.format(time),event:[time,price,size,side,Math.max(time,same?previous.event[4]:received)]});
   }
  }}catch(error){readError=error;}finally{lines.close();source.destroy();gzip.destroy();}
  const result={identity,rows,cancelled,truncated:truncated||Boolean(readError),readError:readError?'compressed-capture-incomplete':null,skipped};
  this.files.delete(file);this.files.set(file,result);
  // Keep compact event records, never the raw Greek-heavy provider payloads.
  let count=[...this.files.values()].reduce((n,value)=>n+value.rows.size,0);
  for(const [key,value] of this.files){if(count<=this.maxRecords&&this.files.size<=12)break;this.files.delete(key);count-=value.rows.size;}
  return result;
 }
 async load({symbol,from,to}){
  const records=new Map(),removed=new Set(),dates=new Set(),missing=[],readErrors=[];let truncated=false,skipped=0;
  // Recorder folders use the Chicago session START date; a cash session is
  // usually in the previous day's folder. Also read its post-close folder.
  for(let t=Date.parse(from+'T12:00:00Z')-DAY;t<=Date.parse(to+'T12:00:00Z');t+=DAY){
   const session=new Date(t).toISOString().slice(0,10),file=await this.file(session);if(!file)continue;
   truncated ||= file.truncated;if(file.readError)readErrors.push({folder:session,reason:file.readError});skipped+=file.skipped;
   for(const key of file.cancelled){records.delete(key);removed.add(key);}
   for(const [id,row] of file.rows){if(removed.has(id)||row.symbol!==symbol||row.date<from||row.date>to)continue;
    const previous=records.get(id),event=row.event;
    if(!previous&&records.size>=this.maxRecords){truncated=true;continue;}
    const same=previous&&previous[0]===event[0]&&previous[1]===event[1]&&previous[2]===event[2]&&previous[3]===event[3];
    records.set(id,same?[...event.slice(0,4),Math.min(event[4],previous[4])]:event);dates.add(row.date);
   }
  }
  for(let t=Date.parse(from+'T12:00:00Z');t<=Date.parse(to+'T12:00:00Z');t+=DAY){const d=new Date(t);if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&!dates.has(d.toISOString().slice(0,10)))missing.push(d.toISOString().slice(0,10));}
  const ordered=[...records.entries()].sort((a,b)=>a[1][0]-b[1][0]);
  return {schemaVersion:1,ids:ordered.map(([id])=>id.slice(symbol.length+1)),symbol,from,to,asOf:new Date(this.now()).toISOString(),events:ordered.map(([,event])=>event),coverage:{kind:'observed-options-contracts',complete:false,sessions:[...dates].sort(),missing,truncated,readErrors,skippedRecords:skipped},refreshAfterMs:15000};
 }
}

